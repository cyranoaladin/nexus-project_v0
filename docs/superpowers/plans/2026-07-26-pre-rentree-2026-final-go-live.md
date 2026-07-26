# Pré-rentrée 2026 Final Go-Live Implementation Plan

> **For agentic workers:** REQUIRED: Use superpowers:executing-plans to
> implement this plan. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Produce, merge and deploy one fully qualified Stage release SHA while
preserving the Bilan territory.

**Architecture:** PR #82 gains a strict, exact and expiring supply-chain
exception validator while keeping raw npm/OSV reports visible. It is merged
into PR #79, which receives the final metadata-only GO only after owner and
operations evidence is bound to its exact head.

**Tech Stack:** Next.js 15, Node.js 22, npm 10, TypeScript, Jest, Python,
Playwright, GitHub Actions, CycloneDX, PostgreSQL 16.

---

## Chunk 1: Security closure on PR #82

### Task 1: Reproduce and specify the exception contract

**Files:**

- Create: `security/pre-rentree-2026-dev-tooling-exception.schema.json`
- Create: `security/pre-rentree-2026-dev-tooling-exception.json`
- Create: `__tests__/scripts/validate-dev-tooling-exception.test.ts`
- Create: `docs/campaigns/pre-rentree-2026/security/FINAL-DEPENDENCY-DECISION.md`

- [ ] Write failing tests for expiry, wrong advisory, new findings, wrong SHA,
      runtime presence, checksum mismatch and missing remediation issue.
- [ ] Run the focused tests and verify the expected failures.
- [ ] Define the smallest redacted exception schema and record.

### Task 2: Implement the exact validator

**Files:**

- Create: `scripts/security/validate-dev-tooling-exception.mjs`
- Modify: `package.json`

- [ ] Implement validation of the npm and OSV JSON reports.
- [ ] Validate the production audit, complete audit, runtime SBOM and artifact
      scan evidence.
- [ ] Ensure success is impossible for any advisory other than
      `GHSA-mh99-v99m-4gvg`.
- [ ] Run focused tests green.

### Task 3: Keep raw CI evidence and apply only the exact policy

**Files:**

- Modify: `.github/workflows/ci.yml`
- Modify: `__tests__/ci/pr79-ci-evidence.test.js`

- [ ] Add failing workflow contract tests.
- [ ] Archive raw audit and OSV reports unconditionally.
- [ ] Run the exact validator only after a raw non-zero result.
- [ ] Keep runtime audit, Semgrep, SBOM and aggregator strict.
- [ ] Run workflow tests green.

### Task 4: Track remediation and owner decision

**Files:**

- Modify privately:
  `/home/alaeddine/nexus-owner-decisions/pre-rentree-2026/inputs/security-risk-decision.json`
- Create GitHub issue: exact advisory remediation.

- [ ] Create the issue with owner, advisory and expiry.
- [ ] Update the private input only after all exception conditions are proven.
- [ ] Validate Draft 2020-12, permissions and checksum.
- [ ] Commit only redacted repository evidence.

## Chunk 2: Frozen Stage qualification

### Task 5: Prove planning and public-surface invariants

**Files:**

- Create if missing:
  `assets/qa/pre-rentree-2026/final-go-live/route-combinations.json`
- Modify tests only if a blocking coverage gap is demonstrated.

- [ ] Run all Stage TypeScript and Python tests.
- [ ] Export every valid one-to-four-subject combination.
- [ ] Verify actionable status, wait, cohorts, volume and WhatsApp payload.
- [ ] Verify 14/70/17/85 and Bilan path guard.

### Task 6: Prove PDF and campaign immutability

- [ ] Verify seven PDFs, 59 pages, MIME, signature, qpdf, text and checksums.
- [ ] Rebuild deterministically and compare Git.
- [ ] Verify 27 public social assets and PUBLIC/REVIEW separation.
- [ ] Confirm approved manifest checksum is unchanged.

### Task 7: Run complete application qualification

- [ ] Run lint, typecheck, full unit, integration and real PostgreSQL tests.
- [ ] Run build, standalone audit, traces, runtime SBOM and production audit.
- [ ] Run Playwright at 390×844, 768×1024 and 1440×900.
- [ ] Capture screenshots outside Git and verify console, keyboard and links.

## Chunk 3: Integration, operations and production

### Task 8: Finalize and merge PR #82 into #79

- [ ] Push without force and wait for every #82 check.
- [ ] Resolve review conversations and make #82 ready.
- [ ] Merge using the repository-supported strategy.
- [ ] Fetch the new #79 head and prove ancestry.

### Task 9: Establish private operations evidence

- [ ] Resolve the real deployment target from owner-controlled configuration
      and prior authenticated deployments.
- [ ] Create/checksum a private runbook without publishing topology.
- [ ] Identify the currently served SHA and previous healthy SHA.
- [ ] Perform the runbook-supported non-destructive rollback validation.
- [ ] Record pre-deploy health from real checks.

### Task 10: Bind GO and make PR #79 releasable

- [ ] Rebind campaign/security inputs to the exact integrated #79 head.
- [ ] Create the final private GO binding.
- [ ] Make a metadata-only `PUBLIC_READY` commit.
- [ ] Run complete local and remote checks.
- [ ] Make #79 ready only when every required state is successful.

### Task 11: Merge, deploy and validate

- [ ] Merge #79 to `main` without admin bypass.
- [ ] Record the resulting `PRODUCTION_SHA`.
- [ ] Deploy exactly that SHA using the private runbook.
- [ ] Verify external routes, Stage UX, PDFs, logs and served SHA.
- [ ] Roll back immediately on any critical criterion.
- [ ] Record the final production report and Bilan handoff.
