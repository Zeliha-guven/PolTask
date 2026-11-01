"""Girdi doğrulama — yalnızca api katmanında, domain'in tanımlarına karşı (docs/conventions.md, BR-5)."""
import re

from flask import abort

from poltask.domain.fields import ALLOWED_VALUES, EDITABLE_KEYS, FIELD_TYPES, INT_RANGES

DATE_RE = re.compile(r"^\d{4}-\d{2}-\d{2}$")


def clean_value(key, v):
    """Tek alan: boş → None; tip, aralık ve izin verilen değer denetimi; geçersizse 400."""
    if v is None or (isinstance(v, str) and v.strip() == ""):
        return None
    typ = FIELD_TYPES[key]
    if typ == "int":
        try:
            v = int(v)
        except (TypeError, ValueError):
            abort(400, f"{key}: sayı olmalı")
        lo, hi = INT_RANGES.get(key, (None, None))
        if lo is not None and not lo <= v <= hi:
            abort(400, f"{key}: {lo} ile {hi} arasında olmalı")
        return v
    if typ == "date":
        if not DATE_RE.match(str(v)):
            abort(400, f"{key}: tarih YYYY-AA-GG olmalı")
        return str(v)
    v = str(v).strip()
    allowed = ALLOWED_VALUES.get(key)
    if allowed is not None and v not in allowed:
        abort(400, f"{key}: geçersiz değer; izin verilenler: {', '.join(allowed)}")
    return v


def clean_create(data):
    return {k: clean_value(k, data.get(k)) for k in EDITABLE_KEYS}


def clean_update(data):
    """Yalnızca gönderilen düzenlenebilir alanlar; KONU ve Durum boşaltılamaz (CB-1, CB-2)."""
    values = {k: clean_value(k, v) for k, v in data.items() if k in EDITABLE_KEYS}
    if "konu" in values and values["konu"] is None:
        abort(400, "KONU boş olamaz")
    if "durum" in values and values["durum"] is None:
        abort(400, "durum: boş bırakılamaz")
    return values
