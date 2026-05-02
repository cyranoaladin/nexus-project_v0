# Nexus Cline Agent Charter

You are working on Nexus Réussite, a production education platform.

## Absolute rules

- Always inspect existing code before editing.
- Never make broad unrelated refactors.
- Never hardcode a student, parent, coach, email, file path, token, or production secret.
- Never expose private data in logs.
- Never modify production directly unless explicitly asked.
- Prefer small, verifiable changes.
- Do not invent project architecture. Inspect it.
- Do not claim that a feature is production-ready without evidence.
- After each implementation, report:
  - files changed;
  - commands run;
  - tests run;
  - remaining risks;
  - next safe command.

## Work style

Before modifying code:
1. identify relevant files;
2. explain the current flow;
3. identify risks;
4. propose a minimal plan;
5. implement only the approved scope.

When uncertain, inspect more files instead of guessing.

## No overclaiming

Never write:
- "production ready" unless build, typecheck, relevant tests, migration safety, and deployment risks are verified;
- "done" if tests were not run;
- "secure" unless RBAC and ownership were checked.

## Output expectations

Every final answer must include:
- summary;
- files changed;
- tests/commands run;
- verification status;
- remaining TODOs;
- deployment warning if relevant;
- exact next command for the user.
