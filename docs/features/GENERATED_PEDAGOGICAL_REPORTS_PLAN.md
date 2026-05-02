# Generated Pedagogical Reports Plan

## Current Files Inspected

- `prisma/schema.prisma`
- `prisma/migrations/20260501120000_add_eaf_preparation_reports/migration.sql`
- `app/api/eleve/questionnaire-eaf-stage-printemps/route.ts`
- `app/api/coach/students/[studentId]/eaf-preparation-report/route.ts`
- `app/api/coach/students/[studentId]/eaf-preparation-report/validate/route.ts`
- `app/api/coach/students/[studentId]/generated-reports/route.ts`
- `app/api/coach/students/[studentId]/generated-reports/[reportId]/generate/route.ts`
- `app/api/coach/students/[studentId]/generated-reports/[reportId]/download/route.ts`
- `components/dashboard/coach/EafPreparationReport.tsx`
- `components/dashboard/coach/GeneratedReportsPanel.tsx`
- `components/dashboard/coach/StudentDossier.tsx`
- `lib/rbac/coach-student-access.ts`
- `lib/guards.ts`
- `lib/reports/stage/checksums.ts`
- `lib/reports/stage/completeness.ts`
- `lib/reports/stage/buildReportContext.ts`
- `lib/reports/stage/maybeCreateGeneratedReportJob.ts`
- `lib/reports/stage/renderLatexPremiumReport.ts`
- `lib/reports/stage/compileLatexToPdf.ts`
- `lib/reports/stage/validateGeneratedReportJson.ts`
- `lib/llm/mistral.ts`
- `__tests__/api/coach/eaf-preparation-report.test.ts`
- `__tests__/api/coach.eaf-stage-printemps.report.test.ts`

## Current Data Models Involved

- `Student`: owns canonical `Bilan` records, EAF coach reports, and generated reports.
- `CoachProfile`: owns EAF coach reports and generated reports.
- `Bilan`: already stores the EAF student questionnaire as `type = STAGE_POST`, `subject = FRANCAIS`, `sourceVersion = eaf_stage_printemps_v1`, `status = COMPLETED` on submission.
- `EafPreparationReport`: stores coach-written EAF preparation fields. The schema has lifecycle fields, but the database migration currently lacks them.
- `GeneratedPedagogicalReport`: exists in Prisma schema, but needs a database migration and route/service hardening.
- `CoachStudentAssignment`: source of truth for active coach-student access in coach routes.

## Proposed Prisma Migration

Create a new migration that:

- Adds `status`, `completionRatio`, `validatedAt`, and `validatedBy` to `eaf_preparation_reports`.
- Creates PostgreSQL enums `GeneratedReportStatus` and `GeneratedReportKind`.
- Creates `generated_pedagogical_reports` with the requested columns, foreign keys to `students` and `coach_profiles`, and indexes.
- Adds the uniqueness constraint on `(studentId, stageSlug, subject, kind, inputChecksum)` to prevent duplicate jobs for the same inputs.

## Proposed Services

- `lib/reports/stage/checksums.ts`: stable checksum from student bilan update time, coach report update time, prompt version, and template version.
- `lib/reports/stage/completeness.ts`: validation helpers for completed student bilans and complete/validated coach reports.
- `lib/reports/stage/buildReportContext.ts`: canonical, minimal context builder. It must not expose private coach notes.
- `lib/reports/stage/maybeCreateGeneratedReportJob.ts`: gate job creation on both completed student questionnaire and validated coach report.
- `lib/reports/stage/schema.ts`: Zod schema and types for structured LLM output.
- `lib/reports/stage/renderLatexPremiumReport.ts`: deterministic LaTeX renderer with escaping.
- `lib/reports/stage/compileLatexToPdf.ts`: compile path with a safe missing-compiler failure.
- `lib/reports/stage/generateStructuredReportWithMistral.ts`: isolated JSON-only generation function.
- `lib/llm/mistral.ts`: small Mistral client abstraction that fails cleanly when `MISTRAL_API_KEY` is missing.

## Proposed Routes

- `POST /api/coach/students/[studentId]/eaf-preparation-report/validate`
  - Requires `COACH`.
  - Checks active coach-student assignment.
  - Validates required EAF fields before setting `VALIDATED`.
  - Calls job creation after validation.

- `GET /api/coach/students/[studentId]/generated-reports`
  - Requires `COACH`.
  - Checks active coach-student assignment.
  - Returns reports for that student visible to the assigned coach.
  - Includes readiness state for the EAF report pipeline.

- `POST /api/coach/students/[studentId]/generated-reports/[reportId]/regenerate`
  - Requires `COACH`.
  - Checks active coach-student assignment.
  - Processes the selected job through context, LLM JSON, Zod validation, LaTeX rendering, and PDF compilation.

- `GET /api/coach/students/[studentId]/generated-reports/[reportId]/download`
  - Requires `COACH`.
  - Checks active coach-student assignment and report ownership.
  - Serves only `PDF_READY` report files.

## Proposed UI Integration

- Update `EafPreparationReport` to show completion ratio, save draft, block validation until required fields are complete, and call the validate route.
- Update `GeneratedReportsPanel` to:
  - Display report kind, subject, status, generated date, and failure messages.
  - Show waiting messages for missing student bilan or missing coach validation.
  - Use the requested `regenerate` route, not an ad hoc `generate` route.
- Keep `GeneratedReportsPanel` integrated in `StudentDossier`.

## Test Plan

- Unit tests for EAF coach report completeness and completion ratio.
- Unit tests for checksum stability and sensitivity to input timestamps/version changes.
- Unit tests for `maybeCreateGeneratedReportJob`:
  - waits for completed student bilan;
  - waits for validated coach report;
  - creates one job when both sides are ready;
  - prevents duplicate jobs for the same checksum.
- Route tests for generated reports RBAC and horizontal access behavior.
- Route tests for EAF validation refusing incomplete reports.
- Unit tests for LaTeX escaping and deterministic rendering.
- Component smoke test for `GeneratedReportsPanel` if existing React test infrastructure remains compatible.

## Risks and Mitigations

- **Schema drift risk:** Prisma schema already contains generated-report models without a matching migration. Mitigation: add an explicit migration that only covers missing database changes.
- **LLM data invention risk:** prompt requires JSON only and forbids invented scores/data; Zod schema validates shape; renderer is deterministic and does not accept raw LaTeX.
- **PII leakage risk:** logs should contain report ids and operational error codes only, not questionnaire or coach free-text content.
- **Access-control risk:** every route must require `COACH` and call `assertCoachCanAccessStudent`; report lookup also checks `studentId`.
- **PDF toolchain risk:** `pdflatex` may be absent in local or production containers. Mitigation: compilation fails with `FAILED`/`PDF_COMPILATION_FAILED` and keeps the architecture ready for a real worker/container.
- **Existing flow regression risk:** the student questionnaire route is not structurally changed; coach draft save remains a `PUT` upsert; validation is a separate endpoint.
