/**
 * Production RAG academic identity resolver (P0-ARIA-01).
 *
 * Counterpart to `disposable-academic-identity.ts`, which is E2E-only and
 * gated by `E2E_DISPOSABLE_STACK=1`. This module NEVER reads any E2E-fixture
 * environment variable (the ones prefixed for that disposable resolver) and
 * NEVER activates while `E2E_DISPOSABLE_STACK=1` — the two resolvers are
 * hermetically separated by construction, not by convention.
 *
 * Every dimension below is derived exclusively from server-side truth already
 * established before this module runs:
 *   - `niveau` / `voie`   : `Student.gradeLevel` / `Student.academicTrack`
 *                           (Academic Map, onboarding/admin-verified).
 *   - `matiere` / `statutEnseignement` : the requested `courseKey`'s curriculum
 *                           catalogue entry (`programmeSelector`), which is
 *                           only reachable once `academicallyRelevant` has
 *                           already been proven for this exact student.
 *   - `schoolYear`        : `plan.academicYear`, sourced from the imported RAG
 *                           servable-corpus manifest itself — never invented.
 *   - `candidat`          : asserted as `'scolarise'` ONLY when the course is
 *                           backed by a real `StudentAcademicEnrollment` row
 *                           written by ADMIN/ASSISTANTE/SEED — never
 *                           client-forgeable, AND never a
 *                           `BACKFILL_LEGACY_SPECIALTIES` row: that source is
 *                           an inference made by a one-off migration script,
 *                           not a staff member asserting the fact, so it does
 *                           not meet the "verified" bar this claim requires.
 *                           A merely `DERIVED` (grade+track-implied, e.g.
 *                           tronc commun) course never asserts `scolarise`
 *                           either: that would be a real per-student claim
 *                           without a verified record behind it.
 *   - `statusDetail`      : the RAG contract's own documented default
 *                           (`'unknown'`), never invented business detail.
 *
 * ── Known, documented gap: `audience` ────────────────────────────────────
 * The RAG contract's `Audience` enum is `['libre','aefe','tous']`
 * (`data/aria/generated/rag-contracts/v1/retrieval-scope-artifact-v3.json`).
 * Nexus has no operational source of truth distinguishing an "aefe" vs
 * "libre" audience segment per student: `lib/pricing.ts`'s
 * `getOffersByAudience`/`getOffersByLevelAndAudience` model the concept in
 * `data/pricing.canonical.json` but have zero callers anywhere in the
 * product (verified by repo-wide grep). Per the ARIA-B.1 remediation
 * mandate ("si le contrat RAG exige une dimension que Nexus ne peut
 * raisonnablement connaître, arrête ce sous-lot et documente"), this
 * resolver deliberately returns `null` (fails closed) rather than invent an
 * audience value. Closing this requires either a Nexus-side product/data
 * decision (a verified per-student/per-family audience field) or a RAG-side
 * contract change — tracked in `docs/architecture/ARIA_V1.md` and the
 * ARIA-B.1 report. `hasChat`/`getCourseCapabilities()` are therefore left
 * unchanged by this module: production grounded chat stays honestly
 * unavailable until that gap closes, never faked green.
 */

import { createHmac } from 'node:crypto';
import type { AcademicTrack, GradeLevel } from '@prisma/client';
import { getCourse } from '@/lib/curriculum/catalog';
import type { AriaResolvedRagStudentIdentity } from '../../rag';

type JsonRecord = Readonly<Record<string, unknown>>;

interface EnrollmentRecordLike {
  readonly courseKey: string;
  readonly kind: 'SPECIALTY' | 'OPTION';
  readonly source: 'ADMIN' | 'ASSISTANTE' | 'SEED' | 'BACKFILL_LEGACY_SPECIALTIES';
}

interface ProductionAcademicVocabulary {
  readonly niveau: string;
  readonly voie: string;
  readonly matiere: string;
  readonly statutEnseignement: string;
}

/** `Student.gradeLevel` → RAG contract `Niveau` enum. Unmapped ⇒ fail closed. */
const NIVEAU_BY_GRADE_LEVEL: Readonly<Partial<Record<GradeLevel, string>>> = Object.freeze({
  QUATRIEME: 'quatrieme',
  TROISIEME: 'troisieme',
  SECONDE: 'seconde',
  PREMIERE: 'premiere',
  TERMINALE: 'terminale',
  // POSTBAC and AUTRE have no defensible RAG `Niveau` mapping today.
});

/** `Student.academicTrack` → RAG contract `Voie` enum. Unmapped ⇒ fail closed. */
const VOIE_BY_ACADEMIC_TRACK: Readonly<Partial<Record<AcademicTrack, string>>> = Object.freeze({
  COLLEGE: 'college',
  EDS_GENERALE: 'generale',
  STMG: 'technologique',
  STI2D: 'technologique',
  ST2S: 'technologique',
  STL: 'technologique',
  STD2A: 'technologique',
  // STMG_NON_LYCEEN is intentionally unmapped: not confidently representable
  // in the RAG `Voie` enum today, and not required by any live chat corpus.
});

/** Curriculum catalogue `programmeSelector.subject` → RAG contract `matiere`. */
const MATIERE_BY_SUBJECT: Readonly<Record<string, string>> = Object.freeze({
  MATHEMATICS: 'mathematiques',
  NSI: 'nsi',
  FRENCH: 'francais',
});

/** Curriculum catalogue `programmeSelector.subjectVariant` → RAG `statut_enseignement`. */
const STATUT_ENSEIGNEMENT_BY_VARIANT: Readonly<Record<string, string>> = Object.freeze({
  SPECIALITY: 'specialite',
  COMMON: 'tronc_commun',
});

/**
 * Deterministically derives {niveau, voie, matiere, statutEnseignement} for
 * one (gradeLevel, academicTrack, courseKey) triple, from server-side
 * curriculum/enum truth only. Returns `null` (fail closed) whenever any
 * dimension cannot be confidently mapped — never a best-effort guess.
 */
export function resolveProductionAcademicVocabulary(input: {
  readonly gradeLevel: GradeLevel;
  readonly academicTrack: AcademicTrack;
  readonly courseKey: string;
}): ProductionAcademicVocabulary | null {
  const niveau = NIVEAU_BY_GRADE_LEVEL[input.gradeLevel];
  const voie = VOIE_BY_ACADEMIC_TRACK[input.academicTrack];
  if (!niveau || !voie) return null;

  const course = getCourse(input.courseKey);
  const selector = course?.programmeSelector;
  if (!selector) return null;

  // The course's own declared grade/track must agree with the resolved
  // vocabulary: this is a consistency guard, not a second source of truth —
  // `academicallyRelevant` already proved the student's grade/track matches
  // this course before this function is ever reachable.
  if (course.gradeLevel !== input.gradeLevel || !course.tracks.includes(input.academicTrack)) {
    return null;
  }

  const matiere = MATIERE_BY_SUBJECT[selector.subject];
  const statutEnseignement = STATUT_ENSEIGNEMENT_BY_VARIANT[selector.subjectVariant];
  if (!matiere || !statutEnseignement) return null;

  return Object.freeze({ niveau, voie, matiere, statutEnseignement });
}

/**
 * Asserts `candidat: 'scolarise'` only when `courseKey` is backed by a real
 * `StudentAcademicEnrollment` row (never for a merely grade/track-`DERIVED`
 * course, e.g. tronc commun) — see module docstring.
 */
export function resolveProductionCandidateStatus(
  student: {
    readonly gradeLevel: GradeLevel;
    readonly academicTrack: AcademicTrack;
    readonly academicEnrollments?: readonly EnrollmentRecordLike[];
  },
  courseKey: string,
): 'scolarise' | null {
  const enrolled = (student.academicEnrollments ?? []).some(
    (enrollment) => enrollment.courseKey === courseKey
      && enrollment.source !== 'BACKFILL_LEGACY_SPECIALTIES',
  );
  return enrolled ? 'scolarise' : null;
}

/** Deterministic, non-reversible, production-dedicated pseudonym. */
export function resolveProductionAriaRagPseudonym(studentId: string, signingKey: string): string {
  const digest = createHmac('sha256', signingKey)
    .update(`aria-prod-student:${studentId}`, 'utf8')
    .digest('hex')
    .slice(0, 32);
  return `psn_${digest}`;
}

function isProductionAriaRagIdentityBaseConfigured(
  environment: Readonly<Record<string, string | undefined>>,
): boolean {
  return environment.E2E_DISPOSABLE_STACK !== '1'
    && Buffer.byteLength(environment.NEXUS_INTERNAL_TOKEN_SECRET ?? '', 'utf8') >= 32;
}

export function resolveProductionAriaRagIdentity(input: {
  readonly context: {
    readonly courseKey: string;
    readonly subject: { readonly studentId: string };
    readonly student: {
      readonly gradeLevel: GradeLevel;
      readonly academicTrack: AcademicTrack;
      readonly academicEnrollments?: readonly EnrollmentRecordLike[];
    };
  };
  readonly plan: {
    readonly courseKey: string;
    readonly academicYear: string;
    readonly retrievalScope: JsonRecord;
  };
  readonly environment?: Readonly<Record<string, string | undefined>>;
}): AriaResolvedRagStudentIdentity | null {
  const environment = input.environment ?? process.env;
  if (!isProductionAriaRagIdentityBaseConfigured(environment)) return null;
  if (input.context.courseKey !== input.plan.courseKey) return null;

  const vocabulary = resolveProductionAcademicVocabulary({
    gradeLevel: input.context.student.gradeLevel,
    academicTrack: input.context.student.academicTrack,
    courseKey: input.context.courseKey,
  });
  if (!vocabulary) return null;

  const candidat = resolveProductionCandidateStatus(input.context.student, input.context.courseKey);
  if (!candidat) return null;

  const schoolYear = input.plan.academicYear;
  if (!schoolYear) return null;

  // ── Known, documented gap: no Nexus SSoT for `audience` today ──────────
  // See module docstring. Every other dimension above is real and correct;
  // this single, explicit stop condition keeps the whole resolver fail
  // closed rather than fabricate the one value Nexus cannot honestly know.
  return null;
}
