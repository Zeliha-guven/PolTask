# Spec 0001 — Backend yeniden yapılanma ve sözleşme açıklarının kapanması (mini)
<!-- Content in the document language from AGENTS.md; headings, labels and Status values stay English (protocol). -->

- Status: Shipped
- Mode: strict
- Plan: `specs/plans/0001-plan.md`
- Self-critique: done (G-1…G-9 kabul edildi — Zeliha Güven, 2026-11-01)
- Source: Zeliha Güven, "Projeyi (PolTask) ANEW adımlarına göre yeniden tasarla" — 2026-11-01; clarify kararları S1–S6 ("Listelenen tüm önerileri kabul et", 2026-11-01)
- Design: — (arayüz değişikliği yok; eski arayüz aynen çalışmaya devam eder, tek istisna CB-7)
- Supersedes: — (`specs/done/` boş; bu modülün shipped spec'i yok — Preserved behavior mini karakterizasyondur)

## Intent
PolTask'in sunucu tarafı, arayüzün React + Mantine'e taşınmasından (0002–0007) önce kararlaştırılmış
modül yapısına (`docs/architecture.md`) taşınır ve bugün bilinen veri bütünlüğü açıkları kapanır:
geçersiz Durum/Kapsam Tipi/Sözleşme, boşaltılabilen KONU, sessizce kırpılan Yüzde/Öncelik, sınırsız
dosya yükleme, veri yazan okuma isteği. Alan listesi ve izin verilen değerler tek bir tanımdan sunulur.
Mevcut veri (543 iş, 32 yorum, 16 snapshot, 314 OPM kaydı, tarihçe, meta) eksiksiz korunur ve her gün
kullanılan eski arayüz kesintisiz çalışır. Kullanıcının göreceği yeni bir ekran bu spec'te yoktur.

## Changed behavior
<!-- Kapalı değişiklik listesi: clarify S3 (i)–(vii), S4-a, S6-a; G-n işaretli olanlar öz eleştiriden
     önerilen eklemelerdir ve spec onayıyla birlikte onaylanır. Bunların dışındaki her davranış korunur. -->
- [x] CB-1 — İş oluşturma ve güncellemede Durum, Kapsam Tipi veya Sözleşme Kapsamı tanımlı değerlerden
  biri değilse (BR-5) istek 400 ve Türkçe `{"error": …}` ile reddedilir; iş değişmez, tarihçeye kayıt
  düşmez. Kapsam Tipi ve Sözleşme Kapsamı boş bırakılabilir (S3-vii). Güncellemede Durum boşaltılamaz
  (400) (G-3). Oluşturmada Durum boşsa "Başlamadı" atanır (S3-vi, korunan davranış).
- [x] CB-2 — Bir işin KONU'su güncellemede boş ya da yalnızca boşluk olarak gönderilirse istek 400 ve
  Türkçe hata ile reddedilir; iş ve tarihçe değişmez (S3-ii). KONU alanı gönderilmeyen güncelleme etkilenmez.
- [x] CB-3 — Yüzde 0–100, Öncelik 1–3 dışındaysa istek 400 ve Türkçe hata ile reddedilir; değer artık
  sessizce sınıra kırpılmaz (S3-v). Sınır değerler (0, 100, 1, 3) ve boş değer kabul edilir.
- [x] CB-4 — 20 MiB'ı (20 971 520 bayt, istek gövdesi) aşan bir yükleme (Excel ve OPM içe aktarımı) 413 ve
  Türkçe hata ile reddedilir ve hiçbir veri değişmez (S3-iii, G-5). Yüklenen geçici dosya, içe aktarım
  başarılı da olsa hata da verse işlem sonunda silinmiş olur; Windows'ta dosya kilidi nedeniyle silme
  hatası oluşmaz (`docs/conventions.md`, Known traps).
- [x] CB-5 — Hiçbir salt okuma (GET) isteği veri yazmaz: snapshot listesinin yeni bir ISO haftasında
  istenmesi dahil, okuma öncesi ve sonrası veritabanı içeriği aynıdır (S3-iv).
- [x] CB-6 — Haftalık snapshot açık bir istekle alınır (S6-a, BR-6): iş varsa ve içinde bulunulan ISO
  haftasında hiç snapshot yoksa "Haftalık otomatik" etiketli tek bir snapshot oluşur; aynı haftada
  tekrarlanan istek yeni kayıt üretmez; hiç iş yoksa snapshot alınmaz.
- [x] CB-7 — Eski arayüz, bugün haftalık snapshot'ın tetiklendiği anda (Karşılaştırma ekranının oturumdaki
  ilk açılışı) CB-6'daki isteği gönderir; böylece geçiş döneminde (0007'ye kadar) BR-6 kullanıcı açısından
  bugünkü gibi işler (G-2).
- [x] CB-8 — Alan listesi (anahtar, Excel başlığı, tip), Durum, Kapsam Tipi ve Sözleşme Kapsamı değerleri
  tek bir tanımdan arayüze sunulur; sunulan değerler doğrulamanın (CB-1) kullandığı değerlerle aynıdır.
  Bugün sunulan meta bilgileri (son içe aktarım, son OPM aktarımı, OPM ve iş sayısı) aynı adlarla korunur.
- [x] CB-9 — Mevcut bir veritabanıyla ilk açılışta, herhangi bir değişiklikten önce `data/` altına tarih-saat
  adlı bir yedek kopya alınır ve saklanır; şema sürümü kaydedilir; iş, yorum, snapshot, OPM, tarihçe ve meta
  kayıtlarının sayısı ve içeriği öncesiyle aynıdır (şema sürümü kaydı hariç). Sonraki açılışlar yeni yedek
  almaz ve veriyi değiştirmez. Yedek alınamazsa yükseltme yapılmaz, uygulama Türkçe bir mesajla başlamaz
  (G-8). Boş/olmayan veritabanında şema sürümüyle birlikte oluşturulur, yedek gerekmez (S4-a).
- [x] CB-10 — Tüm API hataları (400, 404, 413, 500) Türkçe `{"error": …}` gövdesiyle döner; hiçbir hata
  gövdesi stack trace, dosya yolu veya SQL içermez; beklenmeyen hatalar sunucuda loglanır ve kullanıcıya
  genel bir Türkçe mesaj döner (G-9, `docs/conventions.md` Error handling — bugün 404/500 HTML dönüyor).

## Preserved behavior
<!-- Mini karakterizasyon: bugünkü koddan gözlemle yazıldı (2026-11-01), kusurları dahil. -->
- [x] PB-1 — Geçerli girdilerle tüm iş akışlarının yanıtları bugünküyle aynıdır: iş listesi (sıra, OPM
  eşleşmesi, yorum sayısı), iş oluşturma (sıra = en büyük + 1, 201), güncelleme, silme (yorum ve tarihçesiyle;
  olmayan kayıtta da 204), zaman çizelgesi (yorumlar + değişiklikler, yeniden eskiye), yorum ekleme/silme
  (boş yorum 400), elle snapshot alma/silme, pivot (`(boş)` dahil), geçersiz tarih biçiminin 400 ile reddi.
- [x] PB-2 — Tarihçe: her alan değişikliği alan, eski, yeni ve zamanla kaydedilir; oluşturma `_olusturma`
  kaydı düşer; değeri değişmeyen alan için kayıt düşmez; reddedilen istek (CB-1…CB-3) kayıt düşürmez.
- [x] PB-3 — Excel dışa aktarımı: sayfa adları ("Güncel Durum", "Linktera_Tüm_İşler"), sütun başlıkları ve
  sırası, hücre değerleri ve biçimleri, dosya adı kalıbı bugünkü çıktıyla aynıdır; gerçek veritabanında
  geçiş öncesi ve sonrası dışa aktarım hücre hücre aynıdır (S4-a).
- [x] PB-4 — Excel içe aktarımı tüm veriyi değiştirir (işler, yorumlar, tarihçe, snapshot'lar; BR-4),
  "Karşılaştırmalı özet" sayfasını geçmiş snapshot'lara, OPM sayfasını OPM kayıtlarına dönüştürür, "İçe
  aktarım" snapshot'ı alır; dışa aktar → içe aktar → dışa aktar gidiş-dönüşü aynı dosyayı üretir. OPM içe
  aktarımı OPM kayıtlarını yeniler, eşleşen iş sayısını döner; OPM No `LTR\d+` ile normalize edilir.
- [x] PB-5 — Eski arayüzün tüm ekranları (Özet, Liste, Pano, Karşılaştırma, İçe/Dışa Aktar, iş detayı)
  ve eylemleri bugünkü gibi çalışır; uygulama aynı tek komutla (`python app.py` / `baslat.bat`) aynı adreste
  (`127.0.0.1:5000`) açılır.

## Constraints
- Sunucu kodu `domain`, `storage`, `integrations`, `api` modüllerine taşınır; bağımlılık yönü ve yasak
  bağımlılıklar `docs/architecture.md`'deki gibidir ve mimari testle `scripts/check`'te doğrulanır. Yeni
  kod ruff kapsamındadır; eski dört dosyanın istisnası kalkar.
- Testler `docs/testing.md`'deki gibi: gerçek `data/` veritabanına hiçbir test dokunmaz; Excel fixture'ları
  test içinde üretilir; saat enjekte edilir (ISO hafta ve "bugün" testlerde sabit).
- Sunucu yalnızca `127.0.0.1`'e bağlanır; yeni paket yalnızca onaylı planda listelenirse eklenir.
- Gerçek veritabanı üzerindeki CB-9 ve PB-3 kanıtı tekrarlanamaz bir gözlemdir (kayıt sayıları + dışa aktarım
  karşılaştırması); SHIP kapısında gösterilir (`docs/testing.md`, Evidence policy 3).
- **Split:** proposed 0001a taşıma + karakterizasyon (PB-1…PB-5) ve 0001b sözleşme açıkları (CB-1…CB-10)
  (15 kriter, boyut kuralı ~8–10); kept as one — Zeliha Güven, 2026-11-01, PB'ler yeni kabiliyet değil
  taşımanın güvenlik ağıdır; bölmek aynı taşınan koda iki tur demektir (G-1).

## Out of scope
- **Yol haritası (S1-B, bu spec'ten sonra; her biri ayrı spec, `TEMPLATE.md`):**
  0002 React + TypeScript + Vite + Mantine iskeleti (gezinme, tema, bildirimler) + Liste ekranı, web adımları
  check'te; 0003 iş detayı drawer'ı (oluştur/düzenle/sil, OPM kutusu, yorumlar + tarihçe); 0004 Özet;
  0005 Pano; 0006 Karşılaştırma; 0007 İçe/Dışa Aktar + eski arayüzün kaldırılması ve varsayılana geçiş
  (Chart.js CDN ve `innerHTML` şablonları burada kalkar). Geçiş boyunca eski arayüz varsayılandır, yeni arayüz
  ayrı bir girişten açılır (S2-a). Görsel yön (S5-a) 0002 ve sonrası spec'lerin User experience bölümüne yazılır.
- Yeni arayüz ekranları ve görsel değişiklikler (CB-7'deki tek istek dışında eski arayüze dokunulmaz).
- Şema değişikliği (yabancı anahtar, CHECK kısıtı) — S4-a: şema aynen korunur.
- Excel/OPM içe aktarımında BR-5 reddi: içe aktarım bugünkü gibi değerleri olduğu gibi alır (G-4).
- İçe aktarımda tarihçe başlıklarının yıl varsayımı (Known traps) bugünkü gibi kalır (G-6).
- Olmayan işe yorum eklenebilmesi ve olmayan kaydın silinmesinde 204 dönmesi bugünkü gibi kalır (G-7).
- Çok kullanıcılı kullanım, kimlik doğrulama, LAN, UTC (B-1); remote ve CI (B-2).

## Definition of Done
- [x] `scripts/check` green
- [x] Independent review done; real findings fixed, noise rejected with written rationale, deferred ones in `specs/backlog.md`
- [x] Criterion ↔ evidence table complete for CB-* **and** PB-* (UI: before/after screenshots, agent-captured, judged at SHIP)
- [x] Spec moved to `specs/done/` (immutable there)

## Evidence (criterion ↔ evidence)
Tam yeşil: `CHECK GREEN (full, 7 steps, 47 s) @3697dea` (QA ayrıca `CHECK GREEN (full, 7 steps, 53 s) @3697dea`); `RESIDUE CLEAN (full, 2 runs) @3697dea · RESIDUE CLEAN (fast, 2 runs) @3697dea`.
Testler `./scripts/check` ile yeniden üretilir; ayrıntılı eşleme `specs/plans/0001-plan.md` "Criterion ↔ test map".

| Criterion | Evidence |
|---|---|
| CB-1 | `tests/integration/test_validation_api.py::test_br5_invalid_value_rejected_on_create`, `::_on_update`, `::test_br5_kapsam_tipi_and_sozlesme_may_be_empty`, `::test_br5_durum_cannot_be_emptied_on_update`, `::test_create_with_empty_durum_defaults_baslamadi` |
| CB-2 | `test_validation_api.py::test_konu_blank_or_whitespace_rejected_on_update`, `::test_update_without_konu_unaffected` |
| CB-3 | `test_validation_api.py::test_yuzde_out_of_range_rejected_not_clamped`, `::test_oncelik_out_of_range_rejected`, `::test_boundaries_and_empty_accepted`; kodu bozma: 6/6 mutasyon RED, geri alınca GREEN (QA, repo dışı klon @3697dea) |
| CB-4 | `tests/integration/test_uploads_api.py::test_upload_over_20mib_returns_413_and_changes_nothing`, `::test_temp_file_removed_after_success`, `::test_temp_file_removed_after_failure`; kodu bozma RED (+1 KiB, 21 MiB, sınırsız); canlı 21 MiB → 413 Türkçe, veri değişmedi. Tam sınır testi B-10 |
| CB-5 | `tests/integration/test_snapshots_api.py::test_get_requests_do_not_write`; gerçek veri kopyasında GET sonrası 16 → 16 |
| CB-6 | `test_snapshots_api.py::test_br6_weekly_snapshot_once_per_iso_week`, `::test_br6_existing_snapshot_this_week_counts`, `::test_br6_no_snapshot_without_tasks`, `::test_br6_future_dated_snapshot_does_not_break_weekly_rule`; `tests/unit/test_br6_weekly_snapshot.py` |
| CB-7 | `tests/integration/test_legacy_ui_contract.py::test_karsilastirma_posts_weekly_before_listing`; tarayıcı ağ gözlemi `/eski#/karsilastirma`: 1. açılış POST 201, 2. oturum POST 200, yeni kayıt yok (S-14) |
| CB-8 | `tests/integration/test_meta_api.py::test_meta_serves_fields_and_values_from_domain`, `::test_meta_keeps_existing_keys`, `::test_meta_serves_closed_statuses_and_default`; `test_meta_contract.py::test_meta_matches_web_contract` |
| CB-9 | `tests/integration/test_migration.py` (7 test); gerçek veri kopyası @3697dea: yedek `poltask-yedek-…-214332.db` 1. açılışta, 2. açılışta yok; user_version 0→1; 6 tablo içerik aynı; yedek içeriği aynı |
| CB-10 | `tests/integration/test_errors_api.py` (5 test), `test_uploads_api.py::test_unreadable_file_generic_turkish_400_no_leak` |
| PB-1 | `tests/integration/test_tasks_api.py` (9 test), `test_snapshots_api.py::test_manual_snapshot_create_list_delete`, `::test_pivot_includes_bos` — karakterizasyon, eski koda karşı d459694'te yazıldı, gövdeler değişmedi |
| PB-2 | `test_tasks_api.py::test_history_field_old_new_time`, `::test_create_writes_olusturma`, `::test_unchanged_field_no_history`; `test_validation_api.py::test_rejected_request_writes_no_history` |
| PB-3 | `tests/integration/test_excel_export.py` (golden digest); gerçek veri kopyası @3697dea: eski ↔ yeni dışa aktarım iki sayfada hücre hücre aynı |
| PB-4 | `tests/integration/test_excel_import.py` (6 test, CLI dahil), `test_opm_import.py`, `tests/unit/test_opm_normalize.py` |
| PB-5 | `tests/integration/test_app_entry.py::test_eski_serves_legacy_ui`, `::test_static_assets_served`, `::test_main_binds_127_0_0_1_5000`, `::test_baslat_bat_runs_python_app_py`; eski arayüz A-9 ile `/eski`'de; `static/` main'e göre yalnız CB-7'nin 5 satırı; S-10, S-14 |

Ship: Zeliha Güven (yetki devri: "devam et ve bana soru sorma"), 2026-11-01. Ekran görüntüleri S-1…S-14 agent-captured (QA), C:\Users\ZELIHA~1.GUV\AppData\Local\Temp\claude\c--Users-zeliha-guven-Desktop-PolTask\0ceea711-5c8f-4862-9f1d-9200d1a87807\scratchpad\qa\shots, judged by Zeliha Güven (yetki devri) at SHIP, 2026-11-01.

## Scorecard
| Metric | Value |
|---|---|
| Spec revisions | 1 (taslak → onay, G-1…G-9) |
| Fix rounds | 3 (fix-1 backend, fix-2 web, fix-3 bağımlılık) |
| Review findings: real / noise / deferred | round 1: 11 / 2 / 2 · round 2: 1 / 1 / 3 |
| Regressions introduced | 1 — BUILD sırasında bir test gerçek `data/poltask.db`'nin üzerine yazdı (2026-11-01 20:53); veri kurtarılıp Excel'le doğrulandı, A-5 koruması + oturum parmak izi eklendi |
| Bugs escaped to production | 0 (bilinen) |
