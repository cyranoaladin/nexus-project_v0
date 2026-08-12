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
