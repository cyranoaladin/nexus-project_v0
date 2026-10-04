# Confirmed logout navigation ownership

Date: 2026-10-04. Browser qualification is still pending.

The protected observation boundary and explicit logout hook both called router.replace after the same confirmed logout. The boundary also navigated when the caller explicitly requested redirect:false. Two tests using the installed, unmocked Auth.js SessionProvider reproduce those defects: both failed before correction, with six existing provider cases passing.

The canonical recovery controller now grants a single navigation claim per confirmed retirement. Both consumers share that claim; explicit redirect:false suppresses automatic logout navigation without revealing a retired protected shell. Server revocation retains automatic sign-in navigation, and public-page logout still works. Failed or unconfirmed logout never acquires a claim. No server authority or permission was changed.

Five real-provider/controller/UI neighbor suites pass: 49 tests. Full typecheck, changed-file lint, diff check and redacted secret scan pass. The canonical unit config is required for the unmocked ESM dependency; an initial attempt with jest.config.js failed before executing tests and is not evidence.

On remote b063036d5, auth Chromium has 527 passes and one timeout in parent-email-onboarding.spec.ts, at the final logout navigation wait (lines 155/290). This source fix addresses independently reproduced duplicate navigation; it does not establish the complete causal link or close that browser failure. No timeout, assertion, retry or browser project was relaxed. Rollback is an isolated reviewed application revert.

Review follow-up, 2026-10-04: the confirmed boundary now announces only “Session terminée.”, since redirect:false intentionally does not navigate. The strengthened installed-provider test fails twice before the text correction (six existing cases pass), then all eight provider cases pass. The navigation-count and redirect:false assertions remain intact. No change to the logout authority or routing contract.
