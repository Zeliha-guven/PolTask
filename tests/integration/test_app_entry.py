"""PB-5 — tek komutla açılış ve arayüz sunumu. A-9 (spec 0002 AC-8): eski arayüz bilinçli olarak `/`'dan `/eski`'ye
taşındı; `/` artık derlenmiş yeni arayüzü sunar."""
import runpy
from pathlib import Path

import flask
import pytest

pytestmark = pytest.mark.integration

ROOT = Path(__file__).resolve().parents[2]


def test_eski_serves_legacy_ui(client):
    r = client.get("/eski")
    assert r.status_code == 200 and b"<title>PolTask</title>" in r.data and b"/static/app.js" in r.data
    r.close()


def test_root_serves_built_web_ui(client):
    r = client.get("/")
    assert r.status_code == 200 and b"PolTask yeni" in r.data and b"/static/app.js" not in r.data
    r.close()


def test_static_assets_served(client):
    for name in ("app.js", "style.css"):
        r = client.get(f"/static/{name}")
        assert r.status_code == 200 and r.data == (ROOT / "static" / name).read_bytes()
        r.close()


def test_main_binds_127_0_0_1_5000(use_default_db, monkeypatch):
    calls = []
    monkeypatch.setattr(flask.Flask, "run", lambda self, **kw: calls.append(kw))
    runpy.run_path(str(ROOT / "app.py"), run_name="__main__")
    assert len(calls) == 1
    assert (calls[0]["host"], calls[0]["port"]) == ("127.0.0.1", 5000)
    assert use_default_db.exists()


def test_baslat_bat_runs_python_app_py():
    bat = (ROOT / "baslat.bat").read_text(encoding="utf-8")
    assert "python app.py" in bat and "localhost:5000" in bat


def test_web_dist_serving_and_redirects(tmp_path, clock):
    """A-9: web/dist yoksa / Türkçe 404 (derleme komutuyla); varsa / ve /assets/* sunulur; /yeni → 302 /;
    eski arayüz her durumda /eski'de."""
    from poltask.api import create_app

    dist = tmp_path / "dist"
    app = create_app(tmp_path / "y.db", clock=clock, web_dist=dist)
    c = app.test_client()
    r = c.get("/")
    assert r.status_code == 404
    assert r.get_json() == {"error": "Arayüz derlenmemiş: cd web && npm ci && npm run build"}
    r = c.get("/eski")
    assert r.status_code == 200 and b"/static/app.js" in r.data
    r.close()
    (dist / "assets").mkdir(parents=True)
    (dist / "index.html").write_text("<!doctype html><title>PolTask yeni</title>", encoding="utf-8")
    (dist / "assets" / "index-abc.js").write_text("console.log(1)", encoding="utf-8")
    r = c.get("/")
    assert r.status_code == 200 and b"PolTask yeni" in r.data
    r.close()
    r = c.get("/yeni")
    assert r.status_code == 302 and r.headers["Location"].endswith("/")
    r = c.get("/assets/index-abc.js")
    assert r.status_code == 200 and r.data == b"console.log(1)"
    r.close()
    assert c.get("/assets/yok.js").status_code == 404
