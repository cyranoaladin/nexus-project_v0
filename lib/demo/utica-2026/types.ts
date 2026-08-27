/**
 * Types du démonstrateur salon UTICA 2026 (`/demo/utica-2026`).
 *
 * Tout ce module décrit est FICTIF. Rien ici n'est lu depuis, ni écrit vers,
 * la base de données de production — voir `scenario.ts` pour le récit unique
 * et `selectors.ts` pour les vues dérivées consommées par les pages.
 *
 * `SubjectCode` reprend volontairement les libellés de l'enum Prisma `Subject`
 * (prisma/schema.prisma) sans importer le package Prisma généré, pour garder
 * ce module de démonstration totalement découplé du runtime applicatif (cf.
 * amendement A7 — zéro dépendance réseau/DB critique).
 */
import type { PedagogicalStatus } from '@/lib/diagnostic/maths-terminale/types';

export type SubjectCode =
  | 'MATHEMATIQUES'
  | 'MATHS_EXPERTES'
  | 'NSI'
  | 'FRANCAIS'
  | 'PHILOSOPHIE'
  | 'HISTOIRE_GEO'
  | 'ANGLAIS'
  | 'ESPAGNOL'
  | 'PHYSIQUE_CHIMIE'
  | 'SVT'
  | 'SES';

/**
 * Provenance explicite de chaque donnée présentée comme un fait (amendement A5).
 * - REGLEMENTAIRE_CANONIQUE : dérivé de data/exams/bac-general-2027.json (lib/exams).
 * - ETAPE_NEXUS : une étape/processus interne à l'accompagnement Nexus (pas une règle officielle).
 * - DEMONSTRATION : donnée purement illustrative du scénario fictif.
 */
export type Provenance = 'REGLEMENTAIRE_CANONIQUE' | 'ETAPE_NEXUS' | 'DEMONSTRATION';

export interface Provenanced<T> {
  value: T;
  provenance: Provenance;
  /** Libellé de source affichable, requis quand provenance = REGLEMENTAIRE_CANONIQUE. */
  sourceLabel?: string;
}

/**
 * Vocabulaire de maîtrise pédagogique — normalisation finale P2 §4 (Cas A) :
 * réutilise directement `PedagogicalStatus` (lib/diagnostic/maths-terminale,
 * vocabulaire de production), plutôt qu'un système parallèle. Ce fichier
 * n'a AUCUN import (vérifié) — type-only, zéro couplage runtime, zéro
 * risque de cycle. Restreint aux 5 états pertinents pour un état de
 * compétence déjà observé (les 6 autres valeurs de `PedagogicalStatus`
 * sont des états déclaratifs pré-évaluation, hors périmètre ici) ; `Extract`
 * garantit que ces 5 littéraux existent réellement dans le type canonique.
 */
export type CompetencyLevel = Extract<
  PedagogicalStatus,
  'Maîtrisé' | 'À consolider' | 'Fragile' | 'Très fragile' | 'Non encore vu'
>;

export interface DemoTeacher {
  id: string;
  firstName: string;
  subject: SubjectCode;
  role: string;
}

export interface DemoCompetency {
  id: string;
  label: string;
  level: CompetencyLevel;
}

export interface DemoSubjectTrack {
  subject: SubjectCode;
  label: string;
  currentChapter: string;
  lastCompetencyWorked: string;
  nextStep: string;
  lastResultLabel: string;
  competencies: DemoCompetency[];
  teacherId: string;
}

export type SessionKind = 'COURS_NEXUS' | 'EXAMEN_BLANC';

/**
 * `startTime`/`endTime` sont la donnée temporelle structurée (HH:MM, 24h) —
 * seule source du calcul de durée (Nexus Pulse). `dayLabel` reste un libellé
 * (jour de la semaine) volontairement textuel — aucun calcul n'en dépend.
 * Tout libellé d'affichage ("10:00–12:00") est *dérivé* de startTime/endTime
 * par un formatter pur (selectors.ts::formatSessionTime) — jamais l'inverse
 * (dette P1A §0.A : avant ce correctif, la durée était reparsée depuis une
 * chaîne d'affichage, ce qui couplait calcul métier et présentation).
 */
export interface DemoSession {
  id: string;
  subject: SubjectCode;
  title: string;
  dayLabel: string;
  startTime: string;
  endTime: string;
  teacherId: string;
  kind: SessionKind;
}

export type TaskType = 'DEVOIR' | 'FICHE' | 'EXERCICE' | 'QCM' | 'REVISION';
export type TaskPriority = 'HAUTE' | 'MOYENNE' | 'BASSE';
export type TaskStatus = 'A_FAIRE' | 'TERMINE';

export interface DemoTask {
  id: string;
  subject: SubjectCode;
  label: string;
  type: TaskType;
  estimatedMinutes: number;
  dueLabel: string;
  priority: TaskPriority;
  status: TaskStatus;
  relatedCompetency?: string;
}

export type AdministrativeStatus = 'A_PREPARER' | 'EN_COURS' | 'A_VERIFIER' | 'VALIDE' | 'A_REMPLACER' | 'NON_CONCERNE';

/**
 * Origine de chaque item du dossier candidat (P1B §2.1). Réutilise
 * volontairement `Provenance` (déjà présent partout ailleurs dans ce module)
 * plutôt qu'un type parallèle : OFFICIAL_REQUIREMENT == REGLEMENTAIRE_CANONIQUE,
 * NEXUS_CHECK == ETAPE_NEXUS, DEMO_SAMPLE == DEMONSTRATION.
 */
export interface DemoAdministrativeItem {
  id: string;
  category: string;
  label: string;
  status: AdministrativeStatus;
  provenance: Provenance;
  note?: string;
}

export type InterventionChannel = 'EQUIPE_NEXUS' | 'ARIA';

/**
 * Catégorie factuelle de l'intervention — sert de source unique à Nexus
 * Pulse (§6-7) : les compteurs "combien / quoi" sont dérivés en filtrant
 * par catégorie, jamais en analysant le texte du libellé (fragile, invisible
 * à la relecture). Une intervention n'a qu'une catégorie.
 */
export type InterventionCategory = 'PLANNING_UPDATE' | 'ANALYSIS' | 'RESOURCE_RECOMMENDATION' | 'REPORT_ADDED';

export interface DemoIntervention {
  id: string;
  dateLabel: string;
  label: string;
  channel: InterventionChannel;
  category: InterventionCategory;
}

export type ResourceType = 'FICHE' | 'EXERCICE' | 'VIDEO' | 'QCM';

export interface DemoResource {
  id: string;
  subject: SubjectCode;
  title: string;
  type: ResourceType;
  recommendedBecause?: string;
  /** Compétences ciblées par cette ressource (§10 : resource → competencyIds) — jamais une ressource orpheline. */
  competencyIds?: string[];
}

/**
 * Le fil pédagogique central du scénario (amendement A3 : une seule vérité).
 * Toute projection Parent / Élève / ARIA doit dériver de CET objet — jamais
 * d'un nombre ou d'un libellé recopié séparément dans chaque écran.
 * `fragileCompetencyId`/`masteredCompetencyId` (P1C §10 : focus → competency)
 * relient le focus à une entrée stable de `subjectTracks[].competencies` —
 * les champs `fragileCompetency`/`masteredCompetency` (texte) restent
 * inchangés pour ne pas perturber les projections déjà acceptées.
 */
export interface PedagogicalFocus {
  subject: SubjectCode;
  subjectLabel: string;
  masteredCompetency: string;
  masteredCompetencyId: string;
  fragileCompetency: string;
  fragileCompetencyId: string;
  evidenceSummary: string;
  recommendedActivityLabel: string;
  recommendedActivityMinutes: number;
  nextTeacherSessionId: string;
}

export interface DemoStudentProfile {
  firstName: string;
  lastNameInitial: string;
  status: string;
  level: string;
  examSession: number;
  modalite: 'A' | 'B';
  specialites: SubjectCode[];
  specialiteAbandonnee: SubjectCode;
  langueA: SubjectCode;
  langueB: SubjectCode;
  globalStatusLabel: string;
}

/**
 * Jalon interne du parcours (§10 — "Jalons Nexus"). Toujours provenance
 * ETAPE_NEXUS : ce sont des étapes d'accompagnement, jamais une échéance
 * réglementaire (celles-ci viennent exclusivement de `regulatory.ts`).
 */
export type MilestoneStatus = 'DONE' | 'CURRENT' | 'UPCOMING';

export interface DemoJourneyMilestone {
  id: string;
  label: string;
  status: MilestoneStatus;
}

/**
 * Planning premium (P1B §3) — types de créneaux au-delà des séances/tâches
 * déjà modélisées. Seuls les blocs de travail autonome/ARIA sans ancrage
 * jour existant sont représentés ici ; le planning réel fusionne
 * sessions + tasks + weeklyBlocks dans un seul selector (getWeeklySchedule),
 * jamais une copie manuelle des libellés déjà présents ailleurs.
 */
export type WeeklyBlockKind = 'TRAVAIL_PERSONNEL' | 'ARIA';

export interface DemoWeeklyBlock {
  id: string;
  dayLabel: string;
  subject: SubjectCode;
  label: string;
  kind: WeeklyBlockKind;
}

/**
 * Chaîne pédagogique centrale de P1C :
 * évaluation → compétence → preuve → ressource/activité → prochaine action
 * → reprise avec l'enseignant. Une preuve n'est jamais orpheline : elle cite
 * toujours au moins une compétence réelle de `subjectTracks`.
 */
export type LearningEvidenceKind =
  | 'QCM'
  | 'EXERCICE_GUIDE'
  | 'DEVOIR'
  | 'MINI_EVALUATION'
  | 'OBSERVATION_ENSEIGNANT'
  | 'ACTIVITE_ARIA';

export interface DemoLearningEvidence {
  id: string;
  dateLabel: string;
  kind: LearningEvidenceKind;
  label: string;
  subject: SubjectCode;
  /** Compétences concernées — jamais une preuve sans compétence associée. */
  competencyIds: string[];
  /** Résultat factuel (ex. "4/5", "Observation qualitative") — jamais une moyenne recalculée. */
  resultLabel: string;
  /** Conséquence pédagogique observée, en une phrase. */
  consequenceLabel: string;
}

/**
 * Coffre documentaire (§5) — métadonnées purement démonstratives, aucun
 * fichier réel, aucun DOCUMENT_STORAGE_ROOT (amendement A7).
 */
export type DocumentCategory = 'BILAN' | 'COMPTE_RENDU' | 'PLANNING' | 'CORRECTION' | 'ADMINISTRATIF';

export interface DemoDocument {
  id: string;
  category: DocumentCategory;
  title: string;
  dateLabel: string;
}

export interface DemoScenario {
  student: DemoStudentProfile;
  focus: PedagogicalFocus;
  teachers: DemoTeacher[];
  subjectTracks: DemoSubjectTrack[];
  sessions: DemoSession[];
  tasks: DemoTask[];
  administrative: DemoAdministrativeItem[];
  interventions: DemoIntervention[];
  resources: DemoResource[];
  journeyMilestones: DemoJourneyMilestone[];
  weeklyBlocks: DemoWeeklyBlock[];
  learningEvidence: DemoLearningEvidence[];
  documents: DemoDocument[];
}
