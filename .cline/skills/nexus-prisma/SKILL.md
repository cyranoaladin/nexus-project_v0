---
name: nexus-prisma
description: Use when modifying Prisma schema, migrations, database models, generated reports tables, EAF reports, coach/student relations, or any PostgreSQL persistence logic in Nexus Réussite.
---

# Nexus Prisma Skill

## Mandatory process

1. Inspect `prisma/schema.prisma`.
2. Inspect relevant migrations.
3. Search all usages of the model before changing it.
4. Prefer additive migrations.
5. Never use `prisma db push` for production.
6. Run:

   * `npx prisma validate`
   * `npx prisma generate`

## Generated reports models

When working on generated pedagogical reports, verify:

* `GeneratedPedagogicalReport`
* `GeneratedReportStatus`
* `GeneratedReportKind`
* uniqueness by `studentId`, `stageSlug`, `subject`, `kind`, `inputChecksum`
* relation to `Student`
* relation to `CoachProfile`
* storage fields:

  * `pdfDocumentId`
  * `pdfUrl`
  * `latexSource`
  * `validatedJson`

## EAF reports

When working on `EafPreparationReport`, verify:

* fields:

  * `status`
  * `completionRatio`
  * `validatedAt`
  * `validatedBy`
* draft save route cannot force validation;
* validation route is the only place that sets `VALIDATED`.

## Safety

Do not change destructive constraints without explicit approval.
Do not drop data.
Do not rename production columns unless a migration path is written.
Document every migration risk.
