export const LANGUAGE_CODES = [
  'ARABE',
  'ANGLAIS',
  'ESPAGNOL',
  'ITALIEN',
  'RUSSE',
  'ALLEMAND',
] as const;

export type LanguageCode = (typeof LANGUAGE_CODES)[number];

export const LANGUAGE_LABELS: Readonly<Record<LanguageCode, string>> = {
  ARABE: 'Arabe',
  ANGLAIS: 'Anglais',
  ESPAGNOL: 'Espagnol',
  ITALIEN: 'Italien',
  RUSSE: 'Russe',
  ALLEMAND: 'Allemand',
};

const LANGUAGE_CODE_SET = new Set<string>(LANGUAGE_CODES);

export function isLanguageCode(value: unknown): value is LanguageCode {
  return typeof value === 'string' && LANGUAGE_CODE_SET.has(value);
}

export type LanguagePairValidationIssue = {
  code: 'LANGUE_CODE_INVALIDE' | 'LANGUES_IDENTIQUES';
  field: 'langueA' | 'langueB';
  message: string;
};

const INVALID_LANGUAGE_MESSAGE = "La langue indiquée n'est pas proposée pour la LVA ou la LVB.";
export const DUPLICATE_LANGUAGE_MESSAGE = 'La LVA et la LVB doivent être deux langues différentes.';

function canonicalizeLanguage(value: string | null | undefined): LanguageCode | null | 'INVALID' {
  if (value == null || value.trim() === '') return null;
  const normalized = value.trim().toUpperCase().replace(/[\s-]+/g, '_');
  return isLanguageCode(normalized) ? normalized : 'INVALID';
}

export function validateLanguagePair(
  langueA: string | null | undefined,
  langueB: string | null | undefined,
): { valid: boolean; issues: LanguagePairValidationIssue[] } {
  const issues: LanguagePairValidationIssue[] = [];
  const canonicalA = canonicalizeLanguage(langueA);
  const canonicalB = canonicalizeLanguage(langueB);

  if (canonicalA === 'INVALID') {
    issues.push({ code: 'LANGUE_CODE_INVALIDE', field: 'langueA', message: INVALID_LANGUAGE_MESSAGE });
  }
  if (canonicalB === 'INVALID') {
    issues.push({ code: 'LANGUE_CODE_INVALIDE', field: 'langueB', message: INVALID_LANGUAGE_MESSAGE });
  }
  if (canonicalA !== null && canonicalA !== 'INVALID' && canonicalA === canonicalB) {
    issues.push({ code: 'LANGUES_IDENTIQUES', field: 'langueB', message: DUPLICATE_LANGUAGE_MESSAGE });
  }

  return { valid: issues.length === 0, issues };
}
