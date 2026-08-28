# T6 §9 — V1 Candidat Individuel Security Audit

RC_CANDIDATE_SHA `3037c4392411d942dd27ac3ba10738593670dfc5`. Not a security redesign — a
verification pass against the checklist the T6 directive names, using existing governed tooling
plus the extensive test suites already built across T1-T5R6.

## AUTH

| Check | Result | Evidence |
|---|---|---|
| Staff routes protected | PASS | `requireInternalPipelineAccess()`/`requireAnyRole` gate every `/api/assistante/candidat-individuel/*` route; live-verified during T6: `GET /api/assistante/candidat-individuel/profils` with no session → `401` |
| Roles required (ADMIN/ASSISTANTE) | PASS | `__tests__/api/assistante.candidat-individuel.route.test.ts` ("every route — non ADMIN/ASSISTANTE role is rejected") |
| Anonymous denied | PASS | Live-verified `401`/`307` above; `__tests__/database/t5r2-family-link.test.ts` test E ("unauthenticated caller cannot issue a family link") |
| Unauthorized (wrong role) denied | PASS | Same T5R2 test: authenticated PARENT gets `403` on the same endpoint |

## FAMILY LINK

| Check | Result | Evidence |
|---|---|---|
| Raw token never persisted | PASS | `lib/quotes/persistence.server.ts::issueOrRotateFamilyLink` stores only `hashToken(rawToken)`; T5R2 test H: DB row serialization never contains the raw token |
| Hash only in DB/audit | PASS | Same T5R2 test H/I: `quote_audit_logs` never contains the raw token either |
| Rotation invalidates the old link | PASS | T5R2 test G: rotating issues `LINK_ROTATED`, old token's own family view returns `404` immediately after |
| Random/forged token denied | PASS | T5R2 test: a 64-char-random token → `404`; live-verified during T6 smoke test |
| `quoteId` alone insufficient | PASS | T5R2 test: knowing a real `quoteId` without the token cannot resolve the family view (the view is keyed by the token hash, not the id) |

## PUBLIC DATA

| Check | Result | Evidence |
|---|---|---|
| No margin/costPolicy/diagnostic leak | PASS | `app/api/quotes/public/[token]/route.ts`'s explicit allow-list projection (never spreads the raw `Quote` row); `__tests__/api/quotes.public-token.route.test.ts` asserts `idempotencykey`/`createdbyuserid`/`teachercost`/`margin` absent from the serialized response |
| No raw token in the family-facing payload/page | PASS | Family HTML page never renders its own link (confirmed throughout T5R2-T5R6 E2E screenshots); JSON route never echoes the token |
| No stack traces | PASS | Every candidat-individuel route returns structured `{error, reasons?}` JSON on failure, never a raw exception — confirmed by reading every route handler's catch path |
| No internal reasoning/secrets (T5R5/T5R6's own findings) | PASS | `QuoteLine.reason` (pricing-engine internals) stripped from both family surfaces (T5R5 §FINDING_12); raw generic catalogue subject labels replaced with humanized names (T5R6 §FINDING_15); the abandoned-specialty warning reworded to drop an ambiguous regulatory claim (T5R6 §FINDING_16) — all three re-verified in this session's own canonical DB-integration run |

## EMISSION (regulatory/commercial gates)

| Check | Result | Evidence |
|---|---|---|
| `BLOCKED` (margin) never publishable | PASS | `lib/quotes/emission-guard.ts::collectQuotePromotionBlockers`; `__tests__/lib/quotes/emission-guard.test.ts` |
| `GROUP_PENDING` never publishable | PASS | Same guard, same test file |
| P3 (bac accéléré) never publishable | PASS | `__tests__/architecture/t4-v1-release-freeze.test.ts` — re-run clean in this T6 canonical pass |
| `DEFERRED_FROM_V1` element never reachable/priced | PASS | Same T4 freeze suite, 12/12 passing at RC HEAD (re-verified during T6, see the canonical gate report) |
| Family-visible Quote requires identity (T5R5's own new invariant) | PASS | `collectQuotePromotionBlockers`/`collectFamilyLinkIssuanceBlockers` now also require `contactLeadId`+`studentId`; `__tests__/database/t5r5-final-operational-closeout.test.ts` R1 test proves both the missing-identity refusal (422) and the present-identity success |

## INPUT

| Check | Result | Evidence |
|---|---|---|
| Server-side schemas on every mutating route | PASS | `lib/quotes/candidat-individuel-api-schemas.ts` (zod, `.strict()`) — every route parses through it before touching persistence |
| Invalid headcount rejected | PASS | `parseConfirmedHeadcountBySubject` rejects non-positive-integer values server-side (never trusts the client's own parse); T3A test suite |
| Forged/unknown IDs | PASS | `lib/exams/normalize.ts` rejects an unknown option/subject code outright (`INVALID`), never silently dropped (T4 freeze test: "an unknown option code is rejected outright") |
| Malformed payload | PASS | zod `.strict()` schemas reject unexpected/malformed shapes with a structured 400, never a 500 (confirmed across the whole `__tests__/api/assistante.candidat-individuel.route.test.ts` suite: "400 on malformed body") |

## LOGS

| Check | Result | Evidence |
|---|---|---|
| Raw token absent from logs | PASS | The app's structured pino logger only ever logs `[AUTH] Login success` with `role`/`env` fields (observed across every E2E run this whole mission) — no route logs the family-link token; the token only ever appears in the one-time JSON response to the issuing staff member |
| Credentials absent from logs | PASS | Same logger convention; no route logs `NEXTAUTH_SECRET`/`DATABASE_URL`/etc. |
| PII minimized per existing architecture | PASS (no new PII surface introduced) | Candidat-individuel logs are the same `[AUTH]`-prefixed shape as the rest of the app; no new logging call was added by this feature that includes a name/email — the family view/PDF display real names, but that's the intended, gated (token-required) audience, not a log |

## DEPENDENCIES

- `npm audit` (prod + full): **0 vulnerabilities**, at the RC HEAD's exact `package-lock.json`.
- **Semgrep** (`p/security-audit`, `p/secrets`, `p/typescript`, `p/nextjs` — the same 4 rulesets
  CI's own `security` job uses), run against the full RC tree: **7 findings, 0 blocking**
  (CI's own classification logic: secrets=0, ERROR-severity=0, CRITICAL/HIGH-impact=0 among
  blocking paths). The 2 non-test findings are both `dangerouslySetInnerHTML` WARNING-severity
  in an unrelated marketing component (`components/marketing/LandingNiche.tsx`), pre-existing,
  never touched by this mission.
- **OSV Scanner**: not run directly in this local audit (the binary isn't installed in this
  environment and downloading a new external binary was intentionally avoided rather than
  fetched ad hoc) — CI's own `security` job runs it on every push/PR and must still gate any
  real merge to `main`. Substituted evidence: `npm audit` (0 vulnerabilities) plus the existing,
  currently-valid `security/brace-expansion-backport-attestation.json` — its recorded
  `PACKAGE_LOCK_SHA256` (`3659d1eb...`) matches this RC's own lockfile digest exactly (see the
  release manifest), confirming the dependency tree is byte-identical to when that exception was
  last verified and remains valid; the attestation's own note already flags that a live OSV scan
  on 2026-08-23 found 0 brace-expansion matches, so the exception may even be retirable —
  documented for the next maintainer, not acted on here (no dependency changes are in this T6
  lot's scope).

```
SECURITY_GATE = PASS
```
