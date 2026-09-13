import fs from 'node:fs';
import path from 'node:path';
import { SessionRecoveryController } from '@/lib/auth/client-session-recovery';

const session = (id: string) => ({ user: { id, role: 'ADMIN' }, expires: '2099-01-01T00:00:00Z' });
const response = (body: unknown, status = 200) => ({ ok: status === 200, status, json: async () => body, text: async () => JSON.stringify(body) }) as Response;
type SyncApi = {
  save(input: { expectedRevision: number; payload: object }): Promise<unknown>;
  draft: { save(value: object, revision: number): void; load(): unknown; clear(): void };
};
const target = window as unknown as { Nexus: { STORAGE_KEY: string; SessionRecovery: SessionRecoveryController; Sync: SyncApi }; NEXUS_PLANNING_CONFIG: object };
const originalFetch = global.fetch;
afterEach(() => { global.fetch = originalFetch; localStorage.clear(); jest.useRealTimers(); });

async function setup() {
  let current = session('planning-a');
  const controller = new SessionRecoveryController(async () => response(current), async () => null, null, undefined, 'canonical-server');
  target.NEXUS_PLANNING_CONFIG = { mode: 'integrated' };
  target.Nexus = { STORAGE_KEY: 'synthetic-planning', SessionRecovery: controller } as typeof target.Nexus;
  new Function(fs.readFileSync(path.join(process.cwd(), 'tools/planning-studio/assets/sync.js'), 'utf8'))();
  controller.observe({ data: null, status: 'loading' }, '/planning');
  await Promise.resolve(); await Promise.resolve(); await Promise.resolve();
  return { controller, sync: target.Nexus.Sync, switchOwner: async () => {
    current = session('planning-b'); controller.retry();
    await Promise.resolve(); await Promise.resolve(); await Promise.resolve();
  } };
}

it('planning cannot dispatch an uncertain mutation or accept a late save after recovery starts', async () => {
  const { controller, sync } = await setup();
  let finish!: (value: Response) => void;
  global.fetch = jest.fn(() => new Promise<Response>(resolve => { finish = resolve; }));
  const pending = sync.save({ expectedRevision: 1, payload: {} });
  controller.stop();
  finish(response({ revision: 2 }));
  await expect(pending).rejects.toThrow();
  await expect(sync.save({ expectedRevision: 1, payload: {} })).rejects.toThrow();
  expect(global.fetch).toHaveBeenCalledTimes(1);
});

it('planning recovery drafts are scoped to their verified owner, preserving both accounts', async () => {
  const { controller, sync, switchOwner } = await setup();
  const draftA = { sessions: [{ id: 'private-a' }] };
  sync.draft.save(draftA, 1);
  expect(sync.draft.load()).toEqual(expect.objectContaining({ data: draftA }));
  await switchOwner();
  expect(sync.draft.load()).toBeNull();
  sync.draft.save({ sessions: [{ id: 'private-b' }] }, 2);
  sync.draft.clear();
  expect(Object.values(localStorage).some(value => String(value).includes('private-a'))).toBe(true);
  controller.stop();
});
