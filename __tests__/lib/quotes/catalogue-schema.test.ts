import { getSupportedSessions, requireExamPolicy } from '@/lib/exams/catalog';
import { getCandidatIndividuelModules } from '@/lib/pricing';
import { getCatalogue, resetCatalogueCacheForTests } from '@/lib/quotes/catalogue';
import type { PricingRuleId } from '@/lib/quotes/catalogue-schema';

describe('candidat_individuel_catalogue — validation structurelle (mission Lot 5 §13)', () => {
  afterEach(() => resetCatalogueCacheForTests());

  test('le JSON canonique passe la validation Zod (identifiants uniques, coverageKeys uniques, modalités déclarées)', () => {
    expect(() => getCatalogue()).not.toThrow();
  });

  test('aucune référence orpheline : chaque epreuveCode existe dans au moins une session du référentiel lib/exams/', () => {
    const catalogue = getCatalogue();
    const allEpreuveIds = new Set<string>();
    for (const session of getSupportedSessions()) {
      for (const e of requireExamPolicy(session).epreuves) allEpreuveIds.add(e.id);
    }
    const orphans: string[] = [];
    for (const m of catalogue.modules) {
      for (const code of m.epreuveCodes) {
        if (!allEpreuveIds.has(code)) orphans.push(`${m.moduleId} -> ${code}`);
      }
    }
    expect(orphans).toEqual([]);
  });

  test('aucune référence orpheline : chaque pricingRuleId non nul résout dans candidat_individuel_modules', () => {
    const catalogue = getCatalogue();
    const modules = getCandidatIndividuelModules();
    const hoursAvailable = new Set(modules.petit_groupe.map((p) => p.hours_per_month));

    function resolves(id: PricingRuleId): boolean {
      switch (id) {
        case 'PILOTAGE_MONTHLY':
          return modules.pilotage.price_monthly > 0;
        case 'PETIT_GROUPE_4H':
          return hoursAvailable.has(4);
        case 'PETIT_GROUPE_8H':
          return hoursAvailable.has(8);
        case 'PETIT_GROUPE_12H':
          return hoursAvailable.has(12);
        case 'DUO_HOUR':
          return modules.duo.price_per_hour_per_student > 0;
        case 'INDIVIDUEL_HOUR_MIN':
          return modules.individuel.price_per_hour_min > 0;
      }
    }

    const orphans: string[] = [];
    for (const s of catalogue.services) {
      if (s.pricingRuleId && !resolves(s.pricingRuleId)) orphans.push(`${s.serviceId} -> ${s.pricingRuleId}`);
    }
    for (const m of catalogue.modules) {
      if (m.pricingRuleId && !resolves(m.pricingRuleId)) orphans.push(`${m.moduleId} -> ${m.pricingRuleId}`);
    }
    expect(orphans).toEqual([]);
  });

  test('aucun module APPROVED sans règle tarifaire, sauf inclusionPolicy=inclus_uniquement (bundled, jamais facturé seul)', () => {
    const catalogue = getCatalogue();
    const offenders = catalogue.modules.filter(
      (m) => m.directionApprovalStatus === 'APPROVED' && m.pricingRuleId == null && m.inclusionPolicy !== 'inclus_uniquement',
    );
    expect(offenders).toEqual([]);
  });

  test('aucun module DIRECTION_A_VALIDER ne porte de pricingRuleId (règle de blocage, mission §2)', () => {
    const catalogue = getCatalogue();
    const offenders = catalogue.modules.filter((m) => m.directionApprovalStatus === 'DIRECTION_A_VALIDER' && m.pricingRuleId != null);
    expect(offenders).toEqual([]);
  });

  test('aucun prix dupliqué : deux modules APPROVED ne partagent jamais le même coverageKey (garanti par le schema, revérifié ici)', () => {
    const catalogue = getCatalogue();
    const keys = catalogue.modules.map((m) => m.coverageKey);
    expect(new Set(keys).size).toBe(keys.length);
  });

  test('les services obligatoires du Pilotage (mission §6) sont tous présents comme coverageKeys', () => {
    const catalogue = getCatalogue();
    const pilotage = catalogue.services.find((s) => s.serviceId === 'SVC_PILOTAGE')!;
    expect(pilotage).toBeDefined();
    for (const key of ['DIAGNOSTIC_STRATEGIQUE', 'CARTE_EXAMEN', 'APPUI_CYCLADES', 'SUIVI_ECHEANCES', 'ARIA_ACCESS', 'BILANS_PERIODIQUES']) {
      expect(pilotage.coverageKeys).toContain(key);
    }
  });

  test('décompte exact des éléments DIRECTION_A_VALIDER : 8 modules + 2 services = 10 (T3A activation — MOD_LVA/MOD_LVB/MOD_SPECIALITE_ABANDONNEE approuvés 4h/mois, 11→8) (mission "vers un produit complet" §2 — SVC_TUTORAT_COMPRESSION retiré du catalogue actif, concept jamais défini, voir docs/candidat-individuel/resolution-tutorat-compression.md)', () => {
    const catalogue = getCatalogue();
    const modules = catalogue.modules.filter((m) => m.directionApprovalStatus === 'DIRECTION_A_VALIDER');
    const services = catalogue.services.filter((s) => s.directionApprovalStatus === 'DIRECTION_A_VALIDER');
    expect(modules).toHaveLength(8);
    expect(services).toHaveLength(2);
    expect(modules.length + services.length).toBe(10);
  });

  test('SVC_TUTORAT_COMPRESSION est retiré du catalogue actif — ne peut jamais apparaître dans un devis, ne bloque aucun profil, non sélectionnable', () => {
    const catalogue = getCatalogue();
    expect(catalogue.services.find((s) => s.serviceId === 'SVC_TUTORAT_COMPRESSION')).toBeUndefined();
    expect(catalogue.modules.find((m) => m.moduleId === 'SVC_TUTORAT_COMPRESSION')).toBeUndefined();
  });

  test('Grand Oral reste plafonné à 8h annuelles (4x2h), jamais 14/18/24h', () => {
    const catalogue = getCatalogue();
    const grandOral = catalogue.modules.find((m) => m.moduleId === 'MOD_GRAND_ORAL')!;
    expect(grandOral.volumePolicy).toMatchObject({ kind: 'plafonne', totalHoursMax: 8 });
  });
});
