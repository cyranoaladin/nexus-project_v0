/**
 * ARIA Learning Profile Service.
 *
 * Seul point d'écriture du profil pédagogique ARIA.
 *
 * ── Interdits absolus (garantis par construction) ────────────────────────────
 * Ce service n'écrit QUE dans `aria_learning_profiles`. Il ne touche jamais :
 *   • `Subscription` (ni `ariaSubjects`, ni `ariaCost`, ni le plan) ;
 *   • les entitlements / feature keys ;
 *   • `Student` — donc jamais `gradeLevel`, `academicTrack`, `specialties`,
 *     `stmgPathway` ni `school`, qui restent la source de vérité scolaire.
 *
 * Aucune API self-service de modification du profil scolaire n'existe dans le
 * produit (seul `PATCH /api/admin/users`, réservé aux ADMIN, le permet). P0
 * n'en crée pas : le cockpit AFFICHE et CONFIRME le profil, il ne le change pas.
 */

import 'server-only';

import { z } from 'zod';
import type { AcademicTrack, GradeLevel, StmgPathway, Subject } from '@prisma/client';
import { prisma } from '@/lib/prisma';
import {
  ARIA_CURRICULUM_VERSION,
  ARIA_LEARNING_GOALS,
  ARIA_WEEKLY_GOAL_DEFAULT_MINUTES,
  ARIA_WEEKLY_GOAL_MAX_MINUTES,
  ARIA_WEEKLY_GOAL_MIN_MINUTES,
  type AriaCockpitPanel,
  type AriaLearningGoal,
  type AriaLearningProfileDTO,
  type AriaPreferencesDTO,
} from '@/lib/aria/contracts';
import { isKnownAriaCourseKey } from '@/lib/aria/curriculum/catalog';
import { listSelectableCourseKeys } from '@/lib/aria/curriculum/resolver';
import { isSupportedExamSession } from '@/lib/aria/curriculum/exam-context';

// ─── Schémas ─────────────────────────────────────────────────────────────────

/** Forme canonique d'une clé de cours : kebab-case ASCII, sans séparateur de chemin. */
const ARIA_COURSE_KEY_PATTERN = /^[a-z0-9]+(-[a-z0-9]+)*$/;

const COCKPIT_PANELS: readonly AriaCockpitPanel[] = [
  'TODAY',
  'CURRICULUM',
  'TRAJECTORY',
  'RESOURCES',
  'ASSESSMENTS',
  'ARIA',
];

const preferencesSchema = z
  .object({
    preferredCourseKey: z.string().min(1).max(120).regex(ARIA_COURSE_KEY_PATTERN).optional(),
    defaultPanel: z.enum(COCKPIT_PANELS as [AriaCockpitPanel, ...AriaCockpitPanel[]]).optional(),
  })
  .strict();

/**
 * Champs modifiables par l'élève. `.strict()` fait échouer toute clé non
 * listée : impossible d'injecter `studentId`, un entitlement ou un champ
 * scolaire par le corps de la requête.
 */
export const ariaProfileUpdateSchema = z
  .object({
    // Forme imposée dès la frontière HTTP : kebab-case ASCII strict. Une clé
    // malformée (chemin, séparateur, caractère d'échappement) est rejetée avant
    // même d'atteindre le catalogue — défense en profondeur.
    selectedCourseKeys: z
      .array(z.string().min(1).max(120).regex(ARIA_COURSE_KEY_PATTERN))
      .max(40)
      .optional(),
    weeklyGoalMinutes: z
      .number()
      .int()
      .min(ARIA_WEEKLY_GOAL_MIN_MINUTES)
      .max(ARIA_WEEKLY_GOAL_MAX_MINUTES)
      .optional(),
    learningGoals: z
      .array(z.enum(ARIA_LEARNING_GOALS))
      .max(ARIA_LEARNING_GOALS.length)
      .optional(),
    preferences: preferencesSchema.optional(),
    targetSession: z.number().int().min(2000).max(2100).nullable().optional(),
    /** Marque l'onboarding comme terminé. Ne peut jamais être remis à `false`. */
    completeOnboarding: z.boolean().optional(),
  })
  .strict();

export type AriaProfileUpdateInput = z.infer<typeof ariaProfileUpdateSchema>;

/** Contexte scolaire, fourni par l'appelant depuis `Student` (SSoT). */
export interface AriaProfileAcademicContext {
  readonly gradeLevel: GradeLevel | null;
  readonly academicTrack: AcademicTrack | null;
  readonly specialties: readonly Subject[];
  readonly stmgPathway: StmgPathway | null;
}

/** Erreur de validation métier, traduite en 400 par la route. */
export class AriaProfileValidationError extends Error {
  readonly issues: readonly string[];

  constructor(issues: readonly string[]) {
    super(`Profil ARIA invalide: ${issues.join('; ')}`);
    this.name = 'AriaProfileValidationError';
    this.issues = issues;
  }
}

// ─── Normalisation ───────────────────────────────────────────────────────────

function parseLearningGoals(raw: unknown): AriaLearningGoal[] {
  if (!Array.isArray(raw)) return [];
  const allowed = new Set<string>(ARIA_LEARNING_GOALS);
  const out: AriaLearningGoal[] = [];
  for (const value of raw) {
    if (typeof value === 'string' && allowed.has(value) && !out.includes(value as AriaLearningGoal)) {
      out.push(value as AriaLearningGoal);
    }
  }
  return out;
}

function parsePreferences(raw: unknown): AriaPreferencesDTO {
  const parsed = preferencesSchema.safeParse(raw);
  return parsed.success ? parsed.data : {};
}

function parseSelectedCourseKeys(raw: unknown): string[] {
  if (!Array.isArray(raw)) return [];
  // Une clé retirée du catalogue entre deux versions ne doit pas casser la
  // lecture : elle est simplement ignorée.
  return raw.filter(
    (value): value is string => typeof value === 'string' && isKnownAriaCourseKey(value),
  );
}

/** Profil par défaut d'un élève qui n'a jamais ouvert le cockpit. */
export function defaultAriaLearningProfile(): AriaLearningProfileDTO {
  return {
    targetSession: null,
    selectedCourseKeys: [],
    weeklyGoalMinutes: ARIA_WEEKLY_GOAL_DEFAULT_MINUTES,
    learningGoals: [],
    preferences: {},
    curriculumVersion: ARIA_CURRICULUM_VERSION,
    onboardingCompletedAt: null,
  };
}

interface ProfileRow {
  targetSession: number | null;
  selectedCourseKeys: string[];
  weeklyGoalMinutes: number;
  learningGoals: unknown;
  preferences: unknown;
  curriculumVersion: string;
  onboardingCompletedAt: Date | null;
}

function toDTO(row: ProfileRow): AriaLearningProfileDTO {
  return {
    targetSession: row.targetSession,
    selectedCourseKeys: parseSelectedCourseKeys(row.selectedCourseKeys),
    weeklyGoalMinutes: row.weeklyGoalMinutes,
    learningGoals: parseLearningGoals(row.learningGoals),
    preferences: parsePreferences(row.preferences),
    curriculumVersion: row.curriculumVersion,
    onboardingCompletedAt: row.onboardingCompletedAt?.toISOString() ?? null,
  };
}

// ─── Lecture ─────────────────────────────────────────────────────────────────

/**
 * Profil pédagogique ARIA d'un élève.
 *
 * Retourne le profil par défaut si aucune ligne n'existe : l'absence de profil
 * n'est pas une erreur, c'est l'état initial normal avant onboarding.
 */
export async function getAriaLearningProfile(studentId: string): Promise<AriaLearningProfileDTO> {
  const row = await prisma.ariaLearningProfile.findUnique({
    where: { studentId },
    select: {
      targetSession: true,
      selectedCourseKeys: true,
      weeklyGoalMinutes: true,
      learningGoals: true,
      preferences: true,
      curriculumVersion: true,
      onboardingCompletedAt: true,
    },
  });

  return row ? toDTO(row as ProfileRow) : defaultAriaLearningProfile();
}

// ─── Écriture ────────────────────────────────────────────────────────────────

/**
 * Crée ou met à jour le profil pédagogique ARIA.
 *
 * Valide la cohérence ACADÉMIQUE des cours retenus : une clé peut être connue
 * du catalogue tout en étant hors de la scolarité de l'élève (ex. un module
 * STMG demandé par un élève de Terminale générale) — elle est alors rejetée.
 *
 * @throws {AriaProfileValidationError} si une entrée est incohérente.
 */
export async function upsertAriaLearningProfile(
  studentId: string,
  input: AriaProfileUpdateInput,
  academicContext: AriaProfileAcademicContext,
): Promise<AriaLearningProfileDTO> {
  const issues: string[] = [];

  // ── Cours retenus ──────────────────────────────────────────────────────
  let selectedCourseKeys: string[] | undefined;
  if (input.selectedCourseKeys !== undefined) {
    const unique = [...new Set(input.selectedCourseKeys)];

    const unknown = unique.filter((key) => !isKnownAriaCourseKey(key));
    if (unknown.length > 0) {
      issues.push(`cours inconnus du catalogue: ${unknown.join(', ')}`);
    }

    const selectable = new Set(
      listSelectableCourseKeys({
        gradeLevel: academicContext.gradeLevel,
        academicTrack: academicContext.academicTrack,
        specialties: academicContext.specialties,
        stmgPathway: academicContext.stmgPathway,
        school: null,
      }),
    );
    const notApplicable = unique.filter((key) => isKnownAriaCourseKey(key) && !selectable.has(key));
    if (notApplicable.length > 0) {
      issues.push(`cours hors de la scolarité de l'élève: ${notApplicable.join(', ')}`);
    }

    selectedCourseKeys = unique;
  }

  // ── Session d'examen cible ─────────────────────────────────────────────
  let targetSession: number | null | undefined;
  if (input.targetSession !== undefined) {
    if (input.targetSession !== null && !isSupportedExamSession(input.targetSession)) {
      issues.push(`session d'examen non supportée: ${input.targetSession}`);
    }
    targetSession = input.targetSession;
  }

  if (issues.length > 0) throw new AriaProfileValidationError(issues);

  // ── Écriture (table ARIA uniquement) ───────────────────────────────────
  const now = new Date();
  const setOnboarding = input.completeOnboarding === true ? { onboardingCompletedAt: now } : {};

  const row = await prisma.ariaLearningProfile.upsert({
    where: { studentId },
    create: {
      studentId,
      targetSession: targetSession ?? null,
      selectedCourseKeys: selectedCourseKeys ?? [],
      weeklyGoalMinutes: input.weeklyGoalMinutes ?? ARIA_WEEKLY_GOAL_DEFAULT_MINUTES,
      learningGoals: input.learningGoals ?? [],
      preferences: input.preferences ?? {},
      curriculumVersion: ARIA_CURRICULUM_VERSION,
      ...setOnboarding,
    },
    update: {
      ...(targetSession !== undefined ? { targetSession } : {}),
      ...(selectedCourseKeys !== undefined ? { selectedCourseKeys } : {}),
      ...(input.weeklyGoalMinutes !== undefined
        ? { weeklyGoalMinutes: input.weeklyGoalMinutes }
        : {}),
      ...(input.learningGoals !== undefined ? { learningGoals: input.learningGoals } : {}),
      ...(input.preferences !== undefined ? { preferences: input.preferences } : {}),
      curriculumVersion: ARIA_CURRICULUM_VERSION,
      ...setOnboarding,
    },
    select: {
      targetSession: true,
      selectedCourseKeys: true,
      weeklyGoalMinutes: true,
      learningGoals: true,
      preferences: true,
      curriculumVersion: true,
      onboardingCompletedAt: true,
    },
  });

  return toDTO(row as ProfileRow);
}
