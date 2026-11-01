"""Veritabanını orijinal Excel formatında dışa aktarır."""
import io
from datetime import datetime

from openpyxl import Workbook
from openpyxl.styles import Alignment, Border, Font, PatternFill, Side

from db import DURUMLAR, FIELDS, compute_pivot

HEADER_FILL = PatternFill("solid", fgColor="DDEBF7")
BOLD = Font(bold=True)
THIN = Side(style="thin", color="BFBFBF")
BORDER = Border(left=THIN, right=THIN, top=THIN, bottom=THIN)


def comments_text(conn):
    """Görev başına yorumları 'İçerik Detayı-Tarihçe' kolonu için tek metne çevirir (eskiden yeniye)."""
    out = {}
    for c in conn.execute("SELECT task_id, metin, zaman, ice_aktarim FROM comments ORDER BY zaman, id"):
        line = c["metin"]
        if not c["ice_aktarim"]:
            line = f"[{datetime.strptime(c['zaman'][:10], '%Y-%m-%d').strftime('%d.%m.%Y')}] {line}"
        out.setdefault(c["task_id"], []).append(line)
    return {k: "\n".join(v) for k, v in out.items()}


def write_pivot(ws, pivot):
    statuses = [d for d in DURUMLAR if any(d in row for row in pivot.values())]
    statuses += sorted({d for row in pivot.values() for d in row} - set(statuses))
    ws["B2"] = "Say Tamamlanma Durumu "
    ws["C2"] = "Sütun Etiketleri"
    header = ["Satır Etiketleri"] + statuses + ["Genel Toplam"]
    for j, h in enumerate(header):
        cell = ws.cell(row=3, column=2 + j, value=h)
        cell.font, cell.fill, cell.border = BOLD, HEADER_FILL, BORDER
    r = 4
    for kapsam in sorted(pivot):
        ws.cell(row=r, column=2, value=kapsam).border = BORDER
        for j, s in enumerate(statuses):
            ws.cell(row=r, column=3 + j, value=pivot[kapsam].get(s)).border = BORDER
        ws.cell(row=r, column=3 + len(statuses), value=sum(pivot[kapsam].values())).border = BORDER
        r += 1
    ws.cell(row=r, column=2, value="Genel Toplam")
    for j, s in enumerate(statuses):
        ws.cell(row=r, column=3 + j, value=sum(row.get(s, 0) for row in pivot.values()))
    ws.cell(row=r, column=3 + len(statuses), value=sum(sum(row.values()) for row in pivot.values()))
    for j in range(len(header)):
        c = ws.cell(row=r, column=2 + j)
        c.font, c.fill, c.border = BOLD, HEADER_FILL, BORDER
    ws.column_dimensions["B"].width = 24


def export_workbook(conn):
    wb = Workbook()
    write_pivot(wb.active, compute_pivot(conn))
    wb.active.title = "Güncel Durum"

    ws = wb.create_sheet("Linktera_Tüm_İşler")
    for j, (_, header, _) in enumerate(FIELDS, start=1):
        cell = ws.cell(row=1, column=j, value=header)
        cell.font, cell.fill = BOLD, HEADER_FILL
        cell.alignment = Alignment(wrap_text=True, vertical="center")
    tarihce = comments_text(conn)
    for i, t in enumerate(conn.execute("SELECT * FROM tasks ORDER BY sira, id"), start=2):
        for j, (key, _, typ) in enumerate(FIELDS, start=1):
            v = t[key]
            if key == "icerik_tarihce":
                v = tarihce.get(t["id"])
            elif key == "yuzde" and v is not None:
                v = v / 100
            elif typ == "date" and v:
                v = datetime.strptime(v, "%Y-%m-%d")
            cell = ws.cell(row=i, column=j, value=v)
            if key == "yuzde":
                cell.number_format = "0%"
            elif typ == "date":
                cell.number_format = "dd.mm.yyyy"
    widths = {"ANA BAŞLIK": 30, "KONU": 50, "Açıklama": 50, "LTR Yorum": 30, "İçerik Detayı-Tarihçe": 50}
    for j, (_, header, _) in enumerate(FIELDS, start=1):
        ws.column_dimensions[ws.cell(row=1, column=j).column_letter].width = widths.get(header, 16)
    ws.freeze_panes = "C2"
    ws.auto_filter.ref = ws.dimensions

    buf = io.BytesIO()
    wb.save(buf)
    buf.seek(0)
    return buf
