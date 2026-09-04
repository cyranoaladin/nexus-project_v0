export const SPECIALITY_CODES = [
  'MATHEMATIQUES',
  'NSI',
  'PHYSIQUE_CHIMIE',
  'SVT',
  'SES',
] as const;

export type SpecialityCode = (typeof SPECIALITY_CODES)[number];

export const KNOWN_SPECIALITIES = new Set<string>(SPECIALITY_CODES);

export function isSpecialityCode(value: unknown): value is SpecialityCode {
  return typeof value === 'string' && KNOWN_SPECIALITIES.has(value);
}

export type SpecialityValidationIssue = {
  code: 'SPECIALITE_CODE_INCONNU';
  field: 'specialite1' | 'specialite2' | 'specialiteAbandonnee';
  message: string;
};

function isProvidedSpecialityValid(value: string | null | undefined): boolean {
  if (value == null || value.trim() === '') return true;
  const normalized = value.trim().toUpperCase().replace(/[\s-]+/g, '_');
  return isSpecialityCode(normalized);
}

export function validateSpecialityFields(input: {
  specialite1?: string | null;
  specialite2?: string | null;
  specialiteAbandonnee?: string | null;
}): SpecialityValidationIssue[] {
  const issues: SpecialityValidationIssue[] = [];
  for (const field of ['specialite1', 'specialite2', 'specialiteAbandonnee'] as const) {
    if (!isProvidedSpecialityValid(input[field])) {
      issues.push({
        code: 'SPECIALITE_CODE_INCONNU',
        field,
        message: "La spécialité indiquée n'est pas reconnue.",
      });
    }
  }
  return issues;
}
