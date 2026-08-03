# Canonical Parent-Student Consent Design

## Date

2026-08-03

## Context

The legacy parent-child relation is stored through `Student.parentId`. Canonical report
authorization deliberately ignores that relation and requires a current
`ParentStudentLink` in state `VERIFIED`. No production path currently creates or verifies
that Canonical link, so a parent cannot read a published Canonical report for a child they
created through `/api/bilan-gratuit` or `/api/parent/children`.

The data belongs to a minor. Registration alone is not consent. The transition to
`VERIFIED` must result from a distinct action by the authenticated parent.

## Decision

Use a parent-authenticated consent surface rather than a staff-only shortcut.

1. Child creation prepares an idempotent Canonical link in
   `PENDING_PARENT_CONSENT` in the same database transaction as the child.
2. The child detail page displays the current Canonical link state and an unchecked
   consent control.
3. A dedicated authenticated endpoint accepts only `{ "consent": true }` and verifies
   that the requested student belongs to the authenticated parent's legacy
   `ParentProfile`.
4. The endpoint transitions the active link from `PENDING_PARENT_CONSENT` to `VERIFIED`
   and records `consentedAt` and `verifiedAt` in one short transaction.
5. Repeating the same consent is idempotent and returns the existing verified link.
6. A different parent, or a user with another role, learns nothing about the child and
   receives `404`.
7. A single-record reconciliation command supports existing legacy children. It requires
   an explicit student id and parent email. It only prepares a pending record; the parent
   must still verify it through the authenticated surface. It never scans or updates a
   cohort.
8. Report access requires both a current `VERIFIED` Canonical link and the current legacy
   ownership relation. A stale verified link can never outlive a legacy reassignment.

No schema migration is required. The existing partial unique index on
`(parentUserId, studentId)` for states `PENDING_PARENT_CONSENT` and `VERIFIED` remains the
database-level concurrency guard.

## Components

### Domain service

`lib/bilans/parent-student-consent.ts` owns all state changes. It exposes:

- preparation of an idempotent pending link inside a caller-provided transaction;
- authenticated consent and verification in a transaction;
- single-record reconciliation after an operator confirms recorded parent consent;
- status lookup scoped to the authenticated parent.

The service always verifies legacy ownership server-side. It never accepts ownership from
the request body and never matches by student or parent name. Consent transactions lock
the student row with `SELECT ... FOR UPDATE`, revoke active links belonging to another
parent, and use a compare-and-set update restricted to `PENDING_PARENT_CONSENT`.

### Authenticated route

`app/api/parent/children/[studentId]/canonical-consent/route.ts` exposes:

- `GET` for the owned child's Canonical link state;
- `POST` with strict body `{ consent: true }` for explicit consent.

The route returns `404` for unauthenticated users, non-parent roles, missing legacy
ownership and another parent's child. It returns no PII.

The POST also applies the repository CSRF/same-origin guard before parsing the consent.
An authenticated cross-origin request cannot create or verify a link.

### Parent surface

`app/dashboard/parent/enfant/[studentId]/canonical-consent-card.tsx` is rendered from the
existing child detail page. The checkbox is never preselected. The confirmation button is
disabled until it is selected. A successful response displays the verified state.

### Registration integration

Both `POST /api/bilan-gratuit` and `POST /api/parent/children` create the pending Canonical
link in their existing child-creation transaction. This grants no report access.

### Reconciliation command

`scripts/bilans/reconcile-parent-student-link.ts` accepts exactly one student id and one
parent email. It requires the literal confirmation `PREPARER_CONSENTEMENT_PARENT`. It
verifies the legacy relation before calling the same service, creates only
`PENDING_PARENT_CONSENT`, and logs only technical identifiers and the resulting state. The
script never claims to record consent and never grants report access.

## Failure handling

- Invalid or absent consent: `400`, no write.
- Resource not owned by the parent: `404`, no existence disclosure.
- Existing `VERIFIED` link for the current legacy parent: success with no additional write
  and unchanged timestamps.
- Existing `PENDING_PARENT_CONSENT` link: transition it in place.
- Existing `REVOKED` or `EXPIRED` link: create a new pending record, then verify it only
  for the explicit consent request.
- Active links for a former parent: revoke them while holding the student row lock.
- Concurrent creation: the student row lock serializes the read/insert sequence; the
  partial unique index remains a final database invariant.
- Concurrent consent and revocation: verification uses `updateMany` constrained to
  `state = PENDING_PARENT_CONSENT`. A zero-row update triggers a reread and never overwrites
  `REVOKED` or `EXPIRED`.
- Database failure: transaction rollback, no partial state.

## Tests

Tests must demonstrate:

- child creation creates `PENDING_PARENT_CONSENT`, never `VERIFIED`;
- consent requires the authenticated parent and a literal boolean `true`;
- a repeated consent is idempotent;
- another parent receives `404` from both the consent endpoint and `GET /report`;
- a stale verified parent receives `404` after legacy reassignment;
- a cross-origin POST is refused without writing;
- concurrent preparations produce one active link;
- concurrent revocation wins over a late verification;
- `PENDING_PARENT_CONSENT` grants no parent report access;
- `REVOKED` grants no parent report access;
- `VERIFIED` grants the owning parent report access;
- reconciliation handles one explicit record, creates only `PENDING_PARENT_CONSENT`, and
  refuses missing confirmation;
- no source uses email matching to infer the child relation.

## Non-goals

- No automatic or bulk reconciliation.
- No staff-only verification shortcut.
- No new public Canonical report route.
- No feature flag activation.
- No production deployment in V1.
- No French pack activation.

## Rollback

Before deployment, rollback is removal of the V1 commit. After deployment, disabling the
Maths pack flag makes all Canonical attempt and report routes fail closed with `404` while
preserving consent records for audit. Verified links are not deleted automatically.
