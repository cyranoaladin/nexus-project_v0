# Cline Agent Setup for Nexus Réussite

This repository includes project-specific Cline configuration.

## Files

* `.clineignore`: excludes heavy, generated, sensitive or irrelevant files.
* `.clinerules/`: always-on project rules.
* `.clinerules/workflows/`: reusable workflows invoked from Cline.
* `.cline/skills/`: project skills loaded by Cline when relevant.

## Recommended Cline provider configuration

Provider:
OpenRouter (native Cline provider). Chutes is retired: do not configure an
OpenAI-compatible profile pointing at a Chutes domain, and add Chutes to the
ignored providers of the OpenRouter account.

The OpenRouter key is entered by the operator in Cline's secure key field; it
is never written to this repository.

Use only one model ID at a time. A first connectivity check may use
`openai/gpt-5-mini`; that is a test choice, not a mandated development model.
No `auto` and no latency alias.

Recommended settings:

* Context: 64K or 96K
* Max output: 8192 to 16384
* Temperature: 0.1 or 0.2
* Enable Skills in Cline settings
* Enable different models for Plan and Act mode

## Recommended workflows

Before editing:
`/audit-before-edit.md`

For implementation:
`/implement-feature-safely.md`

For generated reports:
`/generated-reports-hardening.md`

For production read-only audit:
`/production-readonly-audit.md`

At the end:
`/final-report.md`

## Important

Cline must not:

* modify production without explicit approval;
* print secrets;
* run destructive migrations;
* bypass RBAC;
* generate raw LaTeX directly from LLM output;
* store generated PDFs in public;
* use scratch as final PDF storage.

## Generated reports rule

The LLM must generate structured JSON only.
The application validates JSON.
The application renders deterministic LaTeX.
The application compiles and stores PDF securely.
