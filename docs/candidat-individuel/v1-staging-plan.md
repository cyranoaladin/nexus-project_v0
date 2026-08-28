# V1 Candidat Individuel — Staging Plan (T7 preparation, not executed)

Prepared during T6. **Nothing in this document is executed by T6** — no staging deploy happens
until a separate, explicitly-authorized T7.

| Field | Value |
|---|---|
| SHA to deploy | `3037c4392411d942dd27ac3ba10738593670dfc5` (`RC_CANDIDATE_SHA`) |
| Artifact/digest | `STANDALONE_STATIC_TREE_SHA256 = 195393a5a56be0351398a1083228e399ce8f79d061719dee7e4659095334aa5b` (see `t6-db-artifact-sbom.md` §12 for the full manifest) |
| Env vars required | Full matrix in `v1-config-secrets-matrix.md` — every REQUIRED row, plus RECOMMENDED for full functionality (SMTP for family-link-adjacent email) |
| Secret provisioning | Owner: Infra/Deploy (per the matrix's `PROVISIONING_OWNER` column) — no secret exists in this repo or its history (`check-versioned-credentials.mjs`: 0 findings) |
| DB target | A staging Postgres instance, `docker-compose.prod.yml`'s `migrate` service applies the same 10 candidat-individuel migrations (plus the rest of the 87) — never the production DB directly |
| Staging URL | Not yet assigned (Infra/Deploy to provision; must be set as `NEXTAUTH_URL`/`NEXT_PUBLIC_APP_URL` before boot, or the app fails closed — reproduced live during T6) |
| Public state expected | `pricing.candidatIndividuelPipeline.state = OFF` or `ACTIVE_INTERNAL` at most — **never** `ACTIVE_PUBLIC*` (schema-level block, see the runbook's Kill Switch section) |
| Smoke tests | Same 4-point check performed during T6 (`v1-production-runbook.md` §6): `/api/health`, staff route unauth → 401, staff page unauth → 307, public family route with a bogus token → 404. Add a real ADMIN/ASSISTANTE sign-in + workspace load once credentials exist for that environment. |
| Recette minimale staging | A real staff → create profil → simulate → create Quote → publish → issue family link → open the family view in a separate context → download the PDF walkthrough, mirroring `e2e/auth/candidat-individuel-pipeline.spec.ts`'s own T5R5 §6 / T5R6 test exactly, but against the staging URL instead of the Docker E2E stack |
| Rollback (staging) | Identical mechanism to production (`v1-production-runbook.md` §Rollback) — redeploy the previous staging SHA, no DB action needed (this RC introduces no destructive migration) |

## Explicitly not done in T6

- No staging deploy.
- No registry push.
- No DNS/URL provisioning.
- No secret generation for a staging environment.

T7 (or whichever lot direction opens next) should consume this plan directly rather than
re-deriving it — the SHA, digest, and env matrix are already fixed by T6.
