"""CB-1, CB-2, CB-3 ve PB-2 (reddedilen istek tarihçe yazmaz) — api katmanında doğrulama."""
import pytest

from tests.integration.helpers import create_task, tasks, timeline

pytestmark = pytest.mark.integration

INVALID = {"durum": "Bitti", "kapsam_tipi": "Yeni Kapsam", "sozlesme": "Belki"}


def assert_rejected(r):
    assert r.status_code == 400
    body = r.get_json()
    assert set(body) == {"error"} and body["error"].strip()


@pytest.mark.parametrize("field", list(INVALID))
def test_br5_invalid_value_rejected_on_create(client, field):
    assert_rejected(client.post("/api/tasks", json={"konu": "x", field: INVALID[field]}))
    assert tasks(client) == []


@pytest.mark.parametrize("field", list(INVALID))
def test_br5_invalid_value_rejected_on_update(client, field):
    t = create_task(client, kapsam_tipi="Ek İstek", sozlesme="Dahil")
    assert_rejected(client.patch(f"/api/tasks/{t['id']}", json={"konu": "değişmesin", field: INVALID[field]}))
    after = tasks(client)[0]
    assert after["konu"] == t["konu"] and after[field] == t[field]


def test_br5_valid_values_accepted(client):
    t = create_task(client, durum="Testte", kapsam_tipi="Kapsam İçi Değişiklik", sozlesme="Dahil değil")
    assert (t["durum"], t["kapsam_tipi"], t["sozlesme"]) == ("Testte", "Kapsam İçi Değişiklik", "Dahil değil")


def test_br5_kapsam_tipi_and_sozlesme_may_be_empty(client):
    t = create_task(client, kapsam_tipi="", sozlesme=None)
    assert t["kapsam_tipi"] is None and t["sozlesme"] is None
    t = create_task(client, kapsam_tipi="Ek İstek", sozlesme="Dahil")
    r = client.patch(f"/api/tasks/{t['id']}", json={"kapsam_tipi": "", "sozlesme": " "})
    assert r.status_code == 200 and (r.get_json()["kapsam_tipi"], r.get_json()["sozlesme"]) == (None, None)


def test_br5_durum_cannot_be_emptied_on_update(client):
    t = create_task(client)
    for empty in ("", "  ", None):
        assert_rejected(client.patch(f"/api/tasks/{t['id']}", json={"durum": empty}))
    assert tasks(client)[0]["durum"] == "Başlamadı"


def test_create_with_empty_durum_defaults_baslamadi(client):
    assert create_task(client, durum="  ")["durum"] == "Başlamadı"


def test_konu_blank_or_whitespace_rejected_on_update(client):
    t = create_task(client, konu="Asıl konu")
    for blank in ("", "   ", None):
        assert_rejected(client.patch(f"/api/tasks/{t['id']}", json={"konu": blank}))
    assert tasks(client)[0]["konu"] == "Asıl konu"


def test_update_without_konu_unaffected(client):
    t = create_task(client, konu="Asıl konu")
    r = client.patch(f"/api/tasks/{t['id']}", json={"kimde_bekliyor": "Banka"})
    assert r.status_code == 200 and r.get_json()["konu"] == "Asıl konu"


@pytest.mark.parametrize("value", [-1, 101, "150"])
def test_yuzde_out_of_range_rejected_not_clamped(client, value):
    t = create_task(client, yuzde=40)
    assert_rejected(client.patch(f"/api/tasks/{t['id']}", json={"yuzde": value}))
    assert_rejected(client.post("/api/tasks", json={"konu": "x", "yuzde": value}))
    assert [x["yuzde"] for x in tasks(client)] == [40]


@pytest.mark.parametrize("value", [0, 4, -2])
def test_oncelik_out_of_range_rejected(client, value):
    t = create_task(client, oncelik=2)
    assert_rejected(client.patch(f"/api/tasks/{t['id']}", json={"oncelik": value}))
    assert_rejected(client.post("/api/tasks", json={"konu": "x", "oncelik": value}))
    assert [x["oncelik"] for x in tasks(client)] == [2]


def test_boundaries_and_empty_accepted(client):
    for yuzde, oncelik in ((0, 1), (100, 3), ("", "")):
        t = create_task(client, yuzde=yuzde, oncelik=oncelik)
        expected = (None, None) if yuzde == "" else (yuzde, oncelik)
        assert (t["yuzde"], t["oncelik"]) == expected


def test_rejected_request_writes_no_history(client, clock):
    t = create_task(client, konu="A")
    clock.advance(hours=1)
    for body in ({"durum": "Bitti", "konu": "B"}, {"konu": " ", "aciklama": "x"}, {"yuzde": 500, "aciklama": "y"}):
        assert_rejected(client.patch(f"/api/tasks/{t['id']}", json=body))
    assert [i["alan"] for i in timeline(client, t["id"])] == ["_olusturma"]
    assert tasks(client)[0]["updated_at"] == t["updated_at"]
