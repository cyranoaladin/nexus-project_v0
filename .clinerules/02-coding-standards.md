# Coding Standards

## TypeScript

- Use strict TypeScript.
- Prefer explicit types for exported functions.
- Avoid `any`; if unavoidable, localize it and explain why.
- Use Zod for runtime validation of API payloads.
- Keep server-only logic out of client components.
- Do not import server-only modules in `"use client"` files.
- Do not silence TypeScript errors with broad casts unless justified.

## Next.js

- API routes must return clear JSON errors.
- Do not leak stack traces to the client.
- Use `NextResponse.json` consistently.
- Keep long-running tasks out of request/response routes when possible.
- Route handlers must validate both role and ownership.
- Do not trust client-provided IDs without server-side checks.

## UI

- Preserve the existing Nexus visual identity.
- Use existing UI components from `components/ui/`.
- Keep dashboards readable, premium, and role-specific.
- Avoid adding clutter to student, coach, or parent dashboards.
- Every status shown in UI must be understandable by a non-technical user.

## Error handling

- Use operational error codes.
- Log technical identifiers, not private content.
- Never log questionnaire answers, coach free text, parent data, API keys, prompts, or generated full reports.
- Return short user-facing messages and keep technical details server-side.

## Code changes

- Prefer small patches.
- Do not reformat entire files.
- Do not rename files unless necessary.
- Do not change public APIs without updating all callers.
- Do not leave exploratory comments like "Wait!" or "Let's check" in committed code.
