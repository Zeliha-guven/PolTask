"""Testlerin ortak yardımcıları: sabit saat, test içinde üretilen Excel fixture'ları, çalışma kitabı özeti."""
import io
from datetime import date, datetime, timedelta

from openpyxl import Workbook, load_workbook

FIXED_NOW = datetime(2026, 11, 4, 10, 0, 0)  # Çarşamba, ISO 2026-W45
FIXED_TS = "2026-11-04 10:00:00"


class Clock:
    """Enjekte edilen saat: çağrılınca şimdiki zamanı döner; testler ilerletebilir."""

    def __init__(self, now=FIXED_NOW):
        self.now = now

    def __call__(self):
        return self.now

    def advance(self, **kw):
        self.now = self.now + timedelta(**kw)


# "Linktera_Tüm_İşler" başlıkları — kaynak Excel ile birebir (sondaki boşluklar dahil)
HEADERS = [
    "ANA BAŞLIK", "KONU", "Sözleşme Kapsamına Dahil/Dahil değil", "Kapsam Tipi", "LTR Yorum", "Açıklama",
    "Tamamlanma Yüzdesi", "Tamamlanma Durumu ", "OPM Talep Tarihi", "İlk Verilen Hedef Teslim Tarihi(Linktera)",
    "Hedef Teslim Tarihi(Linktera)", "UAT Hedefi(TurkOnay)", "Bitiş Tarihi ", "Yaygınlaştırma Tarihi",
    "CR NUMARASI", "TALEP SORUMLUSU", "LİNKTERA SORUMLUSU", "Kimde Bekliyor?", "Öncelik",
    "İçerik Detayı-Tarihçe", "OPM NO",
]

DEFAULT_ROWS = [
    {
        "ANA BAŞLIK": "Ödeme", "KONU": "Kart ile ödeme", "Sözleşme Kapsamına Dahil/Dahil değil": "Dahil",
        "Kapsam Tipi": "Ana Kapsam", "Tamamlanma Yüzdesi": 0.5, "Tamamlanma Durumu ": "Geliştirmede",
        "OPM Talep Tarihi": datetime(2026, 9, 1), "Hedef Teslim Tarihi(Linktera)": datetime(2026, 12, 1),
        "Kimde Bekliyor?": "linktrera", "Öncelik": 1, "İçerik Detayı-Tarihçe": "23.09 görüşüldü",
        "OPM NO": "#LTR100", "TALEP SORUMLUSU": "Zeliha",
    },
    {
        "ANA BAŞLIK": "Rapor", "KONU": "Aylık rapor\nikinci satır", "Sözleşme Kapsamına Dahil/Dahil değil":
        "Dahil değil", "Kapsam Tipi": "Ek İstek", "Tamamlanma Yüzdesi": 1, "Tamamlanma Durumu ": "Tamamlandı",
        "Bitiş Tarihi ": datetime(2026, 10, 15), "Öncelik": "2", "OPM NO": "LTR200",
    },
    {"KONU": "Bağımsız iş", "Tamamlanma Durumu ": "Başlamadı", "LTR Yorum": "-"},
]

OPM_HEADERS = ["Kod", "Konu", "Atanan", "Durum", "Öncelik", "Tür", "Modül", "Sorun Raportörü",
               "Oluşturulma Zamanı", "Son Güncellenme Zamanı"]
OPM_ROWS = [
    ["#LTR100", "OPM konu 1", "Ali", "Kapatıldı", "Yüksek", "Hata", "Ödeme", "Veli",
     datetime(2026, 10, 1, 9, 30), datetime(2026, 10, 2, 10, 0)],
    ["LTR 300", "OPM konu 3", "Ayşe", "Açık", "Düşük", "İstek", "Rapor", "Can", None, None],
    ["kodsuz", "atlanır", None, "Açık", None, None, None, None, None, None],
]


def _add_opm_sheet(wb, name="opm"):
    ws = wb.create_sheet(name)
    ws.append(OPM_HEADERS)
    for r in OPM_ROWS:
        ws.append(r)


def build_main_workbook(path, rows=None, history=True, opm=True):
    wb = Workbook()
    ws = wb.active
    ws.title = "Linktera_Tüm_İşler"
    ws.append(["Linktera iş listesi"])  # başlıktan önce bir satır: başlık satırı aranarak bulunur
    ws.append(HEADERS)
    for r in DEFAULT_ROWS if rows is None else rows:
        ws.append([r.get(h) for h in HEADERS])
    if history:
        hs = wb.create_sheet("Karşılaştırmalı özet")
        for r in (
            ["23 Eylül itibariyle:"],
            ["Row Labels", "Başlamadı", "Tamamlandı", "Grand Total"],
            ["Ana Kapsam", 2, 5, 7],
            ["Ek İstek", None, 1, 1],
            ["Grand Total", 2, 6, 8],
        ):
            hs.append(r)
    if opm:
        _add_opm_sheet(wb)
    wb.save(path)
    return path


def build_opm_workbook(path):
    wb = Workbook()
    wb.remove(wb.active)
    _add_opm_sheet(wb, "Sayfa1")
    wb.save(path)
    return path


def _plain(v):
    if isinstance(v, (datetime, date)):
        return v.isoformat()
    return v


def workbook_digest(data):
    """Çalışma kitabının karşılaştırılabilir özeti: sayfa, hücre, değer, biçim, kalın, dolgu, genişlik."""
    wb = load_workbook(io.BytesIO(data) if isinstance(data, bytes) else data)
    out = []
    for ws in wb.worksheets:
        cells = []
        for row in ws.iter_rows():
            for c in row:
                fill = c.fill.fgColor.rgb if c.fill and c.fill.fill_type else None
                if c.value is None and not c.font.bold and not fill:
                    continue
                cells.append([c.coordinate, _plain(c.value), c.number_format, bool(c.font.bold), fill])
        widths = {k: d.width for k, d in sorted(ws.column_dimensions.items()) if d.width}
        out.append({"sheet": ws.title, "cells": cells, "widths": widths,
                    "freeze": ws.freeze_panes, "filter": ws.auto_filter.ref})
    wb.close()
    return out


def data_dir_fingerprint(directory):
    """Klasördeki her dosyanın (ad, boyut, mtime_ns, sha256) özeti. Dosyalar yalnızca bayt olarak okunur —
    sqlite ile açılmaz (açmak bile -journal/-wal dosyası bırakabilir)."""
    import hashlib
    from pathlib import Path

    directory = Path(directory)
    if not directory.is_dir():
        return None
    out = {}
    for p in sorted(directory.iterdir()):
        if p.is_file():
            st = p.stat()
            out[p.name] = (st.st_size, st.st_mtime_ns, hashlib.sha256(p.read_bytes()).hexdigest())
    return out
