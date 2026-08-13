import { frenchTypography } from '../render/typography';

/**
 * Message WhatsApp remis à l'assistante — voie B : la plateforme prépare,
 * l'assistante envoie depuis son propre WhatsApp. Français soigné, ton
 * Nexus, personnalisé. Les liens sont signés et expirants ; le bilan Nexus
 * (interne) n'y figure jamais.
 */

export const WHATSAPP_MESSAGE_VERSION = 'bilan-whatsapp-message.v1' as const;

export type BilanWhatsAppMessageInput = Readonly<{
  parentDisplayName: string;
  studentFirstName: string;
  subjectLabel: string;
  levelLabel: string;
  parentLink: string;
  studentLink: string;
  validityDays: number;
}>;

export function buildBilanWhatsAppMessage(input: BilanWhatsAppMessageInput): string {
  const days = input.validityDays === 1 ? 'un jour' : `${input.validityDays} jours`;
  return frenchTypography([
    `Bonjour ${input.parentDisplayName},`,
    '',
    `Le bilan de positionnement de ${input.studentFirstName} (${input.subjectLabel}, entrée en ${input.levelLabel}) est prêt. Voici vos accès personnels :`,
    '',
    `Compte rendu parents : ${input.parentLink}`,
    `Bilan remis à ${input.studentFirstName} : ${input.studentLink}`,
    '',
    `Ces liens sont personnels et valables ${days}. L'équipe Nexus Réussite reste à votre disposition pour en parler ensemble.`,
    '',
    'Bien cordialement,',
    'Nexus Réussite',
  ].join('\n'));
}

export type BilanUpdateWhatsAppMessageInput = Readonly<{
  parentDisplayName: string;
  studentFirstName: string;
  /** Date de la nouvelle version, déjà formatée en français (ex. « 14 août 2026 »). */
  updatedAtLabel: string;
}>;

/**
 * Message d'information après régénération d'un bilan déjà transmis —
 * cas B, option 3 (arbitrage responsable, 14/08/2026). Le parent a
 * probablement lu la version précédente : on l'informe courtoisement que le
 * diagnostic a été affiné, sans lien (son accès reste le même — un lien
 * enregistré ne doit jamais mourir), sans jargon, sans inquiéter.
 * Préparé comme le message initial : l'assistante envoie, jamais d'automate.
 */
export function buildBilanUpdateWhatsAppMessage(input: BilanUpdateWhatsAppMessageInput): string {
  return frenchTypography([
    `Bonjour ${input.parentDisplayName},`,
    '',
    `Petit mot de l'équipe Nexus Réussite : nous avons affiné le bilan de ${input.studentFirstName}. La lecture pédagogique de certains points a été précisée — la nouvelle version, datée du ${input.updatedAtLabel}, est disponible par le même accès que celui que vous avez déjà reçu.`,
    '',
    `Rien d'autre ne change : vos liens restent valables, et nous restons à votre disposition pour en parler ensemble.`,
    '',
    'Bien cordialement,',
    'Nexus Réussite',
  ].join('\n'));
}
