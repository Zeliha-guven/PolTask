"""CB-4 — 20 MiB sınırı ve geçici dosya temizliği; PB-4 yanıt gövdeleri (adım 1'den ertelenen, Windows kilidi)."""
import io

import pytest
from openpyxl import Workbook

from tests.integration.helpers import create_task, tasks, upload
from tests.support import build_main_workbook, build_opm_workbook

pytestmark = pytest.mark.integration

LIMIT = 20 * 1024 * 1024  # 20 971 520 bayt


def dump(db_path):
    import sqlite3

    conn = sqlite3.connect(db_path)
    try:
        return list(conn.iterdump())
    finally:
        conn.close()


@pytest.mark.parametrize("url", ["/api/import/excel", "/api/import/opm"])
def test_upload_over_20mib_returns_413_and_changes_nothing(client, db_path, upload_dir, url):
    create_task(client)
    before = dump(db_path)
    big = io.BytesIO(b"\0" * (LIMIT + 1))
    r = client.post(url, data={"file": (big, "buyuk.xlsx")}, content_type="multipart/form-data")
    assert r.status_code == 413
    assert r.get_json() == {"error": "Dosya çok büyük (en fazla 20 MB)"}
    assert dump(db_path) == before and list(upload_dir.iterdir()) == []


def test_upload_just_under_limit_is_not_413(client, tmp_path):
    path = build_opm_workbook(tmp_path / "opm.xlsx")
    data = path.read_bytes()
    r = client.post("/api/import/opm", data={"file": (io.BytesIO(data), "opm.xlsx")},
                    content_type="multipart/form-data")
    assert r.status_code == 200


def test_temp_file_removed_after_success(client, tmp_path, upload_dir):
    r = upload(client, "/api/import/excel", build_main_workbook(tmp_path / "ana.xlsx"))
    assert r.status_code == 200
    r = upload(client, "/api/import/opm", build_opm_workbook(tmp_path / "opm.xlsx"))
    assert r.status_code == 200
    assert list(upload_dir.iterdir()) == []


def test_temp_file_removed_after_failure(client, tmp_path, upload_dir):
    wb = Workbook()
    wb.save(tmp_path / "bos.xlsx")
    (tmp_path / "bozuk.xlsx").write_bytes(b"zip degil")
    for url in ("/api/import/excel", "/api/import/opm"):
        for name in ("bos.xlsx", "bozuk.xlsx"):
            r = upload(client, url, tmp_path / name)
            assert r.status_code == 400 and set(r.get_json()) == {"error"}
    assert list(upload_dir.iterdir()) == []


def test_import_response_counts(client, tmp_path):
    r = upload(client, "/api/import/excel", build_main_workbook(tmp_path / "ana.xlsx"))
    assert r.status_code == 200 and r.get_json() == {"isler": 3, "gecmis_ozet": 1, "opm": 2}
    r = upload(client, "/api/import/excel", build_main_workbook(tmp_path / "yalin.xlsx", history=False, opm=False))
    assert r.get_json() == {"isler": 3, "gecmis_ozet": 0, "opm": None}


def test_import_without_main_sheet_400_keeps_data(client, tmp_path):
    create_task(client, konu="Kalmalı")
    wb = Workbook()
    wb.active.title = "Başka"
    wb.save(tmp_path / "bos.xlsx")
    r = upload(client, "/api/import/excel", tmp_path / "bos.xlsx")
    assert r.status_code == 400 and r.get_json() == {
        "error": "İçe aktarılamadı: 'Linktera_Tüm_İşler' sayfası bulunamadı"}
    assert [t["konu"] for t in tasks(client)] == ["Kalmalı"]


def test_opm_import_response_counts(client, tmp_path):
    create_task(client, opm_no="LTR100")
    create_task(client, opm_no="ltr 300 açıklama")
    create_task(client, opm_no="LTR999")
    r = upload(client, "/api/import/opm", build_opm_workbook(tmp_path / "opm.xlsx"))
    assert r.status_code == 200 and r.get_json() == {"opm": 2, "eslesen": 2}


def test_opm_import_without_opm_sheet_400(client, tmp_path):
    wb = Workbook()
    wb.save(tmp_path / "bos.xlsx")
    r = upload(client, "/api/import/opm", tmp_path / "bos.xlsx")
    assert r.status_code == 400
    assert r.get_json() == {"error": "Excel'de 'Kod', 'Durum', 'Konu' başlıklarını içeren bir OPM sayfası bulunamadı"}


def corrupt_styles_xlsx(path, tmp_path):
    """Geçerli zip, bozuk xl/styles.xml — openpyxl'in ValueError/ParseError mesajı dosya yolunu içerir."""
    import zipfile

    good = build_main_workbook(tmp_path / "iyi.xlsx")
    with zipfile.ZipFile(good) as src, zipfile.ZipFile(path, "w") as dst:
        for item in src.infolist():
            data = src.read(item.filename)
            if item.filename == "xl/styles.xml":
                data = b"<styleSheet><bozuk"
            dst.writestr(item, data)
    return path


@pytest.mark.parametrize("url", ["/api/import/excel", "/api/import/opm"])
def test_unreadable_file_generic_turkish_400_no_leak(client, tmp_path, upload_dir, url, caplog):
    """M-1 / I-2: kütüphane hataları genel Türkçe 400; yol, iz, İngilizce metin sızmaz; geçici dizin boş."""
    from tests.integration.test_errors_api import assert_clean_error

    files = [corrupt_styles_xlsx(tmp_path / "bozuk-stil.xlsx", tmp_path), tmp_path / "zip-degil.xlsx"]
    files[1].write_bytes(b"bu bir zip degil")
    for path in files:
        r = upload(client, url, path)
        assert_clean_error(r, 400)
        assert r.get_json() == {"error": "Dosya okunamadı; geçerli bir .xlsx değil"}
        assert str(tmp_path) not in r.get_data(as_text=True) and "tmp" not in r.get_json()["error"]
    assert list(upload_dir.iterdir()) == []
    assert "okunamadı" in caplog.text  # ayrıntı sunucu logunda
