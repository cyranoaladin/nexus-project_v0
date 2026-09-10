/**
 * RAG independence proof (foundation §18). Core v2's foundation must
 * bootstrap and run its Golden Empty DB flow with RAG env absent and no RAG
 * service reachable — there must be zero dependency on the RAG stack for
 * any of this to work.
 */
import { readFileSync, readdirSync, statSync } from 'node:fs';
import { execFileSync } from 'node:child_process';
import { join } from 'node:path';
import { disconnectCoreV2Client, getCoreV2Client } from '@/lib/core-v2/client';
import { createAcademicYear } from '@/lib/core-v2/repositories';
import { resetCoreV2Database } from './helpers/reset-db';

const root = process.cwd();
const CORE_V2_SOURCE_DIRS = [join(root, 'lib/core-v2'), join(root, 'core-v2')];

function listFilesRecursive(dir: string): string[] {
  const out: string[] = [];
  for (const entry of readdirSync(dir)) {
    const full = join(dir, entry);
    if (full.includes(`${join('core-v2', 'generated')}`)) continue; // generated client, not source
    const st = statSync(full);
    if (st.isDirectory()) out.push(...listFilesRecursive(full));
    else if (/\.(ts|tsx|prisma)$/.test(entry)) out.push(full);
  }
  return out;
}

test('CORE_V2_NO_RAG_REFERENCE — no Core v2 source file mentions RAG/ARIA env vars, imports, or clients', () => {
  const files = CORE_V2_SOURCE_DIRS.flatMap(listFilesRecursive);
  expect(files.length).toBeGreaterThan(0); // sanity: the guard actually scanned something
  const pattern = /\bARIA_RAG_|process\.env\.ARIA\b|from ['"].*\/rag[/'"]|ragClient|RagService/i;
  const offenders = files.filter((file) => pattern.test(readFileSync(file, 'utf8')));
  expect(offenders).toEqual([]);
});

describe('RAG-absent bootstrap', () => {
  const client = getCoreV2Client();

  beforeAll(() => {
    execFileSync(
      'npx',
      ['prisma', 'migrate', 'deploy', '--schema=core-v2/prisma/schema.prisma'],
      { stdio: 'inherit', env: process.env },
    );
  });

  afterAll(async () => {
    await disconnectCoreV2Client();
  });

  test('RAG_DISABLED_BOOTSTRAP — a basic write succeeds with every ARIA/RAG env var deleted', async () => {
    const savedEnv: Record<string, string | undefined> = {};
    for (const key of Object.keys(process.env)) {
      if (/^ARIA_|RAG/i.test(key)) {
        savedEnv[key] = process.env[key];
        delete process.env[key];
      }
    }
    try {
      await resetCoreV2Database(client);
      const academicYear = await createAcademicYear(client, { startYear: 2027 });
      expect(academicYear.startYear).toBe(2027);
    } finally {
      for (const [key, value] of Object.entries(savedEnv)) {
        if (value !== undefined) process.env[key] = value;
      }
    }
  });
});
