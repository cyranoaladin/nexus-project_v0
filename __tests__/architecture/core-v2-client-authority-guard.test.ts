import { analyzeSourceForClientAuthorityViolations } from './helpers/core-v2-client-authority-guard';

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
