# T6 §2/§3 — Release Lineage Audit &amp; Integration Strategy

## Lineage

- Merge-base(RC pre-merge HEAD `feec4a427`, `origin/main`) = `b59075c99310098ef724a0ffde80fa6782e890c6`.
- `origin/main` HEAD at audit time = `f80c75778eccb349f33b4f841685bf2d4c90c9ea`.
- 96 commits between the merge-base and `feec4a427` (the full candidat-individuel T1-T6
  lineage), 3 of them merges (`dbb262550`, `8224be551`, `e6b799aca`) — each an explicit,
  self-documented reconciliation with `origin/main` at the time (the most recent,
  `dbb262550`, carries a long commit body naming the exact 3 real semantic conflicts it
  resolved and the tests it re-verified — a genuine audit trail, not a black-box merge).
- **T3B1 exclusion, verified**: `git merge-base --is-ancestor 35841bd3c feec4a427` → not an
  ancestor. Also not an ancestor of `origin/main`. Confirmed excluded from both.
- **No silent absorption**: every merged main-side parent commit
  (`561c9d66e`, `a033a739e`, `b59075c99`) independently confirmed as a real `origin/main`
  ancestor via `git merge-base --is-ancestor`.

## Main-only commits (`b59075c99..origin/main`, 20 commits)

100% the "UTICA 2026 salon demonstrator" feature (PRs #174, #175, #176) — entirely unrelated to
candidat-individuel. File-level intersection between the 86 files those 20 commits touch and the
200 files the V1 lineage touches: only `package.json` and `release-manifest.json`.

| File | Classification | Resolution |
|---|---|---|
| `package.json` | Auto-mergeable (each side adds one unrelated npm script) | Confirmed via a non-destructive `git merge-tree` dry run before merging — auto-merged cleanly |
| `release-manifest.json` | `POTENTIAL_CONFLICT` (machine-generated build artifact — every field touched on both sides) | Never hand-merged — regenerated for real from this RC's own production build (see `t6-db-artifact-sbom.md` §12) |
| (198 other files) | `CANDIDAT_V1_REQUIRED` | Untouched by main-only commits — zero risk |

## Integration strategy chosen: **C — controlled merge**

- Not **A** (declare the RC from `feec4a427` alone): `origin/main` had moved 20 commits ahead
  of the merge-base, and PR #176's own title ("chore/utica-eaf-alignment-live") suggests that
  work is already live — cutting the RC without it would silently roll back an unrelated,
  already-shipped feature if this branch were later deployed over `main`.
- Not **B** (cherry-pick/transplant the 96-commit V1 series onto `origin/main`): strictly more
  work and more risk than a direct merge for the identical end state, given 3 of those commits
  are merges with real, already-carefully-resolved semantic conflicts.
- **C**: merged `origin/main` into the RC branch (`git merge origin/main`, commit `a11836792`).
  Dry-run proven clean except the one regeneratable manifest file — no product-level collision,
  so no STOP condition per the T6 directive's own instruction.

## Real drift found and fixed during the merge (not visible to a file-level diff)

TypeScript caught a genuine type-level incompatibility the merge tooling couldn't:
`lib/demo/utica-2026/regulatory.ts::getDemoBacMap()` read
`policy.candidatIndividuelRules.ponctuellesModality` directly; the V1 lineage's very first
commit (`ab48fe01b feat(exams): add A_VERIFIER sentinel for unconfirmed regulatory values`)
wrapped that field in the `AVerifiable<T>` sentinel type on `lib/exams/catalog.ts`'s
`ExamPolicy`, which the UTICA demo (written against `origin/main`'s pre-wrap shape) never
accounted for. Fixed with `requireResolved()` (the same fail-closed helper this exact demo
file's own comments already mandate — "never invent a regulatory fact") — a no-op at runtime
(session 2027's canonical data already carries a resolved object here), zero change to either
`lib/exams/*` regulatory logic or the demo's own behavior/output. Commit `3037c4392`.

## Final RC lineage

```
feec4a427  (T5R6 — FINAL FAMILY SEMANTICS CLOSEOUT, direction-approved INTERNAL_HUMAN_RECETTE=PASS)
  → b0bfdf697  docs: record the human PASS decision (T6 §1)
  → a11836792  merge: origin/main (UTICA 2026 salon demo, unrelated)
  → 3037c4392  fix: resolve the one real merge-surfaced type drift (demo-only, no regulatory change)
```

`RC_CANDIDATE_SHA = 3037c4392411d942dd27ac3ba10738593670dfc5`
