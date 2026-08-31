import { createHash } from 'node:crypto';
import { execFileSync } from 'node:child_process';
import {
  linkSync,
  mkdirSync,
  mkdtempSync,
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
});
