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
 *   - `audience`          : see `resolveProductionAriaRagAudience()` below —
 *                           derived from the corpus's OWN manifest-declared
 *                           `target_policy.audiences`, never a Nexus-side
 *                           per-student field (none exists — verified
 *                           exhaustively, see that function's docstring).
 *   - `zone`              : a fixed platform-wide constant — see
 *                           `PRODUCTION_ARIA_RAG_ZONE` below.
 *
 * ── `audience`: exhaustively researched, closed WITHOUT a Nexus SSoT ─────
 * The RAG contract's `Audience` enum is `['libre','aefe','tous']`
 * (`data/aria/generated/rag-contracts/v1/retrieval-scope-artifact-v3.json`).
 * Nexus has no operational source of truth distinguishing an "aefe" vs
 * "libre" audience segment per student — verified exhaustively across the
 * whole repo before writing a single line here: no Prisma field, enum, or
 * role encodes it (`UserRole` is `ADMIN|ASSISTANTE|COACH|PARENT|ELEVE`,
 * full stop — no `ELEVE_CANDIDAT_LIBRE`); `StudentAcademicEnrollment`/the
 * Academic Map encode *what a student studies*, never *which population
 * they belong to*; no `School`/`Etablissement` model exists, and
 * `Student.school` is unvalidated free text; every onboarding/admin-edit
 * surface (parent add-child, assistante create/edit) captures only
 * `gradeLevel`/`academicTrack`/free-text `school`; `lib/pricing.ts`'s
 * `getOffersByAudience`/`getOffersByLevelAndAudience` model a catalogue-level
 * `audience` on `data/pricing.canonical.json` offers but have zero callers
 * anywhere in the product (verified by repo-wide grep) — pure catalogue
 * data never linked to a real student.
 *
 * Rather than invent a field the analysis above shows isn't justified,
 * `resolveProductionAriaRagAudience()` reuses data ALREADY present on the
 * corpus's own promoted, cryptographically-hashed manifest: when
 * `plan.retrievalScope.target_policy.audiences` names exactly one audience
 * (a mono-population corpus, matching the business's own already-decided
 * single-population pilot scope — see `docs/roadmaps/RAG_PLATFORM_ROADMAP.md`),
 * that is not a guess: `identityMatchesPlan()` (`lib/aria/rag.ts`) already
 * hard-requires `target_policy.audiences.includes(identity.audience)`
 * before any request builds at all, so it is the ONLY value that could
 * ever satisfy that pre-existing gate for this corpus. A corpus declaring
 * several audiences remains genuinely ambiguous per-student and still
 * fails closed — this is a real, permanent stop condition for that case,
 * not a placeholder. This was a considered architectural choice presented
 * before implementation, not applied unilaterally — see the ARIA-B.1
 * closure report and `docs/architecture/ARIA_V1.md`.
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
export const NIVEAU_BY_GRADE_LEVEL: Readonly<Partial<Record<GradeLevel, string>>> = Object.freeze({
  QUATRIEME: 'quatrieme',
  TROISIEME: 'troisieme',
  SECONDE: 'seconde',
  PREMIERE: 'premiere',
  TERMINALE: 'terminale',
  // POSTBAC and AUTRE have no defensible RAG `Niveau` mapping today.
});

/** `Student.academicTrack` → RAG contract `Voie` enum. Unmapped ⇒ fail closed. */
export const VOIE_BY_ACADEMIC_TRACK: Readonly<Partial<Record<AcademicTrack, string>>> = Object.freeze({
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
export const MATIERE_BY_SUBJECT: Readonly<Record<string, string>> = Object.freeze({
  MATHEMATICS: 'mathematiques',
  NSI: 'nsi',
  FRENCH: 'francais',
});

/** Curriculum catalogue `programmeSelector.subjectVariant` → RAG `statut_enseignement`. */
export const STATUT_ENSEIGNEMENT_BY_VARIANT: Readonly<Record<string, string>> = Object.freeze({
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

export function isProductionAriaRagIdentityBaseConfigured(
  environment: Readonly<Record<string, string | undefined>>,
): boolean {
  return environment.E2E_DISPOSABLE_STACK !== '1'
    && Buffer.byteLength(environment.NEXUS_INTERNAL_TOKEN_SECRET ?? '', 'utf8') >= 32;
}

/**
 * The population(s) Nexus currently sells ARIA-eligible commercial
 * entitlements for. A DEPLOYMENT-level declaration, never a per-student
 * field.
 *
 * Cubic P1 (confidence 8): a mono-audience corpus's own
 * `target_policy.audiences` proves what population the CORPUS was built
 * for — it does NOT prove which population a SPECIFIC requesting student
 * belongs to. Nexus's curriculum catalogue is shared academic content
 * (the same `courseKey` can legitimately be followed by both an
 * AEFE-enrolled student and a candidat-libre student); if Nexus ever
 * serves both populations through course keys that can resolve to
 * DIFFERENT population-specific corpora, blindly echoing "the corpus's
 * sole declared audience" as a specific student's own identity would be a
 * FALSE claim for a student whose real population differs from the
 * corpus's.
 *
 * Requiring the corpus's declared audience to ALSO be a member of this
 * explicit, Nexus-controlled scope closes that gap without inventing
 * per-student data: as long as Nexus has not commercially onboarded a
 * second population that could share a courseKey with an already-served
 * one, no real student exists for whom this label could be wrong. This
 * constant is the single go/no-go checkpoint: it — and this whole safety
 * property — MUST be re-verified before Nexus ever sells ARIA access to a
 * second population. Today Nexus's only decided, live ARIA pilot
 * population is candidat libre (`docs/roadmaps/RAG_PLATFORM_ROADMAP.md`).
 */
const NEXUS_CURRENT_ARIA_COMMERCIAL_AUDIENCE_SCOPE: readonly string[] = ['libre'];

/**
 * `audience` (RAG contract `enum ['libre','aefe','tous']`) — closes the
 * ARIA-B.1 go-live gap WITHOUT inventing a Nexus-side per-student field.
 *
 * Nexus has no per-student source of truth for AEFE-vs-libre membership
 * (verified exhaustively: no schema field, no role, no onboarding form
 * captures it; `lib/pricing.ts`'s `audience` concept has zero callers —
 * see module docstring). But `identityMatchesPlan()` (`lib/aria/rag.ts`)
 * ALREADY hard-requires `target_policy.audiences.includes(identity.audience)`
 * before any request can be built at all. When a corpus's own promoted,
 * cryptographically-hashed manifest (`plan.retrievalScope.target_policy.audiences`
 * — the SAME trust tier as `schoolYear`/`plan.academicYear`, never invented
 * by this resolver) declares EXACTLY ONE audience, AND that audience is
 * within Nexus's own currently-declared commercial scope
 * (`NEXUS_CURRENT_ARIA_COMMERCIAL_AUDIENCE_SCOPE` — see its docstring for
 * why this second check is required), that value is not a guess: no real
 * student exists today for whom it could be wrong. A corpus declaring
 * SEVERAL specific audiences (e.g. `['aefe','libre']`), or a single
 * audience OUTSIDE Nexus's current commercial scope, is genuinely
 * ambiguous/unverifiable for a PER-STUDENT identity claim — this still
 * fails closed. `['tous']` alone is different: it is the corpus's own
 * explicit "serves every audience, no exclusive-population claim"
 * declaration, so it never asserts something that could be false for any
 * student and resolves unconditionally.
 */
export function resolveProductionAriaRagAudience(retrievalScope: JsonRecord): string | null {
  const targetPolicy = retrievalScope.target_policy;
  if (typeof targetPolicy !== 'object' || targetPolicy === null || Array.isArray(targetPolicy)) return null;
  const audiences = (targetPolicy as JsonRecord).audiences;
  if (!Array.isArray(audiences) || audiences.length !== 1) return null;
  const [audience] = audiences;
  if (typeof audience !== 'string' || audience.length === 0) return null;
  if (audience === 'tous') return audience;
  return NEXUS_CURRENT_ARIA_COMMERCIAL_AUDIENCE_SCOPE.includes(audience) ? audience : null;
}

/**
 * `zone` (RAG contract `StudentProfile.zone`, required, freeform,
 * `identityMatchesPlan()` does not validate it against the manifest).
 * Nexus Réussite currently operates as a single-zone platform: its OWN
 * unconditional system prompt for every ARIA conversation, with zero
 * per-student branching, already asserts "les élèves du système français
 * en Tunisie" (`lib/aria/kernel/global-safety-policy.ts`,
 * `GLOBAL_ARIA_SAFETY_POLICY`). Unlike `audience`, this does not vary per
 * student today — surfacing that already-established, platform-wide fact
 * here is not inventing a new one.
 */
const PRODUCTION_ARIA_RAG_ZONE = 'TN';

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

  const audience = resolveProductionAriaRagAudience(input.plan.retrievalScope);
  if (!audience) return null;

  return Object.freeze({
    pseudonymousSubject: resolveProductionAriaRagPseudonym(
      input.context.subject.studentId,
      environment.NEXUS_INTERNAL_TOKEN_SECRET!,
    ),
    niveau: vocabulary.niveau,
    voie: vocabulary.voie,
    matiere: vocabulary.matiere,
    statutEnseignement: vocabulary.statutEnseignement,
    candidat,
    audience,
    schoolYear,
    zone: PRODUCTION_ARIA_RAG_ZONE,
    statusDetail: 'unknown',
  });
}
