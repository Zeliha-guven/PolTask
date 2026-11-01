"""CB-7 — eski arayüz, Karşılaştırma'nın snapshot listesini yüklediği her an önce haftalık snapshot ister.
Tarayıcıdaki ağ isteği gözlemi VERIFY'da ayrıca alınır (JS test altyapısı spec 0002 ile gelir)."""
import re
from pathlib import Path

import pytest

pytestmark = pytest.mark.integration

APP_JS = Path(__file__).resolve().parents[2] / "static" / "app.js"


def test_karsilastirma_posts_weekly_before_listing():
    src = APP_JS.read_text(encoding="utf-8")
    body = src[src.index("async function renderKarsilastirma"):]
    body = body[: body.index("\nasync function ", 1) if "\nasync function " in body[1:] else len(body)]
    post = body.index('api("POST", "/api/snapshots/haftalik")')
    get = body.index('api("GET", "/api/snapshots")')
    assert post < get
    # ikisi de aynı "liste henüz yüklenmedi" koşulunun içinde
    block = re.search(r"if \(!state\.snapshots\) \{(.*?)\}", body, re.S)
    assert block and "/api/snapshots/haftalik" in block.group(1) and '"/api/snapshots")' in block.group(1)
    assert src.count("/api/snapshots/haftalik") == 1
