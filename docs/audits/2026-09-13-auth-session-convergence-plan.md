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
