/**
 * Génère la fixture de QA visuelle du cockpit ARIA.
 *
 * La carte scolaire et les graphes de compétences proviennent du VRAI resolver
 * et du VRAI adaptateur : la fixture ne peut pas diverger du catalogue.
 * Seules les données de bordure (feuille de route, bilans, ressources) sont
 * représentatives, et exclusivement destinées aux captures de QA.
 *
 * Exécution : npx tsx --conditions=react-server scripts/aria/generate-cockpit-fixture.ts
 */
import { writeFileSync } from 'node:fs';
import path from 'node:path';

const OUTPUT = path.join(
  process.cwd(),
  'e2e/fixtures/aria/cockpit-terminale-eds.json',
);
import { resolveAriaCurriculum } from '@/lib/aria/curriculum/resolver';
import { getSkillGraph } from '@/lib/aria/curriculum/skill-graph';

const curriculum = resolveAriaCurriculum({
  gradeLevel: 'TERMINALE',
  academicTrack: 'EDS_GENERALE',
  specialties: ['MATHEMATIQUES', 'NSI'],
  stmgPathway: null,
  school: 'Lycée Pierre Mendès France',
  selectedCourseKeys: ['maths-terminale-eds', 'philosophie-terminale'],
  entitlements: ['aria_maths'],
});

const skillGraphs = curriculum.courses
  .filter((v) => v.course.hasSkillGraph)
  .map((v) => getSkillGraph(v.course.key))
  .filter((g) => g !== null);

const cockpit = {
  student: {
    firstName: 'Yasmine',
    lastName: 'Dupont',
    gradeLevel: 'TERMINALE',
    academicTrack: 'EDS_GENERALE',
  },
  setup: {
    state: 'READY',
    onboardingCompleted: true,
    academicProfileIncomplete: false,
    missingAcademicFields: [],
    academicProfileReadOnly: true,
  },
  profile: {
    targetSession: null,
    selectedCourseKeys: ['maths-terminale-eds', 'philosophie-terminale'],
    weeklyGoalMinutes: 180,
    learningGoals: ['PREPARER_BAC', 'CONSOLIDER_LACUNES'],
    preferences: {},
    curriculumVersion: 'v1',
    onboardingCompletedAt: '2026-08-01T10:00:00.000Z',
  },
  curriculum,
  today: {
    items: [
      { id: 'fdr-1', title: 'Revoir le chapitre « Limites et continuité »', href: '/dashboard/eleve/programme/maths', estimatedMinutes: 30, done: false, origin: 'FEUILLE_DE_ROUTE' },
      { id: 'fdr-2', title: 'QCM dérivation — 10 questions', href: '/dashboard/eleve#qcm', estimatedMinutes: 15, done: false, origin: 'FEUILLE_DE_ROUTE' },
      { id: 'fdr-3', title: 'Automatismes : calcul littéral', href: '/dashboard/eleve/automatismes', estimatedMinutes: 10, done: true, origin: 'FEUILLE_DE_ROUTE' },
    ],
    weeklyGoalMinutes: 180,
    plannedMinutes: 45,
  },
  trajectory: {
    id: 'traj-1',
    title: 'Objectif mention bien au baccalauréat',
    progress: 40,
    daysRemaining: 118,
    nextMilestone: { title: 'Bac blanc n°1', targetDate: '2026-12-01' },
    milestoneCount: 5,
    completedMilestoneCount: 2,
  },
  resources: [
    { id: 'doc-1', title: 'Fiche méthode — étude de fonction', subtitle: 'Déposée par ton coach', category: 'COACH_RESOURCE', type: 'PDF', href: '#', courseKeys: ['maths-terminale-eds'] },
    { id: 'doc-2', title: 'Annales corrigées NSI 2025', subtitle: 'Déposée par ton coach', category: 'COACH_RESOURCE', type: 'PDF', href: '#', courseKeys: ['nsi-terminale-eds'] },
    { id: 'doc-3', title: 'Mes notes de cours', category: 'USER_DOCUMENT', type: 'MARKDOWN', href: '#', courseKeys: [] },
  ],
  assessments: [
    { id: 'b-1', title: 'Mathématiques', subject: 'MATHEMATIQUES', state: 'RECENT', date: '2026-08-20T09:00:00.000Z', href: '#', globalScore: 62 },
    { id: 'b-2', title: 'NSI', subject: 'NSI', state: 'TERMINE', date: '2026-05-14T09:00:00.000Z', href: '#', globalScore: null },
  ],
  aria: { totalConversations: 7, messagesToday: 4, canUseAriaMaths: true, canUseAriaNsi: false },
  nextSession: {
    id: 's-1',
    title: 'Séance Mathématiques — dérivation',
    subject: 'MATHEMATIQUES',
    scheduledAt: '2026-09-02T14:00:00.000Z',
    coachName: 'Helios',
  },
  examContext: null,
  skillGraphs,
};

writeFileSync(
  OUTPUT,
  JSON.stringify(cockpit, null, 2),
);
console.log('courses=' + curriculum.courses.length + ' graphs=' + skillGraphs.length);
