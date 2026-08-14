import type { CpsCatalog } from '@/lib/bilans/catalog/bank-validation';
import type { FactSheet } from '@/lib/bilans/facts/fact-sheet';
import type { NodeProfile } from '@/lib/bilans/facts/types';
import type { QuestionEvidence } from '@/lib/bilans/render/question-evidence';
import {
  buildDossierGroupAnalysis,
  buildDossierSessionPlan,
  type DossierMember,
} from '@/lib/bilans/teacher-dossier/aggregate';

const DOMAINS = ['second-degre', 'derivation', 'suites', 'probabilites'] as const;

function factSheet(
  alias: string,
  domainProfiles: readonly NodeProfile[],
  overrides: Partial<Pick<FactSheet, 'globalScore' | 'coverage' | 'calibrationIndex'>> = {},
): FactSheet {
  return Object.freeze({
    engineVersion: '1.1.0',
    bankSlug: 'entree-terminale-maths-v1',
    bankVersion: 1,
    student: Object.freeze({ alias, level: 'TERMINALE' }),
    globalScore: overrides.globalScore ?? 50,
    coverage: overrides.coverage ?? 100,
    calibrationIndex: overrides.calibrationIndex === undefined ? 70 : overrides.calibrationIndex,
    domains: Object.freeze(DOMAINS.map((id, index) => Object.freeze({ id, score: 50, profile: domainProfiles[index] }))),
    flags: Object.freeze([]),
    groupBand: 'RENFORCEMENT',
    nodes: Object.freeze([]),
  });
}

function evidence(alias: string, chosen: Readonly<Record<string, string | null>>): QuestionEvidence {
  return Object.freeze({
    version: 'question-evidence.v1',
    packSlug: 'entree-terminale-maths-v1',
    packVersion: 1,
    confidenceLabels: Object.freeze(['je devine', 'peu sûr', 'plutôt sûr', 'certain']) as readonly [string, string, string, string],
    items: Object.freeze([
      Object.freeze({
        itemId: 'ITEM-1', domainId: 'second-degre', category: 'Discriminant', questionText: 'Résoudre x²-3x+2=0',
        options: Object.freeze([
          Object.freeze({ id: 'A', text: '1 et 2', isCorrect: true, distractorRationale: null }),
          Object.freeze({ id: 'B', text: '-1 et -2', isCorrect: false, distractorRationale: 'Signe oublié' }),
          Object.freeze({ id: 'C', text: '0 et 3', isCorrect: false, distractorRationale: 'Erreur de factorisation' }),
        ]),
        shortCorrection: 'Discriminant positif, deux racines.', chosenOptionId: chosen[alias] ?? null, confidence: 3,
      }),
    ]),
  });
}

describe('buildDossierGroupAnalysis', () => {
  const members: readonly DossierMember[] = Object.freeze([
    { displayName: 'Yasmine', factSheet: factSheet('ELEVE_A', ['ERREUR_CONFIANTE', 'MAITRISE', 'MAITRISE', 'NON_TRAITE'], { globalScore: 40, calibrationIndex: 50 }), evidence: evidence('ELEVE_A', { ELEVE_A: 'B' }) },
    { displayName: 'Karim', factSheet: factSheet('ELEVE_B', ['ERREUR_CONFIANTE', 'MAITRISE_FRAGILE', 'MAITRISE', 'LACUNE_CONSCIENTE'], { globalScore: 45, calibrationIndex: 60 }), evidence: evidence('ELEVE_B', { ELEVE_B: 'B' }) },
    { displayName: 'Nour', factSheet: factSheet('ELEVE_C', ['LACUNE_CONSCIENTE', 'MAITRISE', 'MAITRISE', 'MAITRISE'], { globalScore: 90, calibrationIndex: 85 }), evidence: evidence('ELEVE_C', { ELEVE_C: 'A' }) },
  ]);

  it('counts the group profile distribution across every student × domain cell', () => {
    const analysis = buildDossierGroupAnalysis(members);
    expect(analysis.profileDistribution).toEqual({
      MAITRISE: 6, MAITRISE_FRAGILE: 1, LACUNE_CONSCIENTE: 2, ERREUR_CONFIANTE: 2, NON_TRAITE: 1,
    });
  });

  it('ranks the most fragile domains first, using the same weight as session-minute allocation', () => {
    const analysis = buildDossierGroupAnalysis(members);
    expect(analysis.domains[0].domainId).toBe('second-degre');
    expect(analysis.domains[0].profile).toBe('ERREUR_CONFIANTE');
    expect(analysis.domains.map((domain) => domain.domainId)).toEqual(
      [...analysis.domains].sort((left, right) => right.severityWeight - left.severityWeight).map((domain) => domain.domainId),
    );
  });

  it('flags a distractor chosen by at least half the group as a collective error', () => {
    const analysis = buildDossierGroupAnalysis(members);
    const item = analysis.items.find((entry) => entry.itemId === 'ITEM-1');
    expect(item?.distractorCounts.B).toBe(2);
    expect(item?.majorityDistractorOptionId).toBe('B');
    expect(item?.collectiveError).toBe(true);
  });

  it('computes calibration mean/stddev over members with a non-null index', () => {
    const analysis = buildDossierGroupAnalysis(members);
    expect(analysis.calibration.sampleSize).toBe(3);
    expect(analysis.calibration.mean).toBeCloseTo(65, 5);
    expect(analysis.calibration.stddev).toBeGreaterThan(0);
  });

  it('excludes members with a null calibration index from both calibration stats', () => {
    const withNull = [...members, { displayName: 'Ali', factSheet: factSheet('ELEVE_D', ['MAITRISE', 'MAITRISE', 'MAITRISE', 'MAITRISE'], { calibrationIndex: null }), evidence: evidence('ELEVE_D', {}) }];
    const analysis = buildDossierGroupAnalysis(withNull);
    expect(analysis.calibration.sampleSize).toBe(3);
  });

  it('classifies heterogeneity from the spread of global scores', () => {
    const analysis = buildDossierGroupAnalysis(members);
    expect(analysis.heterogeneity.scoreStddev).toBeGreaterThan(0);
    expect(['HOMOGENE', 'A_DIFFERENCIER']).toContain(analysis.heterogeneity.classification);
  });

  it('lists domains acquired by every member', () => {
    const analysis = buildDossierGroupAnalysis(members);
    expect(analysis.acquiredByAll).toEqual(['derivation', 'suites']);
  });

  it('flags atypical students by profile pattern, each with a stated reason', () => {
    const atypicalMembers: readonly DossierMember[] = Object.freeze([
      { displayName: 'Sami', factSheet: factSheet('ELEVE_E', ['MAITRISE', 'MAITRISE', 'MAITRISE', 'MAITRISE'], { coverage: 100 }), evidence: evidence('ELEVE_E', {}) },
      { displayName: 'Yassine', factSheet: factSheet('ELEVE_F', ['ERREUR_CONFIANTE', 'ERREUR_CONFIANTE', 'LACUNE_CONSCIENTE', 'MAITRISE'], { coverage: 100 }), evidence: evidence('ELEVE_F', {}) },
      { displayName: 'Wissal', factSheet: factSheet('ELEVE_G', ['NON_TRAITE', 'NON_TRAITE', 'NON_TRAITE', 'MAITRISE'], { coverage: 40 }), evidence: evidence('ELEVE_G', {}) },
      { displayName: 'Nadia', factSheet: factSheet('ELEVE_H', ['MAITRISE_FRAGILE', 'MAITRISE', 'LACUNE_CONSCIENTE', 'MAITRISE'], { coverage: 100 }), evidence: evidence('ELEVE_H', {}) },
    ]);
    const analysis = buildDossierGroupAnalysis(atypicalMembers);
    const byName = new Map(analysis.atypicalStudents.map((student) => [student.displayName, student.reason]));
    expect(byName.get('Sami')).toBe('TRES_EN_AVANCE');
    expect(byName.get('Yassine')).toBe('TRES_EN_DIFFICULTE');
    expect(byName.get('Wissal')).toBe('BEAUCOUP_NON_TRAITE');
    expect(byName.has('Nadia')).toBe(false);
  });

  it('clusters students who share the same profile on the most fragile domain', () => {
    const analysis = buildDossierGroupAnalysis(members);
    const cluster = analysis.clusters.find((entry) => entry.domainId === 'second-degre' && entry.profile === 'ERREUR_CONFIANTE');
    expect(cluster?.students).toEqual(['Yasmine', 'Karim']);
  });

  it('rejects an empty group', () => {
    expect(() => buildDossierGroupAnalysis([])).toThrow('DOSSIER_GROUP_MUST_HAVE_AT_LEAST_ONE_MEMBER');
  });
});

describe('buildDossierSessionPlan', () => {
  const catalog: CpsCatalog = {
    schemaVersion: 'nexus-cps-catalog/v1', slug: 'fixture-dossier-cps-v1', version: 1,
    nodes: Array.from({ length: 9 }, (_unused, index) => ({
      id: `1re.maths.fixture.node-${index + 1}`, label: `Nœud ${index + 1}`,
      sourceLevel: 'PREMIERE', targetLevel: 'TERMINALE', sequenceOrder: index + 1,
      pedagogicalRationale: 'Prérequis synthétique pour le test du dossier enseignant.',
    })),
  };

  function nodeFactSheet(alias: string, profiles: readonly NodeProfile[]): FactSheet {
    return Object.freeze({
      engineVersion: '1.1.0', bankSlug: 'entree-terminale-maths-v1', bankVersion: 1,
      student: Object.freeze({ alias, level: 'TERMINALE' }), globalScore: 50, coverage: 100,
      calibrationIndex: 70, domains: Object.freeze([]), flags: Object.freeze([]), groupBand: 'RENFORCEMENT',
      nodes: Object.freeze(catalog.nodes.map((node, index) => Object.freeze({
        nodeCpsId: node.id, criticality: 1, nodeScore: 50, profile: profiles[index],
        itemIds: Object.freeze([`ITEM-${index + 1}`]), priorityRank: index,
      }))),
    });
  }

  it('plans six students (above the coach 3-5 group-plan cap) without throwing', () => {
    const profiles: NodeProfile[] = ['ERREUR_CONFIANTE', 'MAITRISE', 'MAITRISE_FRAGILE', 'LACUNE_CONSCIENTE', 'MAITRISE', 'NON_TRAITE', 'MAITRISE', 'MAITRISE_FRAGILE', 'MAITRISE'];
    const members = Array.from({ length: 6 }, (_unused, index) => ({
      displayName: `Élève ${index + 1}`,
      factSheet: nodeFactSheet(`ELEVE_${String.fromCharCode(65 + index)}`, profiles),
    }));
    const plan = buildDossierSessionPlan(catalog, members);
    expect(plan.nodes.reduce((sum, node) => sum + node.minutes, 0)).toBe(600);
    expect(plan.sessions).toHaveLength(5);
    expect(plan.nodes[0].profileCounts.ERREUR_CONFIANTE).toBe(6);
  });

  it('rejects members split across different packs', () => {
    const a = { displayName: 'A', factSheet: nodeFactSheet('ELEVE_A', Array(9).fill('MAITRISE') as NodeProfile[]) };
    const b = { displayName: 'B', factSheet: { ...nodeFactSheet('ELEVE_B', Array(9).fill('MAITRISE') as NodeProfile[]), bankSlug: 'other-pack-v1' } };
    expect(() => buildDossierSessionPlan(catalog, [a, b])).toThrow('GROUP_MEMBERS_MUST_SHARE_PACK');
  });
});
