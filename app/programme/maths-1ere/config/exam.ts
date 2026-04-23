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
        {
          numero: "3",
          enonce: "Calculer la probabilité qu'il ait au moins une bonne réponse.",
          points: 1,
          competences: ["RAISONNER", "CALCULER"],
          solution: [
            "$P(X \geq 1) = 1 - P(X = 0) = 1 - (3/4)^5 = 1 - 243/1024 = 781/1024 \approx 0.763$."
          ],
        },
      ],
    },
  ],
};

// ─── Sujet Blanc #2 — Variante Fonctions / Géométrie ────────────────────────

export const SUJET_BLANC_2: SujetBlanc = {
  id: "sb2",
  titre: "Sujet Blanc #2 — Fonctions et Géométrie",
  automatismes: [
    {
      id: "a1",
      theme: "Dérivation",
      enonce: "Donner la dérivée de $f(x) = x^3 - 6x^2 + 9x + 1$.",
      reponse: "$f'(x) = 3x^2 - 12x + 9$",
      points: 1,
      astuce: "Dériver terme à terme : $(x^n)' = nx^{n-1}$.",
    },
    {
      id: "a2",
      theme: "Produit scalaire",
      enonce: "Calculer $\vec{u}(3; -2) \cdot \vec{v}(4; 5)$.",
      reponse: "$2$",
      points: 1,
      astuce: "$\vec{u} \cdot \vec{v} = x_1x_2 + y_1y_2 = 3 \times 4 + (-2) \times 5 = 12 - 10 = 2$.",
    },
    {
      id: "a3",
      theme: "Second degré",
      enonce: "Résoudre $x^2 - 5x + 6 = 0$.",
      reponse: "$x = 2$ ou $x = 3$",
      points: 1,
      astuce: "Factoriser : $(x-2)(x-3) = 0$. Racines : 2 et 3.",
    },
    {
      id: "a4",
      theme: "Trigonométrie",
      enonce: "Quelle est la valeur de $\cos(60°)$ ?",
      reponse: "$1/2$",
      points: 1,
      astuce: "Valeur remarquable : $\cos(60°) = 1/2$.",
    },
    {
      id: "a5",
      theme: "Variations",
      enonce: "Si $f'(x) > 0$ sur $[a; b]$, que peut-on dire de $f$ ?",
      reponse: "$f$ est strictement croissante sur $[a; b]$",
      points: 1,
      astuce: "Signe de la dérivée et sens de variation : $f' > 0 \Rightarrow f$ croissante.",
    },
    {
      id: "a6",
      theme: "Géométrie vectorielle",
      enonce: "Les points $A(1; 2)$, $B(3; 6)$, $C(5; 10)$ sont-ils alignés ?",
      reponse: "Oui",
      points: 1,
      astuce: "Vecteurs colinéaires : $\vec{AB} = (2; 4)$ et $\vec{AC} = (4; 8)$ sont proportionnels.",
    },
  ],
  exercices: [
    {
      id: "ex1",
      titre: "Fonction polynôme — Étude complète",
      totalPoints: 5,
      dureeEstimee: 35,
      contexte: "On considère la fonction $f$ définie sur $\mathbb{R}$ par $f(x) = x^3 - 6x^2 + 9x + 1$.",
      piegesClassiques: [
        "Oublier de vérifier le signe de la dérivée de part et d'autre des points critiques",
        "Confondre maximum local et maximum global",
        "Ne pas dresser le tableau de variations complet"
      ],
      questions: [
        {
          numero: "1",
          enonce: "Calculer $f'(x)$ et déterminer les points critiques de $f$.",
          points: 2,
          competences: ["CALCULER", "RAISONNER"],
          solution: [
            "$f'(x) = 3x^2 - 12x + 9 = 3(x^2 - 4x + 3) = 3(x-1)(x-3)$.",
            "Points critiques : $f'(x) = 0 \Leftrightarrow x = 1$ ou $x = 3$."
          ],
        },
        {
          numero: "2",
          enonce: "Dresser le tableau de variations de $f$ sur $\mathbb{R}$.",
          points: 2,
          competences: ["REPRÉSENTER", "ANALYSER"],
          solution: [
            "Signe de $f'(x)$ : $+$ sur $]-\infty; 1[$, $-$ sur $]1; 3[$, $+$ sur $]3; +\infty[$.",
            "$f$ croissante sur $]-\infty; 1]$, décroissante sur $[1; 3]$, croissante sur $[3; +\infty[$.",
            "Maximum local en $x=1$ : $f(1) = 5$. Minimum local en $x=3$ : $f(3) = 1$."
          ],
        },
        {
          numero: "3",
          enonce: "Déterminer le nombre de solutions de l'équation $f(x) = 0$.",
          points: 1,
          competences: ["RAISONNER", "CALCULER"],
          solution: [
            "Par le théorème des valeurs intermédiaires et les variations :",
            "$\lim_{x \to -\infty} f(x) = -\infty$, $f(1) = 5 > 0$, $f(3) = 1 > 0$, $\lim_{x \to +\infty} f(x) = +\infty$.",
            "Une seule solution (négative) car $f$ passe de $-\infty$ à $5$ en croissant."
          ],
        },
      ],
    },
    {
      id: "ex2",
      titre: "Géométrie vectorielle — Alignement et orthogonalité",
      totalPoints: 5,
      dureeEstimee: 35,
      contexte: "Dans un repère orthonormé, on donne les points $A(1; 2)$, $B(4; 6)$, $C(7; 10)$ et $D(5; -1)$.",
      piegesClassiques: [
        "Confondre colinéarité (déterminant nul) et orthogonalité (produit scalaire nul)",
        "Se tromper dans le calcul des coordonnées de vecteurs",
        "Oublier de conclure sur l'alignement ou la perpendicularité"
      ],
      questions: [
        {
          numero: "1",
          enonce: "Montrer que les points $A$, $B$ et $C$ sont alignés.",
          points: 2,
          competences: ["CALCULER", "RAISONNER"],
          solution: [
            "$\vec{AB} = (4-1; 6-2) = (3; 4)$.",
            "$\vec{AC} = (7-1; 10-2) = (6; 8)$.",
            "Déterminant : $3 \times 8 - 4 \times 6 = 24 - 24 = 0$. Vecteurs colinéaires, donc points alignés."
          ],
        },
        {
          numero: "2",
          enonce: "Les droites $(AB)$ et $(AD)$ sont-elles perpendiculaires ?",
          points: 2,
          competences: ["CALCULER", "RAISONNER"],
          solution: [
            "$\vec{AD} = (5-1; -1-2) = (4; -3)$.",
            "Produit scalaire : $\vec{AB} \cdot \vec{AD} = 3 \times 4 + 4 \times (-3) = 12 - 12 = 0$.",
            "Le produit scalaire est nul, donc les vecteurs sont orthogonaux : $(AB) \perp (AD)$."
          ],
        },
        {
          numero: "3",
          enonce: "Calculer la distance $AB$.",
          points: 1,
          competences: ["CALCULER"],
          solution: [
            "$AB = \|\vec{AB}\| = \sqrt{3^2 + 4^2} = \sqrt{9 + 16} = \sqrt{25} = 5$."
          ],
        },
      ],
    },
    {
      id: "ex3",
      titre: "Trigonométrie — Résolution d'équation",
      totalPoints: 4,
      dureeEstimee: 30,
      contexte: "Résoudre l'équation $\cos(x) = \frac{\sqrt{2}}{2}$ sur l'intervalle $[0; 2\pi]$.",
      piegesClassiques: [
        "Oublier la deuxième solution sur $[0; 2\pi]$",
        "Confondre degrés et radians",
        "Ne pas vérifier que les solutions sont dans l'intervalle demandé"
      ],
      questions: [
        {
          numero: "1",
          enonce: "Trouver toutes les solutions de $\cos(x) = \frac{\sqrt{2}}{2}$ sur $[0; 2\pi]$.",
          points: 2,
          competences: ["CALCULER", "RAISONNER"],
          solution: [
            "On sait que $\cos(\frac{\pi}{4}) = \frac{\sqrt{2}}{2}$.",
            "Solutions générales : $x = \frac{\pi}{4} + 2k\pi$ ou $x = -\frac{\pi}{4} + 2k\pi$.",
            "Sur $[0; 2\pi]$ : $x = \frac{\pi}{4}$ et $x = 2\pi - \frac{\pi}{4} = \frac{7\pi}{4}$."
          ],
        },
        {
          numero: "2",
          enonce: "Représenter ces solutions sur le cercle trigonométrique.",
          points: 2,
          competences: ["REPRÉSENTER", "COMMUNIQUER"],
          solution: [
            "$\frac{\pi}{4}$ (45°) : premier quadrant, bissectrice.",
            "$\frac{7\pi}{4}$ (315°) : quatrième quadrant, symétrique par rapport à l'axe des abscisses."
          ],
        },
      ],
    },
  ],
};

// ─── Sujet Blanc #3 — Variante Suites / Probabilités avancées ─────────────

export const SUJET_BLANC_3: SujetBlanc = {
  id: "sb3",
  titre: "Sujet Blanc #3 — Suites et Probabilités",
  automatismes: [
    {
      id: "a1",
      theme: "Suites géométriques",
      enonce: "Soit $(u_n)$ géométrique de raison $q = 2$ et $u_0 = 3$. Calculer $u_5$.",
      reponse: "$u_5 = 96$",
      points: 1,
      astuce: "$u_n = u_0 \times q^n = 3 \times 2^5 = 3 \times 32 = 96$.",
    },
    {
      id: "a2",
      theme: "Probabilités conditionnelles",
      enonce: "Si $P(A) = 0.4$ et $P_A(B) = 0.5$, calculer $P(A \cap B)$.",
      reponse: "$0.2$",
      points: 1,
      astuce: "$P(A \cap B) = P(A) \times P_A(B) = 0.4 \times 0.5 = 0.2$.",
    },
    {
      id: "a3",
      theme: "Variables aléatoires",
      enonce: "Une variable $X$ prend les valeurs 1 et 2 avec $P(X=1) = 0.3$. Calculer $P(X=2)$.",
      reponse: "$0.7$",
      points: 1,
      astuce: "Somme des probabilités = 1 : $P(X=2) = 1 - 0.3 = 0.7$.",
    },
    {
      id: "a4",
      theme: "Dérivation",
      enonce: "Donner la dérivée de $f(x) = e^{2x}$.",
      reponse: "$f'(x) = 2e^{2x}$",
      points: 1,
      astuce: "$(e^{ax})' = a \cdot e^{ax}$. Ici $a = 2$.",
    },
    {
      id: "a5",
      theme: "Second degré",
      enonce: "Discriminant de $2x^2 - 4x + 3 = 0$ ?",
      reponse: "$\Delta = -8 < 0$ (pas de racine réelle)",
      points: 1,
      astuce: "$\Delta = b^2 - 4ac = (-4)^2 - 4 \times 2 \times 3 = 16 - 24 = -8$.",
    },
    {
      id: "a6",
      theme: "Loi binomiale",
      enonce: "$X \sim B(n=5, p=0.3)$. Quelle est l'espérance de $X$ ?",
      reponse: "$E(X) = 1.5$",
      points: 1,
      astuce: "$E(X) = n \times p = 5 \times 0.3 = 1.5$.",
    },
  ],
  exercices: [
    {
      id: "ex1",
      titre: "Suites — Modélisation d'évolution de population",
      totalPoints: 5,
      dureeEstimee: 35,
      contexte: "Une population de lapins évolue selon une suite $(u_n)$. En 2024 ($n=0$), il y a 100 lapins. Chaque année, la population augmente de 20% puis on retire 10 lapins.",
      piegesClassiques: [
        "Ne pas traduire correctement 'augmente de 20%' en 'multiplie par 1.2'",
        "Oublier de soustraire les 10 lapins après l'augmentation",
        "Confondre suite arithmétique et suite de type $u_{n+1} = au_n + b$"
      ],
      questions: [
        {
          numero: "1",
          enonce: "Montrer que $u_{n+1} = 1.2u_n - 10$.",
          points: 1,
          competences: ["MODÉLISER"],
          solution: [
            "Augmentation de 20% : $\times 1.2$.",
            "Puis retrait de 10 lapins : $-10$.",
            "Donc $u_{n+1} = 1.2u_n - 10$."
          ],
        },
        {
          numero: "2",
          enonce: "Calculer $u_1$ et $u_2$.",
          points: 2,
          competences: ["CALCULER"],
          solution: [
            "$u_1 = 1.2 \times 100 - 10 = 120 - 10 = 110$.",
            "$u_2 = 1.2 \times 110 - 10 = 132 - 10 = 122$."
          ],
        },
        {
          numero: "3",
          enonce: "Déterminer la limite de cette suite si elle converge.",
          points: 2,
          competences: ["RAISONNER", "CALCULER"],
          solution: [
            "Point fixe : $\ell = 1.2\ell - 10 \Rightarrow -0.2\ell = -10 \Rightarrow \ell = 50$.",
            "Comme $1.2 > 1$, la suite diverge (croît indéfiniment)."
          ],
        },
      ],
    },
    {
      id: "ex2",
      titre: "Probabilités — Arbre pondéré et indépendance",
      totalPoints: 5,
      dureeEstimee: 35,
      contexte: "Dans une urne, il y a 3 boules rouges et 2 boules bleues. On tire une boule, on note sa couleur, on la remet dans l'urne, puis on tire une deuxième boule.",
      piegesClassiques: [
        "Confondre tirage avec et sans remise",
        "Oublier que les tirages sont indépendants avec remise",
        "Ne pas construire l'arbre pondéré correctement"
      ],
      questions: [
        {
          numero: "1",
          enonce: "Construire l'arbre pondéré des deux tirages.",
          points: 1,
          competences: ["REPRÉSENTER", "MODÉLISER"],
          solution: [
            "Premier tirage : $R$ (proba 3/5) ou $B$ (proba 2/5).",
            "Deuxième tirage (identique car remise) : $R$ (3/5) ou $B$ (2/5)."
          ],
        },
        {
          numero: "2",
          enonce: "Calculer la probabilité d'obtenir deux boules rouges.",
          points: 2,
          competences: ["CALCULER"],
          solution: [
            "$P(R_1 \cap R_2) = P(R_1) \times P(R_2) = \frac{3}{5} \times \frac{3}{5} = \frac{9}{25} = 0.36$."
          ],
        },
        {
          numero: "3",
          enonce: "Calculer la probabilité d'obtenir deux boules de même couleur.",
          points: 2,
          competences: ["CALCULER", "RAISONNER"],
          solution: [
            "Même couleur : $RR$ ou $BB$.",
            "$P(RR) = (3/5)^2 = 9/25$.",
            "$P(BB) = (2/5)^2 = 4/25$.",
            "$P(\text{même couleur}) = 9/25 + 4/25 = 13/25 = 0.52$."
          ],
        },
      ],
    },
    {
      id: "ex3",
      titre: "Loi binomiale — Application",
      totalPoints: 4,
      dureeEstimee: 30,
      contexte: "Un QCM comporte 5 questions. Pour chaque question, 4 réponses sont proposées dont une seule est correcte. Un élève répond au hasard.",
      piegesClassiques: [
        "Ne pas reconnaître une situation de Bernoulli répétée",
        "Confondre $P(X = k)$ et $P(X \leq k)$",
        "Oublier le coefficient binomial dans la formule"
      ],
      questions: [
        {
          numero: "1",
          enonce: "Quelle est la loi suivie par $X$ = nombre de bonnes réponses ? Donner ses paramètres.",
          points: 1,
          competences: ["MODÉLISER"],
          solution: [
            "$X \sim B(n=5, p=1/4)$ car 5 questions indépendantes, probabilité de succès $1/4$ à chaque fois."
          ],
        },
        {
          numero: "2",
          enonce: "Calculer $P(X = 2)$.",
          points: 2,
          competences: ["CALCULER"],
          solution: [
            "$P(X=2) = C_5^2 \times (1/4)^2 \times (3/4)^3$.",
            "$= 10 \times (1/16) \times (27/64) = 270/1024 \approx 0.264$."
          ],
        },
        {
          numero: "3",
          enonce: "Calculer la probabilité qu'il ait au moins une bonne réponse.",
          points: 1,
          competences: ["RAISONNER", "CALCULER"],
          solution: [
            "$P(X \geq 1) = 1 - P(X = 0) = 1 - (3/4)^5 = 1 - 243/1024 = 781/1024 \approx 0.763$."
          ],
        },
      ],
    },
  ],
};
