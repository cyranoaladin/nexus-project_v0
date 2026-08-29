import type { AssessmentDefinition } from '@/lib/pre-rentree/pedagogy';
import {
  AssessmentEngineError,
  computeCanonicalScore,
  SCORING_POLICY,
} from '@/lib/bilans/engine';

const definition: AssessmentDefinition = {
  id: 'fixture-assessment',
  moduleId: 'fixture-module',
  level: 'TERMINALE',
  subject: 'MATHEMATIQUES',
  edition: 1,
  targetDurationMinutes: 30,
  title: 'Fixture publiée injectée',
  framing: 'Fixture réservée aux tests.',
  publicationStatus: 'PUBLICATION_APPROVED',
  ref: {
    definitionId: 'fixture-assessment',
    moduleId: 'fixture-module',
    version: 'fixture-v1',
    sha256: `sha256:${'a'.repeat(64)}`,
  },
  nodes: [
    {
      id: 'node-1',
      order: 1,
      evaluated: true,
      priorKnowledge: 'Calculer.',
      targetUse: 'Résoudre.',
      obstacles: ['Confusion.'],
      masteryCriterion: 'Deux réponses correctes.',
      sessionNumber: 1,
      itemIds: ['qcm-correct', 'qcm-unanswered', 'manual'],
    },
  ],
  items: [
    {
      id: 'qcm-correct',
      nodeId: 'node-1',
      tier: 'A',
      prompt: 'Choisir.',
      rationale: 'Rationale interne.',
      responseMode: 'AUTOMATIC_QCM',
      options: [
        { text: 'Non', correct: false },
        { text: 'Oui', correct: true },
      ],
    },
    {
      id: 'qcm-unanswered',
      nodeId: 'node-1',
      tier: 'B',
      prompt: 'Choisir encore.',
      rationale: 'Rationale interne.',
      responseMode: 'AUTOMATIC_QCM',
      options: [
        { text: 'Oui', correct: true },
        { text: 'Non', correct: false },
      ],
    },
    {
      id: 'manual',
      nodeId: 'node-1',
      tier: 'C',
      prompt: 'Justifier.',
      rationale: 'Rationale interne.',
      responseMode: 'MANUAL_SHORT_RESPONSE',
      maxCharacters: 400,
      gradingCriteria: ['Argument valide.'],
    },
  ],
};

const responses = [
  {
    itemId: 'qcm-correct',
    responseType: 'AUTOMATIC_QCM' as const,
    selectedOptionIndex: 1,
    textValue: null,
  },
  {
    itemId: 'manual',
    responseType: 'MANUAL_SHORT_RESPONSE' as const,
    selectedOptionIndex: null,
    textValue: 'Une justification.',
  },
];

describe('canonical raw item scoring', () => {
  it('distinguishes correct, unanswered and pending manual responses', () => {
    const result = computeCanonicalScore({
      definition,
      responses,
      manualDecisions: [],
      resultKind: 'PROVISIONAL',
      provisionalResultsEnabled: true,
    });

    expect(result.policy).toEqual(SCORING_POLICY);
    expect(result.score).toBe(1);
    expect(result.maxScore).toBe(3);
    expect(result.calibrationStatus).toBe('PENDING_POLICY_VALIDATION');
    expect(result.items.map(({ outcome, points }) => ({ outcome, points }))).toEqual([
      { outcome: 'AUTOMATIC_CORRECT', points: 1 },
      { outcome: 'UNANSWERED', points: 0 },
      { outcome: 'PENDING_MANUAL_REVIEW', points: null },
    ]);
  });

  it('refuses every provisional result while its flag is disabled', () => {
    expect(() => computeCanonicalScore({
      definition,
      responses,
      manualDecisions: [],
      resultKind: 'PROVISIONAL',
      provisionalResultsEnabled: false,
    })).toThrow(new AssessmentEngineError('PROVISIONAL_RESULTS_DISABLED'));
  });

  it('refuses a final score until every manual response is reviewed', () => {
    expect(() => computeCanonicalScore({
      definition,
      responses,
      manualDecisions: [],
      resultKind: 'FINAL',
      provisionalResultsEnabled: false,
    })).toThrow(new AssessmentEngineError('MANUAL_REVIEW_REQUIRED'));
  });

  it('produces the same final result and checksum for identical sealed inputs', () => {
    const input = {
      definition,
      responses,
      manualDecisions: [{
        itemId: 'manual',
        awardedPoints: 0.5,
        maxPoints: 1,
        decisionVersion: 2,
      }],
      resultKind: 'FINAL' as const,
      provisionalResultsEnabled: false,
    };

    const first = computeCanonicalScore(input);
    const second = computeCanonicalScore({
      ...input,
      responses: [...responses].reverse(),
    });

    expect(first).toEqual(second);
    expect(first.score).toBe(1.5);
    expect(first.maxScore).toBe(3);
    expect(first.inputChecksum).toMatch(/^sha256:[a-f0-9]{64}$/);
    expect(first.policy.checksum).toMatch(/^sha256:[a-f0-9]{64}$/);
    expect(JSON.stringify(first)).not.toContain('Rationale interne');
    expect(JSON.stringify(first)).not.toContain('Argument valide');
  });

  it('rejects a response that is not part of the sealed definition', () => {
    expect(() => computeCanonicalScore({
      definition,
      responses: [{
        itemId: 'foreign-item',
        responseType: 'AUTOMATIC_QCM',
        selectedOptionIndex: 0,
        textValue: null,
      }],
      manualDecisions: [],
      resultKind: 'FINAL',
      provisionalResultsEnabled: false,
    })).toThrow(new AssessmentEngineError('ITEM_NOT_IN_DEFINITION'));
  });
});
