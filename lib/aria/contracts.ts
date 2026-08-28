/**
 * ARIA Learning Cockpit — contrats de domaine (P0).
 *
 * Ce module est **isomorphe** (importable serveur ET client) : il ne contient
 * que des types et des constantes, aucun accès disque, réseau ou Prisma.
 *
 * ── Règle d'or de séparation des concepts ────────────────────────────────────
 * Quatre dimensions strictement indépendantes qualifient un cours. Les
 * confondre est le bug de conception que ce fichier existe pour empêcher :
 *
 *  1. `academicallyRelevant`  — l'élève suit-il réellement ce cours dans sa
 *                               scolarité ? Dérivé de Student (SSoT).
 *  2. `productSupported`      — Nexus/ARIA sait-il réellement travailler cette
 *                               matière (skill graph / RAG / ressources) ?
 *  3. `commerciallyEntitled`  — l'abonnement de l'élève ouvre-t-il l'accès ?
 *  4. `selectedForAria`       — l'élève a-t-il choisi ce cours dans son cockpit ?
 *
 * Un cours peut être scolairement suivi mais non supporté par le produit, ou
 * supporté mais verrouillé commercialement. Jamais d'amalgame.
 */

// Source de vérité des énumérations : le schéma Prisma. `types/enums.ts` en est
// un miroir client qui a dérivé (il lui manque notamment `QUATRIEME`), il ne
// peut donc pas servir de référence. L'import est TYPE-ONLY : il est effacé à
// la compilation et n'embarque aucun code Prisma dans le bundle client.
import type { AcademicTrack, GradeLevel, StmgPathway, Subject } from '@prisma/client';

// ─── Clé de cours ────────────────────────────────────────────────────────────

/**
 * Identifiant stable d'un cours du catalogue ARIA.
 *
 * C'est une **chaîne**, pas l'enum Prisma `Subject`, et c'est délibéré :
 * les modules hors-enum (SGN, MANAGEMENT, DROIT_ECO, MATHS_COMPLEMENTAIRES,
 * EMC, et les futurs) ne doivent pas imposer une migration d'enum PostgreSQL
 * à chaque ajout. Convention : kebab-case ASCII, `<matiere>-<niveau>[-<voie>]`.
 */
export type AriaCourseKey = string;

// ─── Niveau de support produit ───────────────────────────────────────────────

/**
 * Niveau de support ARIA réellement prouvé par les artefacts du dépôt.
 * Aucune valeur ne doit être attribuée sans preuve (cf. `AriaCourseCapabilities`).
 */
export type AriaCourseSupport =
  /** Skill graph compilé + RAG + chat : le cours est pleinement exploitable. */
  | 'FULL'
  /** Support réel mais dégradé (ex. RAG non spécifique au module). */
  | 'PARTIAL'
  /** Uniquement des ressources (Hub) — ni skill graph ni RAG. */
  | 'RESOURCES_ONLY'
  /** Uniquement du RAG — pas de skill graph, pas de ressources dédiées. */
  | 'RAG_ONLY'
  /** Traité par un produit externe (ex. plateforme EAF). */
  | 'EXTERNAL'
  /** Académiquement pertinent, mais aucun support produit prouvé à ce jour. */
  | 'COMING_SOON';

/**
 * Provenance d'une capacité déclarée. Volontairement symbolique : l'API
 * n'expose **jamais** de chemin filesystem (cf. §13 de la spec P0).
 */
export type AriaCapabilityProvenance =
  /** Artefact compilé `lib/diagnostics/definitions/generated/*.domains.json`. */
  | 'COMPILED_SKILL_GRAPH'
  /** Capacité déclarée par le client RAG (`RAGSubject`). */
  | 'RAG_CAPABILITY'
  /** Ressource réellement présente dans le Hub élève. */
  | 'HUB_RESOURCE'
  /** Matière acceptée par l'API chat ARIA (enum `Subject`). */
  | 'ARIA_CHAT_SUBJECT'
  /** Structure du programme national (tronc commun, spécialités, modules). */
  | 'NATIONAL_CURRICULUM';

/** Capacités élémentaires, chacune adossée à une preuve vérifiable. */
export interface AriaCourseCapabilities {
  /** Un skill graph compilé existe (definitionKey non nul). */
  readonly skillGraph: boolean;
  /** Une collection/capability RAG réelle couvre ce cours. */
  readonly rag: boolean;
  /** Le Hub élève expose au moins une ressource rattachable à ce cours. */
  readonly resources: boolean;
  /** L'API `/api/aria/chat` accepte une matière pour ce cours. */
  readonly chat: boolean;
  /**
   * `true` quand la matière chat est une approximation (ex. SGN → SES) :
   * le contexte transmis à ARIA est plus grossier que le cours réel.
   * Dette explicite à lever en P1.
   */
  readonly chatSubjectIsApproximate: boolean;
}

// ─── Cours ───────────────────────────────────────────────────────────────────

/** Rôle du cours dans la scolarité de l'élève. */
export type AriaCourseRole =
  /** Tronc commun / enseignement obligatoire du niveau. */
  | 'CORE'
  /** Enseignement de spécialité (EDS). */
  | 'SPECIALTY'
  /** Module de la voie technologique (STMG…). */
  | 'TRACK_MODULE'
  /** Option facultative. */
  | 'OPTION';

/** Support pédagogique rattaché à un cours (skill graph, RAG, ressources). */
export interface AriaCourseSupportDetail {
  readonly level: AriaCourseSupport;
  readonly capabilities: AriaCourseCapabilities;
  /** Preuves à l'origine du niveau de support déclaré. */
  readonly provenance: readonly AriaCapabilityProvenance[];
  /** Explication lisible, affichable à l'élève. Jamais de promesse non tenue. */
  readonly note?: string;
}

/** Entrée canonique du catalogue curriculum. */
export interface AriaCourse {
  readonly key: AriaCourseKey;
  readonly label: string;
  readonly shortLabel: string;
  readonly gradeLevel: GradeLevel;
  /** Voies pour lesquelles ce cours est académiquement pertinent. */
  readonly tracks: readonly AcademicTrack[];
  readonly role: AriaCourseRole;
  /**
   * Spécialité EDS correspondante. Renseigné uniquement pour `role: 'SPECIALTY'`,
   * afin de confronter le cours à `Student.specialties`.
   */
  readonly specialty?: Subject;
  /** Parcours STMG concernés (undefined = tous les parcours de la voie). */
  readonly stmgPathways?: readonly StmgPathway[];
  /** Matière transmise à `/api/aria/chat` (null si le cours n'est pas chattable). */
  readonly chatSubject: Subject | null;
  /** Clé de définition diagnostique compilée, si un skill graph existe. */
  readonly definitionKey: string | null;
  /** Sujet RAG réellement déclaré par `lib/rag-client.ts`, sinon null. */
  readonly ragSubject: AriaRagSubject | null;
  /** Feature key d'entitlement exigée pour travailler ce cours avec ARIA. */
  readonly requiredFeature: AriaFeatureKey;
  /**
   * Identifiants exacts de ressources du Hub élève rattachées à ce cours.
   * Nécessaire car plusieurs modules STMG partagent la matière `SES` : le
   * rattachement par matière seule serait ambigu.
   */
  readonly hubResourceIds: readonly string[];
  readonly support: AriaCourseSupportDetail;
}

/** Sujets RAG réellement supportés (miroir de `RAGSubject`, cf. lib/rag-client.ts). */
export type AriaRagSubject =
  | 'maths'
  | 'nsi'
  | 'physique_chimie'
  | 'francais'
  | 'svt'
  | 'ses';

/**
 * Feature keys d'entitlement existantes. P0 ne crée AUCUNE nouvelle feature key :
 * le mapping actuel (NSI → aria_nsi, tout le reste → aria_maths) est conservé
 * tel quel et documenté comme dette P1.
 */
export type AriaFeatureKey = 'aria_maths' | 'aria_nsi';

// ─── Accès ───────────────────────────────────────────────────────────────────

/** État d'accès d'un cours, dimensions séparées (cf. règle d'or en tête). */
export interface AriaAccessState {
  /** L'élève suit-il ce cours dans sa scolarité réelle ? */
  readonly academicallyRelevant: boolean;
  /** Le produit sait-il réellement traiter ce cours ? */
  readonly productSupported: boolean;
  /** L'abonnement ouvre-t-il l'accès ? */
  readonly commerciallyEntitled: boolean;
  /** L'élève a-t-il retenu ce cours dans son cockpit ? */
  readonly selectedForAria: boolean;
}

/** Cours + état d'accès, tel que projeté vers le frontend. */
export interface AriaCourseView {
  readonly course: AriaCourseProjection;
  readonly access: AriaAccessState;
}

/**
 * Projection sûre d'un `AriaCourse` : aucun chemin filesystem, aucun secret.
 * C'est le seul type de cours qui traverse la frontière HTTP.
 */
export interface AriaCourseProjection {
  readonly key: AriaCourseKey;
  readonly label: string;
  readonly shortLabel: string;
  readonly gradeLevel: GradeLevel;
  readonly role: AriaCourseRole;
  readonly chatSubject: Subject | null;
  readonly support: AriaCourseSupport;
  readonly capabilities: AriaCourseCapabilities;
  readonly provenance: readonly AriaCapabilityProvenance[];
  readonly supportNote?: string;
  readonly hasSkillGraph: boolean;
}

// ─── Profil scolaire (SSoT = Student) ────────────────────────────────────────

/**
 * Profil scolaire projeté depuis `Student`. ARIA le **lit** et ne le duplique
 * jamais comme seconde vérité : aucune écriture n'est possible via ARIA en P0.
 */
export interface AriaAcademicProfileDTO {
  readonly gradeLevel: GradeLevel | null;
  readonly academicTrack: AcademicTrack | null;
  readonly specialties: readonly Subject[];
  readonly stmgPathway: StmgPathway | null;
  readonly school: string | null;
  /** `true` si les champs indispensables au calcul du curriculum manquent. */
  readonly incomplete: boolean;
  /** Champs manquants, pour un message d'aide honnête côté UI. */
  readonly missingFields: readonly string[];
}

// ─── Profil pédagogique ARIA ─────────────────────────────────────────────────

/** Objectifs d'apprentissage structurés (pas de texte marketing libre). */
export const ARIA_LEARNING_GOALS = [
  'COMPRENDRE_LE_COURS',
  'PREPARER_BAC',
  'CONSOLIDER_LACUNES',
  'ENTRAINEMENT_REGULIER',
  'PREPARER_EVALUATION',
] as const;

export type AriaLearningGoal = (typeof ARIA_LEARNING_GOALS)[number];

/** Bornes du rythme hebdomadaire, appliquées côté service ET côté API. */
export const ARIA_WEEKLY_GOAL_MIN_MINUTES = 30;
export const ARIA_WEEKLY_GOAL_MAX_MINUTES = 1500;
export const ARIA_WEEKLY_GOAL_DEFAULT_MINUTES = 180;

/** Version courante du catalogue curriculum, persistée avec le profil. */
export const ARIA_CURRICULUM_VERSION = 'v1';

/** Préférences de travail du cockpit. Volontairement minimal en P0. */
export interface AriaPreferencesDTO {
  /** Cours ouvert par défaut à l'arrivée sur le cockpit. */
  readonly preferredCourseKey?: AriaCourseKey;
  /** Onglet du cockpit ouvert par défaut. */
  readonly defaultPanel?: AriaCockpitPanel;
}

/** Profil pédagogique ARIA (modèle additif `aria_learning_profiles`). */
export interface AriaLearningProfileDTO {
  readonly targetSession: number | null;
  readonly selectedCourseKeys: readonly AriaCourseKey[];
  readonly weeklyGoalMinutes: number;
  readonly learningGoals: readonly AriaLearningGoal[];
  readonly preferences: AriaPreferencesDTO;
  readonly curriculumVersion: string;
  readonly onboardingCompletedAt: string | null;
}

// ─── État de configuration ───────────────────────────────────────────────────

export type AriaSetupState =
  /** Le profil scolaire porté par Student est incomplet : ARIA ne peut pas dériver la carte. */
  | 'ACADEMIC_PROFILE_INCOMPLETE'
  /** Profil scolaire exploitable, mais l'onboarding ARIA n'a jamais été terminé. */
  | 'ONBOARDING_REQUIRED'
  /** Onboarding terminé mais aucun cours retenu : le cockpit est vide. */
  | 'NO_COURSE_SELECTED'
  /** Cockpit opérationnel. */
  | 'READY';

export interface AriaSetupDTO {
  readonly state: AriaSetupState;
  readonly onboardingCompleted: boolean;
  readonly academicProfileIncomplete: boolean;
  readonly missingAcademicFields: readonly string[];
  /**
   * `true` si l'élève ne peut pas corriger lui-même son profil scolaire.
   * En P0 c'est toujours le cas : aucune API self-service n'existe et P0
   * n'en crée pas (cf. §3 de la spec).
   */
  readonly academicProfileReadOnly: boolean;
}

// ─── Curriculum ──────────────────────────────────────────────────────────────

/** Résultat du resolver, projeté vers le frontend. */
export interface AriaCurriculumDTO {
  readonly version: string;
  readonly academicProfile: AriaAcademicProfileDTO;
  /** Tous les cours académiquement pertinents, quel que soit leur support. */
  readonly courses: readonly AriaCourseView[];
  /** Cours obligatoires du niveau/voie (tronc commun + modules de voie). */
  readonly requiredCourseKeys: readonly AriaCourseKey[];
  /** Cours retenus par l'élève dans son cockpit. */
  readonly selectedCourseKeys: readonly AriaCourseKey[];
  /** Cours supportés, autorisés commercialement, sélectionnables. */
  readonly availableCourseKeys: readonly AriaCourseKey[];
  /** Cours supportés mais verrouillés commercialement. */
  readonly lockedCourseKeys: readonly AriaCourseKey[];
  /** Cours scolairement suivis mais non encore supportés par ARIA. */
  readonly unsupportedCourseKeys: readonly AriaCourseKey[];
}

// ─── Skill graph ─────────────────────────────────────────────────────────────

export interface AriaCompetency {
  /** Identifiant déterministe et globalement unique : `<courseKey>:<skillId>`. */
  readonly id: string;
  /** Identifiant brut du skill dans la définition compilée. */
  readonly skillId: string;
  readonly label: string;
  readonly domainId: string;
  readonly chapterId: string | null;
  readonly prerequisite: boolean;
}

export interface AriaDomain {
  /** Identifiant déterministe et globalement unique : `<courseKey>:<domainId>`. */
  readonly id: string;
  readonly domainId: string;
  readonly label: string;
  readonly competencyCount: number;
}

export interface AriaSkillGraph {
  readonly courseKey: AriaCourseKey;
  readonly definitionKey: string;
  readonly version: string;
  readonly domains: readonly AriaDomain[];
  readonly competencies: readonly AriaCompetency[];
}

/** Résumé non sensible d'un skill graph, exposable par l'API curriculum. */
export interface AriaSkillGraphSummary {
  readonly courseKey: AriaCourseKey;
  readonly available: boolean;
  readonly domainCount: number;
  readonly competencyCount: number;
  readonly version: string | null;
}

// ─── Cockpit ─────────────────────────────────────────────────────────────────

export type AriaCockpitPanel =
  | 'TODAY'
  | 'CURRICULUM'
  | 'TRAJECTORY'
  | 'RESOURCES'
  | 'ASSESSMENTS'
  | 'ARIA';

export interface AriaTodayItemDTO {
  readonly id: string;
  readonly title: string;
  readonly subtitle?: string;
  readonly href?: string;
  readonly estimatedMinutes?: number;
  readonly done: boolean;
  /**
   * Origine de l'item. P0 ne produit que des projections de données existantes :
   * aucune recommandation générée par IA.
   */
  readonly origin: 'FEUILLE_DE_ROUTE' | 'NEXT_STEP' | 'NEXT_SESSION';
}

export interface AriaTodayDTO {
  readonly items: readonly AriaTodayItemDTO[];
  readonly weeklyGoalMinutes: number;
  /** Somme des minutes estimées des items non faits. Jamais un score inventé. */
  readonly plannedMinutes: number | null;
}

export interface AriaResourceDTO {
  readonly id: string;
  readonly title: string;
  readonly subtitle?: string;
  readonly category: string;
  readonly type: 'PDF' | 'MARKDOWN' | 'LINK';
  readonly href?: string;
  readonly badge?: string;
  readonly courseKeys: readonly AriaCourseKey[];
}

export interface AriaAssessmentDTO {
  readonly id: string;
  readonly title: string;
  readonly subject: string | null;
  readonly state: 'A_FAIRE' | 'RECENT' | 'TERMINE';
  readonly date: string | null;
  readonly href?: string;
  /** Score réel du bilan, ou `null`. Jamais de valeur de remplissage. */
  readonly globalScore: number | null;
}

export interface AriaTrajectoryDTO {
  readonly id: string;
  readonly title: string;
  readonly progress: number;
  readonly daysRemaining: number | null;
  readonly nextMilestone: {
    readonly title: string;
    readonly targetDate: string | null;
  } | null;
  readonly milestoneCount: number;
  readonly completedMilestoneCount: number;
}

export interface AriaStatsDTO {
  /** Projection directe de `ariaStats` du dashboard élève : aucune statistique inventée. */
  readonly totalConversations: number;
  readonly messagesToday: number;
  readonly canUseAriaMaths: boolean;
  readonly canUseAriaNsi: boolean;
}

export interface AriaNextSessionDTO {
  readonly id: string;
  readonly title: string;
  readonly subject: string | null;
  readonly scheduledAt: string;
  readonly coachName: string | null;
}

export interface AriaStudentDTO {
  readonly firstName: string | null;
  readonly lastName: string | null;
  readonly gradeLevel: GradeLevel | null;
  readonly academicTrack: AcademicTrack | null;
}

/** Payload complet du cockpit. */
export interface AriaCockpitDTO {
  readonly student: AriaStudentDTO;
  readonly setup: AriaSetupDTO;
  readonly profile: AriaLearningProfileDTO;
  readonly curriculum: AriaCurriculumDTO;
  readonly today: AriaTodayDTO;
  readonly trajectory: AriaTrajectoryDTO | null;
  readonly resources: readonly AriaResourceDTO[];
  readonly assessments: readonly AriaAssessmentDTO[];
  readonly aria: AriaStatsDTO;
  readonly nextSession: AriaNextSessionDTO | null;
  readonly examContext: AriaExamContextDTO | null;
  /**
   * Graphes de compétences des seuls cours présents dans la carte de l'élève
   * (au plus quelques-uns). Bornés volontairement : le payload ne transporte
   * jamais l'intégralité des programmes.
   */
  readonly skillGraphs: readonly AriaSkillGraph[];
}

// ─── Contexte examen (adapter read-only) ─────────────────────────────────────

/**
 * Projection read-only du catalogue d'examen. ARIA ne recrée AUCUNE
 * réglementation Bac : tout provient de `lib/exams/catalog.ts`.
 */
export interface AriaExamContextDTO {
  readonly targetSession: number;
  readonly supported: boolean;
  readonly epreuves: readonly {
    readonly id: string;
    readonly label: string;
    readonly type: string;
    readonly coefficient: number | null;
  }[];
}
