# V1 Candidat Individuel — Release Candidate Manifest

## Identity

| Field | Value |
|---|---|
| RC SHA | `3037c4392411d942dd27ac3ba10738593670dfc5` |
| Branch | `release/candidat-individuel-v1-rc1` |
| Worktree | `.worktrees/release-candidate-v1-rc1` |
| Artifact digest (standalone static tree), T6-qualified | `195393a5a56be0351398a1083228e399ce8f79d061719dee7e4659095334aa5b` (T6 build; local artifact since cleaned up, **not** reproducible byte-for-byte on rebuild — see the T7 correction in `t6-db-artifact-sbom.md` §12) |
| Artifact digest, T7-qualified (staging) | `68bff45501d4a1ab20465d97627be8c166d5d57260924b13140490af2b95ff5d` (rebuilt from the identical `3037c4392` source in T7 §2 CASE B; full gate re-run 100% identical: 914/914 unit, 24/24×320/320 DB, 66/66 E2E, typecheck/lint/prisma clean) |
| Package-lock digest | `3659d1ebe6cd8e70732bd2b8e0b39ff0d18748b54667448991c64c26a2d5f300` (identical across both builds — confirms source/dependency identity) |
| Build timestamp | `2026-08-28T22:19:19.937Z` (T6) / `2026-08-28T23:12:01.739Z` (T7 rebuild) |
| Node / npm / Next | v22.22.0 / 10.9.8 / 15.5.21 |
| Timestamp of this manifest | 2026-08-28 (T6 session), updated 2026-08-29 (T7 session) |

## Scope

**INCLUDED_V1** (10 catalogue entries — 9 modules + Pilotage): `MOD_EAF_ECRIT_ORAL`, `MOD_EAM`,
`MOD_EDS1`, `MOD_EDS2`, `MOD_PHILOSOPHIE`, `MOD_GRAND_ORAL`, `MOD_LVA`, `MOD_LVB`,
`MOD_SPECIALITE_ABANDONNEE`, `SVC_PILOTAGE`.

**DEFERRED_FROM_V1** (10 entries): `MOD_HG_ARIA`, `MOD_ES_ARIA`, `MOD_EMC_ARIA`,
`MOD_EAF_DESCRIPTIF`, `MOD_MATHS_EXPERTES`, `MOD_MATHS_COMPLEMENTAIRES`, `MOD_DGEMC`, `MOD_LCA`,
`SVC_BACS_BLANCS`, `SVC_SECOND_GROUPE` (P11 — still `DIRECTION_A_VALIDER`, never activated).
Full detail: `docs/candidat-individuel/v1-release-scope.md`.

Re-verified at this exact RC HEAD, in the canonical environment:
`__tests__/architecture/t4-v1-release-freeze.test.ts` — 12/12 passing (P11 still blocked, every
deferred element structurally unreachable/unpriceable, zero-price release invariant holds).

## Human recette

`INTERNAL_HUMAN_RECETTE = PASS` (direction decision, T5R6 baseline `feec4a427`) — recorded
verbatim in `docs/candidat-individuel/t5r6-human-recette-pass.md`. Two non-blocking P2
reservations: staff console still technical; a minor "NSI ... NSI" textual redundancy on the
carte d'examen PDF page 3.

## Canonical CI results

See `docs/candidat-individuel/t6-canonical-gate-report.md` for the full investigation. Summary:

```
CANONICAL_PRODUCTION_BUILD = PASS
CANONICAL_UNIT              = PASS (914/914 suites, 10143/10143 tests)
CANONICAL_FULL_TEST_GATE    = PASS (unit + DB integration: 24/24 suites, 320/320 tests)
FINAL_E2E                   = PASS (66/66, Docker, full candidat-individuel campaign)
```

The 27 "pre-existing local failures" carried forward from every prior lot are conclusively
closed: both root causes (the `.worktrees`-path self-detection in
`validate-next-traces.js`/`audit-production-artifact.js`, and a local ancestor-`.env.test`
inheritance masking a missing `NEXTAUTH_URL`) are confirmed to be checkout-location artifacts,
never a real product defect, and disappear entirely in a genuinely canonical (non-worktree,
CI-matching-env) run.

## Security result

See `docs/candidat-individuel/t6-security-audit.md`. Summary: `SECURITY_GATE = PASS`. AUTH,
FAMILY LINK, PUBLIC DATA, EMISSION, INPUT, LOGS checklists all PASS against existing test
evidence plus live verification during T6. Semgrep (CI's own 4 rulesets): 0 blocking findings.
`npm audit`: 0 vulnerabilities. Brace-expansion CVE attestation confirmed still valid (lockfile
digest match).

## Migration result

```
MIGRATION_REQUIRED = YES — 10 new, purely additive migrations (see t6-db-artifact-sbom.md §10)
MIGRATION_AUDIT     = PASS (fresh-DB deploy + full DB-integration suite, both clean)
```

## Backup / restore result

```
BACKUP_PLAN    = PASS
RESTORE_DRILL  = PASS (real drill on the disposable test DB; one documented post-restore
                 follow-up — see t6-db-artifact-sbom.md §11)
```

## Rollback result

```
ROLLBACK_PLAN  = PASS
ROLLBACK_DRILL = PASS (real drill: built + booted the immediate parent release feec4a427
                 against the same DB, health check green)
```

## Config / secrets

Full matrix: `docs/candidat-individuel/v1-config-secrets-matrix.md`. Candidat-individuel V1
introduces **zero new environment variables** — it reuses the existing app-wide contract
entirely. No secret present anywhere in the repo, image, client bundle, or logs (`check-versioned-
credentials.mjs`: 0 findings; `artifact:audit`: no runtime data leaked).

## Public pipeline state

```
PUBLIC_PIPELINE_STATE = LOCKED
```

`pricing.candidatIndividuelPipeline.state` remains `OFF` on every environment this mission has
touched. The admin-config schema (`lib/config/schemas.ts` Invariant 6) additionally makes it
impossible to set `ACTIVE_PUBLIC`/`ACTIVE_PUBLIC_PERCENTAGE` through the normal config path at
all — enabling public activation requires a future, separate code change, never a config write.
Full kill-switch documentation: `docs/candidat-individuel/v1-production-runbook.md`.

## Known P2 debt (non-blocking, carried from T5R6's human recette)

1. Staff console (`CandidatIndividuelWorkspace.tsx`) remains a technical working tool — by
   design for V1 scope, flagged as a future ergonomics improvement.
2. Minor "NSI ... NSI" textual redundancy in one carte d'examen PDF row when `matiere` and
   `libelle` share a prefix without being identical (T5R4 §FINDING_10's exact-match dedup
   doesn't cover this partial case). Cosmetic only.

## Verdict

See the T6 closing message for the full §22 verdict block. This manifest is the authoritative,
committed record of every fact that verdict cites.

**`PUBLIC_RELEASE = NO_GO`. `PRODUCTION_DEPLOYMENT = NOT_AUTHORIZED`.** This manifest documents
readiness for staging — it is not itself an authorization to deploy anywhere.
