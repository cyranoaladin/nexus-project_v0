import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import vm from 'node:vm';
import ts from 'typescript';

function loadSeed(options: { bootstrapMissing?: boolean; existingLegacy?: boolean; foundationRole?: string;
  foundationInactive?: boolean; foundationStudent?: boolean; existingFoundation?: Record<string, unknown> } = {}) {
  const foundationEmail = 'foundation@e2e.nexus.test';
  const legacyEmail = 'coach-v1@e2e.nexus.test';
  const adminId = 'v1-e2e-administrator';
  const foundationId = 'v1-e2e-foundation';
  const legacyId = 'v1-only-coach';
  const identities: Record<string, unknown> = {
    'admin@e2e.nexus.test': { id: adminId, role: 'ADMIN', activatedAt: new Date(), disabledAt: null, mergedIntoUserId: null },
    [legacyEmail]: { id: legacyId, role: 'COACH', activatedAt: new Date(), disabledAt: null, mergedIntoUserId: null },
    [foundationEmail]: { id: foundationId, email: foundationEmail, role: options.foundationRole ?? 'ELEVE',
      activatedAt: options.foundationInactive ? null : new Date(), disabledAt: null, mergedIntoUserId: null,
      student: options.foundationStudent ? { id: 'legacy-student' } : null },
  };
  const legacy = { $disconnect: jest.fn(async () => undefined), user: { findUnique: jest.fn(async ({ where }: { where: { email: string } }) => identities[where.email]) } };
  const create = jest.fn(async ({ data }: { data: Record<string, unknown> }) => data);
  const profileModel = { upsert: jest.fn(async ({ create }: { create: Record<string, unknown> }) => ({ id: 'profile-id', ...create })) };
  const core: { user: { create: typeof create; update: jest.Mock; upsert: jest.Mock; findUnique: jest.Mock }; $transaction: jest.Mock } = new Proxy({ user: {
    create, update: jest.fn(), upsert: jest.fn(),
    findUnique: jest.fn(async ({ where }: { where: { email?: string; id?: string } }) =>
      where.email === legacyEmail || where.id === legacyId ? (options.existingLegacy ? { id: legacyId } : null) : (options.existingFoundation ?? null)),
  }, $transaction: jest.fn(async (work: (tx: unknown) => Promise<unknown>) => work(core)) }, {
    get: (target, key) => key in target ? target[key as keyof typeof target] : profileModel,
  });
  const records = [
    { id: legacyId, role: 'COACH', email: legacyEmail },
    { id: 'core-coach', role: 'COACH', email: 'core-coach@e2e.nexus.test' },
    { id: 'core-assistant', role: 'ASSISTANTE', email: 'assistant@e2e.nexus.test' },
  ];
  const report = { adminCreates: 0, adminPromotions: 0, users: { created: 0, updated: 0, unchanged: 2 }, coachProfiles: { created: 0, unchanged: 1 } };
  const upsertStaffActors = jest.fn(async () => report);
  const verifyBootstrap = jest.fn(async () => {
    if (options.bootstrapMissing) throw new Error('UNATTESTED_ADMIN_STATE');
    return { exactlyOneAdmin: true, closed: true };
  });
  const lock = jest.fn();
  const assertAttested = jest.fn(async () => adminId);
  const guard = jest.fn();
  const imports: Record<string, unknown> = {
    '@/lib/prisma': { prisma: legacy },
    '@/lib/core-v2/client': { requireCoreV2Client: jest.fn(async () => core), disconnectCoreV2Client: jest.fn(async () => undefined) },
    '@/lib/core-v2/contact': { normalizeEmail: (email: string) => email.toLowerCase() },
    '@/lib/core-v2/accounts/bootstrap-v1-admin': { verifyBootstrap, lockV1AdminBootstrap: lock, assertBootstrapAttested: assertAttested },
    '@/lib/auth/v1-invitation-authority': { acquireV1InvitationIdentity: async () => ({ verify: async () => undefined, release: async () => undefined }) },
    '@/lib/core-v2/services/context': { inTransaction: async (_client: unknown, work: (tx: unknown) => Promise<unknown>) => work(core) },
    '@/lib/security/seed-runtime': { readRuntimeCredentialsManifest: jest.fn(() => ({
      admin: { email: 'admin@e2e.nexus.test' }, coachV1: { email: legacyEmail }, coreV2AriaFoundation: { email: foundationEmail },
    })) },
    './sync-staff-actors': { collectV1StaffActors: jest.fn(async () => records), upsertStaffActors },
    './e2e-seed-target': { assertCoreV2E2eSeedTarget: guard, assertCoreV1E2eSeedTarget: jest.fn() },
    './aria-foundation-e2e-persona': { CORE_V2_ARIA_FOUNDATION_EMAIL: foundationEmail, resetCoreV2AriaFoundationProfile: jest.fn() },
    'node:fs': { readFileSync: () => '{}' }, 'node:path': { resolve }, bcryptjs: { hash: jest.fn(async () => 'FORBIDDEN_CORE_HASH') },
  };
  const module = { exports: {} as Record<string, (env?: Record<string, string>) => Promise<unknown>> };
  const loader = (name: string) => {
    if (!(name in imports)) throw new Error(`Unexpected fixture import: ${name}`);
    return imports[name];
  };
  const code = ts.transpileModule(readFileSync(resolve('scripts/core-v2/seed-e2e-staff-actors.ts'), 'utf8'), {
    compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2022, esModuleInterop: true },
  }).outputText;
  vm.runInNewContext(code, { exports: module.exports, module, require: loader, process: { env: {}, exit: jest.fn() },
    console: { log: jest.fn(), error: jest.fn() } });
  return { run: () => module.exports.seedCoreV2E2eActors({ CORE_V2_AUTH_MODE: 'V1_ONLY' }),
    module, imports, core, create, legacy, upsertStaffActors, verifyBootstrap, lock, assertAttested, guard, adminId, foundationId };
}

it('refuses a missing attested bootstrap before any fixture write or staff sync', async () => {
  const h = loadSeed({ bootstrapMissing: true });
  await expect(h.run()).rejects.toThrow('UNATTESTED_ADMIN_STATE');
  expect(h.create).not.toHaveBeenCalled();
  expect(h.upsertStaffActors).not.toHaveBeenCalled();
});

it('uses the canonical non-ADMIN sync, then a strict no-op second execution', async () => {
  const h = loadSeed();
  await h.run();
  expect(h.upsertStaffActors.mock.calls).toEqual([
    [h.core, expect.arrayContaining([expect.objectContaining({ id: 'core-coach' }), expect.objectContaining({ id: 'core-assistant' })]), { execute: false }],
    [h.core, expect.any(Array), { execute: true }], [h.core, expect.any(Array), { execute: true }],
  ]);
  for (const [, records] of h.upsertStaffActors.mock.calls as unknown as Array<[unknown, Array<{ id: string; role: string }> ]>) {
    expect(records).toHaveLength(2);
    expect(records.some(r => r.role === 'ADMIN' || r.id === 'v1-only-coach')).toBe(false);
  }
  expect(h.verifyBootstrap).toHaveBeenNthCalledWith(1, h.core, h.adminId);
  expect(h.verifyBootstrap).toHaveBeenLastCalledWith(h.core, h.adminId);
});

it('creates only the V1-linked ELEVE membership without a Core credential or copied session', async () => {
  const h = loadSeed();
  await h.run();
  expect(h.create).toHaveBeenCalledTimes(1);
  expect(h.create).toHaveBeenCalledWith({ data: expect.objectContaining({ id: h.foundationId, role: 'ELEVE', password: null, accountStatus: 'ACTIVE' }) });
  expect(h.create.mock.calls[0][0].data).not.toHaveProperty('sessionVersion');
  expect(h.lock).toHaveBeenCalled();
  expect(h.assertAttested).toHaveBeenCalled();
  for (const [query] of h.legacy.user.findUnique.mock.calls) expect(query).not.toHaveProperty('select.password');
  expect(h.core.user.upsert).not.toHaveBeenCalled();
  expect(h.core.user.update).not.toHaveBeenCalled();
});

it('preserves an existing active foundation identity and never rewrites its membership', async () => {
  const h = loadSeed({ existingFoundation: { id: 'v1-e2e-foundation', role: 'ELEVE', email: 'foundation@e2e.nexus.test', password: null, accountStatus: 'ACTIVE' } });
  await h.run();
  expect(h.create).not.toHaveBeenCalled();
  expect(h.core.user.update).not.toHaveBeenCalled();
  expect(h.core.user.upsert).not.toHaveBeenCalled();
});

it.each([
  { foundationRole: 'ADMIN' }, { foundationInactive: true }, { foundationStudent: true },
  { existingFoundation: { id: 'foreign-identity', role: 'ELEVE', password: null, accountStatus: 'ACTIVE' } },
  { existingFoundation: { id: 'v1-e2e-foundation', role: 'ELEVE', password: 'forbidden', accountStatus: 'ACTIVE' } },
  { existingFoundation: { id: 'v1-e2e-foundation', role: 'ELEVE', password: null, accountStatus: 'SUSPENDED' } },
])('refuses an incoherent foundation authority without identity mutation: %#', async options => {
  const h = loadSeed(options);
  await expect(h.run()).rejects.toThrow('CORE_V2_ARIA_E2E_IDENTITY_INVALID');
  expect(h.create).not.toHaveBeenCalled();
  expect(h.core.user.update).not.toHaveBeenCalled();
});

it('refuses a legacy-only coach already present in Core before any mutation', async () => {
  const h = loadSeed({ existingLegacy: true });
  await expect(h.run()).rejects.toThrow('E2E_LEGACY_COACH_MUST_NOT_EXIST_IN_CORE');
  expect(h.create).not.toHaveBeenCalled();
  expect(h.upsertStaffActors).not.toHaveBeenCalled();
});
