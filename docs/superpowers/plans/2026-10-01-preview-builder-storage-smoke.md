# Preview builder storage smoke implementation plan

> **For agentic workers:** Use TDD and review each task. This plan concerns only the disposable delivery runner; no application or Preview runtime change.

**Goal:** Make the manual Preview builder prove that a standalone refuses a missing NPC root and starts with private, external NPC/document roots before publishing an artifact.

**Architecture:** Prepare one unique runner-temporary parent with private `npc` and `documents` children, exported only to runtime smoke. Reuse a small negative-startup script in the delivery workflow and existing CI standalone lane; keep their positive smoke and browser checks, adding PID/listener identity checks and cleanup. The archive is created exclusively from `.next/standalone` after the smoke, with an explicit runtime-root exclusion check.

**Tech Stack:** GitHub Actions YAML, Bash, Node/Jest source-contract test, Next standalone.

---

### Task 1: Regression contract (RED)

**Files:** `__tests__/scripts/preview-artifact-builder-guards.test.ts`

- [ ] Add assertions that the delivery workflow creates a private unique runtime root outside standalone, exports both canonical paths before the smoke, runs the negative control on the same built standalone, checks PID/readiness, and publishes only after successful smoke.
- [ ] Run this targeted Jest test and record its expected failure on the existing workflow.

### Task 2: Minimal smoke repair (GREEN)

**Files:** `.github/workflows/preview-artifact.yml`, `.github/workflows/ci.yml`, `scripts/release/prepare-preview-smoke-storage.sh`, `scripts/release/verify-preview-npc-startup-guard.sh`

- [ ] Add preparation step using `$RUNNER_TEMP`, `mktemp -d`, mode 0700, `realpath`, and `GITHUB_ENV`; verify non-symlink, owner, read/write/traverse and no overlap with checkout/standalone. Use `GITHUB_ENV` only in later steps, or export in the same shell. Compare the remaining startup env with the qualified CI lane and add nothing speculative.
- [ ] Add bounded negative control on the **same built standalone** with all other canonical prereqs: unset only `NPC_STORAGE_ROOT` for a separate server process; require nonzero exit, exact `NPC_STORAGE_PREFLIGHT_FAILED`, no ready/listener; retain bounded raw log without secrets and without filtering away the marker.
- [ ] Wire negative control to the existing CI standalone lane, using its already-built artifact. Keep positive smoke with both roots, disposable DB/Redis, ephemeral secrets, mandatory workers, no supplier; fail early on dead PID, verify port listener ownership and health, release/video identity, CSP, Permissions-Policy, and existing client checks; stop/wait only owned PIDs.
- [ ] Clean only the created temporary parent after preserving proof. Exclude it from the tar source and explicitly check the archive actually built has no runtime roots/data or secrets; preserve existing PDF.js, manifest, SHA/BUILD_ID/digest and secret gates. Publication remains downstream of success.
- [ ] Re-run targeted Jest; run shell syntax and workflow parsing checks.

### Task 3: Proof and PR

**Files:** `docs/audits/2026-10-01-preview-builder-storage-smoke.md`

- [ ] Record run `36927518945` as the original failure and the exact root cause; distinguish local source checks from CI standalone proof.
- [ ] Verify diff scope, tests, and worktree cleanliness; commit and open a targeted PR from current main.
- [ ] Await full CI, request fresh review from `@abenrhouma` on final head. No builder dispatch or Preview mutation before protected merge and post-merge qualification.
- [ ] After applicable approval, protected merge, post-merge CI and source guard, dispatch a new DISABLED builder once; verify its own artifact, then continue the previously authorized isolated rehearsal, Preview cutover and C2 v5 flow or stop at an exact blocker.
