# D0 PR #91 Review Fixes Implementation Plan

> **For agentic workers:** REQUIRED: Use superpowers:subagent-driven-development (if subagents available) or superpowers:executing-plans to implement this plan. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Close the three P1 and two P2 review findings on PR #91 without any real OpenRouter call or C2 implementation.

**Architecture:** Keep the local-first boundary fail-closed. Bind one complete outbound-string scan to the final sanitized payload, preserve immutable evidence provenance, enforce same-competency recommendation grounding by default, and persist sufficient redacted preflight evidence for later audit.

**Tech Stack:** TypeScript, Zod, Jest, native Node.js filesystem and HTTP fakes.

---

### Task 1: Complete outbound PII coverage

**Files:**
- Modify: `lib/bilans/local-first/contracts.ts`
- Modify: `lib/bilans/local-first/pii.ts`
- Test: `__tests__/lib/bilans/local-first.test.ts`
- Test: `__tests__/lib/bilans/local-first-pii.test.ts`

- [ ] Add failing tests proving every outbound string path is scanned and payload-bound.
- [ ] Run the focused tests and confirm the expected failures.
- [ ] Add `collectAllOutboundStringFields` and bind the scan to the final canonical payload.
- [ ] Re-run the focused tests and confirm they pass.

### Task 2: Preserve immutable evidence trust

**Files:**
- Modify: `lib/bilans/local-first/contracts.ts`
- Modify: `content/bilans/benchmarks/synthetic-v1/*.json`
- Test: `__tests__/lib/bilans/local-first.test.ts`

- [ ] Add failing tests for untrusted-to-curated relabeling and altered template/source checksums.
- [ ] Confirm the tests fail for the intended bypass.
- [ ] Require template checksums for curated evidence and exact human approval for quoted untrusted evidence.
- [ ] Regenerate only synthetic fixture checksums and re-run the tests.

### Task 3: Enforce recommendation evidence ownership

**Files:**
- Modify: `lib/bilans/local-first/grounding.ts`
- Test: `__tests__/lib/bilans/local-first-grounding.test.ts`

- [ ] Add a failing cross-competency recommendation test.
- [ ] Confirm the test fails.
- [ ] Reject cross-competency evidence unless both evidence and recommendation opt into the explicit versioned transversal policy.
- [ ] Re-run the grounding suite.

### Task 4: Make Terra diagnosis evidence-based

**Files:**
- Modify: `lib/llm/openrouter/diagnostics.ts`
- Modify: `scripts/bilans/openrouter-terra-diagnostic.ts`
- Test: `__tests__/lib/llm/openrouter/terra-diagnostic.test.ts`
- Test: `__tests__/lib/llm/openrouter/terra-diagnostic-command.test.ts`

- [ ] Add failing tests for transient and incompatible predecessor failures.
- [ ] Confirm the tests fail because the winner alone determines the cause.
- [ ] Add a pure fail-closed classifier and use it in the private command.
- [ ] Re-run the diagnostic suites with the fake server only.

### Task 5: Persist complete redacted preflight proof

**Files:**
- Modify: `scripts/bilans/openrouter-preflight.ts`
- Test: `__tests__/lib/llm/openrouter/preflight-command.test.ts`

- [ ] Add failing assertions for capability snapshots and validity timestamps.
- [ ] Confirm the command test fails.
- [ ] Persist the safe proof fields and per-model results without raw prompts, completions, or secrets.
- [ ] Re-run the command and proof suites.

### Task 6: Verify and publish the fix

- [ ] Run focused OpenRouter and local-first suites.
- [ ] Run global Jest, typecheck, lint, security scan and build.
- [ ] Commit and push the exact reviewed diff.
- [ ] Reply to each review thread with its regression-test evidence.
- [ ] Resolve only verified threads and request a fresh human review.
