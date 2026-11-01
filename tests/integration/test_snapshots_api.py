"""PB-1 — elle snapshot ve pivot (karakterizasyon)."""
import pytest

from tests.integration.helpers import create_task
from tests.support import FIXED_TS

pytestmark = pytest.mark.integration


def test_manual_snapshot_create_list_delete(client, clock):
    create_task(client, kapsam_tipi="Ek İstek")
    r1 = client.post("/api/snapshots", json={"etiket": "  Sprint sonu "})
    clock.advance(minutes=1)
    r2 = client.post("/api/snapshots")
    assert r1.status_code == r2.status_code == 201
    sid1, sid2 = r1.get_json()["id"], r2.get_json()["id"]
    snaps = client.get("/api/snapshots").get_json()
    assert [(s["id"], s["etiket"], s["tarih"]) for s in snaps] == [
        (sid1, "Sprint sonu", FIXED_TS), (sid2, "Elle alındı", "2026-11-04 10:01:00")]
    assert snaps[0]["pivot"] == {"Ek İstek": {"Başlamadı": 1}}
    assert client.delete(f"/api/snapshots/{sid1}").status_code == 204
    assert [s["id"] for s in client.get("/api/snapshots").get_json()] == [sid2]


def test_pivot_includes_bos(client):
    create_task(client)
    create_task(client, kapsam_tipi="Ek İstek", durum="Testte")
    create_task(client, kapsam_tipi="Ek İstek", durum="Testte")
    assert client.get("/api/pivot").get_json() == {"(boş)": {"Başlamadı": 1}, "Ek İstek": {"Testte": 2}}


def _dump(db_path):
    import sqlite3

    conn = sqlite3.connect(db_path)
    try:
        return list(conn.iterdump())
    finally:
        conn.close()


def test_get_requests_do_not_write(client, clock, db_path):
    """CB-5: yeni bir ISO haftasında bile hiçbir GET veri yazmaz."""
    t = create_task(client, kapsam_tipi="Ek İstek")
    client.post(f"/api/tasks/{t['id']}/comments", json={"metin": "not"})
    client.post("/api/snapshots", json={"etiket": "eski hafta"})
    clock.advance(days=14)
    before = _dump(db_path)
    for url in ("/", "/eski", "/api/meta", "/api/tasks", f"/api/tasks/{t['id']}/timeline", "/api/snapshots",
                "/api/pivot", "/api/export", "/static/app.js"):
        r = client.get(url)
        assert r.status_code == 200, url
        r.close()
    assert _dump(db_path) == before
    assert len(client.get("/api/snapshots").get_json()) == 1


def test_br6_weekly_snapshot_once_per_iso_week(client, clock):
    """CB-6: iş varsa ve bu ISO haftasında snapshot yoksa tek bir 'Haftalık otomatik' alınır."""
    create_task(client, kapsam_tipi="Ek İstek")
    r = client.post("/api/snapshots/haftalik")
    assert r.status_code == 201 and r.get_json()["alindi"] is True
    sid = r.get_json()["id"]
    clock.advance(days=3)  # Cumartesi, aynı hafta (W45)
    r = client.post("/api/snapshots/haftalik")
    assert r.status_code == 200 and r.get_json() == {"alindi": False, "id": None}
    snaps = client.get("/api/snapshots").get_json()
    assert [(s["id"], s["etiket"], s["tarih"]) for s in snaps] == [(sid, "Haftalık otomatik", FIXED_TS)]
    assert snaps[0]["pivot"] == {"Ek İstek": {"Başlamadı": 1}}
    clock.advance(days=2)  # Pazartesi, W46
    assert client.post("/api/snapshots/haftalik").status_code == 201
    assert len(client.get("/api/snapshots").get_json()) == 2


def test_br6_existing_snapshot_this_week_counts(client):
    create_task(client)
    client.post("/api/snapshots", json={"etiket": "elle"})
    assert client.post("/api/snapshots/haftalik").status_code == 200
    assert len(client.get("/api/snapshots").get_json()) == 1


def test_br6_no_snapshot_without_tasks(client):
    r = client.post("/api/snapshots/haftalik")
    assert r.status_code == 200 and r.get_json() == {"alindi": False, "id": None}
    assert client.get("/api/snapshots").get_json() == []


def test_br6_future_dated_snapshot_does_not_break_weekly_rule(client, db_path):
    """M-2: gelecek tarihli (2027-12-23) bir snapshot varken: ilk POST bu hafta için alır, ikincisi 200 ve yazmaz."""
    import sqlite3

    create_task(client)
    conn = sqlite3.connect(db_path)
    conn.execute("INSERT INTO snapshots(tarih, etiket, pivot_json) VALUES('2027-12-23 00:00:00', 'gelecek', '{}')")
    conn.commit()
    conn.close()
    assert client.post("/api/snapshots/haftalik").status_code == 201
    before = _dump(db_path)
    r = client.post("/api/snapshots/haftalik")
    assert r.status_code == 200 and r.get_json() == {"alindi": False, "id": None}
    assert _dump(db_path) == before
