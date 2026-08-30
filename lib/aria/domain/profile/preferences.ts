import { z } from 'zod';
import { isKnownCourseKey } from '@/lib/curriculum/catalog';
import type { AriaCourseKey } from '../../contracts';
import { AriaError } from '../../errors';

const courseKeyArraySchema = z.array(z.string().min(1)).max(64).superRefine((values, context) => {
  if (new Set(values).size !== values.length) {
    context.addIssue({ code: 'custom', message: 'Les cours du profil doivent être uniques.' });
  }
});

export const ariaLearningPreferencesV1Schema = z.object({
  version: z.literal(1),
  pinnedCourseKeys: courseKeyArraySchema,
  focusedCourseKey: z.string().min(1).nullable(),
  courseOrder: courseKeyArraySchema,
  showCitations: z.boolean(),
}).strict();

export interface AriaLearningPreferencesV1 {
  readonly version: 1;
  readonly pinnedCourseKeys: readonly AriaCourseKey[];
  readonly focusedCourseKey: AriaCourseKey | null;
  readonly courseOrder: readonly AriaCourseKey[];
  readonly showCitations: boolean;
}

export interface StoredAriaLearningPreferences {
  readonly preferencesVersion: number;
  readonly pinnedCourseKeys: unknown;
  readonly focusedCourseKey: string | null;
  readonly courseOrder: unknown;
  readonly showCitations: boolean;
}

export const DEFAULT_ARIA_LEARNING_PREFERENCES_V1: AriaLearningPreferencesV1 = Object.freeze({
  version: 1,
  pinnedCourseKeys: Object.freeze([]),
  focusedCourseKey: null,
  courseOrder: Object.freeze([]),
  showCitations: true,
});

function assertAcademicCourseKeys(
  preferences: z.infer<typeof ariaLearningPreferencesV1Schema>,
  academicCourseKeys: readonly string[],
): AriaLearningPreferencesV1 {
  const academic = new Set(academicCourseKeys);
  const referenced = [
    ...preferences.pinnedCourseKeys,
    ...preferences.courseOrder,
    ...(preferences.focusedCourseKey ? [preferences.focusedCourseKey] : []),
  ];
  if (referenced.some((courseKey) => !isKnownCourseKey(courseKey) || !academic.has(courseKey))) {
    throw new AriaError('BAD_REQUEST', 400, 'Une préférence vise un cours absent de la carte scolaire active.');
  }
  return Object.freeze({
    version: 1 as const,
    pinnedCourseKeys: Object.freeze([...preferences.pinnedCourseKeys]) as readonly AriaCourseKey[],
    focusedCourseKey: preferences.focusedCourseKey as AriaCourseKey | null,
    courseOrder: Object.freeze([...preferences.courseOrder]) as readonly AriaCourseKey[],
    showCitations: preferences.showCitations,
  });
}

export function parseAriaLearningPreferencesV1(
  input: unknown,
  academicCourseKeys: readonly string[],
): AriaLearningPreferencesV1 {
  const parsed = ariaLearningPreferencesV1Schema.safeParse(input);
  if (!parsed.success) {
    throw new AriaError('BAD_REQUEST', 400, 'Préférences ARIA V1 invalides.');
  }
  return assertAcademicCourseKeys(parsed.data, academicCourseKeys);
}

export function projectStoredAriaLearningPreferencesV1(
  stored: StoredAriaLearningPreferences,
  academicCourseKeys: readonly string[],
): AriaLearningPreferencesV1 {
  if (stored.preferencesVersion !== 1) {
    throw new AriaError('INTERNAL_ERROR', 500, 'Version de préférences ARIA non prise en charge.');
  }
  const structurallyValid = ariaLearningPreferencesV1Schema.safeParse({
    version: stored.preferencesVersion,
    pinnedCourseKeys: stored.pinnedCourseKeys,
    focusedCourseKey: stored.focusedCourseKey,
    courseOrder: stored.courseOrder,
    showCitations: stored.showCitations,
  });
  if (!structurallyValid.success) {
    throw new AriaError('INTERNAL_ERROR', 500, 'Préférences ARIA persistées invalides.');
  }
  const academic = new Set(academicCourseKeys);
  const knownAndAcademic = (courseKey: string): courseKey is AriaCourseKey =>
    isKnownCourseKey(courseKey) && academic.has(courseKey);
  return Object.freeze({
    version: 1 as const,
    pinnedCourseKeys: Object.freeze(
      structurallyValid.data.pinnedCourseKeys.filter(knownAndAcademic),
    ),
    focusedCourseKey: structurallyValid.data.focusedCourseKey
      && knownAndAcademic(structurallyValid.data.focusedCourseKey)
      ? structurallyValid.data.focusedCourseKey
      : null,
    courseOrder: Object.freeze(
      structurallyValid.data.courseOrder.filter(knownAndAcademic),
    ),
    showCitations: structurallyValid.data.showCitations,
  });
}
