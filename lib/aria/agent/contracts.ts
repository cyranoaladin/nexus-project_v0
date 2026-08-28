/**
 * ARIA Agent — contrats de domaine (SQUELETTE P0).
 *
 * ── Périmètre strict de P0 ───────────────────────────────────────────────────
 * Ce module ne définit QUE des types. En P0 :
 *   • il n'est branché sur AUCUN fournisseur LLM ;
 *   • il n'écrit RIEN en base ;
 *   • il ne produit AUCUNE réponse : aucune fonction de génération n'existe ici.
 *
 * Son unique rôle est de figer la forme du contexte que P1 transmettra à
 * l'agent, afin que le cockpit P0 soit déjà capable de l'assembler.
 * Le pipeline de chat existant (`/api/aria/chat`, `lib/aria.ts`,
 * `lib/aria-streaming.ts`) reste inchangé et continue de fonctionner.
 */

import type {
  AriaAssessmentDTO,
  AriaCompetency,
  AriaCourseKey,
  AriaCourseProjection,
  AriaLearningGoal,
  AriaNextSessionDTO,
  AriaResourceDTO,
  AriaTodayDTO,
  AriaTrajectoryDTO,
} from '@/lib/aria/contracts';
import type { AcademicTrack, GradeLevel, StmgPathway, Subject } from '@prisma/client';

/** Profil de l'élève tel que l'agent le verra. Lecture seule. */
export interface AriaAgentStudentProfile {
  readonly gradeLevel: GradeLevel | null;
  readonly academicTrack: AcademicTrack | null;
  readonly specialties: readonly Subject[];
  readonly stmgPathway: StmgPathway | null;
  readonly weeklyGoalMinutes: number;
  readonly learningGoals: readonly AriaLearningGoal[];
}

/**
 * Contexte complet d'un élève pour l'agent pédagogique.
 *
 * Assemblé en P0, consommé en P1. Aucun champ n'est optionnel « au cas où » :
 * ce qui n'existe pas vaut `null` ou tableau vide.
 */
export interface AriaStudentContext {
  readonly studentProfile: AriaAgentStudentProfile;
  /** Cours de travail courant, si l'élève en a ouvert un. */
  readonly course: AriaCourseProjection | null;
  /** Compétence ciblée dans le cours courant, si l'élève en a choisi une. */
  readonly selectedCompetency: AriaCompetency | null;
  readonly trajectory: AriaTrajectoryDTO | null;
  readonly todayPlan: AriaTodayDTO | null;
  readonly resources: readonly AriaResourceDTO[];
  readonly recentAssessments: readonly AriaAssessmentDTO[];
  readonly nextSession: AriaNextSessionDTO | null;
}

/**
 * Enveloppe de récupération documentaire que P1 devra utiliser.
 *
 * DETTE ACTUELLE (documentée, non corrigée en P0) : `lib/aria.ts` et
 * `lib/aria-streaming.ts` appellent `ragSearch({ filters: { subject } })` sans
 * niveau, sans voie et sans collection explicite — la recherche retombe donc
 * systématiquement sur `ressources_pedagogiques_terminale`. Ce type décrit la
 * cible, il n'est encore appelé nulle part.
 */
export interface AriaRetrievalEnvelope {
  readonly courseKey: AriaCourseKey;
  readonly gradeLevel: GradeLevel;
  readonly academicTrack: AcademicTrack;
  readonly ragSubject: string;
  /** Collection explicite. `null` est interdit côté P1 : plus de repli implicite. */
  readonly collection: string | null;
}

/** Citation persistée que P1 devra rattacher à un message ARIA. */
export interface AriaSourceCitation {
  readonly id: string;
  readonly title: string;
  readonly excerpt: string;
  readonly score: number;
  readonly collection: string;
}
