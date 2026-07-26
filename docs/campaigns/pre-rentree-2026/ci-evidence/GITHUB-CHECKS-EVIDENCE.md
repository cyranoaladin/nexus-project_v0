# PR #82 — GitHub checks evidence

## Evidence scope

```text
Stage candidate PR: #79
Stage candidate SHA: d857160381b26b82ff52901cbdc8d8062975cbba
CI evidence PR: #82
CI evidence base: release/pre-rentree-2026-public-ready
Qualified workflow SHA: 406ed1a0c74261927cfad16a867d4ae9eb937eb1
CI Pipeline run: 30205968643
Document workflow run: 30205968671
PR79_HEAD_UNCHANGED=true
BILAN_REHEARSAL_ON_PR79_STILL_VALID=true
CI_EVIDENCE_PR_NOT_PART_OF_STAGE_CANDIDATE=true
```

This evidence run started all ten jobs in the strict CI DAG even though
Dependency Integrity failed. No required CI job was skipped, cancelled, or
absent.

## Results

| Check | Result | Executed | Skipped | Duration | Blocking | Evidence |
| --- | --- | --- | --- | ---: | --- | --- |
| Dependency Integrity | failure | yes | no | 50 s | yes | [job 89803960020](https://github.com/cyranoaladin/nexus-project_v0/actions/runs/30205968643/job/89803960020) |
| Lint | success | yes | no | 1 min 12 s | yes | [job 89803960015](https://github.com/cyranoaladin/nexus-project_v0/actions/runs/30205968643/job/89803960015) |
| TypeScript Type Check | success | yes | no | 1 min 45 s | yes | [job 89803960009](https://github.com/cyranoaladin/nexus-project_v0/actions/runs/30205968643/job/89803960009) |
| Unit Tests | success | yes | no | 2 min 26 s | yes | [job 89803960031](https://github.com/cyranoaladin/nexus-project_v0/actions/runs/30205968643/job/89803960031) |
| Integration Tests | success | yes | no | 1 min 27 s | yes | [job 89803960025](https://github.com/cyranoaladin/nexus-project_v0/actions/runs/30205968643/job/89803960025) |
| Real DB Integration | success | yes | no | 1 min 9 s | yes | [job 89803960008](https://github.com/cyranoaladin/nexus-project_v0/actions/runs/30205968643/job/89803960008) |
| E2E Tests | success | yes | no | 5 min 13 s | yes | [job 89803960034](https://github.com/cyranoaladin/nexus-project_v0/actions/runs/30205968643/job/89803960034) |
| Security Scan | failure | yes | no | 4 min 11 s | yes | [job 89803960037](https://github.com/cyranoaladin/nexus-project_v0/actions/runs/30205968643/job/89803960037) |
| Production Build | success | yes | no | 4 min 24 s | yes | [job 89803960032](https://github.com/cyranoaladin/nexus-project_v0/actions/runs/30205968643/job/89803960032) |
| Documents (strict CI DAG) | success | yes | no | 38 s | yes | [job 89803960045](https://github.com/cyranoaladin/nexus-project_v0/actions/runs/30205968643/job/89803960045) |
| CI Success | failure | yes | no | 5 s | yes | [job 89804436972](https://github.com/cyranoaladin/nexus-project_v0/actions/runs/30205968643/job/89804436972) |
| Pré-rentrée document workflow | success | yes | no | 18 min 39 s | yes | [job 89803959916](https://github.com/cyranoaladin/nexus-project_v0/actions/runs/30205968671/job/89803959916) |
| GitGuardian Security Checks | success | yes | no | 1 s | yes | GitGuardian check on qualified SHA |

## PostgreSQL proof

The dedicated real-database job used an ephemeral
`pgvector/pgvector:pg16` service and a per-run, non-secret password derived from
the GitHub run context. It reported:

```text
51 migrations found in prisma/migrations
All migrations have been successfully applied.
Test Suites: 3 passed, 3 total
Tests:       10 passed, 10 total
```

The executed paths were:

```text
__tests__/integration/activate-student.real.test.ts
__tests__/integration/predict-ownership.real.test.ts
__tests__/security/idor-real.test.ts
```

The protected Bilan suite was not selected.

## Blocking evidence

Dependency Integrity failed on the unchanged complete dependency audit:

```text
brace-expansion <=5.0.7
GHSA-mh99-v99m-4gvg
36 high severity vulnerabilities
```

Security Scan independently reached OSV Scanner and failed on the same
advisory (`brace-expansion@1.1.16`, development dependency group). No warning,
waiver, threshold reduction, or `continue-on-error` was added.

`CI Success` executed under `always()` and reported:

```text
FAIL dependency-integrity: failure
OK lint: success
OK typecheck: success
OK unit: success
OK integration: success
OK real-db-integration: success
OK e2e: success
FAIL security: failure
OK build: success
OK documents: success
```

The final aggregator therefore stayed red for the two security failures while
preserving the complete non-dependency evidence.

## External workflow note

CodeQL is not emitted for a pull request whose base is the stacked release
branch under the repository's current separate workflow trigger. It remains a
release check on PR #79, not a member of this stacked CI DAG. No CodeQL setting
or workflow was changed by PR #82.

## Draft and merge state

PR #82 is Draft, targets
`release/pre-rentree-2026-public-ready`, and is not merged. PR #79 remains on
its original SHA. No release status, GO metadata, tag, deployment, or Bilan
branch was changed.
