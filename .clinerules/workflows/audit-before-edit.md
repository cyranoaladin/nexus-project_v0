# Audit Before Edit

Use this workflow before any non-trivial implementation.

## Step 1: Check git state

Run:

```bash
git status --short
git branch --show-current
```

If there are uncommitted changes, list them and explain whether they are related.

## Step 2: Identify relevant files

Search and inspect the files related to the task.

Do not edit yet.

## Step 3: Explain current behavior

Summarize:

* current data flow;
* involved models;
* involved routes;
* involved components;
* current risks.

## Step 4: Propose minimal plan

Write:

* P0 changes;
* P1 changes;
* tests;
* files to modify.

## Step 5: Stop if risky

Stop and wait for user approval if the change affects:

* Prisma schema;
* migrations;
* authentication;
* RBAC;
* production deployment;
* generated report storage;
* payment;
* destructive operations.
