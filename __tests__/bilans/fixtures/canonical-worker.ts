import type { EnabledBilanPack } from '@/lib/bilans/api/pack-access';
import type { BilanPack } from '@/lib/bilans/catalog/load-pack';
import { buildValidatedPack } from '@/lib/bilans/validators/contracts';

const DOMAINS = ['algebre', 'analyse', 'probabilites'] as const;

const PROMPT_CHECKSUMS: Readonly<Record<string, string>> = {
  preAnalysis: 'bd3a658fe5bcf1b34a1902873f85729b7665a345f80f20f0b788bdd41c99d17e',
  eleve: '74266a664f6c65b38a83d9baacf5f0444058300a7a096fb133a29b7b637d2cd7',
  parents: '34919b07d22950a8310b5b9e63a9825b50234fd6d3627789c3eb361a8496cf77',
  nexus: '4be70fedc28946fbd60a082b441227821411125ea918c5056aaa9e984e02739a',
  verifier: 'f341aedb13ba061ed6f6ae52bde92753727ae2550be94d58e3bd85680b3db3a8',
};

const nonEmptyString = { type: 'string' as const, minLength: 1 };

const OUTPUT_SCHEMAS = {
  preAnalysis: {
    type: 'object' as const,
    properties: {
      synthese: nonEmptyString,
      forcesPercues: { type: 'array' as const, items: nonEmptyString },
      craintes: { type: 'array' as const, items: nonEmptyString },
    },
    required: ['synthese', 'forcesPercues', 'craintes'],
    additionalProperties: false as const,
  },
  eleve: {
    type: 'object' as const,
    properties: {
      accroche: nonEmptyString,
      forces: { type: 'array' as const, items: nonEmptyString, minItems: 3, maxItems: 3 },
      priorites: {
        type: 'array' as const,
        items: {
          type: 'object' as const,
          properties: {
            domainId: nonEmptyString,
            titre: nonEmptyString,
            pourquoi: nonEmptyString,
            comment: nonEmptyString,
          },
          required: ['domainId', 'titre', 'pourquoi', 'comment'],
          additionalProperties: false as const,
        },
        minItems: 1,
        maxItems: 8,
      },
      microPlan: {
        type: 'array' as const,
        items: {
          type: 'object' as const,
          properties: {
            action: nonEmptyString,
            dureeMin: { type: 'integer' as const, minimum: 1 },
          },
          required: ['action', 'dureeMin'],
          additionalProperties: false as const,
        },
        minItems: 1,
        maxItems: 5,
      },
      motDeFin: nonEmptyString,
    },
    required: ['accroche', 'forces', 'priorites', 'microPlan', 'motDeFin'],
    additionalProperties: false as const,
  },
  parents: {
    type: 'object' as const,
    properties: {
      cadre: nonEmptyString,
      pointsAppui: {
        type: 'array' as const,
        items: {
          type: 'object' as const,
          properties: { domainId: nonEmptyString, texte: nonEmptyString },
          required: ['domainId', 'texte'],
          additionalProperties: false as const,
        },
        minItems: 1,
        maxItems: 8,
      },
      priorites: {
        type: 'array' as const,
        items: {
          type: 'object' as const,
          properties: { domainId: nonEmptyString, titre: nonEmptyString, ceQuiSeraFait: nonEmptyString },
          required: ['domainId', 'titre', 'ceQuiSeraFait'],
          additionalProperties: false as const,
        },
        minItems: 1,
        maxItems: 8,
      },
      etapeSuivante: {
        type: 'object' as const,
        properties: { texte: nonEmptyString, cta: nonEmptyString },
        required: ['texte', 'cta'],
        additionalProperties: false as const,
      },
    },
    required: ['cadre', 'pointsAppui', 'priorites', 'etapeSuivante'],
    additionalProperties: false as const,
  },
  nexus: {
    type: 'object' as const,
    properties: {
      syntheseProfil: nonEmptyString,
      diagnosticPedagogique: nonEmptyString,
      planQuatreSemaines: nonEmptyString,
      alertes: { type: 'array' as const, items: nonEmptyString },
      ragReferences: { type: 'array' as const, items: nonEmptyString },
    },
    required: ['syntheseProfil', 'diagnosticPedagogique', 'planQuatreSemaines', 'alertes', 'ragReferences'],
    additionalProperties: false as const,
  },
  verifier: {
    type: 'object' as const,
    properties: {
      ok: { type: 'boolean' as const },
      violations: { type: 'array' as const, items: nonEmptyString },
    },
    required: ['ok', 'violations'],
    additionalProperties: false as const,
  },
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
        checksum: PROMPT_CHECKSUMS[id],
      }]),
    ) as BilanPack['reporting']['promptFiles'],
    outputSchemas: OUTPUT_SCHEMAS,
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
