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

export interface MockExam {
  title: string;
  subtitle: string;
  duration: string;
  calculator: string;
  qcm: {
    title: string;
    points: string;
    instruction: string;
    questions: MockExamQuestion[];
  };
  exercises: MockExamExercise[];
}

export const MOCK_EXAM: MockExam = {
  title: "Sujet blanc inédit — Nexus Réussite",
  subtitle: "Durée : 2 heures · Calculatrice interdite",
  duration: "2 heures",
  calculator: "Calculatrice interdite",
  qcm: {
    title: "Partie 1 — Automatismes – QCM",
    points: "6 points",
    instruction: "Une seule réponse exacte par question. Aucune justification demandée.",
    questions: [
      {
        id: "q1",
        statement: "Le prix d'un abonnement baisse de 20 % puis augmente de 25 %. L'évolution globale est :",
        choices: [
          { label: "a", content: "Une hausse de 5 %" },
          { label: "b", content: "Aucune évolution (0 %)" },
          { label: "c", content: "Une baisse de 5 %" },
          { label: "d", content: "Une hausse de 45 %" },
        ],
      },
      {
        id: "q2",
        statement: "Le calcul suivant donne :",
        math: String.raw`\frac{3}{4}-\frac{1}{2}\times\frac{5}{2}`,
        choices: [
          { label: "a", content: String.raw`-\frac{1}{2}`, math: true },
          { label: "b", content: String.raw`\frac{5}{4}`, math: true },
          { label: "c", content: String.raw`-\frac{1}{4}`, math: true },
          { label: "d", content: String.raw`\frac{1}{4}`, math: true },
        ],
      },
      {
        id: "q3",
        statement: "L'ensemble des solutions de l'équation suivante est :",
        math: String.raw`(2x-3)(x+4)=0`,
        choices: [
          { label: "a", content: String.raw`\{-1,5\ ;\ -4\}`, math: true },
          { label: "b", content: String.raw`\{-1,5\ ;\ 4\}`, math: true },
          { label: "c", content: String.raw`\left\{\frac{3}{2}\ ;\ 4\right\}`, math: true },
          { label: "d", content: String.raw`\left\{\frac{3}{2}\ ;\ -4\right\}`, math: true },
        ],
      },
      {
        id: "q4",
        statement: "Le taux de variation de la fonction suivante entre x = 1 et x = 1 + h, avec h non nul, est :",
        math: String.raw`f(x)=x^2`,
        choices: [
          { label: "a", content: String.raw`2+h`, math: true },
          { label: "b", content: String.raw`2h`, math: true },
          { label: "c", content: String.raw`h^2`, math: true },
          { label: "d", content: String.raw`2`, math: true },
        ],
      },
      {
        id: "q5",
        statement: "On considère un arbre de probabilités où :",
        math: String.raw`P(A)=0,6,\quad P_A(B)=0,5,\quad P_{\overline A}(B)=0,2`,
        choices: [
          { label: "a", content: String.raw`0,38`, math: true },
          { label: "b", content: String.raw`0,42`, math: true },
          { label: "c", content: String.raw`0,30`, math: true },
          { label: "d", content: String.raw`0,50`, math: true },
        ],
      },
      {
        id: "q6",
        statement: "La valeur exacte suivante est :",
        math: String.raw`\cos\left(\frac{\pi}{3}\right)`,
        choices: [
          { label: "a", content: String.raw`\frac{1}{2}`, math: true },
          { label: "b", content: String.raw`\frac{\sqrt3}{2}`, math: true },
          { label: "c", content: String.raw`\frac{\sqrt2}{2}`, math: true },
          { label: "d", content: String.raw`-\frac{1}{2}`, math: true },
        ],
      },
      {
        id: "q7",
        statement: "Dans un repère orthonormé, on donne :",
        math: String.raw`\vec u(2\ ;\ -3)\quad\text{et}\quad \vec v(6\ ;\ 4)`,
        choices: [
          { label: "a", content: String.raw`24`, math: true },
          { label: "b", content: String.raw`0`, math: true },
          { label: "c", content: String.raw`-6`, math: true },
          { label: "d", content: String.raw`12`, math: true },
        ],
      },
      {
        id: "q8",
        statement: "La somme des 5 premiers termes d'une suite géométrique de premier terme u0 = 2 et de raison q = 3 est :",
        choices: [
          { label: "a", content: "242" },
          { label: "b", content: "240" },
          { label: "c", content: "121" },
          { label: "d", content: "484" },
        ],
      },
      {
        id: "q9",
        statement: "Le cercle d'équation suivante a pour centre et rayon :",
        math: String.raw`x^2+y^2-4x+6y-12=0`,
        choices: [
          { label: "a", content: String.raw`C(2\ ;\ -3)\ \text{et}\ R=5`, math: true },
          { label: "b", content: String.raw`C(-2\ ;\ 3)\ \text{et}\ R=5`, math: true },
          { label: "c", content: String.raw`C(2\ ;\ -3)\ \text{et}\ R=25`, math: true },
          { label: "d", content: String.raw`C(4\ ;\ -6)\ \text{et}\ R=\sqrt{12}`, math: true },
        ],
      },
      {
        id: "q10",
        statement: "La moyenne de la série statistique suivante est :",
        math: String.raw`\{10\ ;\ 12\ ;\ 14\ ;\ 14\ ;\ 20\}`,
        choices: [
          { label: "a", content: "12" },
          { label: "b", content: "13" },
          { label: "c", content: "14" },
          { label: "d", content: "15" },
        ],
      },
      {
        id: "q11",
        statement:
          "On exécute le script Python suivant. Aide : on fournit les premières valeurs de u, arrondies à l'unité : u_0 = 8000, u_1 = 8400, u_2 = 8720, u_3 = 8976, u_4 = 9181, u_5 = 9345, u_6 = 9476, u_7 = 9581. Quelle valeur de n est renvoyée ?",
        code: `def seuil():
    u = 8000
    n = 0
    while u < 9500:
        u = 0.8 * u + 2000
        n = n + 1
    return n`,
        choices: [
          { label: "a", content: "5" },
          { label: "b", content: "6" },
          { label: "c", content: "7" },
          { label: "d", content: "8" },
        ],
      },
      {
        id: "q12",
        statement: "Le polynôme suivant est :",
        math: String.raw`P(x)=-x^2+4x-4`,
        choices: [
          { label: "a", content: "Toujours positif" },
          { label: "b", content: "Toujours négatif ou nul" },
          { label: "c", content: "Positif entre ses racines" },
          { label: "d", content: "Négatif entre ses racines" },
        ],
      },
    ],
  },
  exercises: [
    {
      id: "ex1",
      title: "Exercice 1 — Suites et modélisation",
      points: "7 points",
      intro: [
        {
          type: "text",
          content:
            "La plateforme de streaming « NexusFlix » compte 8 000 abonnés au 1er janvier 2026. Chaque mois, on observe que 80 % des abonnés renouvellent leur abonnement, et que 2 000 nouveaux abonnés s'inscrivent.",
        },
        { type: "text", content: "On modélise le nombre d'abonnés, en milliers, au bout de n mois par la suite définie par :" },
        { type: "math", content: String.raw`u_0=8\quad\text{et}\quad u_{n+1}=0,8u_n+2` },
      ],
      questions: [
        {
          id: "ex1-q1",
          label: "1.",
          content: [{ type: "text", content: "Calculer u1 et u2. Interpréter u1 dans le contexte de l'exercice." }],
          points: "1 point",
        },
        {
          id: "ex1-q2a",
          label: "2.a.",
          content: [
            { type: "text", content: "On considère la suite définie par :" },
            { type: "math", content: String.raw`v_n=u_n-10` },
            { type: "text", content: "Démontrer que cette suite est géométrique, puis préciser sa raison et son premier terme." },
          ],
          points: "1,5 point",
        },
        {
          id: "ex1-q2b",
          label: "2.b.",
          content: [{ type: "text", content: "En déduire l'expression de vn, puis de un, en fonction de n." }],
          points: "1 point",
        },
        {
          id: "ex1-q3",
          label: "3.",
          content: [{ type: "text", content: "Déterminer la limite de la suite (un) et interpréter ce résultat pour l'entreprise." }],
          points: "1 point",
        },
        {
          id: "ex1-q4a",
          label: "4.a.",
          content: [
            { type: "text", content: "Résoudre algébriquement l'inéquation :" },
            { type: "math", content: String.raw`10-2\times 0,8^n\geq 9,5` },
            { type: "text", content: "On rappelle que :" },
            { type: "math", content: String.raw`\ln(0,25)\approx -1,38\quad\text{et}\quad \ln(0,8)\approx -0,22` },
          ],
          points: "1,5 point",
        },
        {
          id: "ex1-q4b",
          label: "4.b.",
          content: [{ type: "text", content: "Conclure." }],
          points: "1 point",
        },
      ],
    },
    {
      id: "ex2",
      title: "Exercice 2 — Analyse et exponentielle",
      points: "7 points",
      intro: [
        { type: "text", content: "On considère la fonction f définie sur l'intervalle [-1 ; 4] par :" },
        { type: "math", content: String.raw`f(x)=(2x-1)e^{-x}+2` },
        { type: "text", content: "On note Cf sa courbe représentative dans un repère orthogonal." },
      ],
      questions: [
        {
          id: "ex2-q1a",
          label: "1.a.",
          content: [
            { type: "text", content: "Démontrer que, pour tout réel x de l'intervalle [-1 ; 4], la dérivée est :" },
            { type: "math", content: String.raw`f'(x)=(3-2x)e^{-x}` },
          ],
          points: "1,5 point",
        },
        {
          id: "ex2-q1b",
          label: "1.b.",
          content: [{ type: "text", content: "Étudier le signe de f'(x) sur [-1 ; 4] et dresser le tableau de variations de f." }],
          points: "1,5 point",
        },
        {
          id: "ex2-q2",
          label: "2.",
          content: [{ type: "text", content: "Déterminer l'équation réduite de la tangente T à la courbe Cf au point d'abscisse 0." }],
          points: "1,5 point",
        },
        {
          id: "ex2-q3",
          label: "3.",
          content: [{ type: "text", content: "Résoudre l'équation f(x) = 2 sur [-1 ; 4]." }],
          points: "1 point",
        },
        {
          id: "ex2-q4",
          label: "4.",
          content: [{ type: "text", content: "Étudier la position relative de la courbe Cf et de la droite d'équation y = 2 sur l'intervalle [-1 ; 4]." }],
          points: "1,5 point",
        },
      ],
    },
  ],
};
