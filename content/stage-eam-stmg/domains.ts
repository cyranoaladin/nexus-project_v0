import type { CourseSheet, Domain } from "./types";

// SOURCE: 02_Premiere_STMG + Annexes, BO spécial n°1 du 22/01/2019.
export const DOMAINS: Domain[] = [
  {
    id: "fonctions",
    label: "Fonctions",
    shortLabel: "Fonctions",
    description: "Lecture graphique, fonctions affines, second degré sous forme factorisée/canonique et degré 3 en contexte STMG.",
    notions: ["Images et antécédents", "Signe graphique", "Variations", "Affine", "Second degré factorisé", "Forme canonique", "Axe de symétrie", "Degré 3", "Racine cubique", "Équations et inéquations graphiques"],
    methods: ["Lire les images et antécédents avant de calculer.", "Pour une forme factorisée, lire les racines puis dresser le signe.", "Pour $a-(x-\\alpha)^2$, repérer directement l’extremum et l’axe $x=\\alpha$.", "Pour $x^3=c$, utiliser la racine cubique $\\sqrt[3]{c}$."],
    traps: ["Confondre image et antécédent.", "Oublier qu’une lecture graphique reste approximative.", "Utiliser le discriminant, hors-programme en Première STMG.", "Chercher une formule automatique au lieu d’exploiter la forme donnée."],
    formulas: [
      { label: "Affine", latex: "f(x)=ax+b" },
      { label: "Second degré factorisé", latex: "f(x)=a(x-x_1)(x-x_2)" },
      { label: "Forme canonique type", latex: "f(x)=a-(x-\\alpha)^2" },
      { label: "Degré 3", latex: "f(x)=ax^3+b" },
      { label: "Racine cubique", latex: "x^3=c \\Longleftrightarrow x=\\sqrt[3]{c}" },
    ],
  },
  {
    id: "derivation",
    label: "Dérivation",
    shortLabel: "Dérivée",
    description: "Nombre dérivé, tangente, dérivée d’un polynôme de degré au plus 3, variations et coût marginal.",
    notions: ["Nombre dérivé", "Coefficient directeur de tangente", "Équation de tangente", "Fonction dérivée", "Dérivée de $x^2$", "Dérivée de $x^3$", "Signe de $f'$", "Tableau de variations", "Extremum", "Coût marginal"],
    methods: ["Lire $f(a)$ et $f'(a)$ avant d’écrire la tangente.", "Écrire la tangente sous la forme $y=f'(a)(x-a)+f(a)$.", "Étudier le signe de $f'$ pour déduire les variations de $f$.", "Interpréter la dérivée comme une vitesse instantanée ou un coût marginal."],
    traps: ["Confondre $f(a)$ et $f'(a)$.", "Oublier le point de passage dans l’équation de tangente.", "Déduire les variations de $f$ sans justifier le signe de $f'$.", "Traiter un extremum comme une valeur toujours positive."],
    formulas: [
      { label: "Tangente en $a$", latex: "y=f'(a)(x-a)+f(a)" },
      { label: "Dérivées de base", latex: "(x^2)'=2x\\quad ;\\quad (x^3)'=3x^2" },
      { label: "Linéarité", latex: "(u+v)'=u'+v'\\quad ;\\quad (ku)'=ku'" },
      { label: "Variations", latex: "f'>0 \\Rightarrow f\\ \\text{croissante}" },
    ],
  },
  {
    id: "suites",
    label: "Suites numériques",
    shortLabel: "Suites",
    description: "Suites par récurrence, raison, tableur, seuils et sommes utiles aux contextes financiers STMG.",
    notions: ["Relation de récurrence", "Raison arithmétique", "Raison géométrique", "Somme de termes", "Intérêts simples", "Intérêts composés", "Formule tableur à étirer", "Algorithme de seuil", "Sens de variation"],
    methods: ["Différence constante pour l’arithmétique, quotient constant pour la géométrique.", "Écrire d’abord $u_{n+1}$ en fonction de $u_n$.", "Transformer un taux en coefficient multiplicateur avant de répéter une évolution.", "Déterminer un rang par tableau ou algorithme quand la formule explicite n’est pas demandée."],
    traps: ["Imposer un terme général fermé alors que la récurrence suffit en Première STMG.", "Ajouter un taux au lieu de multiplier.", "Mélanger terme et somme.", "Oublier le rang de départ dans un tableau."],
    formulas: [
      { label: "Arithmétique", latex: "u_{n+1}=u_n+r" },
      { label: "Géométrique", latex: "u_{n+1}=q\\,u_n" },
      { label: "Intérêts composés", latex: "C_{n+1}=(1+t)C_n" },
      { label: "Somme fournie", latex: "S=u_0+u_1+\\cdots+u_n" },
    ],
  },
  {
    id: "statistiques",
    label: "Statistiques",
    shortLabel: "Stats",
    description: "Tableaux croisés, fréquences marginales et conditionnelles, indicateurs et représentations statistiques.",
    notions: ["Tableau croisé d’effectifs", "Fréquence marginale", "Fréquence conditionnelle", "Moyenne", "Médiane", "Quartiles", "Étendue", "Écart interquartile", "Écart-type", "Boîte à moustaches", "Histogramme", "Nuage de points"],
    methods: ["Ordonner les données avant médiane et quartiles.", "Lire une fréquence conditionnelle dans la bonne ligne ou colonne.", "Comparer deux séries avec un indicateur de centre et un indicateur de dispersion.", "Compléter un tableau croisé par totaux de lignes et de colonnes."],
    traps: ["Calculer la médiane sur des données non ordonnées.", "Confondre fréquence conditionnelle et fréquence marginale.", "Conclure avec la moyenne seule."],
    formulas: [
      { label: "Moyenne", latex: "\\bar{x}=\\frac{n_1x_1+\\cdots+n_px_p}{N}" },
      { label: "Étendue", latex: "\\max-\\min" },
      { label: "Fréquence conditionnelle", latex: "f_A(B)=\\frac{\\text{effectif de }A\\cap B}{\\text{effectif de }A}" },
    ],
  },
  {
    id: "probabilites",
    label: "Probabilités",
    shortLabel: "Probas",
    description: "Probabilités conditionnelles via tableau, épreuves indépendantes, Bernoulli jusqu’à quatre répétitions, variable aléatoire et espérance.",
    notions: ["Univers fini", "Contraire", "Conditionnelle par tableau", "Intersection", "Épreuves indépendantes", "Bernoulli", "Répétition jusqu’à 4 essais", "Variable aléatoire", "Loi", "Espérance"],
    methods: ["Distinguer $P(A\\cap B)$, $P_A(B)$ et $P_B(A)$.", "Pour deux épreuves indépendantes, multiplier les probabilités.", "Pour exactement un succès sur deux essais, additionner les deux chemins possibles.", "Vérifier qu’une loi totalise $1$ avant de calculer l’espérance."],
    traps: ["Inverser la condition dans une probabilité conditionnelle.", "Confondre intersection et conditionnelle.", "Oublier que la somme des probabilités vaut 1.", "Confondre espérance et gain certain."],
    formulas: [
      { label: "Conditionnelle", latex: "P_A(B)=\\frac{P(A\\cap B)}{P(A)}" },
      { label: "Indépendance", latex: "P(A\\cap B)=P(A)P(B)" },
      { label: "Bernoulli", latex: "P(S)=p\\quad ;\\quad P(\\bar S)=1-p" },
      { label: "Espérance", latex: "E(X)=\\sum x_iP(X=x_i)" },
    ],
  },
  {
    id: "algorithmique-tableur",
    label: "Algorithmique & tableur",
    shortLabel: "Algo/Tableur",
    description: "Proportions, évolutions, indices, affectations, boucles, accumulateurs, listes et formules tableur à étirer.",
    notions: ["Proportions", "Pourcentages", "Taux d’évolution", "Indice base 100", "Taux réciproque", "Affectation", "Compteur", "Accumulateur", "Boucle", "Condition", "Liste", "Formule tableur"],
    methods: ["Passer systématiquement par le coefficient multiplicateur.", "Exécuter un algorithme ligne par ligne avec un tableau de variables.", "Identifier compteur et accumulateur avant de lire une boucle.", "Contrôler un résultat avec un ordre de grandeur mental."],
    traps: ["Additionner deux pourcentages successifs.", "Lire un indice comme une valeur brute.", "Oublier l’initialisation d’une variable.", "Oublier qu’une formule tableur doit pouvoir être étirée."],
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
