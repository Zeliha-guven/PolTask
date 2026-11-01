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
