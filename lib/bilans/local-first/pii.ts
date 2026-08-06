import { z } from 'zod';

import { sha256Canonical } from './hash';

export const PiiStatusSchema = z.enum(['NOT_SCANNED', 'CLEAN', 'REDACTED', 'BLOCKED']);
export const PiiCategorySchema = z.enum([
  'EMAIL', 'PHONE_INTERNATIONAL', 'PHONE_LOCAL_TUNISIA', 'DATE_OF_BIRTH',
  'POSTAL_ADDRESS', 'URL', 'SOCIAL_HANDLE', 'STUDENT_IDENTIFIER',
  'SCHOOL_IDENTIFIER', 'PERSON_NAME_CANDIDATE', 'FREE_TEXT_UNCLASSIFIED',
]);

export const PiiScanResultSchema = z.object({
  status: PiiStatusSchema,
  detectorVersion: z.literal('nexus-pii-detector-v1'),
  detectedCategories: z.array(PiiCategorySchema),
  redactionCount: z.number().int().nonnegative(),
  requiresHumanReview: z.boolean(),
  scannedFieldPaths: z.array(z.string().min(1)),
  scannedContentChecksum: z.string().regex(/^[a-f0-9]{64}$/),
  sanitizedContentChecksum: z.string().regex(/^[a-f0-9]{64}$/),
  payloadChecksum: z.string().regex(/^[a-f0-9]{64}$/).optional(),
  checksum: z.string().regex(/^[a-f0-9]{64}$/),
}).strict();

export type PiiScanResult = z.infer<typeof PiiScanResultSchema>;
export type PiiFieldInput = Readonly<{
  path: string;
  text: string;
  source: 'CONTROLLED_TEMPLATE' | 'LLM_GENERATED_TEXT' | 'STRUCTURAL_METADATA' | 'UNCLASSIFIED_FREE_TEXT';
}>;

type PiiCategory = z.infer<typeof PiiCategorySchema>;
type PiiScanValues = Omit<PiiScanResult, 'checksum'>;

const AMBIGUOUS = new Set<PiiCategory>([
  'POSTAL_ADDRESS', 'SOCIAL_HANDLE', 'STUDENT_IDENTIFIER', 'SCHOOL_IDENTIFIER',
  'PERSON_NAME_CANDIDATE', 'FREE_TEXT_UNCLASSIFIED',
]);

const DETECTORS: readonly Readonly<{ category: PiiCategory; pattern: RegExp; replacement: string }>[] = [
  { category: 'EMAIL', pattern: /\b[A-Z0-9._%+-]+@[A-Z0-9.-]+\.[A-Z]{2,}\b/giu, replacement: '[REDACTED_EMAIL]' },
  { category: 'URL', pattern: /\bhttps?:\/\/[^\s<>"']+/giu, replacement: '[REDACTED_URL]' },
  { category: 'PHONE_INTERNATIONAL', pattern: /\+(?!000\b)\d{1,3}(?:[\s.-]*\d){6,12}\b/gu, replacement: '[REDACTED_PHONE]' },
  { category: 'PHONE_LOCAL_TUNISIA', pattern: /(?<![\d+])(?:[24579]\d(?:[\s.-]*\d){6})(?!\d)/gu, replacement: '[REDACTED_PHONE]' },
  { category: 'DATE_OF_BIRTH', pattern: /\b(?:n[ée]e?\s+le\s+)?(?:0?[1-9]|[12]\d|3[01])[/. -](?:0?[1-9]|1[0-2])[/. -](?:19|20)\d{2}\b/giu, replacement: '[REDACTED_DATE_OF_BIRTH]' },
  { category: 'POSTAL_ADDRESS', pattern: /\b(?:adresse\s*:\s*)?\d{1,4}\s+(?:rue|avenue|route|impasse|résidence|residence)\b[^,;]*/giu, replacement: '[REDACTED_POSTAL_ADDRESS]' },
  { category: 'SOCIAL_HANDLE', pattern: /(?<![\w.])@[a-z0-9_][a-z0-9_.-]{2,31}\b/giu, replacement: '[REDACTED_SOCIAL_HANDLE]' },
  { category: 'STUDENT_IDENTIFIER', pattern: /\b(?:matricule|identifiant\s+élève|student\s+id|ine)(?:\s*[:#-]\s*|\s+)[a-z0-9][a-z0-9-]{3,}\b/giu, replacement: '[REDACTED_STUDENT_IDENTIFIER]' },
  { category: 'SCHOOL_IDENTIFIER', pattern: /\b(?:école|ecole|collège|college|lycée|lycee|établissement|etablissement)\s+[\p{L}0-9][\p{L}0-9 _-]{2,60}/giu, replacement: '[REDACTED_SCHOOL_IDENTIFIER]' },
  { category: 'PERSON_NAME_CANDIDATE', pattern: /\b(?:nom|prénom|prenom)\s*:\s*[\p{L}'’-]+(?:\s+[\p{L}'’-]+){0,3}/giu, replacement: '[REDACTED_PERSON_NAME]' },
];

function withoutChecksum(result: PiiScanResult): PiiScanValues {
  const { checksum: _checksum, ...values } = result;
  return values;
}

export function validatePiiScanResultChecksum(input: PiiScanResult): boolean {
  const parsed = PiiScanResultSchema.safeParse(input);
  return parsed.success && parsed.data.checksum === sha256Canonical(withoutChecksum(parsed.data));
}

export function scanPiiFields(fields: readonly PiiFieldInput[]): Readonly<{
  sanitizedFields: Readonly<Record<string, string>>;
  result: PiiScanResult;
}> {
  if (new Set(fields.map(({ path }) => path)).size !== fields.length) {
    throw new TypeError('PII field paths must be unique');
  }
  const detected = new Set<PiiCategory>();
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
    if (field.source === 'UNCLASSIFIED_FREE_TEXT') detected.add('FREE_TEXT_UNCLASSIFIED');
    sanitizedFields[field.path] = sanitized;
  }

  const detectedCategories = [...detected].sort();
  const blocked = detectedCategories.some((category) => AMBIGUOUS.has(category));
  const status = blocked ? 'BLOCKED' : redactionCount > 0 ? 'REDACTED' : 'CLEAN';
  const values: PiiScanValues = {
    status,
    detectorVersion: 'nexus-pii-detector-v1',
    detectedCategories,
    redactionCount,
    requiresHumanReview: blocked,
    scannedFieldPaths: fields.map(({ path }) => path).sort(),
    scannedContentChecksum: sha256Canonical(Object.fromEntries(fields.map(({ path, text }) => [path, text]).sort())),
    sanitizedContentChecksum: sha256Canonical(Object.fromEntries(Object.entries(sanitizedFields).sort())),
  };
  const result = PiiScanResultSchema.parse({ ...values, checksum: sha256Canonical(values) });
  return Object.freeze({
    sanitizedFields: Object.freeze(blocked ? {} : { ...sanitizedFields }),
    result: Object.freeze(result),
  });
}

export function bindPiiScanResultToPayload(input: PiiScanResult, payload: unknown): PiiScanResult {
  if (!validatePiiScanResultChecksum(input)) throw new TypeError('Cannot bind an invalid PII scan');
  const values: PiiScanValues = { ...withoutChecksum(input), payloadChecksum: sha256Canonical(payload) };
  return Object.freeze(PiiScanResultSchema.parse({ ...values, checksum: sha256Canonical(values) }));
}

export function piiScanResultMatchesPayload(input: PiiScanResult, payload: unknown): boolean {
  return validatePiiScanResultChecksum(input)
    && input.payloadChecksum !== undefined
    && input.payloadChecksum === sha256Canonical(payload);
}
