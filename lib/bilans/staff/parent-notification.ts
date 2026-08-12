import { frenchTypography } from '../render/typography';

/**
 * Notification parent à la diffusion d'un bilan : le parent apprend qu'un
 * document est disponible sur son espace — jamais le contenu du bilan par
 * e-mail. Français soigné, ton Nexus.
 */

export const PARENT_REPORT_EMAIL_VERSION = 'parent-report-available-email.v1' as const;

export type ParentReportAvailableEmailInput = Readonly<{
  parentDisplayName: string;
  studentFirstName: string;
  subjectLabel: string;
  dashboardUrl: string;
}>;

export function buildParentReportAvailableEmail(input: ParentReportAvailableEmailInput): Readonly<{
  subject: string;
  text: string;
  html: string;
}> {
  const subject = frenchTypography(`Le bilan de ${input.studentFirstName} est disponible — Nexus Réussite`);
  const text = frenchTypography([
    `Bonjour ${input.parentDisplayName},`,
    '',
    `Le bilan de positionnement de ${input.studentFirstName} en ${input.subjectLabel} vient d'être validé par notre équipe. Il est disponible dès maintenant sur votre espace parent :`,
    '',
    input.dashboardUrl,
    '',
    'Ce compte rendu ne comporte ni note ni classement : il présente les points d\'appui de votre enfant et ce que le stage travaillera en priorité. L\'équipe reste à votre disposition pour le commenter avec vous.',
    '',
    'Bien cordialement,',
    'L\'équipe Nexus Réussite',
  ].join('\n'));
  const paragraphs = [
    `Bonjour ${input.parentDisplayName},`,
    `Le bilan de positionnement de ${input.studentFirstName} en ${input.subjectLabel} vient d'être validé par notre équipe. Il est disponible dès maintenant sur votre espace parent.`,
    'Ce compte rendu ne comporte ni note ni classement : il présente les points d\'appui de votre enfant et ce que le stage travaillera en priorité. L\'équipe reste à votre disposition pour le commenter avec vous.',
  ];
  const html = [
    '<div style="font-family:Arial,Helvetica,sans-serif;color:#071A3A;line-height:1.6;max-width:560px">',
    ...paragraphs.map((paragraph) => `<p>${frenchTypography(paragraph)}</p>`),
    `<p><a href="${input.dashboardUrl}" style="display:inline-block;padding:10px 18px;background:#071A3A;color:#FFFFFF;text-decoration:none;border-radius:6px">${frenchTypography('Consulter le bilan sur mon espace')}</a></p>`,
    `<p>${frenchTypography('Bien cordialement,')}<br>${frenchTypography('L\'équipe Nexus Réussite')}</p>`,
    '</div>',
  ].join('');
  return Object.freeze({ subject, text, html });
}
