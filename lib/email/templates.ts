const BRAND = {
  name: 'Nexus Réussite',
  logo: process.env.NEXUS_LOGO_URL || '/images/logo_nexus.png',
  color: '#0f172a',
  accent: '#06b6d4',
};

function layout({ title, body, preview }: { title: string; body: string; preview?: string; }) {
  return `<!doctype html>
  <html>
  <head>
    <meta charset="utf-8"/>
    <meta name="viewport" content="width=device-width,initial-scale=1"/>
    <title>${title}</title>
    <style>
      body{background:#f6f7fb;margin:0;font-family:Inter,Segoe UI,Helvetica,Arial,sans-serif;color:#0f172a}
      .container{max-width:640px;margin:24px auto;background:#fff;border-radius:16px;overflow:hidden;box-shadow:0 10px 30px rgba(2,8,23,.08)}
      .header{display:flex;align-items:center;gap:12px;padding:20px 24px;background:${BRAND.color};color:#fff}
      .header img{height:28px}
      .content{padding:24px}
      h1{font-size:20px;margin:0 0 12px}
      p{line-height:1.6;color:#334155}
      .badge{display:inline-block;padding:2px 8px;border-radius:999px;background:${BRAND.accent};color:#06202a;font-size:12px;font-weight:600}
      .card{background:#f8fafc;border:1px solid #e2e8f0;border-radius:12px;padding:12px 16px;margin:12px 0}
      .footer{padding:16px 24px;color:#64748b;font-size:12px}
      .btn{display:inline-block;background:${BRAND.accent};color:#06202a;text-decoration:none;padding:10px 14px;border-radius:10px;font-weight:700}
      .muted{color:#64748b}
    </style>
  </head>
  <body>
    <span style="display:none;visibility:hidden;opacity:0;height:0;width:0">${preview || ''}</span>
    <div class="container">
      <div class="header">${BRAND.logo ? `<img src="${BRAND.logo}" alt="${BRAND.name}"/>` : ''}<strong>${BRAND.name}</strong></div>
      <div class="content">${body}</div>
      <div class="footer">Cet email vous est adressé par ${BRAND.name}. Merci pour votre confiance.</div>
    </div>
  </body>
  </html>`;
}

export const templates = {
  logo: process.env.NEXUS_LOGO_URL || '/images/logo_nexus.png',
};

export function tplCashReserved({ amountTnd, recordId }: { amountTnd: number; recordId: number; }) {
  const title = 'Réservation enregistrée — Paiement au centre';
  const body = `
    <span class="badge">Réservation cash</span>
    <h1>Nous avons bien reçu votre demande</h1>
    <p>Montant : <b>${amountTnd} TND</b></p>
    <div class="card">Référence réservation : <b>PR-${recordId}</b></div>
    <p class="muted">Présentez-vous au centre pour finaliser le paiement. Vous recevrez un email de confirmation après validation.</p>
  `;
  return layout({ title, body, preview: `Réservation cash PR-${recordId}` });
}

export function tplCashConfirmed({ recordId }: { recordId: number; }) {
  const title = 'Paiement validé — Crédits ajoutés';
  const body = `
    <span class="badge">Confirmation</span>
    <h1>Votre paiement a été validé</h1>
    <p>Les crédits associés à votre pack ont été ajoutés à votre compte.</p>
    <div class="card">Référence : <b>PR-${recordId}</b></div>
  `;
  return layout({ title, body, preview: `Paiement validé PR-${recordId}` });
}

export function tplCashCancelled({ recordId }: { recordId: number; }) {
  const title = 'Réservation annulée';
  const body = `
    <span class="badge">Annulation</span>
    <h1>Votre réservation a été annulée</h1>
    <p>La réservation au centre portant la référence ci-dessous a été annulée. Pour toute question ou pour reprogrammer un passage, contactez-nous.</p>
    <div class="card">Référence : <b>PR-${recordId}</b></div>
  `;
  return layout({ title, body, preview: `Annulation PR-${recordId}` });
}
