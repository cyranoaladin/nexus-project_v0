# Canonical session recovery implementation plan

> Parent orchestrator executes with `superpowers:executing-plans`; subagents only inspect/review. Owner's explicit 2026-09-13 policy is approved; no further brainstorming gate.

**Goal:** one shared extraction of #235 recovery, no redirect from uncertainty, preserved drafts, canonical server authorization unchanged.

**Architecture:** the existing Auth.js SessionProvider remains the only provider cache. One recovery controller verifies its observations using `/api/auth/session`, synchronizes it using the proven `getSession()` broadcast, and exposes distinct recovery and stable display snapshots. Display identity is not authorization: mutations are suspended while verification is uncertain. Protected boundaries retain mounted children during recovery and retire identity-bound state on confirmed invalidity/identity change. No video timers, disposal logic, room changes or product policy are introduced.

**Stack:** Next.js/React, locked Auth.js, TypeScript AST, Jest, real PostgreSQL/Redis/Mailpit and Playwright.

## Chunk 1: canonical observation and server contract

- [ ] Baseline: fresh `npm ci`; run `npm test -- --runInBand __tests__/auth/verified-session.test.tsx __tests__/auth/verified-session-provider.test.tsx`.
- [ ] RED: shared consumers retain identical display snapshot and draft through abort, 10-second UNAVAILABLE and recovery; no mutation or redirect; old responses ignored; StrictMode/BFCache retry; explicit logout; same-role identity change. Add `__tests__/auth/session-recovery.test.tsx` and controller tests.
- [ ] GREEN: extract the fetch/deadline/generation/getSession pattern from `hooks/use-verified-session.ts` into `lib/auth/client-session-recovery.ts`, with one React owner `components/auth/SessionRecoveryProvider.tsx`; make existing hook a thin consumer. `LOADING/AUTHENTICATED/RECOVERING/UNAVAILABLE/UNAUTHENTICATED_CONFIRMED/REVOKED_CONFIRMED` describe observations, not AccountStatus.
- [ ] RED: actual installed Auth.js must not convert authority-database outage into200null plus cookie deletion; concurrent request outcomes isolated.
- [ ] GREEN: request-local unavailable outcome around the same canonical validation/invocation, generic503/no-store and no emitted cookies on unavailable. Keep invalid tokens/version/account denial fail-closed. Record exact Core252 synchronization requirement without touching that branch.
- [ ] Review and run targeted tests/typecheck before committing.

## Chunk 2: protected consumers and mutation/draft preservation

- [ ] Generate reviewed machine-readable inventory with PATH, ROLE, raw behavior, mutation/draft flags and migrated status; reconcile all dashboard modules and other protected surfaces, preserving public-token semantics.
- [ ] RED: real page/child form survives cache failure, retry remains accessible in a modal, sensitive controls and autosave are paused, confirmed invalidity removes protected content; old identity cannot affect new owner's storage or requests.
- [ ] GREEN: mount shared boundaries; migrate raw session capability imports and explicit logout to thin canonical consumers. Preserve server role guards, API permissions and destinations. Stable display subscriptions must not remount/reinitialize forms during phase changes. Remove #235's phase-keyed subtree replacement.
- [ ] Guard buttons/portals and programmatic mutations through shared state; cancellation/generation protection for EAM/NSI and pending chains. Never replay ambiguous business writes. Preserve all existing video behavior; only shared session observation where required.
- [ ] RED/GREEN AST capability boundary in `__tests__/architecture`: reject raw Auth.js session capabilities outside exact owner, including aliases/namespaces/reexports/dynamic imports; permit server auth and public sign-in links. Reconcile inventory to live source, no UNKNOWN.
- [ ] Run all affected component and architecture tests, then full unit/typecheck/lint. Investigate failures, no suppression.

## Chunk 3: real execution and exact-head landing

- [ ] Add real-session abort/hydration, >10s unavailable with draft, recovery, logout and revoked-session browser regressions to owned auth lane; retain ARIA entitlement checks separately.
- [ ] Fresh uniquely-owned disposable services and fresh dependencies/build; Chromium, Firefox and WebKit, retries0. Five exact WebKit cycles on historical interrupted-refresh/navigation path.
- [ ] Read-only independent review; address findings in sequence. Commit/push one convergence PR from currentmain; do not resync267.
- [ ] Full CI and seven-report exact-head/run/attempt/hash reconciliation; TRACKED=COLLECTED=EXECUTED, no orphans/skips/retries.
- [ ] Request fresh exact-head CODEOWNER approval only after evidence is complete; at most one armed PR. Merge then synchronize267 once against actualmain.

## Evidence and operational boundaries

Post-235 workflow run34742412126 was subsequently verified completed/success, with all41 exposed jobs successful: POST_235_MAIN_CI=PASS. Main remains4ab66223dc9e822ffea1f0b550e91b8194b026e6. Historical worktrees/volumes are not qualification environments. No production writes, no schema migration, no parallel writer, no raw credentials in artifacts.

## Implementation and regression checkpoint

Implemented one policy controller with React and generated Planning DOM projections. The machine-readable inventory covers93 Next page modules and the protected static Planning document. Static E2E ownership currently reports122 tracked/owned specs,0 orphans and0 exclusions; this is not an execution claim.

RED/GREEN evidence covers the installed Auth.js provider and encrypted-session handler, transport abort/failure, canonical outage without cookie deletion, revocation, whole-operation logout timeout, public reset/logout provider refresh, protected-route initial reads, retained modal nodes, identity-owned Maths/NSI/report storage, deferred writes without replay, Planning bootstrap/confirmation retirement, real response-body generation checks and truthful mutation results. Local microphone shutdown remains available during uncertainty; its recording stays local until an explicit authorized deposit. No video behavior changes or new timing policy.

Qualification uses newly created PostgreSQL/Redis/Mailpit services, an empty database verified before migrations,16 verified synthetic identities and a local ARIA fixture provider. No historical scratch database or cross-worktree dependency symlink is used. Browser qualification and full exact-head CI remain pending; none of this checkpoint grants go-live approval.

The trace-audit regression distinguishes the checkout's hosting `.worktrees` directory from forbidden embedded or external worktree content. Secrets and unsafe content remain rejected.

## Independent review corrections and resumed qualification

The post-merge workflow was checked once again on resumption: runs 34742412126 (CI Pipeline), 34742412101 (documents), and 34742411481 (Push on main) are completed/success on the requested main SHA. `POST_235_MAIN_CI=PASS`.

Independent review found and reproduced three defects before qualification:

- The inherited ten-second deadline aborted pending canonical verification. Two RED cases now require accepting a valid or revoked response arriving after eleven seconds without retry. The deadline now only publishes `UNAVAILABLE`.
- Logout used the same deadline to discard late confirmation. RED/GREEN cases cover slow signout, slow confirmation, and explicit verification retry without replaying the logout mutation. Late authoritative absence ends the session; elapsed time alone does not.
- Planning retained a disabled save button after recovery interrupted an in-flight save. The regression checks actual DOM controls as well as the retained draft and rejected late success. Only save chrome refreshes after recovery; the editor remains mounted.

The AST guard additionally rejects session endpoint query strings, templates and URL construction, and canonical-null redirects that do not exclude `LOADING`. It scans authored Planning JavaScript. All inventory roles now resolve to actual role values, with source references for ownership-scoped pages and aliases.

The resumed local qualification uses a new r2 disposable service project after the machine restart. The empty database was verified before migrations and seeding. Earlier artifacts are not relabelled as evidence for this candidate. The current source has 122 tracked/owned E2E specs and zero orphans; execution reconciliation remains a separate gate.

The first resumed full unit run is retained as failed: 1,198 suites / 13,499 tests passed, one test failed because its inherited expectation still required aborting verification at ten seconds. That expectation was changed to require an active request, consistent with the newly demonstrated late-valid/late-revoked cases. The first local browser attempt also remains failed: disposable Redis hostname resolution prevented login. The temporary harness supplies an alias only for its own Redis process; later diagnostic reports use different labels and zero retries.

A further review regression reproduces protected-to-protected navigation where NSI/EAM initial progression hydration ran before the new route had been verified and never resumed. Their initial reads now subscribe to verification readiness, with an owner guard that prevents completed hydration from reloading drafts on later recovery.

The real browser diagnostic also reproduced an inaccessible retry button when the recovery notice made a fixed centered modal exceed the viewport. The shared dialog is now height-bounded and scrollable; the existing real click regression qualifies the correction without forced clicks. NSI hydration additionally merges the current owner-scoped draft after the GET returns, preserving edits made while that read was pending. The commit credential scanner rejected a synthetic literal in the new encrypted-handler test; its key is now generated at runtime instead of weakening the scanner.

Follow-up measured geometry corrected the initial modal hypothesis: the coaches dialog already had its own 90vh limit. On a 1280×720 viewport its actual y was -288 and height 648; computed CSS `translate: -50% -50%` combined with Motion `transform: translateY(-324px)`. Tailwind 4 individual translation and Motion doubled vertical centering. Motion now owns both x/y transforms; CSS no longer adds a second translation. Browser regressions additionally assert the dialog stays within the viewport. The height-only candidate is not treated as a successful correction.

The next exact-head browser run, r4 on `4e0d6dab1eaf56befd2513ac50d9d424ebef8ad3`, executed 56 cases with zero retries: 55 passed and one failed. All 42 Chromium/Firefox/WebKit cases passed, including both modal recovery paths. The mobile Planning case retained its draft and suspended actions but could not click the global retry button: the open fixed editor drawer intercepted it. The correction projects the existing controller's notice into the editor itself, just as for existing modal surfaces, and scopes the real-browser retry to that editor. No drawer is dismissed and no draft node is replaced. The r4 failure remains recorded; it is not a flaky-pass classification.

On `5c36b3cc450a372e3fad625ca6b32b1eacd0b2a3`, local r5 passed all 56 lifecycle cases across four projects and the separate five WebKit historical-path plus golden-family cycles passed all 10 cases, with zero retries/skips/flakes. CI passed 1,200 unit suites / 13,538 tests / 7 snapshots and its production build. Its public E2E lane nevertheless failed three of 379 cases: the dashboard audit sampled body text/navigation immediately after URL arrival, during `LOADING`. CI traces show the correct authenticated dashboard appearing immediately afterward (one navigation snapshot transitions within 28ms); this is not a signin redirect. A deterministic regression holds a real canonical-session response and demonstrates that the old helper resolves prematurely. The test-only correction requires positive authenticated and role-specific visible content, replacing instant body/count/optional-fallback snapshots. That owned file passes all 11 cases without retry after the correction. The earlier CI public-lane failure remains recorded, and a new exact-head full CI is required.

The same CI's Chromium auth lane executed 503 cases: 497 passed and six failed. Five failures were H1/specialty snapshots during `LOADING`; their tests now await the real role content, audit images only after rendering, and open the actual EDS Parcours view before checking specialties or absent STMG content. The strengthened one-main audit then reproduced two nested main landmarks on the coach home; the page's inner main becomes a div, preserving the layout-owned main and every style/content node. The failing audit is retained as RED until the rebuilt artifact is checked.

The sixth failure was a six-millisecond `ECONNRESET` on the test helper's GET `/api/auth/session`, not an HTTP authentication decision. Its existing bounded observation loop previously handled missing/invalid responses but let that transport exception escape. Only that reset of this read-only GET now consumes an observation from the same budget; credentials, activation and business mutations are never replayed. Tests use the installed Playwright APIRequestContext against a real HTTP server that resets its socket: reset then wrong then expected identity succeeds, while persistent resets, absent/wrong identity, or a non-transport programming error fail. No Playwright test retry was added, and the failed CI run is not relabelled as passing.

Candidate `b6b3e3297a78e3c2faf8a5ad95ba8c422230212a` then passed all 96 targeted/local browser cases and CI's 1,201 unit suites / 13,543 tests / 7 snapshots. Its full public CI lane failed one of 380 cases: the new readiness regression made the later admin console audit the sixth login attempt within the shared five-attempt identity quota. Sanitized trace comparison confirmed submitted credentials matched the filled fields; a read-only inspection of the disposable counter confirmed six attempts. Running the preceding signin suite plus the dashboard suite reproduced 21/22 passes and the same quota refusal. The correction uses the existing fail-closed disposable Redis cleanup before each independent dashboard audit; the public CI lane receives the same dedicated service alias and reset URL already used by the auth lane. Its single-worker execution prevents cross-test cleanup races. Production authorization, quota thresholds, test selections, timeouts and retry settings remain unchanged. The same 22-case sequence then passed without retry, and a parsed-workflow bootstrap regression protects the dedicated Redis target and setup ordering. The failed CI run remains recorded and must be replaced by a fresh exact-head full CI.

The same candidate's auth Chromium CI lane passed 502/503 cases and failed the logout contract before any click or signout request. The trace shows its four immediate `isVisible()` snapshots during `LOADING`, with parent content appearing 134ms after navigation. Holding an observed real canonical session request reproduces `clicked=false`. The corrected test waits for verified parent content, clicks the actual logout button, requires exactly one UI signout POST and a successful canonical-null response, then checks the product's home destination and real protected-route rejection/signin navigation. The old helper's second signout and forced cookie clearing are removed so they cannot mask failure of the UI action. The complete RBAC spec passes 11/11 with zero retries, including the explicit intercepted-request signal before releasing verification. Independent source review confirms the stronger result checks. This is corrective evidence, not a relabelling of the failed CI candidate.

The bounded neighboring-spec review found one further false positive in the admin creation-form audit: an immediate optional `isVisible()` branch could pass without clicking anything during `LOADING`. A held and observed real session request proves that skipped interaction in RED. The test now unconditionally waits for authenticated observation, clicks the exact creation button and requires the named dialog, email field and submit control; it does not submit a new user. The complete six-case spec passes with zero retries/skips/flakes. Independent source review found no remaining actionable issue in either corrected spec. The batch also passes 18 bootstrap/ownership tests, 28 execution-evidence/workflow tests and 80 session architecture/server-outcome tests. Full exact-head CI remains required.

## Core v2 integration contract for #252

Current main does not contain Core v2 authentication modes or `AccountStatus` session enforcement. Scenario E (real SUSPENDED/DISABLED account lifecycle) is `NOT_PRESENT_ON_BASE`; it is not represented as an executed real lifecycle test. The client has no User lookup, rollout mode, account-status enum, or independent account authority. Its session identity comparison retains opaque server authority claims.

Read-only inspection of #252 head `ec4121d56453b795b796c6e45241ea92b8a9ae84` found four validator catches that return null on exceptions (mode, Core v2 validation, ownership lookup and V1 lookup). During integration each must preserve the request-local unavailable marker before returning or rethrowing; Auth.js can otherwise translate even thrown callback errors into null plus cookie deletion. Positive lifecycle denial must remain distinct from infrastructure failure.

Required #252 qualification, before accepting that integration:

- V1_ONLY accepts valid V1 and rejects Core v2 tokens without consulting Core v2.
- HYBRID ownership failure yields 503 without cookie changes or legacy fallback; a migrated V1 identity is authoritatively rejected.
- HYBRID/V2_ONLY authority outages yield 503 with unchanged cookies; the same credential recovers when available.
- SUSPENDED, DISABLED, sessionVersion mismatch and role mismatch yield authoritative denial through the same session path.
- Concurrent valid and unavailable requests remain isolated, and browser scenario E runs against the actual lifecycle in all three engines.

This prerequisite is recorded for the ordered integration; #252 and #267 have not been modified or resynchronized by this convergence work.
