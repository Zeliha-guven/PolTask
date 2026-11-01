"""CB-8 (unit) — alan listesi ve değer listelerinin tek tanımı."""
from poltask.domain.fields import (
    ALLOWED_VALUES,
    DURUMLAR,
    FIELD_KEYS,
    FIELDS,
    KAPALI_DURUMLAR,
    KAPSAM_TIPLERI,
    SOZLESME_DEGERLERI,
    meta_fields,
)
from tests.support import HEADERS


def test_fields_order_matches_excel_columns():
    assert [f.header for f in FIELDS] == HEADERS
    assert FIELD_KEYS[:3] == ["ana_baslik", "konu", "sozlesme"] and FIELD_KEYS[-1] == "opm_no"


def test_allowed_value_lists():
    assert DURUMLAR == ["Başlamadı", "Beklemede", "Geliştirmede", "Testte", "Tamamlandı", "İptal"]
    assert KAPSAM_TIPLERI == ["Ana Kapsam", "Bug fix", "Ek İstek", "Kapsam İçi Değişiklik"]
    assert SOZLESME_DEGERLERI == ["Dahil", "Dahil değil"]
    assert KAPALI_DURUMLAR == ["Tamamlandı", "İptal"] and set(KAPALI_DURUMLAR) <= set(DURUMLAR)
    assert ALLOWED_VALUES == {"durum": DURUMLAR, "kapsam_tipi": KAPSAM_TIPLERI, "sozlesme": SOZLESME_DEGERLERI}


def test_meta_fields_shape():
    alanlar = meta_fields()
    assert alanlar[0] == {"anahtar": "ana_baslik", "baslik": "ANA BAŞLIK", "etiket": "Ana Başlık", "tip": "text"}
    tips = {a["anahtar"]: a["tip"] for a in alanlar}
    assert {k for k, t in tips.items() if t == "textarea"} == {"konu", "aciklama", "ltr_yorum"}
    assert set(tips.values()) <= {"text", "textarea", "int", "date"}
    ranges = {a["anahtar"]: (a["min"], a["max"]) for a in alanlar if a["tip"] == "int"}
    assert ranges == {"yuzde": (0, 100), "oncelik": (1, 3)}
    assert tips["yuzde"] == tips["oncelik"] == "int" and tips["hedef_tarih"] == "date"
