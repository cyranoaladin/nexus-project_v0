import { createHash, randomUUID } from 'node:crypto';
import { execFileSync } from 'node:child_process';
import {
  closeSync,
  constants,
  fstatSync,
  lstatSync,
  mkdirSync,
  openSync,
  readdirSync,
  readFileSync,
  realpathSync,
  renameSync,
  rmSync,
  writeFileSync,
} from 'node:fs';
import {
  basename,
  dirname,
  isAbsolute,
  join,
  relative,
  resolve,
  sep,
} from 'node:path';
import { z } from 'zod';

export const ARIA_RAG_CONTRACT_FILENAMES = Object.freeze([
  'internal-identity-envelope.json',
  'retrieval-scope-artifact-v3.json',
  'resource-registry-bootstrap-v1.json',
  'resource-registry-snapshot-v1.json',
  'retrieval-error.json',
  'retrieval-request.json',
  'retrieval-response.json',
  'taxonomy-v2-response.json',
  'servable-corpus-index-v1.json',
  'servable-corpus-manifest-v1.json',
] as const);

const ARIA_RAG_CONTRACT_FIXTURES = Object.freeze([
  'internal-identity-envelope-v1.json',
] as const);

const sha256Schema = z.string().regex(/^[0-9a-f]{64}$/);
const gitCommitSchema = z.string().regex(/^[0-9a-f]{40}$/);
const upstreamLockSchema = z.object({
  packageVersion: z.string().regex(/^\d+\.\d+\.\d+$/),
  fixtures: z.record(z.object({
    sha256: sha256Schema,
  }).strict()),
  schemas: z.record(z.object({
    $id: z.string().url(),
    sha256: sha256Schema,
  }).strict()),
}).strict();
const DIRECTORY_FLAGS = constants.O_RDONLY | constants.O_DIRECTORY | constants.O_NOFOLLOW;

function sha256(bytes: Buffer): string {
  return createHash('sha256').update(bytes).digest('hex');
}

function stableJson(value: unknown): Buffer {
  return Buffer.from(`${JSON.stringify(value, null, 2)}\n`, 'utf8');
}

function unsafeTarget(path: string): never {
  throw new Error(`RAG_CONTRACT_IMPORT_UNSAFE_TARGET:${path}`);
}

function isUnsafeTargetError(error: unknown): boolean {
  return error instanceof Error
    && error.message.startsWith('RAG_CONTRACT_IMPORT_UNSAFE_TARGET:');
}

function isNodeError(error: unknown, code: string): boolean {
  return typeof error === 'object'
    && error !== null
    && 'code' in error
    && error.code === code;
}

function descriptorPath(descriptor: number): string {
  return `/proc/${process.pid}/fd/${descriptor}`;
}

function sameInode(
  left: { readonly dev: number | bigint; readonly ino: number | bigint },
  right: { readonly dev: number | bigint; readonly ino: number | bigint },
): boolean {
  return left.dev === right.dev && left.ino === right.ino;
}

function assertSafeTarget(
  repositoryRoot: string,
  target: string,
  expectedKind: 'directory' | 'file',
): void {
  const root = resolve(repositoryRoot);
  const resolvedTarget = resolve(target);
  const relativeTarget = relative(root, resolvedTarget);
  if (
    relativeTarget === '..'
    || relativeTarget.startsWith(`..${sep}`)
    || isAbsolute(relativeTarget)
  ) {
    unsafeTarget(target);
  }

  const candidates = [
    root,
    ...relativeTarget
      .split(sep)
      .filter(Boolean)
      .map((_, index, segments) => join(root, ...segments.slice(0, index + 1))),
  ];

  for (const [index, candidate] of candidates.entries()) {
    let stat;
    try {
      stat = lstatSync(candidate);
    } catch (error) {
      if ((error as NodeJS.ErrnoException).code === 'ENOENT') return;
      unsafeTarget(candidate);
    }
    if (stat.isSymbolicLink()) unsafeTarget(candidate);
    const isFinal = index === candidates.length - 1;
    if (!isFinal && !stat.isDirectory()) unsafeTarget(candidate);
    if (isFinal && expectedKind === 'directory' && !stat.isDirectory()) {
      unsafeTarget(candidate);
    }
    if (isFinal && expectedKind === 'file' && !stat.isFile()) unsafeTarget(candidate);
  }
}

function openStableDirectory(repositoryRoot: string, directory: string): number {
  assertSafeTarget(repositoryRoot, directory, 'directory');
  const expected = resolve(directory);
  const before = lstatSync(expected);
  if (before.isSymbolicLink() || !before.isDirectory()) unsafeTarget(directory);
  let descriptor: number;
  try {
    descriptor = openSync(expected, DIRECTORY_FLAGS);
  } catch (error) {
    if (isNodeError(error, 'ELOOP') || isNodeError(error, 'ENOTDIR')) {
      unsafeTarget(directory);
    }
    throw error;
  }
  try {
    const opened = fstatSync(descriptor);
    const named = lstatSync(expected);
    if (
      !opened.isDirectory()
      || named.isSymbolicLink()
      || !sameInode(before, opened)
      || !sameInode(opened, named)
      || realpathSync(descriptorPath(descriptor)) !== expected
    ) {
      unsafeTarget(directory);
    }
  } catch (error) {
    try {
      closeSync(descriptor);
    } catch (closeError) {
      throw new AggregateError(
        [error, closeError],
        'RAG_CONTRACT_IMPORT_DIRECTORY_CLOSE_FAILED',
      );
    }
    throw error;
  }
  return descriptor;
}

function withStableDirectory<T>(
  repositoryRoot: string,
  directory: string,
  callback: (stableDirectory: string) => T,
): T {
  const descriptor = openStableDirectory(repositoryRoot, directory);
  let result: T | undefined;
  let failure: unknown;
  try {
    result = callback(descriptorPath(descriptor));
  } catch (error) {
    failure = error;
  }
  try {
    closeSync(descriptor);
  } catch (closeError) {
    failure = failure === undefined
      ? closeError
      : new AggregateError(
        [failure, closeError],
        'RAG_CONTRACT_IMPORT_DIRECTORY_CLOSE_FAILED',
      );
  }
  if (failure !== undefined) throw failure;
  return result as T;
}

function readStableTarget(repositoryRoot: string, target: string): Buffer {
  return withStableDirectory(repositoryRoot, dirname(target), (stableDirectory) => {
    const entry = join(stableDirectory, basename(target));
    let descriptor: number | undefined;
    let bytes: Buffer | undefined;
    let failure: unknown;
    try {
      const namedBefore = lstatSync(entry);
      if (namedBefore.isSymbolicLink() || !namedBefore.isFile()) {
        throw new Error('not a regular file');
      }
      descriptor = openSync(entry, constants.O_RDONLY | constants.O_NOFOLLOW);
      const openedBefore = fstatSync(descriptor);
      if (!openedBefore.isFile() || !sameInode(namedBefore, openedBefore)) {
        throw new Error('file identity changed');
      }
      bytes = readFileSync(descriptor);
      const openedAfter = fstatSync(descriptor);
      const namedAfter = lstatSync(entry);
      if (
        namedAfter.isSymbolicLink()
        || !sameInode(openedBefore, openedAfter)
        || !sameInode(openedAfter, namedAfter)
      ) {
        throw new Error('file identity changed');
      }
    } catch (error) {
      failure = error;
    }
    if (descriptor !== undefined) {
      try {
        closeSync(descriptor);
      } catch (closeError) {
        failure = failure === undefined
          ? closeError
          : new AggregateError(
            [failure, closeError],
            'RAG_CONTRACT_IMPORT_FILE_CLOSE_FAILED',
          );
      }
    }
    if (failure !== undefined) throw failure;
    return bytes!;
  });
}

function atomicWriteTarget(
  repositoryRoot: string,
  target: string,
  bytes: Buffer,
): void {
  const directory = dirname(target);
  assertSafeTarget(repositoryRoot, target, 'file');
  withStableDirectory(repositoryRoot, directory, (stableDirectory) => {
    const targetEntry = join(stableDirectory, basename(target));
    const temporary = join(
      stableDirectory,
      `.${basename(target)}.${process.pid}.${randomUUID()}.tmp`,
    );
    let descriptor: number | undefined;
    let failure: unknown;
    try {
      descriptor = openSync(
        temporary,
        constants.O_WRONLY
          | constants.O_CREAT
          | constants.O_EXCL
          | constants.O_NOFOLLOW,
        0o666,
      );
      writeFileSync(descriptor, bytes);
    } catch (error) {
      failure = error;
    }
    if (descriptor !== undefined) {
      try {
        closeSync(descriptor);
      } catch (closeError) {
        failure = failure === undefined
          ? closeError
          : new AggregateError(
            [failure, closeError],
            'RAG_CONTRACT_IMPORT_FILE_CLOSE_FAILED',
          );
      }
    }
    if (failure === undefined) {
      try {
        try {
          const targetStat = lstatSync(targetEntry);
          if (targetStat.isSymbolicLink() || !targetStat.isFile()) {
            unsafeTarget(target);
          }
        } catch (error) {
          if (!isNodeError(error, 'ENOENT')) throw error;
        }
        renameSync(temporary, targetEntry);
        return;
      } catch (error) {
        failure = error;
      }
    }
    try {
      rmSync(temporary, { force: true });
    } catch (cleanupError) {
      throw new AggregateError(
        [failure, cleanupError],
        'RAG_CONTRACT_IMPORT_CLEANUP_FAILED',
      );
    }
    throw failure;
  });
}

function gitBytes(repositoryRoot: string, commit: string, path: string): Buffer {
  try {
    return execFileSync('git', ['show', `${commit}:${path}`], {
      cwd: repositoryRoot,
      encoding: 'buffer',
      maxBuffer: 16 * 1024 * 1024,
      stdio: ['ignore', 'pipe', 'pipe'],
    });
  } catch {
    throw new Error(`RAG_CONTRACT_PRODUCER_COMMIT_PATH_MISSING:${path}`);
  }
}

function removeOrRejectUnexpectedTargets(
  repositoryRoot: string,
  targetDirectory: string,
  check: boolean,
): void {
  let rootEntries: string[];
  try {
    rootEntries = withStableDirectory(
      repositoryRoot,
      targetDirectory,
      (stableDirectory) => readdirSync(stableDirectory),
    );
  } catch (error) {
    if (!isNodeError(error, 'ENOENT')) throw error;
    return;
  }
  const allowedRoot = new Set<string>([
    ...ARIA_RAG_CONTRACT_FILENAMES,
    'fixtures',
  ]);
  const fixtureDirectory = join(targetDirectory, 'fixtures');
  const unexpectedRoot = rootEntries.filter((entry) => !allowedRoot.has(entry));
  let unexpectedFixtures: string[] = [];
  try {
    unexpectedFixtures = withStableDirectory(
      repositoryRoot,
      fixtureDirectory,
      (stableDirectory) => readdirSync(stableDirectory).filter(
        (entry) => !ARIA_RAG_CONTRACT_FIXTURES.includes(
        entry as (typeof ARIA_RAG_CONTRACT_FIXTURES)[number],
        ),
      ),
    );
  } catch (error) {
    if (!isNodeError(error, 'ENOENT')) throw error;
    // The expected fixture read below reports a missing directory precisely.
  }
  if ((unexpectedRoot.length || unexpectedFixtures.length) && check) {
    const first = unexpectedRoot.length
      ? join(targetDirectory, unexpectedRoot[0])
      : join(fixtureDirectory, unexpectedFixtures[0]);
    throw new Error(`RAG_CONTRACT_IMPORT_UNEXPECTED:${first}`);
  }
  if (unexpectedRoot.length) {
    withStableDirectory(repositoryRoot, targetDirectory, (stableDirectory) => {
      for (const entry of unexpectedRoot) {
        rmSync(join(stableDirectory, entry), { recursive: true, force: true });
      }
    });
  }
  if (unexpectedFixtures.length) {
    withStableDirectory(repositoryRoot, fixtureDirectory, (stableDirectory) => {
      for (const entry of unexpectedFixtures) {
        rmSync(join(stableDirectory, entry), { recursive: true, force: true });
      }
    });
  }
}

export interface ImportRagContractsInput {
  readonly ragRepositoryRoot: string;
  readonly ragProducerCommit: string;
  readonly nexusRepositoryRoot: string;
  readonly check: boolean;
}

export function importRagContracts(input: ImportRagContractsInput): void {
  const producerCommit = gitCommitSchema.parse(input.ragProducerCommit);
  const sourceLock = upstreamLockSchema.parse(JSON.parse(gitBytes(
    input.ragRepositoryRoot,
    producerCommit,
    'packages/contracts/schema/contracts.lock.json',
  ).toString('utf8')));
  const targetDirectory = join(
    input.nexusRepositoryRoot,
    'data/aria/generated/rag-contracts/v1',
  );
  const lockPath = join(input.nexusRepositoryRoot, 'data/aria/rag/contracts.lock.json');
  const schemas: Record<string, { $id: string; sha256: string }> = {};
  const fixtures: Record<string, { sha256: string }> = {};
  const expectedFiles = new Map<string, Buffer>();

  for (const filename of ARIA_RAG_CONTRACT_FILENAMES) {
    const upstreamEntry = sourceLock.schemas[filename];
    if (!upstreamEntry) throw new Error(`RAG_CONTRACT_LOCK_ENTRY_MISSING:${filename}`);
    const bytes = gitBytes(
      input.ragRepositoryRoot,
      producerCommit,
      `packages/contracts/schema/${filename}`,
    );
    if (sha256(bytes) !== upstreamEntry.sha256) {
      throw new Error(`RAG_CONTRACT_SOURCE_DIGEST_MISMATCH:${filename}`);
    }
    const schema = z.object({ $id: z.string().url() }).passthrough().parse(
      JSON.parse(bytes.toString('utf8')),
    );
    if (schema.$id !== upstreamEntry.$id) {
      throw new Error(`RAG_CONTRACT_SOURCE_ID_MISMATCH:${filename}`);
    }
    schemas[filename] = upstreamEntry;
    expectedFiles.set(join(targetDirectory, filename), bytes);
  }

  for (const filename of ARIA_RAG_CONTRACT_FIXTURES) {
    const upstreamEntry = sourceLock.fixtures[filename];
    if (!upstreamEntry) throw new Error(`RAG_CONTRACT_LOCK_ENTRY_MISSING:${filename}`);
    const bytes = gitBytes(
      input.ragRepositoryRoot,
      producerCommit,
      `packages/contracts/fixtures/${filename}`,
    );
    if (sha256(bytes) !== upstreamEntry.sha256) {
      throw new Error(`RAG_CONTRACT_SOURCE_DIGEST_MISMATCH:${filename}`);
    }
    fixtures[filename] = upstreamEntry;
    expectedFiles.set(join(targetDirectory, 'fixtures', filename), bytes);
  }

  expectedFiles.set(lockPath, stableJson({
    protocolVersion: 1,
    producerRepository: 'cyranoaladin/RAG',
    producerCommit,
    packageVersion: sourceLock.packageVersion,
    fixtures,
    schemas,
  }));

  const fixtureDirectory = join(targetDirectory, 'fixtures');
  const ragDataDirectory = join(input.nexusRepositoryRoot, 'data/aria/rag');

  if (input.check) {
    assertSafeTarget(input.nexusRepositoryRoot, targetDirectory, 'directory');
    assertSafeTarget(input.nexusRepositoryRoot, fixtureDirectory, 'directory');
    assertSafeTarget(input.nexusRepositoryRoot, ragDataDirectory, 'directory');
    removeOrRejectUnexpectedTargets(input.nexusRepositoryRoot, targetDirectory, true);
    for (const [path, expected] of expectedFiles) {
      let actual: Buffer;
      try {
        actual = readStableTarget(input.nexusRepositoryRoot, path);
      } catch (error) {
        if (isUnsafeTargetError(error)) throw error;
        throw new Error(`RAG_CONTRACT_IMPORT_MISSING:${path}`);
      }
      if (!actual.equals(expected)) throw new Error(`RAG_CONTRACT_IMPORT_DRIFT:${path}`);
    }
    return;
  }

  assertSafeTarget(input.nexusRepositoryRoot, targetDirectory, 'directory');
  assertSafeTarget(input.nexusRepositoryRoot, fixtureDirectory, 'directory');
  assertSafeTarget(input.nexusRepositoryRoot, ragDataDirectory, 'directory');
  for (const path of expectedFiles.keys()) {
    assertSafeTarget(input.nexusRepositoryRoot, path, 'file');
  }
  mkdirSync(targetDirectory, { recursive: true });
  mkdirSync(fixtureDirectory, { recursive: true });
  mkdirSync(ragDataDirectory, { recursive: true });
  assertSafeTarget(input.nexusRepositoryRoot, targetDirectory, 'directory');
  assertSafeTarget(input.nexusRepositoryRoot, fixtureDirectory, 'directory');
  assertSafeTarget(input.nexusRepositoryRoot, ragDataDirectory, 'directory');
  removeOrRejectUnexpectedTargets(input.nexusRepositoryRoot, targetDirectory, false);
  for (const [path, expected] of expectedFiles) {
    assertSafeTarget(input.nexusRepositoryRoot, path, 'file');
    atomicWriteTarget(input.nexusRepositoryRoot, path, expected);
  }
}

export interface ImportRagContractsArguments {
  readonly ragRepositoryRoot: string;
  readonly ragProducerCommit: string;
  readonly check: boolean;
}

export function parseImportRagContractsArguments(
  argv: readonly string[],
  environment: Readonly<Record<string, string | undefined>>,
): ImportRagContractsArguments {
  const values = new Map<string, string>();
  let check = false;
  for (let index = 0; index < argv.length; index += 1) {
    const argument = argv[index];
    if (argument === '--check') {
      if (check) throw new Error('RAG_CONTRACT_IMPORT_ARGUMENTS_INVALID');
      check = true;
      continue;
    }
    if (argument !== '--rag-repository-root' && argument !== '--rag-producer-commit') {
      throw new Error('RAG_CONTRACT_IMPORT_ARGUMENTS_INVALID');
    }
    if (values.has(argument)) throw new Error('RAG_CONTRACT_IMPORT_ARGUMENTS_INVALID');
    const value = argv[index + 1];
    if (!value?.trim() || value.startsWith('--')) {
      throw new Error('RAG_CONTRACT_IMPORT_ARGUMENTS_INVALID');
    }
    values.set(argument, value);
    index += 1;
  }
  const ragRepositoryRoot = values.get('--rag-repository-root')
    ?? environment.ARIA_RAG_WORKTREE;
  const ragProducerCommit = values.get('--rag-producer-commit')
    ?? environment.ARIA_RAG_EXPECTED_SHA;
  if (!ragRepositoryRoot?.trim() || !ragProducerCommit?.trim()) {
    throw new Error('RAG_CONTRACT_IMPORT_ARGUMENTS_INVALID');
  }
  return Object.freeze({ ragRepositoryRoot, ragProducerCommit, check });
}

if (require.main === module) {
  const parsed = parseImportRagContractsArguments(process.argv.slice(2), process.env);
  importRagContracts({
    ragRepositoryRoot: resolve(parsed.ragRepositoryRoot),
    ragProducerCommit: parsed.ragProducerCommit,
    nexusRepositoryRoot: process.cwd(),
    check: parsed.check,
  });
}
