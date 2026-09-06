/** Manual staff delivery is the default. Automatic delivery is explicitly opt-in. */
export function isManualParentWhatsAppDelivery(): boolean {
  return process.env.WHATSAPP_SEND_ENABLED !== 'true';
}
