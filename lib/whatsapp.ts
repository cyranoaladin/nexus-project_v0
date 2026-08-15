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
export function buildWhatsAppUrl(
  context?: string,
  options?: { exactMessage?: boolean },
): string {
  const message = options?.exactMessage && context
    ? context
    : context
    ? `Bonjour Nexus Réussite, j'ai une question sur ${context}.`
    : "Bonjour Nexus Réussite, j'ai une question sur l'accompagnement.";

  return `${buildWhatsAppContactUrl()}?text=${encodeURIComponent(message)}`;
}

/** Build the canonical click-to-chat endpoint without a pre-filled message. */
export function buildWhatsAppContactUrl(number = WHATSAPP_NUMBER): string {
  return `https://wa.me/${number}`;
}

/**
 * Lien wa.me vers le téléphone d'un PARENT (envoi assisté d'un bilan).
 *
 * `phoneNormalized` est la forme canonique du dépôt (lib/contact/parent-phone.ts) :
 * soit 8 chiffres tunisiens sans indicatif (forme historique — l'indicatif 216
 * est ajouté ici, et uniquement ici, ce fichier étant la seule source
 * autorisée de littéraux wa.me), soit un numéro international complet
 * (indicatif déjà inclus, utilisé tel quel). Les deux formes ne peuvent pas
 * se confondre : parent-phone.ts garantit qu'un numéro international ne
 * normalise jamais vers exactement 8 chiffres.
 */
export function buildParentWhatsAppUrl(
  phoneNormalized: string,
  message: string,
): string {
  if (/^[1-9]\d{7}$/.test(phoneNormalized)) {
    return `https://wa.me/216${phoneNormalized}?text=${encodeURIComponent(message)}`;
  }
  if (/^[1-9]\d{8,14}$/.test(phoneNormalized)) {
    return `https://wa.me/${phoneNormalized}?text=${encodeURIComponent(message)}`;
  }
  throw new Error('WHATSAPP_PARENT_PHONE_INVALID');
}

/** Expose the number for tel: links (formatted). */
export function getWhatsAppNumber(): string {
  return WHATSAPP_NUMBER;
}

/** Format the canonical Tunisian mobile number for visible public copy. */
export function getWhatsAppDisplayNumber(): string {
  const localNumber = WHATSAPP_NUMBER.replace(/^216/, '');
  return localNumber.replace(/^(\d{2})(\d{3})(\d{3})$/, '$1 $2 $3');
}
