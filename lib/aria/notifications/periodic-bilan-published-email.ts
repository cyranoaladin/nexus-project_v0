import { frenchTypography } from '@/lib/bilans/render/typography';

/**
 * Notification parent de publication d'un bilan périodique ARIA (P7c) —
 * même conception que `workshop-registered-email.ts` : information réelle
 * et factuelle seulement (matière, date), jamais de contenu pédagogique
 * (jamais `parentsMarkdown`/`nexusMarkdown`) — le contenu détaillé reste
 * réservé à l'espace parent authentifié, jamais à l'e-mail lui-même.
 */
export const PERIODIC_BILAN_PUBLISHED_EMAIL_VERSION = 'aria-periodic-bilan-published-email.v1' as const;

export type PeriodicBilanPublishedEmailInput = Readonly<{
  parentDisplayName: string;
  studentFirstName: string;
  subject: string;
  dashboardUrl: string;
}>;

export function buildPeriodicBilanPublishedEmail(input: PeriodicBilanPublishedEmailInput): Readonly<{
  subject: string;
  text: string;
  html: string;
}> {
  const subject = frenchTypography(`Nouveau bilan ARIA disponible pour ${input.studentFirstName} — Nexus Réussite`);
  const text = frenchTypography([
    `Bonjour ${input.parentDisplayName},`,
    '',
    `Un nouveau bilan ARIA (${input.subject}) vient d'être publié pour ${input.studentFirstName}.`,
    '',
    'Vous pouvez le consulter sur votre espace parent :',
    '',
    input.dashboardUrl,
    '',
    'Bien cordialement,',
    "L'équipe Nexus Réussite",
  ].join('\n'));
  const paragraphs = [
    `Bonjour ${input.parentDisplayName},`,
    `Un nouveau bilan ARIA (${input.subject}) vient d'être publié pour ${input.studentFirstName}.`,
    'Vous pouvez le consulter sur votre espace parent.',
  ];
  const html = [
    '<div style="font-family:Arial,Helvetica,sans-serif;color:#071A3A;line-height:1.6;max-width:560px">',
    ...paragraphs.map((paragraph) => `<p>${frenchTypography(paragraph)}</p>`),
    `<p><a href="${input.dashboardUrl}" style="display:inline-block;padding:10px 18px;background:#071A3A;color:#FFFFFF;text-decoration:none;border-radius:6px">${frenchTypography('Consulter le bilan')}</a></p>`,
    `<p>${frenchTypography('Bien cordialement,')}<br>${frenchTypography("L'équipe Nexus Réussite")}</p>`,
    '</div>',
  ].join('');
  return Object.freeze({ subject, text, html });
}
