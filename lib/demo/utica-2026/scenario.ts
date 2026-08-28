/**
 * Scénario unique du démonstrateur UTICA 2026 — "Lina B."
 *
 * SOURCE UNIQUE DE VÉRITÉ (amendement A3). Ce fichier est le seul endroit où
 * les faits fictifs du candidat sont déclarés. Les pages Parent / Élève /
 * ARIA n'affichent JAMAIS un chiffre ou un libellé recopié séparément : elles
 * consomment exclusivement les vues dérivées de `selectors.ts`.
 *
 * Toute donnée réglementaire (coefficients, épreuves) est dérivée ailleurs,
 * depuis la source canonique `data/exams/bac-general-2027.json` — voir
 * `regulatory.ts`. Rien de réglementaire n'est inventé ici.
 *
 * Volume délibérément raisonnable : ce fichier raconte UNE histoire
 * pédagogique cohérente (dérivation maîtrisée, signe de la dérivée à
 * consolider), pas une base de données fictive.
 */
import type { DemoScenario, PedagogicalFocus } from './types';
import { catalogResourceToStudentSummary, getResourceById } from './resources';

/**
 * Chiffres bruts de la preuve d'apprentissage centrale (P1C §2/§11 : aucun
 * chiffre décoratif — tout nombre affiché doit être dérivé). Déclarés une
 * seule fois ; `focus.evidenceSummary` ET l'entrée `learningEvidence`
 * correspondante en dérivent tous les deux, garantissant qu'ils ne peuvent
 * jamais diverger (amendement A3 étendu à P1C).
 */
const DERIVEES_REUSSIES = 4;
const DERIVEES_TOTAL = 5;
const SIGNE_REUSSI = 2;
const SIGNE_TOTAL = 5;

/**
 * Le fil pédagogique central, extrait en une seule constante pour que toute
 * autre partie du scénario qui parle de la même compétence (matrice de
 * compétences, tâche prioritaire) référence CET objet plutôt que de
 * recopier son libellé — garantit la cohérence par construction, pas par
 * coïncidence éditoriale (amendement A3).
 */
const focus: PedagogicalFocus = {
  subject: 'MATHEMATIQUES',
  subjectLabel: 'Mathématiques',
  masteredCompetency: 'Calcul de dérivées',
  masteredCompetencyId: 'c-maths-derivees',
  fragileCompetency: 'Signe de la dérivée',
  fragileCompetencyId: 'c-maths-signe-derivee',
  evidenceSummary:
    `Sur les ${DERIVEES_TOTAL} dernières questions travaillées : ${DERIVEES_REUSSIES} sur ${DERIVEES_TOTAL} réussies sur le calcul de dérivées, mais seulement ${SIGNE_REUSSI} sur ${SIGNE_TOTAL} sur leur interprétation (l'exploitation du signe de la dérivée pour étudier les variations).`,
  recommendedActivityLabel: 'Exercice guidé — lecture du signe de la dérivée',
  recommendedActivityMinutes: 20,
  nextTeacherSessionId: 's-maths-samedi',
};

export const demoScenario: DemoScenario = {
  student: {
    firstName: 'Lina',
    lastNameInitial: 'B.',
    status: 'Candidate individuelle — Bac général',
    level: 'Terminale générale',
    examSession: 2027,
    modalite: 'A',
    specialites: ['NSI', 'MATHEMATIQUES'],
    specialiteAbandonnee: 'SES',
    langueA: 'ANGLAIS',
    langueB: 'ESPAGNOL',
    globalStatusLabel: 'Parcours sous contrôle',
  },

  focus,

  teachers: [
    { id: 't-maths', firstName: 'Hélène', subject: 'MATHEMATIQUES', role: 'Professeure référente' },
    { id: 't-nsi', firstName: 'Karim', subject: 'NSI', role: 'Coach NSI' },
    { id: 't-philo', firstName: 'Sarah', subject: 'PHILOSOPHIE', role: 'Coach Philosophie' },
  ],

  subjectTracks: [
    {
      subject: 'MATHEMATIQUES',
      label: 'Mathématiques',
      currentChapter: 'Fonctions',
      lastCompetencyWorked: 'Étudier les variations',
      nextStep: "Résoudre un problème d'optimisation",
      lastResultLabel: '14/20',
      teacherId: 't-maths',
      competencies: [
        { id: 'c-maths-lecture-graphique', label: 'Lecture graphique', level: 'Maîtrisé' },
        { id: focus.masteredCompetencyId, label: focus.masteredCompetency, level: 'Maîtrisé' },
        { id: focus.fragileCompetencyId, label: focus.fragileCompetency, level: 'À consolider' },
        { id: 'c-maths-optimisation', label: 'Optimisation', level: 'Non encore vu' },
      ],
    },
    {
      subject: 'NSI',
      label: 'NSI',
      currentChapter: 'Structures de données',
      lastCompetencyWorked: 'Listes chaînées',
      nextStep: 'Manipuler des piles et des files',
      lastResultLabel: '16/20',
      teacherId: 't-nsi',
      competencies: [
        { id: 'c-nsi-types-construits', label: 'Types construits', level: 'Maîtrisé' },
        { id: 'c-nsi-listes-chainees', label: 'Listes chaînées', level: 'Fragile' },
        { id: 'c-nsi-piles-files', label: 'Piles et files', level: 'Non encore vu' },
      ],
    },
    {
      subject: 'PHILOSOPHIE',
      label: 'Philosophie',
      currentChapter: 'La conscience',
      lastCompetencyWorked: "Construire une problématique",
      nextStep: "S'entraîner à la dissertation",
      lastResultLabel: '12/20',
      teacherId: 't-philo',
      competencies: [
        { id: 'c-philo-analyse-notions', label: 'Analyse de notions', level: 'Maîtrisé' },
        { id: 'c-philo-problematique', label: 'Construction de problématique', level: 'Fragile' },
        { id: 'c-philo-dissertation', label: 'Rédaction de dissertation', level: 'À consolider' },
      ],
    },
  ],

  sessions: [
    {
      id: 's-maths-samedi',
      subject: 'MATHEMATIQUES',
      title: 'Séance Nexus — Fonctions : signe de la dérivée',
      dayLabel: 'Samedi',
      startTime: '10:00',
      endTime: '12:00',
      teacherId: 't-maths',
      kind: 'COURS_NEXUS',
    },
    {
      id: 's-nsi-mardi',
      subject: 'NSI',
      title: 'Séance Nexus — Structures de données',
      dayLabel: 'Mardi',
      startTime: '17:00',
      endTime: '18:30',
      teacherId: 't-nsi',
      kind: 'COURS_NEXUS',
    },
  ],

  tasks: [
    {
      id: 'task-maths-signe-derivee',
      subject: 'MATHEMATIQUES',
      label: 'Exercice ciblé — signe de la dérivée et tableau de variations',
      type: 'EXERCICE',
      estimatedMinutes: focus.recommendedActivityMinutes,
      dueLabel: "aujourd'hui",
      priority: 'HAUTE',
      status: 'A_FAIRE',
      relatedCompetency: focus.fragileCompetency,
    },
    {
      id: 'task-philo-dissertation',
      subject: 'PHILOSOPHIE',
      label: 'Devoir — dissertation sur la conscience',
      type: 'DEVOIR',
      estimatedMinutes: 90,
      dueLabel: 'vendredi',
      priority: 'MOYENNE',
      status: 'A_FAIRE',
    },
    {
      id: 'task-nsi-qcm',
      subject: 'NSI',
      label: 'QCM — structures de données linéaires',
      type: 'QCM',
      estimatedMinutes: 15,
      dueLabel: 'cette semaine',
      priority: 'MOYENNE',
      status: 'A_FAIRE',
    },
    {
      id: 'task-maths-fiche-derivees',
      subject: 'MATHEMATIQUES',
      label: 'Fiche — calcul de dérivées',
      type: 'FICHE',
      estimatedMinutes: 15,
      dueLabel: 'la semaine dernière',
      priority: 'BASSE',
      status: 'TERMINE',
      relatedCompetency: focus.masteredCompetency,
    },
  ],

  administrative: [
    {
      id: 'admin-identite',
      category: 'Identité',
      label: "Pièce d'identité déposée",
      status: 'VALIDE',
      provenance: 'ETAPE_NEXUS',
    },
    {
      id: 'admin-inscription',
      category: 'Inscription',
      label: 'Inscription candidat individuel (Cyclades — IFT)',
      status: 'EN_COURS',
      provenance: 'DEMONSTRATION',
      note: "Nexus accompagne les démarches ; l'inscription officielle reste effectuée par la famille via Cyclades, auprès de l'Institut français de Tunisie.",
    },
    {
      id: 'admin-enseignements',
      category: 'Enseignements',
      label: 'Choix des spécialités, langues et options confirmé',
      status: 'VALIDE',
      provenance: 'ETAPE_NEXUS',
    },
    {
      id: 'admin-justificatifs',
      category: 'Justificatifs',
      label: 'Bulletins et pièces du dossier',
      status: 'A_VERIFIER',
      provenance: 'ETAPE_NEXUS',
    },
    {
      id: 'admin-convocations',
      category: 'Convocations',
      label: "Convocation officielle à l'examen",
      status: 'NON_CONCERNE',
      provenance: 'DEMONSTRATION',
      note: "Transmise par l'académie de rattachement le moment venu — non disponible à ce stade.",
    },
  ],

  interventions: [
    {
      id: 'int-1',
      dateLabel: '26 août',
      label: 'Plan de travail mis à jour après le dernier exercice de mathématiques.',
      channel: 'EQUIPE_NEXUS',
      category: 'PLANNING_UPDATE',
    },
    {
      id: 'int-2',
      dateLabel: '25 août',
      label: "Analyse de l'exercice de mathématiques : dérivation maîtrisée, signe de la dérivée à consolider.",
      channel: 'EQUIPE_NEXUS',
      category: 'ANALYSIS',
    },
    {
      id: 'int-3',
      dateLabel: '24 août',
      label: 'Ressource ciblée recommandée sur le signe de la dérivée.',
      channel: 'ARIA',
      category: 'RESOURCE_RECOMMENDATION',
    },
    {
      id: 'int-4',
      dateLabel: '22 août',
      label: 'Compte rendu de la séance NSI ajouté au dossier.',
      channel: 'EQUIPE_NEXUS',
      category: 'REPORT_ADDED',
    },
  ],

  // P3.1 §3 (source unique de vérité) : les deux entrées ayant un
  // équivalent réel dans le catalogue riche (lib/demo/utica-2026/
  // resources.ts) sont dérivées de ce catalogue, jamais retapées à la
  // main — titre/compétences ne peuvent plus diverger entre les deux
  // systèmes. `res-philo-methode` n'a pas encore d'équivalent dans le
  // catalogue riche (aucun contenu Philosophie audité à ce stade) : reste
  // hand-authored, sans risque de duplication puisqu'aucune seconde source
  // n'existe pour elle.
  resources: [
    catalogResourceToStudentSummary(getResourceById('maths-b3-derivation')!),
    catalogResourceToStudentSummary(getResourceById('nsi-fiche-piles-files')!),
    {
      id: 'res-philo-methode',
      subject: 'PHILOSOPHIE',
      title: 'Vidéo — méthode de la dissertation',
      type: 'VIDEO',
      competencyIds: ['c-philo-dissertation'],
    },
  ],

  // Jalons internes Nexus (§10) — étapes d'accompagnement, jamais une
  // échéance réglementaire (celles-ci viennent de regulatory.ts).
  journeyMilestones: [
    { id: 'm-positionnement', label: 'Positionnement initial', status: 'DONE' },
    { id: 'm-consolidation-premiere', label: 'Consolidation Première', status: 'DONE' },
    { id: 'm-preparation-terminale', label: 'Préparation Terminale', status: 'CURRENT' },
    { id: 'm-entrainements', label: 'Entraînements ciblés', status: 'UPCOMING' },
    { id: 'm-examens-blancs', label: 'Examens blancs internes', status: 'UPCOMING' },
  ],

  // Planning premium (§3) — uniquement les créneaux de travail autonome/ARIA
  // sans jour déjà porté par sessions/tasks. Réutilise le libellé de
  // l'activité recommandée du focus plutôt que de le retaper (amendement A3).
  weeklyBlocks: [
    {
      id: 'wb-autonome-maths',
      dayLabel: 'Mercredi',
      subject: 'MATHEMATIQUES',
      label: focus.recommendedActivityLabel,
      kind: 'ARIA',
    },
    {
      id: 'wb-autonome-nsi',
      dayLabel: 'Jeudi',
      subject: 'NSI',
      label: 'Entraînement autonome — structures de données',
      kind: 'TRAVAIL_PERSONNEL',
    },
  ],

  // Preuves d'apprentissage (P1C §2) — chaque compétence affichée comme
  // fragile ou maîtrisée doit pouvoir désigner sa preuve. Volontairement
  // 4 entrées (§2 : "3 ou 4 preuves cohérentes suffisent"), triées de la
  // plus récente à la plus ancienne comme `interventions`. Les chiffres de
  // l'entrée sur le signe de la dérivée sont les MÊMES constantes que
  // focus.evidenceSummary — jamais un second jeu de chiffres.
  learningEvidence: [
    {
      id: 'ev-maths-signe-derivee',
      dateLabel: '25 août',
      kind: 'EXERCICE_GUIDE',
      label: 'Exercice guidé — interprétation du signe de la dérivée',
      subject: 'MATHEMATIQUES',
      competencyIds: [focus.fragileCompetencyId],
      resultLabel: `${SIGNE_REUSSI}/${SIGNE_TOTAL}`,
      consequenceLabel: 'Exploitation du signe de la dérivée : à consolider.',
    },
    {
      id: 'ev-maths-derivees',
      dateLabel: '20 août',
      kind: 'QCM',
      label: 'QCM — calcul de dérivées',
      subject: 'MATHEMATIQUES',
      competencyIds: [focus.masteredCompetencyId],
      resultLabel: `${DERIVEES_REUSSIES}/${DERIVEES_TOTAL}`,
      consequenceLabel: 'Calcul de dérivées confirmé maîtrisé.',
    },
    {
      id: 'ev-nsi-listes',
      dateLabel: '19 août',
      kind: 'QCM',
      label: 'QCM — listes chaînées',
      subject: 'NSI',
      competencyIds: ['c-nsi-listes-chainees'],
      resultLabel: '3/5',
      consequenceLabel: 'Listes chaînées en progression.',
    },
    {
      id: 'ev-philo-observation',
      dateLabel: '18 août',
      kind: 'OBSERVATION_ENSEIGNANT',
      label: 'Observation — construction de problématique',
      subject: 'PHILOSOPHIE',
      competencyIds: ['c-philo-problematique'],
      resultLabel: 'Observation qualitative',
      consequenceLabel: 'Construction de problématique en progrès, rédaction encore à consolider.',
    },
  ],

  // Coffre documentaire (§5) — métadonnées purement démonstratives, aucun
  // fichier réel, aucun stockage connecté (amendement A7).
  documents: [
    { id: 'doc-bilan-initial', category: 'BILAN', title: 'Bilan initial — positionnement', dateLabel: 'Août 2026' },
    { id: 'doc-cr-mensuel', category: 'COMPTE_RENDU', title: 'Compte rendu pédagogique — août', dateLabel: '26 août' },
    { id: 'doc-planning', category: 'PLANNING', title: 'Planning prévisionnel — session 2027', dateLabel: 'Août 2026' },
    {
      id: 'doc-correction-qcm',
      category: 'CORRECTION',
      title: 'Correction — QCM calcul de dérivées',
      dateLabel: '20 août',
    },
  ],
};
