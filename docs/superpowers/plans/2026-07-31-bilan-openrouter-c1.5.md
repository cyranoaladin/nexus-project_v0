# C1.5 Benchmark Runner Implementation Plan

> **For agentic workers:** REQUIRED: Use superpowers:subagent-driven-development (if subagents available) or superpowers:executing-plans to implement this plan. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Produce a durable, budget-safe synthetic parent benchmark and the C2 architecture documents without adding runtime persistence or business integration.

**Architecture:** A deterministic campaign identity feeds a persisted balanced schedule. An append-only hash-chained journal and conservative budget ledger surround every network boundary; validation classifies terminal outcomes and produces computed metrics plus a truly blind review package.

**Tech Stack:** TypeScript, Node.js filesystem APIs, Zod, Jest, native fetch/OpenRouter client, Git/GitHub Actions.

---

## Chunk 1: Durable campaign foundation

### Task 1: Run identity and balanced schedule

**Files:**
- Create: `lib/bilans/benchmark/run-identity.ts`
- Create: `lib/bilans/benchmark/schedule.ts`
- Create: `__tests__/lib/bilans/benchmark-run-identity.test.ts`
- Create: `__tests__/lib/bilans/benchmark-schedule.test.ts`

- [ ] Write failing tests for stable `runId`, changed-input invalidation and the 4/4/4 Latin-square position balance.
- [ ] Run the tests and verify the expected missing-module failures.
- [ ] Implement canonical checksums, deterministic attempt keys and persisted planning values.
- [ ] Run the tests and commit the green change.

### Task 2: Append-only journal and resume projection

**Files:**
- Create: `lib/bilans/benchmark/journal.ts`
- Create: `__tests__/lib/bilans/benchmark-journal.test.ts`

- [ ] Write failing tests for directory-before-network, hash chain, fsync-backed append, incompatible run, unknown outcome and duplicate suppression.
- [ ] Verify RED.
- [ ] Implement immutable manifest, NDJSON events and journal projection.
- [ ] Verify GREEN and commit.

## Chunk 2: Budget and outcome integrity

### Task 3: Conservative micro-USD ledger

**Files:**
- Create: `lib/bilans/benchmark/budget-ledger.ts`
- Create: `__tests__/lib/bilans/benchmark-budget-ledger.test.ts`
- Modify: `content/bilans/model-policies/bilan-model-benchmark-policy-v1.json`
- Modify: `lib/llm/openrouter/benchmark-policy.ts`

- [ ] Write failing tests for exact decimal parsing, missing prices, reserve/reconcile, invalid-output cost, transport cost, unknown reserve and pre-call hard stop.
- [ ] Verify RED.
- [ ] Implement integer micro-USD calculations and update warning/hard-stop/max-attempt policy values.
- [ ] Verify GREEN and commit.

### Task 4: Failure classification and computed metrics

**Files:**
- Modify: `lib/bilans/benchmark/runner.ts`
- Create: `lib/bilans/benchmark/metrics.ts`
- Modify: `lib/bilans/local-first/pii.ts`
- Modify: `__tests__/lib/bilans/benchmark-runner.test.ts`
- Create: `__tests__/lib/bilans/benchmark-metrics.test.ts`
- Modify: `__tests__/lib/bilans/local-first-pii.test.ts`

- [ ] Write failing tests for security/quality/transport classification, LLM-generated PII, cost preservation and non-fabricated metrics.
- [ ] Verify RED.
- [ ] Implement classification, terminal outcomes and computed distributions.
- [ ] Verify GREEN and commit.

## Chunk 3: Blind review and campaign orchestration

### Task 5: Sealed human-review package

**Files:**
- Modify: `lib/bilans/benchmark/human-review.ts`
- Modify: `__tests__/lib/bilans/human-review.test.ts`
- Create: `content/bilans/schemas/review-form-v1.schema.json`

- [ ] Write failing tests that prohibit model, provider, generation, cost, latency and key leakage into the reviewer package.
- [ ] Verify RED.
- [ ] Implement separate reviewer/sealed outputs, instructions and blank two-reviewer templates.
- [ ] Verify GREEN and commit.

### Task 6: Resumable network runner and durable Luna preflight

**Files:**
- Modify: `scripts/bilans/openrouter-model-benchmark.ts`
- Modify: `__tests__/lib/llm/openrouter/benchmark-client.test.ts`
- Create: `__tests__/lib/bilans/benchmark-campaign.test.ts`
- Modify: `package.json`

- [ ] Write fake-server tests proving initialization precedes catalog access, preflight persistence, no automatic unknown replay and at most one deferred transport retry.
- [ ] Verify RED.
- [ ] Implement orchestration around identity, schedule, journal and budget modules.
- [ ] Verify GREEN and commit.

## Chunk 4: Governance and C2 documents

### Task 7: Risk disposition and C2 documentation

**Files:**
- Update: `docs/audits/2026-07-31-bilan-openrouter-model-benchmark.md`
- Update: `docs/decisions/bilan-model-policy-v1.2-proposal.md`
- Create: `docs/adr/010-bilan-openrouter-async-generation.md`
- Create: `docs/specs/bilan-openrouter-job-state-machine.md`
- Create: `docs/specs/bilan-openrouter-budget-ledger.md`
- Create: `docs/specs/bilan-openrouter-worker-leases.md`
- Create: `docs/runbooks/bilan-openrouter-worker-rollback.md`

- [ ] Record previous-run invalidation and risk acceptance without claiming automatic-publication approval.
- [ ] Document the future asynchronous architecture without Prisma or worker code.
- [ ] Run documentation checks and commit.

## Chunk 5: Real synthetic execution and branch completion

### Task 8: Verify, commit and execute the fresh campaign

**Files:**
- Private evidence only under `~/.local/share/nexus-release-evidence/`.

- [ ] Run targeted tests, typecheck, lint, security and build.
- [ ] Commit and push the exact clean SHA.
- [ ] Execute the 36-combination synthetic parent campaign from a clean checkout.
- [ ] Verify journal, costs, terminal states and blind package without revealing the sealed key.
- [ ] Update PR #93 with `runId` and computed counters.
- [ ] Update #91 description, mark ready only after green CI, and request a real eligible reviewer.
- [ ] Run and wait for complete CI/CodeQL/GitGuardian/document gates.
