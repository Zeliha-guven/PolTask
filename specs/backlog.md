# Backlog — deferred findings

Findings a human triaged as **defer**: real, but fixed later by decision (`workflows/feature-development.md`,
step 7). Nothing lands here without that decision; noise is rejected in the triage record, not parked here.

- A criterion moved out at the ship gate (R-08, `→ moved to B-<n>`) lands here too, by the
  human's ship decision; the entry names the spec and criterion.
- One entry per finding, newest last. Delete the entry in the commit of the work that closes it.
- An entry that grows into new behavior becomes a spec (`specs/active/`), not a fix.

<!-- Format (labels stay English):
- **B-<n>** — <finding, one line> — Source: spec <NNNN>, review round <n> (<file:line>) — Severity: <…>
  — Recommendation: <the reviewer's action> — Deferred by: <name>, <YYYY-MM-DD>, <why>
  A decision deferred at bootstrap (its REPORT) uses Source: bootstrap <YYYY-MM-DD>.
-->

- **B-1** — Çok kullanıcılı kullanım: kimlik doğrulama, yetkilendirme, CSRF, sunucuyu LAN'a açma ve zaman
  damgalarının UTC'ye geçişi; o gün Yetkilendirme hassas alan olarak yeniden değerlendirilir
  (`docs/domain.md`, Sensitive areas) — Source: bootstrap 2026-11-01 — Severity: n/a (bilinçli kapsam dışı)
  — Recommendation: ayrı bir spec ile; o spec olmadan 0.0.0.0/LAN'a açmak yasak (`docs/security.md`)
  — Deferred by: Zeliha Güven, 2026-11-01, bugün tek kullanıcılı ve yalnızca localhost'ta kullanılıyor
- **B-2** — Remote + CI kurulumu (CI'da `./scripts/doctor --strict` + tam `./scripts/check`) — Source:
  bootstrap 2026-11-01 — Severity: n/a — Recommendation: remote açıldığında `.github/workflows` ile CI
  kur, trivial policy (1)'e geçişi değerlendir (`docs/git.md`) — Deferred by: Zeliha Güven, 2026-11-01,
  "şimdilik push yapmayacağım"; tam yeşil yerel tam check çalışmasından gelir
- **B-3** — `web/` npm bağımlılıklarının `npm audit` taraması check'te yok — Source: spec 0001, review round 1
  (L-5) — Severity: Low — Recommendation: `npm audit --omit=dev` için ayrı bir check adımı ya da periyodik
  kontrol — Deferred by: Zeliha Güven (yetki devri), 2026-11-01, çevrimdışı/yerel kullanım; hız önceliği
- **B-4** — Durum dağılım çubuğu (eski arayüzdeki statusBar) yeni arayüzde yok — Source: spec 0001, review round 1
  (I-3) — Severity: Info — Recommendation: Özet ekranına eklenmesi — Deferred by: Zeliha Güven (yetki devri),
  2026-11-01, görsel ek; ayrı küçük değişiklik
- **B-5** — Eski arayüzü `/eski`'den kaldır (`static/`, Chart.js CDN, innerHTML şablonları) — Source: spec 0001,
  review round 1 (A-9) — Severity: n/a — Recommendation: yeni arayüz bir süre kullanıldıktan sonra kaldır —
  Deferred by: Zeliha Güven (yetki devri), 2026-11-01, kullanıcı kararı: geri dönüş yolu olarak bir süre kalsın
- **B-6** — Aralık dışı kayıtlı Öncelik/Yüzde değeri çekmecedeki seçim listesinde boş görünüyor — Source: spec 0001,
  review round 2 (`web/src/features/detay/TaskDrawer.tsx:236-243`) — Severity: Low — Recommendation: aralık dışı
  değeri de seçeneklere ekle + test — Deferred by: Zeliha Güven (yetki devri), 2026-11-01, gerçek veride yok; 4. fix round R-06 gerektirirdi
- **B-7** — `read_workbook` geniş `except` traceback loglamıyor — Source: spec 0001, review round 2
  (`poltask/integrations/opm_import.py:77-78`, `poltask/api/transfer.py:64,79`) — Severity: Info —
  Recommendation: `log.warning(..., exc_info=True)` — Deferred by: Zeliha Güven (yetki devri), 2026-11-01, yalnız teşhis
- **B-8** — `StartupError` her `sqlite3.DatabaseError` için "bozuk, yedekten geri yükle" diyor (kilitli DB dahil) —
  Source: spec 0001, review round 2 (`poltask/storage/database.py:118-122`) — Severity: Info — Recommendation:
  `OperationalError` için nötr mesaj ("başka bir PolTask açık mı?") — Deferred by: Zeliha Güven (yetki devri), 2026-11-01, olasılık düşük
- **B-9** — Spec 0002 AC-6 (moved at ship, R-08): tarihler GG.AA.YYYY — detay çekmecesindeki OPM kutusu
  "Oluşturma / Son güncelleme" ISO gösteriyor — Source: spec 0002, verify (G-3) — Severity: Low —
  Recommendation: OPM zamanlarını `GG.AA.YYYY SS:dd` biçimle; tema kısmı zaten kanıtlı — Deferred by: Zeliha Güven (yetki devri), 2026-11-01
- **B-10** — CB-4 sınırı tam değerde test edilmiyor (20 971 520 / 20 971 521 bayt) — Source: spec 0001, verify (G-1)
  — Severity: Low — Recommendation: tam Content-Length ile sınır testi; `test_upload_just_under_limit_is_not_413`
  adını düzelt — Deferred by: Zeliha Güven (yetki devri), 2026-11-01
- **B-11** — Kozmetik: Liste'de sağ kenarda kırpılmış kolon işareti; sol menü/içerik kenarlığı alt bandı — Source:
  spec 0002, verify (G-7) — Severity: Info — Recommendation: düzen düzeltmesi — Deferred by: Zeliha Güven (yetki devri), 2026-11-01
