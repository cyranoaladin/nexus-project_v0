import { frenchTypography } from '@/lib/bilans/render/typography';

/**
 * Notification parent d'inscription à un atelier collectif ARIA (P7c) —
 * même conception que `parent-notification.ts::buildParentReportAvailableEmail`
 * (français soigné, jamais de contenu pédagogique par e-mail, seulement
 * l'information logistique réelle).
 */
export const WORKSHOP_REGISTERED_EMAIL_VERSION = 'aria-workshop-registered-email.v1' as const;

export type WorkshopRegisteredEmailInput = Readonly<{
  parentDisplayName: string;
  studentFirstName: string;
  workshopTitle: string;
  scheduledDateLabel: string;
  startTime: string;
  endTime: string;
  location: string | null;
  dashboardUrl: string;
}>;

export function buildWorkshopRegisteredEmail(input: WorkshopRegisteredEmailInput): Readonly<{
  subject: string;
  text: string;
  html: string;
}> {
  const subject = frenchTypography(`${input.studentFirstName} est inscrit·e à l'atelier ARIA — Nexus Réussite`);
  const whenLine = `le ${input.scheduledDateLabel} de ${input.startTime} à ${input.endTime}`;
  const whereLine = input.location ? ` (${input.location})` : '';
  const text = frenchTypography([
    `Bonjour ${input.parentDisplayName},`,
    '',
    `${input.studentFirstName} est inscrit·e à l'atelier collectif ARIA « ${input.workshopTitle} », ${whenLine}${whereLine}.`,
    '',
    'Vous pourrez suivre sa présence sur votre espace parent :',
    '',
    input.dashboardUrl,
    '',
    'Bien cordialement,',
    "L'équipe Nexus Réussite",
  ].join('\n'));
  const paragraphs = [
    `Bonjour ${input.parentDisplayName},`,
    `${input.studentFirstName} est inscrit·e à l'atelier collectif ARIA « ${input.workshopTitle} », ${whenLine}${whereLine}.`,
    'Vous pourrez suivre sa présence sur votre espace parent.',
  ];
  const html = [
    '<div style="font-family:Arial,Helvetica,sans-serif;color:#071A3A;line-height:1.6;max-width:560px">',
    ...paragraphs.map((paragraph) => `<p>${frenchTypography(paragraph)}</p>`),
    `<p><a href="${input.dashboardUrl}" style="display:inline-block;padding:10px 18px;background:#071A3A;color:#FFFFFF;text-decoration:none;border-radius:6px">${frenchTypography('Consulter mon espace parent')}</a></p>`,
    `<p>${frenchTypography('Bien cordialement,')}<br>${frenchTypography("L'équipe Nexus Réussite")}</p>`,
    '</div>',
  ].join('');
  return Object.freeze({ subject, text, html });
}
