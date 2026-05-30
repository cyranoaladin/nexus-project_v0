import type { EamPremiereMission } from "./types";

const allowedStatuses = ["todo", "in-progress", "secured"] as const;

export const EAM_PREMIERE_EXAM_DATE = "2026-06-08";
export const EAM_PREMIERE_SPRINT_TOTAL_HOURS = 10;

export const eamPremiereSprintMissions: EamPremiereMission[] = [
  {
    id: "eam-premiere-session-1",
    sessionNumber: 1,
    dateLabel: "Samedi 30 mai - 10h30",
    durationHours: 2,
    title: "Diagnostic express et automatismes non negociables",
    objective: "Installer un plan de guerre individuel et securiser les points rapides du QCM.",
    competencies: ["automatismes", "strategie-examen", "redaction"],
    exercises: [
      {
        title: "QCM flash type epreuve",
        format: "12 questions courtes, correction active question par question",
        durationMinutes: 28,
        expectedOutput: "Liste des automatismes a reprendre dans les 48h.",
      },
      {
        title: "Correction minute",
        format: "Chaque erreur est classee : calcul, consigne, vocabulaire ou methode",
        durationMinutes: 35,
        expectedOutput: "Fiche personnelle des trois pertes de points prioritaires.",
      },
    ],
    frequentMistakes: [
      "Confondre taux d'evolution et coefficient multiplicateur.",
      "Ne pas controler le domaine avant un tableau de signes.",
      "Lire une valeur graphique sans nommer sa nature.",
    ],
    deliverable: "Fiche 48h : automatismes a securiser, ordre de travail, score de depart.",
    homework: {
      durationMinutes: 30,
      tasks: [
        "Refaire les 10 automatismes rates ou hesitants.",
        "Noter une phrase de correction par erreur.",
        "Relire la strategie QCM en 5 minutes.",
      ],
      correctionMode: "Auto-correction rapide puis reprise en debut de seance suivante.",
    },
    priority: "P0",
    allowedStatuses: [...allowedStatuses],
  },
  {
    id: "eam-premiere-session-2",
    sessionNumber: 2,
    dateLabel: "Seance 2",
    durationHours: 2,
    title: "Fonctions, derivation, variations, optimisation",
    objective: "Transformer une etude de fonction en points surs : derivee, signe, tableau, conclusion.",
    competencies: ["fonctions", "lecture-graphique", "redaction"],
    exercises: [
      {
        title: "Derivee et signe",
        format: "Trois fonctions courtes, dont une avec exponentielle",
        durationMinutes: 35,
        expectedOutput: "Tableau borne au bon domaine.",
      },
      {
        title: "Extrema et lecture graphique",
        format: "Questions ouvertes avec conclusion imposee",
        durationMinutes: 35,
        expectedOutput: "Maximum/minimum nommes avec valeur et lieu.",
      },
    ],
    frequentMistakes: [
      "Utiliser moins l'infini ou plus l'infini hors domaine.",
      "Donner la valeur d'un extremum sans dire ou elle est atteinte.",
      "Oublier de distinguer coupe et tangence sur un graphique.",
    ],
    deliverable: "Tableau de variations propre + trois conclusions redigees en version examen.",
    homework: {
      durationMinutes: 35,
      tasks: [
        "Refaire un tableau de signes strictement sur l'intervalle donne.",
        "Ecrire trois conclusions d'extrema avec valeur et abscisse.",
        "Revoir la fiche tangent/contact/intersection.",
      ],
      correctionMode: "Controle oral au demarrage de la seance suivante.",
    },
    priority: "P0",
    allowedStatuses: [...allowedStatuses],
  },
  {
    id: "eam-premiere-session-3",
    sessionNumber: 3,
    dateLabel: "Seance 3",
    durationHours: 2,
    title: "Suites, evolutions, pourcentages et lecture de consigne",
    objective: "Identifier le modele multiplicatif et eviter les erreurs de seuil ou d'interpretation.",
    competencies: ["suites", "automatismes", "strategie-examen"],
    exercises: [
      {
        title: "Modele multiplicatif",
        format: "Evolution composee, taux reciproque et suite geometrique",
        durationMinutes: 30,
        expectedOutput: "Coefficient, raison et phrase d'interpretation.",
      },
      {
        title: "Seuil sans logarithme",
        format: "Tableau et pseudo-code mental",
        durationMinutes: 30,
        expectedOutput: "Rang du seuil et date interpretee.",
      },
    ],
    frequentMistakes: [
      "Additionner des taux successifs au lieu de composer les coefficients.",
      "Confondre rang de la suite et date reelle.",
      "Ecrire une formule de suite sans definir premier terme et raison.",
    ],
    deliverable: "Carte methode : suite geometrique, seuil, taux reciproque.",
    homework: {
      durationMinutes: 30,
      tasks: [
        "Faire un exercice de seuil en tableau.",
        "Corriger deux erreurs de pourcentage issues du diagnostic.",
        "Relire les mots de consigne : depasse, atteint, strictement superieur.",
      ],
      correctionMode: "Correction par comparaison avec une grille courte.",
    },
    priority: "P0",
    allowedStatuses: [...allowedStatuses],
  },
  {
    id: "eam-premiere-session-4",
    sessionNumber: 4,
    dateLabel: "Seance 4",
    durationHours: 2,
    title: "Probabilites, variables aleatoires, arbres et esperance",
    objective: "Rendre les arbres et les lois de probabilite automatiques, lisibles et justifies.",
    competencies: ["probabilites", "variables-aleatoires", "redaction"],
    exercises: [
      {
        title: "Arbre pondere complet",
        format: "Intersection, conditionnement inverse et probabilites totales",
        durationMinutes: 35,
        expectedOutput: "Chemins marques et formules explicites.",
      },
      {
        title: "Variable aleatoire",
        format: "Loi, esperance, interpretation",
        durationMinutes: 30,
        expectedOutput: "Tableau de loi complet et phrase de gain moyen.",
      },
    ],
    frequentMistakes: [
      "Diviser par la mauvaise probabilite dans une conditionnelle.",
      "Oublier de verifier que la somme des probabilites vaut 1.",
      "Donner une esperance sans unite ni interpretation.",
    ],
    deliverable: "Une page arbres/variables aleatoires avec deux modeles corriges.",
    homework: {
      durationMinutes: 35,
      tasks: [
        "Refaire un arbre et entourer les chemins utilises.",
        "Calculer une esperance et ecrire sa signification.",
        "Revoir les notations P_A(B), P(A inter B), P(B).",
      ],
      correctionMode: "Relecture ciblee sur notation et phrase finale.",
    },
    priority: "P1",
    allowedStatuses: [...allowedStatuses],
  },
  {
    id: "eam-premiere-session-5",
    sessionNumber: 5,
    dateLabel: "Seance 5",
    durationHours: 2,
    title: "Sujet blanc strategique et methode d'examen",
    objective: "Simuler l'epreuve, choisir l'ordre rentable et repartir avec une grille de relecture.",
    competencies: ["strategie-examen", "redaction", "automatismes", "fonctions"],
    exercises: [
      {
        title: "Sujet blanc condense",
        format: "QCM puis exercices ouverts chronometres",
        durationMinutes: 75,
        expectedOutput: "Copie annotee avec points surs et points recuperables.",
      },
      {
        title: "Debrief methode",
        format: "Analyse des pertes de points et ordre de traitement",
        durationMinutes: 25,
        expectedOutput: "Checklist personnelle de veille d'epreuve.",
      },
    ],
    frequentMistakes: [
      "Rester bloque trop longtemps sur une question non rentable.",
      "Ne pas relire unites, arrondis et domaine.",
      "Laisser une question ouverte sans phrase de conclusion.",
    ],
    deliverable: "Grille de relecture finale + ordre de bataille pour le 8 juin.",
    homework: {
      durationMinutes: 25,
      tasks: [
        "Relire uniquement les erreurs recuperees.",
        "Faire 10 automatismes faciles pour garder la main.",
        "Preparer le kit veille d'epreuve.",
      ],
      correctionMode: "Auto-validation avec checklist finale.",
    },
    priority: "P0",
    allowedStatuses: [...allowedStatuses],
  },
];
