import { buildWhatsAppUrl } from '@/lib/whatsapp';
import { LEGAL } from '@/lib/legal';

export const PHONE = LEGAL.contact.phone;
export const PHONE_LINK = `tel:${LEGAL.contact.phoneRaw}`;
/** @deprecated Use `buildWhatsAppUrl('les stages Nexus')` from `@/lib/whatsapp` directly. */
export const WHATSAPP_URL = buildWhatsAppUrl('les stages Nexus');
export const CONTACT_EMAIL = LEGAL.contact.email;
export const CONTACT_ADDRESS =
  `${LEGAL.entity.tradeName} — ${LEGAL.addresses.siege.full}`;

export const TARGET_DATES = {
  pratique_nsi: new Date("2026-05-18T08:00:00"),
  bac_ecrit: new Date("2026-06-08T08:00:00"),
  stage_start: new Date("2026-04-18T09:00:00"),
  stage_end: new Date("2026-05-02T18:00:00"),
  early_bird_deadline: new Date("2026-04-12T23:59:59"),
} as const;

export const COLORS = {
  green: "#10b981",
  red: "#ef4444",
  amber: "#f59e0b",
  purple: "#a78bfa",
} as const;
