/**
 * Email templates for Nexus Réussite.
 *
 * Each template returns { subject, html, text } ready for sendMail().
 * Templates are pure functions — no side effects, no env access.
 */

// ─── Types ──────────────────────────────────────────────────────────────────

export interface EmailTemplate {
  subject: string;
  html: string;
  text: string;
}

// ─── Shared Layout ──────────────────────────────────────────────────────────

function wrapLayout(title: string, headerBg: string, body: string): string {
  return `<!DOCTYPE html>
<html lang="fr">
<head><meta charset="utf-8"/><meta name="viewport" content="width=device-width,initial-scale=1.0"/></head>
<body style="margin:0;padding:0;background:#f5f5f5;font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',Roboto,sans-serif;">
<table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="background:#f5f5f5;padding:32px 16px;">
<tr><td align="center">
<table role="presentation" width="560" cellpadding="0" cellspacing="0" style="background:#fff;border-radius:12px;overflow:hidden;box-shadow:0 1px 3px rgba(0,0,0,.1);">
<tr><td style="background:${headerBg};padding:24px 32px;text-align:center;">
<h1 style="margin:0;font-size:22px;font-weight:700;color:#fff;">${escapeHtml(title)}</h1>
<p style="margin:4px 0 0;font-size:12px;color:rgba(255,255,255,.8);">Nexus Réussite</p>
</td></tr>
<tr><td style="padding:32px;">${body}</td></tr>
<tr><td style="background:#fafafa;padding:16px 32px;border-top:1px solid #eee;">
<p style="margin:0;font-size:12px;color:#999;text-align:center;">
Nexus Réussite — M&amp;M Academy<br/>
<a href="mailto:contact@nexusreussite.academy" style="color:#6366f1;text-decoration:none;">contact@nexusreussite.academy</a>
</p>
</td></tr>
</table>
</td></tr>
</table>
</body>
</html>`;
}

function escapeHtml(str: string): string {
  return str
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;');
}

// ─── Template: Accusé réception bilan / pré-stage ───────────────────────────

export interface BilanAckData {
  parentName: string;
  studentName: string;
  /** e.g. "Bilan gratuit", "Stage Février 2026" */
  formType: string;
}

/**
 * Acknowledgement email sent after a "bilan gratuit" or pre-stage form submission.
 */
export function bilanAcknowledgement(data: BilanAckData): EmailTemplate {
  const { parentName, studentName, formType } = data;

  const subject = `✅ ${formType} — Demande bien reçue`;

  const html = wrapLayout(
    `${formType} — Demande reçue`,
    'linear-gradient(135deg,#2563EB,#7C3AED)',
    `
<p style="color:#333;line-height:1.6;">Bonjour ${escapeHtml(parentName)},</p>
<p style="color:#333;line-height:1.6;">
  Nous avons bien reçu votre demande de <strong>${escapeHtml(formType)}</strong>
  pour <strong>${escapeHtml(studentName)}</strong>.
</p>
<div style="background:#f0f4ff;padding:20px;border-radius:8px;margin:20px 0;border-left:4px solid #2563EB;">
  <h3 style="color:#1e40af;margin:0 0 12px;">Prochaines étapes</h3>
  <ol style="color:#1e40af;margin:0;padding-left:20px;font-size:14px;line-height:1.8;">
    <li>Notre équipe analyse le profil de ${escapeHtml(studentName)} sous 24h</li>
    <li>Un conseiller vous contacte pour un échange découverte</li>
    <li>Nous vous proposons un plan d'accompagnement personnalisé</li>
  </ol>
</div>
<p style="color:#666;font-size:14px;">
  Une question ? Répondez directement à cet email ou appelez le +216 99 19 28 29.
</p>
<p style="color:#333;">Cordialement,<br/><strong>L'équipe Nexus Réussite</strong></p>
`
  );

  const text = [
    `Bonjour ${parentName},`,
    '',
    `Nous avons bien reçu votre demande de ${formType} pour ${studentName}.`,
    '',
    'Prochaines étapes :',
    `1. Notre équipe analyse le profil de ${studentName} sous 24h`,
    '2. Un conseiller vous contacte pour un échange découverte',
    `3. Nous vous proposons un plan d'accompagnement personnalisé`,
    '',
    'Une question ? contact@nexusreussite.academy ou +216 99 19 28 29',
    '',
    'Cordialement,',
    "L'équipe Nexus Réussite",
  ].join('\n');

  return { subject, html, text };
}

// ─── Template: Notification interne (copie support) ─────────────────────────

export interface InternalNotificationData {
  /** Event type for subject line */
  eventType: string;
  /** Key-value pairs to display (no sensitive data!) */
  fields: Record<string, string>;
}

/**
 * Internal notification sent to support/contact when an event occurs.
 * Fields should NOT contain passwords, tokens, or full email addresses.
 */
export function internalNotification(data: InternalNotificationData): EmailTemplate {
  const { eventType, fields } = data;

  const subject = `[Nexus] ${eventType}`;

  const fieldRows = Object.entries(fields)
    .map(([k, v]) => `<li><strong>${escapeHtml(k)} :</strong> ${escapeHtml(v)}</li>`)
    .join('');

  const html = wrapLayout(
    eventType,
    '#1a1a2e',
    `
<p style="color:#333;line-height:1.6;">Nouvelle notification interne :</p>
<div style="background:#f8f9fa;padding:20px;border-radius:8px;margin:20px 0;">
  <ul style="list-style:none;padding:0;margin:0;font-size:14px;line-height:2;">${fieldRows}</ul>
</div>
<p style="color:#999;font-size:12px;">Email généré automatiquement — ne pas répondre.</p>
`
  );

  const fieldLines = Object.entries(fields)
    .map(([k, v]) => `- ${k}: ${v}`)
    .join('\n');

  const text = [
    `[Nexus] ${eventType}`,
    '',
    fieldLines,
    '',
    'Email généré automatiquement.',
  ].join('\n');

  return { subject, html, text };
}
