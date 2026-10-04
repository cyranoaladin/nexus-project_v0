# Family subscription projections and financial authority

Date: 4 October 2026. Status: NOT_READY; local correction, no production qualification.

The direction's policy denies finance access from family membership alone. Two parent-family endpoints exposed a child's private monthlyPrice, and the dashboard queried ariaCost. Subscription has no explicit payer field; matching a parent, beneficiary, email or public catalogue does not establish financial authority. The safe correction removes those fields at SELECT and response projection, while retaining plan, status, dates and pedagogical information. Own Payment history remains filtered by Payment.userId equal to the authenticated actor.

The parent subscription modal no longer renders private price even from a stale payload. Its accessible description is attached to the dialog. The parent dashboard removes the family-price total rather than showing an invented zero and links to the already scoped invoice page. Public catalogue prices remain public. Payers obtain issued financial documents through the payer/delegation invoice contract; historical subscription prices are not silently reassigned.

Evidence: two API tests failed on exposed monthlyPrice before correction; a component test failed on the stale private price. A separate missing-session-ID regression produced two failures and four successes, then canonical identity checks refuse before querying. Five suites pass 38 tests; typecheck and changed-file lint pass. Read exceptions produce fixed markers with canary tests proving no serialization of private exception detail. Successful family responses use private/no-store. No migration or actual customer data is involved. Static read-only review found no new P0/P1 in the changed projections. Visual/mobile final-SHA qualification remains open.

The separate subscription-requests endpoint still lacks canonical requester identity and exposes other responsible parties' requests. It is an unresolved P1 to fix in the next additive ownership lot; no family/email fallback is acceptable.

Rollback must preserve the restrictive financial projection. Reverting to the old family-price endpoint is not an authorized production fallback.
