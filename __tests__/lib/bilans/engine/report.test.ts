import type { AssessmentDefinition } from '@/lib/pre-rentree/pedagogy';
import {
  AssessmentEngineError,
  buildDeterministicReport,
  computeCanonicalScore,
} from '@/lib/bilans/engine';

const definition: AssessmentDefinition = {
  id: 'fixture-report',
  moduleId: 'fixture-module',
  level: 'TERMINALE',
  subject: 'MATHEMATIQUES',
  edition: 1,
  targetDurationMinutes: 10,
  title: 'Fixture bilan',
  framing: 'Interne.',
  publicationStatus: 'PUBLICATION_APPROVED',
  ref: {
    definitionId: 'fixture-report',
    moduleId: 'fixture-module',
    version: 'fixture-v1',
    sha256: `sha256:${'b'.repeat(64)}`,
  },
  nodes: [{
    id: 'node-1',
    order: 1,
    evaluated: true,
    priorKnowledge: 'Interne.',
    targetUse: 'Résoudre un problème.',
    obstacles: ['Obstacle secret.'],
    masteryCriterion: 'Critère secret.',
    sessionNumber: 1,
    itemIds: ['manual'],
  }],
  items: [{
    id: 'manual',
    nodeId: 'node-1',
    tier: 'A',
    prompt: 'Expliquer.',
    rationale: 'Corrigé secret.',
    responseMode: 'MANUAL_SHORT_RESPONSE',
    maxCharacters: 300,
    gradingCriteria: ['Barème secret.'],
    admissibleAnswerExample: 'Réponse attendue secrète.',
  }],
};

const score = computeCanonicalScore({
  definition,
  responses: [{
    itemId: 'manual',
    responseType: 'MANUAL_SHORT_RESPONSE',
    selectedOptionIndex: null,
    textValue: 'Réponse élève privée.',
  }],
  manualDecisions: [{
    itemId: 'manual',
    awardedPoints: 0.5,
    maxPoints: 1,
    decisionVersion: 1,
    internalComment: 'Commentaire interne secret.',
    publishableComment: 'La justification est à approfondir.',
  }],
  resultKind: 'FINAL',
  provisionalResultsEnabled: false,
});

describe('deterministic audience-scoped report', () => {
  it('generates stable parent content without answers, answer keys or internal comments', () => {
    const first = buildDeterministicReport({ audience: 'PARENT', definition, score });
    const second = buildDeterministicReport({ audience: 'PARENT', definition, score });
    const serialized = JSON.stringify(first);

    expect(first).toEqual(second);
    expect(first.status).toBe('FINAL');
    expect(first.templateVersion).toBe('canonical-bilan-template-v1');
    expect(first.contextChecksum).toMatch(/^sha256:[a-f0-9]{64}$/);
    expect(serialized).toContain('La justification est à approfondir.');
    expect(serialized).not.toContain('Réponse élève privée');
    expect(serialized).not.toContain('Commentaire interne secret');
    expect(serialized).not.toContain('Corrigé secret');
    expect(serialized).not.toContain('Réponse attendue secrète');
    expect(serialized).not.toContain('Barème secret');
  });

  it('keeps internal comments only in the Nexus audience', () => {
    const internal = buildDeterministicReport({ audience: 'NEXUS', definition, score });
    const student = buildDeterministicReport({ audience: 'STUDENT', definition, score });

    expect(JSON.stringify(internal)).toContain('Commentaire interne secret');
    expect(JSON.stringify(student)).not.toContain('Commentaire interne secret');
    expect(JSON.stringify(student)).not.toContain('La justification est à approfondir.');
  });

  it('refuses final report generation from a provisional score', () => {
    const provisional = {
      ...score,
      resultKind: 'PROVISIONAL' as const,
    };
    expect(() => buildDeterministicReport({
      audience: 'PARENT',
      definition,
      score: provisional,
    })).toThrow(new AssessmentEngineError('FINAL_SCORE_REQUIRED'));
  });
});
