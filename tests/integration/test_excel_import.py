"""PB-4 — Excel içe aktarımı (karakterizasyon)."""
import runpy
import sys

import pytest

from tests.integration.helpers import create_task, tasks, timeline, upload
from tests.support import FIXED_TS, build_main_workbook, workbook_digest

pytestmark = pytest.mark.integration


def test_br4_import_replaces_all_data(client, tmp_path):
    old = create_task(client, konu="Silinecek")
    client.post("/api/snapshots", json={"etiket": "eski"})
    upload(client, "/api/import/excel", build_main_workbook(tmp_path / "ana.xlsx"))
    # Yanıt gövdesi (sayılar) adım 6'da sabitlenir: eski kod Windows'ta geçici dosya kilidiyle 500 döner
    lst = tasks(client)
    assert [t["konu"] for t in lst] == ["Kart ile ödeme", "Aylık rapor\nikinci satır", "Bağımsız iş"]
    assert [t["sira"] for t in lst] == [1, 2, 3] and old["konu"] not in [t["konu"] for t in lst]
    first = lst[0]
    assert (first["yuzde"], first["kimde_bekliyor"], first["oncelik"], first["opm_talep_tarihi"]) == (
        50, "Linktera", 1, "2026-09-01")
    assert first["icerik_tarihce"] is None and first["yorum_sayisi"] == 1
    assert lst[1]["yuzde"] == 100 and lst[1]["oncelik"] == 2 and lst[2]["ltr_yorum"] is None
    yorum = [i for i in timeline(client, first["id"]) if i["tip"] == "yorum"][0]
    assert (yorum["metin"], yorum["ice_aktarim"], yorum["zaman"]) == ("23.09 görüşüldü", 1, FIXED_TS)
    assert "eski" not in [s["etiket"] for s in client.get("/api/snapshots").get_json()]


def test_history_sheet_becomes_snapshots(client, tmp_path):
    upload(client, "/api/import/excel", build_main_workbook(tmp_path / "ana.xlsx"))
    snaps = client.get("/api/snapshots").get_json()
    assert (snaps[0]["tarih"], snaps[0]["etiket"]) == ("2026-09-23 00:00:00", "23 Eylül itibariyle")
    assert snaps[0]["pivot"] == {"Ana Kapsam": {"Başlamadı": 2, "Tamamlandı": 5}, "Ek İstek": {"Tamamlandı": 1}}


def test_import_takes_ice_aktarim_snapshot(client, tmp_path):
    upload(client, "/api/import/excel", build_main_workbook(tmp_path / "ana.xlsx"))
    snaps = client.get("/api/snapshots").get_json()
    assert [(s["etiket"], s["tarih"]) for s in snaps] == [
        ("23 Eylül itibariyle", "2026-09-23 00:00:00"), ("İçe aktarım", FIXED_TS)]
    assert snaps[1]["pivot"] == {"(boş)": {"Başlamadı": 1}, "Ana Kapsam": {"Geliştirmede": 1},
                                 "Ek İstek": {"Tamamlandı": 1}}


def test_opm_sheet_in_main_workbook(client, tmp_path):
    upload(client, "/api/import/excel", build_main_workbook(tmp_path / "ana.xlsx"))
    meta = client.get("/api/meta").get_json()
    assert (meta["opm_sayisi"], meta["is_sayisi"]) == (2, 3)
    assert meta["son_ice_aktarim"] == meta["son_opm_aktarim"] == FIXED_TS
    opm = tasks(client)[0]["opm"]
    assert opm == {"kod": "LTR100", "konu": "OPM konu 1", "atanan": "Ali", "durum": "Kapatıldı",
                   "oncelik": "Yüksek", "tur": "Hata", "modul": "Ödeme", "raportor": "Veli",
                   "olusturma": "2026-10-01 09:30", "son_guncelleme": "2026-10-02 10:00"}


def test_export_import_export_roundtrip(client, tmp_path):
    upload(client, "/api/import/excel", build_main_workbook(tmp_path / "ana.xlsx"))
    t = create_task(client, konu="Elle", hedef_tarih="2026-12-31", yuzde=7)
    client.post(f"/api/tasks/{t['id']}/comments", json={"metin": "not"})
    first = client.get("/api/export").data
    (tmp_path / "ilk.xlsx").write_bytes(first)
    upload(client, "/api/import/excel", tmp_path / "ilk.xlsx")
    assert workbook_digest(client.get("/api/export").data) == workbook_digest(first)


def test_importer_cli(client, tmp_path, monkeypatch, capsys):
    path = build_main_workbook(tmp_path / "ana.xlsx")
    monkeypatch.setattr(sys, "argv", ["importer.py", str(path)])
    runpy.run_path("importer.py", run_name="__main__")
    assert "'isler': 3" in capsys.readouterr().out
    assert len(tasks(client)) == 3
