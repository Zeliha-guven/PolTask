"""Excel hücre değerlerinin temizlenmesi ve OPM No normalizasyonu."""
import re
from datetime import date, datetime


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


def normalize_opm(code):
    """'#LTR1424', 'LTR1424 ' → 'LTR1424'. Kod içermeyen metinlerde None."""
    if not code:
        return None
    m = re.search(r"LTR\s*\d+", str(code), re.IGNORECASE)
    return m.group(0).upper().replace(" ", "") if m else None
