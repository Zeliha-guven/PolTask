"""PB-1, PB-2 — iş uç noktalarının bugünkü davranışı (karakterizasyon)."""
import pytest

from tests.integration.helpers import create_task, tasks, timeline, upload
from tests.support import FIXED_TS, build_opm_workbook

pytestmark = pytest.mark.integration


def test_create_next_sira_201(client):
    a = create_task(client, konu="Birinci")
    b = create_task(client, konu="İkinci", kapsam_tipi="Ek İstek", yuzde="40", hedef_tarih="2026-12-01")
    assert (a["sira"], b["sira"]) == (1, 2)
    assert b["konu"] == "İkinci" and b["yuzde"] == 40 and b["hedef_tarih"] == "2026-12-01"
    assert b["created_at"] == b["updated_at"] == FIXED_TS
    assert b["opm"] is None and b["icerik_tarihce"] is None


def test_create_defaults_durum_baslamadi(client):
    assert create_task(client)["durum"] == "Başlamadı"
    assert create_task(client, durum="")["durum"] == "Başlamadı"


def test_list_order_opm_match_comment_count(client, tmp_path):
    upload(client, "/api/import/opm", build_opm_workbook(tmp_path / "opm.xlsx"))
    a = create_task(client, konu="A", opm_no="#ltr 100")
    b = create_task(client, konu="B")
    client.post(f"/api/tasks/{a['id']}/comments", json={"metin": "not"})
    client.post(f"/api/tasks/{a['id']}/comments", json={"metin": "not 2"})
    lst = tasks(client)
    assert [t["konu"] for t in lst] == ["A", "B"]
    assert lst[0]["opm"]["kod"] == "LTR100" and lst[0]["opm"]["durum"] == "Kapatıldı"
    assert lst[0]["yorum_sayisi"] == 2 and lst[1]["yorum_sayisi"] == 0 and lst[1]["opm"] is None
    assert b["id"] == lst[1]["id"]


def test_update_fields(client, clock):
    t = create_task(client, konu="Eski")
    clock.advance(minutes=5)
    r = client.patch(f"/api/tasks/{t['id']}", json={"konu": " Yeni ", "yuzde": "55", "oncelik": 2,
                                                    "bitis_tarihi": "2026-11-04", "bilinmeyen": "x"})
    assert r.status_code == 200
    u = r.get_json()
    assert (u["konu"], u["yuzde"], u["oncelik"], u["bitis_tarihi"]) == ("Yeni", 55, 2, "2026-11-04")
    assert u["updated_at"] == "2026-11-04 10:05:00" and u["created_at"] == FIXED_TS


def test_update_missing_task_404(client):
    assert client.patch("/api/tasks/999", json={"konu": "x"}).status_code == 404


def test_delete_with_comments_and_history(client):
    t = create_task(client)
    client.post(f"/api/tasks/{t['id']}/comments", json={"metin": "not"})
    assert client.delete(f"/api/tasks/{t['id']}").status_code == 204
    assert tasks(client) == []
    assert timeline(client, t["id"]) == []


def test_delete_missing_204(client):
    assert client.delete("/api/tasks/999").status_code == 204


def test_timeline_newest_first(client, clock):
    t = create_task(client)
    clock.advance(minutes=1)
    client.post(f"/api/tasks/{t['id']}/comments", json={"metin": "  ilk not  "})
    clock.advance(minutes=1)
    client.patch(f"/api/tasks/{t['id']}", json={"durum": "Beklemede"})
    items = timeline(client, t["id"])
    assert [(i["tip"], i["zaman"]) for i in items] == [
        ("degisiklik", "2026-11-04 10:02:00"), ("yorum", "2026-11-04 10:01:00"), ("degisiklik", FIXED_TS)]
    assert items[1]["metin"] == "ilk not" and items[1]["ice_aktarim"] == 0
    assert set(items[0]) == {"tip", "id", "alan", "eski", "yeni", "zaman"}


def test_add_delete_comment(client):
    t = create_task(client)
    r = client.post(f"/api/tasks/{t['id']}/comments", json={"metin": "not"})
    assert r.status_code == 201 and r.data == b""
    cid = [i for i in timeline(client, t["id"]) if i["tip"] == "yorum"][0]["id"]
    assert client.delete(f"/api/comments/{cid}").status_code == 204
    assert [i for i in timeline(client, t["id"]) if i["tip"] == "yorum"] == []


def test_comment_on_missing_task_is_accepted(client):
    # G-7: bugünkü davranış korunur
    assert client.post("/api/tasks/999/comments", json={"metin": "x"}).status_code == 201


def test_empty_comment_400(client):
    t = create_task(client)
    r = client.post(f"/api/tasks/{t['id']}/comments", json={"metin": "   "})
    assert r.status_code == 400 and r.get_json() == {"error": "Yorum boş olamaz"}


def test_create_without_konu_400(client):
    r = client.post("/api/tasks", json={"konu": "  "})
    assert r.status_code == 400 and r.get_json() == {"error": "KONU zorunlu"}


def test_invalid_date_400(client):
    r = client.post("/api/tasks", json={"konu": "x", "hedef_tarih": "01.12.2026"})
    assert r.status_code == 400 and r.get_json() == {"error": "hedef_tarih: tarih YYYY-AA-GG olmalı"}
    t = create_task(client)
    r = client.patch(f"/api/tasks/{t['id']}", json={"yuzde": "çok"})
    assert r.status_code == 400 and r.get_json() == {"error": "yuzde: sayı olmalı"}


def test_history_field_old_new_time(client, clock):
    t = create_task(client, kimde_bekliyor="Linktera")
    clock.advance(hours=1)
    client.patch(f"/api/tasks/{t['id']}", json={"durum": "Beklemede", "kimde_bekliyor": "", "yuzde": 10})
    changes = {i["alan"]: (i["eski"], i["yeni"], i["zaman"]) for i in timeline(client, t["id"])}
    assert changes["durum"] == ("Başlamadı", "Beklemede", "2026-11-04 11:00:00")
    assert changes["kimde_bekliyor"] == ("Linktera", None, "2026-11-04 11:00:00")
    assert changes["yuzde"] == (None, "10", "2026-11-04 11:00:00")


def test_create_writes_olusturma(client):
    t = create_task(client)
    assert [(i["alan"], i["eski"], i["yeni"]) for i in timeline(client, t["id"])] == [("_olusturma", None, None)]


def test_unchanged_field_no_history(client):
    t = create_task(client, konu="Aynı", yuzde=5)
    r = client.patch(f"/api/tasks/{t['id']}", json={"konu": "Aynı", "yuzde": "5", "icerik_tarihce": "yok sayılır"})
    assert r.status_code == 200 and r.get_json()["updated_at"] == FIXED_TS
    assert len(timeline(client, t["id"])) == 1
