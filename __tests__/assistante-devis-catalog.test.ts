import { getAssistanteDevisCatalog } from '@/lib/assistante-devis-catalog';
import { getFullPricingData } from '@/lib/pricing';

function visibleEntries(catalog: ReturnType<typeof getAssistanteDevisCatalog>) {
  return Object.entries(catalog).filter(([key]) => !key.startsWith('_'));
}

describe('assistante devis catalog', () => {
  test('is generated from the canonical pricing loader', () => {
    const catalog = getAssistanteDevisCatalog();
    const pricing = getFullPricingData();

    expect(catalog._meta.source).toBe('data/pricing.canonical.json');
    expect(catalog._meta.loader).toBe('lib/pricing.ts');
    expect(catalog._meta.version).toBe(pricing.version);
  });

  test('exposes every public annual offer', () => {
    const catalog = getAssistanteDevisCatalog();
    const pricing = getFullPricingData();

    for (const offer of pricing.offers) {
      expect(catalog[offer.id]).toMatchObject({
        sourceType: 'annual_offer',
        sourceId: offer.id,
        label: offer.title,
        annual: offer.price_annual,
      });
      expect(catalog[offer.id]).not.toHaveProperty('monthly');
    }
  });

  test('exposes each canonical stage format separately', () => {
    const catalog = getAssistanteDevisCatalog();
    const pricing = getFullPricingData();

    for (const format of pricing.stage_formats) {
      expect(catalog[`stage:${format.format_id}`]).toMatchObject({
        sourceType: 'stage_format',
        sourceId: format.format_id,
        label: `Stage - ${format.title}`,
        display: `${format.price_per_student.toLocaleString('fr-FR')} TND`,
      });
    }
  });

  test('exposes canonical ponctuel, coaching, pack, special and urgence services', () => {
    const catalog = getAssistanteDevisCatalog();
    const pricing = getFullPricingData();

    for (const offer of pricing.ponctuel_offers) {
      expect(catalog[`ponctuel:${offer.id}`]).toMatchObject({
        sourceType: 'ponctuel_offer',
        sourceId: offer.id,
        label: offer.title,
      });
    }

    for (const offer of pricing.coaching) {
      expect(catalog[`coaching:${offer.id}`]).toMatchObject({
        sourceType: 'coaching_offer',
        sourceId: offer.id,
        label: offer.title,
      });
    }

    for (const pack of pricing.packs) {
      expect(catalog[`pack:${pack.id}`]).toMatchObject({
        sourceType: 'pack',
        sourceId: pack.id,
        label: pack.title,
      });
    }

    for (const program of pricing.special_programs) {
      expect(catalog[`special:${program.id}`]).toMatchObject({
        sourceType: 'special_program',
        sourceId: program.id,
        label: program.title,
      });
    }

    for (const [key, offer] of Object.entries(pricing.urgence)) {
      expect(catalog[`urgence:${key}`]).toMatchObject({
        sourceType: 'urgence',
        sourceId: key,
        label: offer.title,
      });
    }
  });

  test('visible entry count equals the canonical commercial catalog count', () => {
    const catalog = getAssistanteDevisCatalog();
    const pricing = getFullPricingData();
    const expectedCount =
      pricing.offers.length +
      pricing.stage_formats.length +
      pricing.ponctuel_offers.length +
      pricing.coaching.length +
      pricing.packs.length +
      pricing.special_programs.length +
      Object.keys(pricing.urgence).length;

    expect(visibleEntries(catalog)).toHaveLength(expectedCount);
  });

  test('does not expose legacy publicAnnual campaign pricing', () => {
    const catalog = getAssistanteDevisCatalog();

    for (const [, offer] of visibleEntries(catalog)) {
      expect(offer).not.toHaveProperty('publicAnnual');
    }
  });

  test('meta counts match each canonical family exactly', () => {
    const catalog = getAssistanteDevisCatalog();
    const pricing = getFullPricingData();

    expect(catalog._meta.counts).toEqual({
      annual_offer: pricing.offers.length,
      stage_format: pricing.stage_formats.length,
      ponctuel_offer: pricing.ponctuel_offers.length,
      coaching_offer: pricing.coaching.length,
      pack: pricing.packs.length,
      special_program: pricing.special_programs.length,
      urgence: Object.keys(pricing.urgence).length,
    });
  });

  test('does not expose legacy camelCase recommendation keys', () => {
    const catalog = getAssistanteDevisCatalog();

    expect(catalog).not.toHaveProperty('terminaleLibreMixte');
    expect(catalog).not.toHaveProperty('duoTerminaleNexus');
    expect(catalog).not.toHaveProperty('premiereDoubleSecurite');
    expect(catalog).not.toHaveProperty('secondeSciences');
  });

  test('annual offer schedules reuse canonical payment fields', () => {
    const catalog = getAssistanteDevisCatalog();
    const pricing = getFullPricingData();

    for (const offer of pricing.offers.filter((item) => item.deposit != null)) {
      const devisOffer = catalog[offer.id];
      expect(devisOffer).toMatchObject({ echeancier: expect.any(Array) });
      expect((devisOffer as { echeancier: number[] }).echeancier[0]).toBe(offer.deposit);
      expect((devisOffer as { echeancier: number[] }).echeancier).toContain(
        offer.last_installment ?? offer.installment_amount,
      );
      expect((devisOffer as { paiement: string }).paiement).toContain(`${offer.deposit!.toLocaleString('fr-FR')} TND`);
      expect((devisOffer as { paiement: string }).paiement).toContain(`${offer.n_installments} mensualites`);
    }
  });

  test('stage payment schedules expose canonical deposit and balance', () => {
    const catalog = getAssistanteDevisCatalog();
    const pricing = getFullPricingData();

    for (const format of pricing.stage_formats) {
      expect(catalog[`stage:${format.format_id}`]).toMatchObject({
        echeancier: [format.payment.deposit, format.payment.solde],
      });
    }
  });

  test('visible display strings do not contain legacy campaign wording', () => {
    const catalog = getAssistanteDevisCatalog();

    const payload = JSON.stringify(visibleEntries(catalog));
    expect(payload).not.toMatch(/campagne/i);
    expect(payload).not.toMatch(/tarif public/i);
    expect(payload).not.toMatch(/8\s?750/);
  });

  test('platform offers expose annual prices without legacy monthly display', () => {
    const catalog = getAssistanteDevisCatalog();
    const pricing = getFullPricingData();

    for (const offer of pricing.offers.filter((item) => item.track === 'plateforme')) {
      expect(catalog[offer.id]).toMatchObject({
        annual: offer.price_annual,
      });
      expect(catalog[offer.id]).not.toHaveProperty('monthly');
    }
  });
});
