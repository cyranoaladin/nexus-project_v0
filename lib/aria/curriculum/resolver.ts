/**
 * ARIA Curriculum Resolver — dérivation de la carte scolaire d'un élève.
 *
 * Fonction PURE et isomorphe : aucune lecture Prisma, aucun accès disque,
 * aucun import `server-only`. Les composants React n'appellent jamais Prisma ;
 * ils consomment la projection produite ici.
 *
 * La carte est dérivée exclusivement de `Student` (SSoT scolaire) :
 * gradeLevel × academicTrack × specialties × stmgPathway. Le profil ARIA
 * n'apporte que la SÉLECTION de l'élève, jamais la vérité scolaire.
 */

import type { AcademicTrack, GradeLevel, StmgPathway, Subject } from '@prisma/client';
import type {
  AriaAcademicProfileDTO,
  AriaCourse,
  AriaCourseKey,
  AriaCourseProjection,
  AriaCourseView,
  AriaCurriculumDTO,
} from '@/lib/aria/contracts';
import { ARIA_CURRICULUM_VERSION } from '@/lib/aria/contracts';
import { listCoursesForGradeAndTrack } from './catalog';

export interface ResolveAriaCurriculumInput {
  readonly gradeLevel: GradeLevel | null;
  readonly academicTrack: AcademicTrack | null;
  readonly specialties: readonly Subject[];
  readonly stmgPathway: StmgPathway | null;
  readonly school?: string | null;
  /** Clés retenues par l'élève dans son cockpit (profil ARIA). */
  readonly selectedCourseKeys: readonly AriaCourseKey[];
  /** Feature keys d'entitlement ACTIVES de l'élève (ex. ['aria_maths']). */
  readonly entitlements: readonly string[];
}

/** Champs de `Student` indispensables pour dériver la carte. */
const REQUIRED_ACADEMIC_FIELDS = ['gradeLevel', 'academicTrack'] as const;

/** Projection sûre d'un cours : rien qui ressemble à un chemin ou un secret. */
export function projectCourse(course: AriaCourse): AriaCourseProjection {
  return {
    key: course.key,
    label: course.label,
    shortLabel: course.shortLabel,
    gradeLevel: course.gradeLevel,
    role: course.role,
    chatSubject: course.chatSubject,
    support: course.support.level,
    capabilities: course.support.capabilities,
    provenance: course.support.provenance,
    supportNote: course.support.note,
    hasSkillGraph: course.definitionKey !== null,
  };
}

/** Analyse la complétude du profil scolaire porté par `Student`. */
export function buildAcademicProfile(
  input: Pick<
    ResolveAriaCurriculumInput,
    'gradeLevel' | 'academicTrack' | 'specialties' | 'stmgPathway' | 'school'
  >,
): AriaAcademicProfileDTO {
  const missingFields: string[] = [];
  for (const field of REQUIRED_ACADEMIC_FIELDS) {
    if (input[field] === null || input[field] === undefined) missingFields.push(field);
  }

  // Le parcours STMG conditionne les modules de Terminale : son absence rend
  // la carte incomplète pour une Terminale STMG, mais pas ailleurs.
  const isStmg =
    input.academicTrack === 'STMG' || input.academicTrack === 'STMG_NON_LYCEEN';
  if (isStmg && input.gradeLevel === 'TERMINALE' && !input.stmgPathway) {
    missingFields.push('stmgPathway');
  }

  // Une Première/Terminale générale sans spécialité déclarée ne peut pas
  // produire de carte utile : on le dit plutôt que d'afficher une carte creuse.
  const isGeneraleLycee =
    input.academicTrack === 'EDS_GENERALE' &&
    (input.gradeLevel === 'PREMIERE' || input.gradeLevel === 'TERMINALE');
  if (isGeneraleLycee && input.specialties.length === 0) {
    missingFields.push('specialties');
  }

  return {
    gradeLevel: input.gradeLevel,
    academicTrack: input.academicTrack,
    specialties: [...input.specialties],
    stmgPathway: input.stmgPathway,
    school: input.school ?? null,
    incomplete: missingFields.length > 0,
    missingFields,
  };
}

/**
 * Un cours est-il académiquement pertinent pour cet élève ?
 *
 * - CORE / TRACK_MODULE : oui, dès lors que (niveau × voie) correspond.
 * - SPECIALTY           : seulement si la spécialité figure dans `Student.specialties`.
 * - TRACK_MODULE avec parcours STMG : seulement si le parcours correspond.
 * - OPTION              : indéterminable — `Student` ne porte aucun champ
 *                         « options ». On ne l'affirme donc que si l'élève l'a
 *                         explicitement retenue dans son cockpit.
 */
function isAcademicallyRelevant(
  course: AriaCourse,
  input: ResolveAriaCurriculumInput,
  selected: ReadonlySet<AriaCourseKey>,
): boolean {
  if (course.stmgPathways && course.stmgPathways.length > 0) {
    if (!input.stmgPathway) return false;
    if (!course.stmgPathways.includes(input.stmgPathway)) return false;
  }

  switch (course.role) {
    case 'SPECIALTY':
      return course.specialty !== undefined && input.specialties.includes(course.specialty);
    case 'OPTION':
      return selected.has(course.key);
    case 'CORE':
    case 'TRACK_MODULE':
      return true;
    default:
      return false;
  }
}

/**
 * Dérive la carte scolaire complète et les états d'accès.
 *
 * Ne lève jamais. Un profil incomplet produit une carte vide explicitement
 * signalée, pas une exception ni des données inventées.
 */
export function resolveAriaCurriculum(input: ResolveAriaCurriculumInput): AriaCurriculumDTO {
  const academicProfile = buildAcademicProfile(input);
  const selected = new Set(input.selectedCourseKeys);
  const entitlements = new Set(input.entitlements);

  if (!input.gradeLevel || !input.academicTrack) {
    return {
      version: ARIA_CURRICULUM_VERSION,
      academicProfile,
      courses: [],
      requiredCourseKeys: [],
      selectedCourseKeys: [],
      availableCourseKeys: [],
      lockedCourseKeys: [],
      unsupportedCourseKeys: [],
    };
  }

  const candidates = listCoursesForGradeAndTrack(input.gradeLevel, input.academicTrack);

  const courses: AriaCourseView[] = [];
  const requiredCourseKeys: AriaCourseKey[] = [];
  const selectedCourseKeys: AriaCourseKey[] = [];
  const availableCourseKeys: AriaCourseKey[] = [];
  const lockedCourseKeys: AriaCourseKey[] = [];
  const unsupportedCourseKeys: AriaCourseKey[] = [];

  for (const course of candidates) {
    // Un parcours STMG non concerné n'est même pas montré : ce n'est pas une
    // matière « verrouillée », elle n'appartient simplement pas à la scolarité.
    if (course.stmgPathways && course.stmgPathways.length > 0) {
      if (!input.stmgPathway || !course.stmgPathways.includes(input.stmgPathway)) continue;
    }
    // Une spécialité non suivie ne fait pas partie de la carte de l'élève.
    if (course.role === 'SPECIALTY') {
      if (!course.specialty || !input.specialties.includes(course.specialty)) continue;
    }

    const academicallyRelevant = isAcademicallyRelevant(course, input, selected);
    const productSupported = course.support.level !== 'COMING_SOON';
    const commerciallyEntitled = entitlements.has(course.requiredFeature);
    const selectedForAria = selected.has(course.key);

    courses.push({
      course: projectCourse(course),
      access: {
        academicallyRelevant,
        productSupported,
        commerciallyEntitled,
        selectedForAria,
      },
    });

    if (academicallyRelevant && course.role !== 'OPTION') {
      requiredCourseKeys.push(course.key);
    }
    if (selectedForAria) selectedCourseKeys.push(course.key);

    if (!productSupported) {
      unsupportedCourseKeys.push(course.key);
    } else if (commerciallyEntitled) {
      availableCourseKeys.push(course.key);
    } else {
      lockedCourseKeys.push(course.key);
    }
  }

  return {
    version: ARIA_CURRICULUM_VERSION,
    academicProfile,
    courses,
    requiredCourseKeys,
    selectedCourseKeys,
    availableCourseKeys,
    lockedCourseKeys,
    unsupportedCourseKeys,
  };
}

/**
 * Clés de cours réellement sélectionnables par cet élève.
 *
 * Utilisé par le service de profil pour rejeter toute clé qui serait connue du
 * catalogue mais incohérente avec la scolarité de l'élève (ex. un module STMG
 * demandé par un élève de Terminale générale).
 */
export function listSelectableCourseKeys(
  input: Omit<ResolveAriaCurriculumInput, 'selectedCourseKeys' | 'entitlements'>,
): readonly AriaCourseKey[] {
  if (!input.gradeLevel || !input.academicTrack) return [];

  return listCoursesForGradeAndTrack(input.gradeLevel, input.academicTrack)
    .filter((course) => {
      if (course.stmgPathways && course.stmgPathways.length > 0) {
        if (!input.stmgPathway) return false;
        if (!course.stmgPathways.includes(input.stmgPathway)) return false;
      }
      if (course.role === 'SPECIALTY') {
        return course.specialty !== undefined && input.specialties.includes(course.specialty);
      }
      return true;
    })
    .map((course) => course.key);
}
