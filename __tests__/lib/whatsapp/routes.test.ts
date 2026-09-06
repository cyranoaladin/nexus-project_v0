import { createHmac } from 'node:crypto';
import { POST as drain } from '@/app/api/internal/whatsapp/drain/route';
import { POST as webhook, GET as verify } from '@/app/api/webhooks/whatsapp/route';
import { drainWhatsAppInvitations } from '@/lib/whatsapp/invitation-worker';
import { applyWhatsAppStatusEvents } from '@/lib/whatsapp/webhook';
jest.mock('@/lib/whatsapp/invitation-worker', () => ({ drainWhatsAppInvitations: jest.fn(async () => ({ claimed: 1, accepted: 1 })) }));
jest.mock('@/lib/whatsapp/webhook', () => ({ ...jest.requireActual('@/lib/whatsapp/webhook'), applyWhatsAppStatusEvents: jest.fn(async () => 1) }));
const saved = { ...process.env };
const secret = 'test-secret-'.repeat(4);
beforeEach(() => { jest.clearAllMocks(); Object.assign(process.env, { WHATSAPP_WORKER_SECRET: secret, WHATSAPP_META_APP_SECRET: secret, WHATSAPP_WEBHOOK_VERIFY_TOKEN: secret, WHATSAPP_META_PHONE_NUMBER_ID: '123' }); });
afterEach(() => { process.env = { ...saved }; });

test('worker endpoint fails closed without config or correct bearer and never drains anonymously', async () => {
  delete process.env.WHATSAPP_WORKER_SECRET;
  expect((await drain(new Request('http://localhost/api/internal/whatsapp/drain', { method: 'POST' }))).status).toBe(503);
  process.env.WHATSAPP_WORKER_SECRET = secret;
  expect((await drain(new Request('http://localhost/api/internal/whatsapp/drain', { method: 'POST' }))).status).toBe(401);
  expect(drainWhatsAppInvitations).not.toHaveBeenCalled();
  expect((await drain(new Request('http://localhost/api/internal/whatsapp/drain', { method: 'POST', headers: { Authorization: `Bearer ${secret}` } }))).status).toBe(200);
  expect(drainWhatsAppInvitations).toHaveBeenCalledTimes(1);
});
test('GET webhook verifies configured challenge token only', async () => {
  expect((await verify(new Request('http://localhost/api/webhooks/whatsapp?hub.mode=subscribe&hub.verify_token=wrong&hub.challenge=probe'))).status).toBe(403);
  const res = await verify(new Request(`http://localhost/api/webhooks/whatsapp?hub.mode=subscribe&hub.verify_token=${secret}&hub.challenge=probe`));
  expect(res.status).toBe(200);
  expect(await res.text()).toBe('probe');
});
test('POST webhook refuses bad HMAC before any database access', async () => {
  const body = JSON.stringify({ object: 'whatsapp_business_account', entry: [] });
  expect((await webhook(new Request('http://localhost/api/webhooks/whatsapp', { method: 'POST', body }))).status).toBe(401);
  expect(applyWhatsAppStatusEvents).not.toHaveBeenCalled();
  const signature = 'sha256=' + createHmac('sha256', secret).update(body).digest('hex');
  expect((await webhook(new Request('http://localhost/api/webhooks/whatsapp', { method: 'POST', body, headers: { 'x-hub-signature-256': signature } }))).status).toBe(200);
  expect(applyWhatsAppStatusEvents).toHaveBeenCalledWith(JSON.parse(body), '123');
});
