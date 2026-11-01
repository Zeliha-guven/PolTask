"""storage ve integrations — kalıcılık ve dosya okuma (doğrudan, HTTP'siz)."""
import os

import pytest

from poltask.integrations.errors import ImportFormatError
from poltask.integrations.excel_import import read_excel_file
from poltask.integrations.opm_import import read_opm_file
from poltask.storage import database, snapshots
from poltask.storage import tasks as task_store
from tests.support import build_main_workbook, build_opm_workbook

pytestmark = pytest.mark.integration


@pytest.fixture
def db(tmp_path):
    path = tmp_path / "t.db"
    database.init_schema(path)
    return path


def test_create_update_writes_history(db):
    with database.connect(db) as conn:
        tid = task_store.create_task(conn, {"konu": "A", "durum": "Başlamadı"}, "2026-11-04 10:00:00")
    with database.connect(db) as conn:
        row = task_store.get_task(conn, tid)
        changes = task_store.update_task(conn, row, {"konu": "A", "durum": "Testte"}, "2026-11-04 11:00:00")
    assert changes == {"durum": "Testte"}
    with database.connect(db) as conn:
        hist = [(i["alan"], i["eski"], i["yeni"]) for i in task_store.timeline(conn, tid)]
        assert hist == [("durum", "Başlamadı", "Testte"), ("_olusturma", None, None)]


def test_connect_rolls_back_on_error(db):
    with pytest.raises(RuntimeError), database.connect(db) as conn:
        task_store.create_task(conn, {"konu": "A"}, "t")
        raise RuntimeError
    with database.connect(db) as conn:
        assert task_store.count_tasks(conn) == 0


def test_read_excel_file_parses_and_releases_file(tmp_path):
    path = build_main_workbook(tmp_path / "ana.xlsx")
    parsed = read_excel_file(path, 2026)
    os.remove(path)  # Windows: çalışma kitabı kapatılmamışsa PermissionError
    assert [rec["konu"] for rec, _ in parsed.tasks] == ["Kart ile ödeme", "Aylık rapor\nikinci satır", "Bağımsız iş"]
    assert parsed.tasks[0][1] == "23.09 görüşüldü" and parsed.tasks[0][0]["icerik_tarihce"] is None
    assert parsed.history == [("2026-09-23 00:00:00", "23 Eylül itibariyle",
                               {"Ana Kapsam": {"Başlamadı": 2, "Tamamlandı": 5}, "Ek İstek": {"Tamamlandı": 1}})]
    assert [r["kod"] for r in parsed.opm] == ["LTR100", "LTR300"]


def test_read_opm_file_releases_file_on_error(tmp_path):
    path = build_main_workbook(tmp_path / "ana.xlsx", opm=False)
    with pytest.raises(ImportFormatError):
        read_opm_file(path)
    os.remove(path)
    path = build_opm_workbook(tmp_path / "opm.xlsx")
    assert len(read_opm_file(path)) == 2
    os.remove(path)


def test_replace_all_and_snapshot(db):
    with database.connect(db) as conn:
        task_store.create_task(conn, {"konu": "eski"}, "t0")
        items = [({**{k: None for k in task_store.FIELD_KEYS}, "konu": "yeni", "kapsam_tipi": "Ek İstek"}, "not")]
        assert task_store.replace_all(conn, items, "t1") == 1
        snapshots.take_snapshot(conn, "İçe aktarım", "t1")
        assert [r["konu"] for r in task_store.list_tasks(conn)] == ["yeni"]
        assert task_store.comment_counts(conn) == {1: 1}
        assert snapshots.list_snapshots(conn)[0]["pivot"] == {"Ek İstek": {"(boş)": 1}}


def test_real_db_refused_under_pytest(tmp_path):
    """A-5: gerçek data/poltask.db pytest altında açılamaz — sızıntı sessizce yazmak yerine patlar."""
    from poltask.api import create_app

    real = database.REAL_DB_PATH
    before = real.stat().st_mtime_ns if real.exists() else None
    with pytest.raises(database.RealDataGuardError), database.connect(real):
        pass
    with pytest.raises(database.RealDataGuardError):
        database.init_schema(real)
    with pytest.raises(database.RealDataGuardError):
        create_app(real)
    assert (real.stat().st_mtime_ns if real.exists() else None) == before
    with database.connect(tmp_path / "baska.db") as conn:  # diğer yollar etkilenmez
        conn.execute("SELECT 1")
