# PR235 — authentication and execution evidence qualification

## Context

Qualification starts from remote PR235 head `b842c573795d1f756b565ec065bf7e8367e2b1b4`, based on main `591f1e039943e4a49f44d6d99bbd5585ffa1a57b`. Historical worktrees, unpushed synchronization merges and scratch databases are not qualification evidence. This document records product/test decisions, not the private orchestration lease.

## Proven failures

- Before #263: run `34699553053`, attempt 1, auth job `103568768862` on `6ae5c800`, records parent inscription navigation interrupted by `/dashboard` at 14:45:39 UTC. The subsequent heading-wait commit `c832816` is an ancestor of `72002c3`, whose run `34705027715` / job `103583428174` still timed out in `signInAs` at 16:38:18 UTC. Neither original auth job retained a trace: its upload pointed only at absent `playwright-report/`, and both logs warn that no files matched. The bare historical timeout cannot be assigned a more precise event provenance from those missing traces; later retained traces establish the two concrete mechanisms below.
- PR268 run `34711783408` and PR235 run `34713111857`: WebKit traces show the identifier populated before React hydration, then cleared while the password is entered. No credentials request follows. Server-rendered controlled inputs were interactive before their handlers were installed.
- Original PR267 run `34710697094`, attempt 1, Planning Studio mobile scenario under WebKit: an interrupted client session refresh becomes a null Auth.js session, and an admin dashboard effect redirects while planning navigation is underway. A later green rerun does not resolve this cause.
- The locked Auth.js client catches transport failures and returns null. Its `update()` method restores React state but does not restore the internal session cache used by focus refresh. Recovery must synchronize the existing provider through `getSession()` broadcasting, not add another identity cache.
- The two auth CI invocations wrote the same JSON, JUnit and trace paths. The surviving PR235 report contained only the six Firefox/WebKit records; Chromium execution could not be reconciled from that artifact.
- The ownership script's previous “collected” count was directory membership, not actual Playwright collection.
- A local regression proves that a late parent-dashboard response can replace the new household's data after a same-role identity change.
- Chromium qualification exposed an unread dismissal response: headers arrived in 13 ms but `response.json()` never completed. A controlled probe against the same fresh-stack endpoint produced pending/completed/pending when browser body consumption was disabled/enabled/disabled. The banner now consumes and validates the persisted acknowledgement before hiding; failed writes keep an actionable banner. A generic HTTP probe did not reproduce this endpoint-specific behavior.

## Decisions and implementation sequence

1. Disable sign-in controls in server HTML until hydration installs handlers; test both SSR and hydration, then delay real browser JavaScript deterministically.
2. Confirm a missing client session against the existing database-backed session endpoint before redirecting. Transport, HTTP and malformed-response failures show a neutral unavailable state. Cancel stale requests and bound recovery. Keep server layout/API authorization and revocation unchanged.
3. Key protected dashboard content by session state/identity and abort obsolete data requests. Never show the preceding household during recovery.
4. Remove the golden-family catch/sleep/navigation retry. Preserve traces, but do not print session payloads in diagnostics.
5. Keep public/auth/ARIA reports separate; test the same exact source head, execute the configured mobile auth project, seal reports with source/run/attempt identity, and reconcile their complete spec and test/project records in required CI Success.
6. Restore any unique behavioral coverage lost by PR235 deletions before asserting zero coverage loss. Final-head inventory alone cannot prove this.

## Verification

Local TDD evidence established:

- SSR hydration guard: failing regression, then passing tests.
- Late prior-household response: failing regression, then passing tests.
- Session verification: transport failures, invalid responses, confirmed revocation, late completion, timeout, bounded recovery and role checks.
- Actual installed `SessionProvider`: transport failure, recovery, then focus-triggered real provider revocation. Replacing `getSession()` with `update()` makes this regression fail; restoring canonical provider synchronization passes. A separate regression proves recovery after BFCache restoration.
- Banner acknowledgement, failed writes, successful retry and bounded pending-body cancellation: five failing regressions, then eight passing component tests.
- Report aggregation: missing lanes, partial execution, skipped/expected-failure/fixme records, retries, flaky outcomes, mixed identities, altered reports, duplicate exports and invalid paths are rejected.
- CI contract tests preserve the original ARIA artifact requirements while allowing only the explicitly scoped unified execution export.
- Every selected cross-browser spec/test identity is reconciled against its primary Chromium record. Removing only WebKit's golden file or one test while leaving other WebKit results produces a failing gate; project presence alone is insufficient.

Browser regressions require real credentials and PostgreSQL; only JavaScript delivery or one network request is delayed/aborted. Authentication responses are not mocked. Repeated WebKit runs and existing revocation tests remain required.

The first full unit run after real-provider integration passed 1,188 suites / 13,384 tests and seven snapshots. The subsequent banner change has its own focused RED/GREEN evidence and still requires final browser and exact-head CI qualification. Fresh Node 22.23.1 / lockfile Playwright 1.58.1 / PostgreSQL / Redis / Mailpit were used; no historical dependency symlink or database supplied green evidence.

Pre-push qualification then passed the final production-code build and all 40 targeted Chromium/Firefox/WebKit/mobile scenarios, with retries disabled. Governance checks passed 57 tests. The final local full unit run recorded 13,388 passes and one credential-scanner failure after the new files were indexed; its synthetic literal was replaced with runtime-generated data, and both the scanner and hydration suite passed all six focused tests afterwards. That historical full-run report remains red, not relabelled green. Full exact-head CI and repeated WebKit qualification remain required.

### Deleted-spec behavioral reconciliation

- Canonical parent and student booking, cancellation, released-slot reuse, and unchanged zero credits are restored in the golden-family flow with synthetic-series cleanup.
- Banner dismissal is verified against server persistence and reload, never localStorage authority.
- Failed sign-in transport verifies actionable feedback, retry availability and an absent server session. The route matcher accounts for Auth.js's empty query marker.
- Account and recovery-return links navigate to usable real destinations.
- PR187's remaining rename changes only a filename/describe label; assertions are equivalent. It remains open until PR235 lands.

The held-navigation regression observes the old document through a preinstalled mutation observer: new protocol evaluations themselves block during held Chromium navigation. This avoids an engine-specific test deadlock without weakening the requirement to observe the null-session render before releasing navigation.

### Second-pass restoration and aggregate correction

The full CI run `34717135928`, attempt 1, on `6c2cc32c169edfc759b3b2bc2e542323604f5f50` passed its 40 producer jobs, including 1,188 unit suites / 13,389 tests. Its required CI Success job failed: the new aggregate identity omitted ancestor `describe` titles and consequently classified legitimate parameterized cases as duplicate records. This run remains failed.

The correction preserves complete nested title paths, source coordinates and project identity using structured serialization. Regressions first demonstrated both false duplicate detection and an omitted WebKit parameter hidden by another parameter with the same leaf title. All 18 aggregate tests then passed, including genuine duplicate rejection; the complete governance suite passed 16 suites / 135 tests. Diagnostic replay of the seven unchanged sealed reports reconciled 122 tracked / 122 collected / 122 executed spec files and 941 test records, with no problems. This replay is not CI evidence for the subsequent commit.

Review of all 14 deleted specs identified seven remaining distinctions, now restored in retained suites:

- Empty sign-in requires both fields before issuing a credentials request.
- A loaded coach dashboard exposes no student/parent booking action.
- Every forbidden role destination returns to that role's exact dashboard, including admin-to-parent denial; navigation errors are not swallowed.
- A known account's wrong password waits for the real callback, displays the credentials error and leaves the server session absent.
- `/conditions` redirects to `/conditions-generales` with 307; permanent aliases assert their actual configured 308 status.
- Both final homepage CTA links are visible and preserve their distinct diagnostic/adviser destinations.
- Canonical duplicate booking and cancellation preserve a nonzero historical credit balance as well as the zero-credit flow.

Local restoration qualification initially recorded 32 passing and five failing RBAC cases. Retained traces and the locked Next.js URL implementation prove that a `127.0.0.1` request was normalized to `localhost` in the authorized callback redirect, losing the browser's host-scoped cookie. Aligning the private server auth URL and browser origin to `localhost` passed all 37 auth cases without changing the strict destination assertions. The 16 homepage cases also passed using the lockfile's bundled Chromium; canonical Chrome execution still requires the next full CI run. The 16 configured Firefox/WebKit/mobile auth cases passed with zero skips, failures or retries. TypeScript and the zero-test-debt scanner passed. Independent read-only review found no actionable issues in this batch. No production application source changed in this restoration batch.

## Remaining release gates

This document is not a green CI claim. Complete browser execution, deletion-coverage reconciliation, full exact-head CI, final machine-derived counts, updated PR body and fresh exact-head owner approval are required before merging. No fixed historical count (115 or 121) is authoritative.

## Rollback

These changes introduce no schema migration or production mutation. Reverting the eventual qualification commit restores prior behavior, including the documented races and evidence gaps; such a revert invalidates go-live qualification and requires a new candidate.
