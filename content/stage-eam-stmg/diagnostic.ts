import type { AutomatismItem, DiagnosticExercise, DomainId } from "./types";

// SOURCE: Automatismes_premiere, 02_Premiere_STMG, EAM_entraienemnt.
type AutomatismRow = [string, string, string, string[], number, string];

const diagnosticByDomain: Record<DomainId, AutomatismRow[]> = {
  fonctions: [
    ["diag-q1", "Image", "Si $g(4)=9$, alors $4$ est :", ["une image", "un antécédent de $9$", "le maximum", "le coefficient directeur"], 1, "$4$ est l’antécédent et $9$ est l’image."],
    ["diag-q2", "Affine", "Pour $f(x)=-2x+7$, $f(0)$ vaut :", ["$-2$", "$0$", "$7$", "$9$"], 2, "$f(0)=7$."],
    ["diag-q3", "Second degré", "$x^2=25$ a pour solutions :", ["$5$ seulement", "$-5$ et $5$", "$25$", "aucune"], 1, "Un carré égal à $25$ donne deux solutions."],
    ["diag-q4", "Variations", "Si le minimum vaut $-3$, alors toutes les images sont :", ["$\\le -3$", "$\\ge -3$", "nulles", "positives"], 1, "Un minimum est la plus petite valeur atteinte."],
    ["diag-q5", "Racine", "$\\sqrt{81}$ vaut :", ["$8$", "$9$", "$18$", "$40{,}5$"], 1, "$9^2=81$."],
    ["diag-q6", "Équation", "$x-8=0$ donne :", ["$x=0$", "$x=8$", "$x=-8$", "$x=1/8$"], 1, "On ajoute $8$ aux deux membres."],
  ],
  suites: [
    ["diag-q7", "Arithmétique", "$u_0=5$, raison $4$. $u_2$ vaut :", ["$9$", "$13$", "$20$", "$25$"], 1, "$u_2=5+2\\times4=13$."],
    ["diag-q8", "Géométrique", "$100$ € augmentent de $6\\%$. Le capital devient :", ["$94$ €", "$106$ €", "$160$ €", "$600$ €"], 1, "$100\\times1{,}06=106$."],
    ["diag-q9", "Raison", "La suite $3,6,12,24$ est :", ["arithmétique", "géométrique de raison $2$", "géométrique de raison $3$", "constante"], 1, "Chaque terme est multiplié par $2$."],
    ["diag-q10", "Terme général", "$u_n=12-2n$. $u_3$ vaut :", ["$6$", "$8$", "$10$", "$18$"], 0, "$12-2\\times3=6$."],
    ["diag-q11", "Intérêts", "$500$ € à $10\\%$ composés pendant $1$ an donnent :", ["$50$ €", "$510$ €", "$550$ €", "$600$ €"], 2, "$500\\times1{,}10=550$."],
    ["diag-q12", "Seuil", "$2n\\ge10$ donne :", ["$n\\ge5$", "$n\\le5$", "$n\\ge8$", "$n=2$"], 0, "On divise par $2$."],
  ],
  statistiques: [
    ["diag-q13", "Moyenne", "Moyenne de $8,10,12$ :", ["$9$", "$10$", "$11$", "$30$"], 1, "La somme vaut $30$, divisée par $3$."],
    ["diag-q14", "Médiane", "Médiane de $2,5,7,9,10$ :", ["$5$", "$7$", "$8$", "$9$"], 1, "La valeur centrale est $7$."],
    ["diag-q15", "Étendue", "Étendue de $11,13,18$ :", ["$5$", "$7$", "$18$", "$42$"], 1, "$18-11=7$."],
    ["diag-q16", "Fréquence", "$9$ sur $36$ vaut :", ["$20\\%$", "$25\\%$", "$30\\%$", "$40\\%$"], 1, "$9/36=1/4=25\\%$."],
    ["diag-q17", "Quartile", "$Q_1$ est un indicateur de :", ["position", "probabilité", "coefficient", "racine"], 0, "Un quartile repère une position dans une série ordonnée."],
    ["diag-q18", "Ajustement", "Dans $y=3x+2$, la pente est :", ["$2$", "$3$", "$5$", "$6$"], 1, "Le coefficient de $x$ vaut $3$."],
  ],
  probabilites: [
    ["diag-q19", "Complémentaire", "Si $P(A)=0{,}2$, alors $P(\\overline A)$ vaut :", ["$0{,}2$", "$0{,}8$", "$1{,}2$", "$2$"], 1, "$1-0{,}2=0{,}8$."],
    ["diag-q20", "Intersection", "$P(A)=0{,}4$ et $P_A(B)=0{,}5$. $P(A\\cap B)$ vaut :", ["$0{,}2$", "$0{,}4$", "$0{,}5$", "$0{,}9$"], 0, "$0{,}4\\times0{,}5=0{,}2$."],
    ["diag-q21", "Loi", "Une loi de probabilité complète totalise :", ["$0$", "$1$", "$2$", "$100$"], 1, "La somme des probabilités vaut $1$."],
    ["diag-q22", "Espérance", "$E(X)$ représente :", ["un gain moyen", "un maximum", "une médiane", "une fréquence seulement"], 0, "L’espérance est une moyenne pondérée."],
    ["diag-q23", "Conditionnelle", "$P_B(A)$ signifie :", ["$A$ sachant $B$", "$B$ sachant $A$", "$A$ ou $B$", "ni $A$ ni $B$"], 0, "L’indice indique la condition."],
    ["diag-q24", "Indépendance", "Si $P(A)=0{,}5$, $P(B)=0{,}4$ et indépendance, $P(A\\cap B)$ vaut :", ["$0{,}1$", "$0{,}2$", "$0{,}4$", "$0{,}9$"], 1, "$0{,}5\\times0{,}4=0{,}2$."],
  ],
  "algorithmique-information": [
    ["diag-q25", "Pourcentage", "$30\\%$ de $200$ vaut :", ["$30$", "$60$", "$170$", "$230$"], 1, "$10\\%$ vaut $20$, donc $30\\%$ vaut $60$."],
    ["diag-q26", "Taux", "Une hausse de $12\\%$ correspond à :", ["$0{,}88$", "$1{,}12$", "$12$", "$112$"], 1, "Le coefficient multiplicateur est $1+0{,}12$."],
    ["diag-q27", "Indice", "Indice $90$ base $100$ signifie :", ["hausse de $10\\%$", "baisse de $10\\%$", "hausse de $90\\%$", "aucune évolution"], 1, "$90$ est $10$ points sous $100$."],
    ["diag-q28", "Python", "Après `a=4` puis `a=2*a`, $a$ vaut :", ["$2$", "$4$", "$6$", "$8$"], 3, "On double l’ancienne valeur."],
    ["diag-q29", "Évolution", "Une baisse de $5\\%$ puis une baisse de $5\\%$ correspond au coefficient :", ["$0{,}90$", "$0{,}9025$", "$0{,}95$", "$1{,}10$"], 1, "$0{,}95\\times0{,}95=0{,}9025$."],
    ["diag-q30", "Proportion", "$3$ sur $12$ vaut :", ["$15\\%$", "$20\\%$", "$25\\%$", "$30\\%$"], 2, "$3/12=1/4=25\\%$."],
  ],
};

export const DIAGNOSTIC_QCM: AutomatismItem[] = Object.entries(diagnosticByDomain).flatMap(([domainId, items]) =>
  items.map(([id, notion, question, choices, answerIndex, correction]) => ({
    id,
    domainId: domainId as DomainId,
    notion,
    question,
    choices,
    answerIndex,
    correction,
  }))
);

export const DIAGNOSTIC_EXERCISES: DiagnosticExercise[] = [
  {
    id: "ex-fon",
    title: "Lecture graphique et variation",
    domainIds: ["fonctions"],
    statement: ["On donne une fonction de bénéfice avec un maximum lu sur un graphique.", "L’élève identifie image, antécédent, intervalle de croissance et maximum."],
    rubric: [{ domainId: "fonctions", label: "Lecture correcte des valeurs et interprétation du maximum." }],
  },
  {
    id: "ex-sui",
    title: "Capital avec intérêts composés",
    domainIds: ["suites"],
    statement: ["Un capital subit une évolution annuelle constante.", "L’élève reconnaît une suite géométrique et écrit un terme général."],
    rubric: [{ domainId: "suites", label: "Nature, raison, terme général et calcul de deux termes." }],
  },
  {
    id: "ex-sta-pro",
    title: "Série statistique et arbre de probabilités",
    domainIds: ["statistiques", "probabilites"],
    statement: ["Un service commercial fournit une petite série de ventes et un arbre client.", "L’élève calcule médiane, moyenne, probabilité totale et intersection."],
    rubric: [
      { domainId: "statistiques", label: "Indicateurs de position et dispersion." },
      { domainId: "probabilites", label: "Lecture d’arbre, intersection et probabilités totales." },
    ],
  },
  {
    id: "ex-alg",
    title: "Pourcentages successifs et pseudo-code",
    domainIds: ["algorithmique-information"],
    statement: ["Une facture subit deux évolutions successives puis un algorithme simule une remise.", "L’élève calcule le taux global et suit les variables."],
    rubric: [{ domainId: "algorithmique-information", label: "Coefficients multiplicateurs et exécution pas à pas." }],
  },
];
