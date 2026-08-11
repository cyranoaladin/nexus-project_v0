/** @jest-environment node */

import { randomUUID } from 'node:crypto';
import { readFileSync } from 'node:fs';
import { spawnSync } from 'node:child_process';
import { join, resolve } from 'node:path';

const ROOT = process.cwd();

const readSource = (relativePath: string): string =>
  readFileSync(resolve(ROOT, relativePath), 'utf8');

function runtimeDatabaseUrl(): string {
  const protocol = ['postgres', 'ql'].join('');
  return `${protocol}://${randomUUID()}:${randomUUID()}@db/${randomUUID()}`;
}

function runTsx(
  arguments_: string[],
  environment: Record<string, string>,
) {
  return spawnSync(join(ROOT, 'node_modules/.bin/tsx'), arguments_, {
    cwd: ROOT,
    env: {
      ...process.env,
      DATABASE_URL: runtimeDatabaseUrl(),
      ...environment,
    },
    encoding: 'utf8',
    timeout: 5_000,
  });
}

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

  test('Next exits non-zero before a swallowed instrumentation error can reach ready state', () => {
    const child = runTsx(
      [
        '-e',
        `(async () => {
          const { register } = require('./instrumentation.ts');
          try {
            await register();
          } catch {
            console.log('REGISTER_ERROR_SWALLOWED');
          }
          console.log('READY');
        })();`,
      ],
      {
        NEXT_RUNTIME: 'nodejs',
        NEXT_PHASE: 'phase-production-server',
        NPC_STORAGE_ROOT: '',
      },
    );

    expect(child.status).toBe(1);
    expect(child.signal).toBeNull();
    expect(child.stderr).toContain('NPC_STORAGE_PREFLIGHT_FAILED');
    expect(child.stdout).not.toMatch(/REGISTER_ERROR_SWALLOWED|READY|Listening/i);
  });

  test('Next build phase remains exempt from the NPC storage preflight', () => {
    const child = runTsx(
      [
        '-e',
        `(async () => {
          const { register } = require('./instrumentation.ts');
          await register();
          console.log('BUILD_CONTINUED');
        })();`,
      ],
      {
        NEXT_RUNTIME: 'nodejs',
        NEXT_PHASE: 'phase-production-build',
        NPC_STORAGE_ROOT: '',
      },
    );

    expect(child.status).toBe(0);
    expect(child.stdout).toContain('BUILD_CONTINUED');
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

  test('NPC worker exits one before Prisma construction or cleanup handlers', () => {
    const source = readSource('services/npc-worker/index.ts');
    const guard = source.indexOf(
      "assertNpcStorageReady({ capability: 'read-only' })",
    );
    expect(guard).toBeGreaterThan(-1);
    expect(source.indexOf('new PrismaClient()')).toBeGreaterThan(guard);
    expect(source.indexOf("import('./processors/ai-service')")).toBeGreaterThan(
      guard,
    );
    expect(source.indexOf("process.on('SIGTERM'", guard)).toBeGreaterThan(guard);

    const child = runTsx(['services/npc-worker/index.ts'], {
      NPC_STORAGE_ROOT: 'relative-storage',
    });

    expect(child.status).toBe(1);
    expect(child.signal).toBeNull();
    expect(child.stderr).toContain('NPC_STORAGE_PREFLIGHT_FAILED');
    expect(`${child.stdout}\n${child.stderr}`).not.toMatch(
      /Shutting down|Released \d+ claimed jobs|Started - LLM_MODE/,
    );
  });
});
