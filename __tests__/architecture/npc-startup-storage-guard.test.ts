/** @jest-environment node */

import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';

const readSource = (relativePath: string): string =>
  readFileSync(resolve(process.cwd(), relativePath), 'utf8');

describe('NPC startup storage guards', () => {
  test('Next instrumentation requires read-write storage before services start', () => {
    const source = readSource('instrumentation.ts');
    const guard = source.indexOf(
      "assertNpcStorageReady({ capability: 'read-write' })",
    );
    const serviceStart = source.indexOf('startEmailOutboxScheduler()');

    expect(source).toContain("import('./lib/npc/storage-root')");
    expect(guard).toBeGreaterThan(-1);
    expect(serviceStart).toBeGreaterThan(guard);
  });

  test('NPC worker requires read-only storage before entering its loop', () => {
    const source = readSource('services/npc-worker/index.ts');
    const guard = source.lastIndexOf(
      "assertNpcStorageReady({ capability: 'read-only' })",
    );
    const loopStart = source.lastIndexOf('workerLoop().catch');

    expect(source).toMatch(
      /import\s*\{[\s\S]*?assertNpcStorageReady[\s\S]*?\}\s*from\s*['"]\.\.\/\.\.\/lib\/npc\/storage-root['"]/,
    );
    expect(guard).toBeGreaterThan(-1);
    expect(loopStart).toBeGreaterThan(guard);
  });
});
