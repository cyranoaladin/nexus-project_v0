# Official PDF Trace Containment Implementation Plan

> **For agentic workers:** REQUIRED: Use superpowers:subagent-driven-development (if subagents available) or superpowers:executing-plans to implement this plan. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Make the strict production build pass by constraining official PDF file tracing to `programmes/` and rejecting unsafe metadata.

**Architecture:** A pure helper validates registry metadata and returns a POSIX path relative to `programmes/`. The API route keeps the static `process.cwd()/programmes` prefix at the filesystem call site so Next.js can bound `node-file-trace`; existing authentication and profile gating remain unchanged. The Docker builder requires an explicit `RELEASE_SHA` because `.git` is intentionally absent from its context.

**Tech Stack:** Next.js 15 route handlers, TypeScript, Node.js `path.posix`, Jest, Docker BuildKit, Node 22.23.1.

**Specification:** `docs/superpowers/specs/2026-07-20-official-pdf-tracing-design.md`

---

## Chunk 1: Path contract, route integration, and production verification

### Task 0: Commit the approved specification and plan

**Files:**

- Modify: `docs/superpowers/specs/2026-07-20-official-pdf-tracing-design.md`
- Create: `docs/superpowers/plans/2026-07-20-official-pdf-tracing.md`

- [ ] **Step 1: Commit the approved documents before implementation**

```bash
git add \
  docs/superpowers/specs/2026-07-20-official-pdf-tracing-design.md \
  docs/superpowers/plans/2026-07-20-official-pdf-tracing.md
git diff --cached --check
git commit -m "docs: plan official PDF trace containment"
```

Expected: the worktree is clean before Task 1 starts. This documentation commit
remains distinct from the functional commit.

### Task 1: Define the lexical path contract with TDD

**Files:**

- Create: `__tests__/lib/programme/official-pdf-path.test.ts`
- Create: `lib/programme/official-pdf-path.ts`
- Reference: `lib/programme/official-pdfs.ts`

- [ ] **Step 1: Write the failing helper tests**

Create the test file with valid root/subdirectory cases and a table of invalid
raw metadata:

```ts
import { resolveOfficialPdfRelativePath } from '@/lib/programme/official-pdf-path';
import type { OfficialPdfMetadata } from '@/lib/programme/official-pdfs';

const metadata = (
  baseDir: string,
  filename: string,
): OfficialPdfMetadata => ({
  slug: 'test-pdf',
  baseDir,
  filename,
  title: 'Test PDF',
  category: 'PROGRAM',
  level: 'PREMIERE',
  track: 'BOTH',
  source: 'MEN',
});

describe('resolveOfficialPdfRelativePath', () => {
  it.each([
    ['programmes', 'document.pdf', 'document.pdf'],
    [
      'programmes/automatismes-eds-premiere',
      'document.pdf',
      'automatismes-eds-premiere/document.pdf',
    ],
  ])('resolves %s/%s inside the programmes root', (baseDir, filename, expected) => {
    expect(resolveOfficialPdfRelativePath(metadata(baseDir, filename))).toBe(expected);
  });

  it.each([
    ['', 'document.pdf'],
    ['programmes-malicious', 'document.pdf'],
    ['/programmes', 'document.pdf'],
    ['programmes/', 'document.pdf'],
    ['programmes//nested', 'document.pdf'],
    ['programmes/./nested', 'document.pdf'],
    ['programmes/../secrets', 'document.pdf'],
    ['programmes\\nested', 'document.pdf'],
    ['programmes\0nested', 'document.pdf'],
    ['programmes', ''],
    ['programmes', '.'],
    ['programmes', '..'],
    ['programmes', '../secret.pdf'],
    ['programmes', 'nested/document.pdf'],
    ['programmes', 'nested\\document.pdf'],
    ['programmes', '/tmp/document.pdf'],
    ['programmes', 'document\0.pdf'],
  ])('rejects baseDir=%j and filename=%j', (baseDir, filename) => {
    expect(() => resolveOfficialPdfRelativePath(metadata(baseDir, filename)))
      .toThrow('Invalid official PDF path metadata');
  });
});
```

- [ ] **Step 2: Run the test and verify RED**

Run:

```bash
/home/alaeddine/.nvm/versions/node/v22.23.1/bin/node \
  node_modules/jest/bin/jest.js \
  --config jest.unit.config.js \
  --runInBand \
  __tests__/lib/programme/official-pdf-path.test.ts
```

Expected: FAIL because `@/lib/programme/official-pdf-path` does not exist.

- [ ] **Step 3: Implement the minimal pure helper**

Create `lib/programme/official-pdf-path.ts`:

```ts
import { posix } from 'node:path';

import type { OfficialPdfMetadata } from './official-pdfs';

const INVALID_METADATA_MESSAGE = 'Invalid official PDF path metadata';

function failInvalidMetadata(): never {
  throw new Error(INVALID_METADATA_MESSAGE);
}

export function resolveOfficialPdfRelativePath(
  metadata: OfficialPdfMetadata,
): string {
  const { baseDir, filename } = metadata;

  if (
    baseDir.length === 0
    || filename.length === 0
    || baseDir.includes('\\')
    || filename.includes('\\')
    || baseDir.includes('\0')
    || filename.includes('\0')
  ) {
    failInvalidMetadata();
  }

  if (baseDir !== 'programmes' && !baseDir.startsWith('programmes/')) {
    failInvalidMetadata();
  }

  const baseSegments = baseDir.split('/');
  if (baseSegments.some((segment) => (
    segment.length === 0 || segment === '.' || segment === '..'
  ))) {
    failInvalidMetadata();
  }

  if (
    filename === '.'
    || filename === '..'
    || filename.includes('/')
    || posix.isAbsolute(filename)
  ) {
    failInvalidMetadata();
  }

  const relativePath = posix.join(...baseSegments.slice(1), filename);
  if (
    relativePath.length === 0
    || relativePath === '..'
    || relativePath.startsWith('../')
    || posix.isAbsolute(relativePath)
  ) {
    failInvalidMetadata();
  }

  return relativePath;
}
```

- [ ] **Step 4: Run the helper tests and verify GREEN**

Run the Step 2 command again.

Expected: one suite passes with all helper cases.

### Task 2: Integrate the helper at the route filesystem boundary

**Files:**

- Modify: `__tests__/api/student.resources.official.route.test.ts`
- Modify: `app/api/student/resources/official/[slug]/route.ts`
- Test: `__tests__/lib/programme/official-pdf-path.test.ts`

- [ ] **Step 1: Add exact filesystem and serialization mocks**

Add these top-level mocks before imports:

```ts
jest.mock('fs/promises', () => ({
  stat: jest.fn(),
  readFile: jest.fn(),
}));

jest.mock('@/lib/utils/serialize-error', () => ({
  serializeError: jest.fn(() => ({ message: 'redacted' })),
}));
```

Import and bind them after the existing application imports:

```ts
import { readFile, stat } from 'fs/promises';
import { serializeError } from '@/lib/utils/serialize-error';

const mockStat = jest.mocked(stat);
const mockReadFile = jest.mocked(readFile);
const mockSerializeError = jest.mocked(serializeError);
```

- [ ] **Step 2: Configure successful filesystem defaults**

Add to `beforeEach`:

```ts
mockStat.mockResolvedValue({ size: fakePdfBuffer.length } as never);
mockReadFile.mockResolvedValue(fakePdfBuffer as never);
```

- [ ] **Step 3: Align suite names and the documented case count**

Rename `Filesystem behavior (real FS)` to `Filesystem behavior (mocked)`,
rename `Happy path (integration)` to `Happy path`, and update the file header
from 10 to 11 cases.

- [ ] **Step 4: Rewrite the missing-file case**

```ts
it('returns 404 when the PDF file is missing on disk', async () => {
  setupValidEdsRequest();
  mockStat.mockRejectedValueOnce(new Error('missing'));

  const res = await GET(buildReq(edsAutoSlug), buildCtx(edsAutoSlug));

  expect(res.status).toBe(404);
  expect(mockReadFile).not.toHaveBeenCalled();
});
```

- [ ] **Step 5: Rewrite the unexpected-filesystem-error case**

```ts
it('returns 500 when reading the PDF fails unexpectedly', async () => {
  setupValidEdsRequest();
  mockReadFile.mockRejectedValueOnce(new Error('read failure'));

  const res = await GET(buildReq(edsAutoSlug), buildCtx(edsAutoSlug));

  expect(res.status).toBe(500);
  expect(mockSerializeError).toHaveBeenCalled();
});
```

- [ ] **Step 6: Add the failing invalid-metadata route test**

```ts
it('rejects invalid PDF metadata before filesystem access', async () => {
  setupValidEdsRequest();
  mockGetPdf.mockReturnValue({
    ...edsAutoMeta,
    baseDir: 'programmes/../secrets',
  });

  const res = await GET(buildReq(edsAutoSlug), buildCtx(edsAutoSlug));
  const body = await res.json();

  expect(res.status).toBe(500);
  expect(body).toEqual({ error: 'Internal server error' });
  expect(JSON.stringify(body)).not.toContain(process.cwd());
  expect(mockSerializeError).toHaveBeenCalled();
  expect(mockStat).not.toHaveBeenCalled();
  expect(mockReadFile).not.toHaveBeenCalled();
});
```

- [ ] **Step 7: Run the route test and verify RED**

```bash
/home/alaeddine/.nvm/versions/node/v22.23.1/bin/node \
  node_modules/jest/bin/jest.js \
  --config jest.unit.config.js \
  --runInBand \
  __tests__/api/student.resources.official.route.test.ts
```

Expected: 10 cases pass and the new invalid-metadata case fails because the
route still reaches `stat`.

- [ ] **Step 8: Anchor the route path to the static programmes root**

Import `resolveOfficialPdfRelativePath` and replace the existing dynamic join:

```ts
const filePath = join(
  process.cwd(),
  'programmes',
  resolveOfficialPdfRelativePath(pdfMetadata),
);
```

Remove the unused `fileStats` variable and keep `await stat(filePath)` as the
existence check.

- [ ] **Step 9: Run both focused suites and verify GREEN**

```bash
/home/alaeddine/.nvm/versions/node/v22.23.1/bin/node \
  node_modules/jest/bin/jest.js \
  --config jest.unit.config.js \
  --runInBand \
  __tests__/lib/programme/official-pdf-path.test.ts \
  __tests__/api/student.resources.official.route.test.ts
```

Expected: 2 suites and 30 tests pass.

- [ ] **Step 10: Keep the cohesive functional change uncommitted until the Docker contract is green**

Run `git diff --check` and confirm only the helper, route and their two tests
are modified; the approved documents are already committed. Task 3 adds the
dependent Docker provenance contract before one cohesive functional commit is
created.

### Task 3: Require explicit release provenance in Docker

**Files:**

- Modify: `__tests__/config/deploy-contract.test.ts`
- Modify: `Dockerfile`

- [ ] **Step 1: Write the failing Docker provenance contract**

Add to `production deployment contract`:

```ts
it('requires an explicit release SHA for the builder gate', () => {
  const dockerfile = read('Dockerfile');
  const dockerignore = read('.dockerignore');
  const builderAndRunner = dockerfile.split('FROM base AS builder')[1];
  const [builderStage, runnerStage] = builderAndRunner.split('FROM base AS runner');

  expect(dockerignore.split(/\r?\n/)).toContain('.git');
  expect(builderStage).toContain('ARG RELEASE_SHA');
  expect(builderStage).not.toMatch(/ARG RELEASE_SHA\s*=/);
  expect(builderStage).toContain(
    "grep -Eq '^[0-9a-fA-F]{40}([0-9a-fA-F]{24})?$'",
  );
  expect(builderStage).toContain('RELEASE_SHA="$RELEASE_SHA" npm run build');
  expect(runnerStage).not.toContain('ENV RELEASE_SHA');
  expect(runnerStage).toContain(
    'COPY --from=builder /app/release-manifest.json ./release-manifest.json',
  );
});
```

- [ ] **Step 2: Run the contract test and verify RED**

```bash
/home/alaeddine/.nvm/versions/node/v22.23.1/bin/node \
  node_modules/jest/bin/jest.js \
  --config jest.unit.config.js \
  --runInBand \
  __tests__/config/deploy-contract.test.ts
```

Expected: FAIL because `Dockerfile` does not declare or propagate
`RELEASE_SHA`.

- [ ] **Step 3: Propagate the SHA only to the build command**

Declare `ARG RELEASE_SHA` without a default in the builder stage and replace
`RUN npm run build` with:

```dockerfile
RUN printf '%s' "$RELEASE_SHA" \
      | grep -Eq '^[0-9a-fA-F]{40}([0-9a-fA-F]{24})?$' \
    && RELEASE_SHA="$RELEASE_SHA" npm run build
```

In the runner stage, copy the generated provenance file:

```dockerfile
COPY --from=builder /app/release-manifest.json ./release-manifest.json
```

Do not add `RELEASE_SHA` as a runner `ENV` and do not provide a fake default.

- [ ] **Step 4: Run the contract and focused tests GREEN**

Run the Docker contract command from Step 2, then the two-suite command from
Task 2 Step 9.

Expected: the deployment-contract command reports 1 suite and 7 tests passed;
the focused command reports 2 suites and 30 tests passed. Aggregate: 3 suites
and 37 tests.

- [ ] **Step 5: Commit the cohesive functional change and its plan**

```bash
git add \
  Dockerfile \
  lib/programme/official-pdf-path.ts \
  'app/api/student/resources/official/[slug]/route.ts' \
  __tests__/lib/programme/official-pdf-path.test.ts \
  __tests__/api/student.resources.official.route.test.ts \
  __tests__/config/deploy-contract.test.ts
git diff --cached --check
git commit -m "fix(build): constrain official PDF file tracing"
```

### Task 4: Verify the repository and final production image

**Files:**

- Verify: `.next/server/app/api/student/resources/official/[slug]/route.js.nft.json`
- Verify: `.next/standalone`
- No source changes expected.

- [ ] **Step 1: Run static and security gates**

```bash
/home/alaeddine/.nvm/versions/node/v22.23.1/bin/node node_modules/typescript/bin/tsc --noEmit
env PATH=/home/alaeddine/.nvm/versions/node/v22.23.1/bin:$PATH npm run lint
env PATH=/home/alaeddine/.nvm/versions/node/v22.23.1/bin:$PATH npm run security:repo
git diff --check
```

Expected: all commands exit 0. Existing lint warnings may remain, but no new
warning may originate from the five changed TypeScript files.

- [ ] **Step 2: Run the complete unit suite**

```bash
/home/alaeddine/.nvm/versions/node/v22.23.1/bin/node \
  node_modules/jest/bin/jest.js \
  --config jest.unit.config.js \
  --runInBand \
  --silent
```

Expected: all non-skipped suites pass.

- [ ] **Step 3: Build the exact final production image**

```bash
docker build \
  --build-arg RELEASE_SHA="$(git rev-parse HEAD)" \
  -t nexus-project-v0-official-pdf-trace-verify .
```

Expected: the builder's `npm run build` and both artifact audits exit 0, the
runner stage completes, and the final image is created.

- [ ] **Step 4: Inspect the built route manifest**

Run exactly:

```bash
trace_tmp_dir=$(mktemp -d)
trace_container=$(docker create nexus-project-v0-official-pdf-trace-verify)
cleanup_trace() {
  docker rm -f "$trace_container" >/dev/null 2>&1 || true
  rm -rf "$trace_tmp_dir"
}
trap cleanup_trace EXIT

docker cp \
  "$trace_container:/app/.next/server/app/api/student/resources/official/[slug]/route.js.nft.json" \
  "$trace_tmp_dir/route.js.nft.json"
docker cp \
  "$trace_container:/app/release-manifest.json" \
  "$trace_tmp_dir/release-manifest.json"

jq -e '.files | length <= 500' "$trace_tmp_dir/route.js.nft.json"
jq -e 'any(.files[]; test("programmes/.*\\.pdf$"))' \
  "$trace_tmp_dir/route.js.nft.json"
jq -e '
  all(.files[];
    (test(
      "(^|/)(\\.git|\\.worktrees|__tests__|__mocks__|e2e|fixtures?)(/|$)|" +
      "(^|/)(Dockerfile[^/]*|docker-compose[^/]*)$|" +
      "\\.(pem|key|p12|pfx|bak|dump|sql\\.gz)$";
      "i"
    ) | not)
  )
' "$trace_tmp_dir/route.js.nft.json"
jq -e '
  [.files[]
    | split("/")[-1]
    | select(
        test("^\\.env"; "i")
        and (test("\\.(example|sample|template)$"; "i") | not)
      )
  ] | length == 0
' "$trace_tmp_dir/route.js.nft.json"
jq -e '
  all(.files[];
    (test("^/home/|^/Users/|^C:\\\\Users\\\\"; "i") | not)
  )
' "$trace_tmp_dir/route.js.nft.json"
expected_release_sha=$(git rev-parse HEAD)
jq -e --arg sha "$expected_release_sha" '
  .ARTIFACT_VERIFIED == true and .RELEASE_SHA == $sha
' "$trace_tmp_dir/release-manifest.json"
```

The six `jq -e` commands assert that:

- `.files | length` is at most 500;
- at least one entry matches `programmes/.*\\.pdf$`;
- no entry matches `.git`, `__tests__`, `__mocks__`, `e2e`, fixtures,
  `.worktrees`, `Dockerfile`, `docker-compose`, secret-key extensions,
  backup/dump extensions, real `.env` files or an absolute developer path ;
- the final runner contains a verified release manifest with exactly the local
  HEAD supplied to Docker.

Expected: all assertions succeed. Keep the local verification image as a
reusable build-cache artifact.

- [ ] **Step 5: Confirm Git state before publication**

```bash
git fetch --prune origin
git status --short
git rev-list --left-right --count origin/fix/lockfix-node22-deps...HEAD
```

Expected: clean worktree and no remote commits missing locally.

### Task 5: Final review and publication

**Files:**

- Review: commits after `c7b3ab22`
- No source changes expected unless review finds a verified defect.

- [ ] **Step 1: Request final code review**

Review `c7b3ab22..HEAD`, emphasizing trace containment, path traversal,
unchanged access control, test quality and strict audit results.

Expected: no P0/P1/P2 finding. Valid findings return to the relevant TDD step
and all gates are re-run.

- [ ] **Step 2: Push without force**

```bash
git push -u origin fix/lockfix-node22-deps
```

- [ ] **Step 3: Verify remote synchronization**

```bash
git fetch --prune origin
git rev-list --left-right --count origin/fix/lockfix-node22-deps...HEAD
git rev-parse HEAD
git rev-parse origin/fix/lockfix-node22-deps
git status --short
```

Expected: `0 0`, identical hashes and clean worktree.
