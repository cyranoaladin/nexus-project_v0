/**
 * Email templates for Nexus Réussite.
 *
 * Each template returns { subject, html, text } ready for sendMail().
 * Templates are pure functions — no side effects, no env access.
 */
import { LEGAL } from '@/lib/legal';

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
<a href="mailto:${LEGAL.contact.email}" style="color:#6366f1;text-decoration:none;">${LEGAL.contact.email}</a>
</p>
</td></tr>
</table>
</td></tr>
</table>
</body>
</html>`;
}

export function escapeHtml(str: string): string {
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
  Une question ? Répondez directement à cet email ou appelez le ${LEGAL.contact.phone}.
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
    `Une question ? ${LEGAL.contact.email} ou ${LEGAL.contact.phone}`,
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

export interface ContactLeadNotificationData {
  id: string;
  name: string;
  email: string;
  phone?: string | null;
  profile?: string | null;
  interest?: string | null;
  urgency?: string | null;
  source?: string | null;
  createdAt: Date | string;
}

export function contactLeadNotification(data: ContactLeadNotificationData): EmailTemplate {
  const subject = `[Nexus] Nouveau prospect - ${data.name}`;
  const createdAt = new Date(data.createdAt).toLocaleString('fr-FR', {
    dateStyle: 'medium',
    timeStyle: 'short',
  });
  const fields: Record<string, string> = {
    'ID CRM': data.id,
    Nom: data.name,
    Email: data.email,
    WhatsApp: data.phone || 'Non renseigné',
    Profil: data.profile || 'Non renseigné',
    Niveau: data.interest || 'Non renseigné',
    Urgence: data.urgency || 'Non renseigné',
    Source: data.source || 'Non renseignée',
    'Date de capture': createdAt,
  };

  const fieldRows = Object.entries(fields)
    .map(([key, value]) => `<li><strong>${escapeHtml(key)} :</strong> ${escapeHtml(value)}</li>`)
    .join('');

  const html = wrapLayout(
    'Nouveau prospect',
    '#111827',
    `
<p style="color:#333;line-height:1.6;">Une demande de bilan vient d'être capturée depuis le site Nexus Réussite.</p>
<div style="background:#f8f9fa;padding:20px;border-radius:8px;margin:20px 0;">
  <ul style="list-style:none;padding:0;margin:0;font-size:14px;line-height:2;">${fieldRows}</ul>
</div>
<p style="color:#333;line-height:1.6;">Répondre directement à cet email pour contacter le prospect.</p>
`
  );

  const text = [
    '[Nexus] Nouveau prospect',
    '',
    ...Object.entries(fields).map(([key, value]) => `${key}: ${value}`),
    '',
    'Répondre directement à cet email pour contacter le prospect.',
  ].join('\n');

  return { subject, html, text };
}

// ─── Template: pré-commande de manuels ──────────────────────────────────────

export interface ManuelsOrderLine {
  title: string;
  disciplineLabel: string;
  pages: number;
}

export interface ManuelsOrderData {
  reference: string;
  name: string;
  email: string;
  phone: string;
  formatLabel: string;
  deliveryLabel: string;
  address?: string;
  lines: ManuelsOrderLine[];
  volumes: number;
  pages: number;
  total: number;
  message?: string;
  createdAt: Date | string;
}

function manuelsOrderRows(lines: ManuelsOrderLine[]): string {
  return lines
    .map(
      (l) =>
        `<tr><td style="padding:6px 0;border-bottom:1px solid #eee;font-size:14px;">${escapeHtml(
          l.disciplineLabel,
        )} — ${escapeHtml(l.title)}</td><td style="padding:6px 0;border-bottom:1px solid #eee;font-size:14px;text-align:right;white-space:nowrap;">${l.pages} p.</td></tr>`,
    )
    .join('');
}

/** Notification interne : le détail complet de la demande. */
export function manuelsOrderNotification(data: ManuelsOrderData): EmailTemplate {
  const createdAt = new Date(data.createdAt).toLocaleString('fr-FR', {
    dateStyle: 'medium',
    timeStyle: 'short',
  });
  const livraison = data.address
    ? `${data.deliveryLabel} — ${data.address}`
    : data.deliveryLabel;
  const subject = `[Nexus] Pré-commande manuels — ${data.name} — ${data.total} DT`;

  const html = wrapLayout(
    'Pré-commande de manuels',
    '#111827',
    `
<div style="background:#f8f9fa;padding:20px;border-radius:8px;margin:0 0 20px;">
  <ul style="list-style:none;padding:0;margin:0;font-size:14px;line-height:2;">
    <li><strong>Référence :</strong> ${escapeHtml(data.reference)}</li>
    <li><strong>Nom :</strong> ${escapeHtml(data.name)}</li>
    <li><strong>Email :</strong> ${escapeHtml(data.email)}</li>
    <li><strong>Téléphone :</strong> ${escapeHtml(data.phone)}</li>
    <li><strong>Format :</strong> ${escapeHtml(data.formatLabel)}</li>
    <li><strong>Remise :</strong> ${escapeHtml(livraison)}</li>
    <li><strong>Reçue le :</strong> ${escapeHtml(createdAt)}</li>
  </ul>
</div>
<table role="presentation" width="100%" cellpadding="0" cellspacing="0">${manuelsOrderRows(data.lines)}</table>
<p style="margin:20px 0 0;font-size:15px;"><strong>${data.volumes} volume(s), ${data.pages} pages — ${data.total} DT</strong></p>
${data.message ? `<p style="margin:16px 0 0;font-size:14px;color:#333;">Message : ${escapeHtml(data.message)}</p>` : ''}
<p style="margin:20px 0 0;font-size:13px;color:#666;">Répondre à cet e-mail écrit directement au demandeur.</p>`,
  );

  const text = [
    `Pré-commande manuels — ${data.reference}`,
    `${data.name} · ${data.email} · ${data.phone}`,
    `${data.formatLabel} · ${livraison}`,
    '',
    ...data.lines.map((l) => `- ${l.disciplineLabel} — ${l.title} (${l.pages} p.)`),
    '',
    `${data.volumes} volume(s), ${data.pages} pages — ${data.total} DT`,
    data.message ? `Message : ${data.message}` : '',
  ]
    .filter(Boolean)
    .join('\n');

  return { subject, html, text };
}

/** Accusé de réception envoyé au demandeur. */
export function manuelsOrderAcknowledgement(data: ManuelsOrderData): EmailTemplate {
  const subject = `Votre demande de manuels — Nexus Réussite (${data.reference})`;
  const html = wrapLayout(
    'Demande bien reçue',
    '#1d4ed8',
    `
<p style="color:#333;line-height:1.6;">Bonjour ${escapeHtml(data.name)},</p>
<p style="color:#333;line-height:1.6;">Nous avons bien reçu votre demande de manuels. Elle n'est pas encore
une commande ferme : nous revenons vers vous pour confirmer la disponibilité des volumes,
le délai de fabrication et le règlement.</p>
<table role="presentation" width="100%" cellpadding="0" cellspacing="0">${manuelsOrderRows(data.lines)}</table>
<p style="margin:20px 0 0;font-size:15px;"><strong>${data.volumes} volume(s), ${data.pages} pages — ${data.total} DT</strong></p>
<p style="margin:8px 0 0;font-size:14px;color:#555;">${escapeHtml(data.formatLabel)} · ${escapeHtml(data.deliveryLabel)}</p>
<p style="margin:20px 0 0;font-size:13px;color:#666;">Référence à rappeler : ${escapeHtml(data.reference)}</p>`,
  );
  const text = [
    `Bonjour ${data.name},`,
    '',
    "Nous avons bien reçu votre demande de manuels. Elle n'est pas encore une commande ferme :",
    'nous revenons vers vous pour confirmer la disponibilité, le délai et le règlement.',
    '',
    ...data.lines.map((l) => `- ${l.disciplineLabel} — ${l.title} (${l.pages} p.)`),
    '',
    `${data.volumes} volume(s), ${data.pages} pages — ${data.total} DT`,
    `${data.formatLabel} · ${data.deliveryLabel}`,
    `Référence : ${data.reference}`,
  ].join('\n');
  return { subject, html, text };
}
