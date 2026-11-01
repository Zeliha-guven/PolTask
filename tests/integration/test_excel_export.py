"""PB-3 — Excel dışa aktarımı (karakterizasyon). Golden özet adım 1'de eski dışa aktarıcıdan üretildi."""
import json
import os
from pathlib import Path
from urllib.parse import quote

import pytest

from tests.integration.helpers import create_task, upload
from tests.support import HEADERS, build_main_workbook, workbook_digest

pytestmark = pytest.mark.integration

GOLDEN = Path(__file__).parent / "golden" / "export_digest.json"


def seed(client, tmp_path, clock):
    upload(client, "/api/import/excel", build_main_workbook(tmp_path / "ana.xlsx"))
    clock.advance(days=1)
    t = create_task(client, konu="Yeni iş", kapsam_tipi="Bug fix", yuzde=30, hedef_tarih="2026-12-31",
                    sozlesme="Dahil", durum="Testte")
    client.post(f"/api/tasks/{t['id']}/comments", json={"metin": "elle not"})


def test_sheet_names_headers_order(client, tmp_path, clock):
    seed(client, tmp_path, clock)
    digest = workbook_digest(client.get("/api/export").data)
    assert [s["sheet"] for s in digest] == ["Güncel Durum", "Linktera_Tüm_İşler"]
    row1 = [c[1] for c in digest[1]["cells"] if c[0].endswith("1") and c[0][:-1].isalpha()]
    assert row1 == HEADERS


def test_cells_and_formats_match_golden(client, tmp_path, clock):
    seed(client, tmp_path, clock)
    digest = workbook_digest(client.get("/api/export").data)
    if os.environ.get("POLTASK_WRITE_GOLDEN"):
        GOLDEN.write_text(json.dumps(digest, ensure_ascii=False, indent=1), encoding="utf-8")
    assert digest == json.loads(GOLDEN.read_text(encoding="utf-8"))


def test_filename_pattern(client, clock):
    r = client.get("/api/export")
    assert r.status_code == 200
    assert r.mimetype == "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet"
    name = "Linktera AltYapı Mevcut Fonksiyon Özet Listesi_20261104.xlsx"
    assert quote(name) in r.headers["Content-Disposition"]
    assert "attachment" in r.headers["Content-Disposition"]
