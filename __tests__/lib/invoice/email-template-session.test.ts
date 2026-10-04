import { renderInvoiceEmailHtml, renderInvoiceEmailText } from '@/lib/invoice/email-template';

it('explains that a time-limited invoice link still requires the financial account session', () => {
  const input = { invoiceNumber:'SYNTHETIC-1',customerName:'Famille synthétique',
    formattedTotal:'1,000 TND',pdfUrl:'https://example.invalid/api/invoices/synthetic/pdf',expiryHours:72 };
  for (const message of [renderInvoiceEmailHtml(input),renderInvoiceEmailText(input)]) {
    expect(message).toContain('Connectez-vous à votre espace Nexus Réussite avant d’ouvrir ce lien.');
    expect(message).toContain('72');
    expect(message).toContain(input.pdfUrl);
  }
});
