import type { EnabledBilanPack } from '@/lib/bilans/api/pack-access';
import type { BilanPack } from '@/lib/bilans/catalog/load-pack';
import { buildValidatedPack } from '@/lib/bilans/validators/contracts';

const DOMAINS = ['algebre', 'analyse', 'probabilites'] as const;

const outputSchema = {
  type: 'object' as const,
  properties: { ok: { type: 'boolean' as const } },
  required: ['ok'],
  additionalProperties: false as const,
};

export const CANONICAL_WORKER_PACK: BilanPack = {
  slug: 'fixture-canonical-worker-v1',
  level: 'TERMINALE',
  subject: 'MATHS',
  version: 1,
  status: 'VALIDATED',
  review: {
    validatedBy: 'FIXTURE - JAMAIS UN ENSEIGNANT',
    validatedAt: '1970-01-01T00:00:00.000Z',
  },
  questionnaire: {
    targetDurationMin: 20,
    confidenceScale: { levels: 4, labels: ['Je devine', 'Peu sûr', 'Assez sûr', 'Certain'] },
    items: Array.from({ length: 12 }, (_, index) => {
      const domainId = DOMAINS[Math.floor(index / 4)];
      const correctPosition = index % 4;
      return {
        id: `FIX-Q${String(index + 1).padStart(2, '0')}`,
        subject: 'MATHS' as const,
        category: domainId,
        domainId,
        nodeCpsId: `tle.maths.${domainId}.node-${Math.floor((index % 4) / 2) + 1}`,
        difficulty: ((index % 3) + 1) as 1 | 2 | 3,
        targetTimeSec: 60,
        shortCorrection: `Correction technique ${index + 1}.`,
        weight: (index % 3) + 1,
        competencies: [`tle.maths.${domainId}`],
        questionText: `Question synthétique ${index + 1} ?`,
        options: ['A', 'B', 'C', 'D'].map((id, optionIndex) => ({
          id,
          text: `Option ${id} de la question ${index + 1}`,
          isCorrect: optionIndex === correctPosition,
          ...(optionIndex === correctPosition
            ? {}
            : { distractorRationale: `Erreur synthétique ${id} pour la question ${index + 1}.` }),
        })),
        explanation: `Explication synthétique ${index + 1}.`,
      };
    }),
  },
  scoring: { engine: 'facts.v1.0.1', domains: [...DOMAINS] },
  reporting: {
    rag: { enabled: false, decisionRef: 'A56', sources: [], topK: 0 },
    promptFiles: Object.fromEntries(
      ['preAnalysis', 'eleve', 'parents', 'nexus', 'verifier'].map((id) => [id, {
        path: `__tests__/bilans/fixtures/${id}.md`,
        checksum: 'a'.repeat(64),
      }]),
    ) as BilanPack['reporting']['promptFiles'],
    outputSchemas: {
      preAnalysis: outputSchema,
      eleve: outputSchema,
      parents: outputSchema,
      nexus: outputSchema,
      verifier: outputSchema,
    },
  },
  validation: {
    lexiconPath: 'data/bilans/lexique-interdit.json',
    forbidDigits: ['eleve', 'parents'],
  },
};

export const CANONICAL_WORKER_ENABLED_PACK: EnabledBilanPack = {
  pack: CANONICAL_WORKER_PACK,
  validatedPack: buildValidatedPack({
    slug: CANONICAL_WORKER_PACK.slug,
    version: CANONICAL_WORKER_PACK.version,
    status: 'VALIDATED',
    review: CANONICAL_WORKER_PACK.review,
    scoring: { domains: CANONICAL_WORKER_PACK.scoring.domains },
    reporting: CANONICAL_WORKER_PACK.reporting,
    validation: CANONICAL_WORKER_PACK.validation,
  }),
  checksum: 'b'.repeat(64),
  path: '__tests__/bilans/fixtures/canonical-worker.ts',
};

export const CANONICAL_WORKER_ANSWERS = Object.fromEntries(
  CANONICAL_WORKER_PACK.questionnaire.items.map((item, index) => [item.id, {
    optionId: index % 3 === 0
      ? item.options.find(({ isCorrect }) => isCorrect)!.id
      : item.options.find(({ isCorrect }) => !isCorrect)!.id,
    confidence: ((index % 4) + 1) as 1 | 2 | 3 | 4,
  }]),
);
