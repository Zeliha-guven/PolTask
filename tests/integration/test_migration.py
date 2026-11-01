"""CB-9 — şema sürümü ve yükseltme öncesi yedek (yalnızca geçici dizinlerde; gerçek data/ asla)."""
import runpy
import sqlite3
from pathlib import Path

import flask
import pytest

from poltask.storage import database
from tests.support import Clock

pytestmark = pytest.mark.integration

ROOT = Path(__file__).resolve().parents[2]


def legacy_db(path):
    """Spec 0001 öncesi bir veritabanı: aynı şema, veri var, user_version = 0."""
    conn = sqlite3.connect(path)
    conn.executescript(database.SCHEMA)
    conn.execute("INSERT INTO tasks(sira, konu, durum, created_at, updated_at) VALUES(1, 'A', 'Testte', 't', 't')")
    conn.execute("INSERT INTO comments(task_id, metin, zaman) VALUES(1, 'not', 't')")
    conn.execute("INSERT INTO task_history(task_id, alan, eski, yeni, zaman) VALUES(1, 'durum', 'x', 'y', 't')")
    conn.execute("INSERT INTO snapshots(tarih, etiket, pivot_json) VALUES('t', 'e', '{}')")
    conn.execute("INSERT INTO opm_tickets(kod, durum) VALUES('LTR1', 'Açık')")
    conn.execute("INSERT INTO meta VALUES('son_ice_aktarim', 't')")
    conn.commit()
    conn.close()
    return path


def dump(path):
    conn = sqlite3.connect(path)
    try:
        return list(conn.iterdump()), conn.execute("PRAGMA user_version").fetchone()[0]
    finally:
        conn.close()


def backups(d):
    return sorted(p.name for p in Path(d).glob("poltask-yedek-*.db"))


def test_existing_db_backed_up_before_upgrade(tmp_path):
    db = legacy_db(tmp_path / "poltask.db")
    before, _ = dump(db)
    backup = database.prepare_database(db, Clock())
    assert backup.name == "poltask-yedek-20261104-100000.db" and backup.parent == tmp_path
    assert dump(backup) == (before, 0)  # yedek = yükseltme öncesi hâli


def test_upgrade_preserves_counts_and_contents(tmp_path):
    db = legacy_db(tmp_path / "poltask.db")
    before, _ = dump(db)
    database.prepare_database(db, Clock())
    after, version = dump(db)
    assert after == before and version == database.SCHEMA_VERSION == 1


def test_second_start_no_backup_no_change(tmp_path):
    db = legacy_db(tmp_path / "poltask.db")
    clock = Clock()
    database.prepare_database(db, clock)
    state = dump(db)
    clock.advance(days=1)
    assert database.prepare_database(db, clock) is None
    assert dump(db) == state and backups(tmp_path) == ["poltask-yedek-20261104-100000.db"]


def test_backup_failure_aborts_with_turkish_message(tmp_path):
    db = legacy_db(tmp_path / "poltask.db")
    before = dump(db)
    not_a_dir = tmp_path / "dosya"
    not_a_dir.write_text("klasör değil")
    with pytest.raises(database.StartupError) as e:
        database.prepare_database(db, Clock(), backup_dir=not_a_dir)
    assert "yedeği alınamadı" in str(e.value) and "yükseltme yapılmadı" in str(e.value)
    assert dump(db) == before  # sürüm hâlâ 0, veri aynı


def test_new_db_gets_version_without_backup(tmp_path):
    db = tmp_path / "yeni" / "poltask.db"
    assert database.prepare_database(db, Clock()) is None
    rows, version = dump(db)
    assert version == 1 and backups(db.parent) == []
    assert any("CREATE TABLE" in r and "tasks" in r for r in rows)


def test_app_refuses_to_start_when_backup_fails(use_default_db, monkeypatch, capsys):
    def fail(path, clock, backup_dir=None):
        raise database.StartupError("Veritabanının yedeği alınamadı; yükseltme yapılmadı")

    calls = []
    monkeypatch.setattr(database, "prepare_database", fail)
    monkeypatch.setattr(flask.Flask, "run", lambda self, **kw: calls.append(kw))
    with pytest.raises(SystemExit) as e:
        runpy.run_path(str(ROOT / "app.py"), run_name="__main__")
    assert e.value.code == 1 and calls == []
    assert "PolTask başlatılamadı: Veritabanının yedeği alınamadı" in capsys.readouterr().err


def test_unreadable_db_is_startup_error(tmp_path):
    """L-6: veritabanı olmayan/bozuk dosya → Türkçe StartupError, dosyaya dokunulmaz."""
    junk = tmp_path / "poltask.db"
    junk.write_bytes(b"bu bir sqlite dosyasi degil" * 100)
    before = junk.read_bytes()
    with pytest.raises(database.StartupError) as e:
        database.prepare_database(junk, Clock())
    assert str(e.value).startswith("Veritabanı okunamadı")
    assert junk.read_bytes() == before and backups(tmp_path) == []


def test_app_exits_with_turkish_message_on_unreadable_db(use_default_db, monkeypatch, capsys):
    use_default_db.write_bytes(b"bozuk" * 1000)
    calls = []
    monkeypatch.setattr(flask.Flask, "run", lambda self, **kw: calls.append(kw))
    with pytest.raises(SystemExit) as e:
        runpy.run_path(str(ROOT / "app.py"), run_name="__main__")
    err = capsys.readouterr().err
    assert e.value.code == 1 and calls == []
    assert "PolTask başlatılamadı: Veritabanı okunamadı" in err and "Traceback" not in err
