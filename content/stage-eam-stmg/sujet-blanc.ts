export interface MockExamQcmItem {
  id: string;
  notion: string;
  question: string;
  choices: string[];
  answerIndex: number;
  correction: string;
}

export interface MockExamExercise {
  id: string;
  title: string;
  points: number;
  statement: string[];
  questions: string[];
  correction: Array<{ title: string; details: string[] }>;
}

type MockExamQcmRow = [string, string, string, string[], number, string];

const qcmRows: MockExamQcmRow[] = [
  ["sb-q1", "Pourcentages", "Une baisse de $12\\%$ correspond au coefficient :", ["$0{,}12$", "$0{,}88$", "$1{,}12$", "$88$"], 1, "On conserve $100-12=88\\%$, donc coefficient $0{,}88$."],
  ["sb-q2", "Indice", "Un indice passe de $100$ à $125$. L’évolution est :", ["$+12{,}5\\%$", "$+25\\%$", "$-25\\%$", "$+125\\%$"], 1, "$125$ est $25\\%$ au-dessus de $100$."],
  ["sb-q3", "Fonction factorisée", "Les zéros de $f(x)=(x-2)(6-x)$ sont :", ["$-2$ et $-6$", "$2$ et $6$", "$0$ et $6$", "$2$ seulement"], 1, "Un produit est nul si un facteur est nul."],
  ["sb-q4", "Forme canonique", "Pour $g(x)=9-(x-4)^2$, le maximum vaut :", ["$4$", "$5$", "$9$", "$16$"], 2, "Le carré est minimal en $x=4$, donc le maximum est $9$."],
  ["sb-q5", "Racine cubique", "$x^3=27$ donne :", ["$x=3$", "$x=9$", "$x=24$", "$x=30$"], 0, "$3^3=27$."],
  ["sb-q6", "Dérivée", "La dérivée de $2x^3-5x$ est :", ["$6x^2-5$", "$2x^2-5$", "$6x-5$", "$x^3-5$"], 0, "$(2x^3)'=6x^2$ et $(-5x)'=-5$."],
  ["sb-q7", "Tangente", "Si $f(1)=7$ et $f'(1)=2$, la tangente est :", ["$y=7(x-1)+2$", "$y=2(x-1)+7$", "$y=2x+7$", "$y=x+2$"], 1, "Formule : $y=f'(a)(x-a)+f(a)$."],
  ["sb-q8", "Suite", "$u_{n+1}=0{,}9u_n+150$ et $u_0=1000$. $u_1$ vaut :", ["$900$", "$1050$", "$1150$", "$1500$"], 1, "$0{,}9\\times1000+150=1050$."],
  ["sb-q9", "Tableur", "Pour calculer $u_{n+1}=0{,}9u_n+150$ en B3 depuis B2 :", ["`=B2*0,9+150`", "`=B3*0,9+150`", "`=0,9+150`", "`=B2+0,9`"], 0, "La cellule suivante dépend de la cellule précédente."],
  ["sb-q10", "Statistiques", "Dans $18,20,20,25,30$, la médiane est :", ["$20$", "$22$", "$25$", "$30$"], 0, "La valeur centrale est $20$."],
  ["sb-q11", "Conditionnelle", "Dans un groupe $A$ de $40$ personnes, $30$ ont $B$. $P_A(B)$ vaut :", ["$0{,}25$", "$0{,}4$", "$0{,}75$", "$1{,}3$"], 2, "$30/40=0{,}75$."],
  ["sb-q12", "Bernoulli", "Deux essais indépendants avec $P(S)=0{,}2$. Exactement un succès vaut :", ["$0{,}04$", "$0{,}16$", "$0{,}32$", "$0{,}64$"], 2, "$0{,}2\\times0{,}8+0{,}8\\times0{,}2=0{,}32$."],
];

// SOURCE: sujets zéro voie technologique Éduscol + sujets Nexus Drive, format officiel sans calculatrice.
export const STMG_MOCK_EXAM = {
  title: "Sujet blanc commando — voie technologique STMG",
  durationMin: 120,
  qcmPoints: 6,
  part2Points: 14,
  qcm: qcmRows.map(([id, notion, question, choices, answerIndex, correction]) => ({
    id,
    notion,
    question,
    choices,
    answerIndex,
    correction,
  })) satisfies MockExamQcmItem[],
  exercises: [
    {
      id: "sb-ex1",
      title: "Fonctions et dérivation — coût",
      points: 5,
      statement: ["On modélise un coût par $C(x)=0{,}5x^3-3x^2+8$ pour $0\\le x\\le6$.", "On admet que $C'(x)=1{,}5x^2-6x$."],
      questions: ["Calculer $C(2)$ et $C'(2)$.", "Écrire une équation de la tangente en $x=2$.", "Étudier le signe de $C'(x)$ sur $[0;6]$ et dresser les variations."],
      correction: [
        { title: "Calculs", details: ["$C(2)=0{,}5\\times8-3\\times4+8=0$.", "$C'(2)=1{,}5\\times4-12=-6$."] },
        { title: "Tangente", details: ["$y=C'(2)(x-2)+C(2)$, donc $y=-6(x-2)$."] },
        { title: "Variations", details: ["$C'(x)=1{,}5x(x-4)$.", "Le signe est $+$ sur $[0;0]$, $-$ sur $]0;4[$, puis $+$ sur $]4;6]$.", "La fonction décroît puis croît : minimum en $x=4$."] },
      ],
    },
    {
      id: "sb-ex2",
      title: "Suites, tableur et seuil",
      points: 5,
      statement: ["Une association compte $1000$ adhérents. Chaque année, elle conserve $90\\%$ des adhérents et en gagne $150$ nouveaux.", "On note $u_n$ le nombre d’adhérents après $n$ années."],
      questions: ["Écrire la relation de récurrence.", "Calculer $u_1$ et $u_2$.", "Donner une formule tableur à étirer.", "Déterminer par calculs successifs si le seuil de $1200$ est atteint avant trois ans."],
      correction: [
        { title: "Récurrence", details: ["$u_{n+1}=0{,}9u_n+150$ avec $u_0=1000$."] },
        { title: "Calculs", details: ["$u_1=1050$.", "$u_2=0{,}9\\times1050+150=1095$."] },
        { title: "Tableur et seuil", details: ["En B3 : `=B2*0,9+150`.", "$u_3=0{,}9\\times1095+150=1135{,}5$.", "Le seuil $1200$ n’est pas atteint avant trois ans."] },
      ],
    },
    {
      id: "sb-ex3",
      title: "Statistiques, probabilités et variable aléatoire",
      points: 4,
      statement: ["Dans une enquête, $40$ clients commandent en ligne et $60$ en magasin. Parmi eux, $30$ clients en ligne et $42$ clients en magasin sont satisfaits.", "Un jeu de fidélité donne $10$ € avec probabilité $0{,}2$ et $0$ € sinon."],
      questions: ["Calculer la fréquence de satisfaction des clients en ligne.", "Calculer la probabilité qu’un client soit satisfait.", "Calculer l’espérance du gain du jeu.", "Vrai/Faux justifié : le gain moyen est de $5$ €."],
      correction: [
        { title: "Statistiques/probabilités", details: ["En ligne : $30/40=0{,}75$.", "Au total, $72$ clients satisfaits sur $100$, donc $P(S)=0{,}72$."] },
        { title: "Variable aléatoire", details: ["$E(X)=10\\times0{,}2+0\\times0{,}8=2$.", "L’affirmation est fausse : le gain moyen est $2$ €, pas $5$ €."] },
      ],
    },
  ] satisfies MockExamExercise[],
};
