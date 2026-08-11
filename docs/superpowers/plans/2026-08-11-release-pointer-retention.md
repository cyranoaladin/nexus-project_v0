# Canonical Release Pointer and Retention Implementation Plan

> **For agentic workers:** REQUIRED: Use superpowers:subagent-driven-development (if subagents available) or superpowers:executing-plans to implement this plan. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Make one release pointer canonical, keep the compatibility alias synchronized by construction, and document a safe retention policy without deleting releases.

**Architecture:** A generic read-only shell guard validates a canonical symlink and a chained compatibility alias using caller-provided paths. Public documentation uses placeholders; exact topology, inventory and evidence are written to a private root-only runbook on the server.

**Tech Stack:** Bash, Jest/TypeScript, GitHub Actions repository gates, PM2 production topology.

---

## Chunk 1: Versioned pointer contract

### Task 1: Test-drive the generic pointer guard

**Files:**
- Create: `__tests__/scripts/verify-release-pointers.test.ts`
- Create: `scripts/release/verify-release-pointers.sh`

- [ ] **Step 1: Write failing tests**

Cover a valid chained alias plus failures for a direct alias, divergent target,
dangling pointer, target outside the release root and missing standalone entry
point. Execute the real shell script against temporary directories.

- [ ] **Step 2: Run the test and confirm RED**

Run: `npm test -- __tests__/scripts/verify-release-pointers.test.ts --runInBand`

Expected: FAIL because the guard does not exist.

- [ ] **Step 3: Implement the minimal guard**

Accept `--canonical`, `--alias`, `--release-root` and optional
`--expected-release`. Reject unknown or missing arguments, validate raw and
resolved symlink topology, containment and the standalone server entry point.

- [ ] **Step 4: Run the test and confirm GREEN**

Run: `npm test -- __tests__/scripts/verify-release-pointers.test.ts --runInBand`

Expected: all pointer scenarios pass.

### Task 2: Document the generic deployment and retention contracts

**Files:**
- Modify: `DEPLOY_RUNBOOK.md`
- Create: `docs/runbooks/release-retention-policy.md`
- Modify: `__tests__/config/deploy-contract.test.ts`

- [ ] **Step 1: Add failing contract assertions**

Require the public runbook to name the guard with placeholder arguments and
require the retention policy to preserve active plus two distinct compatible
SHAs, exclude duplicate SHA builds from rollback slots and fail closed on
runtime data.

- [ ] **Step 2: Run the contract test and confirm RED**

Run: `npm test -- __tests__/config/deploy-contract.test.ts --runInBand`

Expected: FAIL because the documentation contract is absent.

- [ ] **Step 3: Add minimal public documentation**

Document canonical-first atomic cutover, pre/post-reload guard calls and the
approved retention criteria using placeholders only.

- [ ] **Step 4: Run the contract test and confirm GREEN**

Run: `npm test -- __tests__/config/deploy-contract.test.ts --runInBand`

Expected: all deployment contract tests pass.

## Chunk 2: Private operational application

### Task 3: Secure the unique invoice copy and write private evidence

**Files:**
- Create outside Git: private durable invoice backup, checksum sidecar, private runbook and exact release inventory.

- [ ] **Step 1: Re-resolve the unique file by its approved fingerprint**
- [ ] **Step 2: Copy it without modifying the source into durable root-only storage**
- [ ] **Step 3: Set owner `root:root`, mode `0600`, reread it and compare checksums**
- [ ] **Step 4: Write the exact inventory and document-root mismatch into private mode-0600 evidence**

### Task 4: Chain the compatibility alias without reload

**Files:**
- Modify outside Git: compatibility symlink only.

- [ ] **Step 1: Prove both pointers currently resolve to the active release**
- [ ] **Step 2: Atomically replace the compatibility alias so its raw target is the canonical pointer**
- [ ] **Step 3: Run the generic guard with exact private arguments**
- [ ] **Step 4: Verify PM2 PID/uptime unchanged and health remains green**

## Chunk 3: Verification and publication

### Task 5: Run repository gates

- [ ] **Step 1:** Run both targeted Jest suites.
- [ ] **Step 2:** Run `bash scripts/security/check-no-public-infrastructure.sh`.
- [ ] **Step 3:** Run `npm run lint`, `npm run typecheck` and `git diff --check`.
- [ ] **Step 4:** Review the exact diff and confirm no infrastructure literals or unrelated changes.

### Task 6: Publish the PR

- [ ] **Step 1:** Commit only the guard, tests and generic documentation.
- [ ] **Step 2:** Push `agent/release-pointer-retention`.
- [ ] **Step 3:** Open a draft PR to `main` requesting review from `abenrhouma`.
- [ ] **Step 4:** Do not merge or deploy the versioned changes.
