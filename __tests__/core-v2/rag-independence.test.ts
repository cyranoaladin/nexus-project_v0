/**
 * RAG independence proof (foundation §18). Core v2's foundation must
 * bootstrap and run its Golden Empty DB flow with RAG env absent and no RAG
 * service reachable — there must be zero dependency on the RAG stack for
 * any of this to work.
 *
 * One later, narrow, owner-authorized exception (mission "RÉGULARISER C1 ET
 * LIVRER UN PREMIER BILAN C2 EXAMINABLE", 2026-09-22): the C2 AI pilot's own
 * dedicated OpenRouter integration IS a real network/AI-client call, and is
 * explicitly carved out of the general "no network primitive" check below
 * — it must never depend on the Core v1 RAG/ARIA stack, which the other
 * check still enforces without exception.
 */
import { readFileSync } from 'node:fs';
import { execFileSync } from 'node:child_process';
import { join } from 'node:path';
import { disconnectCoreV2Client, requireCoreV2Client } from '@/lib/core-v2/client';
import type { PrismaClient } from '@/core-v2/generated/client';
import { createAcademicYear } from '@/lib/core-v2/repositories';
import { listFilesRecursive } from '../architecture/helpers/core-v2-client-authority-guard';
import { resetCoreV2Database } from './helpers/reset-db';
import { academicYearDates } from './helpers/fixtures';

const root = process.cwd();
const CORE_V2_SOURCE_DIRS = [join(root, 'lib/core-v2'), join(root, 'core-v2')];
const CORE_V2_SOURCE_EXTENSIONS = ['.ts', '.tsx', '.prisma'];

// Broader than matching RAG-specific naming (which a differently-named
// future integration could dodge — e.g. a dash-suffixed file instead of a
// `/rag/` directory, or a generically-named embeddings client): Core v2 is
// a pure Prisma/Postgres data layer with no legitimate reason to ever make
// a network call of any kind, so forbidding network/AI-client primitives
// outright is the more robust invariant, on top of the RAG-specific names.
const CORE_V2_NO_RAG_PATTERN =
  /\bARIA_RAG_|process\.env\.ARIA\b|from ['"].*\/rag[/'"-]|ragClient|RagService|\bfetch\s*\(|\baxios\b|https?\.request\s*\(|\bopenai\b|\bOpenAI\b|\bembedding(s)?\b|vectorSearch/i;

// The RAG/ARIA-stack-specific half of the pattern above (never a
// legitimate reference, in ANY Core v2 file, under any circumstance).
const CORE_V2_NO_RAG_STACK_PATTERN = /\bARIA_RAG_|process\.env\.ARIA\b|from ['"].*\/rag[/'"-]|ragClient|RagService/i;

// Owner-authorized exception (mission "RÉGULARISER C1 ET LIVRER UN PREMIER
// BILAN C2 EXAMINABLE", 2026-09-22, §2/§3): the C2 AI pilot's own,
// dedicated, budget-and-preflight-gated OpenRouter integration is the ONE
// place Core v2 is allowed a real network/AI-client call — a narrow,
// explicit carve-out, never a general loosening of the invariant below.
// Every OTHER Core v2 file, including every other diagnostics file, is
// still held to "zero network/AI-client primitive, ever."
const CORE_V2_AI_PILOT_FILES = [
  join(root, 'lib/core-v2/diagnostics/openrouter-preflight.ts'),
  join(root, 'lib/core-v2/diagnostics/bilan-ai-generation.ts'),
  join(root, 'lib/core-v2/diagnostics/bilan-ai-schema.ts'),
];

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

test('CORE_V2_NO_RAG_STACK_REFERENCE — no Core v2 source file, including the AI pilot itself, ever mentions the Core v1 RAG/ARIA stack', () => {
  const files = CORE_V2_SOURCE_DIRS.flatMap((dir) => listFilesRecursive(dir, CORE_V2_SOURCE_EXTENSIONS));
  expect(files.length).toBeGreaterThan(0); // sanity: the guard actually scanned something
  const offenders = files.filter((file) => CORE_V2_NO_RAG_STACK_PATTERN.test(readFileSync(file, 'utf8')));
  expect(offenders).toEqual([]);
});

test('CORE_V2_NO_RAG_REFERENCE — no network/AI-client primitive outside the explicitly authorized AI pilot module', () => {
  const files = CORE_V2_SOURCE_DIRS.flatMap((dir) => listFilesRecursive(dir, CORE_V2_SOURCE_EXTENSIONS)).filter(
    (file) => !CORE_V2_AI_PILOT_FILES.includes(file),
  );
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
      const academicYear = await createAcademicYear(client, { startYear: 2027, ...academicYearDates(2027) });
      expect(academicYear.startYear).toBe(2027);
    } finally {
      for (const [key, value] of Object.entries(savedEnv)) {
        if (value !== undefined) process.env[key] = value;
      }
    }
  });
});
