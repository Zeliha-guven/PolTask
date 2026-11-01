"""Veriyi orijinal Excel formatında yazar ("Güncel Durum" + "Linktera_Tüm_İşler")."""
import io
from datetime import datetime

from openpyxl import Workbook
from openpyxl.styles import Alignment, Border, Font, PatternFill, Side

from poltask.domain.fields import DURUMLAR, FIELDS

HEADER_FILL = PatternFill("solid", fgColor="DDEBF7")
BOLD = Font(bold=True)
THIN = Side(style="thin", color="BFBFBF")
BORDER = Border(left=THIN, right=THIN, top=THIN, bottom=THIN)
WIDTHS = {"ANA BAŞLIK": 30, "KONU": 50, "Açıklama": 50, "LTR Yorum": 30, "İçerik Detayı-Tarihçe": 50}


def comments_text(comments):
    """Görev başına yorumları 'İçerik Detayı-Tarihçe' kolonu için tek metne çevirir (eskiden yeniye)."""
    out = {}
    for c in comments:
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


def build_workbook(pivot, tasks, comments):
    """pivot: Kapsam × Durum; tasks: sıralı iş satırları; comments: comments_for_export satırları → BytesIO."""
    wb = Workbook()
    write_pivot(wb.active, pivot)
    wb.active.title = "Güncel Durum"

    ws = wb.create_sheet("Linktera_Tüm_İşler")
    for j, f in enumerate(FIELDS, start=1):
        cell = ws.cell(row=1, column=j, value=f.header)
        cell.font, cell.fill = BOLD, HEADER_FILL
        cell.alignment = Alignment(wrap_text=True, vertical="center")
    tarihce = comments_text(comments)
    for i, t in enumerate(tasks, start=2):
        for j, f in enumerate(FIELDS, start=1):
            v = t[f.key]
            if f.key == "icerik_tarihce":
                v = tarihce.get(t["id"])
            elif f.key == "yuzde" and v is not None:
                v = v / 100
            elif f.type == "date" and v:
                v = datetime.strptime(v, "%Y-%m-%d")
            cell = ws.cell(row=i, column=j, value=v)
            if f.key == "yuzde":
                cell.number_format = "0%"
            elif f.type == "date":
                cell.number_format = "dd.mm.yyyy"
    for j, f in enumerate(FIELDS, start=1):
        ws.column_dimensions[ws.cell(row=1, column=j).column_letter].width = WIDTHS.get(f.header, 16)
    ws.freeze_panes = "C2"
    ws.auto_filter.ref = ws.dimensions

    buf = io.BytesIO()
    wb.save(buf)
    buf.seek(0)
    return buf
