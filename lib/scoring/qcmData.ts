export type DomainKey =
  | "Calcul littéral & équations"
  | "Fonctions & graphes"
  | "Géométrie vectorielle & repérée"
  | "Trigonométrie"
  | "Probabilités & statistiques"
  | "Algorithmique & logique";

export type QcmOption = { key: string; label: string };
export type QcmQuestion = {
  id: string;
  domain: DomainKey;
  weight: number; // 1, 2, 3 points
  prompt: string;
  type: "single" | "free"; // single = choix A/B/C/D, free = texte/numérique simple
  options?: QcmOption[]; // requis si type=single
  correct: string | string[]; // clé de réponse attendue (ex: "A"), ou valeur normalisée pour free
};

// NOTE: Banque réduite pour MVP. À compléter avec les 40 questions exactes.
export const QCM_QUESTIONS: QcmQuestion[] = [
  {
    id: "Q1",
    domain: "Calcul littéral & équations",
    weight: 1,
    prompt: "Développer : (x+2)(x−3).",
    type: "single",
    options: [
      { key: "A", label: "x^2 − x − 6" },
      { key: "B", label: "x^2 − x + 6" },
      { key: "C", label: "x^2 − 5x − 6" },
      { key: "D", label: "x^2 − x − 2" },
    ],
    correct: "A",
  },
  {
    id: "Q2",
    domain: "Calcul littéral & équations",
    weight: 1,
    prompt: "Factoriser : x^2 − 9.",
    type: "single",
    options: [
      { key: "A", label: "(x−9)(x+1)" },
      { key: "B", label: "(x−3)(x+3)" },
      { key: "C", label: "(x−9)(x−1)" },
      { key: "D", label: "(x−1)(x+9)" },
    ],
    correct: "B",
  },
  {
    id: "Q3",
    domain: "Calcul littéral & équations",
    weight: 1,
    prompt: "Résoudre : 2x+5=11.",
    type: "free",
    correct: "3",
  },
  {
    id: "Q4",
    domain: "Calcul littéral & équations",
    weight: 2,
    prompt: "Résoudre : x^2 −5x +6 = 0.",
    type: "single",
    options: [
      { key: "A", label: "x=2 ou x=3" },
      { key: "B", label: "x=1 ou x=6" },
      { key: "C", label: "x=−2 ou x=3" },
      { key: "D", label: "Aucun réel" },
    ],
    correct: "A",
  },
  {
    id: "Q5",
    domain: "Calcul littéral & équations",
    weight: 2,
    prompt: "L’équation 3x^2 + 2x + 1 = 0 a :",
    type: "single",
    options: [
      { key: "A", label: "2 solutions réelles distinctes" },
      { key: "B", label: "1 solution double" },
      { key: "C", label: "Aucune solution réelle" },
      { key: "D", label: "Une infinité de solutions" },
    ],
    correct: "C",
  },
  {
    id: "Q9",
    domain: "Fonctions & graphes",
    weight: 1,
    prompt: "La fonction affine f(x)=3x−2 est :",
    type: "single",
    options: [
      { key: "A", label: "Croissante" },
      { key: "B", label: "Décroissante" },
      { key: "C", label: "Constante" },
      { key: "D", label: "Non définie" },
    ],
    correct: "A",
  },
  {
    id: "Q10",
    domain: "Fonctions & graphes",
    weight: 1,
    prompt: "La fonction carré f(x)=x^2 est :",
    type: "single",
    options: [
      { key: "A", label: "Croissante sur R" },
      { key: "B", label: "Décroissante sur R+" },
      { key: "C", label: "Croissante sur [0,+∞[" },
      { key: "D", label: "Constante" },
    ],
    correct: "C",
  },
  {
    id: "Q16",
    domain: "Géométrie vectorielle & repérée",
    weight: 2,
    prompt: "u=(2,1) et v=(4,2). Alors v est :",
    type: "single",
    options: [
      { key: "A", label: "colinéaire à u" },
      { key: "B", label: "orthogonal à u" },
      { key: "C", label: "de norme 1" },
      { key: "D", label: "aucune des réponses" },
    ],
    correct: "A",
  },
  {
    id: "Q23",
    domain: "Trigonométrie",
    weight: 2,
    prompt: "Sur le cercle trigonométrique, l’angle π/6 a pour coordonnées :",
    type: "single",
    options: [
      { key: "A", label: "(√3/2, 1/2)" },
      { key: "B", label: "(1/2, √3/2)" },
      { key: "C", label: "(−√3/2, 1/2)" },
      { key: "D", label: "(1/2, −√3/2)" },
    ],
    correct: "A",
  },
  {
    id: "Q28",
    domain: "Probabilités & statistiques",
    weight: 1,
    prompt: "Une pièce équilibrée : P(Pile) = ?",
    type: "single",
    options: [
      { key: "A", label: "1/2" },
      { key: "B", label: "1/3" },
      { key: "C", label: "2/3" },
      { key: "D", label: "1" },
    ],
    correct: "A",
  },
  {
    id: "Q35",
    domain: "Algorithmique & logique",
    weight: 1,
    prompt: "En Python, for i in range(3): print(i) affiche :",
    type: "single",
    options: [
      { key: "A", label: "0 1 2" },
      { key: "B", label: "1 2 3" },
      { key: "C", label: "0 1 2 3" },
      { key: "D", label: "2 1 0" },
    ],
    correct: "A",
  },
];

