import type { FactSheet } from '@/lib/bilans/facts/fact-sheet';
import { renderDeterministicBilanHtml } from '@/lib/bilans/render/html';
import {
  buildLearningPath,
  groupStepsBySession,
  sessionPositionsFor,
} from '@/lib/bilans/render/learning-path';
import { PARENT_GROUP_CONSTRUCTION_COPY, buildDeterministicReport } from '@/lib/bilans/render/report';
import type { RenderIdentity } from '@/lib/bilans/render/render-identity';
import { buildPreRentreeStageLabel } from '@/lib/bilans/render/stage-label';
import {
  STAGE_SESSION_COUNT,
  STAGE_SESSIONS_SENTENCE_FRAGMENT,
  sessionCountWord,
} from '@/lib/bilans/render/stage-constants';
import { ENTRY_RECIPE_FACT_SHEETS } from './fixtures/recipe-fact-sheets';

/**
 * Un seul comptage : le stage fait CINQ séances de deux heures. Le parcours
 * généré, le plan Nexus et la mention rédigée côté parents doivent tous
 * refléter ce même nombre — plus jamais « Séance 7 » face à un « plan sur
 * 4 semaines » annonçant « cinq séances ».
 */

const identity: RenderIdentity = {
  displayName: 'ELEVE_SEANCES',
  level: 'TROISIEME',
  subject: 'MATHS',
  date: '2026-08-12',
  stageLabel: buildPreRentreeStageLabel('TROISIEME', 'MATHS'),
};

function factSheetWithProfiles(profiles: readonly FactSheet['domains'][number]['profile'][]): FactSheet {
  return Object.freeze({
    engineVersion: '1.0.1',
    bankSlug: 'entree-troisieme-maths-v1',
    bankVersion: 1,
    student: Object.freeze({ alias: 'ELEVE_SEANCES', level: 'TROISIEME' }),
    globalScore: 50,
    coverage: 95,
    calibrationIndex: 70,
    domains: Object.freeze(profiles.map((profile, index) => Object.freeze({
      id: ['nombres-relatifs', 'fractions', 'puissances', 'calcul-litteral', 'equations', 'proportionnalite', 'geometrie', 'trigonometrie', 'statistiques'][index],
      score: 20 + index * 5,
      profile,
    }))),
    nodes: Object.freeze([]),
    flags: Object.freeze([]),
    groupBand: 'CONSOLIDATION_STANDARD' as const,
  });
}

describe('Cohérence du comptage des séances', () => {
  it('la constante et sa forme rédigée coïncident', () => {
    expect(STAGE_SESSION_COUNT).toBe(5);
    expect(sessionCountWord(STAGE_SESSION_COUNT)).toBe('cinq');
    expect(STAGE_SESSIONS_SENTENCE_FRAGMENT).toBe(`${sessionCountWord(STAGE_SESSION_COUNT)} séances de deux heures`);
    expect(PARENT_GROUP_CONSTRUCTION_COPY).toContain(STAGE_SESSIONS_SENTENCE_FRAGMENT);
  });

  it.each([
    [0, []],
    [1, [1]],
    [3, [1, 2, 3]],
    [5, [1, 2, 3, 4, 5]],
    [7, [1, 1, 2, 2, 3, 4, 5]],
    [9, [1, 1, 2, 2, 3, 3, 4, 4, 5]],
  ])('répartit %d priorités sur cinq séances au plus', (count, expected) => {
    expect([...sessionPositionsFor(count)]).toEqual(expected);
  });

  it('ne dépasse jamais la séance 5, même avec neuf priorités', () => {
    const factSheet = factSheetWithProfiles([
      'ERREUR_CONFIANTE', 'ERREUR_CONFIANTE', 'LACUNE_CONSCIENTE', 'LACUNE_CONSCIENTE',
      'MAITRISE_FRAGILE', 'MAITRISE_FRAGILE', 'MAITRISE_FRAGILE', 'NON_TRAITE', 'NON_TRAITE',
    ]);
    const path = buildLearningPath(factSheet, identity);
    expect(path.steps).toHaveLength(9);
    const labels = new Set(path.steps.map(({ seanceLabel }) => seanceLabel));
    expect([...labels].sort()).toEqual(['Séance 1', 'Séance 2', 'Séance 3', 'Séance 4', 'Séance 5']);
    expect(path.steps.some(({ seanceLabel }) => seanceLabel === 'Séance 6')).toBe(false);

    const sessions = groupStepsBySession(path.steps);
    expect(sessions).toHaveLength(STAGE_SESSION_COUNT);
    expect(sessions.every(({ steps }) => steps.length >= 1)).toBe(true);
  });

  it('les priorités les plus sévères passent en premier dans les premières séances', () => {
    const factSheet = factSheetWithProfiles([
      'MAITRISE_FRAGILE', 'ERREUR_CONFIANTE', 'MAITRISE', 'LACUNE_CONSCIENTE', 'NON_TRAITE',
    ]);
    const path = buildLearningPath(factSheet, identity);
    expect(path.steps[0].profil).toBe('ERREUR_CONFIANTE');
    expect(path.steps[0].seanceLabel).toBe('Séance 1');
    expect(path.steps.map(({ phaseDidactique }) => phaseDidactique)).toEqual([
      'Confronter', 'Installer', 'Consolider', 'Diagnostiquer',
    ]);
  });

  it('le document Nexus planifie cinq séances, plus aucune « semaine »', () => {
    const html = renderDeterministicBilanHtml(ENTRY_RECIPE_FACT_SHEETS[0], 'NEXUS', {
      ...identity,
      level: 'PREMIERE',
      stageLabel: buildPreRentreeStageLabel('PREMIERE', 'MATHS'),
    });
    expect(html).toContain('Plan des cinq séances');
    expect(html).toContain('Séance 5');
    expect(html).not.toContain('Séance 6');
    expect(html).not.toContain('Semaine');
  });

  it('le parcours élève affiche exactement cinq séances, complétées si besoin', () => {
    const factSheet = factSheetWithProfiles(['ERREUR_CONFIANTE', 'MAITRISE', 'MAITRISE', 'MAITRISE', 'MAITRISE']);
    const html = renderDeterministicBilanHtml(factSheet, 'ELEVE', identity);
    for (let session = 1; session <= STAGE_SESSION_COUNT; session += 1) {
      expect(html).toContain(`Séance ${session}`);
    }
    expect(html).toContain('Consolidation d’ensemble');
  });

  it('le plan d’action élève ne répète pas les phrases du parcours', () => {
    const factSheet = factSheetWithProfiles(['ERREUR_CONFIANTE', 'LACUNE_CONSCIENTE', 'MAITRISE_FRAGILE', 'MAITRISE', 'MAITRISE']);
    const report = buildDeterministicReport(factSheet, 'ELEVE', identity);
    const pathSentences = report.content.learningPath.steps
      .flatMap((step) => 'objectif' in step ? [step.objectif, step.demarche] : []);
    for (const action of report.content.narrative.actionPlan) {
      expect(pathSentences).not.toContain(action);
    }
  });

  it('le plan parents est concret et se termine par le cadre collectif', () => {
    const factSheet = factSheetWithProfiles(['ERREUR_CONFIANTE', 'LACUNE_CONSCIENTE', 'MAITRISE_FRAGILE', 'NON_TRAITE', 'MAITRISE']);
    const report = buildDeterministicReport(factSheet, 'PARENTS', identity);
    const plan = report.content.narrative.actionPlan;
    expect(plan.length).toBeGreaterThanOrEqual(4);
    expect(plan[0]).toContain('rectifier');
    expect(plan[plan.length - 1]).toBe(PARENT_GROUP_CONSTRUCTION_COPY);
    // Le plan parents reste vide de tout détail de séance individualisée.
    expect(report.content.learningPath.steps).toHaveLength(0);
  });

  it('la section Forces des parents n’est jamais vide', () => {
    const noStrength = factSheetWithProfiles(['ERREUR_CONFIANTE', 'LACUNE_CONSCIENTE', 'MAITRISE_FRAGILE', 'NON_TRAITE', 'ERREUR_CONFIANTE']);
    const report = buildDeterministicReport(noStrength, 'PARENTS', identity);
    expect(report.content.narrative.strengths.length).toBeGreaterThanOrEqual(1);
    expect(report.content.narrative.strengths[0]).toContain('point d’appui le plus proche');

    const noSupportAtAll = factSheetWithProfiles(['ERREUR_CONFIANTE', 'ERREUR_CONFIANTE', 'NON_TRAITE', 'NON_TRAITE', 'ERREUR_CONFIANTE']);
    const fallback = buildDeterministicReport(noSupportAtAll, 'PARENTS', identity);
    expect(fallback.content.narrative.strengths[0]).toContain('photographie de départ');
  });
});
