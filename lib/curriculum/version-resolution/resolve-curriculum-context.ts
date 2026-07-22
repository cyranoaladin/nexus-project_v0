import { z } from 'zod';

import {
  CURRICULUM_REGISTRY,
  CURRICULUM_REGISTRY_VALIDATED_THROUGH,
} from '../registry';
import {
  academicYearSchema,
  curriculumLevelSchema,
  curriculumSubjectSchema,
  curriculumSubjectVariantSchema,
  curriculumTrackSchema,
  type AcademicYear,
  type CurriculumVersion,
} from '../schemas/curriculum';

export const curriculumResolutionRequestSchema = z.object({
  academicYear: academicYearSchema,
  currentLevel: curriculumLevelSchema,
  targetLevel: curriculumLevelSchema,
  track: curriculumTrackSchema,
  prerequisiteTrack: curriculumTrackSchema,
  subject: curriculumSubjectSchema,
  prerequisiteSubject: curriculumSubjectSchema.optional(),
  subjectVariant: curriculumSubjectVariantSchema,
  prerequisiteSubjectVariant: curriculumSubjectVariantSchema,
  examSession: z.number().int().min(2000).max(2200).optional(),
});

export type CurriculumResolutionRequest = z.infer<typeof curriculumResolutionRequestSchema>;

export interface CurriculumContext {
  academicYear: AcademicYear;
  previousAcademicYear: AcademicYear;
  currentLevel: CurriculumResolutionRequest['currentLevel'];
  targetLevel: CurriculumResolutionRequest['targetLevel'];
  track: CurriculumResolutionRequest['track'];
  subject: CurriculumResolutionRequest['subject'];
  prerequisiteSubject: CurriculumResolutionRequest['subject'];
  subjectVariant: CurriculumResolutionRequest['subjectVariant'];
  prerequisiteCurriculumId: string;
  targetCurriculumId: string;
  examSession?: number;
}

export type CurriculumResolutionErrorCode = 'NO_MATCH' | 'AMBIGUOUS_MATCH';
export type CurriculumResolutionStage = 'PREREQUISITE' | 'TARGET';

export class CurriculumResolutionError extends Error {
  readonly code: CurriculumResolutionErrorCode;
  readonly stage: CurriculumResolutionStage;

  constructor(
    code: CurriculumResolutionErrorCode,
    stage: CurriculumResolutionStage,
    message: string,
  ) {
    super(message);
    this.name = 'CurriculumResolutionError';
    this.code = code;
    this.stage = stage;
  }
}

function previousAcademicYear(academicYear: AcademicYear): AcademicYear {
  const start = Number(academicYear.slice(0, 4)) - 1;
  return academicYearSchema.parse(`${start}-${start + 1}`);
}

function isEffectiveIn(
  curriculum: CurriculumVersion,
  academicYear: AcademicYear,
): boolean {
  return curriculum.effectiveFromAcademicYear <= academicYear
    && (
      curriculum.effectiveToAcademicYear === undefined
      || curriculum.effectiveToAcademicYear >= academicYear
    );
}

function resolveSingleVersion(
  registry: readonly CurriculumVersion[],
  selector: Pick<CurriculumVersion, 'subject' | 'level' | 'track' | 'subjectVariant'>,
  academicYear: AcademicYear,
  stage: CurriculumResolutionStage,
): CurriculumVersion {
  const matches = registry.filter((curriculum) => (
    curriculum.status === 'PUBLISHED'
    && curriculum.subject === selector.subject
    && curriculum.level === selector.level
    && curriculum.track === selector.track
    && curriculum.subjectVariant === selector.subjectVariant
    && isEffectiveIn(curriculum, academicYear)
  ));

  if (matches.length === 0) {
    throw new CurriculumResolutionError(
      'NO_MATCH',
      stage,
      `No published curriculum found for ${stage.toLowerCase()} in ${academicYear}`,
    );
  }

  if (matches.length > 1) {
    throw new CurriculumResolutionError(
      'AMBIGUOUS_MATCH',
      stage,
      `Multiple published curricula found for ${stage.toLowerCase()} in ${academicYear}`,
    );
  }

  return matches[0];
}

export function resolveCurriculumContext(
  request: CurriculumResolutionRequest,
  registry: readonly CurriculumVersion[] = CURRICULUM_REGISTRY,
): CurriculumContext {
  const parsed = curriculumResolutionRequestSchema.parse(request);

  if (parsed.academicYear > CURRICULUM_REGISTRY_VALIDATED_THROUGH) {
    throw new CurriculumResolutionError(
      'NO_MATCH',
      'TARGET',
      `Academic year ${parsed.academicYear} exceeds the validated curriculum horizon `
        + CURRICULUM_REGISTRY_VALIDATED_THROUGH,
    );
  }

  const prerequisiteAcademicYear = previousAcademicYear(parsed.academicYear);
  const prerequisiteSubject = parsed.prerequisiteSubject ?? parsed.subject;

  const prerequisite = resolveSingleVersion(
    registry,
    {
      subject: prerequisiteSubject,
      level: parsed.currentLevel,
      track: parsed.prerequisiteTrack,
      subjectVariant: parsed.prerequisiteSubjectVariant,
    },
    prerequisiteAcademicYear,
    'PREREQUISITE',
  );

  const target = resolveSingleVersion(
    registry,
    {
      subject: parsed.subject,
      level: parsed.targetLevel,
      track: parsed.track,
      subjectVariant: parsed.subjectVariant,
    },
    parsed.academicYear,
    'TARGET',
  );

  return {
    academicYear: parsed.academicYear,
    previousAcademicYear: prerequisiteAcademicYear,
    currentLevel: parsed.currentLevel,
    targetLevel: parsed.targetLevel,
    track: parsed.track,
    subject: parsed.subject,
    prerequisiteSubject,
    subjectVariant: parsed.subjectVariant,
    prerequisiteCurriculumId: prerequisite.id,
    targetCurriculumId: target.id,
    ...(parsed.examSession === undefined ? {} : { examSession: parsed.examSession }),
  };
}
