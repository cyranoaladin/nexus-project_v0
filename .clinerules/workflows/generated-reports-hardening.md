# Generated Reports Hardening

Use this workflow when working on EAF/Maths generated PDF reports.

## Step 1: Inspect

Read:

* `docs/features/GENERATED_PEDAGOGICAL_REPORTS_PLAN.md`
* `docs/features/GENERATED_PEDAGOGICAL_REPORTS_AUDIT.md` if it exists
* `prisma/schema.prisma`
* generated report migrations
* `lib/reports/stage/*`
* `lib/llm/mistral.ts`
* `components/dashboard/coach/GeneratedReportsPanel.tsx`
* EAF questionnaire route
* EAF coach report route
* EAF validate route

## Step 2: Verify database consistency

Run:

```bash
npx prisma validate
npx prisma generate
grep -R "generated_pedagogical_reports" prisma/migrations prisma/schema.prisma
grep -R "completionRatio\|validatedAt\|validatedBy" prisma/migrations prisma/schema.prisma
```

## Step 3: Verify workflow

Confirm:

* student bilan completed;
* coach report validated;
* checksum created;
* duplicate jobs prevented;
* worker or route processes job;
* PDF storage is durable;
* coach dashboard displays status.

## Step 4: Fix only the broken layer

Do not refactor the whole system.

Priority order:

1. migration consistency;
2. PUT validation safety;
3. durable PDF storage;
4. LaTeX hardening;
5. Mistral timeout;
6. worker;
7. UI wording;
8. tests.

## Step 5: Test

Run targeted tests for:

* completeness;
* checksum;
* job creation;
* RBAC;
* LaTeX escaping;
* Mistral failure cases if implemented.

## Step 6: Report readiness

Do not declare production readiness unless:

* migrations are correct;
* storage is durable;
* worker is ready;
* typecheck passes;
* relevant tests pass;
* production dependencies are audited.
