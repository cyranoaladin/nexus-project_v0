# Registration and identity state machine audit

## Date and scope

Read-only characterization on production release `11e0dce93e9f1d4c79824f9cccd0a467dde4f11b` and comparison with PRs #87–#91. No identity was created or changed.

## Target states

`LEAD_RECEIVED → CONTACT_PENDING_VERIFICATION → CONTACT_VERIFIED → PARENT_IDENTITY_CREATED → CHILD_PROFILE_CREATED → ACTIVATION_QUEUED → ACTIVATION_SENT → ACCOUNT_ACTIVATED → ONBOARDING_COMPLETED → SUSPENDED → ARCHIVED`

The current database does not persist this state machine. It infers state from `User.activatedAt`, token fields, profiles, `ContactLead`, and stage reservation fields. This makes delivery failures and partial onboarding ambiguous.

## Entry points

| Flow | Current behavior | Integrity finding | Target PR |
| --- | --- | --- | --- |
| Free bilan | Creates parent User, ParentProfile, synthetic student User and Student before email delivery | Public response returns raw IDs and claims delivery after failure | D1 then D2 |
| Legacy stage | StageReservation may exist without Student | One such production row; may be a valid lead but has no explicit lifecycle | D2 |
| Pre-rentrée informational | Lead/campaign data can coexist with identity data | ContactLead duplication policy is absent | D2 |
| Assistant student creation | Creates or reuses identities and activation data | Multiple token paths; bcrypt cost differs in coach update path | D2/D3 |
| Parent child add | Creates child and sends unawaited mail | Delivery is untracked; failure cannot be reconciled | D1/D2 |
| Parent activation | Token stored on User | Delivery and token state are not atomic | D1/D3 |
| Student activation | Service mutates email/token; route email call is commented | Confirmed false sent claim | D1/D3 |
| Resend activation | Replaces token before synchronous delivery | In-memory per-process rate limit; send failure swallowed | D1/D3 |
| Password reset | Stateless HMAC includes email and user ID | Dedicated secret absent; multiple outstanding tokens remain valid until one reset | D3 |
| Candidate libre | No single explicit identity state source found | Requires product/identity mapping decision | D2 |
| Staff identities | Inline role checks and varying bcrypt cost | Session revocation/versioning absent | D3 |

## Normalization and uniqueness

- `users.email` is unique but current login does not trim, lowercase, or Unicode-normalize before lookup.
- Production has zero duplicate `lower(trim(email))` User rows, but this is an observed data fact, not an application invariant.
- `ContactLead.email` is indexed but not unique; two normalized duplicate rows exist.
- The free-bilan flow checks then creates by raw email, leaving a race between the pre-check and unique constraint and no canonical merge policy by phone/email.
- Student synthetic local emails avoid collision but create a second identity even when direct student access is not required.

## Production counts

See `data-integrity-summary.json`. Structural User/Student/Parent orphans are zero; activation lifecycle and lead deduplication still require remediation.

## Required audit events

Every state transition must record actor, previous state, next state, normalized identity key hash, reason, idempotency key, correlation ID, and timestamp without raw PII. Delivery transitions must come from the canonical email outbox, not an optimistic HTTP message.
