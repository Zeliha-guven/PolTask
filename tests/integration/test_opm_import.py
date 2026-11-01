"""PB-4 — OPM içe aktarımı (karakterizasyon)."""
import pytest

from tests.integration.helpers import create_task, upload
from tests.support import build_opm_workbook

pytestmark = pytest.mark.integration


def test_opm_import_replaces_and_counts_matches(client, tmp_path, clock):
    create_task(client, opm_no="LTR100")
    create_task(client, opm_no="ltr 300 açıklama")
    create_task(client, opm_no="LTR999")
    path = build_opm_workbook(tmp_path / "opm.xlsx")
    upload(client, "/api/import/opm", path)
    clock.advance(hours=1)
    upload(client, "/api/import/opm", path)
    # Yanıt gövdesi ({"opm", "eslesen"}) adım 6'da sabitlenir (eski kod Windows'ta dosya kilidiyle 500 döner)
    meta = client.get("/api/meta").get_json()
    assert meta["opm_sayisi"] == 2 and meta["son_opm_aktarim"] == "2026-11-04 11:00:00"
    assert meta["son_ice_aktarim"] is None
    by_opm = {t["opm_no"]: t["opm"] for t in client.get("/api/tasks").get_json()}
    assert by_opm["LTR100"]["kod"] == "LTR100" and by_opm["ltr 300 açıklama"]["kod"] == "LTR300"
    assert by_opm["LTR999"] is None


def test_upload_requires_xlsx(client, tmp_path):
    (tmp_path / "x.csv").write_text("a,b")
    r = upload(client, "/api/import/opm", tmp_path / "x.csv", name="x.csv")
    assert r.status_code == 400 and r.get_json() == {"error": "Lütfen .xlsx dosyası seçin"}
