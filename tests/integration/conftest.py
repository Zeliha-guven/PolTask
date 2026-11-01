"""Entegrasyon fixture'ları: test başına geçici SQLite + sabit saat. Gerçek data/ hiç kullanılmaz."""
import pytest

from tests.support import Clock


@pytest.fixture
def clock():
    return Clock()


@pytest.fixture
def db_path(tmp_path):
    return tmp_path / "poltask.db"


@pytest.fixture
def upload_dir(tmp_path):
    d = tmp_path / "uploads"
    d.mkdir()
    return d


@pytest.fixture
def use_default_db(monkeypatch, db_path):
    """Giriş noktaları (app.py, importer.py) varsayılan veritabanı yolunu bu testin dosyasına çevirir."""
    from poltask.storage import database

    monkeypatch.setattr(database, "DEFAULT_DB_PATH", db_path)
    return db_path


@pytest.fixture
def web_dist(tmp_path):
    """Derlenmiş yeni arayüzün yerine geçen küçük bir dist (testler gerçek web/dist'e bağlı değildir)."""
    d = tmp_path / "dist"
    (d / "assets").mkdir(parents=True)
    (d / "index.html").write_text("<!doctype html><title>PolTask yeni</title>", encoding="utf-8")
    return d


@pytest.fixture
def app(use_default_db, clock, upload_dir, web_dist):
    from poltask.api import create_app

    return create_app(use_default_db, clock=clock, upload_dir=upload_dir, web_dist=web_dist)


@pytest.fixture
def client(app):
    return app.test_client()
