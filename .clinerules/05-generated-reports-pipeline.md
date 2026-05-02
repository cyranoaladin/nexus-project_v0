# Generated Pedagogical Reports Pipeline

## Core rule

The LLM must never generate raw LaTeX directly.

The required pipeline is:

1. Student questionnaire completed.
2. Coach report validated.
3. Job created with checksum.
4. Canonical context built.
5. LLM generates structured JSON only.
6. Zod validates JSON.
7. Business validation checks hallucination risks.
8. Application renders deterministic LaTeX.
9. LaTeX compiles to PDF.
10. PDF is stored securely.
11. Coach dashboard displays status and download link.

## EAF report readiness

Student bilan:
- `type = STAGE_POST`
- `subject = FRANCAIS`
- `sourceVersion = eaf_stage_printemps_v1`
- `status = COMPLETED`

Coach report:
- `status = VALIDATED`
- required fields are complete:
  - `writingMethod`
  - `languageMastery`
  - `literaryCulture`
  - `strengths`
  - `areasToImprove`
  - `nextSessionGoals`
  - `coachFreeComment`

## PDF storage

- Do not store final PDFs in `public/`.
- Do not use `scratch/` as final storage.
- Prefer `GENERATED_REPORTS_DIR`.
- Fallback should be non-public, for example `private/generated-reports`.
- Use `Cache-Control: private, no-store`.
- Keep download route protected by RBAC.
- The path used for writing and reading must be centralized in one storage utility.

## Mistral/LLM

- If `MISTRAL_API_KEY` is missing, fail gracefully.
- Do not crash dashboards.
- Do not log prompts or private answers.
- Validate JSON with Zod.
- If scores are generated without source evidence, remove them or mark report `NEEDS_REVIEW`.
- The prompt must forbid invented data.
- The generated report must distinguish facts, observations and recommendations.

## LaTeX

- Escape all user-provided text.
- Use deterministic templates.
- Use `-halt-on-error`.
- Use `-no-shell-escape`.
- Use timeout.
- Preserve technical logs only outside public access.

## Worker

Normal flow should use a worker:
- poll `PENDING` jobs;
- process in small batches;
- avoid concurrent processing of the same job;
- store final PDFs durably;
- keep logs minimal and non-PII.
