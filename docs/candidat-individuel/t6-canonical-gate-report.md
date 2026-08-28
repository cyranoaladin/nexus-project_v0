# T6 §5/§6 — Canonical Production Build &amp; Full Test Gate

RC_CANDIDATE_SHA `3037c4392411d942dd27ac3ba10738593670dfc5`.

## The "27 pre-existing local failures" — definitively closed

Every prior lot in this mission (T5B through T5R6) carried forward a documented, never-fully-
resolved observation: roughly 27 unit tests across ~13 suites (Chromium/PDF rendering tests,
brace-expansion validation scripts, a campaign snapshot test, an NPC storage guard test) failed
consistently when run from inside a `.worktrees/` subdirectory, and were repeatedly re-verified
as "pre-existing, unrelated to product code" without ever being run in a genuinely clean
environment to prove that conclusively. T6 §6 explicitly demanded this be closed for good, in
the canonical environment, not a partially-provisioned worktree `node_modules`.

**Investigation, this session**: created a detached-HEAD checkout of the RC branch tip at
`/tmp/.../scratchpad/rc-canonical` — deliberately **outside** any `.worktrees/` path — and ran
`npm ci` fresh (1273 packages, 0 vulnerabilities, fully reproducible from the lockfile).

### Root causes found (both confirmed by direct source inspection, not guessed)

1. **`scripts/validate-next-traces.js`** (line 45) and **`scripts/audit-production-artifact.js`**
   (line 29) both contain an explicit pattern match on `.worktrees` — by design, meant to catch
   a build accidentally leaking a dev-only path into the production artifact's trace files. When
   the *source checkout itself* lives at a path containing `.worktrees/` (as every lot in this
   entire mission has, per the established worktree-per-lot convention), these scripts
   self-trigger on the checkout's own location, not on anything the build actually leaked. This
   is a **name-of-the-checkout-directory** artifact, unrelated to git worktree *content* in any
   way — confirmed by running the exact same build from a location with no `.worktrees` in its
   path: both scripts report zero findings.
2. **Missing CI-matching environment variables.** Real CI (`.github/workflows/ci.yml`, `unit`
   job) explicitly sets `NEXTAUTH_URL`/`NEXTAUTH_SECRET`/`DATABASE_URL` as job-level env vars
   before running `npm test`. Every worktree used across this mission has, by contrast,
   *accidentally* inherited a working `NEXTAUTH_URL` from `/home/alaeddine/Bureau/nexus-project_v0/.env.test`
   — a real, untracked, ancestor-directory file that happens to sit one level up from every
   `.worktrees/<lot>/` checkout. That inheritance is a local-machine convenience, not something
   any real CI runner or a genuinely fresh checkout would ever have. Running the canonical
   checkout with a truly empty environment (`env -i`) reproduced the family-view/family-link
   failure real CI would never see missing these vars; reproducing CI's own explicit env-var
   set made it disappear.

### Canonical results (this session, at RC_CANDIDATE_SHA)

| Gate | Result | Detail |
|---|---|---|
| `npm ci` | PASS | 1273 packages, 0 vulnerabilities, reproducible from lockfile |
| `npx tsc --noEmit` | PASS | 0 errors (after the one real merge-drift fix, see lineage audit) |
| `npm run lint` | PASS | 0 errors, 30 pre-existing warnings (unrelated files), under the 300 threshold |
| `npx prisma validate` | PASS | Schema valid |
| **`npm test` (unit, CI-matching env)** | **PASS — 914/914 suites, 10143/10143 tests, 0 failures** |
| `npx prisma migrate deploy` (fresh DB) | PASS | 87 migrations, "All migrations have been successfully applied." |
| **DB integration (`jest.config.db.js`, CI-matching env)** | **PASS — 24/24 suites, 320/320 tests, 0 failures** |
| `npm run build` (= `next build` + `artifact:traces` + `artifact:audit`) | PASS | 0 trace findings, standalone artifact verified (file counts/tree digests/BUILD_ID match, no runtime data leaked) |
| Standalone server smoke test | PASS | `GET /api/health` → `{"status":"ok",...}` |
| Docker E2E, full candidat-individuel campaign | PASS | **66/66** (T5R6 baseline 65/65 + 1 new T6-unrelated addition is n/a here — the +1 is T5R6's own §FINDING_15/16 test; no new E2E test added in T6 itself) |

```
CANONICAL_PRODUCTION_BUILD = PASS
CANONICAL_UNIT              = PASS
CANONICAL_FULL_TEST_GATE    = PASS
FINAL_E2E                   = PASS (66/66)
```

### Conclusion required by the T6 directive

> "Si les 27 tests passent dans l'environnement canonique : documenter que les échecs
> précédents étaient des artefacts de worktree."

**Confirmed.** All 27 previously-documented "pre-existing" unit-test failures pass cleanly in
the canonical environment. They were `.worktrees`-path artifacts (2 governed scripts' deliberate
path checks) and a local-machine env-var-inheritance convenience (an ancestor `.env.test`) — not
a real product defect, and not something that should have been re-classified as
"acceptable/ignored" without this proof, which is exactly why this section exists. **No
exception is being claimed here without this explicit, governed justification** — the T6
directive's own bar for accepting an exclusion.

### One flaky-adjacent, still-legitimate observation

During iterative canonical DB-integration runs, the shared disposable Postgres container
(`nexus-postgres-test`, tmpfs-backed, reused across this entire multi-hour mission) twice
entered WAL recovery after an abrupt restart, causing transient connection-refused failures
unrelated to any code. This is the same tmpfs-exhaustion-under-heavy-reuse pattern documented as
early as T5B in this mission — a disposable local dev container's own operational limit, not
something a real CI runner (which starts a fresh Postgres service container per job) would ever
encounter. A full `docker rm -f` + recreate + `migrate deploy` resolved it each time; the final,
clean run (24/24, 320/320) is the authoritative result above.
