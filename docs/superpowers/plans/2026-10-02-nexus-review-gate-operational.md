# Nexus Review Gate Operational Bootstrap Implementation Plan

> **For agentic workers:** REQUIRED: Use superpowers:subagent-driven-development (if subagents available) or superpowers:executing-plans to implement this plan. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Produce one reviewable operational PR, without applying the live ruleset, whose App-owned gate cannot succeed without exact-head deterministic and qualified semantic review.

**Architecture:** Keep the existing trusted-main App check publisher. Add pure policy and parser modules, a bounded GitHub evidence collector, a trusted `workflow_run` evaluator, and a separate model qualification lane. Future governance is versioned as pending target; live remains under the one-approval rule. Fail closed if model qualification is not met.

**Tech Stack:** Node ESM, Jest governance tests, GitHub REST/GraphQL, GitHub Actions, checksum-pinned GGUF/llama.cpp on hosted Ubuntu.

---

## Chunk 1: Pure policy (test-first)

### Task 1: Exact-head and checks

**Files:** `scripts/github/review-gate/policy.mjs`, `__tests__/governance/review-gate-policy.test.js`

- [ ] Write RED tests for open/non-draft/main, exact head, head race, complete/successful required checks, own-check exclusion, producer identity, conflict and diff completeness.
- [ ] Run focused Jest and confirm intended RED.
- [ ] Implement minimal pure policy, rerun GREEN, refactor without changing results.

### Task 2: Risk and human exception

**Files:** `scripts/github/review-gate/risk.mjs`, `scripts/github/review-gate/config.json`, `__tests__/governance/review-gate-risk.test.js`

- [ ] RED tests for NORMAL/SENSITIVE/UNCLASSIFIED, governance/gate/deploy/credentials/destructive changes, exact-head authorized approval and stale approval rejection.
- [ ] Run RED; implement classifier; run GREEN.
- [ ] Verify unknown/binary/oversized/ambiguous changes fail closed.

### Task 3: Semantic output contract

**Files:** `scripts/github/review-gate/semantic.mjs`, `__tests__/governance/review-gate-semantic.test.js`

- [ ] RED tests for three passes, strict JSON schema, timeout, malformed output, blocker and clean result.
- [ ] Run RED; implement minimal parser/decision; run GREEN.
- [ ] Ensure no unqualified model output can lead to SUCCESS.

## Chunk 2: Trusted GitHub boundary

### Task 4: Evidence reader and publisher

**Files:** `scripts/github/review-gate/github.mjs`, `scripts/github/review-gate/run.mjs`, `__tests__/governance/review-gate-github.test.js`

- [ ] RED tests for unique PR/run association, effective rules, paginated head checks/statuses/threads/reviews, app source, Cubic attestation, read/API failure and reread before success.
- [ ] Run RED; implement bounded read-only collector and App-only check write; run GREEN.
- [ ] Ensure only the App token can write the check; no PR text enters commands or logs.

### Task 5: Trusted workflow and branch automation

**Files:** `.github/workflows/nexus-review-gate.yml`, `scripts/github/review-gate/automation.mjs`, `__tests__/governance/review-gate-workflow.test.js`, `__tests__/governance/review-gate-automation.test.js`

- [ ] RED tests for trusted-main workflow, upstream ID/path, no PR checkout/execution, secret isolation, fail-closed publication, exact-head MERGE auto-merge and safe branch update.
- [ ] Run RED; implement workflow/automation; run GREEN.
- [ ] Test stale head and conflict refusal independently.

## Chunk 3: Model and corpus qualification

### Task 6: Freeze sources and thresholds before metrics

**Files:** `scripts/github/review-gate/models.json`, `scripts/github/review-gate/qualification-policy.json`, `scripts/github/review-gate/corpus/*.json`, `docs/audits/2026-10-02-review-gate-model-qualification.md`

- [ ] Pin Granite 3B and Qwen Coder 7B revision, exact GGUF SHA-256 and llama.cpp runtime SHA-256; verify official licenses and download URLs.
- [ ] Construct incident-derived blocking and benign examples without leaking fix labels in prompts; reserve held-out incident families.
- [ ] Freeze recall/FPR/parser/timeout/runtime thresholds before evaluating model results.

### Task 7: Hosted-runner reproducible evaluation

**Files:** `.github/workflows/nexus-review-gate-model-qualification.yml`, `scripts/github/review-gate/qualify-models.mjs`, tests.

- [ ] RED tests for digest mismatch, unsupported diff, malformed result and threshold failure.
- [ ] Run RED; implement runner with bounded downloads, SHA verification, CPU/memory/time limits and metrics; run GREEN.
- [ ] Run both candidates on standard hosted runner; record recall, FPR, malformed/timeout rates, median/p95 and max diff. Select only if threshold passes; otherwise mark qualification FAIL and do not authorize zero approvals.

## Chunk 4: Future governance target, not live state

### Task 8: Selective CODEOWNERS and pending target

**Files:** `.github/CODEOWNERS`, `.github/governance/review-policy.json`, `.github/governance/target-review-gate.json`, relevant schemas/audit/tests.

- [ ] RED tests for ordinary path no human, sensitive path human, current live state still accepted, pending target zero approvals with all existing checks plus App ID 5166727, no bypass.
- [ ] Run RED; implement selective CODEOWNERS and explicit pending target; run GREEN.
- [ ] Keep the live audit truthful: current state is legacy, target is pending, no live apply.

## Chunk 5: Consolidation and PR

### Task 9: Verify and publish

- [ ] Run targeted governance tests, full `npm run test:governance`, `npm run governance:audit`, lint/typecheck and workflow validation; review the diff and secret scan.
- [ ] Recheck model qualification evidence and report failures honestly. Never label deterministic-only gate as semantic-review equivalent.
- [ ] Commit coherent changes, push one branch, open one PR, inspect all CI jobs and reviews on final head.
- [ ] Stop at the required human bootstrap approval. Do not apply a live ruleset, deploy Preview, retry V5 or make an AI generation call.
