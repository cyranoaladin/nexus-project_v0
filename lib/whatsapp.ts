/**
 * WhatsApp contact — single source of truth.
 *
 * All WhatsApp links on the site MUST use `buildWhatsAppUrl()`.
 * No `wa.me/` literal should appear outside this file.
 */

const WHATSAPP_NUMBER =
  process.env.NEXT_PUBLIC_WHATSAPP_NUMBER ?? '21699192829';

/**
 * Build a WhatsApp click-to-chat URL with a contextual pre-filled message.
 *
 * @param context – free-form context used to personalise the greeting.
 *   Typically the offer title or page subject.
 *   When omitted the message falls back to a generic greeting.
 */
export function buildWhatsAppUrl(context?: string): string {
  const message = context
    ? `Bonjour Nexus Réussite, j'ai une question sur ${context}.`
    : "Bonjour Nexus Réussite, j'ai une question sur l'accompagnement.";

  return `https://wa.me/${WHATSAPP_NUMBER}?text=${encodeURIComponent(message)}`;
}

/** Expose the number for tel: links (formatted). */
export function getWhatsAppNumber(): string {
  return WHATSAPP_NUMBER;
}
