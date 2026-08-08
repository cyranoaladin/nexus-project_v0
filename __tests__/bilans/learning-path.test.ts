import type { FactSheet } from '@/lib/bilans/facts/fact-sheet';
import { buildLearningPath } from '@/lib/bilans/render/learning-path';
import { buildDeterministicReport } from '@/lib/bilans/render/report';
import type { RenderIdentity } from '@/lib/bilans/render/render-identity';

const factSheet: FactSheet = Object.freeze({
  engineVersion: '1.0.1',
  bankSlug: 'fixture-a90-v1',
  bankVersion: 1,
  student: Object.freeze({ alias: 'ELEVE_A', level: 'TERMINALE' }),
  globalScore: 48,
  coverage: 92,
  calibrationIndex: 61,
  domains: Object.freeze([
    Object.freeze({ id: 'non-traite', score: 0, profile: 'NON_TRAITE' as const }),
    Object.freeze({ id: 'solide', score: 91, profile: 'MAITRISE' as const }),
    Object.freeze({ id: 'fragile', score: 58, profile: 'MAITRISE_FRAGILE' as const }),
    Object.freeze({ id: 'lacune', score: 31, profile: 'LACUNE_CONSCIENTE' as const }),
    Object.freeze({ id: 'erreur', score: 18, profile: 'ERREUR_CONFIANTE' as const }),
  ]),
  nodes: Object.freeze([]),
  flags: Object.freeze([]),
  groupBand: 'CONSOLIDATION_STANDARD',
});

const identity: RenderIdentity = Object.freeze({
  displayName: 'ELEVE_DEMONSTRATION',
  level: 'TERMINALE',
  subject: 'MATHS',
  date: '2026-08-03',
  stageLabel: 'Stage de pré-rentrée',
});

describe('A90.1ter deterministic LearningPath', () => {
  it('is byte-deterministic and follows the strict profile order', () => {
    const first = buildLearningPath(factSheet, identity);
    const second = buildLearningPath(factSheet, identity);

    expect(JSON.stringify(first)).toBe(JSON.stringify(second));
    expect(first.steps.map(({ domainId }) => domainId)).toEqual([
      'erreur',
      'lacune',
      'fragile',
      'non-traite',
    ]);
    expect(first.steps.map(({ seanceLabel }) => seanceLabel)).toEqual([
      'Séance 1',
      'Séance 2',
      'Séance 3',
      'Séance 4',
    ]);
    expect(new Set(first.steps.map(({ objectif }) => objectif)).size).toBe(first.steps.length);
  });

  it('derives exactly one didactic phase from each profile', () => {
    const steps = buildLearningPath(factSheet, identity).steps;
    expect(steps.map(({ profil, phaseDidactique }) => [profil, phaseDidactique])).toEqual([
      ['ERREUR_CONFIANTE', 'Confronter'],
      ['LACUNE_CONSCIENTE', 'Installer'],
      ['MAITRISE_FRAGILE', 'Consolider'],
      ['NON_TRAITE', 'Diagnostiquer'],
    ]);
    expect(steps[0]?.demarche).toMatch(/conflit cognitif|verbaliser|reconstruire/i);
    expect(steps[0]?.demarche).not.toMatch(/drill/i);
  });

  it('explains how group diagnostics determine the five sessions without announcing modules', () => {
    const report = buildDeterministicReport(factSheet, 'PARENTS', identity);
    const serialized = JSON.stringify(report);

    expect(report.content.learningPath.steps).toHaveLength(0);
    expect(serialized).toContain('cinq séances de deux heures');
    expect(serialized).toContain("Aucun module n'est fixé");
    expect(serialized).not.toContain('Être conseillé');
    expect(serialized).not.toContain('Un échange');
    expect(serialized).not.toMatch(/ERREUR_CONFIANTE|LACUNE_CONSCIENTE|MAITRISE_FRAGILE|NON_TRAITE/);
    expect(serialized).not.toMatch(/globalScore|scoreParDomaine|calibrationIndex|coverage/);
  });
});
