import type { CourseSheet, Domain } from "./types";

// SOURCE: 02_Premiere_STMG + Annexes, BO spécial n°1 du 22/01/2019.
export const DOMAINS: Domain[] = [
  {
    id: "fonctions",
    label: "Fonctions",
    shortLabel: "Fonctions",
    description: "Variations, extrema, lecture graphique, fonctions de référence et second degré en contexte STMG.",
    notions: ["Variations", "Extrema", "Lecture graphique", "Affine", "Carré", "Inverse", "Racine", "Exponentielle", "Second degré", "Équations et inéquations"],
    methods: ["Lire les images et antécédents avant de calculer.", "Utiliser le tableau de variations pour comparer deux valeurs.", "Pour un trinôme, repérer sommet, racines et signe avec une méthode courte."],
    traps: ["Confondre image et antécédent.", "Oublier qu’une lecture graphique reste approximative.", "Utiliser une méthode hors programme STMG."],
    formulas: [
      { label: "Affine", latex: "f(x)=ax+b" },
      { label: "Sommet second degré", latex: "\\alpha=-\\frac{b}{2a}" },
      { label: "Discriminant", latex: "\\Delta=b^2-4ac" },
    ],
  },
  {
    id: "suites",
    label: "Suites numériques",
    shortLabel: "Suites",
    description: "Suites arithmétiques, géométriques et applications financières spécifiques STMG.",
    notions: ["Raison", "Terme général", "Somme", "Intérêts simples", "Intérêts composés", "Taux d’évolution", "Remboursements"],
    methods: ["Différence constante pour l’arithmétique, quotient constant pour la géométrique.", "Transformer un taux en coefficient multiplicateur avant de répéter une évolution.", "Vérifier le rang de départ avant d’écrire le terme général."],
    traps: ["Ajouter un taux au lieu de multiplier.", "Mélanger terme et somme.", "Oublier le premier terme dans le modèle financier."],
    formulas: [
      { label: "Arithmétique", latex: "u_n=u_0+nr" },
      { label: "Géométrique", latex: "u_n=u_0q^n" },
      { label: "Intérêts composés", latex: "C_n=C_0(1+t)^n" },
    ],
  },
  {
    id: "statistiques",
    label: "Statistiques",
    shortLabel: "Stats",
    description: "Indicateurs de position et de dispersion, représentations et ajustement affine.",
    notions: ["Moyenne", "Médiane", "Quartiles", "Étendue", "Écart interquartile", "Écart-type", "Histogramme", "Boîte à moustaches", "Nuage de points", "Régression affine"],
    methods: ["Ordonner les données avant médiane et quartiles.", "Comparer deux séries avec un indicateur de centre et un indicateur de dispersion.", "Interpréter la pente d’une droite d’ajustement dans l’unité du contexte."],
    traps: ["Calculer la médiane sur des données non ordonnées.", "Confondre fréquence et effectif.", "Conclure avec la moyenne seule."],
    formulas: [
      { label: "Moyenne", latex: "\\bar{x}=\\frac{n_1x_1+\\cdots+n_px_p}{N}" },
      { label: "Étendue", latex: "\\max-\\min" },
      { label: "Droite d’ajustement", latex: "y=ax+b" },
    ],
  },
  {
    id: "probabilites",
    label: "Probabilités",
    shortLabel: "Probas",
    description: "Univers fini, arbres, probabilités conditionnelles, indépendance, variable aléatoire et espérance.",
    notions: ["Univers fini", "Arbres", "Conditionnelles", "Indépendance", "Variable aléatoire", "Espérance"],
    methods: ["Multiplier le long d’un chemin d’arbre.", "Additionner les chemins incompatibles qui mènent au même événement.", "Tester l’indépendance avec le produit des probabilités."],
    traps: ["Inverser la condition dans une probabilité conditionnelle.", "Oublier que la somme des probabilités vaut 1.", "Confondre espérance et gain certain."],
    formulas: [
      { label: "Conditionnelle", latex: "P_A(B)=\\frac{P(A\\cap B)}{P(A)}" },
      { label: "Totales", latex: "P(B)=P(A)P_A(B)+P(\\bar A)P_{\\bar A}(B)" },
      { label: "Espérance", latex: "E(X)=\\sum x_iP(X=x_i)" },
    ],
  },
  {
    id: "algorithmique-information",
    label: "Algorithmique & information chiffrée",
    shortLabel: "Algo & %",
    description: "Proportions, pourcentages, indices, taux d’évolution et lecture de programmes Python simples.",
    notions: ["Proportions", "Pourcentages", "Taux d’évolution", "Indices", "Variables Python", "Boucles", "Conditions"],
    methods: ["Passer systématiquement par le coefficient multiplicateur.", "Exécuter un algorithme ligne par ligne avec un tableau de variables.", "Contrôler un résultat avec un ordre de grandeur mental."],
    traps: ["Additionner deux pourcentages successifs.", "Lire un indice comme une valeur brute.", "Oublier l’initialisation d’une variable."],
    formulas: [
      { label: "Proportion", latex: "p=\\frac{\\text{partie}}{\\text{total}}" },
      { label: "Coefficient multiplicateur", latex: "CM=1+\\frac{t}{100}" },
      { label: "Indice base 100", latex: "I=\\frac{V}{V_0}\\times100" },
    ],
  },
];

export const COURSE_SHEETS: CourseSheet[] = DOMAINS.map((domain) => ({
  domainId: domain.id,
  title: `Fiche synthèse — ${domain.label}`,
  blocks: [
    { title: "À retenir", lines: domain.notions.slice(0, 6).map((notion) => `${notion} : savoir définir, reconnaître et appliquer dans un contexte STMG.`) },
    { title: "Méthodes", lines: domain.methods },
    { title: "Pièges fréquents", lines: domain.traps },
  ],
}));

export function getDomain(id: Domain["id"]) {
  return DOMAINS.find((domain) => domain.id === id);
}
