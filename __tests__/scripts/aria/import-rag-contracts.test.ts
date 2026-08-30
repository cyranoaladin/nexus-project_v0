import { createHash } from 'node:crypto';
import { execFileSync } from 'node:child_process';
import {
  mkdirSync,
  mkdtempSync,
  readFileSync,
  rmSync,
  writeFileSync,
} from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';

import {
  ARIA_RAG_CONTRACT_FILENAMES,
  importRagContracts,
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

describe('ARIA RAG contract importer', () => {
  let root: string;

  beforeEach(() => {
    root = mkdtempSync(join(tmpdir(), 'aria-rag-contract-import-'));
  });

  afterEach(() => {
    rmSync(root, { recursive: true, force: true });
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
});
