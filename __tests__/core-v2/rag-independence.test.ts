/**
 * RAG independence proof (foundation §18). Core v2's foundation must
 * bootstrap and run its Golden Empty DB flow with RAG env absent and no RAG
 * service reachable — there must be zero dependency on the RAG stack for
 * any of this to work.
 */
import { readFileSync, readdirSync, statSync } from 'node:fs';
import { execFileSync } from 'node:child_process';
import { join } from 'node:path';
import { disconnectCoreV2Client, requireCoreV2Client } from '@/lib/core-v2/client';
import type { PrismaClient } from '@/core-v2/generated/client';
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

// Broader than matching RAG-specific naming (which a differently-named
// future integration could dodge — e.g. a dash-suffixed file instead of a
// `/rag/` directory, or a generically-named embeddings client): Core v2 is
// a pure Prisma/Postgres data layer with no legitimate reason to ever make
// a network call of any kind, so forbidding network/AI-client primitives
// outright is the more robust invariant, on top of the RAG-specific names.
const CORE_V2_NO_RAG_PATTERN =
  /\bARIA_RAG_|process\.env\.ARIA\b|from ['"].*\/rag[/'"-]|ragClient|RagService|\bfetch\s*\(|\baxios\b|https?\.request\s*\(|\bopenai\b|\bOpenAI\b|\bembedding(s)?\b|vectorSearch/i;

describe('CORE_V2_NO_RAG_REFERENCE pattern — verified directly, not just via an empty scan', () => {
  test.each([
    ["process.env.ARIA_RAG_SERVABLE_MANIFEST_ROOT", true],
    ["import { ragClient } from '@/lib/rag/client';", true],
    ["import { x } from '@/lib/aria/rag-client';", true],
    ["await fetch('https://internal/rag')", true],
    ["import OpenAI from 'openai';", true],
    ["const embeddings = await model.embed(text);", true],
    ["const householdId = student.householdId;", false],
    ["// this repository never talks to RAG", false],
  ])('pattern.test(%j) === %p', (source, expected) => {
    expect(CORE_V2_NO_RAG_PATTERN.test(source)).toBe(expected);
  });
});

test('CORE_V2_NO_RAG_REFERENCE — no Core v2 source file mentions RAG/ARIA env vars, imports, clients, or any network/AI-client primitive', () => {
  const files = CORE_V2_SOURCE_DIRS.flatMap(listFilesRecursive);
  expect(files.length).toBeGreaterThan(0); // sanity: the guard actually scanned something
  const offenders = files.filter((file) => CORE_V2_NO_RAG_PATTERN.test(readFileSync(file, 'utf8')));
  expect(offenders).toEqual([]);
});

describe('RAG-absent bootstrap', () => {
  let client: PrismaClient;

  beforeAll(async () => {
    execFileSync(
      'npx',
      ['prisma', 'migrate', 'deploy', '--schema=core-v2/prisma/schema.prisma'],
      { stdio: 'inherit', env: process.env },
    );
    client = await requireCoreV2Client();
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
