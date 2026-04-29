import {
  calculateNexusInvoiceTotals,
  NEXUS_INVOICE_PACKAGES,
  buildNexusInvoiceRequest,
  tndToMillimes,
} from '@/lib/invoice/nexus-calculations';

describe('nexus invoice calculations', () => {
  it('computes HT, TVA 6%, TTC, adjustment, mixed payments and remaining due in millimes', () => {
    const totals = calculateNexusInvoiceTotals({
      priceTtc: tndToMillimes(1149),
      normalPriceTtc: tndToMillimes(1188),
      adjustmentTtc: tndToMillimes(50),
      payments: [
        { method: 'BANK_TRANSFER', amount: tndToMillimes(500), reference: 'VIR-001' },
        { method: 'CHEQUE', amount: tndToMillimes(400), reference: 'CHQ-002' },
        { method: 'CASH', amount: tndToMillimes(199), reference: 'Espèces' },
      ],
      masteriumMonths: 1,
      masteriumMonthlyValue: tndToMillimes(129),
    });

    expect(totals.netTtc).toBe(1_099_000);
    expect(totals.netHt + totals.vat).toBe(totals.netTtc);
    expect(totals.vat).toBe(62_208);
    expect(totals.packageDiscount).toBe(39_000);
    expect(totals.paid).toBe(1_099_000);
    expect(totals.due).toBe(0);
    expect(totals.masteriumOfferedValue).toBe(129_000);
  });

  it('keeps Masterium offered access at zero billed amount in the API request', () => {
    const duo = NEXUS_INVOICE_PACKAGES.find((pack) => pack.id === 'duo-premiere');
    expect(duo).toBeDefined();

    const request = buildNexusInvoiceRequest({
      customerName: 'Parent Responsable',
      customerInfo: 'Client particulier',
      invoiceDate: '2026-04-28',
      packageLabel: duo!.label,
      packageSubtitle: duo!.subtitle,
      frenchHours: duo!.frenchHours,
      mathHours: duo!.mathHours,
      priceTtc: duo!.priceTtc,
      normalPriceTtc: duo!.normalPriceTtc,
      adjustmentTtc: 0,
      adjustmentLabel: 'Ajustement séance non suivie',
      payments: [],
      masteriumMonths: 1,
      masteriumMonthlyValue: tndToMillimes(129),
      notes: 'Accès Masterium offert à titre commercial, non facturé.',
    });

    expect(request.items).toEqual(
      expect.arrayContaining([
        expect.objectContaining({
          label: 'Accès plateforme EAF — Masterium offert',
          unitPrice: 0,
          total: 0,
        }),
      ])
    );
    expect(request.items.reduce((sum, item) => sum + item.total, 0)).toBe(duo!.priceTtc);
    expect(request.notes).toContain('Accès Masterium offert à titre commercial, non facturé.');
  });

  it('builds a production request with three mixed payments and matching UI/API totals', () => {
    const duo = NEXUS_INVOICE_PACKAGES.find((pack) => pack.id === 'duo-premiere')!;

    const request = buildNexusInvoiceRequest({
      customerName: 'Parent Responsable',
      customerInfo: 'Client particulier',
      invoiceNumber: 'FAC-2026-TEST',
      invoiceDate: '2026-04-28',
      packageLabel: duo.label,
      packageSubtitle: duo.subtitle,
      frenchHours: duo.frenchHours,
      mathHours: duo.mathHours,
      priceTtc: duo.priceTtc,
      normalPriceTtc: duo.normalPriceTtc,
      adjustmentTtc: tndToMillimes(50),
      adjustmentLabel: 'Ajustement séance non suivie',
      payments: [
        { method: 'BANK_TRANSFER', amount: tndToMillimes(500), reference: 'VIR-001' },
        { method: 'CHEQUE', amount: tndToMillimes(400), reference: 'CHQ-002 Banque BIAT' },
        { method: 'CASH', amount: tndToMillimes(199), reference: 'Espèces bureau' },
      ],
      masteriumMonths: 1,
      masteriumMonthlyValue: tndToMillimes(129),
      notes: '',
    });

    expect(request.discountTotal).toBe(50_000);
    expect(request.taxRegime).toBe('TVA_INCLUSE');
    expect(request.paymentMethod).toBeNull();
    expect(request.items[0].description).toContain('Prix forfaitaire incluant une remise commerciale de 39,000 TND');
    expect(request.paymentDetails?.notes).toContain('Virement bancaire : 500,000 TND (VIR-001)');
    expect(request.paymentDetails?.notes).toContain('Chèque : 400,000 TND (CHQ-002 Banque BIAT)');
    expect(request.paymentDetails?.notes).toContain('Espèces : 199,000 TND (Espèces bureau)');
    expect(request.paymentDetails?.notes?.replace(/\s/g, ' ')).toContain('Net payé : 1 099,000 TND');
    expect(request.paymentDetails?.notes).toContain('Reste à payer : 0,000 TND');
    expect(request.notes).toBe(request.paymentDetails?.notes);
    expect(request.items).toEqual(
      expect.arrayContaining([
        expect.objectContaining({
          label: 'Duo Première — Français + Maths',
          description: expect.stringContaining('Français : 16h · Mathématiques : 14h'),
          unitPrice: 1_149_000,
          total: 1_149_000,
        }),
        expect.objectContaining({
          label: 'Accès plateforme EAF — Masterium offert',
          description: expect.stringContaining('Accès Masterium offert à titre commercial, non facturé.'),
          unitPrice: 0,
          total: 0,
        }),
      ])
    );
  });

  it('keeps the payment method only when a single non-zero method is used', () => {
    const duo = NEXUS_INVOICE_PACKAGES.find((pack) => pack.id === 'duo-premiere')!;

    const request = buildNexusInvoiceRequest({
      customerName: 'Parent Responsable',
      customerInfo: 'Client particulier',
      invoiceDate: '2026-04-28',
      packageLabel: duo.label,
      packageSubtitle: duo.subtitle,
      frenchHours: duo.frenchHours,
      mathHours: duo.mathHours,
      priceTtc: duo.priceTtc,
      normalPriceTtc: duo.normalPriceTtc,
      adjustmentTtc: 0,
      adjustmentLabel: 'Ajustement séance non suivie',
      payments: [
        { method: 'CHEQUE', amount: tndToMillimes(400), reference: 'CHQ-001' },
        { method: 'CHEQUE', amount: tndToMillimes(749), reference: 'CHQ-002' },
      ],
      masteriumMonths: 1,
      masteriumMonthlyValue: tndToMillimes(129),
      notes: '',
    });

    expect(request.paymentMethod).toBe('CHEQUE');
  });
});
