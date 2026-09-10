# ADR 0001 — Core v2: one canonical source of truth per business concept

- **Status:** Proposed (design pass only — no production mutation, no migration executed, no code path switched)
- **Date:** 2026-09-08
- **Branch:** `feat/core-v2-single-source-of-truth`
- **Supersedes (in spirit, not by deletion):** the roster/decision framing in `docs/audits/core-v2-source-of-truth-inventory.md` — see its correction notice.
- **Companion doc:** `docs/audits/core-v2-canonical-architecture.md` (full 33-point mission report, evidence, matrices, roster candidates).

## Context

Nexus Réussite's current schema (106 migrations, `nexus_prod`) accumulated several duplicate-authority patterns as the product grew: a coach's teachable subjects live in a `Json` blob read by two independent authorization surfaces; an assignment can represent zero or several courses at once via a `subjects[]`/`academicCourseKeys[]`/`courseScopeState` triple, which is *why* the two go-live blocker cases (Case A "unresolved", Case B "ambiguous") were representable at all; `SessionBooking` carries both a legacy `User.id`-based identity and a canonical profile-based one; and a student's roster membership for a given school year has no explicit source — it was being inferred from account-creation recency, which the owner has now explicitly rejected as authoritative.

The owner has confirmed: historical compatibility no longer dictates architecture. Legacy data, code, routes, and columns may be deleted; old students need not be migrated by default. This ADR is not a decision to delete anything — it is a decision to build one canonical source of truth per concept, so that deletion (when it happens, later, explicitly) has a clear target state to delete *toward*.

## Decision

Adopt the target model in `core-v2/prisma/schema.prisma` as the Core v2 design baseline:

1. **Roster authority moves out of `Student`.** A new `StudentAcademicYearEnrollment(studentId, academicYearId, status, ...)` becomes the single source of "is this student on Nexus's roster for year X." `Student` keeps only facts that don't change per year (identity, household, birthdate). No status is ever inferred from `createdAt`.
1b. **The school year itself is a canonical entity, `AcademicYear(startYear Int @unique, startsAt, endsAt, status)`, not a free-text field.** An earlier draft used `schoolYear String` (e.g. `"2026-2027"`) directly on the enrollment row — rejected on review: free text under a uniqueness constraint is defeated by any typo/format variant, silently producing two rows for one real year. `startYear` (a plain integer) is the only entered value; the `"2026-2027"` label is derived, never entered. See the companion doc §5b.
1c. **Year rollover never mutates a row in place.** `StudentAcademicYearEnrollment(2026-2027)` transitions to a terminal status (`COMPLETED`/`WITHDRAWN`/`ARCHIVED`); a new row is created for `2027-2028`. CORE/TRACK modules are recalculated fresh (never stored, nothing to roll over); `StudentCourseEnrollment`, `CoachStudentCourseAssignment`, and `PlanningSeries`/`SessionBooking` are never auto-copied forward — the system may *propose* a rollover, but every resulting row requires explicit confirmation by an authorized actor. `Subscription` renewal is independent and never decides curriculum. Full policy: companion doc §6b. This closes the year-rollover architectural UNKNOWN the owner flagged — as a decision, not as an implemented workflow.
2. **Family authority becomes `Household`/`HouseholdParent`**, supporting genuine multi-parent households — a structural improvement, not a bug fix (today's model already has no real second family-truth source; `ParentStudentLink` keeps its existing consent/audit role, explicitly, permanently, guarded by an architecture test). **Disclosed limitation (post-review):** this is N parents : N children at *household-bucket* granularity — every parent in a household sees every child in that household — not a per-(parent, child)-edge relation. A blended-family case needing asymmetric visibility (e.g. a step-parent who should see only one of two siblings) is **not representable** without a further redesign. Today's data has no such case (per the roster audit); this is accepted as a known, disclosed scope limitation for this design, not silently glossed over.
3. **Coach capability becomes `CoachCourseCapability(coachId, courseKey)`**, a real relation, replacing the `CoachProfile.subjects Json` blob and its two authorization surfaces (one undocumented).
4. **Assignment becomes `CoachStudentCourseAssignment`: one row = one coach + one student/year + one courseKey.** `BACKFILL_AUTO`/`BACKFILL_UNRESOLVED`/`BACKFILL_AMBIGUOUS` become unrepresentable — not fixed by validation, made *structurally impossible*. **This claim covers only the ambiguous/empty-scope shape.** A separate invariant — no two simultaneous `ACTIVE` rows for the same (coach, enrollment, courseKey) — is designed but **not yet enforced** by anything committed in this PR; see the companion doc's correction note under §9.
4b. **Target invariant for that gap, decided here, not implemented here:** historical assignments (`ENDED`, non-overlapping in time) for the same (coach, enrollment, courseKey) triple are explicitly **allowed** — re-assigning a coach to the same course in a later period, or correcting a mistaken assignment, are legitimate. What must be **forbidden** is more than one simultaneously-`ACTIVE` row for that same triple. The target enforcement mechanism is a PostgreSQL partial unique index (`UNIQUE (coachId, academicYearEnrollmentId, courseKey) WHERE status = 'ACTIVE'`) — the same pattern this codebase already uses for `entitlements_aria_access_invoice_key`, since Prisma's schema DSL cannot express a `WHERE`-clause index. A full `EXCLUDE` constraint (covering time-range overlap even across `ACTIVE`/`ENDED` transitions at the boundary) is the fallback if the partial-unique-plus-serialized-transaction combination proves insufficient at implementation time — that choice between the two is deferred to the implementation PR, not decided here, but the *outcome required* (never more than one overlapping `ACTIVE` row) is decided now.
5. **Planning/session occurrence normalize onto `assignmentId`** as the sole identity path; `SessionBooking`'s legacy `User.id` fields (`studentId`/`coachId`/`parentId`) are dropped from the v2 model once their real remaining authorization call sites (3 live + 1 dormant/dead-code, identified by exhaustive audit and an independent follow-up review, see companion doc) are migrated.
6. **Billing stays as-is.** `Subscription`/`Payment`/`Invoice`/`Entitlement` already have single, clean responsibilities — re-architecting them was considered and rejected as unnecessary churn.
7. **A fresh database, not an in-place transform.** `nexus_core_v2` is bootstrapped from a new baseline migration; `nexus_prod` becomes `LEGACY_SOURCE_READ_ONLY` for the duration of the transition, never mutated in place. Git history of the 106 legacy migrations is retained untouched.

## What this ADR does NOT decide

- **Which students migrate.** That is `core-v2-roster-2026-2027.candidate.json`'s job — a *candidate* list built from real contractual signals (active subscription, paid invoice, confirmed enrollment, future planning), never from account-creation recency alone. Approval is a separate, explicit, ownable step (`ROSTER_2026_2027_APPROVED` vs. `NOT_MIGRATED`), not automatic.
- **Whether the Case A or Case B student's old assignment gets rebuilt.** Their legacy `CoachStudentAssignment` rows are explicitly excluded from roster reasoning (`CASE_A_LEGACY_ASSIGNMENT_SIGNAL = IGNORED_FOR_ROSTER`, same for the Case B student) — only independent 2026-2027 evidence counts, and if none exists, they are `NOT_MIGRATED`, with no legacy repair.
- **When or whether to actually cut over.** This ADR proposes a target schema and a migration methodology; it does not authorize running the extractor against production, dropping any column, or deleting any row.
- **Final vocabulary for `StudentAcademicYearEnrollmentStatus`.** `ACTIVE`/`COMPLETED`/`WITHDRAWN`/`ARCHIVED` is a starting proposal pending a short business-vocabulary audit, not a final decision.

## Consequences

**Positive:**
- Ambiguous and empty-scope assignments become impossible by schema, not by discipline — the exact class of bug PR #220 had to patch at the application layer disappears at the data-model level.
- Multi-parent households become representable without inventing a second membership authority.
- The roster question gets an explicit, auditable answer per school year instead of an implicit one derived from account age.

**Costs / risks, stated plainly:**
- `CoachStudentCourseAssignment`'s "student actually follows this courseKey" and "coach actually has this capability" invariants remain **application-layer**, not DB-foreign-key-enforced, because followed courses are partly derived (core/track modules) rather than all being physical rows. This ADR does not overclaim schema-level enforcement it can't deliver.
- Migrating `SessionBooking` off its legacy identity fields requires touching 4 real authorization call sites in production code (3 live, 1 dormant/dead-code) — small in count, but each is a genuine access-control path and must be tested, not just renamed or silently dropped because it's currently unreferenced.
- A second database (`nexus_core_v2`) means a real cutover event later, with its own backup/restore/canary/switch discipline — deferred to a future ADR/runbook, not designed here.

## Alternatives considered

- **In-place `ALTER TABLE` contraction of `nexus_prod`.** Rejected: 106 migrations of accumulated shape make an in-place transform higher-risk than a fresh bootstrap + one-shot extractor, and blocks a clean rollback story (old app + old schema stays fully intact and untouched under the fresh-DB approach).
- **Keep `courseScopeState`/`academicCourseKeys[]` and just tighten validation.** Rejected: this is exactly today's state, and it is what produced two real production go-live blockers (Case A/B) that required a human decision to unblock. The owner's explicit ask is to make the shape itself refuse to represent the ambiguous/empty case, not to validate harder.
