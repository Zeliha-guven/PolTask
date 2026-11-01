"""Tüm testler için güvenlik ağı (A-5, review I-1). Hiçbir test data/ altındaki gerçek veriye ulaşamaz
(docs/testing.md, Resource hygiene 5):
- her testte varsayılan veritabanı yolu geçici bir dosyaya çevrilir;
- storage, pytest altında gerçek data/poltask.db'yi açmayı reddeder (database.guard_real_data);
- oturum başında ve sonunda data/ klasörünün parmak izi (bayt düzeyinde) alınır; değişmişse oturum başarısız olur.
"""
import pytest

from tests.support import data_dir_fingerprint


@pytest.fixture(autouse=True)
def _never_touch_real_data(monkeypatch, tmp_path):
    from poltask.storage import database

    monkeypatch.setattr(database, "DEFAULT_DB_PATH", tmp_path / "varsayilan-koruma.db")


@pytest.fixture(scope="session", autouse=True)
def _real_data_unchanged():
    from poltask.storage import database

    data_dir = database.REAL_DB_PATH.parent
    before = data_dir_fingerprint(data_dir)
    yield
    after = data_dir_fingerprint(data_dir)
    if after != before:
        pytest.fail(f"Test oturumu gerçek veri klasörünü değiştirdi: {data_dir}", pytrace=False)
