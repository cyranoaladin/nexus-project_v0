# PR #318 — Core v2 ARIA Foundation Hardening Design

## Context

PR #318 creates a Core v2-only ARIA cockpit, but it currently exposes legacy chat entry points, flattens grants to feature keys, ignores course scopes, treats unavailable projections as real empty data, and permits theoretical catalogue options that are not in the student's real course enrollments.

## Decisions

### Canonical entitlement adapter

`AriaAccessGrant` gains a non-null Core v2 `ariaTier` enum with values `ARIA_AUTONOMIE`, `ARIA_SUIVI`, and `ARIA_ACCOMPAGNEE`, defaulting to `ARIA_AUTONOMIE`. A pure adapter maps every grant to `AriaEntitlementRecord` with product code `ARIA_ACCESS`, real status/dates/tier, and either a global scope or explicit course scopes. All active/expired/revoked filtering, tier ranking, and tier capability resolution remains in `lib/aria/kernel/entitlements.ts`.

`featureKey`, `ariaTier`, and `courseScopes` remain separate. The repository loads real grant fields without applying a second status/date validity engine; the canonical kernel alone filters active/expired/revoked grants. To retain the feature/course association, Core v2 builds canonical entitlement contexts per feature key as well as an aggregate context for highest-tier capabilities. The curriculum resolver uses a discriminated V1/Core-v2 access input, so legacy feature strings can never bypass a scoped Core v2 context. A course is entitled only when its required feature context has access and that context is global or contains that course key.

### Honest intermediate chat state

Add `chat` to the cockpit capability map. V1 returns `true`; Core v2 returns `false` for PR B even when the commercial tier includes chat, because no Core v2 conversation adapter/routes exist yet. For Core v2, no active launcher or chat CTA is rendered and no legacy chat/conversation request can originate from the page. PR C will replace this deployment capability with native Core v2 chat.

### Available-empty versus unavailable

Cockpit panels consult the capability map. A capability set to false renders a neutral “Fonction non encore disponible pour ce profil” state. Only a true capability with an empty payload renders “Aucun …”. Conversation counters are not rendered as zero when history is unavailable.

### Enrollment-backed pins

Core v2 validates pinned course keys against the current `StudentCourseEnrollment` rows mapped to cockpit course keys. Catalogue applicability remains necessary but is not sufficient for specialties/options. Unenrolled maths expertes/complémentaires and other specialties are refused; real enrolled options/specialties are accepted; cross-grade keys remain refused. On reads, a previously persisted pin whose enrollment was later removed is filtered fail-closed from the profile/curriculum projection; it cannot become academically relevant or actionable after reload.

## Migration and compatibility

Migration `0018` is amended while PR B is unmerged. Existing rows created by PR B receive the non-null default. Legacy V1 remains unchanged and keeps its historical null-tier compatibility inside the canonical kernel.

## Verification

Strict TDD covers tier mapping, active/expired/revoked grants, per-feature course scopes, highest tier, no-grant capabilities, pin validation, UI unavailable states, Core v2 chat absence, V1 chat preservation, and a real Core-v2-only browser flow with a request observer proving `/api/aria/chat` is never called.
