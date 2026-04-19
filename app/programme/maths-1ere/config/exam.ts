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
}

export const EPREUVE_MATHS_1ERE = {
  titre: "Épreuve anticipée de Mathématiques",
  dureeMinutes: 120,
  calculatrice: "Interdite",
  totalPoints: 20,
  parties: [
    {
      id: "automatismes",
      nom: "Partie 1 : Automatismes",
      points: 6,
      description: "Série de questions courtes (calcul mental, lecture graphique, rappels de cours).",
      strategie: "À faire en 20 minutes maximum. Visez le 6/6 sans hésitation."
    },
    {
      id: "exercices",
      nom: "Partie 2 : Exercices de Raisonnement",
      points: 14,
      description: "3 exercices longs portant sur les thèmes majeurs (Suites, Fonctions, Probabilités).",
      strategie: "Soignez la rédaction et la justification. Un résultat juste sans démonstration perd 50% des points."
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
  ]
};
