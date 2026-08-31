jest.mock('node:fs', () => ({ ...jest.requireActual('node:fs') }));

import { createHash } from 'node:crypto';
import { execFileSync } from 'node:child_process';
import {
  closeSync,
  fstatSync,
  linkSync,
  lstatSync,
  mkdirSync,
  mkdtempSync,
  openSync,
  readFileSync,
  renameSync,
  rmSync,
  symlinkSync,
  writeFileSync,
} from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';

import {
  ARIA_RAG_CONTRACT_FILENAMES,
  importRagContracts,
  parseImportRagContractsArguments,
} from '../../../scripts/aria/import-rag-contracts';

const mockedFs = jest.requireMock<typeof import('node:fs')>('node:fs');

const FIXTURE_NAME = 'internal-identity-envelope-v1.json';

function digest(bytes: Buffer): string {
  return createHash('sha256').update(bytes).digest('hex');
}

function git(repository: string, ...args: string[]): string {
  return execFileSync('git', args, { cwd: repository, encoding: 'utf8' }).trim();
}

function createCompanionRepository(root: string): { commit: string; schemaBytes: Buffer } {
  const repository = join(root, 'rag');
  const schemaRoot = join(repository, 'packages/contracts/schema');
  const fixtureRoot = join(repository, 'packages/contracts/fixtures');
  mkdirSync(schemaRoot, { recursive: true });
  mkdirSync(fixtureRoot, { recursive: true });

  const schemas: Record<string, { $id: string; sha256: string }> = {};
  let firstSchema = Buffer.alloc(0);
  for (const filename of ARIA_RAG_CONTRACT_FILENAMES) {
    const bytes = Buffer.from(`${JSON.stringify({
      $id: `https://nexusreussite.academy/contracts/test/${filename}`,
      $schema: 'https://json-schema.org/draft/2020-12/schema',
      title: filename,
      type: 'object',
    }, null, 2)}\n`);
    if (!firstSchema.length) firstSchema = bytes;
    writeFileSync(join(schemaRoot, filename), bytes);
    schemas[filename] = {
      $id: `https://nexusreussite.academy/contracts/test/${filename}`,
      sha256: digest(bytes),
    };
  }
  const fixture = Buffer.from('{"fixtureVersion":1}\n');
  writeFileSync(join(fixtureRoot, FIXTURE_NAME), fixture);
  writeFileSync(join(schemaRoot, 'contracts.lock.json'), `${JSON.stringify({
    packageVersion: '0.15.0',
    fixtures: { [FIXTURE_NAME]: { sha256: digest(fixture) } },
    schemas,
  }, null, 2)}\n`);

  git(repository, 'init', '-q');
  git(repository, 'add', '.');
  git(
    repository,
    '-c',
    'user.name=ARIA Contract Test',
    '-c',
    'user.email=aria-contract-test@nexus.invalid',
    'commit',
    '-qm',
    'contracts',
  );
  return { commit: git(repository, 'rev-parse', 'HEAD'), schemaBytes: firstSchema };
}

function commitChanges(repository: string, message = 'mutate contracts'): string {
  git(repository, 'add', '-A');
  git(
    repository,
    '-c',
    'user.name=ARIA Contract Test',
    '-c',
    'user.email=aria-contract-test@nexus.invalid',
    'commit',
    '-qm',
    message,
  );
  return git(repository, 'rev-parse', 'HEAD');
}

function readUpstreamLock(repository: string) {
  const path = join(repository, 'packages/contracts/schema/contracts.lock.json');
  return {
    path,
    value: JSON.parse(readFileSync(path, 'utf8')) as {
      packageVersion: string;
      fixtures: Record<string, { sha256: string }>;
      schemas: Record<string, { $id: string; sha256: string }>;
    },
  };
}

describe('ARIA RAG contract importer', () => {
  let root: string;

  beforeEach(() => {
    root = mkdtempSync(join(tmpdir(), 'aria-rag-contract-import-'));
  });

  afterEach(() => {
    jest.restoreAllMocks();
    rmSync(root, { recursive: true, force: true });
  });

  it.each([
    ['UNKNOWN_FLAG', ['--chek']],
    ['DUPLICATE_CHECK', ['--check', '--check']],
    ['DUPLICATE_COMMIT', [
      '--rag-producer-commit', 'a'.repeat(40),
      '--rag-producer-commit', 'b'.repeat(40),
    ]],
    ['MISSING_VALUE', ['--rag-repository-root', '--check']],
    ['POSITIONAL_ARGUMENT', ['unexpected']],
  ])('RAG_CONTRACT_IMPORT_CLI_REJECTS_%s', (_name, argv) => {
    expect(() => parseImportRagContractsArguments(argv, {
      ARIA_RAG_WORKTREE: '/tmp/rag',
      ARIA_RAG_EXPECTED_SHA: 'a'.repeat(40),
    })).toThrow('RAG_CONTRACT_IMPORT_ARGUMENTS_INVALID');
  });

  it('RAG_CONTRACT_IMPORT_CLI_ACCEPTS_EXPLICIT_OR_ENVIRONMENT_CONFIGURATION', () => {
    expect(parseImportRagContractsArguments([
      '--rag-repository-root', '/srv/rag',
      '--rag-producer-commit', 'b'.repeat(40),
      '--check',
    ], {})).toEqual({
      ragRepositoryRoot: '/srv/rag', ragProducerCommit: 'b'.repeat(40), check: true,
    });
    expect(parseImportRagContractsArguments([], {
      ARIA_RAG_WORKTREE: '/srv/rag-env',
      ARIA_RAG_EXPECTED_SHA: 'c'.repeat(40),
    })).toEqual({
      ragRepositoryRoot: '/srv/rag-env', ragProducerCommit: 'c'.repeat(40), check: false,
    });
    expect(() => parseImportRagContractsArguments([], {}))
      .toThrow('RAG_CONTRACT_IMPORT_ARGUMENTS_INVALID');
  });

  it('imports the exact bytes from the named producer commit', () => {
    const source = createCompanionRepository(root);
    const ragRoot = join(root, 'rag');
    const nexusRoot = join(root, 'nexus');
    const firstFilename = ARIA_RAG_CONTRACT_FILENAMES[0];
    writeFileSync(join(ragRoot, 'packages/contracts/schema', firstFilename), '{}\n');

    importRagContracts({
      ragRepositoryRoot: ragRoot,
      ragProducerCommit: source.commit,
      nexusRepositoryRoot: nexusRoot,
      check: false,
    });

    expect(readFileSync(join(
      nexusRoot,
      'data/aria/generated/rag-contracts/v1',
      firstFilename,
    ))).toEqual(source.schemaBytes);
  });

  it('rejects an unexpected generated file in check mode', () => {
    const source = createCompanionRepository(root);
    const nexusRoot = join(root, 'nexus');
    const input = {
      ragRepositoryRoot: join(root, 'rag'),
      ragProducerCommit: source.commit,
      nexusRepositoryRoot: nexusRoot,
    };
    importRagContracts({ ...input, check: false });
    writeFileSync(
      join(nexusRoot, 'data/aria/generated/rag-contracts/v1/untracked.json'),
      '{}\n',
    );

    expect(() => importRagContracts({ ...input, check: true })).toThrow(
      'RAG_CONTRACT_IMPORT_UNEXPECTED',
    );
  });

  it('removes unexpected generated files during a write import', () => {
    const source = createCompanionRepository(root);
    const nexusRoot = join(root, 'nexus');
    const input = {
      ragRepositoryRoot: join(root, 'rag'),
      ragProducerCommit: source.commit,
      nexusRepositoryRoot: nexusRoot,
    };
    importRagContracts({ ...input, check: false });
    const unexpected = join(
      nexusRoot,
      'data/aria/generated/rag-contracts/v1/untracked.json',
    );
    writeFileSync(unexpected, '{}\n');

    importRagContracts({ ...input, check: false });

    expect(() => readFileSync(unexpected)).toThrow();
  });

  it('RAG_CONTRACT_CHECK_ACCEPTS_EXACT_IMPORTED_TREE', () => {
    const source = createCompanionRepository(root);
    const input = {
      ragRepositoryRoot: join(root, 'rag'),
      ragProducerCommit: source.commit,
      nexusRepositoryRoot: join(root, 'nexus'),
    };

    importRagContracts({ ...input, check: false });

    expect(() => importRagContracts({ ...input, check: true })).not.toThrow();
  });

  it.each(['CHECK_REJECTS', 'WRITE_REMOVES'] as const)(
    'RAG_CONTRACT_%s_UNEXPECTED_FIXTURE',
    (mode) => {
      const source = createCompanionRepository(root);
      const nexusRoot = join(root, 'nexus');
      const input = {
        ragRepositoryRoot: join(root, 'rag'),
        ragProducerCommit: source.commit,
        nexusRepositoryRoot: nexusRoot,
      };
      importRagContracts({ ...input, check: false });
      const unexpected = join(
        nexusRoot,
        'data/aria/generated/rag-contracts/v1/fixtures/untracked.json',
      );
      writeFileSync(unexpected, '{}\n');

      if (mode === 'CHECK_REJECTS') {
        expect(() => importRagContracts({ ...input, check: true }))
          .toThrow(`RAG_CONTRACT_IMPORT_UNEXPECTED:${unexpected}`);
      } else {
        importRagContracts({ ...input, check: false });
        expect(() => readFileSync(unexpected)).toThrow();
      }
    },
  );

  it.each(['TARGET_ROOT', 'FIXTURE_DIRECTORY'] as const)(
    'RAG_CONTRACT_CHECK_REPORTS_MISSING_%s',
    (kind) => {
      const source = createCompanionRepository(root);
      const nexusRoot = join(root, 'nexus');
      const input = {
        ragRepositoryRoot: join(root, 'rag'),
        ragProducerCommit: source.commit,
        nexusRepositoryRoot: nexusRoot,
      };
      importRagContracts({ ...input, check: false });
      const target = kind === 'TARGET_ROOT'
        ? join(nexusRoot, 'data/aria/generated/rag-contracts/v1')
        : join(nexusRoot, 'data/aria/generated/rag-contracts/v1/fixtures');
      rmSync(target, { recursive: true });

      expect(() => importRagContracts({ ...input, check: true }))
        .toThrow('RAG_CONTRACT_IMPORT_MISSING');
    },
  );

  it.each([
    ['TARGET_ROOT_FILE', 'data/aria/generated/rag-contracts/v1', 'file'],
    ['FIXTURE_DIRECTORY_FILE', 'data/aria/generated/rag-contracts/v1/fixtures', 'file'],
    ['INTERMEDIATE_DATA_FILE', 'data', 'file'],
    [
      'SCHEMA_TARGET_DIRECTORY',
      `data/aria/generated/rag-contracts/v1/${ARIA_RAG_CONTRACT_FILENAMES[0]}`,
      'directory',
    ],
  ] as const)('RAG_CONTRACT_WRITE_REJECTS_%s', (_name, relativeTarget, kind) => {
    const source = createCompanionRepository(root);
    const nexusRoot = join(root, 'nexus');
    const input = {
      ragRepositoryRoot: join(root, 'rag'),
      ragProducerCommit: source.commit,
      nexusRepositoryRoot: nexusRoot,
    };
    if (kind === 'directory') {
      importRagContracts({ ...input, check: false });
      const target = join(nexusRoot, relativeTarget);
      rmSync(target);
      mkdirSync(target);
    } else {
      const target = join(nexusRoot, relativeTarget);
      mkdirSync(join(target, '..'), { recursive: true });
      writeFileSync(target, 'not-a-directory');
    }

    expect(() => importRagContracts({ ...input, check: false }))
      .toThrow('RAG_CONTRACT_IMPORT_UNSAFE_TARGET');
  });

  it('rejects a producer commit or required path that cannot be read', () => {
    createCompanionRepository(root);
    expect(() => importRagContracts({
      ragRepositoryRoot: join(root, 'rag'),
      ragProducerCommit: 'f'.repeat(40),
      nexusRepositoryRoot: join(root, 'nexus'),
      check: false,
    })).toThrow('RAG_CONTRACT_PRODUCER_COMMIT_PATH_MISSING:packages/contracts/schema/contracts.lock.json');
  });

  it('rejects missing schema and fixture lock entries', () => {
    createCompanionRepository(root);
    const repository = join(root, 'rag');
    const lock = readUpstreamLock(repository);
    delete lock.value.schemas[ARIA_RAG_CONTRACT_FILENAMES[0]];
    writeFileSync(lock.path, `${JSON.stringify(lock.value, null, 2)}\n`);
    const schemaCommit = commitChanges(repository, 'remove schema lock entry');
    expect(() => importRagContracts({
      ragRepositoryRoot: repository,
      ragProducerCommit: schemaCommit,
      nexusRepositoryRoot: join(root, 'nexus-schema'),
      check: false,
    })).toThrow(`RAG_CONTRACT_LOCK_ENTRY_MISSING:${ARIA_RAG_CONTRACT_FILENAMES[0]}`);

    const fixtureLock = readUpstreamLock(repository);
    fixtureLock.value.schemas[ARIA_RAG_CONTRACT_FILENAMES[0]] = {
      $id: `https://nexusreussite.academy/contracts/test/${ARIA_RAG_CONTRACT_FILENAMES[0]}`,
      sha256: digest(readFileSync(join(repository, 'packages/contracts/schema', ARIA_RAG_CONTRACT_FILENAMES[0]))),
    };
    delete fixtureLock.value.fixtures[FIXTURE_NAME];
    writeFileSync(fixtureLock.path, `${JSON.stringify(fixtureLock.value, null, 2)}\n`);
    const fixtureCommit = commitChanges(repository, 'remove fixture lock entry');
    expect(() => importRagContracts({
      ragRepositoryRoot: repository,
      ragProducerCommit: fixtureCommit,
      nexusRepositoryRoot: join(root, 'nexus-fixture'),
      check: false,
    })).toThrow(`RAG_CONTRACT_LOCK_ENTRY_MISSING:${FIXTURE_NAME}`);
  });

  it('rejects schema byte digest and schema identity drift independently', () => {
    createCompanionRepository(root);
    const repository = join(root, 'rag');
    const filename = ARIA_RAG_CONTRACT_FILENAMES[0];
    const schemaPath = join(repository, 'packages/contracts/schema', filename);
    writeFileSync(schemaPath, '{"$id":"https://example.test/drift","type":"object"}\n');
    const digestDriftCommit = commitChanges(repository, 'drift schema bytes');
    expect(() => importRagContracts({
      ragRepositoryRoot: repository,
      ragProducerCommit: digestDriftCommit,
      nexusRepositoryRoot: join(root, 'nexus-digest'),
      check: false,
    })).toThrow(`RAG_CONTRACT_SOURCE_DIGEST_MISMATCH:${filename}`);

    const lock = readUpstreamLock(repository);
    lock.value.schemas[filename].sha256 = digest(readFileSync(schemaPath));
    writeFileSync(lock.path, `${JSON.stringify(lock.value, null, 2)}\n`);
    const identityDriftCommit = commitChanges(repository, 'accept bytes but retain locked id');
    expect(() => importRagContracts({
      ragRepositoryRoot: repository,
      ragProducerCommit: identityDriftCommit,
      nexusRepositoryRoot: join(root, 'nexus-id'),
      check: false,
    })).toThrow(`RAG_CONTRACT_SOURCE_ID_MISMATCH:${filename}`);
  });

  it('rejects fixture digest drift', () => {
    createCompanionRepository(root);
    const repository = join(root, 'rag');
    writeFileSync(join(repository, 'packages/contracts/fixtures', FIXTURE_NAME), '{"drift":true}\n');
    const commit = commitChanges(repository, 'drift fixture');
    expect(() => importRagContracts({
      ragRepositoryRoot: repository,
      ragProducerCommit: commit,
      nexusRepositoryRoot: join(root, 'nexus'),
      check: false,
    })).toThrow(`RAG_CONTRACT_SOURCE_DIGEST_MISMATCH:${FIXTURE_NAME}`);
  });

  it.each(['missing', 'drift', 'symlink'] as const)(
    'fails check mode for a %s generated contract target',
    (failure) => {
      const source = createCompanionRepository(root);
      const repository = join(root, 'rag');
      const nexusRoot = join(root, 'nexus');
      const input = {
        ragRepositoryRoot: repository,
        ragProducerCommit: source.commit,
        nexusRepositoryRoot: nexusRoot,
      };
      importRagContracts({ ...input, check: false });
      const filename = ARIA_RAG_CONTRACT_FILENAMES[0];
      const target = join(nexusRoot, 'data/aria/generated/rag-contracts/v1', filename);
      if (failure === 'missing') rmSync(target);
      if (failure === 'drift') writeFileSync(target, '{}\n');
      if (failure === 'symlink') {
        rmSync(target);
        symlinkSync(join(repository, 'packages/contracts/schema', filename), target);
      }

      expect(() => importRagContracts({ ...input, check: true })).toThrow(
        failure === 'drift' ? 'RAG_CONTRACT_IMPORT_DRIFT' : 'RAG_CONTRACT_IMPORT_MISSING',
      );
    },
  );

  it.each(['schema', 'fixture', 'target-root', 'lock'] as const)(
    'RAG_CONTRACT_WRITE_REJECTS_SYMLINKED_%s_TARGET',
    (kind) => {
      const source = createCompanionRepository(root);
      const repository = join(root, 'rag');
      const nexusRoot = join(root, 'nexus');
      const input = {
        ragRepositoryRoot: repository,
        ragProducerCommit: source.commit,
        nexusRepositoryRoot: nexusRoot,
      };
      importRagContracts({ ...input, check: false });
      const targetRoot = join(nexusRoot, 'data/aria/generated/rag-contracts/v1');
      const schemaTarget = join(targetRoot, ARIA_RAG_CONTRACT_FILENAMES[0]);
      const fixtureTarget = join(targetRoot, 'fixtures', FIXTURE_NAME);
      const lockTarget = join(nexusRoot, 'data/aria/rag/contracts.lock.json');
      const outside = join(root, `outside-${kind}`);
      let protectedPath: string;
      if (kind === 'target-root') {
        rmSync(targetRoot, { recursive: true });
        mkdirSync(outside, { recursive: true });
        protectedPath = join(outside, ARIA_RAG_CONTRACT_FILENAMES[0]);
        writeFileSync(protectedPath, 'outside-root-bytes');
        symlinkSync(outside, targetRoot);
      } else {
        protectedPath = outside;
        writeFileSync(protectedPath, `outside-${kind}-bytes`);
        const target = kind === 'schema'
          ? schemaTarget
          : kind === 'fixture' ? fixtureTarget : lockTarget;
        rmSync(target);
        symlinkSync(protectedPath, target);
      }
      const before = readFileSync(protectedPath);

      expect(() => importRagContracts({ ...input, check: false })).toThrow(
        'RAG_CONTRACT_IMPORT_UNSAFE_TARGET',
      );
      expect(readFileSync(protectedPath)).toEqual(before);
    },
  );

  it.each(['target-root', 'fixture-directory', 'rag-data-directory', 'nexus-root'] as const)(
    'RAG_CONTRACT_CHECK_REJECTS_BYTE_IDENTICAL_SYMLINKED_%s',
    (kind) => {
      const source = createCompanionRepository(root);
      const repository = join(root, 'rag');
      const nexusRoot = join(root, 'nexus');
      const input = {
        ragRepositoryRoot: repository,
        ragProducerCommit: source.commit,
        nexusRepositoryRoot: nexusRoot,
      };
      importRagContracts({ ...input, check: false });
      const target = kind === 'target-root'
        ? join(nexusRoot, 'data/aria/generated/rag-contracts/v1')
        : kind === 'fixture-directory'
          ? join(nexusRoot, 'data/aria/generated/rag-contracts/v1/fixtures')
          : kind === 'rag-data-directory'
            ? join(nexusRoot, 'data/aria/rag')
            : nexusRoot;
      const outside = join(root, `check-outside-${kind}`);
      renameSync(target, outside);
      symlinkSync(outside, target);

      expect(() => importRagContracts({ ...input, check: true })).toThrow(
        'RAG_CONTRACT_IMPORT_UNSAFE_TARGET',
      );
    },
  );

  it.each(['fixture-directory', 'rag-data-directory', 'nexus-root'] as const)(
    'RAG_CONTRACT_WRITE_REJECTS_SYMLINKED_%s',
    (kind) => {
      const source = createCompanionRepository(root);
      const repository = join(root, 'rag');
      const nexusRoot = join(root, 'nexus');
      const input = {
        ragRepositoryRoot: repository,
        ragProducerCommit: source.commit,
        nexusRepositoryRoot: nexusRoot,
      };
      importRagContracts({ ...input, check: false });
      const outside = join(root, `outside-${kind}`);
      mkdirSync(outside, { recursive: true });
      let target: string;
      let protectedPath: string;
      if (kind === 'fixture-directory') {
        target = join(nexusRoot, 'data/aria/generated/rag-contracts/v1/fixtures');
        protectedPath = join(outside, FIXTURE_NAME);
      } else if (kind === 'rag-data-directory') {
        target = join(nexusRoot, 'data/aria/rag');
        protectedPath = join(outside, 'contracts.lock.json');
      } else {
        target = nexusRoot;
        protectedPath = join(
          outside,
          'data/aria/generated/rag-contracts/v1',
          ARIA_RAG_CONTRACT_FILENAMES[0],
        );
        mkdirSync(join(outside, 'data/aria/generated/rag-contracts/v1'), {
          recursive: true,
        });
      }
      writeFileSync(protectedPath, `outside-${kind}-bytes`);
      rmSync(target, { recursive: true });
      symlinkSync(outside, target);
      const before = readFileSync(protectedPath);

      expect(() => importRagContracts({ ...input, check: false })).toThrow(
        'RAG_CONTRACT_IMPORT_UNSAFE_TARGET',
      );
      expect(readFileSync(protectedPath)).toEqual(before);
    },
  );

  it('RAG_CONTRACT_WRITE_DOES_NOT_MUTATE_EXTERNAL_HARDLINK_REFERENT', () => {
    const source = createCompanionRepository(root);
    const repository = join(root, 'rag');
    const nexusRoot = join(root, 'nexus');
    const input = {
      ragRepositoryRoot: repository,
      ragProducerCommit: source.commit,
      nexusRepositoryRoot: nexusRoot,
    };
    importRagContracts({ ...input, check: false });
    const target = join(
      nexusRoot,
      'data/aria/generated/rag-contracts/v1',
      ARIA_RAG_CONTRACT_FILENAMES[0],
    );
    const outside = join(root, 'outside-hardlink');
    writeFileSync(outside, 'outside-hardlink-bytes');
    rmSync(target);
    linkSync(outside, target);
    const before = readFileSync(outside);

    importRagContracts({ ...input, check: false });

    expect(readFileSync(outside)).toEqual(before);
    expect(readFileSync(target)).toEqual(source.schemaBytes);
  });

  it('RAG_CONTRACT_IMPORT_REJECTS_LSTAT_IO_FAILURE', () => {
    const source = createCompanionRepository(root);
    const nexusRoot = join(root, 'nexus');
    const originalLstat = lstatSync;
    jest.spyOn(mockedFs, 'lstatSync').mockImplementation(((path, ...args) => {
      if (String(path) === nexusRoot) {
        throw Object.assign(new Error('permission denied'), { code: 'EACCES' });
      }
      return originalLstat(path, ...args);
    }) as typeof lstatSync);

    expect(() => importRagContracts({
      ragRepositoryRoot: join(root, 'rag'),
      ragProducerCommit: source.commit,
      nexusRepositoryRoot: nexusRoot,
      check: false,
    })).toThrow(`RAG_CONTRACT_IMPORT_UNSAFE_TARGET:${nexusRoot}`);
  });

  it.each([
    ['ELOOP', 'RAG_CONTRACT_IMPORT_UNSAFE_TARGET'],
    ['ENOTDIR', 'RAG_CONTRACT_IMPORT_UNSAFE_TARGET'],
    ['EACCES', 'permission denied'],
  ] as const)('RAG_CONTRACT_IMPORT_OPEN_DIRECTORY_ERROR_%s', (code, expected) => {
    const source = createCompanionRepository(root);
    const nexusRoot = join(root, 'nexus');
    const input = {
      ragRepositoryRoot: join(root, 'rag'),
      ragProducerCommit: source.commit,
      nexusRepositoryRoot: nexusRoot,
    };
    importRagContracts({ ...input, check: false });
    const targetDirectory = join(nexusRoot, 'data/aria/generated/rag-contracts/v1');
    const originalOpen = openSync;
    jest.spyOn(mockedFs, 'openSync').mockImplementation(((path, ...args) => {
      if (String(path) === targetDirectory) {
        throw Object.assign(new Error('permission denied'), { code });
      }
      return originalOpen(path, ...args);
    }) as typeof openSync);

    expect(() => importRagContracts({ ...input, check: true })).toThrow(expected);
  });

  it('RAG_CONTRACT_IMPORT_REJECTS_POST_OPEN_DIRECTORY_IDENTITY_RACE', () => {
    const source = createCompanionRepository(root);
    const nexusRoot = join(root, 'nexus');
    const input = {
      ragRepositoryRoot: join(root, 'rag'),
      ragProducerCommit: source.commit,
      nexusRepositoryRoot: nexusRoot,
    };
    importRagContracts({ ...input, check: false });
    const originalFstat = fstatSync;
    let injected = false;
    jest.spyOn(mockedFs, 'fstatSync').mockImplementation(((descriptor, ...args) => {
      const stat = originalFstat(descriptor, ...args);
      if (!injected && stat.isDirectory()) {
        injected = true;
        return Object.assign(Object.create(Object.getPrototypeOf(stat)), stat, {
          dev: typeof stat.dev === 'bigint' ? stat.dev + BigInt(1) : stat.dev + 1,
        });
      }
      return stat;
    }) as typeof fstatSync);

    expect(() => importRagContracts({ ...input, check: true }))
      .toThrow('RAG_CONTRACT_IMPORT_UNSAFE_TARGET');
  });

  it('RAG_CONTRACT_IMPORT_AGGREGATES_POST_OPEN_RACE_AND_CLOSE_FAILURE', () => {
    const source = createCompanionRepository(root);
    const nexusRoot = join(root, 'nexus');
    const input = {
      ragRepositoryRoot: join(root, 'rag'),
      ragProducerCommit: source.commit,
      nexusRepositoryRoot: nexusRoot,
    };
    importRagContracts({ ...input, check: false });
    const originalFstat = fstatSync;
    let injected = false;
    jest.spyOn(mockedFs, 'fstatSync').mockImplementation(((descriptor, ...args) => {
      const stat = originalFstat(descriptor, ...args);
      if (!injected && stat.isDirectory()) {
        injected = true;
        return Object.assign(Object.create(Object.getPrototypeOf(stat)), stat, {
          ino: typeof stat.ino === 'bigint' ? stat.ino + BigInt(1) : stat.ino + 1,
        });
      }
      return stat;
    }) as typeof fstatSync);
    jest.spyOn(mockedFs, 'closeSync').mockImplementation(() => {
      throw new Error('close failed');
    });

    expect(() => importRagContracts({ ...input, check: true }))
      .toThrow('RAG_CONTRACT_IMPORT_DIRECTORY_CLOSE_FAILED');
  });

  it('RAG_CONTRACT_IMPORT_REPORTS_DIRECTORY_CLOSE_FAILURES', () => {
    const source = createCompanionRepository(root);
    const nexusRoot = join(root, 'nexus');
    const input = {
      ragRepositoryRoot: join(root, 'rag'),
      ragProducerCommit: source.commit,
      nexusRepositoryRoot: nexusRoot,
    };
    importRagContracts({ ...input, check: false });
    const originalClose = closeSync;
    let injected = false;
    jest.spyOn(mockedFs, 'closeSync').mockImplementation(((descriptor) => {
      if (!injected) {
        injected = true;
        throw new Error('close failed');
      }
      return originalClose(descriptor);
    }) as typeof closeSync);

    expect(() => importRagContracts({ ...input, check: true })).toThrow('close failed');
  });

  it('RAG_CONTRACT_IMPORT_AGGREGATES_DIRECTORY_OPERATION_AND_CLOSE_FAILURES', () => {
    const source = createCompanionRepository(root);
    const nexusRoot = join(root, 'nexus');
    const input = {
      ragRepositoryRoot: join(root, 'rag'),
      ragProducerCommit: source.commit,
      nexusRepositoryRoot: nexusRoot,
    };
    importRagContracts({ ...input, check: false });
    jest.spyOn(mockedFs, 'readdirSync').mockImplementation(() => {
      throw Object.assign(new Error('readdir denied'), { code: 'EACCES' });
    });
    jest.spyOn(mockedFs, 'closeSync').mockImplementation(() => {
      throw new Error('close failed');
    });

    expect(() => importRagContracts({ ...input, check: true }))
      .toThrow('RAG_CONTRACT_IMPORT_DIRECTORY_CLOSE_FAILED');
  });

  it('RAG_CONTRACT_IMPORT_AGGREGATES_FILE_IDENTITY_AND_CLOSE_FAILURES', () => {
    const source = createCompanionRepository(root);
    const nexusRoot = join(root, 'nexus');
    const input = {
      ragRepositoryRoot: join(root, 'rag'),
      ragProducerCommit: source.commit,
      nexusRepositoryRoot: nexusRoot,
    };
    importRagContracts({ ...input, check: false });
    const originalFstat = fstatSync;
    const originalClose = closeSync;
    let injectedIdentity = false;
    jest.spyOn(mockedFs, 'fstatSync').mockImplementation(((descriptor, ...args) => {
      const stat = originalFstat(descriptor, ...args);
      if (!injectedIdentity && stat.isFile()) {
        injectedIdentity = true;
        return Object.assign(Object.create(Object.getPrototypeOf(stat)), stat, {
          ino: typeof stat.ino === 'bigint' ? stat.ino + BigInt(1) : stat.ino + 1,
        });
      }
      return stat;
    }) as typeof fstatSync);
    jest.spyOn(mockedFs, 'closeSync').mockImplementation(((descriptor) => {
      if (originalFstat(descriptor).isFile()) {
        originalClose(descriptor);
        throw new Error('file close failed');
      }
      return originalClose(descriptor);
    }) as typeof closeSync);

    expect(() => importRagContracts({ ...input, check: true }))
      .toThrow('RAG_CONTRACT_IMPORT_MISSING');
  });

  it('RAG_CONTRACT_IMPORT_REJECTS_POST_READ_FILE_IDENTITY_RACE', () => {
    const source = createCompanionRepository(root);
    const nexusRoot = join(root, 'nexus');
    const input = {
      ragRepositoryRoot: join(root, 'rag'),
      ragProducerCommit: source.commit,
      nexusRepositoryRoot: nexusRoot,
    };
    importRagContracts({ ...input, check: false });
    const originalFstat = fstatSync;
    let fileFstats = 0;
    jest.spyOn(mockedFs, 'fstatSync').mockImplementation(((descriptor, ...args) => {
      const stat = originalFstat(descriptor, ...args);
      if (stat.isFile()) {
        fileFstats += 1;
        if (fileFstats === 2) {
          return Object.assign(Object.create(Object.getPrototypeOf(stat)), stat, {
            dev: typeof stat.dev === 'bigint' ? stat.dev + BigInt(1) : stat.dev + 1,
          });
        }
      }
      return stat;
    }) as typeof fstatSync);

    expect(() => importRagContracts({ ...input, check: true }))
      .toThrow('RAG_CONTRACT_IMPORT_MISSING');
  });

  it('RAG_CONTRACT_IMPORT_REPORTS_FILE_CLOSE_FAILURE_AFTER_SUCCESSFUL_READ', () => {
    const source = createCompanionRepository(root);
    const nexusRoot = join(root, 'nexus');
    const input = {
      ragRepositoryRoot: join(root, 'rag'),
      ragProducerCommit: source.commit,
      nexusRepositoryRoot: nexusRoot,
    };
    importRagContracts({ ...input, check: false });
    const originalFstat = fstatSync;
    const originalClose = closeSync;
    let injected = false;
    jest.spyOn(mockedFs, 'closeSync').mockImplementation(((descriptor) => {
      if (!injected && originalFstat(descriptor).isFile()) {
        injected = true;
        originalClose(descriptor);
        throw new Error('file close failed');
      }
      return originalClose(descriptor);
    }) as typeof closeSync);

    expect(() => importRagContracts({ ...input, check: true }))
      .toThrow('RAG_CONTRACT_IMPORT_MISSING');
  });

  it('RAG_CONTRACT_IMPORT_AGGREGATES_TEMP_OPEN_AND_CLEANUP_FAILURES', () => {
    const source = createCompanionRepository(root);
    const nexusRoot = join(root, 'nexus');
    const input = {
      ragRepositoryRoot: join(root, 'rag'),
      ragProducerCommit: source.commit,
      nexusRepositoryRoot: nexusRoot,
    };
    importRagContracts({ ...input, check: false });
    const originalOpen = openSync;
    const originalRm = rmSync;
    jest.spyOn(mockedFs, 'openSync').mockImplementation(((path, ...args) => {
      if (String(path).endsWith('.tmp')) throw new Error('temp open failed');
      return originalOpen(path, ...args);
    }) as typeof openSync);
    jest.spyOn(mockedFs, 'rmSync').mockImplementation(((path, ...args) => {
      if (String(path).endsWith('.tmp')) throw new Error('temp cleanup failed');
      return originalRm(path, ...args);
    }) as typeof rmSync);

    expect(() => importRagContracts({ ...input, check: false }))
      .toThrow('RAG_CONTRACT_IMPORT_CLEANUP_FAILED');
  });

  it('RAG_CONTRACT_IMPORT_AGGREGATES_TEMP_WRITE_AND_CLOSE_FAILURES', () => {
    const source = createCompanionRepository(root);
    const nexusRoot = join(root, 'nexus');
    const input = {
      ragRepositoryRoot: join(root, 'rag'),
      ragProducerCommit: source.commit,
      nexusRepositoryRoot: nexusRoot,
    };
    importRagContracts({ ...input, check: false });
    const originalOpen = openSync;
    const originalClose = closeSync;
    const originalWrite = writeFileSync;
    let temporaryDescriptor: number | undefined;
    jest.spyOn(mockedFs, 'openSync').mockImplementation(((path, ...args) => {
      const descriptor = originalOpen(path, ...args);
      if (String(path).endsWith('.tmp')) temporaryDescriptor = descriptor;
      return descriptor;
    }) as typeof openSync);
    jest.spyOn(mockedFs, 'writeFileSync').mockImplementation(((target, ...args) => {
      if (target === temporaryDescriptor) throw new Error('temp write failed');
      return originalWrite(target, ...args);
    }) as typeof writeFileSync);
    jest.spyOn(mockedFs, 'closeSync').mockImplementation(((descriptor) => {
      if (descriptor === temporaryDescriptor) {
        originalClose(descriptor);
        throw new Error('temp close failed');
      }
      return originalClose(descriptor);
    }) as typeof closeSync);

    expect(() => importRagContracts({ ...input, check: false }))
      .toThrow('RAG_CONTRACT_IMPORT_FILE_CLOSE_FAILED');
  });

  it.each([
    ['SYMLINK', 'RAG_CONTRACT_IMPORT_UNSAFE_TARGET'],
    ['EACCES', 'target lstat failed'],
  ] as const)('RAG_CONTRACT_IMPORT_REJECTS_ATOMIC_TARGET_RACE_%s', (failure, expected) => {
    const source = createCompanionRepository(root);
    const nexusRoot = join(root, 'nexus');
    const input = {
      ragRepositoryRoot: join(root, 'rag'),
      ragProducerCommit: source.commit,
      nexusRepositoryRoot: nexusRoot,
    };
    importRagContracts({ ...input, check: false });
    const originalLstat = lstatSync;
    let injected = false;
    jest.spyOn(mockedFs, 'lstatSync').mockImplementation(((path, ...args) => {
      const pathText = String(path);
      if (!injected
        && pathText.startsWith(`/proc/${process.pid}/fd/`)
        && pathText.endsWith(`/${ARIA_RAG_CONTRACT_FILENAMES[0]}`)) {
        injected = true;
        if (failure === 'EACCES') {
          throw Object.assign(new Error('target lstat failed'), { code: 'EACCES' });
        }
        const stat = originalLstat(path, ...args);
        return Object.assign(Object.create(Object.getPrototypeOf(stat)), stat, {
          isSymbolicLink: () => true,
        });
      }
      return originalLstat(path, ...args);
    }) as typeof lstatSync);

    expect(() => importRagContracts({ ...input, check: false })).toThrow(expected);
  });
});
