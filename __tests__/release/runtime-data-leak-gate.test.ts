import { execFileSync } from 'node:child_process';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';

import { findRuntimeDataLeaks } from '@/scripts/release/runtime-data-leak';

/**
 * Third occurrence of the same incident: Next.js output-file-tracing sweeps
 * local, gitignored runtime data (`storage/documents`, `data/invoices`) into
 * `.next/standalone/` whenever application code references those paths via a
 * `process.cwd()` fallback. Every deploy then rsyncs real, nominative customer
 * invoices into a new release directory on the production server.
 *
 * Being in `.gitignore` does not help — tracing copies from the working tree,
 * not from git. The only reliable stop is a blocking check before transfer.
 */

function makeArtifact(): string {
  const root = fs.mkdtempSync(path.join(os.tmpdir(), 'leak-gate-'));
  fs.mkdirSync(path.join(root, '.next', 'standalone', '.next', 'static'), { recursive: true });
  fs.mkdirSync(path.join(root, '.next', 'static'), { recursive: true });
  return root;
}

describe('findRuntimeDataLeaks — blocking release gate', () => {
  it('accepts a clean artifact', () => {
    const root = makeArtifact();
    expect(findRuntimeDataLeaks(root)).toEqual([]);
  });

  it('ignores runtime data at the repo root when a standalone build exists', () => {
    // Les fichiers à la racine sont la source du développeur : le build les
    // exclut désormais du tracing, et ils ne sont jamais transférés.
    const root = makeArtifact();
    fs.mkdirSync(path.join(root, 'data', 'invoices'), { recursive: true });
    fs.writeFileSync(path.join(root, 'data', 'invoices', 'facture.pdf'), 'x');
    expect(findRuntimeDataLeaks(root)).toEqual([]);
  });

  it('still scans the root when there is no standalone build (deployed tree)', () => {
    const root = fs.mkdtempSync(path.join(os.tmpdir(), 'leak-gate-deployed-'));
    fs.mkdirSync(path.join(root, 'data', 'invoices'), { recursive: true });
    fs.writeFileSync(path.join(root, 'data', 'invoices', 'facture.pdf'), 'x');
    expect(findRuntimeDataLeaks(root).length).toBe(1);
  });

  it.each([
    ['invoice PDFs', path.join('.next', 'standalone', 'data', 'invoices'), 'facture-202602-0001.pdf'],
    ['stored documents', path.join('.next', 'standalone', 'storage', 'documents'), 'aa0d6t5jd423g30u117qbmsd.pdf'],
    ['nested document dirs', path.join('.next', 'standalone', 'storage', 'documents', 'sub'), 'scan.pdf'],
    ['uploads', path.join('.next', 'standalone', 'uploads', 'copies'), 'page_1.jpg'],
  ])('rejects an artifact carrying %s', (_label, dir, file) => {
    const root = makeArtifact();
    fs.mkdirSync(path.join(root, dir), { recursive: true });
    fs.writeFileSync(path.join(root, dir, file), 'x');

    const leaks = findRuntimeDataLeaks(root);
    expect(leaks.length).toBeGreaterThan(0);
    expect(leaks.some((leak: string) => leak.endsWith(file))).toBe(true);
  });

  it('ignores an empty runtime directory (no data to leak)', () => {
    const root = makeArtifact();
    fs.mkdirSync(path.join(root, '.next', 'standalone', 'data', 'invoices'), { recursive: true });
    expect(findRuntimeDataLeaks(root)).toEqual([]);
  });

  it('does not flag legitimate build output', () => {
    const root = makeArtifact();
    fs.writeFileSync(path.join(root, '.next', 'standalone', '.next', 'static', 'chunk.js'), 'x');
    fs.writeFileSync(path.join(root, '.next', 'static', 'chunk.js'), 'x');
    expect(findRuntimeDataLeaks(root)).toEqual([]);
  });

  it('is wired into the release gate so a leak fails the build', () => {
    const root = makeArtifact();
    const dir = path.join(root, '.next', 'standalone', 'data', 'invoices');
    fs.mkdirSync(dir, { recursive: true });
    fs.writeFileSync(path.join(dir, 'facture-202602-0001.pdf'), 'x');

    let exitCode = 0;
    let output = '';
    try {
      output = execFileSync(
        process.execPath,
        [path.join(process.cwd(), 'scripts/release/verify-standalone-artifact.mjs'), root],
        { encoding: 'utf8', stdio: ['ignore', 'pipe', 'pipe'] },
      );
    } catch (error) {
      const e = error as { status?: number; stdout?: string; stderr?: string };
      exitCode = e.status ?? 1;
      output = `${e.stdout ?? ''}${e.stderr ?? ''}`;
    }

    expect(exitCode).toBe(1);
    expect(output).toContain('RUNTIME_DATA_LEAK');
  });
});
