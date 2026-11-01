"""Linktera Excel dosyasının okunması: iş listesi, geçmiş haftalık özetler, OPM sayfası → düz veri."""
import re
from typing import NamedTuple

from poltask.domain.fields import FIELDS
from poltask.integrations.cleaning import (
    clean_date,
    clean_int,
    clean_percent,
    clean_single_line,
    clean_text,
    tr_lower,
)
from poltask.integrations.errors import ImportFormatError
from poltask.integrations.opm_import import MAIN_SHEET, find_header, parse_opm, read_workbook

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


class ParsedWorkbook(NamedTuple):
    tasks: list  # [(kayıt, tarihçe metni)]
    history: list  # [(tarih, etiket, pivot)]
    opm: list | None  # OPM kayıtları; sayfa yoksa None


def clean_row(row, header_index):
    rec = {}
    for f in FIELDS:
        key, typ = f.key, f.type
        idx = header_index.get(f.header.strip())
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


def parse_tasks(wb):
    if MAIN_SHEET not in wb.sheetnames:
        raise ImportFormatError(f"'{MAIN_SHEET}' sayfası bulunamadı")
    ws = wb[MAIN_SHEET]
    hdr_row, header_index = find_header(ws, ["ANA BAŞLIK", "KONU", "Kapsam Tipi"])
    if hdr_row is None:
        raise ImportFormatError(f"'{MAIN_SHEET}' sayfasında başlık satırı bulunamadı")
    items = []
    for row in ws.iter_rows(min_row=hdr_row + 2, values_only=True):
        if not any(c is not None for c in row):
            continue
        rec = clean_row(row, header_index)
        if not rec["konu"] and not rec["ana_baslik"]:
            continue
        # Tarihçe metni yorum akışına taşınır; dışa aktarımda yorumlardan yeniden üretilir
        tarihce, rec["icerik_tarihce"] = rec["icerik_tarihce"], None
        items.append((rec, tarihce))
    return items


def parse_title_date(title, year):
    """Başlıkta yıl yok ("23 Eylül"): yıl açık parametredir (docs/conventions.md, Known traps)."""
    m = re.search(r"(\d{1,2})\s+([A-Za-zÇĞİÖŞÜçğıöşü]+)", title)
    if not m:
        return None
    month = AYLAR.get(tr_lower(m.group(2)))
    return f"{year}-{month:02d}-{int(m.group(1)):02d} 00:00:00" if month else None


def parse_history(wb, year):
    """'Karşılaştırmalı özet' sayfasındaki elle hazırlanmış haftalık pivotlar → [(tarih, etiket, pivot)]."""
    if HISTORY_SHEET not in wb.sheetnames:
        return []
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
    return sorted(found)


def read_excel_file(path, year):
    """Dosyayı tamamen okur ve kapatır (Windows dosya kilidi), sonra düz veriyi döner.

    Ana sayfa / başlık satırı yoksa ImportFormatError; okunamayan dosyada UnreadableFileError.
    """
    return read_workbook(path, lambda wb: ParsedWorkbook(parse_tasks(wb), parse_history(wb, year), parse_opm(wb)))
