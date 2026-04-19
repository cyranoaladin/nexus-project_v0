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
  dureeRecommandee: number; // en minutes
}

export const EPREUVE_MATHS_1ERE = {
  titre: "Épreuve anticipée de Mathématiques",
  dureeMinutes: 120,
  duree: 120, // Alias pour compatibilité
  calculatrice: "Interdite",
  totalPoints: 20,
  parties: [
    {
      id: "automatismes",
      nom: "Partie 1 : Automatismes",
      points: 6,
      description: "Série de questions courtes (calcul mental, lecture graphique, rappels de cours).",
      strategie: "À faire en 20 minutes maximum. Visez le 6/6 sans hésitation.",
      dureeRecommandee: 20
    },
    {
      id: "exercices",
      nom: "Partie 2 : Exercices de Raisonnement",
      points: 14,
      description: "3 exercices longs portant sur les thèmes majeurs (Suites, Fonctions, Probabilités).",
      strategie: "Soignez la rédaction et la justification. Un résultat juste sans démonstration perd 50% des points.",
      dureeRecommandee: 100
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
  ],
  conseilsGeneraux: [
    "Arrivez 15 minutes en avance pour stabiliser votre stress.",
    "Lisez l'intégralité du sujet avant de commencer.",
    "Commencez par les automatismes (20 min chrono).",
    "Ne restez pas bloqué plus de 5 minutes sur une question.",
    "Gardez 10 minutes à la fin pour la relecture."
  ]
};

// ─── Types ────────────────────────────────────────────────────────────────────

export interface AutomatismeBloc {
  id: string;
  theme: string;
  enonce: string;
  reponse: string;
  points: number;
  astuce?: string;
}

export interface QuestionExercice {
  numero: string;
  enonce: string;
  points: number;
  competences: string[];
  solution: string[];
}

export interface ExerciceBloc {
  id: string;
  titre: string;
  totalPoints: number;
  dureeEstimee: number; // minutes
  contexte: string;
  piegesClassiques: string[];
  questions: QuestionExercice[];
}

export interface SujetBlanc {
  id: string;
  titre: string;
  automatismes: AutomatismeBloc[];
  exercices: ExerciceBloc[];
}

// ─── Sujet Blanc #1 — Printemps 2026 ────────────────────────────────────────

export const SUJET_BLANC_1: SujetBlanc = {
  id: "sb1",
  titre: "Sujet Blanc #1 — Stage Printemps 2026",
  automatismes: [
    {
      id: "a1",
      theme: "Calcul mental",
      enonce: "Calculer $25\\%$ de $84$.",
      reponse: "$21$",
      points: 1,
      astuce: "25% = 1/4. Divise 84 par 4.",
    },
    {
      id: "a2",
      theme: "Second degré",
      enonce: "Donner la forme canonique de $x^2 - 4x + 3$.",
      reponse: "$(x - 2)^2 - 1$",
      points: 1,
      astuce: "Compléter le carré : $x^2 - 4x = (x-2)^2 - 4$. Ajouter 3.",
    },
    {
      id: "a3",
      theme: "Dérivation",
      enonce: "Donner la dérivée de $f(x) = 3x^2 - 5x + 2$.",
      reponse: "$f'(x) = 6x - 5$",
      points: 1,
      astuce: "Dériver terme à terme : $(ax^n)' = n \\cdot a x^{n-1}$.",
    },
    {
      id: "a4",
      theme: "Probabilités",
      enonce: "Un événement $A$ a une probabilité $P(A) = 0{,}3$. Quelle est la probabilité de $\\bar{A}$ ?",
      reponse: "$P(\\bar{A}) = 0{,}7$",
      points: 1,
      astuce: "$P(\\bar{A}) = 1 - P(A)$. La somme des probabilités d'un événement et de son complémentaire vaut 1.",
    },
    {
      id: "a5",
      theme: "Suites",
      enonce: "Soit $(u_n)$ arithmétique avec $u_0 = 2$ et de raison $r = 3$. Calculer $u_5$.",
      reponse: "$u_5 = 17$",
      points: 1,
      astuce: "Formule : $u_n = u_0 + n \\cdot r$. Ici $u_5 = 2 + 5 \\times 3 = 17$.",
    },
    {
      id: "a6",
      theme: "Lecture graphique",
      enonce: "Une fonction $f$ est croissante sur $[0; 2]$ et décroissante sur $[2; 5]$. Où est son maximum ?",
      reponse: "En $x = 2$",
      points: 1,
      astuce: "Le maximum d'une fonction est atteint là où elle passe de croissante à décroissante.",
    },
  ],
  exercices: [
    {
      id: "ex1",
      titre: "Suites numériques — Modélisation d'une colonie",
      totalPoints: 5,
      dureeEstimee: 35,
      contexte:
        "Une colonie de bactéries contient initialement $u_0 = 500$ individus. " +
        "Elle triple de taille toutes les 2 heures. " +
        "On note $u_n$ le nombre de bactéries après $n$ périodes de 2 heures.",
      piegesClassiques: [
        "Oublier que $u_0$ est le terme initial (indice 0, pas 1)",
        "Confondre suite arithmétique et géométrique : ici la raison est 3, c'est géométrique",
        "Calculer $u_n = 500 \\times 3n$ au lieu de $500 \\times 3^n$",
      ],
      questions: [
        {
          numero: "1",
          enonce: "Vérifier que $(u_n)$ est une suite géométrique de raison $q = 3$ et donner son terme général.",
          points: 2,
          competences: ["MODÉLISER", "CALCULER"],
          solution: [
            "On a $u_{n+1} = 3u_n$ pour tout entier $n \\geq 0$.",
            "Donc $(u_n)$ est géométrique de premier terme $u_0 = 500$ et de raison $q = 3$.",
            "**Terme général :** $u_n = 500 \\times 3^n$.",
          ],
        },
        {
          numero: "2",
          enonce: "Calculer $u_3$. Interpréter le résultat dans le contexte.",
          points: 1,
          competences: ["CALCULER", "COMMUNIQUER"],
          solution: [
            "$u_3 = 500 \\times 3^3 = 500 \\times 27 = 13\\,500$.",
            "Après 6 heures (3 périodes de 2h), la colonie compte **13 500 bactéries**.",
          ],
        },
        {
          numero: "3",
          enonce:
            "On souhaite que la colonie dépasse 100 000 individus. " +
            "En utilisant des calculs numériques successifs, déterminer le plus petit entier $n$ tel que $u_n > 100\\,000$.",
          points: 2,
          competences: ["RAISONNER", "CALCULER"],
          solution: [
            "$u_4 = 500 \\times 81 = 40\\,500 < 100\\,000$",
            "$u_5 = 500 \\times 243 = 121\\,500 > 100\\,000$",
            "Le plus petit entier $n$ cherché est $n = 5$, soit après **10 heures**.",
          ],
        },
      ],
    },
    {
      id: "ex2",
      titre: "Probabilités — Contrôle qualité en usine",
      totalPoints: 5,
      dureeEstimee: 35,
      contexte:
        "Une usine fabrique des pièces. 5% des pièces sont défectueuses. " +
        "On prélève une pièce au hasard et on la soumet à un test de détection. " +
        "Si la pièce est défectueuse, le test est positif avec une probabilité 0,92. " +
        "Si la pièce est conforme, le test est positif par erreur avec une probabilité 0,04. " +
        "On note $D$ l'événement « la pièce est défectueuse » et $T$ l'événement « le test est positif ».",
      piegesClassiques: [
        "Confondre $P(T | D)$ et $P(D | T)$ (probabilité conditionnelle)",
        "Oublier de multiplier par les probabilités a priori dans la formule des probabilités totales",
        "Ne pas bien décrire l'arbre pondéré (branches manquantes ou mal étiquetées)",
      ],
      questions: [
        {
          numero: "1",
          enonce: "Construire un arbre pondéré représentant la situation.",
          points: 1,
          competences: ["REPRÉSENTER", "MODÉLISER"],
          solution: [
            "Arbre à deux niveaux :",
            "**Niveau 1 :** $D$ avec probabilité $0{,}05$ ; $\\bar{D}$ avec probabilité $0{,}95$.",
            "**Niveau 2 (depuis $D$) :** $T$ avec $P(T|D) = 0{,}92$ ; $\\bar{T}$ avec $0{,}08$.",
            "**Niveau 2 (depuis $\\bar{D}$) :** $T$ avec $P(T|\\bar{D}) = 0{,}04$ ; $\\bar{T}$ avec $0{,}96$.",
          ],
        },
        {
          numero: "2",
          enonce: "Calculer $P(T)$, la probabilité que le test soit positif.",
          points: 2,
          competences: ["CALCULER", "RAISONNER"],
          solution: [
            "Par la formule des probabilités totales :",
            "$$P(T) = P(T \\cap D) + P(T \\cap \\bar{D})$$",
            "$$= P(D) \\times P(T|D) + P(\\bar{D}) \\times P(T|\\bar{D})$$",
            "$$= 0{,}05 \\times 0{,}92 + 0{,}95 \\times 0{,}04 = 0{,}046 + 0{,}038 = 0{,}084$$",
          ],
        },
        {
          numero: "3",
          enonce: "Sachant que le test est positif, quelle est la probabilité que la pièce soit réellement défectueuse ?",
          points: 2,
          competences: ["CALCULER", "COMMUNIQUER"],
          solution: [
            "On cherche $P(D | T)$. Par la formule de Bayes :",
            "$$P(D|T) = \\frac{P(D \\cap T)}{P(T)} = \\frac{P(D) \\times P(T|D)}{P(T)}$$",
            "$$= \\frac{0{,}05 \\times 0{,}92}{0{,}084} = \\frac{0{,}046}{0{,}084} \\approx 0{,}548$$",
            "**Interprétation :** Sachant que le test est positif, la pièce n'est défectueuse que dans environ **55%** des cas.",
          ],
        },
      ],
    },
    {
      id: "ex3",
      titre: "Fonctions — Étude et optimisation",
      totalPoints: 4,
      dureeEstimee: 30,
      contexte:
        "On considère la fonction $f$ définie sur $\\mathbb{R}$ par $f(x) = -x^2 + 4x + 1$.",
      piegesClassiques: [
        "Oublier que la parabole est tournée vers le bas car le coefficient de $x^2$ est négatif ($a < 0$)",
        "Confondre les notions de maximum et de minimum",
        "Écrire $f'(x) = 0$ sans résoudre l'équation pour trouver le sommet",
      ],
      questions: [
        {
          numero: "1",
          enonce: "Calculer $f'(x)$ et déterminer le signe de $f'(x)$ selon les valeurs de $x$.",
          points: 2,
          competences: ["CALCULER", "ANALYSER"],
          solution: [
            "$f'(x) = -2x + 4$.",
            "$f'(x) = 0 \\Leftrightarrow -2x + 4 = 0 \\Leftrightarrow x = 2$.",
            "**Signe :** $f'(x) > 0$ sur $]-\\infty ; 2[$ et $f'(x) < 0$ sur $]2 ; +\\infty[$.",
          ],
        },
        {
          numero: "2",
          enonce: "En déduire le tableau de variations de $f$ sur $\\mathbb{R}$ et la valeur du maximum de $f$.",
          points: 2,
          competences: ["REPRÉSENTER", "RAISONNER"],
          solution: [
            "$f$ est croissante sur $]-\\infty ; 2]$ et décroissante sur $[2 ; +\\infty[$.",
            "**Maximum :** $f$ admet un maximum en $x = 2$.",
            "$f(2) = -(2)^2 + 4 \\times 2 + 1 = -4 + 8 + 1 = \\mathbf{5}$.",
            "Le maximum de $f$ est $\\mathbf{5}$, atteint en $x = 2$.",
          ],
        },
      ],
    },
  ],
};

