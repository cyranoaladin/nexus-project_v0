/**
 * ARIA Cockpit Builder.
 *
 * ── Règle de réutilisation ───────────────────────────────────────────────────
 * Le cockpit ne duplique PAS la logique du dashboard élève. Il consomme
 * `buildStudentDashboardPayload()` (≈8 requêtes, déjà parallélisées) et n'ajoute
 * qu'UNE seule requête : la lecture du profil pédagogique ARIA. Total ≈ 9
 * requêtes, sans N+1.
 *
 * ── Règle anti-fake (§32) ────────────────────────────────────────────────────
 * Tout ce que renvoie ce module est une PROJECTION de données existantes :
 * feuille de route, trajectoire, bilans, Hub, statistiques ARIA. Aucun score,
 * pourcentage, recommandation IA ou citation RAG n'est fabriqué. Quand la
 * donnée n'existe pas, le champ vaut `null` ou un tableau vide, et l'interface
 * affiche un état vide honnête.
 */

import 'server-only';

import type {
  EleveBilan,
  EleveDashboardData,
} from '@/components/dashboard/eleve/types';
import type {
  AriaAssessmentDTO,
  AriaCockpitDTO,
  AriaLearningProfileDTO,
  AriaNextSessionDTO,
  AriaSetupDTO,
  AriaSetupState,
  AriaTodayDTO,
  AriaTodayItemDTO,
  AriaTrajectoryDTO,
} from '@/lib/aria/contracts';
import { buildStudentDashboardPayload } from '@/lib/dashboard/student-payload';
import { resolveAriaCurriculum } from '@/lib/aria/curriculum/resolver';
import { buildAriaExamContext } from '@/lib/aria/curriculum/exam-context';
import { getSkillGraph } from '@/lib/aria/curriculum/skill-graph';
import { getAriaLearningProfile } from '@/lib/aria/profile/service';
import { allCourseKeys, projectHubResources } from './resources';

/** Fenêtre au-delà de laquelle un bilan terminé n'est plus considéré « récent ». */
const RECENT_ASSESSMENT_WINDOW_DAYS = 30;

/**
 * Feature keys ACTIVES, déduites du payload dashboard.
 *
 * `ariaStats.canUseAriaMaths` / `canUseAriaNsi` sont déjà calculés par le
 * dashboard à partir de `getUserEntitlements()`. Les réutiliser évite une
 * seconde résolution d'entitlements — et garantit que le cockpit et le
 * dashboard affichent exactement les mêmes droits.
 */
function entitlementsFromPayload(payload: EleveDashboardData): string[] {
  const features: string[] = [];
  if (payload.ariaStats.canUseAriaMaths) features.push('aria_maths');
  if (payload.ariaStats.canUseAriaNsi) features.push('aria_nsi');
  return features;
}

function buildSetup(
  profile: AriaLearningProfileDTO,
  academicIncomplete: boolean,
  missingAcademicFields: readonly string[],
  selectedCount: number,
): AriaSetupDTO {
  let state: AriaSetupState;
  if (academicIncomplete) {
    state = 'ACADEMIC_PROFILE_INCOMPLETE';
  } else if (!profile.onboardingCompletedAt) {
    state = 'ONBOARDING_REQUIRED';
  } else if (selectedCount === 0) {
    state = 'NO_COURSE_SELECTED';
  } else {
    state = 'READY';
  }

  return {
    state,
    onboardingCompleted: profile.onboardingCompletedAt !== null,
    academicProfileIncomplete: academicIncomplete,
    missingAcademicFields,
    // Aucune API self-service de modification du profil scolaire n'existe :
    // seul un ADMIN peut corriger ces champs. Le cockpit le dit clairement.
    academicProfileReadOnly: true,
  };
}

/**
 * « Aujourd'hui » = projection de la feuille de route existante, éventuellement
 * complétée par la séance du jour. Aucune recommandation générée.
 */
function buildToday(
  payload: EleveDashboardData,
  weeklyGoalMinutes: number,
): AriaTodayDTO {
  const items: AriaTodayItemDTO[] = payload.cockpit.feuilleDeRoute.map((item) => ({
    id: item.id,
    title: item.title,
    href: item.href,
    estimatedMinutes: item.estimatedMinutes,
    done: item.done,
    origin: 'FEUILLE_DE_ROUTE',
  }));

  const seance = payload.cockpit.seanceDuJour;
  if (seance) {
    items.unshift({
      id: `session:${seance.id}`,
      title: seance.title,
      subtitle: seance.subject,
      href: '/dashboard/eleve/sessions',
      estimatedMinutes: seance.duration,
      done: false,
      origin: 'NEXT_SESSION',
    });
  }

  const pending = items.filter((item) => !item.done);
  const plannedMinutes = pending.reduce((sum, item) => sum + (item.estimatedMinutes ?? 0), 0);

  return {
    items,
    weeklyGoalMinutes,
    plannedMinutes: pending.length > 0 ? plannedMinutes : null,
  };
}

/** Projection de la trajectoire existante. ARIA ne crée pas de second modèle. */
function buildTrajectory(payload: EleveDashboardData): AriaTrajectoryDTO | null {
  const trajectory = payload.trajectory;
  if (!trajectory || !trajectory.id || !trajectory.title) return null;

  const milestones = trajectory.milestones ?? [];
  const next = milestones.find((milestone) => !milestone.completed) ?? null;

  return {
    id: trajectory.id,
    title: trajectory.title,
    progress: trajectory.progress,
    daysRemaining: Number.isFinite(trajectory.daysRemaining) ? trajectory.daysRemaining : null,
    nextMilestone: next ? { title: next.title, targetDate: next.targetDate ?? null } : null,
    milestoneCount: milestones.length,
    completedMilestoneCount: milestones.filter((milestone) => milestone.completed).length,
  };
}

/**
 * Évaluations & bilans réellement disponibles.
 *
 * Trois états seulement, tous dérivés du statut réel du bilan :
 *  • `TERMINE` / `RECENT` : bilan analysé (`COMPLETED`), selon son ancienneté ;
 *  • `A_FAIRE`            : bilan pas encore exploitable par l'élève.
 * Aucun test adaptatif ni score de remplissage n'est produit.
 */
function buildAssessments(bilans: readonly EleveBilan[], now: Date): AriaAssessmentDTO[] {
  const recentThreshold = now.getTime() - RECENT_ASSESSMENT_WINDOW_DAYS * 24 * 60 * 60 * 1000;

  return bilans.map((bilan) => {
    const createdAtMs = Date.parse(bilan.createdAt);
    const isCompleted = bilan.status === 'COMPLETED';
    const isRecent = Number.isFinite(createdAtMs) && createdAtMs >= recentThreshold;

    return {
      id: bilan.id,
      title: bilan.subjectLabel,
      subject: bilan.subject ?? null,
      state: isCompleted ? (isRecent ? 'RECENT' : 'TERMINE') : 'A_FAIRE',
      date: bilan.createdAt ?? null,
      href: bilan.resultUrl,
      globalScore: bilan.globalScore,
    };
  });
}

function buildNextSession(payload: EleveDashboardData): AriaNextSessionDTO | null {
  const session = payload.nextSession;
  if (!session) return null;

  const coach = session.coach;
  return {
    id: session.id,
    title: session.title,
    subject: session.subject ?? null,
    scheduledAt: session.scheduledAt,
    coachName: coach ? (coach.pseudonym || `${coach.firstName} ${coach.lastName}`.trim()) : null,
  };
}

export interface BuildAriaCockpitResult {
  readonly cockpit: AriaCockpitDTO;
  /** Nombre de requêtes Prisma déclenchées, pour l'instrumentation. */
  readonly queryCount: number;
}

/**
 * Assemble le payload complet du cockpit ARIA pour un utilisateur ÉLÈVE.
 *
 * @param userId `session.user.id` — jamais un `studentId` fourni par le client.
 */
export async function buildAriaCockpit(userId: string): Promise<BuildAriaCockpitResult> {
  // ── 1) Payload dashboard (≈8 requêtes, déjà mutualisées) ───────────────
  const payload = await buildStudentDashboardPayload(userId);

  // ── 2) Profil pédagogique ARIA (1 requête) ─────────────────────────────
  const profile = await getAriaLearningProfile(payload.student.id);

  // ── 3) Dérivations pures (0 requête) ───────────────────────────────────
  const curriculum = resolveAriaCurriculum({
    gradeLevel: payload.student.gradeLevel,
    academicTrack: payload.student.academicTrack,
    specialties: payload.student.specialties,
    stmgPathway: payload.student.stmgPathway,
    school: payload.student.school,
    selectedCourseKeys: profile.selectedCourseKeys,
    entitlements: entitlementsFromPayload(payload),
  });

  const setup = buildSetup(
    profile,
    curriculum.academicProfile.incomplete,
    curriculum.academicProfile.missingFields,
    curriculum.selectedCourseKeys.length,
  );

  const now = new Date();

  const cockpit: AriaCockpitDTO = {
    student: {
      firstName: payload.student.firstName ?? null,
      lastName: payload.student.lastName ?? null,
      gradeLevel: payload.student.gradeLevel ?? null,
      academicTrack: payload.student.academicTrack ?? null,
    },
    setup,
    profile,
    curriculum,
    today: buildToday(payload, profile.weeklyGoalMinutes),
    trajectory: buildTrajectory(payload),
    resources: projectHubResources(payload.hub, allCourseKeys()),
    assessments: buildAssessments(payload.recentBilans ?? [], now),
    aria: {
      totalConversations: payload.ariaStats.totalConversations,
      messagesToday: payload.ariaStats.messagesToday,
      canUseAriaMaths: payload.ariaStats.canUseAriaMaths,
      canUseAriaNsi: payload.ariaStats.canUseAriaNsi,
    },
    nextSession: buildNextSession(payload),
    examContext: buildAriaExamContext(profile.targetSession),
    // Bornés aux cours réellement présents dans la carte de l'élève.
    skillGraphs: curriculum.courses
      .filter((view) => view.course.hasSkillGraph)
      .map((view) => getSkillGraph(view.course.key))
      .filter((graph): graph is NonNullable<typeof graph> => graph !== null),
  };

  return { cockpit, queryCount: 9 };
}
