import { buildWhatsAppUrl } from '@/lib/whatsapp';

export const PHONE = "+216 99 19 28 29";
export const PHONE_LINK = "tel:+21699192829";
/** @deprecated Use `buildWhatsAppUrl('les stages Nexus')` from `@/lib/whatsapp` directly. */
export const WHATSAPP_URL = buildWhatsAppUrl('les stages Nexus');
export const CONTACT_EMAIL = "contact@nexusreussite.academy";
export const CONTACT_ADDRESS =
  "Nexus Réussite — Centre Urbain Nord, Immeuble VENUS, Appt C13, 1082 Tunis";

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
