"""CB-10 — tüm API hataları Türkçe {"error": …}; iz, yol, SQL sızmaz; beklenmeyenler loglanır."""
import logging

import pytest

from tests.integration.helpers import create_task

pytestmark = pytest.mark.integration

LEAKS = ("Traceback", "File \"", ".py", "SELECT", "sqlite", "\\", "C:", "werkzeug", "The ")


def assert_clean_error(r, status):
    assert r.status_code == status
    assert r.mimetype == "application/json"
    body = r.get_json()
    assert set(body) == {"error"} and body["error"].strip()
    assert not any(x in body["error"] for x in LEAKS), body


def test_404_turkish_json(client):
    r = client.patch("/api/tasks/999", json={"konu": "x"})
    assert_clean_error(r, 404)
    assert r.get_json() == {"error": "Kayıt bulunamadı"}
    assert_clean_error(client.get("/api/yok"), 404)


def test_405_turkish_json(client):
    assert_clean_error(client.put("/api/tasks"), 405)


def test_400_malformed_json_turkish(client):
    r = client.post("/api/tasks", data="{bozuk", content_type="application/json")
    assert_clean_error(r, 400)
    assert r.get_json() == {"error": "İstek gövdesi geçerli JSON değil"}
    t = create_task(client)
    assert_clean_error(client.patch(f"/api/tasks/{t['id']}", data="[1, 2]", content_type="application/json"), 400)
    assert_clean_error(client.post(f"/api/tasks/{t['id']}/comments", data="x", content_type="application/json"), 400)


def test_500_logged_generic_message(client, monkeypatch, caplog):
    from poltask.storage import tasks as task_store

    def boom(conn):
        raise RuntimeError("SELECT gizli FROM tasks — C:\\yol\\dosya.py")

    monkeypatch.setattr(task_store, "list_tasks", boom)
    with caplog.at_level(logging.ERROR):
        r = client.get("/api/tasks")
    assert_clean_error(r, 500)
    assert r.get_json() == {"error": "Beklenmeyen bir hata oluştu"}
    assert "SELECT gizli" in caplog.text


def test_error_bodies_leak_no_trace_path_sql(client):
    t = create_task(client)
    for r, status in (
        (client.post("/api/tasks", json={"konu": "x", "durum": "Yok"}), 400),
        (client.post("/api/tasks", json={"konu": "x", "yuzde": "abc"}), 400),
        (client.patch(f"/api/tasks/{t['id']}", json={"hedef_tarih": "2026/01/01"}), 400),
        (client.post("/api/import/excel", data={}, content_type="multipart/form-data"), 400),
        (client.delete("/api/snapshots/abc"), 404),
    ):
        assert_clean_error(r, status)
