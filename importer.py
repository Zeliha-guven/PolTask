"""Excel içe aktarma: ana iş listesi, geçmiş haftalık özetler ve OPM export.

Komut satırından ilk kurulum:  python importer.py "<excel yolu>"
"""
import json
import re
import sys
from datetime import date, datetime

import openpyxl

from db import FIELDS, connect, init_db, now, set_meta, take_snapshot

MAIN_SHEET = "Linktera_Tüm_İşler"
HISTORY_SHEET = "Karşılaştırmalı özet"

AYLAR = {
    "ocak": 1, "şubat": 2, "mart": 3, "nisan": 4, "mayıs": 5, "haziran": 6,
    "temmuz": 7, "ağustos": 8, "eylül": 9, "ekim": 10, "kasım": 11, "aralık": 12,
}

# Elle girilen serbest metinlerdeki yazım farklarını tek değere indirger
NORMALIZE = {
    "kimde_bekliyor": {
        "linktera": "Linktera", "linktrera": "Linktera",
        "turkonay": "TurkOnay", "turkonay cr onayı": "TurkOnay CR onayı",
    },
}


def tr_lower(s):
    return s.replace("I", "ı").replace("İ", "i").lower()


def clean_text(v):
    if v is None:
        return None
    if isinstance(v, (datetime, date)):
        return v.strftime("%Y-%m-%d")
    s = str(v).replace("\xa0", " ").replace("\r\n", "\n").strip()
    if s in ("", "-", "0"):
        return None
    return s


def clean_single_line(v):
    s = clean_text(v)
    return re.sub(r"\s+", " ", s) if s else s


def clean_date(v):
    if isinstance(v, (datetime, date)):
        return v.strftime("%Y-%m-%d")
    return None


def clean_int(v):
    if isinstance(v, bool) or v is None:
        return None
    if isinstance(v, (int, float)):
        return int(v)
    try:
        return int(float(str(v).strip()))
    except ValueError:
        return None


def clean_percent(v):
    if isinstance(v, (int, float)) and not isinstance(v, bool):
        return round(v * 100) if v <= 1 else round(v)
    return None


def clean_row(row, header_index):
    rec = {}
    for key, header, typ in FIELDS:
        idx = header_index.get(header.strip())
        v = row[idx] if idx is not None and idx < len(row) else None
        if key == "yuzde":
            rec[key] = clean_percent(v)
        elif typ == "date":
            rec[key] = clean_date(v)
        elif typ == "int":
            rec[key] = clean_int(v)
        elif key in ("konu", "aciklama", "ltr_yorum", "icerik_tarihce"):
            rec[key] = clean_text(v)
        else:
            rec[key] = clean_single_line(v)
        if rec[key] and key in NORMALIZE:
            rec[key] = NORMALIZE[key].get(tr_lower(rec[key]), rec[key])
    return rec


def find_header(ws, required, max_rows=10):
    """İlk birkaç satırda zorunlu başlıkları içeren satırı bulur → (satır no, {başlık: kolon})."""
    for i, row in enumerate(ws.iter_rows(max_row=max_rows, values_only=True)):
        index = {}
        for j, c in enumerate(row):
            if isinstance(c, str) and c.strip() and c.strip() not in index:
                index[c.strip()] = j
        if all(r in index for r in required):
            return i, index
    return None, None


def import_tasks(conn, wb):
    ws = wb[MAIN_SHEET]
    hdr_row, header_index = find_header(ws, ["ANA BAŞLIK", "KONU", "Kapsam Tipi"])
    if hdr_row is None:
        raise ValueError(f"'{MAIN_SHEET}' sayfasında başlık satırı bulunamadı")

    for t in ("tasks", "task_history", "comments", "snapshots"):
        conn.execute(f"DELETE FROM {t}")
    conn.execute("DELETE FROM sqlite_sequence WHERE name IN ('tasks','task_history','comments','snapshots')")

    keys = [f[0] for f in FIELDS]
    ts = now()
    count = 0
    for row in ws.iter_rows(min_row=hdr_row + 2, values_only=True):
        if not any(c is not None for c in row):
            continue
        rec = clean_row(row, header_index)
        if not rec["konu"] and not rec["ana_baslik"]:
            continue
        count += 1
        # Tarihçe metni yorum akışına taşınır; dışa aktarımda yorumlardan yeniden üretilir
        tarihce, rec["icerik_tarihce"] = rec["icerik_tarihce"], None
        cur = conn.execute(
            f"INSERT INTO tasks(sira, {', '.join(keys)}, created_at, updated_at) "
            f"VALUES(?, {', '.join('?' * len(keys))}, ?, ?)",
            [count] + [rec[k] for k in keys] + [ts, ts],
        )
        if tarihce:
            conn.execute(
                "INSERT INTO comments(task_id, metin, zaman, ice_aktarim) VALUES(?, ?, ?, 1)",
                (cur.lastrowid, tarihce, ts),
            )
    return count


def parse_title_date(title, year):
    m = re.search(r"(\d{1,2})\s+([A-Za-zÇĞİÖŞÜçğıöşü]+)", title)
    if not m:
        return None
    month = AYLAR.get(tr_lower(m.group(2)))
    return f"{year}-{month:02d}-{int(m.group(1)):02d} 00:00:00" if month else None


def import_history(conn, wb, year):
    """'Karşılaştırmalı özet' sayfasındaki elle hazırlanmış haftalık pivotları snapshot olarak aktarır."""
    if HISTORY_SHEET not in wb.sheetnames:
        return 0
    rows = [list(r) for r in wb[HISTORY_SHEET].iter_rows(values_only=True)]
    width = max((len(r) for r in rows), default=0)
    found = []
    # Pivot blokları yan yana duruyor; başlık hücresi olan her kolondan aşağı doğru tara
    for col in range(width):
        state = None
        for r in rows:
            cell = r[col] if col < len(r) else None
            text = cell.strip() if isinstance(cell, str) else ""
            low = tr_lower(text)
            if "itibariyle" in low or "haftası" in low:
                state = {"title": text, "statuses": None, "pivot": {}}
                continue
            if state is None:
                continue
            if low in ("row labels", "satır etiketleri"):
                # Toplam kolonuna kadar olan bitişik hücreler; sağdaki diğer bloğa taşma
                state["statuses"] = []
                for j in range(col + 1, len(r)):
                    c = r[j].strip() if isinstance(r[j], str) else ""
                    if not c or tr_lower(c) in ("grand total", "genel toplam"):
                        break
                    state["statuses"].append((j, c))
                continue
            if state["statuses"] is None or not text:
                continue
            if low in ("grand total", "genel toplam"):
                tarih = parse_title_date(state["title"], year)
                if tarih:
                    found.append((tarih, state["title"].rstrip(":").strip(), state["pivot"]))
                state = None
                continue
            kapsam = "(boş)" if low in ("(blank)", "(boş)") else text
            counts = {s: int(r[j]) for j, s in state["statuses"]
                      if j < len(r) and isinstance(r[j], (int, float)) and r[j]}
            if counts:
                state["pivot"][kapsam] = counts

    for tarih, etiket, pivot in sorted(found):
        conn.execute(
            "INSERT INTO snapshots(tarih, etiket, pivot_json) VALUES(?, ?, ?)",
            (tarih, etiket, json.dumps(pivot, ensure_ascii=False)),
        )
    return len(found)


def import_excel(path, year=None):
    """Ana listeyi (ve varsa geçmiş özetleri ile OPM sayfasını) içe aktarır. Mevcut veriyi siler."""
    init_db()
    wb = openpyxl.load_workbook(path, read_only=True, data_only=True)
    year = year or datetime.now().year
    with connect() as conn:
        n_tasks = import_tasks(conn, wb)
        n_hist = import_history(conn, wb, year)
        take_snapshot(conn, "İçe aktarım")
        n_opm = import_opm_workbook(conn, wb) if find_opm_sheet(wb) else None
        set_meta(conn, "son_ice_aktarim", now())
    return {"isler": n_tasks, "gecmis_ozet": n_hist, "opm": n_opm}


# --- OPM ---------------------------------------------------------------

OPM_COLS = {
    "kod": "Kod", "konu": "Konu", "atanan": "Atanan", "durum": "Durum", "oncelik": "Öncelik",
    "tur": "Tür", "modul": "Modül", "raportor": "Sorun Raportörü",
    "olusturma": "Oluşturulma Zamanı", "son_guncelleme": "Son Güncellenme Zamanı",
}


def normalize_opm(code):
    """'#LTR1424', 'LTR1424 ' → 'LTR1424'. Kod içermeyen metinlerde None."""
    if not code:
        return None
    m = re.search(r"LTR\s*\d+", str(code), re.IGNORECASE)
    return m.group(0).upper().replace(" ", "") if m else None


def find_opm_sheet(wb):
    # Ana Excel'de 'opm' en güncel, 'opm (2)' eski kopya; önce tam adı dene
    names = sorted(wb.sheetnames, key=lambda n: (n.strip().lower() != "opm", n))
    for name in names:
        if name == MAIN_SHEET:
            continue
        hdr_row, index = find_header(wb[name], ["Kod", "Durum", "Konu"])
        if hdr_row is not None:
            return name, hdr_row, index
    return None


def import_opm_workbook(conn, wb):
    found = find_opm_sheet(wb)
    if not found:
        raise ValueError("Excel'de 'Kod', 'Durum', 'Konu' başlıklarını içeren bir OPM sayfası bulunamadı")
    name, hdr_row, index = found
    conn.execute("DELETE FROM opm_tickets")
    count = 0
    for row in wb[name].iter_rows(min_row=hdr_row + 2, values_only=True):
        kod = normalize_opm(row[index["Kod"]] if index["Kod"] < len(row) else None)
        if not kod:
            continue
        rec = {"kod": kod}
        for key, header in OPM_COLS.items():
            if key == "kod":
                continue
            j = index.get(header)
            v = row[j] if j is not None and j < len(row) else None
            if isinstance(v, datetime):
                v = v.strftime("%Y-%m-%d %H:%M")
            rec[key] = clean_single_line(v)
        conn.execute(
            f"INSERT OR REPLACE INTO opm_tickets({', '.join(rec)}) VALUES({', '.join('?' * len(rec))})",
            list(rec.values()),
        )
        count += 1
    set_meta(conn, "son_opm_aktarim", now())
    return count


def import_opm(path):
    init_db()
    wb = openpyxl.load_workbook(path, read_only=True, data_only=True)
    with connect() as conn:
        return import_opm_workbook(conn, wb)


if __name__ == "__main__":
    import warnings
    warnings.filterwarnings("ignore")
    sys.stdout.reconfigure(encoding="utf-8")
    if len(sys.argv) < 2:
        print('Kullanım: python importer.py "<excel yolu>"')
        sys.exit(1)
    print(import_excel(sys.argv[1]))
