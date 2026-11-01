# Conventions

> Yalnızca gerçek kurallar: her kural ya araçla zorlanır (tercih edilen) ya da review'da kontrol edilir.
> Temenniler buraya girmez.

## Language
<!-- Set at bootstrap (step 0) and mirrored in AGENTS.md. Changing it later is allowed — edit both
     places; existing documents are not translated retroactively. -->
- Chat language (interviews, sessions): Türkçe (`tr`)
- Document language (docs/, specs, plans, ADRs, review and verify reports): Türkçe (`tr`)
- Always English (protocol, not prose): ANEW core files, template headings and field labels,
  `Status:` values (Draft / Approved / In progress / Shipped), `Approved by / on:`, `Source:`.
- Code identifiers, branch names, commit messages: altyapı tanımlayıcıları İngilizce (modül, fonksiyon,
  bileşen, değişken adları). **Domain alan anahtarları** bugünkü Türkçe-ASCII adlarını korur
  (`ana_baslik`, `konu`, `kimde_bekliyor`, `kapsam_tipi`, `durum`, `yuzde`, `oncelik`, `opm_no` …),
  çünkü Excel sütunlarına ve veritabanına birebir eşlenirler. Branch adları ve commit mesajları
  İngilizce, Conventional Commits (`docs/git.md`).
- Agent messages (handoff summaries, refusals, `Next:` lines): chat language; command names, file
  paths and protocol fields verbatim.

## Language & framework versions

| Bileşen | Sürüm | Nerede sabitlenir |
|---|---|---|
| Python | 3.12 (bugün 3.12.10) | `scripts/check.conf` `requires compile` |
| Flask | 3.1.3 | `requirements.txt` |
| openpyxl | 3.1.5 | `requirements.txt` |
| SQLite | Python stdlib `sqlite3` | — |
| pytest | 9.2.0 | `requirements-dev.txt` |
| ruff | 0.17.3 | `requirements-dev.txt` |
| Node.js | ≥ 20 (spec 0002 kesinleştirir) | `scripts/check.conf` `requires` (planlı) |
| React, TypeScript, Vite, Mantine, Vitest, React Testing Library | spec 0002'de sabitlenir | `web/package.json` + commit edilen `web/package-lock.json` |

Sürümler tam (`==`, lockfile) sabitlenir; aralık yok. Chart.js CDN'i spec 0002 ile kalkar.

## Naming

- Python: modül/fonksiyon/değişken `snake_case`, sınıf `PascalCase`; paketler `domain`, `storage`,
  `integrations`, `api` (`docs/architecture.md`).
- Domain alan anahtarları Excel/DB ile birebir aynı Türkçe-ASCII adlardır (bkz. Language); yeniden
  adlandırılmaz, çevrilmez.
- TypeScript/React: bileşen ve dosyası `PascalCase` (`TaskTable.tsx`), hook `useXxx`, diğer
  tanımlayıcılar `camelCase`; ekranlar `web/src/features/<ekran>/`.
- Testler: Python `tests/unit/test_<konu>.py`, `tests/integration/test_<konu>.py`, fonksiyon
  `test_<davranış>`; iş kuralı testlerinin adında kural geçer (`test_br1_...`). Frontend
  `<Bileşen>.test.tsx`, bileşenin yanında.
- Branch'ler: `docs/git.md`.

## Error handling

- API hataları her zaman `{"error": "<Türkçe mesaj>"}` gövdesi ve doğru HTTP durum koduyla döner
  (400 geçersiz girdi, 404 bulunamadı, 409 çakışma, 413 dosya çok büyük, 500 beklenmeyen hata).
- Kullanıcıya **asla** stack trace, dosya yolu veya SQL metni sızmaz; beklenmeyen hatalar sunucu
  tarafında loglanır, kullanıcıya genel bir Türkçe mesaj döner.
- Frontend tüm hataları **tek** bir bildirim bileşeni üzerinden gösterir (Mantine notifications);
  bileşenler kendi hata kutusunu icat etmez.

## Data rules

- Tarihler `YYYY-MM-DD` metin olarak saklanır ve taşınır.
- Zaman damgaları ISO-8601, **Europe/Istanbul yerel saat** (UTC'ye geçiş backlog B-1'de).
- `yuzde`: tam sayı, 0–100. `oncelik`: tam sayı, 1–3.
- Durum, Kapsam Tipi, Sözleşme Kapsamı: yalnızca `domain`'deki izin verilen değerler (BR-5).
- OPM No: `LTR\d+` çıkarılarak normalize edilir (`docs/domain.md`).
- Doğrulama yalnızca `api` katmanında, `domain`'in izin verilen değer listelerine karşı yapılır (BR-5);
  `storage` doğrulanmış veri alır.
- Excel başlıkları kırpılarak (strip) eşleştirilir; dışa aktarımda kaynak sayfanın başlık ve sırası korunur.

## Known traps
<!-- Starts empty. One line per trap of this stack that a builder can know up front:
     "<trap> — <what to do instead> — from <spec/finding>". A line is added when triage marks a
     finding real and the reviewer says a build-time rule would have caught it; the human
     approves it at triage as Amendment A-n and the Developer writes it in the fix round.
     Builders read this section before the first plan step.
     A trap that tooling can catch moves to "Enforced by tooling" instead. -->
- openpyxl `read_only` çalışma kitabı kapatılmazsa Windows'ta dosyayı kilitler (sonraki `os.remove` hata
  verir) — her zaman `wb.close()` ya da context manager kullan — from bootstrap 2026-11-01
- Excel başlıklarında sonda boşluk var (`"Tamamlanma Durumu "`) — başlıkları `strip()` edilmiş hâlleriyle
  eşleştir — from bootstrap 2026-11-01
- JS `new Date().toISOString()` UTC verir; Türkiye'de gece yarısından sonra dünün tarihini üretir — yerel
  tarih için tek bir yardımcı fonksiyon kullan — from bootstrap 2026-11-01
- Windows konsolu cp1254; Türkçe yazdıran Python betikleri bozuk çıktı verir ya da çöker — `PYTHONUTF8=1`
  ile çalıştır — from bootstrap 2026-11-01
- Tarihçe özeti başlıklarında yıl yok (`"23 Eylül"`) — yıl varsayımı açık bir parametre olmalı, sessizce
  "bu yıl" kabul edilmez — from bootstrap 2026-11-01
- openpyxl ValueError mesajı dosya yolunu içerir — kullanıcıya iletme, genel Türkçe 400'e çevir — from review
  0001 round 1

## Enforced by tooling
<!-- List what the compiler/linter/analyzers already enforce, so review doesn't re-litigate it.
Wire new rules into `scripts/check` whenever possible — prose is advice, tooling is law. -->
- **ruff** (`pyproject.toml`, kurallar `E`, `F`, `I`, `B`; satır uzunluğu 120; hedef py312) —
  `scripts/check` `lint` adımı. Tüm Python kodu kapsamdadır (yalnızca `.claude/` ve `web/node_modules`
  hariç).
- **compileall** — Python sözdizimi, `compile` adımı.
- **TypeScript strict** — spec 0002 ile (`web-lint/typecheck` adımı, şimdilik planlı).
- Mimari sınırlar (`docs/architecture.md`) — pytest mimari testi (`tests/unit/test_architecture.py`,
  `test-unit` adımı).
