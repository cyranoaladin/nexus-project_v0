import { sendMetaWhatsAppInvitation } from '@/lib/whatsapp/meta-provider';
const saved = { ...process.env };
beforeEach(() => {
  Object.assign(process.env, { WHATSAPP_SEND_ENABLED: 'true', WHATSAPP_META_ACCESS_TOKEN: 'test-token', WHATSAPP_META_PHONE_NUMBER_ID: '123456', WHATSAPP_META_API_VERSION: 'v23.0', WHATSAPP_TEMPLATE_ACTIVATION: 'parent_activation', WHATSAPP_TEMPLATE_RECOVERY: 'parent_recovery', WHATSAPP_TEMPLATE_LANGUAGE: 'fr' });
});
afterEach(() => { process.env = { ...saved }; });
const invitation = { userId: 'parent-1', challengeId: 'challenge-1', rawToken: 'pwa_secret', phoneNormalized: '99123456', phoneVersion: 2, purpose: 'ACTIVATION' as const, expiresAt: '2099-01-01T00:00:00.000Z' };

test('sends only a configured template through a simulated transport and reports acceptance, not delivery', async () => {
  const fetcher = jest.fn().mockResolvedValue({ ok: true, status: 200, json: async () => ({ messages: [{ id: 'wamid.test' }] }) });
  const result = await sendMetaWhatsAppInvitation(invitation, 'correlation-1', fetcher);
  expect(result).toEqual({ status: 'ACCEPTED', providerMessageId: 'wamid.test' });
  const [url, init] = fetcher.mock.calls[0];
  expect(url).toBe('https://graph.facebook.com/v23.0/123456/messages');
  const body = JSON.parse(init.body);
  expect(body.to).toBe('21699123456');
  expect(body.biz_opaque_callback_data).toBe('correlation-1');
  expect(body.template.components[0].parameters[0].text).toBe('pwa_secret');
});
test('missing provider config leaves service unavailable without sending', async () => {
  delete process.env.WHATSAPP_META_ACCESS_TOKEN;
  const fetcher = jest.fn();
  expect(await sendMetaWhatsAppInvitation(invitation, 'correlation', fetcher)).toEqual({ status: 'UNAVAILABLE', code: 'WHATSAPP_SERVICE_UNAVAILABLE' });
  expect(fetcher).not.toHaveBeenCalled();
});
test.each([429, 400, 500])('classifies HTTP %s without persisting provider error or credentials', async (status) => {
  const fetcher = jest.fn().mockResolvedValue({ ok: false, status, json: async () => ({ error: { message: 'sensitive payload' } }) });
  const result = await sendMetaWhatsAppInvitation(invitation, 'correlation', fetcher);
  expect(result.status).toBe(status === 429 ? 'RETRYABLE' : status >= 500 ? 'AMBIGUOUS' : 'FAILED');
  expect(JSON.stringify(result)).not.toMatch(/sensitive|test-token|pwa_secret/);
});
test('network failure or missing provider id is ambiguous and cannot be automatically resent', async () => {
  expect((await sendMetaWhatsAppInvitation(invitation, 'correlation', jest.fn().mockRejectedValue(new Error('secret')))).status).toBe('AMBIGUOUS');
  expect((await sendMetaWhatsAppInvitation(invitation, 'correlation', jest.fn().mockResolvedValue({ ok: true, json: async () => ({}) }))).status).toBe('AMBIGUOUS');
});
