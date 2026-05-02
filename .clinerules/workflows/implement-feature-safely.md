# Implement Feature Safely

## Step 1: Audit

Run `/audit-before-edit.md` first if not already done.

## Step 2: Implement minimal vertical slice

Make the smallest coherent change that can be verified.

Do not:

* refactor unrelated files;
* rename existing public APIs unnecessarily;
* change styling globally;
* bypass RBAC;
* hardcode user-specific data.

## Step 3: Validate

Run relevant checks:

* typecheck;
* targeted tests;
* Prisma validate/generate if schema touched;
* build if UI or Next routes are affected.

## Step 4: Report

Final report must include:

* summary;
* files changed;
* commands run;
* test results;
* risks;
* next action.
