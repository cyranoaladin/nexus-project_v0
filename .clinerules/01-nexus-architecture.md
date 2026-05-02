# Nexus Architecture Map

## Stack

- Next.js App Router
- TypeScript
- Prisma
- PostgreSQL
- NextAuth
- Tailwind
- Jest
- Playwright
- PM2 in production
- LaTeX/PDF generation for premium reports
- Mistral or OpenAI-compatible LLM providers for structured report generation

## Main areas

- `app/dashboard/eleve/`: student dashboard
- `app/dashboard/coach/`: coach dashboard
- `app/dashboard/parent/`: parent dashboard
- `app/api/eleve/`: student APIs
- `app/api/coach/`: coach APIs
- `components/dashboard/eleve/`: student UI components
- `components/dashboard/coach/`: coach UI components
- `components/dashboard/parent/`: parent UI components
- `components/ui/`: shared UI primitives
- `lib/rbac/`: access control
- `lib/guards.ts`: route role guards
- `lib/prisma.ts`: Prisma client
- `lib/reports/`: report generation logic
- `lib/llm/`: LLM clients
- `prisma/schema.prisma`: database schema
- `prisma/migrations/`: database migrations
- `scripts/`: operational scripts and workers
- `docs/features/`: feature plans and audits

## Architectural principles

- API routes must enforce role-based access.
- Coach routes must verify active coach-student assignment.
- Student routes must derive student identity from `session.user.id`, never from client-provided `studentId`.
- Parent routes must verify parent-child ownership.
- LLMs must never be the source of truth.
- LLMs may synthesize, but not invent.
- PDF generation must be deterministic after structured JSON validation.
- Long-running jobs must be moved to workers when possible.
- Production deployment must be treated as a separate controlled step.

## Important current feature

Generated pedagogical reports pipeline:
- student post-stage questionnaire;
- coach report validation;
- generated report job;
- LLM structured JSON;
- Zod validation;
- LaTeX rendering;
- PDF compilation;
- durable storage;
- coach dashboard status panel.
