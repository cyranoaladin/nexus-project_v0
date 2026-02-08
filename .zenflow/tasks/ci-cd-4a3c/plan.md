# Full SDD workflow

## Configuration
- **Artifacts Path**: {@artifacts_path} → `.zenflow/tasks/{task_id}`

---

## Workflow Steps

### [x] Step: Requirements
<!-- chat-id: c9d2ae6a-279a-499a-b972-c03a4d984d51 -->

Create a Product Requirements Document (PRD) based on the feature description.

1. Review existing codebase to understand current architecture and patterns
2. Analyze the feature definition and identify unclear aspects
3. Ask the user for clarifications on aspects that significantly impact scope or user experience
4. Make reasonable decisions for minor details based on context and conventions
5. If user can't clarify, make a decision, state the assumption, and continue

Save the PRD to `{@artifacts_path}/requirements.md`.

### [x] Step: Technical Specification
<!-- chat-id: c847d2e0-aaad-4707-b154-b1945b821e08 -->

Create a technical specification based on the PRD in `{@artifacts_path}/requirements.md`.

1. Review existing codebase architecture and identify reusable components
2. Define the implementation approach

Save to `{@artifacts_path}/spec.md` with:
- Technical context (language, dependencies)
- Implementation approach referencing existing code patterns
- Source code structure changes
- Data model / API / interface changes
- Delivery phases (incremental, testable milestones)
- Verification approach using project lint/test commands

### [x] Step: Planning
<!-- chat-id: 9c4d6910-cddb-43e9-b0ec-0fa8b2ae82f6 -->

Create a detailed implementation plan based on `{@artifacts_path}/spec.md`.

1. Break down the work into concrete tasks
2. Each task should reference relevant contracts and include verification steps
3. Replace the Implementation step below with the planned tasks

Rule of thumb for step size: each step should represent a coherent unit of work (e.g., implement a component, add an API endpoint, write tests for a module). Avoid steps that are too granular (single function) or too broad (entire feature).

If the feature is trivial and doesn't warrant full specification, update this workflow to remove unnecessary steps and explain the reasoning to the user.

Save to `{@artifacts_path}/plan.md`.

---

## Implementation Steps

### [x] Step: Pre-Flight Verification
<!-- chat-id: e67e9330-2dca-4239-91b7-c439eba9d00b -->
<!-- Verify current state before making changes -->

**Objective**: Ensure safe execution by verifying current state and connectivity

**Tasks**:
1. Navigate to main project directory: `/home/alaeddine/Bureau/nexus-project_v0`
2. Check git status to review uncommitted changes
3. Verify remote connection: `git fetch origin`
4. Confirm main branch is up-to-date with `origin/main`
5. Review which worktrees have been merged (check SYNC_COMPLETE_REPORT.md)

**Verification**:
- `git status` shows clear list of modified files
- `git remote -v` confirms GitHub remote URL
- `git fetch origin` succeeds without errors
- No unexpected divergence between local and remote

**Success Criteria**:
- GitHub authentication working
- Current state is understood
- Ready to proceed with changes

### [x] Step: Update .gitignore Configuration
<!-- chat-id: 75b1b022-eb44-49bb-b516-8c895c866778 -->

**Objective**: Prevent build artifacts from being committed

**Tasks**:
1. Review current `.gitignore` file
2. Add `tsconfig.tsbuildinfo` to the build artifacts section
3. Verify the file is properly excluded after update

**Changes**:
Add under "# Build artifacts" section:
```
tsconfig.tsbuildinfo
```

**Verification**:
- Run `git status` - `tsconfig.tsbuildinfo` should no longer appear as modified
- Confirm `.gitignore` itself appears as modified

**Success Criteria**:
- Build cache file is properly excluded
- `.gitignore` ready to be committed

### [ ] Step: Review Uncommitted Changes

**Objective**: Validate all changes before staging

**Tasks**:
1. Review each modified file with `git diff`:
   - `.gitignore` (new addition)
   - `.eslintrc.json` (configuration updates)
   - `tsconfig.json` (compiler options)
   - `jest.setup.js` (test setup)
   - All test files in `__tests__/`
   - E2E test: `e2e/parent-dashboard-api-test.spec.ts`
2. Verify no secrets, credentials, or sensitive data in changes
3. Confirm changes align with recent worktree merge activity

**Verification**:
- `git diff <file>` for each modified file
- Visual inspection for sensitive data patterns
- Changes make sense in context of worktree consolidation

**Success Criteria**:
- All changes are intentional and safe to commit
- No accidental modifications identified
- Ready to stage changes

### [ ] Step: Stage Changes for Commit

**Objective**: Prepare validated changes for commit

**Tasks**:
1. Stage `.gitignore` first: `git add .gitignore`
2. Stage configuration files: `git add .eslintrc.json tsconfig.json jest.setup.js`
3. Stage all test files: `git add __tests__/ e2e/parent-dashboard-api-test.spec.ts`
4. Verify staging with `git status`
5. Review staged changes: `git diff --cached`

**Verification**:
- `git status` shows all intended files in "Changes to be committed"
- `git diff --cached` shows complete diff of staged changes
- No unintended files are staged
- `tsconfig.tsbuildinfo` is NOT staged (excluded by .gitignore)

**Success Criteria**:
- All validated changes are staged
- No build artifacts are staged
- Ready to commit

### [ ] Step: Commit Changes

**Objective**: Create commit with proper message following project conventions

**Tasks**:
1. Create commit using conventional commits format
2. Use commit message template from spec.md
3. Verify commit with `git show HEAD`

**Commit Message**:
```
chore: update configurations and tests after worktree consolidation

- Update .gitignore to exclude TypeScript build cache
- Update ESLint and TypeScript configurations
- Update Jest setup and test files
- Improve E2E test stability for parent dashboard

Related to CI/CD workflow task ci-cd-4a3c
```

**Verification**:
- `git show HEAD` displays commit with correct message and changes
- `git log -1 --stat` shows summary of changed files
- Commit follows conventional commits format (`chore:` prefix)

**Success Criteria**:
- Changes are committed locally
- Commit message is clear and traceable
- Ready for pre-push verification

### [ ] Step: Pre-Push Verification

**Objective**: Validate changes before pushing to remote

**Tasks**:
1. Verify commit integrity: `git show HEAD`
2. Check remote state: `git fetch origin`
3. Compare local and remote: `git log origin/main..HEAD`
4. Run code quality checks:
   - `npm run lint` (if available)
   - `npm run typecheck` (if available)
5. Verify no conflicts or divergence

**Verification**:
- Commit contains only intended changes
- Remote hasn't diverged (no new commits on origin/main)
- Lint and typecheck pass (if commands exist)
- Local main is ahead of origin/main by exactly 1 commit

**Success Criteria**:
- Code quality checks pass
- No remote conflicts
- Safe to push

**Note**: If lint/typecheck commands don't exist, skip those checks and proceed.

### [ ] Step: Push to GitHub

**Objective**: Synchronize local changes with remote repository

**Tasks**:
1. Push changes: `git push origin main`
2. Verify push success
3. Check remote status: `git log origin/main -1`

**Verification**:
- Push completes without errors
- No authentication failures
- No rejected push messages

**Success Criteria**:
- Push successful
- Remote updated with local commit
- `origin/main` matches local `main`

**Error Handling**:
- If authentication fails: Verify SSH keys or HTTPS credentials
- If push rejected: Someone pushed to remote → fetch, review, handle merge
- If network issues: Retry after connectivity restored

### [ ] Step: Post-Push Verification and Cleanup

**Objective**: Confirm successful completion and clean state

**Tasks**:
1. Verify working tree is clean: `git status`
2. Confirm local and remote are aligned
3. Verify commit appears on GitHub (optional: check web interface)
4. Document completion by marking this step complete in plan.md

**Verification**:
- `git status` shows "Your branch is up to date with 'origin/main'"
- `git status` shows "nothing to commit, working tree clean"
- `git log origin/main -1` shows the commit just pushed

**Success Criteria**:
- Working tree is clean
- Local and remote are synchronized
- Task successfully completed

**Final Notes**:
- All worktree changes have been committed and pushed
- Build artifacts are properly excluded via .gitignore
- Commit history maintains traceability to ci-cd-4a3c task
