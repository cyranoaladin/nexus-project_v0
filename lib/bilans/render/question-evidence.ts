import type { BilanPack } from '../catalog/load-pack';

/**
 * Détail des réponses d'une passation : chaque item du pack rapproché de la
 * réponse de l'élève. Construction en LECTURE SEULE — jamais de score
 * recalculé, jamais de modification de banque : ce module projette, pour la
 * restitution, des données qui existent déjà (banque + réponses de la
 * tentative).
 *
 * Les banques encodent la certitude sur quatre niveaux dont les libellés
 * officiels sont portés par le pack (`questionnaire.confidenceScale.labels`).
 */

export const QUESTION_EVIDENCE_VERSION = 'question-evidence.v1' as const;

export type EvidenceOption = Readonly<{
  id: string;
  text: string;
  isCorrect: boolean;
  distractorRationale: string | null;
}>;

export type EvidenceItem = Readonly<{
  itemId: string;
  domainId: string;
  /** Libellé humain du sous-thème, tel que rédigé dans la banque. */
  category: string;
  questionText: string;
  options: readonly EvidenceOption[];
  shortCorrection: string;
  chosenOptionId: string | null;
  confidence: 1 | 2 | 3 | 4 | null;
}>;

export type QuestionEvidence = Readonly<{
  version: typeof QUESTION_EVIDENCE_VERSION;
  packSlug: string;
  packVersion: number;
  confidenceLabels: readonly [string, string, string, string];
  items: readonly EvidenceItem[];
}>;

const DEFAULT_CONFIDENCE_LABELS = Object.freeze(['je devine', 'peu sûr', 'plutôt sûr', 'certain'] as const);

function storedAnswer(value: unknown, itemId: string): Readonly<{ optionId: string | null; confidence: 1 | 2 | 3 | 4 | null }> {
  if (value === null || typeof value !== 'object' || Array.isArray(value)) {
    return Object.freeze({ optionId: null, confidence: null });
  }
  const record = (value as Record<string, unknown>)[itemId];
  if (record === null || record === undefined || typeof record !== 'object' || Array.isArray(record)) {
    return Object.freeze({ optionId: null, confidence: null });
  }
  const { optionId, confidence } = record as { optionId?: unknown; confidence?: unknown };
  return Object.freeze({
    optionId: typeof optionId === 'string' && optionId.trim().length > 0 ? optionId : null,
    confidence: confidence === 1 || confidence === 2 || confidence === 3 || confidence === 4 ? confidence : null,
  });
}

export function buildQuestionEvidence(pack: BilanPack, answers: unknown): QuestionEvidence {
  const labels = pack.questionnaire.confidenceScale?.labels;
  const confidenceLabels = (Array.isArray(labels) && labels.length === 4
    ? labels
    : DEFAULT_CONFIDENCE_LABELS) as unknown as [string, string, string, string];

  const items = pack.questionnaire.items.map((item) => {
    const answer = storedAnswer(answers, item.id);
    const options = item.options.map((option) => Object.freeze({
      id: option.id,
      text: option.text,
      isCorrect: option.isCorrect,
      distractorRationale: option.distractorRationale ?? null,
    }));
    const chosenExists = answer.optionId !== null && options.some(({ id }) => id === answer.optionId);
    return Object.freeze({
      itemId: item.id,
      domainId: item.domainId,
      category: item.category,
      questionText: item.questionText,
      options: Object.freeze(options),
      shortCorrection: item.shortCorrection,
      chosenOptionId: chosenExists ? answer.optionId : null,
      confidence: answer.confidence,
    });
  });

  return Object.freeze({
    version: QUESTION_EVIDENCE_VERSION,
    packSlug: pack.slug,
    packVersion: pack.version,
    confidenceLabels: Object.freeze(confidenceLabels) as QuestionEvidence['confidenceLabels'],
    items: Object.freeze(items),
  });
}

export type EvidenceItemStatus = 'JUSTE' | 'A_REVOIR' | 'NON_TRAITE';

export function evidenceItemStatus(item: EvidenceItem): EvidenceItemStatus {
  if (item.chosenOptionId === null) return 'NON_TRAITE';
  const chosen = item.options.find(({ id }) => id === item.chosenOptionId);
  return chosen?.isCorrect === true ? 'JUSTE' : 'A_REVOIR';
}

export function chosenOption(item: EvidenceItem): EvidenceOption | null {
  return item.options.find(({ id }) => id === item.chosenOptionId) ?? null;
}

export function correctOption(item: EvidenceItem): EvidenceOption | null {
  return item.options.find(({ isCorrect }) => isCorrect) ?? null;
}

export function confidenceLabel(evidence: QuestionEvidence, confidence: EvidenceItem['confidence']): string | null {
  if (confidence === null) return null;
  return evidence.confidenceLabels[confidence - 1] ?? null;
}

/**
 * Confiance moyenne déclarée par domaine (1 à 4), pour la visualisation de
 * calibration du document interne. `null` quand aucun item du domaine ne
 * porte de certitude déclarée.
 */
export function meanConfidenceByDomain(evidence: QuestionEvidence): ReadonlyMap<string, number | null> {
  const sums = new Map<string, { total: number; count: number }>();
  for (const item of evidence.items) {
    const bucket = sums.get(item.domainId) ?? { total: 0, count: 0 };
    if (item.confidence !== null) {
      bucket.total += item.confidence;
      bucket.count += 1;
    }
    sums.set(item.domainId, bucket);
  }
  const means = new Map<string, number | null>();
  for (const [domainId, { total, count }] of sums) {
    means.set(domainId, count === 0 ? null : Math.round((total / count) * 100) / 100);
  }
  return means;
}
