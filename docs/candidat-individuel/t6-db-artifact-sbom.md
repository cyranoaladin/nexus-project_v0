# T6 §10/§12/§13 — DB/Migrations, Immutable Artifact, SBOM

RC_CANDIDATE_SHA `3037c4392411d942dd27ac3ba10738593670dfc5`.

## §10 — DB / Prisma / Migrations

**Correction to a prior lot's claim**: earlier audits stated "zero migrations T1-T4" — true for
that narrower window, but T6 was asked to reconfirm *up to T6*, and the honest answer for the
full lineage differs:

```
MIGRATION_REQUIRED = YES — 10 new migration files, relative to merge-base b59075c99
```

| Migration | Purpose |
|---|---|
| `20260824090000_add_profil_candidat` | `ProfilCandidat` model |
| `20260824093000_add_parcours_type` | `ParcoursType` enum |
| `20260825080000_add_quote_deposit_columns` | D4 pricing (deposit/lastInstallmentAmount) |
| `20260825100000_add_profil_lot3_fields` | Profil Lot 3 fields |
| `20260826070000_add_dispenses_declarees` | Staff-declared dispenses |
| `20260826080000_add_quote_regulatory_maturity` | `regulatoryMaturity` (T5R publication gate) |
| `20260826090000_add_shadow_comparison_log` | Shadow-mode comparison logging |
| `20260826100000_add_p3_eligibilite_audit` | P3 eligibility audit trail |
| `20260826110000_add_profil_candidat_review_revision` | Profil review/revision workflow |
| `20260826162643_add_quote_payment_policy` | `paymentPolicy` column |

All 10 verified **purely additive** — `grep -iE '^\s*(DROP|ALTER TABLE.*DROP|TRUNCATE)'` against
every one of the 10 `migration.sql` files: zero matches. No column/table/enum removal anywhere
in this lineage's own migrations.

**Fresh-DB test, performed during T6** (not assumed, executed):

```
fresh DB (docker rm -f + recreate the disposable Postgres container)
→ npx prisma migrate deploy   → "All migrations have been successfully applied." (87 total)
→ npx prisma validate         → "The schema at prisma/schema.prisma is valid"
→ full DB-integration suite   → 24/24 suites, 320/320 tests, PASS
```

```
MIGRATION_AUDIT = PASS
```

No production migration was run — every migration above was applied only to the disposable,
tmpfs-backed test Postgres container used throughout this whole mission (`docker-compose.test.yml`),
never to a real database.

## §11 — Backup / Restore (see also `v1-production-runbook.md` §2)

Real drill performed on the disposable test database:

1. Inserted a distinguishable marker row (`contact_leads`).
2. `pg_dump -F c` → 785 TOC entries, readable via `pg_restore --list`.
3. Deleted the marker row (simulated loss) — confirmed gone.
4. `pg_restore --clean --if-exists --no-owner` → marker row confirmed restored.
5. One real nuance found: `--clean`'s drop/recreate ordering left one functional index
   (`users_household_name_key_idx`, which depends on a custom SQL function) not recreated —
   fixed by re-applying `prisma/migrations/20260813100000_add_household_name_key_index/migration.sql`
   directly. **Documented as a required post-restore verification step in the runbook.**

```
BACKUP_PLAN = PASS
RESTORE_DRILL = PASS
```

## §12 — Immutable Artifact

Built via the canonical, non-worktree production build chain (`npm run build`, matching
`Dockerfile.prod`'s builder stage and CI's own `build` job) — see
`docs/candidat-individuel/t6-canonical-gate-report.md` for why a worktree-path build was
avoided for this step.

```
RC_CANDIDATE_SHA           = 3037c4392411d942dd27ac3ba10738593670dfc5
BUILD_ID                   = oFDr870ki-Y_Hic1Zk3k4
NODE_VERSION                = v22.22.0
NPM_VERSION                 = 10.9.8
NEXT_VERSION                 = 15.5.21
SOURCE_STATIC_FILE_COUNT   = 581
STANDALONE_STATIC_FILE_COUNT = 581
SOURCE_STATIC_TREE_SHA256   = 195393a5a56be0351398a1083228e399ce8f79d061719dee7e4659095334aa5b
STANDALONE_STATIC_TREE_SHA256 = 195393a5a56be0351398a1083228e399ce8f79d061719dee7e4659095334aa5b
PACKAGE_LOCK_SHA256          = 3659d1ebe6cd8e70732bd2b8e0b39ff0d18748b54667448991c64c26a2d5f300
GATE_SCRIPT_SHA256            = fc6849cd6d28f80db5e6851bd94625437c5c8cdbe5ba95c47f9fd5bd5d1cf010
ARTIFACT_VERIFIED            = true (npm run artifact:audit: file counts match, tree digests
                                match, BUILD_ID match, no runtime data leaked)
```

The full JSON is committed at `release-manifest.json` (repo root, at this RC HEAD).

Reconstructibility: the artifact is fully reconstructible from Git alone — `git checkout
3037c4392411d942dd27ac3ba10738593670dfc5 && npm ci && npx prisma generate && npm run build`
from a location outside any `.worktrees/` directory reproduces the exact same
`STANDALONE_STATIC_TREE_SHA256` (deterministic given identical `package-lock.json` and Node/npm
pins — the manifest records those pins for exactly this reason).

**No image pushed to any registry during T6** — per the T6 directive's explicit "NO REGISTRY
PUSH" instruction (§21). The artifact exists only as the built `.next/standalone/` output in the
local canonical build location used for this audit, and is reproducible on demand from Git.

## §13 — SBOM / Dependency Inventory

The repo has no dedicated SBOM tool; the reproducible, hash-pinned `package-lock.json` (digest
above) is the existing, already-governed inventory mechanism — every dependency's exact resolved
version and integrity hash is recorded there, and `npm ci` refuses to install anything that
doesn't match it exactly (confirmed: `npm ci` at the RC HEAD installed 1273 packages with
`0 vulnerabilities`, deterministically, from this exact lockfile). No new SBOM system was built
for T6 — the directive explicitly asked not to build heavy new infrastructure just to check a
box, and this repo's existing lockfile-based reproducibility already satisfies the same goal
(exact dependency graph, byte-verifiable, already used as the authority for the
brace-expansion CVE attestation itself).
