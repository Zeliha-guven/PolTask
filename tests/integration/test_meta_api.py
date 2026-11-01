"""CB-8 (A-2) — alan ve değer listeleri tek tanımdan; doğrulamayla aynı değerler."""
import pytest

from poltask.domain import fields
from tests.integration.helpers import create_task
from tests.support import HEADERS

pytestmark = pytest.mark.integration


def test_meta_serves_fields_and_values_from_domain(client):
    m = client.get("/api/meta").get_json()
    assert m["durumlar"] == fields.DURUMLAR
    assert m["kapsam_tipleri"] == fields.KAPSAM_TIPLERI
    assert m["sozlesme_degerleri"] == fields.SOZLESME_DEGERLERI == ["Dahil", "Dahil değil"]
    assert [a["baslik"] for a in m["alanlar"]] == HEADERS
    for a in m["alanlar"]:
        extra = {"min", "max"} if a["tip"] == "int" else set()
        assert set(a) == {"anahtar", "baslik", "etiket", "tip"} | extra
    by_key = {a["anahtar"]: a for a in m["alanlar"]}
    assert by_key["konu"] == {"anahtar": "konu", "baslik": "KONU", "etiket": "Konu", "tip": "textarea"}
    assert by_key["yuzde"]["tip"] == "int" and by_key["hedef_tarih"]["tip"] == "date"
    # A-8: int alanlarının aralığı, doğrulamanın kullandığı domain sabitlerinden
    assert (by_key["yuzde"]["min"], by_key["yuzde"]["max"]) == fields.INT_RANGES["yuzde"] == (0, 100)
    assert (by_key["oncelik"]["min"], by_key["oncelik"]["max"]) == fields.INT_RANGES["oncelik"] == (1, 3)
    for key, (lo, hi) in fields.INT_RANGES.items():
        assert create_task(client, **{key: lo})[key] == lo and create_task(client, **{key: hi})[key] == hi
        assert client.post("/api/tasks", json={"konu": "x", key: hi + 1}).status_code == 400


def test_meta_serves_closed_statuses_and_default(client):
    """A-6: kapanmış durumlar ve varsayılan durum açıkça sunulur (liste sırasından çıkarılmaz)."""
    m = client.get("/api/meta").get_json()
    assert m["kapali_durumlar"] == fields.KAPALI_DURUMLAR == ["Tamamlandı", "İptal"]
    assert set(m["kapali_durumlar"]) <= set(m["durumlar"])
    assert m["varsayilan_durum"] == fields.DEFAULT_DURUM == "Başlamadı"
    assert client.post("/api/tasks", json={"konu": "x"}).get_json()["durum"] == m["varsayilan_durum"]


def test_meta_keeps_existing_keys(client):
    create_task(client)
    m = client.get("/api/meta").get_json()
    assert {"son_ice_aktarim", "son_opm_aktarim", "opm_sayisi", "is_sayisi"} <= set(m)
    assert (m["is_sayisi"], m["opm_sayisi"], m["son_ice_aktarim"], m["son_opm_aktarim"]) == (1, 0, None, None)


def test_served_values_accepted_others_rejected(client):
    m = client.get("/api/meta").get_json()
    for field, key in (("durum", "durumlar"), ("kapsam_tipi", "kapsam_tipleri"), ("sozlesme", "sozlesme_degerleri")):
        for value in m[key]:
            assert create_task(client, **{field: value})[field] == value
        r = client.post("/api/tasks", json={"konu": "x", field: m[key][0] + "x"})
        assert r.status_code == 400
