# Git

> Bootstrap 2026-11-01'de ayarlandı. ANEW varsayılanları korunur; farklar aşağıda açıkça yazılıdır.

## Branching
- Varsayılan branch: `main`.
- `feature/<spec-no>-<short-name>` — **no branch without a spec.** Also for CHANGE-lane mini-specs.
- Refactors: `refactor/<spec-no>-<short-name>` (mini-spec with Changed behavior = none).
- Fixes: `fix/<report-id>-<short-name>` (bug fixes carry a report, not a spec number);
  incidents: `incident/<date>-<short-name>`; trivial changes: `trivial/<short-name>` (see below).
- Bootstrap: `chore/bootstrap` — the bootstrap output (`workflows/bootstrap.md`), merged like
  any branch.

## Commits
- Conventional Commits, with a plan reference: `feat(catalog): paging endpoint [plan 0001/3]`.
  Review fixes name their fix round instead of the step:
  `fix(catalog): empty page size [plan 0001/fix-2]` — the reviewer counts rounds from these
  (R-06 after round 3).
- Agent commits follow the same standard: the agent writes the message, the human approves it
  through the gate before the commit, not one by one — an approved plan covers its
  `[plan NNNN/n]` and `[plan NNNN/fix-k]` commits, the ship approval the ship commit. Every
  message stays visible in the branch and the PR. Lite and strict alike.
- Commit named paths only: `git commit -- <paths>`, never `git add -A`, `git add .` or
  `commit -a`. Another session or tool may have written or staged files in the same tree.

## Remote & merge (bu proje)
- **Şimdilik remote ve PR yok** (insan kararı, 2026-11-01: "şimdilik push yapmayacağım"; backlog B-2).
- Bir branch, insanın **SHIP onayından sonra** `main`'e **yerel squash-merge** ile alınır
  (`git checkout main && git merge --squash <branch>` ve ardından tek commit). `chore/bootstrap` da böyle
  birleşir.
- Kanıt olan tam yeşil (`CHECK GREEN (full, …)`), CI olmadığı için yerel bir tam `./scripts/check`
  çalışmasından gelir (`docs/testing.md`, Two speeds, rule 6).
- PR olmadığından PR'a eklenecek kanıt (screenshot vb.) SHIP gate'inde gösterilir (`docs/testing.md`,
  Evidence policy rule 3).

## Forbidden
- Direct commits to the default branch.
- Force push, history rewriting on shared branches. Undo = `git revert` (see recovery R-11).

## Trivial changes
<!-- Set at bootstrap. Applies only to requests the change-request triage rubric
     (workflows/change-request.md) classifies as TRIVIAL: no acceptance criterion changes, no shared code. -->
- Policy: **(2) direct commit allowed on a `trivial/<short-name>` branch** — seçen: Zeliha Güven,
  2026-11-01. Akış: `trivial/<short-name>` branch'i → tek dar commit → `./scripts/check` (full) yeşil →
  `main`'e yerel squash-merge.
  Neden (1) değil: (1) bir PR ve PR üzerinde reviewer gerektirir; bu projede remote ve PR yok
  (yukarıda "Remote & merge"). Remote + CI geldiğinde (B-2) (1)'e geçiş yeniden değerlendirilir.
- Always: one narrow commit, `scripts/check` green. A second file or a new test means re-triage.

## Pull requests
- PR template checklist completed; `scripts/check` green in CI; squash-merge.
- Bu projede şimdilik geçerli değil (remote/PR yok); yerine yukarıdaki "Remote & merge" uygulanır.
  Remote ve CI kurulduğunda (B-2) bu kural aynen devreye girer.
