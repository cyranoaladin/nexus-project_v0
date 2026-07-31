import 'server-only';

import { z } from 'zod';

import { sha256Canonical } from '@/lib/llm/openrouter/hash';

export const PiiStatusSchema = z.enum([
  'NOT_SCANNED',
  'CLEAN',
  'REDACTED',
  'BLOCKED',
]);

export const PiiCategorySchema = z.enum([
  'EMAIL',
  'PHONE_INTERNATIONAL',
  'PHONE_LOCAL_TUNISIA',
  'DATE_OF_BIRTH',
  'POSTAL_ADDRESS',
  'URL',
  'SOCIAL_HANDLE',
  'STUDENT_IDENTIFIER',
  'SCHOOL_IDENTIFIER',
  'PERSON_NAME_CANDIDATE',
  'FREE_TEXT_UNCLASSIFIED',
]);

export const PiiScanResultSchema = z.object({
  status: PiiStatusSchema,
  detectorVersion: z.literal('nexus-pii-detector-v1'),
  detectedCategories: z.array(PiiCategorySchema),
  redactionCount: z.number().int().nonnegative(),
  requiresHumanReview: z.boolean(),
  scannedFieldPaths: z.array(z.string().min(1).max(240)),
  scannedContentChecksum: z.string().regex(/^[a-f0-9]{64}$/),
  sanitizedContentChecksum: z.string().regex(/^[a-f0-9]{64}$/),
  payloadChecksum: z.string().regex(/^[a-f0-9]{64}$/).optional(),
  checksum: z.string().regex(/^[a-f0-9]{64}$/),
}).strict().superRefine((value, context) => {
  if (new Set(value.detectedCategories).size !== value.detectedCategories.length) {
    context.addIssue({
      code: z.ZodIssueCode.custom,
      path: ['detectedCategories'],
      message: 'PII categories must be unique.',
    });
  }
  if (new Set(value.scannedFieldPaths).size !== value.scannedFieldPaths.length) {
    context.addIssue({
      code: z.ZodIssueCode.custom,
      path: ['scannedFieldPaths'],
      message: 'Scanned paths must be unique.',
    });
  }
  if (
    value.status === 'CLEAN'
    && (
      value.detectedCategories.length !== 0
      || value.redactionCount !== 0
      || value.requiresHumanReview
    )
  ) {
    context.addIssue({
      code: z.ZodIssueCode.custom,
      path: ['status'],
      message: 'CLEAN requires zero detections and no review.',
    });
  }
  if (
    value.status === 'REDACTED'
    && (
      value.detectedCategories.length === 0
      || value.redactionCount === 0
      || value.requiresHumanReview
    )
  ) {
    context.addIssue({
      code: z.ZodIssueCode.custom,
      path: ['status'],
      message: 'REDACTED requires a traceable substitution and no ambiguity.',
    });
  }
  if (value.status === 'BLOCKED' && !value.requiresHumanReview) {
    context.addIssue({
      code: z.ZodIssueCode.custom,
      path: ['requiresHumanReview'],
      message: 'BLOCKED requires human review.',
    });
  }
});

export type PiiScanResult = z.infer<typeof PiiScanResultSchema>;

export type PiiFieldSource =
  | 'CONTROLLED_TEMPLATE'
  | 'LLM_GENERATED_TEXT'
  | 'STRUCTURAL_METADATA'
  | 'UNCLASSIFIED_FREE_TEXT';

export type PiiFieldInput = Readonly<{
  path: string;
  text: string;
  source: PiiFieldSource;
}>;

type PiiScanValues = Omit<PiiScanResult, 'checksum'>;

const AMBIGUOUS_CATEGORIES = new Set<z.infer<typeof PiiCategorySchema>>([
  'POSTAL_ADDRESS',
  'SOCIAL_HANDLE',
  'STUDENT_IDENTIFIER',
  'SCHOOL_IDENTIFIER',
  'PERSON_NAME_CANDIDATE',
  'FREE_TEXT_UNCLASSIFIED',
]);

const DETECTORS: readonly Readonly<{
  category: z.infer<typeof PiiCategorySchema>;
  pattern: RegExp;
  replacement: string;
}>[] = [
  {
    category: 'EMAIL',
    pattern: /\b[A-Z0-9._%+-]+@[A-Z0-9.-]+\.[A-Z]{2,}\b/giu,
    replacement: '[REDACTED_EMAIL]',
  },
  {
    category: 'URL',
    pattern: /\bhttps?:\/\/[^\s<>"']+/giu,
    replacement: '[REDACTED_URL]',
  },
  {
    category: 'PHONE_INTERNATIONAL',
    pattern: /\+(?!000\b)\d{1,3}(?:[\s.-]*\d){6,12}\b/gu,
    replacement: '[REDACTED_PHONE]',
  },
  {
    category: 'PHONE_LOCAL_TUNISIA',
    pattern: /(?<![\d+])(?!(?:19|20)\d{2}-\d{2}-\d{2}T)(?:[24579]\d(?:[\s.-]*\d){6})(?!\d)/gu,
    replacement: '[REDACTED_PHONE]',
  },
  {
    category: 'DATE_OF_BIRTH',
    pattern: /\b(?:n[ée]e?\s+le\s+)?(?:0?[1-9]|[12]\d|3[01])[/. -](?:0?[1-9]|1[0-2])[/. -](?:19|20)\d{2}\b/giu,
    replacement: '[REDACTED_DATE_OF_BIRTH]',
  },
  {
    category: 'POSTAL_ADDRESS',
    pattern: /\b(?:adresse\s*:\s*)?\d{1,4}\s+(?:rue|avenue|route|impasse|résidence|residence)\b[^,;]*/giu,
    replacement: '[REDACTED_POSTAL_ADDRESS]',
  },
  {
    category: 'SOCIAL_HANDLE',
    pattern: /(?<![\w.])@[a-z0-9_][a-z0-9_.-]{2,31}\b/giu,
    replacement: '[REDACTED_SOCIAL_HANDLE]',
  },
  {
    category: 'STUDENT_IDENTIFIER',
    pattern: /\b(?:matricule|identifiant\s+élève|student\s+id|ine)\s*[:#-]?\s*[a-z0-9][a-z0-9-]{3,}\b/giu,
    replacement: '[REDACTED_STUDENT_IDENTIFIER]',
  },
  {
    category: 'SCHOOL_IDENTIFIER',
    pattern: /\b(?:école|ecole|collège|college|lycée|lycee|établissement|etablissement)\s+[\p{L}0-9][\p{L}0-9 _-]{2,60}/giu,
    replacement: '[REDACTED_SCHOOL_IDENTIFIER]',
  },
  {
    category: 'PERSON_NAME_CANDIDATE',
    pattern: /\b(?:nom|prénom|prenom)\s*:\s*[\p{L}'’-]+(?:\s+[\p{L}'’-]+){0,3}/giu,
    replacement: '[REDACTED_PERSON_NAME]',
  },
];

function valuesForChecksum(result: PiiScanResult): PiiScanValues {
  const { checksum: _checksum, ...values } = result;
  return values;
}

export function validatePiiScanResultChecksum(
  input: PiiScanResult,
): boolean {
  const parsed = PiiScanResultSchema.safeParse(input);
  if (!parsed.success) return false;
  const result = parsed.data;
  return result.checksum === sha256Canonical(valuesForChecksum(result));
}

export function scanPiiFields(
  fields: readonly PiiFieldInput[],
  options: Readonly<{ payloadChecksum?: string }> = {},
): Readonly<{
  sanitizedFields: Readonly<Record<string, string>>;
  result: PiiScanResult;
}> {
  const uniquePaths = new Set(fields.map(({ path }) => path));
  if (uniquePaths.size !== fields.length) {
    throw new Error('PII field paths must be unique.');
  }

  const detected = new Set<z.infer<typeof PiiCategorySchema>>();
  const sanitizedFields: Record<string, string> = {};
  let redactionCount = 0;

  for (const field of fields) {
    let sanitized = field.text;
    if (field.source !== 'STRUCTURAL_METADATA') {
      for (const detector of DETECTORS) {
        detector.pattern.lastIndex = 0;
        const matches = sanitized.match(detector.pattern);
        if (matches === null) continue;
        detected.add(detector.category);
        redactionCount += matches.length;
        sanitized = sanitized.replace(detector.pattern, detector.replacement);
      }
    }
    if (field.source === 'UNCLASSIFIED_FREE_TEXT') {
      detected.add('FREE_TEXT_UNCLASSIFIED');
    }
    sanitizedFields[field.path] = sanitized;
  }

  const detectedCategories = [...detected].sort();
  const blocked = detectedCategories.some((category) =>
    AMBIGUOUS_CATEGORIES.has(category));
  const status = blocked
    ? 'BLOCKED'
    : redactionCount > 0
      ? 'REDACTED'
      : 'CLEAN';
  const values: PiiScanValues = {
    status,
    detectorVersion: 'nexus-pii-detector-v1',
    detectedCategories,
    redactionCount,
    requiresHumanReview: blocked,
    scannedFieldPaths: [...uniquePaths].sort(),
    scannedContentChecksum: sha256Canonical(Object.fromEntries(
      [...fields]
        .sort((left, right) => left.path.localeCompare(right.path))
        .map(({ path, text }) => [path, text]),
    )),
    sanitizedContentChecksum: sha256Canonical(Object.fromEntries(
      Object.entries(sanitizedFields).sort(([left], [right]) =>
        left.localeCompare(right)),
    )),
    ...(options.payloadChecksum === undefined
      ? {}
      : { payloadChecksum: options.payloadChecksum }),
  };
  const result = PiiScanResultSchema.parse({
    ...values,
    checksum: sha256Canonical(values),
  });

  return Object.freeze({
    sanitizedFields: Object.freeze(
      blocked ? {} : { ...sanitizedFields },
    ),
    result: Object.freeze(result),
  });
}

export function bindPiiScanResultToPayload(
  input: PiiScanResult,
  payloadChecksum: string,
): PiiScanResult {
  if (!validatePiiScanResultChecksum(input) || !/^[a-f0-9]{64}$/.test(payloadChecksum)) {
    throw new TypeError('Cannot bind an invalid PII scan to a payload.');
  }
  const { checksum: _checksum, ...values } = input;
  const boundValues: PiiScanValues = {
    ...values,
    payloadChecksum,
  };
  return Object.freeze(PiiScanResultSchema.parse({
    ...boundValues,
    checksum: sha256Canonical(boundValues),
  }));
}

export function piiScanResultMatchesContent(
  input: PiiScanResult,
  fields: readonly Readonly<{ path: string; text: string }>[],
  content: 'SCANNED' | 'SANITIZED',
): boolean {
  if (!validatePiiScanResultChecksum(input)) return false;
  const paths = fields.map(({ path }) => path).sort();
  if (
    paths.length !== input.scannedFieldPaths.length
    || paths.some((path, index) => path !== input.scannedFieldPaths[index])
  ) return false;
  const checksum = sha256Canonical(Object.fromEntries(
    [...fields]
      .sort((left, right) => left.path.localeCompare(right.path))
      .map(({ path, text }) => [path, text]),
  ));
  return checksum === (
    content === 'SCANNED'
      ? input.scannedContentChecksum
      : input.sanitizedContentChecksum
  );
}
