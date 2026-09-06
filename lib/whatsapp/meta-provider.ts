import type { WhatsAppInvitation } from './invitation-outbox';

export type WhatsAppProviderResult =
  | { status: 'ACCEPTED'; providerMessageId: string }
  | { status: 'UNAVAILABLE' | 'RETRYABLE' | 'AMBIGUOUS' | 'FAILED'; code: string };

/** No fallback plaintext/free-form message: an approved URL-button template is required.
 * Template URL must be the trusted application /auth/parent-phone?token={{1}}.
 * Correlation is opaque (no recipient, phone or token). Provider acceptance is not delivery.
 * Meta /messages has no documented exactly-once key: network/5xx failures are ambiguous.
 */
export function getMetaWhatsAppConfig(purpose: WhatsAppInvitation['purpose']) {
  const accessToken = process.env.WHATSAPP_META_ACCESS_TOKEN?.trim();
  const phoneNumberId = process.env.WHATSAPP_META_PHONE_NUMBER_ID?.trim();
  const version = process.env.WHATSAPP_META_API_VERSION?.trim();
  const template = (purpose === 'ACTIVATION'
    ? process.env.WHATSAPP_TEMPLATE_ACTIVATION : process.env.WHATSAPP_TEMPLATE_RECOVERY)?.trim();
  const language = process.env.WHATSAPP_TEMPLATE_LANGUAGE?.trim();
  if (process.env.WHATSAPP_SEND_ENABLED !== 'true' || !accessToken || !/^\d+$/.test(phoneNumberId ?? '')
    || !/^v\d+\.\d+$/.test(version ?? '') || !/^[a-z0-9_]+$/.test(template ?? '') || !/^[a-z]{2}(?:_[A-Z]{2})?$/.test(language ?? '')) {
    return null;
  }
  return { accessToken, phoneNumberId, version, template, language };
}

export async function sendMetaWhatsAppInvitation(
  invitation: WhatsAppInvitation,
  correlationId: string,
  fetcher: typeof fetch = fetch,
): Promise<WhatsAppProviderResult> {
  const config = getMetaWhatsAppConfig(invitation.purpose);
  if (!config) return { status: 'UNAVAILABLE', code: 'WHATSAPP_SERVICE_UNAVAILABLE' };
  const { accessToken, phoneNumberId, version, template, language } = config;
  const to = invitation.phoneNormalized.length === 8 ? `216${invitation.phoneNormalized}` : invitation.phoneNormalized;
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), 10_000);
  try {
    const response = await fetcher(`https://graph.facebook.com/${version}/${phoneNumberId}/messages`, {
      method: 'POST', signal: controller.signal, redirect: 'error',
      headers: { Authorization: `Bearer ${accessToken}`, 'Content-Type': 'application/json' },
      body: JSON.stringify({
        messaging_product: 'whatsapp', recipient_type: 'individual', to, type: 'template',
        biz_opaque_callback_data: correlationId,
        template: { name: template, language: { code: language }, components: [
          { type: 'button', sub_type: 'url', index: '0', parameters: [{ type: 'text', text: invitation.rawToken }] },
        ] },
      }),
    });
    if (response.status === 429) return { status: 'RETRYABLE', code: 'WHATSAPP_RATE_LIMITED' };
    if (!response.ok) return response.status >= 500
      ? { status: 'AMBIGUOUS', code: 'WHATSAPP_PROVIDER_UNCERTAIN' }
      : { status: 'FAILED', code: 'WHATSAPP_PROVIDER_REJECTED' };
    const body: unknown = await response.json();
    const message = (body as { messages?: { id?: unknown }[] })?.messages?.[0]?.id;
    if (typeof message !== 'string' || !message.startsWith('wamid.') || message.length > 512) {
      return { status: 'AMBIGUOUS', code: 'WHATSAPP_ACCEPTANCE_UNKNOWN' };
    }
    return { status: 'ACCEPTED', providerMessageId: message };
  } catch {
    return { status: 'AMBIGUOUS', code: 'WHATSAPP_TRANSPORT_UNCERTAIN' };
  } finally {
    clearTimeout(timer);
  }
}
