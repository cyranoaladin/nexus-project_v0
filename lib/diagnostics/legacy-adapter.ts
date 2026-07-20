/**
 * Legacy Diagnostic Adapter — Lot 4
 *
 * Converts existing DiagnosticDefinition objects (legacy format)
 * into the canonical AssessmentDefinition contract without modifying
 * any source files.
 *
 * Design decisions:
 * - The adapter is a pure function: no side effects, no DB access.
 * - It resolves curriculum IDs from the CURRICULUM_REGISTRY using the
 *   mapping table below. Unmapped definitions produce a DRAFT with
 *   placeholder curriculum IDs that must be reviewed before publishing.
 * - The adapter never throws: it returns a typed result with warnings.
 * - All adapted definitions have status="DRAFT" until human review and
 *   explicit PUBLISHED promotion.
 *
 * Usage:
 *   import { adaptLegacyDefinition } from '@/lib/diagnostics/legacy-adapter';
 *   const result = adaptLegacyDefinition(MATHS_PREMIERE_P2);
 *   if (result.warnings.length > 0) console.warn(result.warnings);
 *   const def = result.definition;
 */

import type { DiagnosticDefinition } from './types';
import type { AssessmentDefinition, CurriculumBinding } from './assessment-definition';
import type { CurriculumSubject, CurriculumLevel, CurriculumTrack, CurriculumSubjectVariant, AcademicYear } from '@/lib/curriculum/schemas/curriculum';

// ─── Curriculum binding lookup table ────────────────────────────────────────

/**
 * Static mapping from legacy (track + level) to canonical curriculum binding.
 * Academic year 2026-2027 is used as the default resolution year.
 *
 * Keys: `${legacyTrack}:${legacyLevel}`
 */
const LEGACY_CURRICULUM_BINDING: Record<string, CurriculumBinding> = {
  'maths:premiere': {
    prerequisiteCurriculumId: 'fr-maths-seconde-gt-2019',
    targetCurriculumId: 'fr-maths-premiere-speciality-2026',
    academicYear: '2026-2027' as AcademicYear,
    subject: 'MATHEMATICS' as CurriculumSubject,
    currentLevel: 'SECONDE' as CurriculumLevel,
    targetLevel: 'PREMIERE' as CurriculumLevel,
    track: 'GENERAL' as CurriculumTrack,
    subjectVariant: 'SPECIALITY' as CurriculumSubjectVariant,
  },
  'maths:terminale': {
    prerequisiteCurriculumId: 'fr-maths-premiere-speciality-2019',
    targetCurriculumId: 'fr-maths-terminale-speciality-2019',
    academicYear: '2026-2027' as AcademicYear,
    subject: 'MATHEMATICS' as CurriculumSubject,
    currentLevel: 'PREMIERE' as CurriculumLevel,
    targetLevel: 'TERMINALE' as CurriculumLevel,
    track: 'GENERAL' as CurriculumTrack,
    subjectVariant: 'SPECIALITY' as CurriculumSubjectVariant,
    examSession: 2027,
  },
  'nsi:premiere': {
    prerequisiteCurriculumId: 'fr-snt-seconde-gt-2019',
    targetCurriculumId: 'fr-nsi-premiere-speciality-2019',
    academicYear: '2026-2027' as AcademicYear,
    subject: 'NSI' as CurriculumSubject,
    currentLevel: 'SECONDE' as CurriculumLevel,
    targetLevel: 'PREMIERE' as CurriculumLevel,
    track: 'GENERAL' as CurriculumTrack,
    subjectVariant: 'SPECIALITY' as CurriculumSubjectVariant,
  },
  'nsi:terminale': {
    prerequisiteCurriculumId: 'fr-nsi-premiere-speciality-2019',
    targetCurriculumId: 'fr-nsi-terminale-speciality-2020',
    academicYear: '2026-2027' as AcademicYear,
    subject: 'NSI' as CurriculumSubject,
    currentLevel: 'PREMIERE' as CurriculumLevel,
    targetLevel: 'TERMINALE' as CurriculumLevel,
    track: 'GENERAL' as CurriculumTrack,
    subjectVariant: 'SPECIALITY' as CurriculumSubjectVariant,
    examSession: 2027,
  },
};

// ─── Adapter result type ─────────────────────────────────────────────────────

export interface AdapterResult {
  /** The adapted definition (always present, even with warnings) */
  definition: AssessmentDefinition;
  /** Human-readable warnings that require review before PUBLISHED promotion */
  warnings: string[];
}

// ─── Main adapter function ───────────────────────────────────────────────────

/**
 * Adapt a legacy DiagnosticDefinition to the canonical AssessmentDefinition.
 *
 * The returned definition always has status="DRAFT" regardless of the
 * source status — it must be explicitly promoted to PUBLISHED after review.
 */
export function adaptLegacyDefinition(legacy: DiagnosticDefinition): AdapterResult {
  const warnings: string[] = [];
  const bindingKey = `${legacy.track}:${legacy.level}`;
  const binding = LEGACY_CURRICULUM_BINDING[bindingKey];

  if (!binding) {
    warnings.push(
      `No curriculum binding found for track="${legacy.track}" level="${legacy.level}". ` +
      `Placeholder curriculum IDs used. Review LEGACY_CURRICULUM_BINDING table before publishing.`,
    );
  }

  const curriculumBinding: CurriculumBinding = binding ? { ...binding } : {
    prerequisiteCurriculumId: `UNKNOWN:${legacy.track}:${legacy.level}:prerequisite`,
    targetCurriculumId: `UNKNOWN:${legacy.track}:${legacy.level}:target`,
    academicYear: '2026-2027' as AcademicYear,
    subject: 'MATHEMATICS' as CurriculumSubject,
    currentLevel: 'SECONDE' as CurriculumLevel,
    targetLevel: 'PREMIERE' as CurriculumLevel,
    track: 'GENERAL' as CurriculumTrack,
    subjectVariant: 'COMMON' as CurriculumSubjectVariant,
  };

  // Build a deterministic ID: legacy key + academic year
  const id = `${legacy.key}-adapted-2026`;

  // Validate domain weight coverage
  const legacyDomains = new Set(Object.keys(legacy.skills));
  const weightedDomains = new Set(Object.keys(legacy.scoringPolicy.domainWeights));

  for (const domain of legacyDomains) {
    if (!weightedDomains.has(domain)) {
      warnings.push(`Domain "${domain}" has skills but is not in scoringPolicy.domainWeights.`);
    }
  }
  for (const domain of weightedDomains) {
    if (!legacyDomains.has(domain)) {
      warnings.push(`Domain "${domain}" is weighted but has no skills defined.`);
    }
  }

  // Only include weighted domains that also have skills (symmetric intersection)
  const validDomains = [...legacyDomains].filter((d) => weightedDomains.has(d));
  const cleanedSkills = Object.fromEntries(
    validDomains.map((d) => [d, legacy.skills[d]]),
  );
  const cleanedWeights = Object.fromEntries(
    validDomains.map((d) => [d, legacy.scoringPolicy.domainWeights[d]]),
  );

  const definition: AssessmentDefinition = {
    id,
    version: legacy.version,
    label: legacy.label,
    status: 'DRAFT',
    curriculumBinding,
    skills: cleanedSkills,
    chapters: legacy.chapters,
    scoringPolicy: {
      domainWeights: cleanedWeights,
      thresholds: legacy.scoringPolicy.thresholds,
    },
    prompts: {
      version: legacy.prompts.version,
      eleve: legacy.prompts.eleve,
      parents: legacy.prompts.parents,
      nexus: legacy.prompts.nexus,
    },
    ragPolicy: {
      collections: legacy.ragPolicy.collections,
      maxQueries: legacy.ragPolicy.maxQueries,
      topK: legacy.ragPolicy.topK,
    },
    ...(legacy.examFormat ? { examFormat: legacy.examFormat } : {}),
    ...(legacy.riskModel ? { riskModel: legacy.riskModel } : {}),
  };

  return { definition, warnings };
}

/**
 * Adapt multiple legacy definitions, returning only those without critical warnings.
 * Definitions with UNKNOWN curriculum IDs are excluded and logged.
 */
export function adaptLegacyDefinitions(
  legacyDefs: DiagnosticDefinition[],
): { results: AdapterResult[]; skipped: string[] } {
  const results: AdapterResult[] = [];
  const skipped: string[] = [];

  for (const legacy of legacyDefs) {
    const result = adaptLegacyDefinition(legacy);
    const { prerequisiteCurriculumId, targetCurriculumId } =
      result.definition.curriculumBinding;
    const hasUnknownCurriculumBinding = [
      prerequisiteCurriculumId,
      targetCurriculumId,
    ].some((curriculumId) => curriculumId.startsWith('UNKNOWN:'));

    if (hasUnknownCurriculumBinding) {
      skipped.push(legacy.key);
    } else {
      results.push(result);
    }
  }

  return { results, skipped };
}
