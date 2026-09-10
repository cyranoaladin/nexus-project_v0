import { mkdtempSync, mkdirSync, writeFileSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import {
  analyzeSourceForClientAuthorityViolations,
  listFilesRecursive,
} from './helpers/core-v2-client-authority-guard';

const REPO_ROOT = '/repo';
const FILE = 'lib/core-v2/some-file.ts';

function violationKinds(source: string): string[] {
  return analyzeSourceForClientAuthorityViolations(FILE, source, REPO_ROOT).map((v) => v.kind);
}

describe('CORE_V2_ONLY_CLIENT_TS_MAY_CONSTRUCT_A_CLIENT — AST-based evasion detection (Review A, P3-3)', () => {
  test('named import (direct) is flagged', () => {
    const source = `
      import { PrismaClient } from '@/core-v2/generated/client';
      const client = new PrismaClient();
    `;
    expect(violationKinds(source)).toEqual(['import']);
  });

  test('aliased named import is flagged', () => {
    const source = `
      import { PrismaClient as CoreV2PrismaClient } from '@/core-v2/generated/client';
      const client = new CoreV2PrismaClient();
    `;
    expect(violationKinds(source)).toEqual(['import']);
  });

  test('namespace import is flagged', () => {
    const source = `
      import * as generated from '@/core-v2/generated/client';
      const client = new generated.PrismaClient();
    `;
    expect(violationKinds(source)).toEqual(['import']);
  });

  test('default-shaped import is flagged (defensive — module has no default export today, still a value binding)', () => {
    const source = `
      import generated from '@/core-v2/generated/client';
    `;
    expect(violationKinds(source)).toEqual(['import']);
  });

  test('relative-path import is flagged, not just the @/ alias form', () => {
    const source = `
      import { PrismaClient } from '../../core-v2/generated/client';
      const client = new PrismaClient();
    `;
    expect(violationKinds(source)).toEqual(['import']);
  });

  test('CommonJS require, destructured, is flagged', () => {
    const source = `
      const { PrismaClient } = require('@/core-v2/generated/client');
      const client = new PrismaClient();
    `;
    expect(violationKinds(source)).toEqual(['require']);
  });

  test('CommonJS require, whole-module then member access, is flagged', () => {
    const source = `
      const generated = require('@/core-v2/generated/client');
      const client = new generated.PrismaClient();
    `;
    expect(violationKinds(source)).toEqual(['require']);
  });

  test('inline require-and-construct with no intermediate variable is flagged', () => {
    const source = `
      const client = new (require('@/core-v2/generated/client').PrismaClient)();
    `;
    expect(violationKinds(source)).toEqual(['require']);
  });

  // Review B, final round: a no-substitution template literal (backtick
  // string with no `${...}`) is a distinct AST node kind from a plain
  // string literal, but is semantically identical at runtime AND to
  // bundlers' static dependency-graph resolution (webpack/Next.js resolve
  // `require(\`literal\`)` exactly like `require('literal')`). Swapping one
  // quote character was previously a working, zero-effort bypass — no
  // obfuscation or dynamic path construction required.
  test('require() with a no-substitution template literal argument is flagged (Review B evasion)', () => {
    const source = `
      const client = new (require(\`@/core-v2/generated/client\`).PrismaClient)();
    `;
    expect(violationKinds(source)).toEqual(['require']);
  });

  test('dynamic import() with a no-substitution template literal argument is flagged (Review B evasion)', () => {
    const source = `
      async function build() {
        const { PrismaClient } = await import(\`@/core-v2/generated/client\`);
        return new PrismaClient();
      }
    `;
    expect(violationKinds(source)).toEqual(['dynamic-import']);
  });

  // Fail-closed extension: a require()/dynamic-import() argument built by
  // concatenation or held in a variable can't be resolved statically at
  // all — rather than silently passing it through unguarded, treat any
  // require()/import() call in the scanned scope whose argument is not a
  // literal we can positively rule out as unrelated as suspicious. False
  // positives are acceptable here (a legitimate computed require of some
  // OTHER module can be explicitly annotated / is rare in this codebase);
  // a silent bypass of the client-authority boundary is not.
  test('require() with a concatenated (non-literal) argument is flagged as suspicious (fail closed)', () => {
    const source = `
      const client = new (require('@/core-v2/generated/' + 'client').PrismaClient)();
    `;
    expect(violationKinds(source)).toEqual(['require']);
  });

  test('require() with a variable argument is flagged as suspicious (fail closed)', () => {
    const source = `
      const modulePath = getSomeModulePath();
      const client = new (require(modulePath).PrismaClient)();
    `;
    expect(violationKinds(source)).toEqual(['require']);
  });

  test('a require() of an unrelated module via a plain string literal is still NOT flagged (no false positive on ordinary code)', () => {
    const source = `
      const { readFileSync } = require('node:fs');
      const path = require('node:path');
    `;
    expect(violationKinds(source)).toEqual([]);
  });

  test('dynamic import, awaited and destructured, is flagged', () => {
    const source = `
      async function build() {
        const { PrismaClient } = await import('@/core-v2/generated/client');
        return new PrismaClient();
      }
    `;
    expect(violationKinds(source)).toEqual(['dynamic-import']);
  });

  test('re-export from another Core v2 file is flagged at its origin (closes the indirect-reexport evasion)', () => {
    const source = `
      export { PrismaClient } from '@/core-v2/generated/client';
    `;
    expect(violationKinds(source)).toEqual(['reexport']);
  });

  test('variable-reassignment aliasing chain is still flagged, at the original import site', () => {
    const source = `
      import { PrismaClient } from '@/core-v2/generated/client';
      const Ctor = PrismaClient;
      const AnotherCtor = Ctor;
      const client = new AnotherCtor();
    `;
    // The import itself is already the violation — no separate detection
    // of the downstream reassignment chain is needed, since value access
    // was never legitimately obtainable in the first place.
    expect(violationKinds(source)).toEqual(['import']);
  });

  test('type-only import (whole declaration) is NOT flagged — cannot be used as a value, TypeScript itself forbids `new` on it', () => {
    const source = `
      import type { PrismaClient, Prisma } from '@/core-v2/generated/client';
      export type Client = PrismaClient;
    `;
    expect(violationKinds(source)).toEqual([]);
  });

  test('type-only import (inline `type` specifier) is NOT flagged', () => {
    const source = `
      import { type PrismaClient, type Prisma } from '@/core-v2/generated/client';
      export type Client = PrismaClient;
    `;
    expect(violationKinds(source)).toEqual([]);
  });

  test('mixed import — one type-only specifier, one value specifier — flags only because of the value one', () => {
    const source = `
      import { type Prisma, PrismaClient } from '@/core-v2/generated/client';
      const client = new PrismaClient();
    `;
    expect(violationKinds(source)).toEqual(['import']);
  });

  test('type-only re-export is NOT flagged', () => {
    const source = `
      export type { PrismaClient } from '@/core-v2/generated/client';
    `;
    expect(violationKinds(source)).toEqual([]);
  });

  test('an unrelated import from a different module is NOT flagged', () => {
    const source = `
      import { PrismaClient } from '@prisma/client';
      const client = new PrismaClient();
    `;
    expect(violationKinds(source)).toEqual([]);
  });

  test('a require() of an unrelated module is NOT flagged', () => {
    const source = `
      const { readFileSync } = require('node:fs');
    `;
    expect(violationKinds(source)).toEqual([]);
  });

  test('realistic repository-style file (type-only import, no construction) is NOT flagged', () => {
    const source = `
      import type { CoachStudentCourseAssignment, Prisma, PrismaClient } from '@/core-v2/generated/client';

      function isViolation(error: unknown): boolean {
        const prismaError = error as Prisma.PrismaClientKnownRequestError | undefined;
        return prismaError?.code === 'P2002';
      }

      export async function createAssignment(client: PrismaClient): Promise<CoachStudentCourseAssignment> {
        return client.coachStudentCourseAssignment.create({ data: {} });
      }
    `;
    expect(violationKinds(source)).toEqual([]);
  });
});

describe('listFilesRecursive — "generated" exclusion is path-scoped, not name-scoped (Review B, final round, P2)', () => {
  let root: string;

  beforeEach(() => {
    root = mkdtempSync(join(tmpdir(), 'core-v2-guard-fixture-'));
  });

  afterEach(() => {
    rmSync(root, { recursive: true, force: true });
  });

  test('a directory literally named "generated" OUTSIDE core-v2/ is still scanned (would evade CORE_V2_MUST_NOT_BE_IMPORTED_BY_LIVE_RUNTIME otherwise)', () => {
    // Simulates a future codegen tool emitting into app/**/generated/ or
    // lib/**/generated/ — the exact broad-scan blind spot Review B found:
    // a bare `entry.name === 'generated'` match would have silently
    // skipped this file even though it lives nowhere near core-v2/generated.
    const generatedDir = join(root, 'lib', 'some-other-codegen', 'generated');
    mkdirSync(generatedDir, { recursive: true });
    writeFileSync(join(generatedDir, 'output.ts'), "import '@/lib/core-v2/client';\n");

    const files = listFilesRecursive(root);
    expect(files).toEqual([join(generatedDir, 'output.ts')]);
  });

  test('the real Prisma output directory core-v2/generated IS still excluded', () => {
    const coreV2GeneratedDir = join(root, 'core-v2', 'generated');
    mkdirSync(coreV2GeneratedDir, { recursive: true });
    writeFileSync(join(coreV2GeneratedDir, 'client.ts'), 'export {};\n');

    expect(listFilesRecursive(root)).toEqual([]);
  });

  test('node_modules, .next, and .git are still excluded everywhere', () => {
    for (const dir of ['node_modules', '.next', '.git']) {
      mkdirSync(join(root, dir), { recursive: true });
      writeFileSync(join(root, dir, 'ignored.ts'), 'export {};\n');
    }

    expect(listFilesRecursive(root)).toEqual([]);
  });
});
