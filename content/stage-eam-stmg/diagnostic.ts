import type { AutomatismItem, DiagnosticExercise, DomainId } from "./types";

// SOURCE: Automatismes_premiere, 02_Premiere_STMG, EAM_entraienemnt.
type AutomatismRow = [string, string, string, string[], number, string];

const diagnosticByDomain: Record<DomainId, AutomatismRow[]> = {
  fonctions: [
    ["diag-q1", "Image", "Si $g(4)=9$, alors $4$ est :", ["une image", "un antécédent de $9$", "le maximum", "le coefficient directeur"], 1, "$4$ est l’antécédent et $9$ est l’image."],
    ["diag-q2", "Affine", "Pour $f(x)=-2x+7$, $f(0)$ vaut :", ["$-2$", "$0$", "$7$", "$9$"], 2, "$f(0)=7$."],
    ["diag-q3", "Second degré", "$x^2=25$ a pour solutions :", ["$5$ seulement", "$-5$ et $5$", "$25$", "aucune"], 1, "Un carré égal à $25$ donne deux solutions."],
    ["diag-q4", "Forme factorisée", "Pour $f(x)=(x-1)(5-x)$, les zéros sont :", ["$1$ et $5$", "$-1$ et $-5$", "$0$ et $5$", "$1$ seulement"], 0, "Un produit est nul si l’un des facteurs est nul."],
    ["diag-q5", "Degré 3", "$x^3=8$ donne :", ["$x=2$", "$x=4$", "$x=8$", "$x=64$"], 0, "$2^3=8$, donc $x=\\sqrt[3]{8}=2$."],
    ["diag-q6", "Équation graphique", "Résoudre $f(x)=3$ graphiquement consiste à lire :", ["les images égales à $3$", "les antécédents de $3$", "la pente", "l’ordonnée à l’origine"], 1, "On cherche les abscisses des points de la courbe d’ordonnée $3$."],
  ],
  derivation: [
    ["diag-q31", "Nombre dérivé", "$f'(2)$ représente :", ["l’image de $2$", "le coefficient directeur de la tangente en $2$", "l’aire sous la courbe", "une probabilité"], 1, "Le nombre dérivé est la pente de la tangente."],
    ["diag-q32", "Tangente", "Si $f(2)=5$ et $f'(2)=3$, une équation de la tangente est :", ["$y=3(x-2)+5$", "$y=5(x-2)+3$", "$y=2x+5$", "$y=3x+5$"], 0, "On utilise $y=f'(a)(x-a)+f(a)$."],
    ["diag-q33", "Dérivée", "La dérivée de $x^3$ est :", ["$x^2$", "$2x$", "$3x^2$", "$3x$"], 2, "$(x^3)'=3x^2$."],
    ["diag-q34", "Variations", "Si $f'(x)>0$ sur un intervalle, alors $f$ y est :", ["croissante", "décroissante", "constante", "négative"], 0, "Le signe positif de $f'$ indique que $f$ croît."],
    ["diag-q35", "Coût marginal", "Dans un contexte de coût, $C'(q)$ s’interprète comme :", ["le coût total", "le coût marginal", "la quantité vendue", "le prix moyen"], 1, "La dérivée mesure l’évolution instantanée du coût."],
    ["diag-q36", "Signe", "Si $f'$ passe de $+$ à $-$ en $a$, alors $f$ admet en général :", ["un minimum", "un maximum", "une racine", "une asymptote"], 1, "$f$ croît puis décroît : on obtient un maximum local."],
  ],
  suites: [
    ["diag-q7", "Arithmétique", "$u_0=5$, raison $4$. $u_2$ vaut :", ["$9$", "$13$", "$20$", "$25$"], 1, "$u_2=5+2\\times4=13$."],
    ["diag-q8", "Géométrique", "$100$ € augmentent de $6\\%$. Le capital devient :", ["$94$ €", "$106$ €", "$160$ €", "$600$ €"], 1, "$100\\times1{,}06=106$."],
    ["diag-q9", "Raison", "La suite $3,6,12,24$ est :", ["arithmétique", "géométrique de raison $2$", "géométrique de raison $3$", "constante"], 1, "Chaque terme est multiplié par $2$."],
    ["diag-q10", "Récurrence", "$u_{n+1}=u_n-2$ et $u_0=12$. $u_2$ vaut :", ["$8$", "$10$", "$12$", "$14$"], 0, "$u_1=10$ puis $u_2=8$."],
    ["diag-q11", "Intérêts", "$500$ € à $10\\%$ composés pendant $1$ an donnent :", ["$50$ €", "$510$ €", "$550$ €", "$600$ €"], 2, "$500\\times1{,}10=550$."],
    ["diag-q12", "Seuil", "$2n\\ge10$ donne :", ["$n\\ge5$", "$n\\le5$", "$n\\ge8$", "$n=2$"], 0, "On divise par $2$."],
  ],
  statistiques: [
    ["diag-q13", "Moyenne", "Moyenne de $8,10,12$ :", ["$9$", "$10$", "$11$", "$30$"], 1, "La somme vaut $30$, divisée par $3$."],
    ["diag-q14", "Médiane", "Médiane de $2,5,7,9,10$ :", ["$5$", "$7$", "$8$", "$9$"], 1, "La valeur centrale est $7$."],
    ["diag-q15", "Étendue", "Étendue de $11,13,18$ :", ["$5$", "$7$", "$18$", "$42$"], 1, "$18-11=7$."],
    ["diag-q16", "Fréquence", "$9$ sur $36$ vaut :", ["$20\\%$", "$25\\%$", "$30\\%$", "$40\\%$"], 1, "$9/36=1/4=25\\%$."],
    ["diag-q17", "Quartile", "$Q_1$ est un indicateur de :", ["position", "probabilité", "coefficient", "racine"], 0, "Un quartile repère une position dans une série ordonnée."],
    ["diag-q18", "Tableau croisé", "Dans un tableau croisé, une fréquence conditionnelle se calcule avec :", ["le total général seulement", "le total de la ligne ou colonne condition", "le maximum", "la médiane"], 1, "La condition fixe le dénominateur."],
  ],
  probabilites: [
    ["diag-q19", "Complémentaire", "Si $P(A)=0{,}2$, alors $P(\\overline A)$ vaut :", ["$0{,}2$", "$0{,}8$", "$1{,}2$", "$2$"], 1, "$1-0{,}2=0{,}8$."],
    ["diag-q20", "Intersection", "$P(A)=0{,}4$ et $P_A(B)=0{,}5$. $P(A\\cap B)$ vaut :", ["$0{,}2$", "$0{,}4$", "$0{,}5$", "$0{,}9$"], 0, "$0{,}4\\times0{,}5=0{,}2$."],
    ["diag-q21", "Loi", "Une loi de probabilité complète totalise :", ["$0$", "$1$", "$2$", "$100$"], 1, "La somme des probabilités vaut $1$."],
    ["diag-q22", "Espérance", "$E(X)$ représente :", ["un gain moyen", "un maximum", "une médiane", "une fréquence seulement"], 0, "L’espérance est une moyenne pondérée."],
    ["diag-q23", "Conditionnelle", "$P_B(A)$ signifie :", ["$A$ sachant $B$", "$B$ sachant $A$", "$A$ ou $B$", "ni $A$ ni $B$"], 0, "L’indice indique la condition."],
    ["diag-q24", "Bernoulli", "Deux essais indépendants ont une probabilité de succès $0{,}1$. La probabilité d’un succès puis un échec vaut :", ["$0{,}01$", "$0{,}09$", "$0{,}1$", "$0{,}9$"], 1, "$0{,}1\\times0{,}9=0{,}09$."],
  ],
  "algorithmique-tableur": [
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
    title: "Lecture graphique, second degré et degré 3",
    domainIds: ["fonctions"],
    statement: ["On donne $f(x)=(x-1)(5-x)$ puis une courbe de degré 3.", "L’élève lit les zéros, le signe, un extremum et résout $x^3=8$."],
    rubric: [{ domainId: "fonctions", label: "Lecture correcte des valeurs, formes factorisées/canoniques et degré 3." }],
  },
  {
    id: "ex-der",
    title: "Tangente, dérivée et variations",
    domainIds: ["derivation"],
    statement: ["Une fonction de coût vérifie $C(2)=9$ et $C'(2)=4$, puis on donne le signe de $C'$.", "L’élève écrit l’équation de la tangente et complète un tableau de variations."],
    rubric: [{ domainId: "derivation", label: "Nombre dérivé, tangente, signe de la dérivée et interprétation économique." }],
  },
  {
    id: "ex-sui",
    title: "Suite par récurrence, tableur et seuil",
    domainIds: ["suites"],
    statement: ["Un stock suit $u_{n+1}=0{,}9u_n+150$.", "L’élève complète deux lignes de tableau, écrit la formule tableur à étirer et repère un seuil."],
    rubric: [{ domainId: "suites", label: "Récurrence, raison quand elle existe, tableur, seuil et somme." }],
  },
  {
    id: "ex-sta-pro",
    title: "Série statistique et arbre de probabilités",
    domainIds: ["statistiques", "probabilites"],
    statement: ["Un service commercial fournit une petite série de ventes et un tableau croisé clients/satisfaction.", "L’élève calcule médiane, moyenne, fréquence conditionnelle et probabilité d’intersection."],
    rubric: [
      { domainId: "statistiques", label: "Indicateurs de position et dispersion." },
      { domainId: "probabilites", label: "Conditionnelle par tableau, intersection, loi et espérance." },
    ],
  },
  {
    id: "ex-alg",
    title: "Pourcentages successifs et pseudo-code",
    domainIds: ["algorithmique-tableur"],
    statement: ["Une facture subit deux évolutions successives puis un algorithme simule une remise.", "L’élève calcule le taux global et suit les variables."],
    rubric: [{ domainId: "algorithmique-tableur", label: "Coefficients multiplicateurs, affectations, compteur, accumulateur et formule tableur." }],
  },
];
