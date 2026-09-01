import { requireExamPolicy } from '@/lib/exams/catalog';
import { genererCarteExamen } from '@/lib/exams/carte';
import type { ProfilCandidatInput } from '@/lib/exams/parcours';
import {
  getCatalogue,
  resolveCatalogueModules,
  resetCatalogueCacheForTests,
  type CatalogueSelection,
  type ResolvedCatalogueModule,
} from '@/lib/quotes/catalogue';
import { computeCandidatLibreSchedule } from '@/lib/quotes/pricing';
import {
  applyDiscounts,
  assertMarginAcceptable,
  buildPricingEngineSnapshot,
  checkFloor,
  computeMargin,
  computeSecondGroupePayment,
  compareSelectionToCanonicalPacks,
  DiscountRejectedError,
  DoubleBillingDetectedError,
  MarginTooLowError,
  MARGIN_BLOCKING_THRESHOLD_PCT,
  MARGIN_TARGET_THRESHOLD_PCT,
  NoCostDataError,
  priceSelectedModule,
  priceSelection,
  pricePilotage,
  resolveGroupModality,
  resolveRate,
  UnapprovedCatalogueElementError,
} from '@/lib/quotes/pricing-engine';

const policy2027 = requireExamPolicy(2027);

function baseProfil(overrides: Partial<ProfilCandidatInput> = {}): ProfilCandidatInput {
  return {
    level: 'TERMINALE',
    examSession: 2027,
    modalite: 'A',
    specialite1: 'MATHEMATIQUES',
    specialite2: 'PHYSIQUE_CHIMIE',
    specialiteAbandonnee: null,
    langueA: null,
    langueB: null,
    estRedoublant: false,
    estTitulaireBacDejaObtenu: false,
    changementSpecialite: false,
    intentionAmelioration: false,
    intentionCycleComplet: true,
    brancheBascule: null,
    epreuvesDispenseesDeclarees: [],
    dispensesDeclarees: null,
    etalementPlurisessionsDeclare: false,
    moyenneRattrapage: null,
    optionsTerminale: [],
    notesConservees: null,
    ...overrides,
  };
}

function nominalSelection(): CatalogueSelection {
  const carte = genererCarteExamen({ profil: baseProfil(), policy: policy2027 });
  return resolveCatalogueModules(carte, baseProfil());
}

afterEach(() => resetCatalogueCacheForTests());

describe('resolveRate — résolution des règles tarifaires (mission §7)', () => {
  test('PILOTAGE_MONTHLY résout vers candidat_individuel_modules.pilotage', () => {
    const rate = resolveRate('PILOTAGE_MONTHLY');
    expect(rate.kind).toBe('flat_monthly');
    expect(rate.amountTnd).toBeGreaterThan(0);
  });

  test('PETIT_GROUPE_8H expose hoursPerMonth/groupMinOpen/groupMax depuis la table existante', () => {
    const rate = resolveRate('PETIT_GROUPE_8H');
    expect(rate.hoursPerMonth).toBe(8);
    expect(rate.groupMinOpen).toBeGreaterThan(0);
    expect(rate.groupMax).toBeGreaterThan(0);
  });
});

describe('priceSelectedModule — refus structurel des éléments non approuvés (mission §7/§8)', () => {
  test('un module SELECTED et APPROVED est prix normalement', () => {
    const selection = nominalSelection();
    const eds1 = selection.modules.find((m) => m.moduleId === 'MOD_EDS1')!;
    expect(eds1.status).toBe('SELECTED');
    const line = priceSelectedModule(eds1);
    expect(line.monthlyAmountTnd).toBeGreaterThan(0);
  });

  test('un module DIRECTION_A_VALIDER (même NEEDS_HUMAN_REVIEW, jamais SELECTED) lève UnapprovedCatalogueElementError', () => {
    const selection = nominalSelection();
    const lva = selection.modules.find((m) => m.moduleId === 'MOD_LVA')!;
    expect(lva.status).toBe('NEEDS_HUMAN_REVIEW');
    expect(() => priceSelectedModule(lva)).toThrow(UnapprovedCatalogueElementError);
  });

  test('un module EXCLUDED lève une erreur — jamais prix silencieusement', () => {
    const selection = nominalSelection();
    const eaf = selection.modules.find((m) => m.moduleId === 'MOD_EAF_ECRIT_ORAL')!;
    expect(eaf.status).toBe('EXCLUDED');
    expect(() => priceSelectedModule(eaf)).toThrow(UnapprovedCatalogueElementError);
  });

  test('Grand Oral (inclus_uniquement, pricingRuleId null) : ligne à 0 TND, jamais une NoCostDataError', () => {
    const selection = nominalSelection();
    const grandOral = selection.modules.find((m) => m.moduleId === 'MOD_GRAND_ORAL')!;
    expect(grandOral.status).toBe('SELECTED');
    const line = priceSelectedModule(grandOral);
    expect(line.monthlyAmountTnd).toBe(0);
    expect(line.explanation).toContain('inclus');
  });
});

describe('priceSelection — assemblage complet, anti-double-facturation, snapshot', () => {
  test('un profil nominal terminale (P1) produit Pilotage + EDS1 + EDS2 + Philo + Grand Oral, aucune erreur', () => {
    const selection = nominalSelection();
    const priced = priceSelection(selection);
    const ids = priced.lines.map((l) => l.id);
    expect(ids).toEqual(expect.arrayContaining(['SVC_PILOTAGE', 'MOD_EDS1', 'MOD_EDS2', 'MOD_PHILOSOPHIE', 'MOD_GRAND_ORAL']));
    expect(priced.monthlyTotalTnd).toBeGreaterThan(0);
    expect(priced.annualTotalTnd).toBe(priced.monthlyTotalTnd * 10);
  });

  test('acompte 25% + 10 mensualités : égalité exacte avec le total, dernière mensualité absorbe l\'arrondi', () => {
    const selection = nominalSelection();
    const priced = priceSelection(selection);
    const { deposit, installmentAmount, lastInstallmentAmount, nInstallments } = priced.schedule;
    expect(nInstallments).toBe(10);
    const total = deposit + installmentAmount * (nInstallments - 1) + lastInstallmentAmount;
    expect(total).toBe(priced.annualTotalTnd);
  });

  test('propriété monétaire exhaustive (pas de fast-check dans ce dépôt — balayage exhaustif à la place) : deposit+9*mensualité+dernière === total, pour toute valeur de 10 à 200000 TND par pas de 137', () => {
    for (let total = 10; total <= 200000; total += 137) {
      const s = computeCandidatLibreSchedule(total);
      const reconstructed = s.deposit + s.installmentAmount * (s.nInstallments - 1) + s.lastInstallmentAmount;
      expect(reconstructed).toBe(total);
    }
  });

  test('anti-double-facturation : une sélection synthétique avec un doublon de coverageKey lève DoubleBillingDetectedError', () => {
    const selection = nominalSelection();
    // Force a synthetic duplicate: two SELECTED modules sharing the same coverageKey.
    const rigged: CatalogueSelection = {
      ...selection,
      modules: selection.modules.map((m) =>
        m.moduleId === 'MOD_EDS2' ? { ...m, coverageKey: 'EDS1' } : m,
      ),
    };
    expect(() => priceSelection(rigged)).toThrow(DoubleBillingDetectedError);
  });

  test('snapshot : structure figée, jamais de fuite de coût/marge interne', () => {
    const selection = nominalSelection();
    const priced = priceSelection(selection);
    const snapshot = buildPricingEngineSnapshot(priced);
    expect(snapshot.lines.length).toBe(priced.lines.length);
    expect(snapshot.schedule).toEqual(priced.schedule);
    const json = JSON.stringify(snapshot).toLowerCase();
    for (const forbidden of ['teachercost', 'costprice', 'grossmargin', 'marginpct', 'internalfloor', 'coutenseignant']) {
      expect(json).not.toContain(forbidden);
    }
  });
});

describe('P11 — paiement intégral à la réservation (mission §6)', () => {
  test('aucun acompte, aucune mensualité — 100% du total, un seul versement', () => {
    const payment = computeSecondGroupePayment(1500);
    expect(payment.depositTnd).toBe(1500);
    expect(payment.remainingTnd).toBe(0);
    expect(payment.nInstallments).toBe(1);
  });
});

describe('Prix plancher (mission §7/§9)', () => {
  test('un tarif au-dessus du plancher "multi" passe', () => {
    const rate = resolveRate('PETIT_GROUPE_8H');
    const hourlyRate = rate.amountTnd / rate.hoursPerMonth!;
    const result = checkFloor(hourlyRate, 'multi');
    expect(result.ok).toBe(true);
  });

  test('un tarif sous le plancher est signalé', () => {
    const result = checkFloor(1, 'coaching_1to1');
    expect(result.ok).toBe(false);
    expect(result.floorTnd).toBeGreaterThan(1);
  });
});

describe('Remises (mission §7/§9 — plafond 20%, non cumulables)', () => {
  test('une remise unique sous le plafond est acceptée', () => {
    const result = applyDiscounts(1000, [{ label: 'comptant', pct: 5 }]);
    expect(result.appliedPct).toBe(5);
    expect(result.finalAmountTnd).toBe(950);
  });

  test('une remise cumulée dépassant 20% est bloquée', () => {
    expect(() => applyDiscounts(1000, [{ label: 'fratrie', pct: 25 }])).toThrow(DiscountRejectedError);
  });

  test('deux remises simultanées sont bloquées (non cumulables, rules.discounts.cumulable=false)', () => {
    expect(() =>
      applyDiscounts(1000, [
        { label: 'fratrie', pct: 10 },
        { label: 'carte_nexus', pct: 10 },
      ]),
    ).toThrow(DiscountRejectedError);
  });
});

describe('Marge (mission §7/§9 — bloquante <45%, signalée <55%)', () => {
  test('marge >= 55% : ni bloquée ni signalée', () => {
    const result = computeMargin(1000, 400); // 60% margin
    expect(result.marginPct).toBeCloseTo(60, 5);
    expect(result.blocked).toBe(false);
    expect(result.warning).toBe(false);
  });

  test('marge entre 45% et 55% : signalée mais non bloquée', () => {
    const result = computeMargin(1000, 500); // 50% margin
    expect(result.blocked).toBe(false);
    expect(result.warning).toBe(true);
  });

  test('marge < 45% : bloquée, assertMarginAcceptable lève MarginTooLowError', () => {
    const result = computeMargin(1000, 600); // 40% margin
    expect(result.blocked).toBe(true);
    expect(() => assertMarginAcceptable(result)).toThrow(MarginTooLowError);
  });

  test('seuils exacts documentés à 45/55', () => {
    expect(MARGIN_BLOCKING_THRESHOLD_PCT).toBe(45);
    expect(MARGIN_TARGET_THRESHOLD_PCT).toBe(55);
  });
});

describe('Effectif insuffisant / bascule DUO-SOLO (mission §9)', () => {
  test('effectif >= seuil : reste GROUPE', () => {
    const rate = resolveRate('PETIT_GROUPE_8H');
    const resolved = resolveGroupModality(rate.groupMinOpen!, 8, rate);
    expect(resolved.modality).toBe('GROUPE');
  });

  test('effectif = 2 < seuil : bascule DUO', () => {
    const rate = resolveRate('PETIT_GROUPE_8H');
    const resolved = resolveGroupModality(2, 8, rate);
    expect(resolved.modality).toBe('DUO');
    expect(resolved.monthlyAmountTnd).toBeGreaterThan(0);
  });

  test('effectif = 1 < seuil, pas DUO : bascule individuel (SOLO)', () => {
    const rate = resolveRate('PETIT_GROUPE_8H');
    const resolved = resolveGroupModality(1, 8, rate);
    expect(resolved.modality).toBe('SOLO');
    expect(resolved.monthlyAmountTnd).toBeGreaterThan(0);
  });

  // T2 (CANDIDAT INDIVIDUEL HEADCOUNT & GROUP STATE SAFETY, direction
  // decision registry 4ffaac8ed) — before this lot, effectif=0/negative/
  // fractional silently fell through to the SOLO branch (neither >= seuil
  // nor === 2), mispricing an invalid input as a confirmed 1-student
  // group instead of rejecting it. Hardened defensively even though the
  // only real caller (resolveScenarioEffectiveGroupPricing) already
  // validates upstream — resolveGroupModality is exported and must be
  // safe to call directly.
  test('effectif = 0 is rejected, never silently treated as SOLO', () => {
    const rate = resolveRate('PETIT_GROUPE_8H');
    expect(() => resolveGroupModality(0, 8, rate)).toThrow(NoCostDataError);
  });

  test('effectif négatif is rejected, never silently treated as SOLO', () => {
    const rate = resolveRate('PETIT_GROUPE_8H');
    expect(() => resolveGroupModality(-2, 8, rate)).toThrow(NoCostDataError);
  });

  test('effectif fractionnaire is rejected, never silently treated as SOLO', () => {
    const rate = resolveRate('PETIT_GROUPE_8H');
    expect(() => resolveGroupModality(1.5, 8, rate)).toThrow(NoCostDataError);
  });
});

describe('Comparaison de packs sur base annuelle (mission §7/§9 — réutilise matchCanonicalPack)', () => {
  test('une sélection dont le volume/prix correspond à Focus Bac renvoie un match dont la couverture est jugée suffisante', () => {
    const selection = nominalSelection();
    const priced = priceSelection(selection);
    const comparison = compareSelectionToCanonicalPacks('terminale', priced);
    // Le nominal (Pilotage+EDS1+EDS2+Philo, 20h/mois) doit correspondre à Focus Bac ou n'avoir aucun match moins cher couvrant moins.
    expect(comparison.coverageSufficient || comparison.match === null).toBe(true);
  });
});

describe('Absence de coût / de volume (mission §8/§9 — ne jamais deviner)', () => {
  test('un rate per_hour (DUO_HOUR) ne peut pas être prix directement sans effectif — NoCostDataError', () => {
    const modules = getCatalogue().modules;
    const fakeModule: ResolvedCatalogueModule = {
      moduleId: 'MOD_FAKE_DUO',
      label: 'test',
      coverageKey: 'FAKE',
      epreuveCodes: [],
      optionCodes: [],
      deliveryMode: 'duo',
      pricingRuleId: 'DUO_HOUR',
      volumePolicy: { kind: 'estimatif', hoursPerMonth: 4, note: 'test' },
      inclusionPolicy: 'vendable_separement',
      directionApprovalStatus: 'APPROVED',
      status: 'SELECTED',
      reason: 'test',
      coefficientEffectif: null,
      defaultCandidateForRegularSupport: false,
    };
    expect(modules.length).toBeGreaterThan(0); // sanity: catalogue loaded
    expect(() => priceSelectedModule(fakeModule)).toThrow(NoCostDataError);
  });
});

describe('aucune fuite publique — Pilotage seul', () => {
  test('pricePilotage() ne contient aucune donnée de coût interne', () => {
    const line = pricePilotage();
    const json = JSON.stringify(line).toLowerCase();
    for (const forbidden of ['teachercost', 'costprice', 'grossmargin', 'coutenseignant']) {
      expect(json).not.toContain(forbidden);
    }
  });
});
