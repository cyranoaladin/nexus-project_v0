/**
 * Programme Data for Première Générale Spécialité Maths
 * Based on B.O. Éducation Nationale 2025-2026
 */

export interface ExerciceData {
  question: string;
  reponse: string;
  etapes: string[];
}

export interface TableauRow {
  f: string;
  derivee: string;
}

export interface CasRow {
  delta: string;
  solution: string;
}

export interface ChapitreContenu {
  rappel: string;
  methode: string;
  tableau?: TableauRow[];
  cas?: CasRow[];
  astuce: string;
  exercice: ExerciceData;
}

export interface Chapitre {
  id: string;
  titre: string;
  niveau: 'essentiel' | 'maitrise' | 'approfondissement';
  contenu: ChapitreContenu;
}

export interface Categorie {
  titre: string;
  icon: string;
  couleur: string;
  chapitres: Chapitre[];
}

export interface QuizQuestion {
  id: number;
  question: string;
  options: string[];
  correct: number;
  explication: string;
  categorie: string;
}

export const programmeData: Record<string, Categorie> = {
  algebre: {
    titre: 'Algèbre & Suites',
    icon: '📈',
    couleur: 'cyan',
    chapitres: [
      {
        id: 'suites',
        titre: 'Suites Numériques',
        niveau: 'essentiel',
        contenu: {
          rappel:
            'Une suite peut être définie par une formule explicite $u_n = f(n)$ ou par récurrence $u_{n+1} = f(u_n)$.',
          methode:
            '\\text{Arithmétique : } u_{n+1} = u_n + r \\Rightarrow u_n = u_0 + nr \\\\ \\text{Géométrique : } u_{n+1} = q \\times u_n \\Rightarrow u_n = u_0 \\times q^n',
          tableau: [
            { f: 'Somme $1+2+...+n$', derivee: '$\\frac{n(n+1)}{2}$' },
            {
              f: 'Somme $1+q+...+q^n$',
              derivee: '$\\frac{1-q^{n+1}}{1-q}$ ($q \\neq 1$)',
            },
          ],
          astuce:
            'Pour étudier le sens de variation, étudiez le signe de $u_{n+1} - u_n$. Si $>0$, la suite est croissante.',
          exercice: {
            question:
              'Soit $(u_n)$ définie par $u_0=2$ et $u_{n+1}=u_n+3$. Calculer $u_{10}$.',
            reponse: '32',
            etapes: [
              'Reconnaître une suite arithmétique de raison $r=3$.',
              'Formule explicite : $u_n = u_0 + n \\times r$.',
              '$u_{10} = 2 + 10 \\times 3 = 32$.',
            ],
          },
        },
      },
      {
        id: 'second-degre',
        titre: 'Second Degré',
        niveau: 'essentiel',
        contenu: {
          rappel:
            'Fonction polynôme $f(x) = ax^2+bx+c$. Forme canonique : $a(x-\\alpha)^2+\\beta$.',
          methode:
            '\\Delta = b^2-4ac \\\\ \\text{Si } \\Delta > 0, x_{1,2} = \\frac{-b \\pm \\sqrt{\\Delta}}{2a}',
          cas: [
            {
              delta: '\\Delta > 0',
              solution:
                '2 racines distinctes, du signe de $a$ à l\'extérieur.',
            },
            {
              delta: '\\Delta = 0',
              solution:
                '1 racine double $-b/2a$, du signe de $a$ partout.',
            },
            {
              delta: '\\Delta < 0',
              solution:
                'Pas de racine réelle, toujours du signe de $a$.',
            },
          ],
          astuce:
            'Si $a$ et $c$ sont de signes opposés, $\\Delta$ est forcément positif (2 solutions).',
          exercice: {
            question: 'Résoudre $2x^2 - 4x - 6 = 0$.',
            reponse: 'S=\\{-1; 3\\}',
            etapes: [
              'Calcul de $\\Delta = (-4)^2 - 4(2)(-6) = 16 + 48 = 64$.',
              '$\\sqrt{\\Delta} = 8$.',
              '$x_1 = (4-8)/4 = -1$, $x_2 = (4+8)/4 = 3$.',
            ],
          },
        },
      },
    ],
  },
  analyse: {
    titre: 'Analyse (Fonctions)',
    icon: '📉',
    couleur: 'blue',
    chapitres: [
      {
        id: 'derivation',
        titre: 'Dérivation',
        niveau: 'maitrise',
        contenu: {
          rappel:
            "Le nombre dérivé $f'(a)$ est la limite du taux de variation. C'est la pente de la tangente.",
          methode: "Tangente en $a$ : y = f'(a)(x-a) + f(a)",
          tableau: [
            { f: '$x^n$', derivee: '$nx^{n-1}$' },
            { f: '$\\frac{1}{x}$', derivee: '$-\\frac{1}{x^2}$' },
            { f: '$\\sqrt{x}$', derivee: '$\\frac{1}{2\\sqrt{x}}$' },
            { f: '$e^x$', derivee: '$e^x$' },
          ],
          astuce:
            "Le signe de la dérivée $f'(x)$ donne les variations de la fonction $f$.",
          exercice: {
            question: "Dériver $f(x) = x^3 - 5x + 1$.",
            reponse: "$f'(x) = 3x^2 - 5$",
            etapes: [
              'Dérivée de $x^3$ est $3x^2$.',
              'Dérivée de $-5x$ est $-5$.',
              'Dérivée de la constante 1 est 0.',
            ],
          },
        },
      },
      {
        id: 'exponentielle',
        titre: 'Fonction Exponentielle',
        niveau: 'maitrise',
        contenu: {
          rappel:
            "L'unique fonction $f$ telle que $f'=f$ et $f(0)=1$. Elle est strictement positive sur $\\mathbb{R}$.",
          methode:
            "Propriétés : e^{a+b} = e^a \\times e^b \\quad e^{-a} = 1/e^a \\quad (e^{u})' = u'e^u",
          astuce:
            "$e^x$ l'emporte toujours sur les polynômes en $+\\infty$ (croissance comparée).",
          exercice: {
            question: 'Simplifier $A = e^x \\times e^{-x+2}$.',
            reponse: '$e^2$',
            etapes: [
              'Utiliser $e^a \\times e^b = e^{a+b}$.',
              '$A = e^{x + (-x+2)} = e^2$.',
            ],
          },
        },
      },
      {
        id: 'trigonometrie',
        titre: 'Trigonométrie',
        niveau: 'approfondissement',
        contenu: {
          rappel:
            'Cercle trigonométrique. Mesure en radians. $\\cos^2(x) + \\sin^2(x) = 1$.',
          methode:
            'Périodicité : \\cos(x+2\\pi) = \\cos(x) \\quad \\text{Parité : } \\cos(-x)=\\cos(x), \\sin(-x)=-\\sin(x)',
          tableau: [
            { f: '$\\cos(x)$', derivee: '$-\\sin(x)$' },
            { f: '$\\sin(x)$', derivee: '$\\cos(x)$' },
          ],
          astuce:
            'Visualisez toujours le cercle trigonométrique pour retrouver les signes.',
          exercice: {
            question:
              'Résoudre $\\cos(x) = 1/2$ sur $[0; 2\\pi]$.',
            reponse: 'S = \\{\\pi/3 ; 5\\pi/3\\}',
            etapes: [
              'On sait que $\\cos(\\pi/3) = 1/2$.',
              'Par symétrie axiale, $-\\pi/3$ est aussi solution.',
              'Sur $[0; 2\\pi]$, $-\\pi/3$ correspond à $2\\pi - \\pi/3 = 5\\pi/3$.',
            ],
          },
        },
      },
    ],
  },
  geometrie: {
    titre: 'Géométrie & Probas',
    icon: '📐',
    couleur: 'purple',
    chapitres: [
      {
        id: 'produit-scalaire',
        titre: 'Produit Scalaire',
        niveau: 'essentiel',
        contenu: {
          rappel:
            'Outil pour calculer longueurs et angles. $\\vec{u} \\cdot \\vec{v} = ||\\vec{u}|| \\times ||\\vec{v}|| \\times \\cos(\\vec{u},\\vec{v})$.',
          methode:
            'Analytique : xx\' + yy\' \\quad Orthogonalité : \\vec{u} \\perp \\vec{v} \\iff \\vec{u} \\cdot \\vec{v} = 0',
          astuce:
            "Utilisez Al-Kashi pour les triangles quelconques : $a^2 = b^2 + c^2 - 2bc\\cos(A)$.",
          exercice: {
            question:
              'Calculer $\\vec{u}(2; -1) \\cdot \\vec{v}(3; 4)$.',
            reponse: '2',
            etapes: [
              "Formule $xx' + yy'$.",
              '$2 \\times 3 + (-1) \\times 4$',
              '$6 - 4 = 2$.',
            ],
          },
        },
      },
      {
        id: 'probabilites',
        titre: 'Probabilités Cond.',
        niveau: 'essentiel',
        contenu: {
          rappel:
            'Probabilité de B sachant A : $P_A(B) = P(A \\cap B) / P(A)$.',
          methode:
            "Arbre pondéré : La somme des probabilités des branches issues d'un nœud vaut 1.",
          cas: [
            {
              delta: 'Indépendance',
              solution: '$P(A \\cap B) = P(A) \\times P(B)$',
            },
            {
              delta: 'Probas Totales',
              solution:
                '$P(B) = P(A \\cap B) + P(\\bar{A} \\cap B)$',
            },
          ],
          astuce:
            'Ne confondez pas $P_A(B)$ (branche secondaire) et $P(A \\cap B)$ (chemin complet).',
          exercice: {
            question:
              'Si $P(A)=0.5$ et $P_A(B)=0.2$, calculer $P(A \\cap B)$.',
            reponse: '0.1',
            etapes: [
              'Formule : $P(A \\cap B) = P(A) \\times P_A(B)$.',
              '$0.5 \\times 0.2 = 0.1$.',
            ],
          },
        },
      },
    ],
  },
};

export const quizData: QuizQuestion[] = [
  {
    id: 1,
    question: 'Quelle est la dérivée de $f(x) = x^2$ ?',
    options: ['$x$', '$2x$', '$1$', '$x^2$'],
    correct: 1,
    explication:
      "La formule est $(x^n)' = nx^{n-1}$, donc $(x^2)' = 2x^{2-1} = 2x$.",
    categorie: 'Dérivation',
  },
  {
    id: 2,
    question: 'Discriminant de $x^2 + x + 1$ ?',
    options: ['3', '-3', '5', '1'],
    correct: 1,
    explication:
      '$\\Delta = b^2 - 4ac = 1^2 - 4(1)(1) = 1 - 4 = -3$.',
    categorie: 'Second Degré',
  },
  {
    id: 3,
    question: 'Que vaut $e^{\\ln(5)}$ ?',
    options: ['$e^5$', '$5$', '$\\ln(5)$', '$1$'],
    correct: 1,
    explication:
      'Les fonctions exponentielle et logarithme népérien sont réciproques pour $x>0$.',
    categorie: 'Exponentielle',
  },
  {
    id: 4,
    question: 'Si $\\vec{u} \\cdot \\vec{v} = 0$, alors...',
    options: [
      'Les vecteurs sont égaux',
      'Les vecteurs sont colinéaires',
      'Les vecteurs sont orthogonaux',
      'Norme nulle',
    ],
    correct: 2,
    explication:
      "C'est la définition fondamentale de l'orthogonalité via le produit scalaire.",
    categorie: 'Géométrie',
  },
  {
    id: 5,
    question: 'Suite $(u_n)$ : $u_{n+1} = 2u_n$. Elle est...',
    options: ['Arithmétique', 'Géométrique', 'Constante', 'Aléatoire'],
    correct: 1,
    explication:
      "On passe d'un terme au suivant en multipliant par une constante (2).",
    categorie: 'Suites',
  },
];
