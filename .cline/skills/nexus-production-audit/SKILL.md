---
name: <PROCESS_NAME>uction-audit
description: Use when auditing the Nexus production server, PM2, deployment, generated report storage, environment variables, LaTeX availability, Nginx, or database deployment readiness.
---

# Nexus Production Audit Skill

## Rule

Read-only unless explicitly authorized.

## Never print secrets

When inspecting env files, redact values.

## Required checks

* PM2 process list
* app directory
* Node/NPM versions
* package.json
* prisma schema location
* migrations
* pdflatex availability
* disk space
* Nginx status
* generated reports directory
* write permissions only if explicitly authorized

## Generated reports production readiness

Check:

* `GENERATED_REPORTS_DIR`
* whether directory exists
* whether app/worker user can write
* whether directory is outside public
* whether backups cover generated reports
* whether PM2 worker exists

## Final output

* app path;
* process manager;
* environment risks;
* missing dependencies;
* deployment readiness;
* exact next command.
