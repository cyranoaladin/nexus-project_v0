---
name: nexus-generated-reports
description: Use when working on EAF or Maths generated pedagogical reports, Mistral JSON generation, LaTeX rendering, PDF compilation, report worker, checksum, or report storage.
---

# Nexus Generated Reports Skill

## Non-negotiable architecture

LLM must output structured JSON only.
Application validates JSON.
Application renders LaTeX deterministically.
Application compiles PDF.
Application stores PDF securely.
Dashboard displays status.

## Never do

* Do not ask LLM to write raw LaTeX.
* Do not store final PDFs in public.
* Do not use scratch as final storage.
* Do not log questionnaire answers.
* Do not log coach free text.
* Do not invent scores.
* Do not bypass checksum deduplication.

## Required checks

* Student bilan completed.
* Coach report validated.
* Checksum prevents duplicate jobs.
* Worker handles pending jobs.
* PDF download route checks RBAC.
* Missing Mistral key fails gracefully.
* LaTeX errors are captured.
* PDF storage directory is configurable and non-public.

## Quality requirements

The generated PDF must be:

* premium;
* readable by parents;
* useful for the student;
* operational for the coach;
* pedagogically precise;
* non-alarmist;
* fact-based.

## Mistral

* Add timeout.
* Do not log prompts.
* Do not log private context.
* JSON must be parsed and validated.
* Invalid JSON must not break dashboards.

## LaTeX

* Escape all user-controlled text.
* Use no shell escape.
* Use timeout.
* Preserve logs safely on failure.
* Do not expose raw LaTeX logs to users.
