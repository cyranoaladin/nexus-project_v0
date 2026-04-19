/**
 * Structure officielle de l'épreuve anticipée de Mathématiques (Première)
 * Format : 120 minutes (2h)
 * Calculatrice : INTERDITE
 */

export interface EpreuveSection {
  id: string;
  nom: string;
  points: number;
  description: string;
  strategie: string;
  dureeRecommandee: number; // en minutes
}

export const EPREUVE_MATHS_1ERE = {
  titre: "Épreuve anticipée de Mathématiques",
  dureeMinutes: 120,
  duree: 120, // Alias pour compatibilité
  calculatrice: "Interdite",
  totalPoints: 20,
  parties: [
    {
      id: "automatismes",
      nom: "Partie 1 : Automatismes",
      points: 6,
      description: "Série de questions courtes (calcul mental, lecture graphique, rappels de cours).",
      strategie: "À faire en 20 minutes maximum. Visez le 6/6 sans hésitation.",
      dureeRecommandee: 20
    },
    {
      id: "exercices",
      nom: "Partie 2 : Exercices de Raisonnement",
      points: 14,
      description: "3 exercices longs portant sur les thèmes majeurs (Suites, Fonctions, Probabilités).",
      strategie: "Soignez la rédaction et la justification. Un résultat juste sans démonstration perd 50% des points.",
      dureeRecommandee: 100
    }
  ] as EpreuveSection[],
  competencesCibles: [
    "Chercher",
    "Modéliser",
    "Représenter",
    "Calculer",
    "Raisonner",
    "Communiquer"
  ],
  erreursFréquentes: [
    "Oubli du signe lors d'une division par un négatif dans une inéquation.",
    "Mauvaise lecture graphique des coefficients directeurs.",
    "Oubli de préciser l'unité de l'axe des ordonnées.",
    "Justification incomplète de la nature d'une suite.",
    "Confusion entre probabilité conditionnelle et intersection."
  ],
  conseilsGeneraux: [
    "Arrivez 15 minutes en avance pour stabiliser votre stress.",
    "Lisez l'intégralité du sujet avant de commencer.",
    "Commencez par les automatismes (20 min chrono).",
    "Ne restez pas bloqué plus de 5 minutes sur une question.",
    "Gardez 10 minutes à la fin pour la relecture."
  ]
};

export const SUJET_BLANC_1 = {
  id: "sb1",
  titre: "Sujet Blanc #1 — Printemps 2026",
  automatismes: [
    { id: "a1", question: "Calculer $25\%$ de $84$.", reponse: "21", points: 1 },
    { id: "a2", question: "Donner la forme canonique de $x^2 - 4x + 3$.", reponse: "$(x-2)^2 - 1$", points: 1 }
  ],
  exercices: [
    {
      id: "ex1",
      titre: "Suites et Modélisation",
      points: 5,
      ennonce: "Une population de bactéries double toutes les heures...",
      piegesClassiques: ["Oubli de l'indice n=0", "Confusion arithmétique/géométrique"],
      questions: [
        { id: "q1", texte: "Déterminer la nature de la suite.", competences: ["MODÉLISER"], solution: ["On observe que $u_{n+1} = 2u_n$", "C'est une suite géométrique."] }
      ]
    }
  ]
};

