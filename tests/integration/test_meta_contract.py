"""L-3 / A-8 — backend /api/meta ile web fixture'ı aynı sözleşme dosyasına bağlı.

`web/src/test/meta.contract.json` backend'den üretilir; yeniden üretmek için:
    POLTASK_WRITE_CONTRACT=1 python -m pytest -q tests/integration/test_meta_contract.py
Web testleri bu dosyayı içe aktarır; iki taraf ayrışırsa bu test kırmızıdır.
"""
import json
import os
from pathlib import Path

import pytest

pytestmark = pytest.mark.integration

CONTRACT = Path(__file__).resolve().parents[2] / "web" / "src" / "test" / "meta.contract.json"


def test_meta_matches_web_contract(client):
    meta = client.get("/api/meta").get_json()  # boş veritabanı: sayılar 0, son aktarımlar null
    if os.environ.get("POLTASK_WRITE_CONTRACT"):
        text = json.dumps(meta, ensure_ascii=False, indent=2, sort_keys=True) + "\n"
        CONTRACT.write_bytes(text.encode("utf-8"))
    assert meta == json.loads(CONTRACT.read_text(encoding="utf-8"))
