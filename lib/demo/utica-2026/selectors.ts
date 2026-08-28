/**
 * Selectors dérivés du scénario unique (amendement A3).
 *
 * Fonctions PURES uniquement : aucune I/O, aucun fetch, aucune dépendance à
 * Prisma/DB/API/OpenAI (amendement A7). Toute page /demo/utica-2026 doit
 * passer par ce module — jamais relire `demoScenario` en dur pour recalculer
 * un chiffre déjà dérivable ici.
 *
 * Invariant central testé dans __tests__/demo/utica-2026/selectors.test.ts :
 * `getPedagogicalFocus()` est la SEULE source de la priorité pédagogique.
 * `describeFocusForParent/Student/Aria` ne font que projeter les mêmes
 * champs — si le scénario change de sujet/compétence, les trois projections
 * changent ensemble, structurellement, jamais par coïncidence éditoriale.
 */
import { demoScenario } from './scenario';
import type {
  AdministrativeStatus,
  CompetencyLevel,
  DemoAdministrativeItem,
  DemoDocument,
  DemoIntervention,
  DemoJourneyMilestone,
  DemoLearningEvidence,
  DemoResource,
  DemoSession,
  DemoSubjectTrack,
  DemoTask,
  InterventionChannel,
  PedagogicalFocus,
  SubjectCode,
  TaskStatus,
} from './types';

export const SUBJECT_LABELS: Record<SubjectCode, string> = {
  MATHEMATIQUES: 'Mathématiques',
  MATHS_EXPERTES: 'Mathématiques expertes',
  NSI: 'NSI',
  FRANCAIS: 'Français',
  PHILOSOPHIE: 'Philosophie',
  HISTOIRE_GEO: 'Histoire-Géographie',
  ANGLAIS: 'Anglais',
  ESPAGNOL: 'Espagnol',
  PHYSIQUE_CHIMIE: 'Physique-Chimie',
  SVT: 'SVT',
  SES: 'SES',
};

const DAY_ORDER = ['Lundi', 'Mardi', 'Mercredi', 'Jeudi', 'Vendredi', 'Samedi', 'Dimanche'];

/**
 * Les jours de la semaine sont saisis tantôt capitalisés (dayLabel des
 * séances, ex. "Vendredi"), tantôt en minuscule dans une échéance de tâche
 * en prose (ex. "vendredi" dans "20 min · vendredi"). Les deux formes
 * désignent le même jour et doivent trier/positionner de façon identique —
 * cette normalisation évite qu'un jour en minuscule soit traité à tort
 * comme un libellé relatif ("aujourd'hui"/"cette semaine").
 */
function normalizeDayLabel(label: string): string | null {
  const capitalized = label.charAt(0).toUpperCase() + label.slice(1).toLowerCase();
  return DAY_ORDER.includes(capitalized) ? capitalized : null;
}

function dayOrderIndex(label: string): number {
  const normalized = normalizeDayLabel(label);
  return normalized ? DAY_ORDER.indexOf(normalized) : -1;
}

function teacherFirstName(teacherId: string): string {
  return demoScenario.teachers.find((t) => t.id === teacherId)?.firstName ?? 'Coach Nexus';
}

/**
 * `startTime`/`endTime` (HH:MM structuré) sont l'UNIQUE source. Ces deux
 * fonctions dérivent respectivement l'affichage et la durée à partir des
 * mêmes champs structurés — jamais l'un depuis l'autre (dette P1A §0.A).
 * Un test dédié garantit que changer le format d'affichage ne change jamais
 * le résultat numérique de sessionDurationMinutes.
 */
function timeToMinutesOfDay(hm: string): number {
  const [h, m] = hm.split(':').map(Number);
  return h * 60 + m;
}

export function formatSessionTime(session: Pick<DemoSession, 'startTime' | 'endTime'>): string {
  return `${session.startTime}–${session.endTime}`;
}

export function sessionDurationMinutes(session: Pick<DemoSession, 'startTime' | 'endTime'>): number {
  return timeToMinutesOfDay(session.endTime) - timeToMinutesOfDay(session.startTime);
}

// ─── Fil pédagogique central ────────────────────────────────────────────────

/**
 * Collection des focus pédagogiques du scénario. Le scénario n'en porte
 * qu'un seul aujourd'hui (le fil narratif central), mais l'exposer comme une
 * collection permet à `getNexusPulse().prioritiesIdentifiedCount` de le
 * dériver structurellement (`.length`) plutôt que de coder `1` en dur
 * (dette P1A §0.B).
 */
export function getPedagogicalFocuses(): PedagogicalFocus[] {
  return [demoScenario.focus];
}

export function getPedagogicalFocus(): PedagogicalFocus {
  return getPedagogicalFocuses()[0];
}

export interface FocusDescription {
  title: string;
  text: string;
}

/** Vue Parent : point d'attention. */
export function describeFocusForParent(focus: PedagogicalFocus = getPedagogicalFocus()): FocusDescription {
  return {
    title: "Point d'attention",
    text: `${focus.subjectLabel} — ${focus.fragileCompetency} à consolider cette semaine.`,
  };
}

/** Vue Élève : prochaine action. */
export function describeFocusForStudent(focus: PedagogicalFocus = getPedagogicalFocus()): FocusDescription {
  return {
    title: 'À faire maintenant',
    text: `${focus.subjectLabel} — ${focus.recommendedActivityLabel} (${focus.recommendedActivityMinutes} min)`,
  };
}

/** Vue ARIA : activité scénarisée + justification. */
export interface AriaFocusDescription extends FocusDescription {
  activityLabel: string;
  activityMinutes: number;
  justification: string;
}

export function describeFocusForAria(focus: PedagogicalFocus = getPedagogicalFocus()): AriaFocusDescription {
  return {
    title: 'Pourquoi cette activité ?',
    text: focus.evidenceSummary,
    activityLabel: focus.recommendedActivityLabel,
    activityMinutes: focus.recommendedActivityMinutes,
    justification: focus.evidenceSummary,
  };
}

/**
 * Ressource ciblant la compétence fragile du focus pédagogique central —
 * source unique pour snapshot ET ressources élève (P1C §4.1 : une ressource
 * recommandée doit être reliée explicitement au focus, jamais seulement à
 * la matière). Repli sur la matière si aucune ressource ne cite encore
 * l'identifiant de compétence.
 */
function getRecommendedResource() {
  const focus = demoScenario.focus;
  return (
    demoScenario.resources.find((r) => r.competencyIds?.includes(focus.fragileCompetencyId)) ??
    demoScenario.resources.find((r) => r.subject === focus.subject) ??
    null
  );
}

// ─── Cette semaine (§5) ──────────────────────────────────────────────────────

export interface WeeklySnapshot {
  nexusSessionsCount: number;
  devoirsToSubmitCount: number;
  qcmToDoCount: number;
  recommendedResource: { title: string; recommendedBecause?: string } | null;
  administrativeBlockingCount: number;
}

export function getWeeklySnapshot(): WeeklySnapshot {
  const nexusSessionsCount = demoScenario.sessions.filter((s) => s.kind === 'COURS_NEXUS').length;
  const devoirsToSubmitCount = demoScenario.tasks.filter(
    (t) => t.type === 'DEVOIR' && t.status === 'A_FAIRE',
  ).length;
  const qcmToDoCount = demoScenario.tasks.filter((t) => t.type === 'QCM' && t.status === 'A_FAIRE').length;

  const focusResource = getRecommendedResource();
  const { administrativeBlockingCount } = getAdministrativeSummary();

  return {
    nexusSessionsCount,
    devoirsToSubmitCount,
    qcmToDoCount,
    recommendedResource: focusResource
      ? { title: focusResource.title, recommendedBecause: focusResource.recommendedBecause }
      : null,
    administrativeBlockingCount,
  };
}

// ─── Progression par matière (§7) ────────────────────────────────────────────

export interface SubjectProgressView extends DemoSubjectTrack {
  teacherFirstName: string;
}

export function getSubjectProgress(): SubjectProgressView[] {
  return demoScenario.subjectTracks.map((track) => ({
    ...track,
    teacherFirstName: teacherFirstName(track.teacherId),
  }));
}

// ─── Prochains événements (§11) ─────────────────────────────────────────────

export interface UpcomingEvent {
  id: string;
  label: string;
  dayLabel: string;
  subject: SubjectCode;
  kind: 'SEANCE' | 'DEVOIR' | 'QCM';
}

export function getUpcomingEvents(): UpcomingEvent[] {
  const sessionEvents: UpcomingEvent[] = demoScenario.sessions.map((s) => ({
    id: s.id,
    label: s.title,
    dayLabel: s.dayLabel,
    subject: s.subject,
    kind: 'SEANCE',
  }));

  const taskEvents: UpcomingEvent[] = demoScenario.tasks
    .filter((t) => t.status === 'A_FAIRE')
    .map((t) => ({
      id: t.id,
      label: t.label,
      dayLabel: t.dueLabel,
      subject: t.subject,
      kind: t.type === 'QCM' ? 'QCM' : 'DEVOIR',
    }));

  return [...sessionEvents, ...taskEvents].sort((a, b) => {
    const ai = dayOrderIndex(a.dayLabel);
    const bi = dayOrderIndex(b.dayLabel);
    if (ai === -1 && bi === -1) return 0;
    if (ai === -1) return -1; // libellés relatifs ("aujourd'hui", "cette semaine") en premier
    if (bi === -1) return 1;
    return ai - bi;
  });
}

// ─── Résumé administratif (§9) ───────────────────────────────────────────────

export interface AdministrativeSummary {
  items: DemoAdministrativeItem[];
  countByStatus: Record<AdministrativeStatus, number>;
  administrativeBlockingCount: number;
}

export function getAdministrativeSummary(): AdministrativeSummary {
  const items = demoScenario.administrative;
  const countByStatus: Record<AdministrativeStatus, number> = {
    A_PREPARER: 0,
    EN_COURS: 0,
    A_VERIFIER: 0,
    VALIDE: 0,
    A_REMPLACER: 0,
    NON_CONCERNE: 0,
  };
  for (const item of items) countByStatus[item.status] += 1;

  return {
    items,
    countByStatus,
    administrativeBlockingCount: countByStatus.A_PREPARER,
  };
}

// ─── Ce que Nexus a fait (§30 / §52) ─────────────────────────────────────────

export function getNexusInterventions(channel?: InterventionChannel): DemoIntervention[] {
  const all = demoScenario.interventions;
  return channel ? all.filter((i) => i.channel === channel) : all;
}

// ─── Plan de travail élève (§16) ─────────────────────────────────────────────

export interface StudentTaskBoard {
  today: DemoTask[];
  thisWeek: DemoTask[];
  completed: DemoTask[];
}

export function getStudentTasks(): StudentTaskBoard {
  const byStatus = (status: TaskStatus) => demoScenario.tasks.filter((t) => t.status === status);
  const active = byStatus('A_FAIRE');

  return {
    today: active.filter((t) => t.dueLabel === "aujourd'hui"),
    thisWeek: active.filter((t) => t.dueLabel !== "aujourd'hui"),
    completed: byStatus('TERMINE'),
  };
}

// ─── Équipe pédagogique (§12 / §21) ──────────────────────────────────────────

export interface TeacherView {
  id: string;
  firstName: string;
  subject: SubjectCode;
  subjectLabel: string;
  role: string;
  nextSession: { dayLabel: string; timeLabel: string; title: string } | null;
}

export function getTeacherTeam(): TeacherView[] {
  return demoScenario.teachers.map((teacher) => {
    const nextSession = demoScenario.sessions.find((s) => s.teacherId === teacher.id) ?? null;
    return {
      id: teacher.id,
      firstName: teacher.firstName,
      subject: teacher.subject,
      subjectLabel: SUBJECT_LABELS[teacher.subject],
      role: teacher.role,
      nextSession: nextSession
        ? { dayLabel: nextSession.dayLabel, timeLabel: formatSessionTime(nextSession), title: nextSession.title }
        : null,
    };
  });
}

// ─── Vue 360° / Nexus Pulse (P1A) ────────────────────────────────────────────
// Aucune donnée nouvelle ici : tout est recomposé depuis demoScenario et les
// selectors ci-dessus. Voir __tests__/demo/utica-2026/journey-selectors.test.ts
// pour les preuves de cohérence inter-vues (amendement A3).

/** Vue 360° : priorité actuelle — même focus que Parent/Élève/ARIA, une seule fois. */
export interface JourneyPriority {
  subjectLabel: string;
  fragileCompetency: string;
  masteredCompetency: string;
  nextActionLabel: string;
  nextActionMinutes: number;
  nextSession: { dayLabel: string; timeLabel: string; teacherFirstName: string } | null;
}

export function getJourneyPriority(): JourneyPriority {
  const focus = getPedagogicalFocus();
  const session = demoScenario.sessions.find((s) => s.id === focus.nextTeacherSessionId) ?? null;
  return {
    subjectLabel: focus.subjectLabel,
    fragileCompetency: focus.fragileCompetency,
    masteredCompetency: focus.masteredCompetency,
    nextActionLabel: focus.recommendedActivityLabel,
    nextActionMinutes: focus.recommendedActivityMinutes,
    nextSession: session
      ? { dayLabel: session.dayLabel, timeLabel: formatSessionTime(session), teacherFirstName: teacherFirstName(session.teacherId) }
      : null,
  };
}

/** Vue 360° : les 4 dimensions du parcours (§5.3). Vocabulaire qualitatif uniquement — jamais de score. */
export type DimensionState = 'SOUS_CONTROLE' | 'A_JOUR' | 'EN_PROGRESSION' | 'ACTIVE' | 'ACTION_REQUISE';

export interface JourneyDimension {
  key: 'PEDAGOGIE' | 'ORGANISATION' | 'ADMINISTRATIF' | 'AUTONOMIE';
  label: string;
  state: DimensionState;
  stateLabel: string;
  bullets: string[];
}

export function getJourneyOverview(): JourneyDimension[] {
  const focus = getPedagogicalFocus();
  const snapshot = getWeeklySnapshot();
  const admin = getAdministrativeSummary();
  const ariaInterventions = getNexusInterventions('ARIA');

  const levelCounts = getCompetencyLevelCounts();
  const pedagogie: JourneyDimension = {
    key: 'PEDAGOGIE',
    label: 'Pédagogie',
    state: 'EN_PROGRESSION',
    stateLabel: 'En progression',
    bullets: [
      `${focus.masteredCompetency} maîtrisé`,
      `${focus.fragileCompetency} à consolider`,
      // Enrichissement P1C §9 — la seule information ajoutée au fold 360° accepté.
      // Périmètre explicite (P2 §5) : uniquement les compétences suivies par
      // le scénario pédagogique, jamais présenté comme une mesure globale.
      `Compétences suivies actuellement : ${levelCounts['Maîtrisé']} maîtrisée${levelCounts['Maîtrisé'] > 1 ? 's' : ''} · ${levelCounts['À consolider']} à consolider`,
    ],
  };

  const noOverdueTask = !demoScenario.tasks.some((t) => t.dueLabel === 'en retard');
  const nextEvent = getUpcomingEvents()[0] ?? null;
  const organisation: JourneyDimension = {
    key: 'ORGANISATION',
    label: 'Organisation',
    state: 'A_JOUR',
    stateLabel: 'À jour',
    bullets: [
      `${snapshot.nexusSessionsCount} séance${snapshot.nexusSessionsCount > 1 ? 's' : ''} Nexus planifiée${snapshot.nexusSessionsCount > 1 ? 's' : ''} cette semaine`,
      noOverdueTask ? 'Aucune échéance en retard' : 'Échéances à surveiller',
      ...(nextEvent ? [`Prochaine échéance : ${nextEvent.label} (${nextEvent.dayLabel})`] : []),
    ],
  };

  const administratif: JourneyDimension = {
    key: 'ADMINISTRATIF',
    label: 'Administratif',
    state: admin.administrativeBlockingCount === 0 ? 'SOUS_CONTROLE' : 'ACTION_REQUISE',
    stateLabel: admin.administrativeBlockingCount === 0 ? 'Sous contrôle' : 'Action requise',
    bullets: [
      admin.administrativeBlockingCount === 0
        ? '0 élément bloquant'
        : `${admin.administrativeBlockingCount} élément(s) bloquant(s)`,
    ],
  };

  const autonomie: JourneyDimension = {
    key: 'AUTONOMIE',
    label: 'Autonomie',
    state: ariaInterventions.length > 0 ? 'ACTIVE' : 'A_JOUR',
    stateLabel: ariaInterventions.length > 0 ? 'Active' : 'À jour',
    bullets: [
      `${ariaInterventions.length} activité${ariaInterventions.length > 1 ? 's' : ''} ARIA cette semaine`,
      `Prochaine activité ciblée : ${focus.recommendedActivityLabel}`,
    ],
  };

  return [pedagogie, organisation, administratif, autonomie];
}

/** Nexus Pulse (§6-8) : synthèse "combien / quoi / pourquoi / prochaine intervention". */
export interface NexusPulse {
  sessionsOrganizedCount: number;
  sessionsHours: number;
  resultsAnalyzedCount: number;
  prioritiesIdentifiedCount: number;
  resourcesRecommendedCount: number;
  planUpdated: boolean;
  reportsAddedCount: number;
  nextNexusAction: string;
}

export function getNexusPulse(): NexusPulse {
  const nexusSessions = demoScenario.sessions.filter((s) => s.kind === 'COURS_NEXUS');
  // Durée structurée uniquement (startTime/endTime) — jamais reparsée depuis
  // un libellé d'affichage (dette P1A §0.A).
  const sessionsMinutes = nexusSessions.reduce((sum, s) => sum + sessionDurationMinutes(s), 0);
  const equipeInterventions = getNexusInterventions('EQUIPE_NEXUS');
  const snapshot = getWeeklySnapshot();
  const priority = getJourneyPriority();

  const nextNexusAction = priority.nextSession
    ? `Reprendre ${priority.fragileCompetency.toLowerCase()} lors de la prochaine séance de ${priority.subjectLabel} avec ${priority.nextSession.teacherFirstName} (${priority.nextSession.dayLabel} ${priority.nextSession.timeLabel}).`
    : `Reprendre ${priority.fragileCompetency.toLowerCase()} en ${priority.subjectLabel} lors de la prochaine séance Nexus.`;

  return {
    sessionsOrganizedCount: nexusSessions.length,
    sessionsHours: sessionsMinutes / 60,
    resultsAnalyzedCount: equipeInterventions.filter((i) => i.category === 'ANALYSIS').length,
    // Dérivé du nombre de focus pédagogiques du scénario, jamais un littéral (dette P1A §0.B).
    prioritiesIdentifiedCount: getPedagogicalFocuses().length,
    resourcesRecommendedCount: snapshot.recommendedResource ? 1 : 0,
    planUpdated: equipeInterventions.some((i) => i.category === 'PLANNING_UPDATE'),
    reportsAddedCount: equipeInterventions.filter((i) => i.category === 'REPORT_ADDED').length,
    nextNexusAction,
  };
}

/** Vue 360° : jalons internes du parcours (§10, "Jalons Nexus"). */
export function getJourneyMilestones(): DemoJourneyMilestone[] {
  return demoScenario.journeyMilestones;
}

/** Vue 360° (P1B §5) : premier jalon Nexus à venir, pour un enrichissement léger. */
export function getNextJourneyMilestone(): DemoJourneyMilestone | null {
  return getJourneyMilestones().find((m) => m.status === 'UPCOMING') ?? null;
}

// ─── Planning premium (P1B §3) ────────────────────────────────────────────────
// Source unique pour Parent ET Élève : fusionne sessions + tasks (déjà
// modélisés) + weeklyBlocks (créneaux autonomie/ARIA sans jour porté
// ailleurs). Aucune donnée n'est retapée : chaque champ vient d'un objet
// déjà présent dans demoScenario.

export type ScheduleEventKind = 'COURS_NEXUS' | 'TRAVAIL_PERSONNEL' | 'ARIA' | 'DEVOIR' | 'EVALUATION';

export interface ScheduleEvent {
  id: string;
  dayLabel: string;
  /** Présent uniquement pour les créneaux positionnés dans le temps (séances). */
  timeLabel?: string;
  startTime?: string;
  subject: SubjectCode;
  subjectLabel: string;
  label: string;
  kind: ScheduleEventKind;
}

export function getWeeklySchedule(): ScheduleEvent[] {
  const sessionEvents: ScheduleEvent[] = demoScenario.sessions.map((s) => ({
    id: s.id,
    dayLabel: s.dayLabel,
    timeLabel: formatSessionTime(s),
    startTime: s.startTime,
    subject: s.subject,
    subjectLabel: SUBJECT_LABELS[s.subject],
    label: s.title,
    kind: s.kind === 'COURS_NEXUS' ? 'COURS_NEXUS' : 'EVALUATION',
  }));

  const blockEvents: ScheduleEvent[] = demoScenario.weeklyBlocks.map((b) => ({
    id: b.id,
    dayLabel: b.dayLabel,
    subject: b.subject,
    subjectLabel: SUBJECT_LABELS[b.subject],
    label: b.label,
    kind: b.kind,
  }));

  // Seules les tâches dont l'échéance est un vrai jour de la semaine peuvent
  // être positionnées dans la grille — "aujourd'hui"/"cette semaine" restent
  // des libellés relatifs, jamais forcés sur un jour arbitraire.
  const taskEvents: ScheduleEvent[] = demoScenario.tasks
    .filter((t) => t.status === 'A_FAIRE' && normalizeDayLabel(t.dueLabel) !== null)
    .map((t) => ({
      id: t.id,
      dayLabel: normalizeDayLabel(t.dueLabel)!,
      subject: t.subject,
      subjectLabel: SUBJECT_LABELS[t.subject],
      label: t.label,
      kind: t.type === 'DEVOIR' ? 'DEVOIR' : 'EVALUATION',
    }));

  return [...sessionEvents, ...blockEvents, ...taskEvents].sort((a, b) => {
    const dayDiff = dayOrderIndex(a.dayLabel) - dayOrderIndex(b.dayLabel);
    if (dayDiff !== 0) return dayDiff;
    if (a.startTime && b.startTime) return a.startTime.localeCompare(b.startTime);
    if (a.startTime) return -1;
    if (b.startTime) return 1;
    return 0;
  });
}

// ─── Mes ressources (P1B §6, optionnel) ──────────────────────────────────────

export interface StudentResourcesView {
  resources: DemoResource[];
  /** Même ressource que getWeeklySnapshot().recommendedResource — jamais recalculée séparément. */
  recommended: DemoResource | null;
}

export function getStudentResources(): StudentResourcesView {
  return { resources: demoScenario.resources, recommended: getRecommendedResource() };
}

// ─── Chaîne pédagogique P1C ──────────────────────────────────────────────────
// évaluation → compétence → preuve → ressource/activité → prochaine action →
// reprise avec l'enseignant. Voir __tests__/demo/utica-2026/pedagogical-chain.test.ts.

/** Preuves d'apprentissage, les plus récentes en premier ; filtrable par compétence. */
export function getLearningEvidence(competencyId?: string): DemoLearningEvidence[] {
  const all = demoScenario.learningEvidence;
  return competencyId ? all.filter((e) => e.competencyIds.includes(competencyId)) : all;
}

export interface CompetencyView {
  id: string;
  label: string;
  level: CompetencyLevel;
  /** Identique à `level` — `CompetencyLevel` EST déjà le libellé canonique affichable (P2 §4). Conservé pour ne pas changer la forme consommée par MasteryCard. */
  levelLabel: string;
  lastEvidence: { dateLabel: string; label: string; resultLabel: string } | null;
}

/** Matrice de maîtrise d'une matière (défaut : matière du focus central). Chaque compétence porte sa dernière preuve, si elle existe. */
export function getCompetencyOverview(subject: SubjectCode = getPedagogicalFocus().subject): CompetencyView[] {
  const track = demoScenario.subjectTracks.find((t) => t.subject === subject);
  if (!track) return [];
  return track.competencies.map((c) => {
    const last = getLearningEvidence(c.id)[0] ?? null;
    return {
      id: c.id,
      label: c.label,
      level: c.level,
      levelLabel: c.level,
      lastEvidence: last ? { dateLabel: last.dateLabel, label: last.label, resultLabel: last.resultLabel } : null,
    };
  });
}

export interface AssessmentTrajectoryStep {
  label: string;
  detail: string;
}

/**
 * Trajectoire qualitative (§3) : les preuves de la matière du focus, dans
 * l'ordre chronologique, puis l'activité ciblée, puis la situation actuelle
 * — jamais une moyenne, une tendance ou un score calculé à partir de
 * données non comparables.
 */
export function getAssessmentTrajectory(): AssessmentTrajectoryStep[] {
  const focus = getPedagogicalFocus();
  const chronological = getLearningEvidence()
    .filter((e) => e.subject === focus.subject)
    .slice()
    .reverse(); // learningEvidence est trié du plus récent au plus ancien.

  const steps: AssessmentTrajectoryStep[] = chronological.map((e) => ({
    label: `${e.dateLabel} — ${e.label}`,
    detail: `${e.resultLabel} — ${e.consequenceLabel}`,
  }));

  steps.push({
    label: 'Activité ciblée',
    detail: `${focus.recommendedActivityLabel} (${focus.recommendedActivityMinutes} min)`,
  });

  const currentCompetency = getCompetencyOverview(focus.subject).find((c) => c.id === focus.fragileCompetencyId);
  steps.push({
    label: 'Situation actuelle',
    detail: currentCompetency ? `${currentCompetency.label} — ${currentCompetency.levelLabel}` : focus.evidenceSummary,
  });

  return steps;
}

export function getDemoDocuments(): DemoDocument[] {
  return demoScenario.documents;
}

/** Comptage des niveaux de maîtrise sur toutes les matières suivies — utilisé pour l'unique enrichissement Vue 360° (P1C §9). */
export function getCompetencyLevelCounts(): Record<CompetencyLevel, number> {
  const counts: Record<CompetencyLevel, number> = {
    Maîtrisé: 0,
    'À consolider': 0,
    Fragile: 0,
    'Très fragile': 0,
    'Non encore vu': 0,
  };
  for (const track of demoScenario.subjectTracks) {
    for (const c of track.competencies) counts[c.level] += 1;
  }
  return counts;
}
