"""OPM dışa aktarım dosyasının okunması (düz kayıtlara)."""
from contextlib import closing
from datetime import datetime

import openpyxl

from poltask.integrations.cleaning import clean_single_line, normalize_opm
from poltask.integrations.errors import ImportFormatError, UnreadableFileError

MAIN_SHEET = "Linktera_Tüm_İşler"
NO_OPM_SHEET = "Excel'de 'Kod', 'Durum', 'Konu' başlıklarını içeren bir OPM sayfası bulunamadı"

OPM_COLS = {
    "kod": "Kod", "konu": "Konu", "atanan": "Atanan", "durum": "Durum", "oncelik": "Öncelik",
    "tur": "Tür", "modul": "Modül", "raportor": "Sorun Raportörü",
    "olusturma": "Oluşturulma Zamanı", "son_guncelleme": "Son Güncellenme Zamanı",
}


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


def parse_opm(wb):
    """OPM sayfasını kayıtlara çevirir; sayfa yoksa None."""
    found = find_opm_sheet(wb)
    if not found:
        return None
    name, hdr_row, index = found
    records = []
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
        records.append(rec)
    return records


def read_workbook(path, parse):
    """Dosyayı açar, `parse(wb)` ile tamamen okur ve her durumda kapatır (Windows dosya kilidi).
    Kendi denetimlerimiz ImportFormatError; kütüphanenin her hatası UnreadableFileError olur."""
    try:
        # Dosyayı biz açarız: load_workbook yarıda hata verse de tutamak kapanır (Windows dosya kilidi)
        with open(path, "rb") as fh, closing(openpyxl.load_workbook(fh, read_only=True, data_only=True)) as wb:
            return parse(wb)
    except ImportFormatError:
        raise
    except Exception as e:  # noqa: BLE001 — bozuk zip/XML vb.; ayrıntı loga, kullanıcıya değil
        raise UnreadableFileError(f"{type(e).__name__}: {e}") from e


def read_opm_file(path):
    """OPM kayıtları; OPM sayfası yoksa ImportFormatError."""
    records = read_workbook(path, parse_opm)
    if records is None:
        raise ImportFormatError(NO_OPM_SHEET)
    return records
