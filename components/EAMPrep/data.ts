import type { EAMModule, PlanDay, StageSession, WeekendProtocolDay } from "./types";

export const EXAM_DATE = new Date("2026-06-08T08:00:00+02:00");

const DAY_MS = 86_400_000;

function toLocalDateKey(date: Date) {
  const parts = new Intl.DateTimeFormat("fr-FR", {
    timeZone: "Europe/Paris",
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
  }).formatToParts(date);
  const byType = Object.fromEntries(parts.map((part) => [part.type, part.value]));
  return `${byType.year}-${byType.month}-${byType.day}`;
}

function formatShortDate(isoDate: string) {
  const [year, month, day] = isoDate.split("-").map(Number);
  return new Intl.DateTimeFormat("fr-FR", { day: "numeric", month: "long" }).format(
    new Date(year, month - 1, day)
  );
}

export function getDaysUntilExam(baseDate = new Date()): number {
  return Math.ceil((EXAM_DATE.getTime() - baseDate.getTime()) / DAY_MS);
}

export function isToday(isoDate: string, baseDate = new Date()): boolean {
  return isoDate === toLocalDateKey(baseDate);
}

export function getPlanDayMeta(day: PlanDay, baseDate = new Date()) {
  const target = new Date(`${day.date}T08:00:00+02:00`);
  const daysUntilExam = getDaysUntilExam(target);
  const isFinalDay = Boolean(day.final) || daysUntilExam === 0;

  return {
    displayDate: formatShortDate(day.date),
    isCurrentDay: isToday(day.date, baseDate),
    isFinalDay,
    jLabel: isFinalDay ? "EXAMEN" : `J-${daysUntilExam}`,
  };
}

export const MODULES: EAMModule[] = [
  {
    id: "auto",
    title: "Automatismes",
    subtitle: "QCM - Partie 1 (6 pts)",
    icon: "⚡",
    color: "#00e5ff",
    tag: "INCONTOURNABLE",
    formules: [
      { title: "Taux d'évolution", content: String.raw`\tau=\frac{V_f-V_i}{V_i}\times 100` },
      { title: "Coefficient multiplicateur", content: String.raw`+t\% \Rightarrow \times\left(1+\frac{t}{100}\right),\quad -t\% \Rightarrow \times\left(1-\frac{t}{100}\right)` },
      { title: "Taux réciproque", content: String.raw`\left(\frac{1}{k}-1\right)\times 100` },
      { title: "Taux global", content: String.raw`(k_1k_2\cdots k_n-1)\times 100` },
      { title: "Coefficient directeur", content: String.raw`a=\frac{y_B-y_A}{x_B-x_A}` },
      { title: "Identités remarquables", content: String.raw`(a\pm b)^2=a^2\pm 2ab+b^2,\quad (a+b)(a-b)=a^2-b^2` },
      { title: "Probabilités totales", content: String.raw`P(B)=P(A)P_A(B)+P(\overline A)P_{\overline A}(B)` },
    ],
    methodes: [
      "Tableau de signes : identifier les racines, puis tester un signe entre chaque intervalle.",
      "Équation produit nul : un produit est nul si l'un de ses facteurs est nul.",
      "Lecture graphique : repérer l'origine et les unités avant tout calcul.",
      "Probabilité conditionnelle : identifier l'événement placé après « sachant ».",
      "Développement : isoler les deux termes avant d'utiliser l'identité remarquable.",
    ],
    errors: [
      "Confondre taux d'évolution et coefficient multiplicateur.",
      "Oublier les deux solutions pour une équation du type carré égal à un nombre positif.",
      "Confondre probabilité conditionnelle et probabilité d'intersection.",
    ],
    questions: [
      { q: "Tablette à 200 euros, diminution de 30 %. Nouveau prix :", r: ["140 euros", "170 euros", "194 euros", "197 euros"], c: 0, ex: "On multiplie par 0,70 : le nouveau prix est 140 euros." },
      { q: "Une baisse de 50 % puis une hausse de 50 % équivaut à :", r: ["Réduction de 50 %", "Réduction de 25 %", "Augmentation de 25 %", "Augmentation de 75 %"], c: 1, ex: "Les coefficients se composent : 0,50 puis 1,50 donnent 0,75, soit une baisse globale de 25 %." },
      { q: "Coefficient directeur de A(0 ; -1) vers B(2 ; 5) :", r: ["-1/2", "2", "3", "1/3"], c: 2, ex: "La variation verticale vaut 6 et la variation horizontale vaut 2, donc le coefficient directeur vaut 3." },
      { q: "Solutions réelles de l'équation x² = 10 :", r: ["{-5 ; 5}", "{-√5 ; √5}", "{-√10 ; √10}", "ensemble vide"], c: 2, ex: "Un carré égal à 10 donne deux solutions : -√10 et √10." },
      { q: "Développement de (2x + 0,5)² :", r: ["4x² + x + 0,25", "4x² + 4x + 2", "4x² + 2x + 0,25", "4x² + 2x + 1"], c: 2, ex: "On applique l'identité remarquable : carré du premier terme, double produit, carré du second terme." },
    ],
    checklist: [
      "Passage additif/multiplicatif pour les pourcentages",
      "Calcul d'un taux global par composition",
      "Calcul d'un taux réciproque",
      "Coefficient directeur entre deux points",
      "Lire l'équation réduite d'une droite",
      "Identifier fonction affine ou linéaire",
      "Développer avec les identités remarquables",
      "Résoudre une équation du type x² = a",
      "Résoudre une équation produit nul",
      "Calculer une probabilité depuis un arbre pondéré",
      "Distinguer conditionnelle, intersection et probabilité inverse",
      "Lire et interpréter un diagramme statistique",
    ],
  },
  {
    id: "suites",
    title: "Suites numériques",
    subtitle: "Algèbre - Ex.1 Partie 2",
    icon: "↗",
    color: "#8b5cf6",
    tag: "HAUTE PRIORITÉ",
    formules: [
      { title: "Suite arithmétique", content: String.raw`u_n=u_0+nr` },
      { title: "Suite géométrique", content: String.raw`u_n=u_0q^n` },
      { title: "Somme des entiers", content: String.raw`1+2+\cdots+n=\frac{n(n+1)}{2}` },
      { title: "Somme géométrique", content: String.raw`1+q+\cdots+q^n=\frac{q^{n+1}-1}{q-1}\quad(q\neq1)` },
      { title: "Point fixe", content: String.raw`u_{n+1}=qu_n+r,\quad L=\frac{r}{1-q},\quad v_n=u_n-L` },
    ],
    methodes: [
      "Différence constante : suite arithmétique ; quotient constant : suite géométrique.",
      "Pour une récurrence affine, trouver le point fixe, puis poser une suite auxiliaire.",
      "Termes généraux : partir du premier terme, puis appliquer la raison.",
      "Seuil : faire un tableau ou écrire une boucle mentale claire.",
      "Toujours préciser la nature, le premier terme et la raison.",
    ],
    errors: ["Conclure trop vite sans vérifier la constance.", "Confondre terme général et somme.", "Faire une erreur de signe dans le point fixe."],
    questions: [
      { q: "vₙ₊₁ = 1,08 vₙ, v₀ = 6250. Nature de la suite :", r: ["Arithmétique", "Géométrique de raison 1,08", "Géométrique de raison 0,08", "Ni l'une ni l'autre"], c: 1, ex: "Chaque terme est obtenu en multipliant le précédent par 1,08." },
      { q: "Avec v₀ = 6250 et q = 1,08, l'expression de vₙ est :", r: ["6250 + n × 1,08", "6250 × 1,08ⁿ", "n × 1,08", "1,08ⁿ"], c: 1, ex: "Une suite géométrique s'écrit premier terme fois raison puissance rang." },
      { q: "Si vₙ = uₙ - 3750 et vₙ = 6250 × 1,08ⁿ, alors uₙ vaut :", r: ["3750 × 1,08ⁿ", "6250 × 1,08ⁿ + 3750", "6250 + 3750 × 1,08ⁿ", "(6250 - 3750) × 1,08ⁿ"], c: 1, ex: "On isole uₙ : il faut ajouter 3750 à vₙ." },
    ],
    checklist: ["Identifier une suite arithmétique/géométrique", "Terme général arithmétique", "Terme général géométrique", "Somme arithmétique", "Somme géométrique", "Changement avec une suite auxiliaire", "Modéliser capital, population ou dose", "Déterminer un seuil"],
  },
  {
    id: "second",
    title: "Second degré",
    subtitle: "Algèbre - formes et signe",
    icon: "∂²",
    color: "#f59e0b",
    tag: "MOYEN",
    formules: [
      { title: "Discriminant", content: String.raw`\Delta=b^2-4ac` },
      { title: "Racines", content: String.raw`x_{1,2}=\frac{-b\pm\sqrt{\Delta}}{2a}` },
      { title: "Forme canonique", content: String.raw`a(x-\alpha)^2+\beta,\quad \alpha=\frac{-b}{2a}` },
      { title: "Somme et produit", content: String.raw`x_1+x_2=\frac{-b}{a},\quad x_1x_2=\frac{c}{a}` },
      { title: "Axe de symétrie", content: String.raw`x=\frac{-b}{2a}` },
    ],
    methodes: ["Discriminant positif : deux racines ; nul : racine double ; négatif : aucune racine réelle.", "Signe du trinôme : signe de a hors des racines.", "La forme canonique donne le sommet et les variations.", "Compléter le carré pour passer à la forme canonique."],
    errors: ["Le discriminant est b² - 4ac, pas b² + 4ac.", "Confondre racines et facteurs.", "L'axe de symétrie n'est pas une racine."],
    questions: [
      { q: "Racines de P(x) = 2x² + x - 10 :", r: ["x = 2 et x = -2,5", "x = -2 et x = 2,5", "x = 2,5 et x = 5", "Pas de racine réelle"], c: 0, ex: "Le discriminant vaut 81. Les deux racines sont -2,5 et 2." },
      { q: "Axe de symétrie de y = 2x² + x - 10 :", r: ["x = 1/4", "x = -1/4", "x = 1/2", "x = -1/2"], c: 1, ex: "L'axe passe par l'abscisse du sommet : -1/4." },
    ],
    checklist: ["Calculer le discriminant", "Calculer les racines", "Factoriser un trinôme", "Obtenir la forme canonique", "Dresser le tableau de signes", "Identifier axe et sommet", "Résoudre une inéquation du second degré"],
  },
  {
    id: "deriv",
    title: "Dérivation",
    subtitle: "Analyse - cœur de l'épreuve",
    icon: "f'",
    color: "#10b981",
    tag: "HAUTE PRIORITÉ",
    formules: [
      { title: "Dérivées de base", content: String.raw`(x^n)'=nx^{n-1},\quad \left(\frac{1}{x}\right)'=-\frac{1}{x^2},\quad (e^x)'=e^x` },
      { title: "Produit", content: String.raw`(uv)'=u'v+uv'` },
      { title: "Quotient", content: String.raw`\left(\frac{u}{v}\right)'=\frac{u'v-uv'}{v^2}` },
      { title: "Composée", content: String.raw`(g(ax+b))'=a\,g'(ax+b)` },
      { title: "Tangente", content: String.raw`y=f(a)+f'(a)(x-a)` },
      { title: "Variations", content: String.raw`f'>0\Rightarrow f\ \text{croît},\quad f'<0\Rightarrow f\ \text{décroît}` },
    ],
    methodes: ["Tangente horizontale : la dérivée s'annule au point considéré.", "Pour un produit, identifier les deux fonctions, leurs dérivées, puis factoriser.", "Pour un quotient, vérifier le domaine.", "Le signe de la dérivée donne les variations.", "Optimisation : résoudre l'annulation de la dérivée, puis vérifier le signe."],
    errors: ["La dérivée d'un produit n'est pas le produit des dérivées.", "Une dérivée nulle ne veut pas dire que la fonction vaut zéro.", "Ne pas oublier de factoriser les exponentielles."],
    questions: [
      { q: "f(x) = (4x² - 14x + 8)e^(0,5x). Si f'(x) = P(x)e^(0,5x), P(x) vaut :", r: ["8x - 14", "2x² + x - 10", "4x² - 7x + 8", "2x² - 7x + 4"], c: 1, ex: "On applique la dérivée d'un produit et on factorise l'exponentielle." },
      { q: "Tangente horizontale en x = 2 signifie :", r: ["f(2) = 0", "f'(2) = 0", "f(2) = 2", "f'(2) = 1"], c: 1, ex: "La pente de la tangente est la dérivée au point considéré." },
      { q: "f(x) = (x + 2)e^(-x). Sa dérivée est :", r: ["e^(-x)", "(-x - 1)e^(-x)", "(x + 1)e^(-x)", "-(x + 2)e^(-x)"], c: 1, ex: "On dérive le produit, puis on factorise l'exponentielle." },
    ],
    checklist: ["Dérivées de base", "Règle du produit", "Règle du quotient", "Dériver une composée", "Équation de tangente", "Tableau de variations", "Extremums", "Optimisation"],
  },
  {
    id: "expo",
    title: "Fonction exponentielle",
    subtitle: "Analyse - liée à la dérivation",
    icon: "eˣ",
    color: "#f43f5e",
    tag: "HAUTE PRIORITÉ",
    formules: [
      { title: "Définition", content: String.raw`\exp'=\exp,\quad \exp(0)=1` },
      { title: "Notation", content: String.raw`e^x=\exp(x),\quad e^0=1` },
      { title: "Algèbre", content: String.raw`e^{a+b}=e^ae^b,\quad e^{-x}=\frac{1}{e^x}` },
      { title: "Composée", content: String.raw`(e^u)'=u'e^u` },
      { title: "Suite exponentielle", content: String.raw`e^{(n+1)a}=e^a\cdot e^{na}` },
    ],
    methodes: ["L'exponentielle est toujours strictement positive.", "Simplifier les produits d'exponentielles avec les règles sur les exposants.", "Dériver une exponentielle composée avec le coefficient intérieur.", "Deux exponentielles égales ont les mêmes exposants."],
    errors: ["La règle correcte est : exponentielle d'une somme, produit des exponentielles.", "Une exponentielle n'est jamais nulle.", "La dérivée de l'exponentielle est elle-même."],
    questions: [
      { q: "La suite (e^(2n)) est géométrique de raison :", r: ["2", "e²", "e^(2n)", "2e"], c: 1, ex: "Le quotient de deux termes consécutifs vaut e²." },
      { q: "e³ × e⁻¹ =", r: ["e²", "e⁴", "e⁻³", "1"], c: 0, ex: "On additionne les exposants : 3 + (-1) = 2." },
    ],
    checklist: ["Dérivée de l'exponentielle", "Propriétés algébriques", "Dériver un produit avec exponentielle", "Signe avec l'exponentielle", "Suite de type exponentielle", "Modéliser une croissance exponentielle"],
  },
  {
    id: "geom",
    title: "Produit scalaire",
    subtitle: "Géométrie - Ex.1 Partie 2",
    icon: "·",
    color: "#3b82f6",
    tag: "HAUTE PRIORITÉ",
    formules: [
      { title: "Coordonnées", content: String.raw`\vec u\cdot\vec v=x_ux_v+y_uy_v` },
      { title: "Angle", content: String.raw`\vec u\cdot\vec v=\|\vec u\|\,\|\vec v\|\cos(\theta)` },
      { title: "Projeté orthogonal", content: String.raw`\overrightarrow{OA}\cdot\overrightarrow{OB}=OH\times OB` },
      { title: "Vecteur normal", content: String.raw`ax+by+c=0\Rightarrow \vec n=(a;b)` },
      { title: "Cercle", content: String.raw`(x-a)^2+(y-b)^2=r^2` },
      { title: "Al-Kashi", content: String.raw`BC^2=AB^2+AC^2-2\,AB\,AC\cos(\widehat A)` },
    ],
    methodes: ["Orthogonalité : le produit scalaire est nul.", "Pour un angle, isoler le cosinus à partir du produit scalaire.", "Droite par point et normal : partir de l'équation cartésienne.", "Cercle développé : compléter les carrés.", "Point sur le cercle de diamètre AB : utiliser l'orthogonalité."],
    errors: ["Vecteur normal et vecteur directeur ne sont pas identiques.", "Attention au signe dans les carrés centrés.", "Vérifier séparément l'équation de droite et l'équation de cercle."],
    questions: [
      { q: "OI = (4 ; 3) et OC = (0 ; 4). Produit scalaire OI·OC :", r: ["0", "7", "12", "25"], c: 2, ex: "On multiplie coordonnée par coordonnée puis on additionne." },
      { q: "Cercle de centre D(2 ; 2), rayon 0,5. Forme développée :", r: ["x² + y² - 4x - 4y + 7,75 = 0", "x² + y² + 4x + 4y + 7,75 = 0", "x² + y² - 4x - 4y - 0,25 = 0", "x² + y² = 0,25"], c: 0, ex: "On part de la forme centrée, puis on développe les deux carrés." },
      { q: "Vecteur normal à 3x - 2y + 5 = 0 :", r: ["(2 ; 3)", "(3 ; -2)", "(-2 ; 3)", "(5 ; 0)"], c: 1, ex: "Dans une équation cartésienne, les coefficients de x et y donnent un vecteur normal." },
    ],
    checklist: ["Produit scalaire avec coordonnées", "Produit scalaire avec angle", "Projeté orthogonal", "Orthogonalité", "Angle avec cosinus", "Droite par vecteur normal", "Équation de cercle", "Projeté orthogonal d'un point", "Formule d'Al-Kashi"],
  },
  {
    id: "proba",
    title: "Probabilités",
    subtitle: "Probabilités et statistiques",
    icon: "🎲",
    color: "#a78bfa",
    tag: "MOYEN",
    formules: [
      { title: "Conditionnelle", content: String.raw`P_A(B)=\frac{P(A\cap B)}{P(A)}` },
      { title: "Probabilités totales", content: String.raw`P(B)=P(A)P_A(B)+P(\overline A)P_{\overline A}(B)` },
      { title: "Indépendance", content: String.raw`P(A\cap B)=P(A)P(B)` },
      { title: "Espérance", content: String.raw`E(X)=\sum_i x_iP(X=x_i)` },
      { title: "Variance", content: String.raw`V(X)=E(X^2)-E(X)^2` },
      { title: "Écart-type", content: String.raw`\sigma=\sqrt{V(X)}` },
    ],
    methodes: ["Arbre : multiplier sur les branches.", "Probabilités totales : additionner les chemins vers l'événement cible.", "Bayes : revenir à l'intersection, puis diviser par la probabilité conditionnante.", "Vérifier que la somme des probabilités vaut 1.", "Jeu équitable si l'espérance du gain net vaut 0."],
    errors: ["Une probabilité conditionnelle se divise par la probabilité de la condition.", "Toujours vérifier la somme des probabilités.", "Ne pas confondre espérance et médiane."],
    questions: [
      { q: "P(A) = 0,6 et P_A(R) = 0,9. P(A ∩ R) vaut :", r: ["0,9", "0,54", "0,60", "1,5"], c: 1, ex: "On multiplie la probabilité de A par la probabilité conditionnelle de R sachant A." },
      { q: "P(A) = 0,6, P_A(R) = 0,9 ; P(B) = 0,4, P_B(R) = 0,8. P(R) vaut :", r: ["0,85", "0,86", "0,76", "0,90"], c: 1, ex: "On additionne les deux chemins menant à R." },
      { q: "P(R) = 0,86 et P(A ∩ R) = 0,54. P_R(A) vaut :", r: ["27/43 environ 0,628", "0,60", "0,86/0,54", "0,40"], c: 0, ex: "On divise l'intersection par la probabilité de R." },
    ],
    checklist: ["Arbre pondéré", "Calculer une intersection", "Probabilités totales", "Formule de Bayes", "Distinguer les notations", "Variable aléatoire", "Tableau de loi", "Espérance, variance, écart-type", "Interpréter l'espérance"],
  },
];

export const PLAN: PlanDay[] = [
  { date: "2026-05-28", focus: "Format + automatismes QCM", tip: "Lire la structure complète. Faire les QCM d'automatismes. Objectif : zéro erreur sur taux et variations.", color: "#00e5ff" },
  { date: "2026-05-29", focus: "Suites numériques", tip: "Revoir la suite auxiliaire et les exercices de modélisation.", color: "#8b5cf6" },
  { date: "2026-05-30", focus: "Second degré + dérivation", tip: "Maîtriser discriminant, formes canonique/factorisée, dérivées de base et produit.", color: "#10b981" },
  { date: "2026-05-31", focus: "Dérivation + exponentielle", tip: "Dériver produit, exponentielle composée, tangente et variations.", color: "#10b981" },
  { date: "2026-06-01", focus: "Produit scalaire + géométrie", tip: "Produit scalaire, droite par vecteur normal et équation de cercle.", color: "#3b82f6" },
  { date: "2026-06-02", focus: "Probabilités + variables aléatoires", tip: "Arbre pondéré, probabilités totales, Bayes, espérance et variance.", color: "#a78bfa" },
  { date: "2026-06-03", focus: "Sujet blanc 1 - conditions réelles", tip: "2h chrono, sans calculatrice. Simuler l'examen complet.", color: "#ff6b6b" },
  { date: "2026-06-04", focus: "Correction + ciblage", tip: "Analyser les erreurs et cibler deux ou trois points fragiles.", color: "#ffab00" },
  { date: "2026-06-05", focus: "Sujet blanc 2 - conditions réelles", tip: "Deuxième simulation : 15 min QCM + deux exercices.", color: "#ff6b6b" },
  { date: "2026-06-06", focus: "Correction + fiches méthodes", tip: "Rédiger ses fiches sur les points encore fragiles.", color: "#ffab00" },
  { date: "2026-06-07", focus: "QCM flash + fiches express", tip: "Révision légère, matériel prêt, sommeil prioritaire.", color: "#06d6a0" },
  { date: "2026-06-08", focus: "Épreuve anticipée de mathématiques", tip: "Lire tout le sujet, QCM en 15 min, ne pas rester bloqué.", color: "#ffb800", final: true },
];

// Dates éditables par l'enseignant : tout le rendu Stage Commando et J-X se recalcule depuis ces ISO dates.
export const STAGE_SESSIONS: StageSession[] = [
  {
    id: "S1",
    date: "2026-05-30",
    title: "Séance 1 — Automatismes & suites",
    durationMin: 120,
    objectifs: [
      "Installer le format EAM et les priorités de points rapides.",
      "Sécuriser les automatismes de QCM sans calculatrice.",
      "Reprendre les suites arithmétiques, géométriques et les seuils.",
      "Construire le plan individuel des 48 premières heures.",
    ],
    deroule: [
      { tranche: "0-15", activite: "Brief format d'épreuve, barème, stratégie sans calculatrice.", moduleIds: ["auto"] },
      { tranche: "15-45", activite: "QCM flash diagnostique : taux, équations, lectures graphiques.", moduleIds: ["auto"] },
      { tranche: "45-90", activite: "Atelier suites : nature, terme général, seuil et algorithme.", moduleIds: ["suites"] },
      { tranche: "90-120", activite: "Correction active et fiche personnelle des points à sécuriser.", moduleIds: ["auto", "suites"] },
    ],
    moduleIds: ["auto", "suites"],
    livrables: ["Score QCM initial", "Fiche 48h des automatismes fragiles", "Deux exercices de suites corrigés"],
    interSeance: ["Refaire 10 automatismes ciblés", "Reprendre un exercice de suite avec seuil", "Noter trois erreurs à ne plus refaire"],
  },
  {
    id: "S2",
    date: "2026-06-01",
    title: "Séance 2 — Second degré & dérivation",
    durationMin: 120,
    objectifs: [
      "Automatiser discriminant, factorisation et tableau de signes.",
      "Relier dérivée, signe et variations.",
      "Rédiger une justification courte mais complète.",
      "Traiter une question d'optimisation sans perdre de temps.",
    ],
    deroule: [
      { tranche: "0-20", activite: "Réactivation : discriminant, racines, signe du trinôme.", moduleIds: ["second"] },
      { tranche: "20-60", activite: "Dérivation ciblée : produit, tangente, variations.", moduleIds: ["deriv"] },
      { tranche: "60-100", activite: "Problème guidé d'optimisation avec tableau de variations.", moduleIds: ["second", "deriv"] },
      { tranche: "100-120", activite: "Relecture méthode : phrases minimales attendues.", moduleIds: ["deriv"] },
    ],
    moduleIds: ["second", "deriv"],
    livrables: ["Tableau de signes propre", "Tableau de variations justifié", "Fiche phrases de rédaction"],
    interSeance: ["Refaire une dérivée de produit", "Résoudre une inéquation du second degré", "Relire la fiche tangente/variations"],
  },
  {
    id: "S3",
    date: "2026-06-03",
    title: "Séance 3 — Exponentielle & géométrie repérée",
    durationMin: 120,
    objectifs: [
      "Dériver une expression avec exponentielle sans développer inutilement.",
      "Utiliser la positivité de l'exponentielle dans un signe.",
      "Sécuriser produit scalaire, droites et cercles.",
      "Choisir la méthode la plus courte selon la question.",
    ],
    deroule: [
      { tranche: "0-25", activite: "Calcul mental exponentiel et règles d'exposants.", moduleIds: ["expo"] },
      { tranche: "25-65", activite: "Dérivée avec exponentielle : factorisation et signe.", moduleIds: ["expo", "deriv"] },
      { tranche: "65-105", activite: "Géométrie repérée : produit scalaire, normale, cercle.", moduleIds: ["geom"] },
      { tranche: "105-120", activite: "Synthèse choix de méthode et pièges de notation.", moduleIds: ["expo", "geom"] },
    ],
    moduleIds: ["expo", "geom"],
    livrables: ["Dérivée exponentielle factorisée", "Exercice géométrie repérée corrigé", "Liste des raccourcis sans calculatrice"],
    interSeance: ["Reprendre trois simplifications d'exponentielles", "Refaire une équation de cercle", "Préparer deux questions à poser sur la géométrie"],
  },
  {
    id: "S4",
    date: "2026-06-05",
    title: "Séance 4 — Probabilités & sujet blanc #1",
    durationMin: 120,
    objectifs: [
      "Stabiliser conditionnelles, intersections et probabilités totales.",
      "Calculer une espérance à partir d'une loi.",
      "Faire un sujet blanc en conditions réalistes.",
      "Identifier les pertes de points prioritaires avant le week-end.",
    ],
    deroule: [
      { tranche: "0-25", activite: "Arbres pondérés et traductions de vocabulaire.", moduleIds: ["proba"] },
      { tranche: "25-45", activite: "Variable aléatoire : loi, espérance, interprétation.", moduleIds: ["proba"] },
      { tranche: "45-110", activite: "Sujet blanc #1 en conditions raccourcies et ciblées.", moduleIds: ["auto", "proba", "suites", "deriv"] },
      { tranche: "110-120", activite: "Auto-bilan : points sûrs, points fragiles, plan week-end.", moduleIds: ["proba"] },
    ],
    moduleIds: ["auto", "proba", "suites", "deriv"],
    livrables: ["Arbre pondéré annoté", "Score sujet blanc #1", "Liste des trois corrections prioritaires"],
    interSeance: ["Corriger les erreurs du sujet blanc #1", "Relire les fiches express concernées", "Faire 15 minutes de QCM flash"],
  },
  {
    id: "S5",
    date: "2026-06-07",
    title: "Séance 5 — Correction ciblée & kit jour J",
    durationMin: 120,
    objectifs: [
      "Corriger les erreurs à fort rendement sans surcharge.",
      "Faire le sujet blanc #2 ou sa version ciblée.",
      "Finaliser les fiches express personnelles.",
      "Préparer la stratégie du matin d'épreuve.",
    ],
    deroule: [
      { tranche: "0-25", activite: "Reprise des erreurs communes : signes, lecture, probabilités.", moduleIds: ["auto", "proba", "deriv"] },
      { tranche: "25-90", activite: "Sujet blanc #2 ciblé : QCM puis exercices prioritaires.", moduleIds: ["auto", "second", "expo", "geom"] },
      { tranche: "90-110", activite: "Correction active et choix des derniers rappels.", moduleIds: ["auto", "deriv", "proba"] },
      { tranche: "110-120", activite: "Kit jour J : matériel, ordre des questions, relecture.", moduleIds: ["auto"] },
    ],
    moduleIds: ["auto", "second", "deriv", "expo", "geom", "proba"],
    livrables: ["Score sujet blanc #2", "Checklist jour J validée", "Fiche finale des erreurs à éviter"],
    interSeance: ["Révision légère uniquement", "Préparer matériel et pièce d'identité", "Dormir sans surcharge de travail"],
  },
];

export const WEEKEND_PROTOCOL: WeekendProtocolDay[] = [
  {
    id: "J-2",
    date: "2026-06-06",
    title: "Samedi 6 juin — Réactivation ciblée",
    intention: "Consolider les points fragiles sans refaire tout le programme.",
    actions: ["QCM flash 15 minutes", "Correction des erreurs du sujet blanc #1", "Relecture de trois fiches express prioritaires"],
  },
  {
    id: "J-1",
    date: "2026-06-07",
    title: "Dimanche 7 juin — Allègement et stratégie",
    intention: "Stabiliser la confiance et éviter la surcharge cognitive.",
    actions: ["Sujet blanc #2 ciblé ou correction guidée", "Checklist matériel", "Sommeil prioritaire et arrêt des révisions lourdes"],
  },
  {
    id: "J-0",
    date: "2026-06-08",
    title: "Lundi 8 juin — Jour J",
    intention: "Sécuriser les points accessibles et gérer le temps.",
    actions: ["QCM en premier, 15 minutes maximum", "Questions rédigées dans l'ordre des points sûrs", "Relecture finale des unités, signes et conclusions"],
  },
];
