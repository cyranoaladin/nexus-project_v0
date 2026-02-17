/**
 * Invoice email template — premium lite.
 *
 * Generates HTML email body for invoice delivery with a single CTA button.
 * Design: clean, branded, responsive, dark-compatible.
 */

export interface InvoiceEmailData {
  /** Invoice number (e.g. "202602-0001") */
  invoiceNumber: string;
  /** Customer name */
  customerName: string;
  /** Formatted total (e.g. "350,000 TND") */
  formattedTotal: string;
  /** Full URL to download the PDF (with token) */
  pdfUrl: string;
  /** Token expiry in hours (for display) */
  expiryHours: number;
}

/**
 * Generate the email subject line.
 */
export function getInvoiceEmailSubject(invoiceNumber: string): string {
  return `Votre facture Nexus Réussite — ${invoiceNumber}`;
}

/**
 * Generate the HTML email body.
 */
export function renderInvoiceEmailHtml(data: InvoiceEmailData): string {
  const { invoiceNumber, customerName, formattedTotal, pdfUrl, expiryHours } = data;

  return `<!DOCTYPE html>
<html lang="fr">
<head>
  <meta charset="utf-8" />
  <meta name="viewport" content="width=device-width, initial-scale=1.0" />
  <title>Facture ${invoiceNumber}</title>
</head>
<body style="margin:0;padding:0;background-color:#f5f5f5;font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',Roboto,Helvetica,Arial,sans-serif;">
  <table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="background-color:#f5f5f5;padding:32px 16px;">
    <tr>
      <td align="center">
        <table role="presentation" width="560" cellpadding="0" cellspacing="0" style="background-color:#ffffff;border-radius:12px;overflow:hidden;box-shadow:0 1px 3px rgba(0,0,0,0.1);">
          
          <!-- Header -->
          <tr>
            <td style="background-color:#1a1a2e;padding:24px 32px;text-align:center;">
              <h1 style="margin:0;font-size:20px;font-weight:700;color:#ffffff;letter-spacing:0.5px;">
                Nexus Réussite
              </h1>
              <p style="margin:4px 0 0;font-size:12px;color:#a0a0b0;">
                M&amp;M Academy — Excellence éducative
              </p>
            </td>
          </tr>

          <!-- Body -->
          <tr>
            <td style="padding:32px;">
              <p style="margin:0 0 16px;font-size:15px;color:#333333;line-height:1.6;">
                Bonjour ${escapeHtml(customerName)},
              </p>
              <p style="margin:0 0 24px;font-size:15px;color:#333333;line-height:1.6;">
                Veuillez trouver ci-dessous votre facture <strong>${escapeHtml(invoiceNumber)}</strong>
                d'un montant de <strong>${escapeHtml(formattedTotal)}</strong>.
              </p>

              <!-- CTA Button -->
              <table role="presentation" width="100%" cellpadding="0" cellspacing="0">
                <tr>
                  <td align="center" style="padding:8px 0 24px;">
                    <a href="${escapeHtml(pdfUrl)}"
                       target="_blank"
                       style="display:inline-block;padding:14px 32px;background-color:#6366f1;color:#ffffff;font-size:15px;font-weight:600;text-decoration:none;border-radius:8px;letter-spacing:0.3px;">
                      Télécharger la facture
                    </a>
                  </td>
                </tr>
              </table>

              <!-- Expiry notice -->
              <p style="margin:0 0 8px;font-size:13px;color:#888888;line-height:1.5;text-align:center;">
                Ce lien est valable <strong>${expiryHours} heures</strong>.
                Passé ce délai, veuillez nous contacter pour un nouvel envoi.
              </p>
            </td>
          </tr>

          <!-- Footer -->
          <tr>
            <td style="background-color:#fafafa;padding:20px 32px;border-top:1px solid #eeeeee;">
              <p style="margin:0;font-size:12px;color:#999999;line-height:1.5;text-align:center;">
                M&amp;M Academy — Nexus Réussite<br />
                Résidence Narjess 2, Bloc D, Appt 12, Raoued 2056, Ariana, Tunisie<br />
                <a href="mailto:contact@nexusreussite.academy" style="color:#6366f1;text-decoration:none;">
                  contact@nexusreussite.academy
                </a>
              </p>
            </td>
          </tr>

        </table>
      </td>
    </tr>
  </table>
</body>
</html>`;
}

/**
 * Generate plain-text fallback for email clients that don't support HTML.
 */
export function renderInvoiceEmailText(data: InvoiceEmailData): string {
  const { invoiceNumber, customerName, formattedTotal, pdfUrl, expiryHours } = data;

  return [
    `Bonjour ${customerName},`,
    '',
    `Veuillez trouver ci-dessous votre facture ${invoiceNumber} d'un montant de ${formattedTotal}.`,
    '',
    `Télécharger la facture : ${pdfUrl}`,
    '',
    `Ce lien est valable ${expiryHours} heures.`,
    `Passé ce délai, veuillez nous contacter pour un nouvel envoi.`,
    '',
    '---',
    'M&M Academy — Nexus Réussite',
    'Résidence Narjess 2, Bloc D, Appt 12, Raoued 2056, Ariana, Tunisie',
    'contact@nexusreussite.academy',
  ].join('\n');
}

// ─── Helpers ─────────────────────────────────────────────────────────────────

function escapeHtml(str: string): string {
  return str
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;');
}
