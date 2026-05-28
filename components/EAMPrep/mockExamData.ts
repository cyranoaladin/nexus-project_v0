export interface MockExamChoice {
  label: "a" | "b" | "c" | "d";
  content: string;
  math?: boolean;
}

export interface MockExamQuestion {
  id: string;
  statement: string;
  math?: string;
  code?: string;
  choices: MockExamChoice[];
  correctAnswer: MockExamChoice["label"];
  points?: string;
}

export interface MockExamBlock {
  type: "text" | "math" | "code";
  content: string;
}

export interface MockExamExerciseQuestion {
  id: string;
  label: string;
  content: MockExamBlock[];
  points?: string;
}

export interface MockExamExercise {
  id: string;
  title: string;
  points: string;
  intro?: MockExamBlock[];
  questions: MockExamExerciseQuestion[];
}

export interface MockExamTimeStep {
  label: string;
  task: string;
}

export interface MockExam {
  title: string;
  subtitle: string;
  duration: string;
  calculator: string;
  total: string;
  instructions: string;
  timePlan: MockExamTimeStep[];
  qcm: {
    title: string;
    points: string;
    instruction: string;
    questions: MockExamQuestion[];
  };
  exercises: MockExamExercise[];
}

export const MOCK_EXAM: MockExam = {
  title: "Sujet blanc C — plateforme premium",
  subtitle: "Première spécialité mathématiques",
  duration: "2 heures",
  calculator: "Calculatrice interdite",
  total: "20 points",
  instructions:
    "À faire en conditions réelles : 2 heures, sans calculatrice. Commencer par les automatismes, puis traiter les trois exercices rédigés indépendants.",
  timePlan: [
    { label: "0-20 min", task: "QCM et automatismes" },
    { label: "20-45 min", task: "Exercice 1" },
    { label: "45-80 min", task: "Exercice 2" },
    { label: "80-112 min", task: "Exercice 3" },
    { label: "112-120 min", task: "Relecture, unités, cohérence et questions laissées" },
  ],
  qcm: {
    title: "Partie 1 — Automatismes, QCM",
    points: "6 points",
    instruction: "Une seule réponse exacte par question. Aucune justification demandée. Chaque question vaut 0,5 point.",
    questions: [
      {
        id: "q1",
        statement: "Une quantité augmente de 15 %, puis diminue de 10 %. L'évolution globale est :",
        choices: [
          { label: "a", content: "une hausse de 5 %" },
          { label: "b", content: "une hausse de 3,5 %" },
          { label: "c", content: "une baisse de 3,5 %" },
          { label: "d", content: "aucune évolution" },
        ],
        correctAnswer: "b",
      },
      {
        id: "q2",
        statement: "Le calcul suivant est égal à :",
        math: String.raw`\frac{5}{6}-\frac{3}{4}\times\frac{2}{3}`,
        choices: [
          { label: "a", content: String.raw`\frac{1}{3}`, math: true },
          { label: "b", content: String.raw`-\frac{1}{3}`, math: true },
          { label: "c", content: String.raw`\frac{5}{12}`, math: true },
          { label: "d", content: String.raw`\frac{1}{6}`, math: true },
        ],
        correctAnswer: "a",
      },
      {
        id: "q3",
        statement: "L'ensemble des solutions de l'équation suivante est :",
        math: String.raw`(3x+2)(x-5)=0`,
        choices: [
          { label: "a", content: String.raw`\{-2\ ;\ 5\}`, math: true },
          { label: "b", content: String.raw`\left\{-\frac{2}{3}\ ;\ 5\right\}`, math: true },
          { label: "c", content: String.raw`\left\{\frac{2}{3}\ ;\ -5\right\}`, math: true },
          { label: "d", content: String.raw`\left\{\frac{3}{2}\ ;\ 5\right\}`, math: true },
        ],
        correctAnswer: "b",
      },
      {
        id: "q4",
        statement: "Le taux de variation de la fonction entre x = 2 et x = 2 + h, avec h non nul, est :",
        math: String.raw`f(x)=x^2+1`,
        choices: [
          { label: "a", content: String.raw`4+h`, math: true },
          { label: "b", content: String.raw`2+h`, math: true },
          { label: "c", content: String.raw`h`, math: true },
          { label: "d", content: String.raw`4`, math: true },
        ],
        correctAnswer: "a",
      },
      {
        id: "q5",
        statement: "On considère deux événements A et B tels que :",
        math: String.raw`P(A)=0{,}4,\quad P_A(B)=0{,}7,\quad P_{\overline A}(B)=0{,}25`,
        choices: [
          { label: "a", content: String.raw`0{,}28`, math: true },
          { label: "b", content: String.raw`0{,}43`, math: true },
          { label: "c", content: String.raw`0{,}55`, math: true },
          { label: "d", content: String.raw`0{,}70`, math: true },
        ],
        correctAnswer: "b",
      },
      {
        id: "q6",
        statement: "La valeur exacte suivante est :",
        math: String.raw`\sin\left(\frac{\pi}{6}\right)`,
        choices: [
          { label: "a", content: String.raw`\frac{1}{2}`, math: true },
          { label: "b", content: String.raw`\frac{\sqrt{2}}{2}`, math: true },
          { label: "c", content: String.raw`\frac{\sqrt{3}}{2}`, math: true },
          { label: "d", content: String.raw`-\frac{1}{2}`, math: true },
        ],
        correctAnswer: "a",
      },
      {
        id: "q7",
        statement: "Dans un repère orthonormé, on donne les vecteurs :",
        math: String.raw`\vec u(1\ ;\ 4)\quad\text{et}\quad \vec v(8\ ;\ -2)`,
        choices: [
          { label: "a", content: String.raw`-8`, math: true },
          { label: "b", content: String.raw`0`, math: true },
          { label: "c", content: String.raw`8`, math: true },
          { label: "d", content: String.raw`16`, math: true },
        ],
        correctAnswer: "b",
      },
      {
        id: "q8",
        statement: "La somme des quatre premiers termes d'une suite géométrique de premier terme et de raison donnés est :",
        math: String.raw`u_0=3,\quad q=2,\quad u_0+u_1+u_2+u_3`,
        choices: [
          { label: "a", content: "24" },
          { label: "b", content: "30" },
          { label: "c", content: "45" },
          { label: "d", content: "48" },
        ],
        correctAnswer: "c",
      },
      {
        id: "q9",
        statement: "Le cercle d'équation suivante a pour centre et rayon :",
        math: String.raw`x^2+y^2+2x-8y+8=0`,
        choices: [
          { label: "a", content: String.raw`C(1\ ;\ -4),\ R=3`, math: true },
          { label: "b", content: String.raw`C(-1\ ;\ 4),\ R=3`, math: true },
          { label: "c", content: String.raw`C(-1\ ;\ 4),\ R=9`, math: true },
          { label: "d", content: String.raw`C(2\ ;\ -8),\ R=8`, math: true },
        ],
        correctAnswer: "b",
      },
      {
        id: "q10",
        statement: "La médiane de la série statistique suivante est :",
        math: String.raw`\{3\ ;\ 7\ ;\ 8\ ;\ 10\ ;\ 12\}`,
        choices: [
          { label: "a", content: "7" },
          { label: "b", content: "8" },
          { label: "c", content: "10" },
          { label: "d", content: "40" },
        ],
        correctAnswer: "b",
      },
      {
        id: "q11",
        statement: "On exécute le script Python suivant. La valeur renvoyée est :",
        code: `def seuil():
    p = 1
    n = 0
    while p < 100:
        p = 3 * p
        n = n + 1
    return n`,
        choices: [
          { label: "a", content: "4" },
          { label: "b", content: "5" },
          { label: "c", content: "6" },
          { label: "d", content: "100" },
        ],
        correctAnswer: "b",
      },
      {
        id: "q12",
        statement: "On considère le polynôme suivant. Pour tout réel x, on peut affirmer que :",
        math: String.raw`P(x)=2(x-1)^2+3`,
        choices: [
          { label: "a", content: "P(x) est toujours négatif" },
          { label: "b", content: "P(x) est toujours strictement positif" },
          { label: "c", content: "P(x) s'annule pour x = 1" },
          { label: "d", content: "P(x) est positif seulement si x > 1" },
        ],
        correctAnswer: "b",
      },
    ],
  },
  exercises: [
    {
      id: "ex1",
      title: "Exercice 1 — Probabilités conditionnelles",
      points: "4 points",
      intro: [
        {
          type: "text",
          content:
            "Dans une promotion d'élèves inscrits sur une plateforme de préparation, 30 % suivent un module « Projet ». Parmi les élèves qui suivent ce module, 70 % valident l'évaluation finale. Parmi les élèves qui ne suivent pas ce module, 40 % valident l'évaluation finale.",
        },
        { type: "text", content: "On choisit un élève au hasard. On note :" },
        { type: "math", content: String.raw`P:\ \text{« l'élève suit le module Projet »}\quad;\quad C:\ \text{« l'élève valide l'évaluation finale »}` },
      ],
      questions: [
        {
          id: "ex1-q1",
          label: "1.",
          content: [{ type: "text", content: "Recopier et compléter l'arbre pondéré correspondant à la situation." }],
          points: "1 point",
        },
        {
          id: "ex1-q2",
          label: "2.",
          content: [{ type: "text", content: "Calculer la probabilité suivante :" }, { type: "math", content: String.raw`P(P\cap C)` }],
          points: "1 point",
        },
        {
          id: "ex1-q3",
          label: "3.",
          content: [{ type: "text", content: "Montrer que :" }, { type: "math", content: String.raw`P(C)=0{,}49` }],
          points: "1 point",
        },
        {
          id: "ex1-q4",
          label: "4.",
          content: [{ type: "text", content: "Calculer la probabilité conditionnelle, puis interpréter le résultat dans le contexte :" }, { type: "math", content: String.raw`P_C(P)` }],
          points: "1 point",
        },
      ],
    },
    {
      id: "ex2",
      title: "Exercice 2 — Suites et algorithmique",
      points: "5 points",
      intro: [
        {
          type: "text",
          content:
            "Lors d'un entraînement hebdomadaire sur la plateforme Nexus Réussite, on modélise le score moyen de maîtrise d'un groupe d'élèves, noté sur 10, après n semaines.",
        },
        { type: "text", content: "Au départ, le score moyen est :" },
        { type: "math", content: String.raw`u_0=5` },
        { type: "text", content: "Chaque semaine, le score est modélisé par la relation :" },
        { type: "math", content: String.raw`u_{n+1}=0{,}6u_n+4` },
      ],
      questions: [
        {
          id: "ex2-q1",
          label: "1.",
          content: [{ type: "text", content: "Calculer u1 et u2. Interpréter u1 dans le contexte." }],
          points: "1 point",
        },
        {
          id: "ex2-q2",
          label: "2.",
          content: [
            { type: "text", content: "On pose :" },
            { type: "math", content: String.raw`v_n=u_n-10` },
            { type: "text", content: "Montrer que la suite est géométrique. Préciser sa raison et son premier terme." },
          ],
          points: "1,5 point",
        },
        {
          id: "ex2-q3",
          label: "3.",
          content: [{ type: "text", content: "En déduire l'expression de vn, puis celle de un, en fonction de n." }],
          points: "1 point",
        },
        {
          id: "ex2-q4",
          label: "4.",
          content: [{ type: "text", content: "Que peut-on conjecturer sur le comportement du score moyen à long terme ? Interpréter." }],
          points: "0,5 point",
        },
        {
          id: "ex2-q5",
          label: "5.",
          content: [
            { type: "text", content: "On souhaite déterminer à partir de quelle semaine le score moyen atteint au moins 9,5. Compléter ou choisir le bon algorithme Python permettant de déterminer ce rang. On donne :" },
            { type: "math", content: String.raw`0{,}6^4=0{,}1296\quad\text{et}\quad 0{,}6^5=0{,}07776` },
            {
              type: "code",
              content: `def seuil():
    u = 5
    n = 0
    while u < 9.5:
        u = 0.6*u + 4
        n = n + 1
    return n`,
            },
            { type: "text", content: "Conclure." },
          ],
          points: "1 point",
        },
      ],
    },
    {
      id: "ex3",
      title: "Exercice 3 — Analyse et exponentielle",
      points: "5 points",
      intro: [
        { type: "text", content: "On considère la fonction f définie sur l'intervalle [0 ; 5] par :" },
        { type: "math", content: String.raw`f(x)=(3-x)e^x+1` },
        { type: "text", content: "On note Cf sa courbe représentative dans un repère." },
      ],
      questions: [
        {
          id: "ex3-q1",
          label: "1.",
          content: [{ type: "text", content: "Montrer que, pour tout x de l'intervalle [0 ; 5], on a :" }, { type: "math", content: String.raw`f'(x)=(2-x)e^x` }],
          points: "1,25 point",
        },
        {
          id: "ex3-q2",
          label: "2.",
          content: [{ type: "text", content: "Étudier le signe de f'(x) sur [0 ; 5] et dresser le tableau de variations de f." }],
          points: "1,25 point",
        },
        {
          id: "ex3-q3",
          label: "3.",
          content: [{ type: "text", content: "Déterminer l'équation réduite de la tangente à Cf au point d'abscisse 0." }],
          points: "1 point",
        },
        {
          id: "ex3-q4",
          label: "4.",
          content: [{ type: "text", content: "Résoudre l'équation suivante sur [0 ; 5] :" }, { type: "math", content: String.raw`f(x)=1` }],
          points: "0,75 point",
        },
        {
          id: "ex3-q5",
          label: "5.",
          content: [{ type: "text", content: "En déduire la position relative de la courbe Cf et de la droite d'équation y = 1 sur [0 ; 5]." }],
          points: "0,75 point",
        },
      ],
    },
  ],
};
