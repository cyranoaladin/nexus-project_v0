import { randomBytes } from 'node:crypto';
function generateRuntimePassword() { return randomBytes(32).toString('hex'); }
import { drainWhatsAppInvitations } from '@/lib/whatsapp/invitation-worker';
import { startParentWhatsAppOutboxScheduler, kickParentWhatsAppOutboxDrain, stopParentWhatsAppOutboxScheduler } from '@/lib/whatsapp/invitation-scheduler';
jest.mock('@/lib/whatsapp/invitation-worker', () => ({ drainWhatsAppInvitations: jest.fn().mockResolvedValue({ claimed: 0 }) }));
const saved = { ...process.env };
beforeEach(() => { jest.clearAllMocks(); jest.useFakeTimers(); Object.assign(process.env, {
  WHATSAPP_META_APP_SECRET: generateRuntimePassword(), WHATSAPP_WEBHOOK_VERIFY_TOKEN: generateRuntimePassword(),
  WHATSAPP_OUTBOX_WORKER_ENABLED: 'true', WHATSAPP_SEND_ENABLED: 'true',
  WHATSAPP_OUTBOX_ENCRYPTION_KEY: generateRuntimePassword(),
  WHATSAPP_META_ACCESS_TOKEN: generateRuntimePassword(), WHATSAPP_META_PHONE_NUMBER_ID: '123', WHATSAPP_META_API_VERSION: 'v23.0',
  WHATSAPP_TEMPLATE_ACTIVATION: 'activation', WHATSAPP_TEMPLATE_RECOVERY: 'recovery', WHATSAPP_TEMPLATE_LANGUAGE: 'fr',
}); });
afterEach(async () => { await stopParentWhatsAppOutboxScheduler(); jest.useRealTimers(); process.env = { ...saved }; });

test('disabled scheduler cannot send even when a family creation kicks it', () => {
  process.env.WHATSAPP_OUTBOX_WORKER_ENABLED = 'false';
  startParentWhatsAppOutboxScheduler();
  kickParentWhatsAppOutboxDrain();
  expect(drainWhatsAppInvitations).not.toHaveBeenCalled();
});
test('start is singleton and overlapping kicks cannot duplicate a drain', async () => {
  let release!: () => void;
  (drainWhatsAppInvitations as jest.Mock).mockImplementationOnce(() => new Promise<void>(resolve => { release = resolve; }));
  startParentWhatsAppOutboxScheduler();
  startParentWhatsAppOutboxScheduler();
  kickParentWhatsAppOutboxDrain();
  jest.advanceTimersByTime(20_000);
  expect(drainWhatsAppInvitations).toHaveBeenCalledTimes(1);
  release();
  await stopParentWhatsAppOutboxScheduler();
  expect(jest.getTimerCount()).toBe(0);
});
test('explicit opt-in with missing config fails before scheduling', () => {
  delete process.env.WHATSAPP_META_ACCESS_TOKEN;
  expect(() => startParentWhatsAppOutboxScheduler()).toThrow('WHATSAPP_SERVICE_UNAVAILABLE');
  expect(drainWhatsAppInvitations).not.toHaveBeenCalled();
});
