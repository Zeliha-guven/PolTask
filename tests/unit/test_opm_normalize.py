"""PB-4 (unit) — OPM No normalizasyonu ve içe aktarım yardımcıları."""
import pytest

from poltask.integrations.cleaning import clean_percent, normalize_opm
from poltask.integrations.excel_import import parse_title_date


@pytest.mark.parametrize("raw, expected", [
    ("#LTR1424", "LTR1424"), ("LTR1424 ", "LTR1424"), ("ltr 12 açıklama", "LTR12"),
    ("kod yok", None), ("", None), (None, None),
])
def test_normalize_opm_ltr(raw, expected):
    assert normalize_opm(raw) == expected


def test_parse_title_date_uses_given_year():
    assert parse_title_date("23 Eylül itibariyle:", 2025) == "2025-09-23 00:00:00"
    assert parse_title_date("5 ŞUBAT haftası", 2026) == "2026-02-05 00:00:00"
    assert parse_title_date("başlık", 2026) is None


@pytest.mark.parametrize("raw, expected", [(0.5, 50), (1, 100), (55, 55), (0, 0), ("x", None), (None, None)])
def test_clean_percent(raw, expected):
    assert clean_percent(raw) == expected
