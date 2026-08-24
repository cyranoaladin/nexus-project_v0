/**
 * T17 — Candidat individuel pricing invariants (mission CDC §6-9, §59).
 *
 * These assertions protect the new public offer table: fixed annual price,
 * 25% acompte + 10 mensualités (décision D4, docs/audit-devis-candidats-
 * libres.md §5 — tranchée définitivement par la mission finale du
 * 2026-08-24), per-family group size, and the removal of the deprecated
 * candidat-libre catalog. If a business rule here changes, this test must
 * change with it to express the new invariant explicitly — never silently
 * deleted.
 */
import { getAllOffers, getAnnualOffer, getCandidatIndividuelModules, getIndicativeProgram, getRules } from '@/lib/pricing';

const CANDIDAT_INDIVIDUEL_IDS = [
  'libre-pilotage',
  'libre-sur-mesure',
  'premiere-libre-cap-anticipees',
  'premiere-libre-renforcee',
  'terminale-libre-focus-bac',
  'terminale-libre-integrale',
] as const;

const OLD_CANDIDAT_LIBRE_IDS = [
  '1re-libre-essentiel',
  '1re-libre-accomp',
  'term-libre-online',
  'term-libre-mixte',
  'term-libre-premium',
  'pass-candidat-libre',
];

describe('T17.1 — Old candidat-libre catalog fully removed', () => {
  test('none of the 6 deprecated IDs exist among annual offers or packs', () => {
    const allOfferIds = getAllOffers().map((o) => o.id);
    for (const oldId of OLD_CANDIDAT_LIBRE_IDS) {
      expect(allOfferIds).not.toContain(oldId);
    }
  });
});

describe('T17.2 — Six fixed annual prices, 25% acompte + 10 mensualités (D4)', () => {
  const expected: Record<string, { deposit: number; installment: number; lastInstallment: number; annual: number }> =
    {
      'libre-pilotage': { deposit: 380, installment: 112, lastInstallment: 112, annual: 1500 },
      'libre-sur-mesure': { deposit: 1550, installment: 465, lastInstallment: 465, annual: 6200 },
      'premiere-libre-cap-anticipees': { deposit: 1980, installment: 592, lastInstallment: 592, annual: 7900 },
      'premiere-libre-renforcee': { deposit: 2980, installment: 892, lastInstallment: 892, annual: 11900 },
      'terminale-libre-focus-bac': { deposit: 3220, installment: 968, lastInstallment: 968, annual: 12900 },
      'terminale-libre-integrale': { deposit: 4220, installment: 1268, lastInstallment: 1268, annual: 16900 },
    };

  test('all 6 offers exist', () => {
    for (const id of CANDIDAT_INDIVIDUEL_IDS) {
      expect(getAnnualOffer(id)).toBeDefined();
    }
  });

  test.each(CANDIDAT_INDIVIDUEL_IDS)('%s: deposit (25%%, nearest 10 TND) + 10 mensualités = annual, exact', (id) => {
    const offer = getAnnualOffer(id)!;
    const { deposit, installment, lastInstallment, annual } = expected[id];
    expect(offer.price_annual).toBe(annual);
    expect(offer.deposit).toBe(deposit);
    expect(offer.installment_amount).toBe(installment);
    expect(offer.last_installment).toBe(lastInstallment);
    expect(offer.n_installments).toBe(10);
    // D4 invariant: deposit + 9 regular installments + last === annual total, never off by a dinar.
    const reconstructed = offer.deposit! + offer.installment_amount! * 9 + offer.last_installment!;
    expect(reconstructed).toBe(annual);
    // ~25%, allowing for rounding to the nearest 10 TND.
    const pct = offer.deposit! / annual;
    expect(pct).toBeGreaterThan(0.24);
    expect(pct).toBeLessThan(0.26);
  });

  test('all 6 offers belong to the candidat_individuel effectif family, or have no group', () => {
    for (const id of CANDIDAT_INDIVIDUEL_IDS) {
      const offer = getAnnualOffer(id)!;
      if (offer.group_max != null) {
        expect(offer.effectif_family).toBe('candidat_individuel');
      }
    }
  });

  test('group-bearing offers open at 3, cap at 6 (not 5)', () => {
    const groupOffers = CANDIDAT_INDIVIDUEL_IDS.map((id) => getAnnualOffer(id)!).filter(
      (o) => o.group_max != null,
    );
    expect(groupOffers.length).toBeGreaterThan(0);
    for (const offer of groupOffers) {
      expect(offer.group_min_open).toBe(3);
      expect(offer.group_max).toBe(6);
    }
  });
});

describe('T17.3 — Modular building blocks for the sur-mesure devis engine', () => {
  test('pilotage = 150/mois', () => {
    expect(getCandidatIndividuelModules().pilotage.price_monthly).toBe(150);
  });

  test('petit groupe: 4h=250, 8h=470, 12h=680, group 3-6', () => {
    const modules = getCandidatIndividuelModules();
    const byHours = new Map(modules.petit_groupe.map((m) => [m.hours_per_month, m]));
    expect(byHours.get(4)?.price_per_student_monthly).toBe(250);
    expect(byHours.get(8)?.price_per_student_monthly).toBe(470);
    expect(byHours.get(12)?.price_per_student_monthly).toBe(680);
    for (const m of modules.petit_groupe) {
      expect(m.group_min_open).toBe(3);
      expect(m.group_max).toBe(6);
    }
  });

  test('duo = 90 TND/h/élève', () => {
    expect(getCandidatIndividuelModules().duo.price_per_hour_per_student).toBe(90);
  });

  test('individuel floor stays >= 180 TND/h (never lowered to 175)', () => {
    const individuel = getCandidatIndividuelModules().individuel;
    expect(individuel.price_per_hour_min).toBeGreaterThanOrEqual(180);
    expect(individuel.floor_type).toBe('coaching_1to1');
  });
});

describe('T17.4 — Bac accéléré is indicative, not a closed offer', () => {
  test('bac-accelere lives outside the fixed offers array', () => {
    expect(getAllOffers().find((o) => o.id === 'bac-accelere')).toBeUndefined();
  });

  test('bac-accelere has a price range and requires human eligibility review', () => {
    const program = getIndicativeProgram('bac-accelere');
    expect(program).toBeDefined();
    expect(program!.price_monthly_min).toBe(1700);
    expect(program!.price_monthly_max).toBe(2700);
    expect(program!.eligibility_requires_human_review).toBe(true);
  });
});

describe('T17.5 — Grand Oral policy is bounded, not unlimited (direction-approved)', () => {
  test('4 sessions x 2h = 8h max/year, applies to Focus Bac and Intégrale', () => {
    const policy = getRules().grand_oral_policy;
    expect(policy.included_sessions).toBe(4);
    expect(policy.session_duration_minutes).toBe(120);
    expect(policy.included_sessions * (policy.session_duration_minutes / 60)).toBe(policy.total_hours_max);
    expect(policy.total_hours_max).toBe(8);
    expect(policy.applies_to_offer_ids).toContain('terminale-libre-focus-bac');
    expect(policy.applies_to_offer_ids).toContain('terminale-libre-integrale');
  });

  test('Intégrale: the 8h are inside the 30h/month ceiling, not additional', () => {
    const integrale = getAnnualOffer('terminale-libre-integrale')!;
    expect(integrale.hours_per_month_is_ceiling).toBe(true);
    expect(integrale.hours_per_month).toBe(30);
    const policy = getRules().grand_oral_policy;
    expect(policy.note_integrale.toLowerCase()).toContain('30 h/mois');
  });

  test('Focus Bac: the 8h are the dedicated annual Grand Oral envelope, on top of the 20h/month regular structure', () => {
    const focusBac = getAnnualOffer('terminale-libre-focus-bac')!;
    expect(focusBac.hours_per_month).toBe(20);
    expect(focusBac.hours_per_month_is_ceiling).toBeUndefined();
    const policy = getRules().grand_oral_policy;
    expect(policy.note_focus_bac.toLowerCase()).toContain('20 h/mois');
  });
});
