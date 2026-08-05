import { buildLlmReport, buildLlmReports } from '@/lib/bilans/render/llm-report';
import { buildDeterministicReport } from '@/lib/bilans/render/report';
import { RECIPE_FACT_SHEETS } from './fixtures/recipe-fact-sheets';

const identity = {
  displayName: 'Élève de démonstration',
  level: 'TERMINALE' as const,
  subject: 'MATHS' as const,
  date: '2026-08-03',
  stageLabel: 'Stage de pré-rentrée',
};

function bundleFor(sheet: (typeof RECIPE_FACT_SHEETS)[number]) {
  const domains = sheet.domains.map(({ id }) => id);
  return {
    preAnalysis: { synthese: 'Synthèse narrée par le modèle.', forcesPercues: ['Une démarche engagée'], craintes: [] },
    eleve: {
      accroche: 'Accroche narrée par le modèle.',
      forces: ['Force narrée un.', 'Force narrée deux.', 'Force narrée trois.'],
      priorites: domains.map((domainId) => ({
        domainId, titre: `Titre narré ${domainId}`, pourquoi: 'Pourquoi narré.', comment: 'Comment narré.',
      })),
      microPlan: [{ action: 'Action narrée par le modèle.', dureeMin: 20 }],
      motDeFin: 'Mot de fin narré.',
    },
    parents: {
      cadre: 'Cadre narré par le modèle.',
      pointsAppui: domains.slice(0, 1).map((domainId) => ({ domainId, texte: 'Texte narré.' })),
      priorites: domains.map((domainId) => ({ domainId, titre: `Titre parent ${domainId}`, ceQuiSeraFait: 'Ce qui sera fait, narré.' })),
      etapeSuivante: { texte: 'Étape suivante narrée.', cta: 'Être conseillé' },
    },
    nexus: {
      syntheseProfil: 'Synthèse profil narrée.',
      diagnosticPedagogique: 'Diagnostic pédagogique narré par le modèle.',
      planQuatreSemaines: 'Plan quatre semaines narré par le modèle.',
      alertes: [] as string[],
      ragReferences: [] as string[],
    },
    verifier: { ok: true, violations: [] as string[] },
  };
}

describe('LLM-narrated report adapter', () => {
  it('sources every domain score/profile/internalFacts number straight from the FactSheet, never from the bundle', () => {
    const sheet = RECIPE_FACT_SHEETS[1];
    const bundle = bundleFor(sheet);
    const deterministic = buildDeterministicReport(sheet, 'NEXUS', identity);
    const narrated = buildLlmReport(sheet, 'NEXUS', identity, bundle);

    expect(narrated.content.domains).toEqual(deterministic.content.domains);
    expect(narrated.content.internalFacts).toEqual(deterministic.content.internalFacts);
    expect(narrated.content.learningPath).toEqual(deterministic.content.learningPath);
  });

  it('replaces the ELEVE narrative with the bundle prose, not the template copy', () => {
    const sheet = RECIPE_FACT_SHEETS[0];
    const bundle = bundleFor(sheet);
    const narrated = buildLlmReport(sheet, 'ELEVE', identity, bundle);

    expect(narrated.content.narrative.headline).toBe(bundle.eleve.accroche);
    expect(narrated.content.narrative.conclusion).toBe(bundle.eleve.motDeFin);
    expect(narrated.content.narrative.strengths).toEqual(bundle.eleve.forces);
    expect(narrated.content.narrative.actionPlan).toEqual([bundle.eleve.microPlan[0].action]);
  });

  it('never lets a bundle numeric-looking field leak into content.domains[].score', () => {
    const sheet = RECIPE_FACT_SHEETS[2];
    const tamperedBundle = { ...bundleFor(sheet), nexus: { ...bundleFor(sheet).nexus, syntheseProfil: 'Score: 999' } };
    const narrated = buildLlmReport(sheet, 'NEXUS', identity, tamperedBundle);

    for (const domain of narrated.content.domains) {
      const expected = sheet.domains.find(({ id }) => id === domain.id);
      expect(domain.score).toBe(expected?.score);
    }
    expect(narrated.content.internalFacts?.globalScore).toBe(sheet.globalScore);
  });

  it('builds all three audiences from the same bundle in one call', () => {
    const sheet = RECIPE_FACT_SHEETS[0];
    const bundle = bundleFor(sheet);
    const bundleReports = buildLlmReports(sheet, identity, bundle);

    expect(bundleReports.ELEVE.content.narrative.headline).toBe(bundle.eleve.accroche);
    expect(bundleReports.PARENTS.content.narrative.introduction).toBe(bundle.parents.cadre);
    expect(bundleReports.NEXUS.content.internalFacts?.globalScore).toBe(sheet.globalScore);
  });
});
