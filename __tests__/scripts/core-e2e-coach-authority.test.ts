import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import vm from 'node:vm';
import { setImmediate } from 'node:timers';
import ts from 'typescript';

/** Execute the actual disposable mirror: a legacy-only persona must never be promoted to Core. */
it.each([false, true])('keeps V1 outside Core and fails closed on preexisting Core identity: %s', async existingCoreIdentity => {
  const legacyEmail = 'coach-v1@e2e.nexus.test';
  const foundationEmail = 'foundation@e2e.nexus.test';
  const actors = [
    { id: 'legacy-coach', email: legacyEmail, role: 'COACH' },
    { id: 'core-coach', email: 'core-coach@e2e.nexus.test', role: 'COACH' },
  ];
  const upsert = jest.fn(async ({ create }: { create: Record<string, unknown> }) => create);
  const model = { upsert: jest.fn(async ({ create }: { create: Record<string, unknown> }) => ({ id: 'fixture', ...create })) };
  const core = new Proxy({ user: { upsert, findUnique: jest.fn(async () => existingCoreIdentity ? { id: 'forbidden-mirror' } : null), findUniqueOrThrow: jest.fn(async () => ({ id: 'foundation' })) } }, {
    get: (target, key) => key in target ? target[key as keyof typeof target] : model,
  });
  const disconnect = jest.fn(async () => undefined);
  const legacy = { user: {
    findMany: jest.fn(async ({ where }: { where: { email?: { not: string } } }) => actors.filter(actor => actor.email !== where.email?.not)),
    findUnique: jest.fn(async () => null),
  }, $disconnect: disconnect };
  const password = 'x'.repeat(40);
  const manifest = JSON.stringify({ coachV1: { email: legacyEmail, password }, coreV2AriaFoundation: { email: foundationEmail, password } });
  const imports: Record<string, unknown> = {
    '@/lib/prisma': { prisma: legacy },
    '@/lib/core-v2/client': { requireCoreV2Client: async () => core, disconnectCoreV2Client: disconnect },
    '@/lib/core-v2/contact': { normalizeEmail: (email: string) => email.toLowerCase() },
    'node:fs': { readFileSync: () => manifest },
    'node:path': { resolve },
    bcryptjs: { hash: async () => 'synthetic-hash' },
    './e2e-seed-target': { assertCoreV2E2eSeedTarget: jest.fn() },
    './aria-foundation-e2e-persona': { CORE_V2_ARIA_FOUNDATION_EMAIL: foundationEmail, resetCoreV2AriaFoundationProfile: jest.fn() },
  };
  const failures: unknown[] = [];
  const code = ts.transpileModule(readFileSync(resolve('scripts/core-v2/seed-e2e-staff-actors.ts'), 'utf8'), {
    compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2022, esModuleInterop: true },
  }).outputText;
  vm.runInNewContext(code, { exports: {}, require: (name: string) => {
    if (!(name in imports)) throw new Error(`Unexpected fixture import: ${name}`);
    return imports[name];
  }, process: { env: {}, exit: (code: number) => failures.push(code) }, console: { log: jest.fn(), error: (...args: unknown[]) => failures.push(args) } });
  await new Promise<void>(resolve => setImmediate(resolve));
  if (existingCoreIdentity) {
    expect(failures).toContain(1);
    expect(JSON.stringify(failures)).toContain('E2E_LEGACY_COACH_MUST_NOT_EXIST_IN_CORE');
    expect(upsert).not.toHaveBeenCalled();
    return;
  }
  expect(failures).toEqual([]);
  expect(disconnect).toHaveBeenCalled();
  expect(upsert.mock.calls.some(([arg]) => arg.create.email === legacyEmail)).toBe(false);
  expect(upsert.mock.calls.some(([arg]) => arg.create.email === 'core-coach@e2e.nexus.test')).toBe(true);
});
