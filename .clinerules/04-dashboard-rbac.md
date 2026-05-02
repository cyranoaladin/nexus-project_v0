# Dashboard and RBAC Rules

## Student dashboard

- Student APIs must use the authenticated user.
- Do not accept external `studentId` from student-facing APIs.
- Do not expose coach private notes to students.
- Do not expose internal debug data.
- Student sees learning progress, resources, ARIA, bilans, sessions, stages and action plans.

## Coach dashboard

- Every coach route must require role `COACH`.
- Every coach-student route must call the existing coach-student access helper.
- A coach must not access an unassigned student.
- Generated reports must be accessible only to authorized coaches.
- Coach can see operational and pedagogical details.
- Coach private notes must not be exposed to students or parents.

## Parent dashboard

- Parent data must be read-only unless explicitly designed otherwise.
- Parent access must be limited to linked children.
- Parent summaries must not expose raw private coach notes.
- Parent sees readable synthesis, progress and next actions, not raw internal data.

## UI consistency

- Coach sees operational and pedagogical details.
- Parent sees readable synthesis and next actions.
- Student sees learning progress, resources, and action plan.
- Do not mix role-specific data.

## Generated reports visibility

Default recommended rule:
- authorized coach sees generated reports for assigned students;
- parent/student may later see selected summaries only if explicitly exposed;
- raw LLM context and coach private notes are never exposed.
