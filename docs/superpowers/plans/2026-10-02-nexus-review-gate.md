# Nexus Review Gate Implementation Plan

> **For agentic workers:** REQUIRED: Use superpowers:subagent-driven-development (if subagents available) or superpowers:executing-plans to implement this plan. Steps use checkbox (`- [ ]`) syntax for tracking.

**Current goal:** Prove the minimal App → installation token → exact-SHA Check Run chain on one bootstrap PR, without changing the live ruleset. Tasks below concerning a review verdict, model, governance apply, and auto-merge are deferred until the foundation's real post-merge proof is read back.

**Current architecture:** A `workflow_run` proof workflow loaded from default-branch `main` runs only after successful push CI on `main`. It creates an `action_required` Check Run on that upstream SHA using a short-lived, repository-scoped App token. It reads the Check Run back with a separate native read token and verifies App ID `5166727`, slug `nexus-review-gate`, exact SHA and name. It never claims a review PASS. A future production reviewer can use a separate `workflow_run` evaluator; it is not activated by this proof.

**Tech Stack:** Node.js ESM, Jest governance suite, GitHub REST, GitHub Actions. Local AI is deferred.

## Current foundation slice (execute now)

- [x] Verify App registration and installation (`167301397`), selected-only repository, and actual permissions (`metadata:read`, `checks:write`) from the owner's GitHub installation evidence.
- [x] Verify official `actions/create-github-app-token` v3.2.0 commit `bcd2ba49218906704ab6c1aa796996da409d3eb1`; use `client-id` and `permission-checks: write`, with owner/repositories omitted to constrain the installation token to the current repo.
- [x] RED → GREEN Jest tests for expected/wrong App ID, exact/stale SHA, Actions same-name source, missing installation/token, API errors, and malformed responses.
- [x] Add trusted-main `workflow_run` identity proof after successful `CI Pipeline` push on main. It checks out only the workflow's `github.sha`, never a PR head; it does not install or run PR code.
- [x] Run full governance tests, offline audit, and syntax checks.
- [ ] Confirm CI on the bootstrap PR's final head.
- [ ] Obtain the current human bootstrap review and merge under the unchanged live ruleset.
- [ ] Only after merge, let successful main CI trigger the proof; verify token creation and read back the App-owned `action_required` check on the merge SHA. Do not apply the ruleset.

---

## Deferred review-gate roadmap (not part of the identity proof)

The following tasks are not prerequisites to opening the narrowly scoped foundation PR. They require a separate review checkpoint after the actual App-owned Check Run is verified. Do not interpret unchecked boxes below as already implemented.

## Chunk 1: Pure policy and tests

### Task 1: Exact-head and review evidence

**Files:** Create `scripts/github/review-gate/policy.mjs`; test `__tests__/governance/review-gate-policy.test.js`.

- [ ] Write failing tests for matching head, stale review, changed head, absent review, unresolved thread, applicable `CHANGES_REQUESTED`, missing/failed/wrong-producer CI, and normal success.
- [ ] Run `npm run test:governance -- --runTestsByPath __tests__/governance/review-gate-policy.test.js` and confirm RED for missing behavior.
- [ ] Implement the smallest pure evaluator with explicit verdict codes; rerun and confirm GREEN.
- [ ] Add sensitive-path, destructive migration, large diff, and human-exception tests; observe RED then implement and confirm GREEN.

### Task 2: Strict local model contract

**Files:** Create `scripts/github/review-gate/model.mjs`; test `__tests__/governance/review-gate-model.test.js`.

- [ ] Write failing tests for valid JSON, malformed JSON, non-object/extra fields, unsafe `review_complete`, blocking findings, low confidence, timeout, and truncated input.
- [ ] Run the focused test and confirm RED; implement strict parser and bounded subprocess call; rerun GREEN.
- [ ] Pin model revision, SHA-256, runtime commit, prompt/context limits, and file-byte verification. Keep PR text out of shell interpolation and logs.

## Chunk 2: Trusted GitHub boundary

### Task 3: Read-only evidence collector and App publisher

**Files:** Create `scripts/github/review-gate/github.mjs`, `scripts/github/review-gate/run.mjs`; tests `__tests__/governance/review-gate-github.test.js`.

- [ ] Write RED tests for unique PR resolution, paginated diff/checks/threads/reviews, exact producer IDs, stale head on final reread, and App-token-only check publication.
- [ ] Implement bounded API access; use the pinned official App-token action rather than a custom JWT→installation-token flow. Never log private key/token. No PR checkout or executable artifact handling.
- [ ] Confirm GREEN. In a trusted publish step, re-read head and CI immediately before a `success` conclusion.

### Task 4: Workflow and automation

**Files:** Create `.github/workflows/nexus-review-gate.yml`; modify or reuse `scripts/github/arm-auto-merge.mjs`; tests `__tests__/governance/review-gate-workflow.test.js`.

- [ ] Write RED workflow-contract tests for default-branch `workflow_run`, no untrusted checkout/execution/cache, minimal permissions, bounded model/runtime, App secret isolated from model execution, and scheduled exception re-evaluation.
- [ ] Implement workflow, automatic MERGE arming for normal successful PRs, and safe branch update using `expected_head_sha` only for clean/behind PRs; test stale/conflict refusal.
- [ ] Confirm GREEN; document that pre-merge CI tests logic but cannot activate `workflow_run` until merge.

## Chunk 3: Governance-as-code

### Task 5: Desired policy, schemas, and audit

**Files:** Modify `.github/CODEOWNERS`, `.github/governance/{review-policy,main-ruleset,checks-registry}.json`, their schemas, `scripts/github/audit-governance.mjs`; tests under `__tests__/governance/`.

- [ ] Write RED tests that routine paths need no human review, sensitive paths do, required approval target is zero, last-push false, threads true, existing checks retained, gate integration ID bound, bypass actors empty.
- [ ] Implement desired state plus a time-bounded, exactly specified legacy→target transition for the live audit. The real App ID is a prerequisite for a CI-green bootstrap PR; never use a fabricated integer.
- [ ] Confirm GREEN and governance offline audit consistency.

### Task 6: Bounded apply/rollback

**Files:** Modify `scripts/github/apply-governance.mjs`; test `__tests__/governance/apply-governance.test.js`.

- [ ] Write RED tests for review fields, required check delta, App ID verification, exact prestate, idempotence, post-read, and rollback of a partial/mismatched write.
- [ ] Implement narrowly scoped read-modify-write. Dry-run must perform zero writes; live apply remains unused in bootstrap.
- [ ] Confirm GREEN and run the full governance suite.

## Chunk 4: PR and operational proof

### Task 7: Verification and bootstrap PR

- [ ] Run focused tests, full `npm run test:governance`, offline governance audit, workflow syntax/security checks, lint/typecheck as relevant. No local heavy application build.
- [ ] Reinspect worktree diff and secret scan; commit coherent changes, push branch, open one bootstrap PR; preserve current ruleset.
- [ ] Confirm PR CI and independent review on final head. Record any App/UI/model-runner prerequisites honestly; stop for existing human bootstrap approval, not a synthetic approval.

### Task 8: Post-bootstrap (not in this pass before approval)

- [ ] App registration, selected-only installation and Actions credential setup are complete. After human approval: merge, post-merge CI, publish one authentic `action_required` proof check, verify source App ID from the API response.
- [ ] Dry-run/apply governance with snapshot/rollback; live audit; canary head A→B; only then claim no-click routine auto-merge.
