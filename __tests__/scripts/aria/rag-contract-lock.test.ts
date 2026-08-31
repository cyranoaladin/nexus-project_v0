import { execFileSync } from 'node:child_process';
import {
  mkdirSync,
  mkdtempSync,
  readFileSync,
  rmSync,
  writeFileSync,
} from 'node:fs';
import { tmpdir } from 'node:os';
import { join, resolve } from 'node:path';

const repositoryRoot = resolve(__dirname, '../../..');
const script = join(repositoryRoot, 'scripts/aria/emit-rag-contract-lock.mjs');

describe('ARIA RAG companion lock output', () => {
  let root: string;

  beforeEach(() => {
    root = mkdtempSync(join(tmpdir(), 'aria-rag-contract-lock-'));
  });

  afterEach(() => {
    rmSync(root, { recursive: true, force: true });
  });

  it('emits repository and commit from the canonical Nexus lock', () => {
    const output = join(root, 'github-output');
    writeFileSync(output, '');
    const lock = JSON.parse(readFileSync(
      join(repositoryRoot, 'data/aria/rag/contracts.lock.json'),
      'utf8',
    )) as { producerRepository: string; producerCommit: string };

    execFileSync(process.execPath, [script], {
      cwd: repositoryRoot,
      env: { ...process.env, GITHUB_OUTPUT: output },
    });

    expect(readFileSync(output, 'utf8')).toBe(
      `producer_repository=${lock.producerRepository}\nproducer_commit=${lock.producerCommit}\n`,
    );
  });

  it('fails closed without an absolute GitHub output path', () => {
    expect(() => execFileSync(process.execPath, [script], {
      cwd: repositoryRoot,
      env: { ...process.env, GITHUB_OUTPUT: 'relative-output' },
      stdio: 'pipe',
    })).toThrow();
  });

  it.each([
    ['invalid repository', { producerRepository: '../private', producerCommit: 'a'.repeat(40) }],
    ['invalid commit', { producerRepository: 'cyranoaladin/RAG', producerCommit: 'main' }],
  ])('fails closed for %s in the lock', (_label, lock) => {
    const lockDirectory = join(root, 'data/aria/rag');
    const output = join(root, 'github-output');
    mkdirSync(lockDirectory, { recursive: true });
    writeFileSync(join(lockDirectory, 'contracts.lock.json'), JSON.stringify(lock));
    writeFileSync(output, '');

    expect(() => execFileSync(process.execPath, [script], {
      cwd: root,
      env: { ...process.env, GITHUB_OUTPUT: output },
      stdio: 'pipe',
    })).toThrow();
    expect(readFileSync(output, 'utf8')).toBe('');
  });
});
