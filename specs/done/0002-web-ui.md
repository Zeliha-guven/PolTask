# Spec 0002 — web-ui (React + TypeScript + Mantine arayüzü)

- Status: Shipped
- Mode: lite (AGENTS.md, 2026-11-01'de strict → lite)
- Plan: `specs/plans/0002-plan.md`
- Self-critique: done (orkestratör, 2026-11-01; yetki devri — aşağıya bkz.)
- Source: Zeliha Güven, 2026-11-01 — "çok uzun, bazı adımları atlayıp koda geçelim" + "devam et ve bana soru sorma"
- Approval: Zeliha Güven — yetki devri ("devam et ve bana soru sorma", 2026-11-01); netleştirme kararları S1…S6 (spec 0001 ANALYZE) bu spec için de geçerli
- Design: — (tasarım bağlantısı yok; yön "User experience" bölümünde yazılı, S5-a)

## Intent
Spec 0001'in S1 yol haritasındaki 0002–0007 ekran spec'leri, kullanıcının hız talebiyle **tek spec'te** birleştirildi.
Bugünkü vanilla JS arayüzünün tüm ekranları ve eylemleri, ADR 0001'deki React + TypeScript + Vite + Mantine
yığınıyla yeniden yazılır. Davranış aynı kalır, görünüm ve bakım kolaylığı iyileşir. Eski arayüz, bu spec
ship edilene kadar varsayılan kalır (S2-a). Ship anında `/` yeni arayüze geçer ve eski arayüz kaldırılır.

## Requirements
- Kaynak kod `web/` altında: `web/src/api` (tek HTTP katmanı, yalnız burası `fetch` çağırır) · `web/src/features/<ekran>` · `web/src/components`.
- Alan listesi, Durum/Kapsam Tipi/Sözleşme değerleri **frontend'de tanımlanmaz**; `GET /api/meta`'dan gelir (aşağıdaki sözleşme).
- Derleme çıktısı `web/dist`; Flask onu sunar. Geliştirmede Vite dev sunucusu `/api`'yi `127.0.0.1:5000`'e proxy'ler.
- Bağımlılıklar sabit sürümle, `web/package-lock.json` commit edilir; CDN yok, Chart.js yerine Mantine charts (recharts) paketlenir.

### `/api/meta` sözleşmesi (spec 0001 CB-8 ile ortak)
```json
{
  "son_ice_aktarim": "...", "son_opm_aktarim": "...", "opm_sayisi": 314, "is_sayisi": 543,
  "alanlar": [{"anahtar": "ana_baslik", "baslik": "ANA BAŞLIK", "etiket": "Ana Başlık", "tip": "text"}],
  "durumlar": ["Başlamadı", "Beklemede", "Geliştirmede", "Testte", "Tamamlandı", "İptal"],
  "kapsam_tipleri": ["Ana Kapsam", "Bug fix", "Ek İstek", "Kapsam İçi Değişiklik"],
  "sozlesme_degerleri": ["Dahil", "Dahil değil"]
}
```
`tip` ∈ text · textarea · int · date. Haftalık snapshot isteği (CB-6): `POST /api/snapshots/haftalik` → 201 (alındı) veya 200 (bu hafta zaten var / iş yok).

## User experience
- Kimlik: teal ana renk `#0f766e`, sol menü (Özet · Liste · Pano · Karşılaştırma · İçe/Dışa Aktar), ekran adları aynı.
- Yoğunluk: liste ve pivotta kompakt. Tema: açık · koyu · sistem, seçim hatırlanır.
- Masaüstü öncelikli (≥1280 px), mobil kapsam dışı. Tarih gösterimi GG.AA.YYYY (saklama YYYY-MM-DD).
- Erişilebilirlik: WCAG AA kontrast; tüm akışlar klavyeyle yapılabilir.
- Ekranlar ve durumlar (her ekran için: yükleniyor · boş · hata · başarı):
  - **Özet:** satır/kolon boyutu seçilebilen pivot (hücreye tıklama → filtreli Liste), KPI kutuları (açık iş, Linktera'da bekleyen, gecikmiş, bu hafta UAT, OPM'de kapanmış), yaklaşan tarihler.
  - **Liste:** Ana Başlık'a göre gruplu tablo, filtreler, arama, kolon seçici, sıralama, satır içi durum değişikliği.
  - **Pano:** durum kolonlarında sürükle-bırak, İptal katlanır, kolon başına sınır + "daha fazla".
  - **Karşılaştırma:** iki snapshot (veya canlı) farkı, haftalık açık iş grafiği, snapshot al/sil; ekran açılınca haftalık snapshot isteği.
  - **İçe/Dışa Aktar:** Excel içe aktar (onaylı), OPM yükle, Excel indir.
  - **İş detayı (çekmece):** tüm alanlar, OPM kutusu + "Uygula", yorum ekle/sil, alan tarihçesi; yeni iş oluşturma.
  - Generic KONU kuralı (>20 işte geçen KONU → başlık Açıklama'nın ilk satırı) korunur.

## Constraints & out of scope
- Backend davranışı spec 0001'in işi; bu spec yalnız `/api/meta` sözleşmesini ve statik sunumu kullanır.
- Çok kullanıcı, kimlik doğrulama, mobil düzen kapsam dışı (B-1).

## Acceptance criteria
- [x] AC-1 — Altı görünümün her biri (Özet, Liste, Pano, Karşılaştırma, Aktar, Detay) bugünkü arayüzdeki eylemleri yapar; yükleniyor/boş/hata durumları bileşen testleriyle kanıtlanır.
- [x] AC-2 — Alan ve değer listeleri yalnız `/api/meta`'dan gelir; `web/src` içinde durum adları sabit olarak tanımlanmaz (test ile denetlenir).
- [x] AC-3 — Yalnız `web/src/api` `fetch` çağırır (test/lint ile denetlenir).
- [x] AC-4 — Pano'da sürükle-bırak durumu değiştirir; Tamamlandı'ya geçişte %100 + bitiş tarihi önerilir (BR-2).
- [x] AC-5 — Gecikmiş (BR-1) ve OPM'de kapanmış (BR-3) işaretleri doğru işlere gösterilir.
- [ ] AC-6 — Tema (açık/koyu/sistem) değişir ve hatırlanır; tarihler GG.AA.YYYY gösterilir. → moved to B-9
- [x] AC-7 — `./scripts/check` web-lint, web-test, web-build adımlarıyla yeşil; residue temiz.
- [x] AC-8 — Ship sonrası `python app.py` → `127.0.0.1:5000/` yeni arayüzü sunar, internet olmadan çalışır.

## Definition of Done
- Kriterler kanıtla eşleşti, `./scripts/check` (full) yeşil, bağımsız review yapıldı.

## Evidence (criterion ↔ evidence)
Tam yeşil: `CHECK GREEN (full, 7 steps, 47 s) @3697dea`; `RESIDUE CLEAN (full, 2 runs) @3697dea · RESIDUE CLEAN (fast, 2 runs) @3697dea`. Web testleri `web/src/**/*.test.ts(x)` (11 dosya, 63 test).

| Criterion | Evidence |
|---|---|
| AC-1 | `web/src/features/{ozet,liste,pano,karsilastirma,aktarim,detay}/*.test.tsx` — her ekranda yükleniyor/boş/hata/başarı + eylem testleri; S-1…S-6, S-11…S-13 |
| AC-2 | `web/src/architecture.test.ts` "AC-2"; `test_meta_contract.py` |
| AC-3 | `web/src/architecture.test.ts` "AC-3" + `web/eslint.config.js` fetch kuralı |
| AC-4 | `web/src/features/pano/Pano.test.tsx` sürükle-bırak PATCH, BR-2 kabul/ret |
| AC-5 | `web/src/lib/rules.test.ts` BR-1/BR-3; `Liste.test.tsx`, `Ozet.test.tsx`; S-3 |
| AC-6 | **taşındı → B-9**: tema kısmı kanıtlı (`ThemeSwitch.test.tsx`, S-7…S-9), ama detay çekmecesindeki OPM kutusu zamanları ISO gösteriliyor (S-6b) — kanıtlanamadı, feragat edilmedi (R-08) |
| AC-7 | `CHECK GREEN (full, 7 steps, 47 s) @3697dea` (web-lint, web-test, web-build); `RESIDUE CLEAN (full, 2 runs) @3697dea · RESIDUE CLEAN (fast, 2 runs) @3697dea` |
| AC-8 | `tests/integration/test_app_entry.py::test_root_serves_built_web_ui`; canlı `/` → yeni arayüz (S-1); `web/dist` dış kaynak yüklemiyor |

Ship: Zeliha Güven (yetki devri: "devam et ve bana soru sorma"), 2026-11-01. Ekran görüntüleri S-1…S-14 agent-captured (QA), C:\Users\ZELIHA~1.GUV\AppData\Local\Temp\claude\c--Users-zeliha-guven-Desktop-PolTask\0ceea711-5c8f-4862-9f1d-9200d1a87807\scratchpad\qa\shots, judged by Zeliha Güven (yetki devri) at SHIP, 2026-11-01.

## Scorecard (fill at ship — honest numbers make the process improvable)
| Metric | Value |
|---|---|
| Spec revisions | 1 (0002–0007 tek spec'te birleşti, hız talebi) |
| Fix rounds | 3 (fix-1 sözleşme, fix-2 review, fix-3 bağımlılık) |
| Review findings: real / noise / deferred | spec 0001 tablosuyla ortak (birleşik review) |
| Regressions introduced | 0 |
| Bugs escaped to production | 0 (bilinen) |
