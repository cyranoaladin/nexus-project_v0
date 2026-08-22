import { z } from 'zod';

import lexique from '@/data/bilans/lexique-interdit.json';

export const BANK_ITEM_ID_PATTERN = /^[A-Z0-9]{2,3}-[A-Z]{3}-[A-Z0-9]{3,}-\d{2}$/;

export const cpsCatalogSchema = z.object({
  schemaVersion: z.literal('nexus-cps-catalog/v1'),
  slug: z.string().trim().min(1),
  version: z.number().int().positive(),
  nodes: z.array(z.object({
    id: z.string().trim().regex(/^[a-z0-9]+(\.[a-z0-9-]+)+$/),
    label: z.string().trim().min(1),
    sourceLevel: z.enum(['COLLEGE', 'CINQUIEME', 'QUATRIEME', 'TROISIEME', 'SECONDE', 'PREMIERE', 'TERMINALE']),
    targetLevel: z.enum(['QUATRIEME', 'TROISIEME', 'SECONDE', 'PREMIERE', 'TERMINALE']),
    sequenceOrder: z.number().int().positive(),
    pedagogicalRationale: z.string().trim().min(1),
  }).strict()).min(1),
}).strict();

export type CpsCatalog = z.infer<typeof cpsCatalogSchema>;

export type SourceBank = Readonly<{
  slug: string;
  level: string;
  subject: string;
  version: number;
  status: string;
  targetDurationMin: number;
  delivery?: Readonly<{
    online: boolean;
    paperEntry: boolean;
    fixedPaperForm: boolean;
  }>;
  items: readonly Readonly<{
    id: string;
    nodeCpsId: string;
    type: 'QCM_SIMPLE' | 'QCM_MULTIPLE' | 'NUMERIC' | 'SHORT_TEXT';
    difficulty: number;
    targetTimeSec: number;
    statement: string;
    shortCorrection: string;
    options?: readonly Readonly<{
      key: string;
      label: string;
      correct: boolean;
      distractorRationale?: string;
    }>[];
    target?: number;
    tolerance?: number;
    accepted?: readonly string[];
  }>[];
}>;

export type BankValidationRule = `V${number}` | 'SCHEMA' | 'BATCH';

export type BankValidationFailure = Readonly<{
  slug: string;
  rule: BankValidationRule;
  path: string;
  message: string;
}>;

function normalizeText(value: string): string {
  return value.normalize('NFD').replace(/[\u0300-\u036f]/g, '').toLowerCase()
    .replace(/[^a-z0-9]+/g, ' ').trim();
}

function stringsFrom(item: SourceBank['items'][number]): string {
  return [item.statement, item.shortCorrection, ...(item.options ?? []).flatMap((option) => [
    option.label,
    option.distractorRationale ?? '',
  ])].join(' ');
}

function failure(
  bank: SourceBank,
  rule: BankValidationRule,
  path: string,
  message: string,
): BankValidationFailure {
  return Object.freeze({ slug: bank.slug, rule, path, message });
}

function isFixedPaperOnlyForm(bank: SourceBank): boolean {
  return bank.delivery?.fixedPaperForm === true
    && bank.delivery.online === false
    && bank.delivery.paperEntry === true;
}

export function validateBankSource(bank: SourceBank, catalog: CpsCatalog): BankValidationFailure[] {
  const failures: BankValidationFailure[] = [];
  const ids = new Set<string>();
  const nodeCounts = new Map<string, number>();
  const catalogIds = new Set(catalog.nodes.map(({ id }) => id));
  const correctPositions: number[] = [];
  const forbiddenTerms = Object.values(lexique.categories).flat();

  if (bank.delivery?.fixedPaperForm === true && !isFixedPaperOnlyForm(bank)) {
    failures.push(failure(
      bank,
      'V14',
      '$.delivery',
      'fixedPaperForm requires online=false and paperEntry=true',
    ));
  }

  if (catalog.nodes.length !== catalogIds.size) {
    failures.push(failure(bank, 'V2', '$.catalog.nodes', 'CPS_NODE_ID_DUPLICATE'));
  }
  const sequenceOrders = catalog.nodes.map(({ sequenceOrder }) => sequenceOrder).sort((left, right) => left - right);
  if (sequenceOrders.some((value, index) => value !== index + 1)) {
    failures.push(failure(bank, 'V2', '$.catalog.nodes', 'CPS_SEQUENCE_ORDER_MUST_BE_CONTIGUOUS_1_TO_N'));
  }
  for (const node of catalog.nodes) {
    if (node.targetLevel !== bank.level) {
      failures.push(failure(bank, 'V2', `$.catalog.nodes.${node.id}`, `targetLevel=${node.targetLevel}; expected ${bank.level}`));
    }
  }

  for (const [index, item] of bank.items.entries()) {
    const path = `$.items[${index}]`;
    if (!BANK_ITEM_ID_PATTERN.test(item.id)) {
      failures.push(failure(bank, 'V1', `${path}.id`, `invalid identifier: ${item.id}`));
    }
    if (ids.has(item.id)) failures.push(failure(bank, 'V1', `${path}.id`, `duplicate identifier: ${item.id}`));
    ids.add(item.id);

    if (!catalogIds.has(item.nodeCpsId)) {
      failures.push(failure(bank, 'V2', `${path}.nodeCpsId`, `unknown CPS node: ${item.nodeCpsId}`));
    }
    nodeCounts.set(item.nodeCpsId, (nodeCounts.get(item.nodeCpsId) ?? 0) + 1);
    if (![1, 2, 3].includes(item.difficulty)) {
      failures.push(failure(bank, 'V3', `${path}.difficulty`, 'difficulty must be 1, 2 or 3'));
    }

    const options = item.options ?? [];
    const correctCount = options.filter(({ correct }) => correct).length;
    if (item.type === 'QCM_SIMPLE' && (options.length !== 4 || correctCount !== 1)) {
      failures.push(failure(bank, 'V5', `${path}.options`, 'QCM_SIMPLE requires four options and exactly one correct answer'));
    }
    if (item.type === 'QCM_MULTIPLE' && (![4, 5].includes(options.length) || ![2, 3].includes(correctCount))) {
      failures.push(failure(bank, 'V6', `${path}.options`, 'QCM_MULTIPLE requires four or five options and two or three correct answers'));
    }
    if (item.type === 'NUMERIC' && (typeof item.target !== 'number' || typeof item.tolerance !== 'number' || item.tolerance < 0)) {
      failures.push(failure(bank, 'V7', path, 'NUMERIC requires target and a non-negative tolerance'));
    }
    if (item.type === 'SHORT_TEXT') {
      const accepted = item.accepted ?? [];
      const normalized = accepted.map(normalizeText);
      if (accepted.length === 0 || normalized.some((value) => value.length === 0) || new Set(normalized).size !== normalized.length) {
        failures.push(failure(bank, 'V8', `${path}.accepted`, 'SHORT_TEXT requires distinct non-empty normalized answers'));
      }
    }
    if (item.shortCorrection.trim().length === 0 || item.shortCorrection.length > 320) {
      failures.push(failure(bank, 'V9', `${path}.shortCorrection`, 'shortCorrection must contain at most 320 characters'));
    }

    const normalizedContent = normalizeText(stringsFrom(item));
    const matchedTerms = forbiddenTerms.filter((term) => normalizedContent.includes(normalizeText(term)));
    if (matchedTerms.length > 0) {
      failures.push(failure(bank, 'V10', path, `forbidden lexicon: ${matchedTerms.join(', ')}`));
    }
    const content = stringsFrom(item);
    if (/\b(?:M\.|Mme|Monsieur|Madame)\s+[A-ZÉÈÀÂÎÔÛ][a-zéèàâîôûç]+/.test(content)
      || /\b(?:OpenAI|ChatGPT|OpenRouter|Google|Microsoft|Meta)\b/i.test(content)) {
      failures.push(failure(bank, 'V12', path, 'teacher name or third-party brand detected'));
    }
    for (const [optionIndex, option] of options.entries()) {
      if (!option.correct && (option.distractorRationale === undefined || option.distractorRationale.trim().length === 0)) {
        failures.push(failure(bank, 'V13', `${path}.options[${optionIndex}].distractorRationale`, 'every distractor requires a rationale'));
      }
    }
    if (correctCount === 1) {
      const position = options.findIndex(({ correct }) => correct);
      correctPositions[position] = (correctPositions[position] ?? 0) + 1;
    }
  }

  for (const [nodeId, count] of nodeCounts) {
    if (count < 2 || count > 6) failures.push(failure(bank, 'V4', `$.nodes.${nodeId}`, `node has ${count} items; expected 2..6`));
  }
  const totalSeconds = bank.items.reduce((sum, item) => sum + item.targetTimeSec, 0);
  if (totalSeconds > bank.targetDurationMin * 60) {
    failures.push(failure(bank, 'V11', '$.targetDurationMin', `${totalSeconds}s exceeds ${bank.targetDurationMin * 60}s`));
  }

  // V14 protects interactive/online forms from a biased answer-position pattern.
  // A fixed paper form is already printed: reordering its A/B/C/D options in the
  // digital bank would silently break transcription. Such a form is accepted only
  // when it is explicitly paper-only; all online-capable banks keep the V14 gate.
  if (!isFixedPaperOnlyForm(bank)) {
    for (const [position, count] of correctPositions.entries()) {
      if (count * 100 > bank.items.length * 40) {
        failures.push(failure(bank, 'V14', '$.items', `correct answer position ${String.fromCharCode(65 + position)}=${count}/${bank.items.length}>40%`));
      }
    }
  }
  return failures;
}

export function validateBankCollection(
  entries: readonly Readonly<{ bank: SourceBank; catalog: CpsCatalog }>[],
): BankValidationFailure[] {
  const failures = entries.flatMap(({ bank, catalog }) => validateBankSource(bank, catalog));
  const itemOwners = new Map<string, string>();
  const nodeOwners = new Map<string, Readonly<{ owner: string; signature: string }>>();
  for (const { bank, catalog } of entries) {
    for (const item of bank.items) {
      const owner = itemOwners.get(item.id);
      if (owner !== undefined && owner !== bank.slug) {
        failures.push(failure(bank, 'V1', '$.items', `global duplicate ${item.id}; first declared by ${owner}`));
      } else itemOwners.set(item.id, bank.slug);
    }
    for (const node of catalog.nodes) {
      const signature = JSON.stringify({
        label: node.label,
        sourceLevel: node.sourceLevel,
        targetLevel: node.targetLevel,
        sequenceOrder: node.sequenceOrder,
        pedagogicalRationale: node.pedagogicalRationale,
      });
      const existing = nodeOwners.get(node.id);
      if (existing !== undefined && existing.signature !== signature) {
        failures.push(failure(bank, 'V2', '$.catalog.nodes', `CPS collision ${node.id}; declarations ${existing.owner} and ${catalog.slug}`));
      } else if (existing === undefined) {
        nodeOwners.set(node.id, { owner: catalog.slug, signature });
      }
    }
  }
  return failures;
}

export function assertBankRules(bank: SourceBank, catalog: CpsCatalog): void {
  const failures = validateBankSource(bank, catalog);
  if (failures.length > 0) {
    throw new Error(`BANK_RULES_INVALID\n${failures.map(({ slug, rule, path, message }) => `${slug}:${rule}:${path}:${message}`).join('\n')}`);
  }
}
