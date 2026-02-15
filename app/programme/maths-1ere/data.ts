/**
 * Programme Data for Première Générale Spécialité Maths
 * Based on B.O. Éducation Nationale 2025-2026
 *
 * Nexus Maths Lab V2 — "Learning Lab" immersif
 */

// ─── Exercise Types ─────────────────────────────────────────────────────────

export type ExerciceType = 'qcm' | 'numerique' | 'ordonnancement';

export interface ExerciceQCM {
  type: 'qcm';
  question: string;
  options: string[];
  correct: number;
  explication: string;
}

export interface ExerciceNumerique {
  type: 'numerique';
  question: string;
  reponse: number | string;
  tolerance?: number;
  unite?: string;
  explication: string;
}

export interface ExerciceOrdonnancement {
  type: 'ordonnancement';
  question: string;
  etapesDesordre: string[];
  ordreCorrect: number[];
  explication: string;
}

export type Exercice = ExerciceQCM | ExerciceNumerique | ExerciceOrdonnancement;

// ─── Hint System (Coup de Pouce) ────────────────────────────────────────────

export interface CoupDePouce {
  indice: string;
  debutRaisonnement: string;
  correctionDetaillee: string[];
}

// ─── Legacy compat aliases ──────────────────────────────────────────────────

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

// ─── Chapter Content ────────────────────────────────────────────────────────

export interface ChapitreContenu {
  rappel: string;
  methode: string;
  tableau?: TableauRow[];
  cas?: CasRow[];
  astuce: string;
  exercice: ExerciceData;
  erreursClassiques?: string[];
  methodologieBac?: string;
  coupDePouce?: CoupDePouce;
  geogebraId?: string;
}

/** B.O. competences (CdC §1.2) */
export type CompetenceBO = 'chercher' | 'modeliser' | 'representer' | 'raisonner' | 'calculer' | 'communiquer';

export interface Chapitre {
  id: string;
  titre: string;
  niveau: 'essentiel' | 'maitrise' | 'approfondissement';
  difficulte: 1 | 2 | 3 | 4 | 5;
  pointsXP: number;
  prerequis?: string[];
  /** B.O. competences worked in this chapter */
  competences?: CompetenceBO[];
  contenu: ChapitreContenu;
  exercices?: Exercice[];
  ressourcesExt?: { label: string; url: string }[];
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
  difficulte?: 1 | 2 | 3;
}

// ─── XP & Gamification ──────────────────────────────────────────────────────

export interface NiveauEleve {
  nom: string;
  xpMin: number;
  badge: string;
}

export const niveaux: NiveauEleve[] = [
  { nom: 'Novice', xpMin: 0, badge: '🌱' },
  { nom: 'Initié', xpMin: 200, badge: '📗' },
  { nom: 'Expert', xpMin: 500, badge: '🔥' },
  { nom: 'Maître', xpMin: 1000, badge: '�' },
  { nom: 'Légende', xpMin: 2000, badge: '🏆' },
];

export function getNiveau(xp: number): NiveauEleve {
  for (let i = niveaux.length - 1; i >= 0; i--) {
    if (xp >= niveaux[i].xpMin) return niveaux[i];
  }
  return niveaux[0];
}

export function getNextNiveau(xp: number): NiveauEleve | null {
  const current = getNiveau(xp);
  const idx = niveaux.indexOf(current);
  return idx < niveaux.length - 1 ? niveaux[idx + 1] : null;
}

// ─── Daily Challenge Pool ────────────────────────────────────────────────────

export interface DailyChallenge {
  id: string;
  question: string;
  reponse: string;
  categorie: string;
  xp: number;
}

export const dailyChallenges: DailyChallenge[] = [
  // Dérivation
  { id: 'dc1', question: 'Dériver $f(x)=3x^4$', reponse: '$12x^3$', categorie: 'Dérivation', xp: 15 },
  { id: 'dc2', question: 'Dérivée de $g(x) = \\frac{1}{x^2}$ ?', reponse: '$-\\frac{2}{x^3}$', categorie: 'Dérivation', xp: 15 },
  { id: 'dc3', question: 'Dérivée de $h(x) = 5\\sqrt{x}$ ?', reponse: '$\\frac{5}{2\\sqrt{x}}$', categorie: 'Dérivation', xp: 15 },
  // Second Degré
  { id: 'dc4', question: '$\\Delta$ de $x^2-6x+9$ ?', reponse: '$0$', categorie: 'Second Degré', xp: 10 },
  { id: 'dc5', question: 'Sommet de $f(x) = x^2 - 4x + 3$ ?', reponse: '$(2; -1)$', categorie: 'Second Degré', xp: 15 },
  // Exponentielle
  { id: 'dc6', question: 'Simplifier $e^3 \\times e^{-1}$', reponse: '$e^2$', categorie: 'Exponentielle', xp: 10 },
  { id: 'dc7', question: '$e^0 = $ ?', reponse: '$1$', categorie: 'Exponentielle', xp: 5 },
  // Trigonométrie
  { id: 'dc8', question: '$\\cos(\\pi)=$ ?', reponse: '$-1$', categorie: 'Trigonométrie', xp: 10 },
  { id: 'dc9', question: 'Dérivée de $\\sin(x)$ ?', reponse: '$\\cos(x)$', categorie: 'Trigonométrie', xp: 10 },
  { id: 'dc10', question: '$\\sin(\\pi/4) = $ ?', reponse: '$\\frac{\\sqrt{2}}{2}$', categorie: 'Trigonométrie', xp: 10 },
  // Combinatoire
  { id: 'dc11', question: '$\\binom{5}{2}=$ ?', reponse: '$10$', categorie: 'Combinatoire', xp: 15 },
  { id: 'dc12', question: '$4! = $ ?', reponse: '$24$', categorie: 'Combinatoire', xp: 10 },
  // Suites
  { id: 'dc13', question: 'Suite $u_0=1$, $u_{n+1}=u_n+4$. $u_5=$ ?', reponse: '$21$', categorie: 'Suites', xp: 10 },
  { id: 'dc14', question: 'Somme $1+2+\\ldots+100=$ ?', reponse: '$5050$', categorie: 'Suites', xp: 20 },
  { id: 'dc15', question: 'Suite géom. $u_0=3$, $q=2$. $u_3=$ ?', reponse: '$24$', categorie: 'Suites', xp: 10 },
  // Produit Scalaire
  { id: 'dc16', question: '$\\vec{u}(1;2)\\cdot\\vec{v}(3;-1)=$ ?', reponse: '$1$', categorie: 'Produit Scalaire', xp: 10 },
  { id: 'dc17', question: '$||\\vec{u}(3;4)|| = $ ?', reponse: '$5$', categorie: 'Géométrie', xp: 10 },
  // Probabilités
  { id: 'dc18', question: '$P(A)=0.3$, $P_A(B)=0.5$. $P(A\\cap B)=$ ?', reponse: '$0.15$', categorie: 'Probabilités', xp: 15 },
  { id: 'dc19', question: '$E(X)$ si $P(X=0)=0.5$, $P(X=4)=0.5$ ?', reponse: '$2$', categorie: 'Probabilités', xp: 10 },
  // Limites
  { id: 'dc20', question: '$\\lim_{x \\to +\\infty} \\frac{3x}{x+1} = $ ?', reponse: '$3$', categorie: 'Limites', xp: 15 },
  { id: 'dc21', question: '$\\lim_{x \\to +\\infty} e^{-x} = $ ?', reponse: '$0$', categorie: 'Limites', xp: 10 },
  // Géométrie vectorielle
  { id: 'dc22', question: 'Distance $A(0;0)$ à $B(3;4)$ ?', reponse: '$5$', categorie: 'Géométrie', xp: 10 },
  { id: 'dc23', question: '$\\det(\\vec{u}(2;3), \\vec{v}(4;6)) = $ ?', reponse: '$0$', categorie: 'Géométrie', xp: 15 },
  // Cercles
  { id: 'dc24', question: 'Rayon du cercle $(x-1)^2+(y-2)^2=25$ ?', reponse: '$5$', categorie: 'Géométrie', xp: 10 },
  // Algorithmique
  { id: 'dc25', question: 'En Python, `7 % 3` vaut ?', reponse: '$1$', categorie: 'Algorithmique', xp: 10 },
];

// ─── Programme Data (B.O. complet) ──────────────────────────────────────────

export const programmeData: Record<string, Categorie> = {

  // ═══════════════════════════════════════════════════════════════════════════
  // ALGÈBRE & SUITES
  // ═══════════════════════════════════════════════════════════════════════════
  algebre: {
    titre: 'Algèbre & Suites',
    icon: '📈',
    couleur: 'cyan',
    chapitres: [
      // ── Second Degré ────────────────────────────────────────────────────
      {
        id: 'second-degre',
        titre: 'Second Degré',
        niveau: 'essentiel',
        difficulte: 2,
        pointsXP: 50,
        competences: ['calculer', 'representer', 'raisonner'],
        contenu: {
          rappel:
            'Fonction polynôme $f(x) = ax^2+bx+c$. Forme canonique : $a(x-\\alpha)^2+\\beta$ avec $\\alpha=-\\frac{b}{2a}$ et $\\beta=f(\\alpha)$.',
          methode:
            '\\Delta = b^2-4ac \\\\ \\text{Si } \\Delta > 0 : x_{1,2} = \\frac{-b \\pm \\sqrt{\\Delta}}{2a} \\\\ \\text{Sommet : } S\\left(-\\frac{b}{2a}\\,;\\, f\\!\\left(-\\frac{b}{2a}\\right)\\right)',
          cas: [
            { delta: '\\Delta > 0', solution: '2 racines distinctes, du signe de $a$ à l\'extérieur.' },
            { delta: '\\Delta = 0', solution: '1 racine double $-b/2a$, du signe de $a$ partout.' },
            { delta: '\\Delta < 0', solution: 'Pas de racine réelle, toujours du signe de $a$.' },
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
          erreursClassiques: [
            'Oublier de vérifier le signe de $a$ pour le tableau de signes.',
            'Confondre forme canonique et forme factorisée.',
            'Écrire $\\Delta = b^2 + 4ac$ au lieu de $b^2 - 4ac$.',
          ],
          methodologieBac:
            'Toujours commencer par calculer $\\Delta$, puis factoriser si possible. Conclure avec le tableau de signes en précisant les intervalles.',
          coupDePouce: {
            indice: 'Calculez le discriminant $\\Delta = b^2 - 4ac$.',
            debutRaisonnement: 'Ici $a=2$, $b=-4$, $c=-6$. Donc $\\Delta = 16 + 48 = 64 > 0$.',
            correctionDetaillee: [
              '$\\Delta = (-4)^2 - 4 \\times 2 \\times (-6) = 16 + 48 = 64$.',
              '$\\sqrt{\\Delta} = 8$.',
              '$x_1 = \\frac{4-8}{4} = -1$ et $x_2 = \\frac{4+8}{4} = 3$.',
            ],
          },
          geogebraId: 'ygkfkpqr',
        },
        exercices: [
          {
            type: 'qcm',
            question: 'Combien de racines a $x^2 + 4x + 4 = 0$ ?',
            options: ['0', '1 (double)', '2 distinctes', 'Impossible à dire'],
            correct: 1,
            explication: '$\\Delta = 16 - 16 = 0$, donc une racine double $x = -2$.',
          },
          {
            type: 'numerique',
            question: 'Calculer le discriminant de $3x^2 - 5x + 2 = 0$.',
            reponse: 1,
            explication: '$\\Delta = 25 - 24 = 1$.',
          },
          {
            type: 'ordonnancement',
            question: 'Remettre dans l\'ordre les étapes pour résoudre $ax^2+bx+c=0$ :',
            etapesDesordre: [
              'Conclure avec l\'ensemble des solutions',
              'Calculer $\\Delta = b^2 - 4ac$',
              'Identifier $a$, $b$, $c$',
              'Appliquer la formule des racines si $\\Delta \\geq 0$',
            ],
            ordreCorrect: [2, 1, 3, 0],
            explication: 'On identifie les coefficients, on calcule $\\Delta$, on applique la formule, puis on conclut.',
          },
        ],
        ressourcesExt: [
          { label: 'GeoGebra — Parabole interactive', url: 'https://www.geogebra.org/m/ygkfkpqr' },
          { label: 'Vidéo — Second degré (Yvan Monka)', url: 'https://www.youtube.com/watch?v=FnFMOynBnBc' },
        ],
      },

      // ── Suites Numériques ───────────────────────────────────────────────
      {
        id: 'suites',
        titre: 'Suites Numériques',
        niveau: 'essentiel',
        difficulte: 3,
        pointsXP: 60,
        prerequis: ['second-degre'],
        competences: ['modeliser', 'calculer', 'chercher'],
        contenu: {
          rappel:
            'Une suite peut être définie par une formule explicite $u_n = f(n)$ ou par récurrence $u_{n+1} = f(u_n)$.',
          methode:
            '\\text{Arithmétique : } u_{n+1} = u_n + r \\Rightarrow u_n = u_0 + nr \\\\ \\text{Géométrique : } u_{n+1} = q \\times u_n \\Rightarrow u_n = u_0 \\times q^n',
          tableau: [
            { f: 'Somme arithm. $u_0+\\ldots+u_n$', derivee: '$(n+1)\\frac{u_0+u_n}{2}$' },
            { f: 'Somme géom. $1+q+\\ldots+q^n$', derivee: '$\\frac{1-q^{n+1}}{1-q}$ ($q \\neq 1$)' },
          ],
          astuce:
            'Pour étudier le sens de variation, étudiez le signe de $u_{n+1} - u_n$. Si $>0$, la suite est croissante.',
          exercice: {
            question: 'Soit $(u_n)$ définie par $u_0=2$ et $u_{n+1}=u_n+3$. Calculer $u_{10}$.',
            reponse: '32',
            etapes: [
              'Reconnaître une suite arithmétique de raison $r=3$.',
              'Formule explicite : $u_n = u_0 + n \\times r$.',
              '$u_{10} = 2 + 10 \\times 3 = 32$.',
            ],
          },
          erreursClassiques: [
            'Confondre $u_n$ (terme de rang $n$) et $n$ (le rang).',
            'Oublier que la somme des $n+1$ premiers termes comporte $n+1$ termes, pas $n$.',
            'Appliquer la formule géométrique avec $q=1$ (division par zéro).',
          ],
          methodologieBac:
            'Toujours préciser la nature de la suite (arithmétique/géométrique/ni l\'une ni l\'autre) avant d\'appliquer une formule. Pour une récurrence, bien écrire l\'initialisation ET l\'hérédité.',
          coupDePouce: {
            indice: 'Identifiez la nature de la suite : $u_{n+1} = u_n + r$ → arithmétique.',
            debutRaisonnement: 'Ici $r = 3$ et $u_0 = 2$. Appliquez la formule explicite.',
            correctionDetaillee: [
              'Suite arithmétique de raison $r = 3$ et premier terme $u_0 = 2$.',
              'Formule : $u_n = u_0 + n \\times r = 2 + 3n$.',
              '$u_{10} = 2 + 3 \\times 10 = 32$.',
            ],
          },
        },
        exercices: [
          {
            type: 'numerique',
            question: 'Suite géométrique $u_0=5$, $q=2$. Calculer $u_4$.',
            reponse: 80,
            explication: '$u_4 = 5 \\times 2^4 = 5 \\times 16 = 80$.',
          },
          {
            type: 'qcm',
            question: 'La suite $u_n = 3n + 1$ est :',
            options: ['Géométrique', 'Arithmétique de raison 3', 'Ni l\'une ni l\'autre', 'Constante'],
            correct: 1,
            explication: '$u_{n+1} - u_n = 3(n+1)+1 - (3n+1) = 3$. Raison $r=3$.',
          },
        ],
        ressourcesExt: [
          { label: 'GeoGebra — Suites et convergence', url: 'https://www.geogebra.org/m/xnYfnyrP' },
        ],
      },

      // ── Combinatoire & Dénombrement ─────────────────────────────────────
      {
        id: 'combinatoire',
        titre: 'Combinatoire & Dénombrement',
        niveau: 'maitrise',
        difficulte: 3,
        pointsXP: 50,
        competences: ['calculer', 'raisonner'],
        contenu: {
          rappel:
            'Dénombrer, c\'est compter le nombre de façons de choisir ou d\'organiser des éléments. On distingue les arrangements (ordre compte) et les combinaisons (ordre ne compte pas).',
          methode:
            'n! = n \\times (n-1) \\times \\ldots \\times 1 \\quad \\binom{n}{k} = \\frac{n!}{k!(n-k)!} \\\\ \\text{Triangle de Pascal : } \\binom{n}{k} = \\binom{n-1}{k-1} + \\binom{n-1}{k}',
          tableau: [
            { f: '$\\binom{n}{0}$', derivee: '$1$' },
            { f: '$\\binom{n}{1}$', derivee: '$n$' },
            { f: '$\\binom{n}{n}$', derivee: '$1$' },
            { f: '$\\binom{n}{k} = \\binom{n}{n-k}$', derivee: 'Symétrie' },
          ],
          astuce:
            'Utilisez le triangle de Pascal pour les petites valeurs. Pour les grandes, la formule avec factorielles est plus efficace.',
          exercice: {
            question: 'Calculer $\\binom{6}{2}$.',
            reponse: '15',
            etapes: [
              '$\\binom{6}{2} = \\frac{6!}{2! \\times 4!}$.',
              '$= \\frac{6 \\times 5}{2 \\times 1} = 15$.',
            ],
          },
          erreursClassiques: [
            'Confondre arrangement et combinaison (l\'ordre compte-t-il ?).',
            'Oublier que $0! = 1$.',
            'Ne pas simplifier les factorielles avant de calculer.',
          ],
          coupDePouce: {
            indice: 'Appliquez la formule $\\binom{n}{k} = \\frac{n!}{k!(n-k)!}$.',
            debutRaisonnement: '$\\binom{6}{2} = \\frac{6!}{2! \\times 4!}$. Simplifiez $6! = 6 \\times 5 \\times 4!$.',
            correctionDetaillee: [
              '$\\binom{6}{2} = \\frac{6!}{2! \\times 4!} = \\frac{6 \\times 5 \\times 4!}{2 \\times 1 \\times 4!}$.',
              '$= \\frac{30}{2} = 15$.',
            ],
          },
        },
        exercices: [
          {
            type: 'numerique',
            question: 'Calculer $\\binom{5}{3}$.',
            reponse: 10,
            explication: '$\\binom{5}{3} = \\frac{5!}{3!2!} = \\frac{120}{6 \\times 2} = 10$.',
          },
          {
            type: 'qcm',
            question: 'Combien de mots de 3 lettres (sans répétition) peut-on former avec A, B, C, D, E ?',
            options: ['10', '60', '125', '15'],
            correct: 1,
            explication: 'Arrangement : $5 \\times 4 \\times 3 = 60$.',
          },
        ],
      },
    ],
  },

  // ═══════════════════════════════════════════════════════════════════════════
  // ANALYSE (FONCTIONS)
  // ═══════════════════════════════════════════════════════════════════════════
  analyse: {
    titre: 'Analyse (Fonctions)',
    icon: '📉',
    couleur: 'blue',
    chapitres: [
      // ── Dérivation ──────────────────────────────────────────────────────
      {
        id: 'derivation',
        titre: 'Dérivation',
        niveau: 'essentiel',
        difficulte: 3,
        pointsXP: 70,
        competences: ['calculer', 'representer', 'raisonner', 'chercher'],
        contenu: {
          rappel:
            "Le nombre dérivé $f'(a)$ est la limite du taux de variation : $f'(a) = \\lim_{h \\to 0} \\frac{f(a+h)-f(a)}{h}$. C'est la pente de la tangente en $a$.",
          methode: "\\text{Tangente en } a : y = f'(a)(x-a) + f(a) \\\\ (u+v)' = u'+v' \\quad (ku)' = ku' \\quad (uv)' = u'v + uv' \\quad \\left(\\frac{u}{v}\\right)' = \\frac{u'v - uv'}{v^2}",
          tableau: [
            { f: '$k$ (constante)', derivee: '$0$' },
            { f: '$x^n$', derivee: '$nx^{n-1}$' },
            { f: '$\\frac{1}{x}$', derivee: '$-\\frac{1}{x^2}$' },
            { f: '$\\sqrt{x}$', derivee: '$\\frac{1}{2\\sqrt{x}}$' },
            { f: '$e^x$', derivee: '$e^x$' },
            { f: '$\\cos(x)$', derivee: '$-\\sin(x)$' },
            { f: '$\\sin(x)$', derivee: '$\\cos(x)$' },
          ],
          astuce:
            "Le signe de $f'(x)$ donne les variations de $f$ : $f'>0 \\Rightarrow f$ croissante, $f'<0 \\Rightarrow f$ décroissante.",
          exercice: {
            question: "Dériver $f(x) = x^3 - 5x + 1$.",
            reponse: "$f'(x) = 3x^2 - 5$",
            etapes: [
              'Dérivée de $x^3$ est $3x^2$.',
              'Dérivée de $-5x$ est $-5$.',
              'Dérivée de la constante 1 est 0.',
            ],
          },
          erreursClassiques: [
            "Oublier la formule du produit : $(uv)' \\neq u' \\times v'$.",
            "Confondre $f'(a)$ (nombre) et $f'(x)$ (fonction).",
            "Écrire la tangente $y = f'(a) \\times x$ en oubliant le $-a$ et le $+f(a)$.",
          ],
          methodologieBac:
            "Pour une étude de fonction : 1) Dériver. 2) Étudier le signe de $f'$. 3) Dresser le tableau de variations. 4) Conclure sur les extrema.",
          coupDePouce: {
            indice: 'Appliquez la formule $(x^n)\' = nx^{n-1}$ terme par terme.',
            debutRaisonnement: "$(x^3)' = 3x^2$, $(-5x)' = -5$, $(1)' = 0$.",
            correctionDetaillee: [
              "$(x^3)' = 3x^2$ (formule puissance).",
              "$(-5x)' = -5$ (dérivée de $kx$).",
              "$(1)' = 0$ (constante).",
              "$f'(x) = 3x^2 - 5$.",
            ],
          },
        },
        exercices: [
          {
            type: 'qcm',
            question: "Quelle est la dérivée de $g(x) = x^2 e^x$ ?",
            options: ['$2xe^x$', '$(2x+x^2)e^x$', '$x^2 e^x$', '$2e^x$'],
            correct: 1,
            explication: "Formule du produit : $(x^2)'e^x + x^2(e^x)' = 2xe^x + x^2 e^x = (2x+x^2)e^x$.",
          },
          {
            type: 'numerique',
            question: "Soit $f(x) = x^2 - 3x + 1$. Calculer $f'(2)$.",
            reponse: 1,
            explication: "$f'(x) = 2x - 3$, donc $f'(2) = 4 - 3 = 1$.",
          },
          {
            type: 'ordonnancement',
            question: "Remettre dans l'ordre les étapes d'une étude de variations :",
            etapesDesordre: [
              'Dresser le tableau de variations',
              'Calculer $f\'(x)$',
              'Conclure sur les extrema',
              'Étudier le signe de $f\'(x)$',
            ],
            ordreCorrect: [1, 3, 0, 2],
            explication: "On dérive, on étudie le signe, on dresse le tableau, puis on conclut.",
          },
        ],
        ressourcesExt: [
          { label: 'GeoGebra — Tangente et nombre dérivé', url: 'https://www.geogebra.org/m/Wkk8gBSa' },
        ],
      },

      // ── Variations et Courbes ───────────────────────────────────────────
      {
        id: 'variations-courbes',
        titre: 'Variations et Courbes',
        niveau: 'maitrise',
        difficulte: 3,
        pointsXP: 60,
        prerequis: ['derivation'],
        competences: ['representer', 'raisonner', 'communiquer'],
        contenu: {
          rappel:
            "L'étude des variations d'une fonction repose sur le signe de sa dérivée. Les extrema locaux se trouvent aux changements de signe de $f'$.",
          methode:
            "f'(x) > 0 \\Rightarrow f \\text{ croissante} \\quad f'(x) < 0 \\Rightarrow f \\text{ décroissante} \\\\ f'(a) = 0 \\text{ et changement de signe} \\Rightarrow \\text{extremum local en } a",
          astuce:
            "Un extremum local n'est pas forcément global. Vérifiez les limites aux bornes du domaine.",
          exercice: {
            question: "Étudier les variations de $f(x) = x^3 - 3x$ sur $\\mathbb{R}$.",
            reponse: "Croissante sur $]-\\infty;-1]$, décroissante sur $[-1;1]$, croissante sur $[1;+\\infty[$",
            etapes: [
              "$f'(x) = 3x^2 - 3 = 3(x^2-1) = 3(x-1)(x+1)$.",
              "$f'(x) > 0$ si $x < -1$ ou $x > 1$.",
              "$f'(x) < 0$ si $-1 < x < 1$.",
              "Maximum local en $x=-1$ : $f(-1) = 2$. Minimum local en $x=1$ : $f(1) = -2$.",
            ],
          },
          erreursClassiques: [
            "Oublier de factoriser $f'(x)$ avant d'étudier son signe.",
            "Confondre croissant/décroissant avec positif/négatif.",
            "Ne pas vérifier que $f'$ change bien de signe (un $f'(a)=0$ ne suffit pas).",
          ],
          coupDePouce: {
            indice: "Commencez par dériver, puis factorisez $f'(x)$.",
            debutRaisonnement: "$f'(x) = 3x^2 - 3 = 3(x-1)(x+1)$. Étudiez le signe de ce produit.",
            correctionDetaillee: [
              "$f'(x) = 3x^2 - 3 = 3(x-1)(x+1)$.",
              "Tableau de signes : $f'(x) > 0$ pour $x \\in ]-\\infty;-1[ \\cup ]1;+\\infty[$.",
              "$f(-1) = -1+3 = 2$ (max local), $f(1) = 1-3 = -2$ (min local).",
            ],
          },
        },
        exercices: [
          {
            type: 'qcm',
            question: "Si $f'(x) = 0$ en $x=3$ et $f'$ ne change pas de signe, alors :",
            options: ['Maximum en 3', 'Minimum en 3', 'Point d\'inflexion', 'Pas d\'extremum en 3'],
            correct: 3,
            explication: "Sans changement de signe, $f'(3)=0$ est un point d'inflexion, pas un extremum.",
          },
        ],
      },

      // ── Fonction Exponentielle ──────────────────────────────────────────
      {
        id: 'exponentielle',
        titre: 'Fonction Exponentielle',
        niveau: 'maitrise',
        difficulte: 3,
        pointsXP: 60,
        prerequis: ['derivation'],
        competences: ['calculer', 'modeliser', 'raisonner'],
        contenu: {
          rappel:
            "L'unique fonction $f$ telle que $f'=f$ et $f(0)=1$. Elle est strictement positive sur $\\mathbb{R}$.",
          methode:
            "e^{a+b} = e^a \\times e^b \\quad e^{a-b} = \\frac{e^a}{e^b} \\quad (e^a)^n = e^{na} \\quad (e^{u})' = u'e^u",
          astuce:
            "$e^x$ l'emporte toujours sur les polynômes en $+\\infty$ (croissance comparée) : $\\lim_{x \\to +\\infty} \\frac{e^x}{x^n} = +\\infty$.",
          exercice: {
            question: 'Simplifier $A = e^x \\times e^{-x+2}$.',
            reponse: '$e^2$',
            etapes: [
              'Utiliser $e^a \\times e^b = e^{a+b}$.',
              '$A = e^{x + (-x+2)} = e^2$.',
            ],
          },
          erreursClassiques: [
            "$e^{a+b} \\neq e^a + e^b$ (l'exponentielle n'est PAS linéaire).",
            "$e^x > 0$ toujours : ne jamais écrire $e^x = 0$ ou $e^x < 0$.",
            "Oublier la dérivée de $e^{u(x)}$ : c'est $u'(x) \\times e^{u(x)}$, pas juste $e^{u(x)}$.",
          ],
          methodologieBac:
            "Pour résoudre $e^{f(x)} = e^{g(x)}$, simplifier en $f(x) = g(x)$ (l'exponentielle est une bijection). Pour $e^{f(x)} > k$ avec $k > 0$, passer au $\\ln$.",
          coupDePouce: {
            indice: 'Utilisez la propriété $e^a \\times e^b = e^{a+b}$.',
            debutRaisonnement: 'Additionnez les exposants : $x + (-x+2) = 2$.',
            correctionDetaillee: [
              '$A = e^x \\times e^{-x+2} = e^{x+(-x+2)}$.',
              '$= e^{0+2} = e^2$.',
            ],
          },
        },
        exercices: [
          {
            type: 'qcm',
            question: "Quelle est la dérivée de $f(x) = e^{3x+1}$ ?",
            options: ['$e^{3x+1}$', '$3e^{3x+1}$', '$(3x+1)e^{3x+1}$', '$3e^{3x}$'],
            correct: 1,
            explication: "$(e^u)' = u'e^u$ avec $u = 3x+1$, $u' = 3$. Donc $f'(x) = 3e^{3x+1}$.",
          },
          {
            type: 'numerique',
            question: "Résoudre $e^{2x} = e^6$. Donner la valeur de $x$.",
            reponse: 3,
            explication: "$e^{2x} = e^6 \\Rightarrow 2x = 6 \\Rightarrow x = 3$.",
          },
        ],
        ressourcesExt: [
          { label: 'GeoGebra — Fonction exponentielle', url: 'https://www.geogebra.org/m/YGkfKpQr' },
        ],
      },

      // ── Trigonométrie ───────────────────────────────────────────────────
      {
        id: 'trigonometrie',
        titre: 'Fonctions Trigonométriques',
        niveau: 'approfondissement',
        difficulte: 4,
        pointsXP: 80,
        prerequis: ['derivation'],
        competences: ['representer', 'calculer', 'chercher'],
        contenu: {
          rappel:
            'Cercle trigonométrique de rayon 1. Mesure en radians : $\\pi$ rad $= 180°$. Relation fondamentale : $\\cos^2(x) + \\sin^2(x) = 1$.',
          methode:
            '\\cos(x+2\\pi) = \\cos(x) \\quad \\sin(x+2\\pi) = \\sin(x) \\\\ \\cos(-x)=\\cos(x) \\quad \\sin(-x)=-\\sin(x) \\\\ \\cos(\\pi-x)=-\\cos(x) \\quad \\sin(\\pi-x)=\\sin(x)',
          tableau: [
            { f: '$\\cos(x)$', derivee: '$-\\sin(x)$' },
            { f: '$\\sin(x)$', derivee: '$\\cos(x)$' },
          ],
          astuce:
            'Visualisez toujours le cercle trigonométrique. Les valeurs remarquables : $\\cos(\\pi/3)=1/2$, $\\sin(\\pi/6)=1/2$, $\\cos(\\pi/4)=\\sin(\\pi/4)=\\sqrt{2}/2$.',
          exercice: {
            question: 'Résoudre $\\cos(x) = 1/2$ sur $[0; 2\\pi]$.',
            reponse: 'S = \\{\\pi/3 ; 5\\pi/3\\}',
            etapes: [
              'On sait que $\\cos(\\pi/3) = 1/2$.',
              'Par symétrie axiale, $-\\pi/3$ est aussi solution.',
              'Sur $[0; 2\\pi]$, $-\\pi/3$ correspond à $2\\pi - \\pi/3 = 5\\pi/3$.',
            ],
          },
          erreursClassiques: [
            'Oublier la deuxième solution lors de la résolution de $\\cos(x) = k$ ou $\\sin(x) = k$.',
            'Confondre degrés et radians dans les calculs.',
            'Écrire $\\cos^2(x) = \\cos(x^2)$ — ce sont deux choses très différentes.',
          ],
          methodologieBac:
            "Pour résoudre $\\cos(x) = k$ : trouver l'angle de référence $\\alpha$ tel que $\\cos(\\alpha) = k$, puis les solutions sont $x = \\alpha + 2k\\pi$ et $x = -\\alpha + 2k\\pi$.",
          coupDePouce: {
            indice: 'Quel angle remarquable a pour cosinus $1/2$ ?',
            debutRaisonnement: '$\\cos(\\pi/3) = 1/2$. Les solutions de $\\cos(x) = \\cos(\\alpha)$ sont $x = \\pm \\alpha + 2k\\pi$.',
            correctionDetaillee: [
              '$\\cos(\\pi/3) = 1/2$, donc $\\alpha = \\pi/3$.',
              'Solutions : $x = \\pi/3 + 2k\\pi$ ou $x = -\\pi/3 + 2k\\pi$.',
              'Sur $[0;2\\pi]$ : $x = \\pi/3$ et $x = 2\\pi - \\pi/3 = 5\\pi/3$.',
            ],
          },
          geogebraId: 'mMbMfKsp',
        },
        exercices: [
          {
            type: 'qcm',
            question: '$\\sin(\\pi/6)$ vaut :',
            options: ['$\\sqrt{3}/2$', '$1/2$', '$\\sqrt{2}/2$', '$1$'],
            correct: 1,
            explication: 'Valeur remarquable : $\\sin(\\pi/6) = \\sin(30°) = 1/2$.',
          },
        ],
        ressourcesExt: [
          { label: 'GeoGebra — Cercle trigonométrique', url: 'https://www.geogebra.org/m/mMbMfKsp' },
        ],
      },

      // ── Limites de Fonctions (Initiation) ─────────────────────────────
      {
        id: 'limites-initiation',
        titre: 'Limites de Fonctions (Initiation)',
        niveau: 'approfondissement',
        difficulte: 4,
        pointsXP: 80,
        prerequis: ['variations-courbes', 'exponentielle'],
        competences: ['calculer', 'raisonner', 'representer'],
        contenu: {
          rappel:
            'La notion de limite décrit le comportement d\'une fonction quand $x$ tend vers $+\\infty$, $-\\infty$ ou un réel $a$. On écrit $\\lim_{x \\to +\\infty} f(x) = L$ si $f(x)$ se rapproche de $L$.',
          methode:
            '\\lim_{x \\to +\\infty} x^n = +\\infty \\quad \\lim_{x \\to +\\infty} \\frac{1}{x} = 0 \\quad \\lim_{x \\to +\\infty} e^x = +\\infty \\\\ \\text{Croissance comparée : } \\lim_{x \\to +\\infty} \\frac{e^x}{x^n} = +\\infty',
          tableau: [
            { f: '$\\lim_{x \\to +\\infty} x^n$', derivee: '$+\\infty$' },
            { f: '$\\lim_{x \\to +\\infty} 1/x$', derivee: '$0$' },
            { f: '$\\lim_{x \\to +\\infty} e^x$', derivee: '$+\\infty$' },
            { f: '$\\lim_{x \\to -\\infty} e^x$', derivee: '$0$' },
            { f: '$\\lim_{x \\to +\\infty} e^x/x^n$', derivee: '$+\\infty$ (croissance comparée)' },
          ],
          astuce:
            'Pour les formes indéterminées ($\\infty - \\infty$, $0 \\times \\infty$, $\\infty/\\infty$), factorisez par le terme dominant.',
          exercice: {
            question: 'Calculer $\\lim_{x \\to +\\infty} \\frac{3x^2 + 1}{x^2 - 5}$.',
            reponse: '$3$',
            etapes: [
              'Factoriser par $x^2$ au numérateur et au dénominateur.',
              '$= \\frac{x^2(3 + 1/x^2)}{x^2(1 - 5/x^2)}$.',
              'Quand $x \\to +\\infty$ : $1/x^2 \\to 0$ et $5/x^2 \\to 0$.',
              'Donc la limite vaut $3/1 = 3$.',
            ],
          },
          erreursClassiques: [
            'Écrire $\\infty - \\infty = 0$ (c\'est une forme indéterminée).',
            'Oublier de factoriser par le terme de plus haut degré.',
            'Confondre $\\lim_{x \\to 0^+} 1/x = +\\infty$ et $\\lim_{x \\to 0^-} 1/x = -\\infty$.',
          ],
          methodologieBac:
            'Pour calculer une limite en $+\\infty$ d\'une fraction rationnelle, factoriser par la plus haute puissance de $x$ au numérateur ET au dénominateur. Pour les exponentielles, utiliser la croissance comparée.',
          coupDePouce: {
            indice: 'Factorisez numérateur et dénominateur par $x^2$.',
            debutRaisonnement: '$\\frac{3x^2+1}{x^2-5} = \\frac{x^2(3+1/x^2)}{x^2(1-5/x^2)}$. Simplifiez par $x^2$.',
            correctionDetaillee: [
              '$\\frac{3x^2+1}{x^2-5} = \\frac{3 + 1/x^2}{1 - 5/x^2}$.',
              'Quand $x \\to +\\infty$ : $\\frac{3+0}{1-0} = 3$.',
            ],
          },
        },
        exercices: [
          {
            type: 'qcm',
            question: '$\\lim_{x \\to +\\infty} \\frac{x^3 - 2x}{x^2 + 1}$ vaut :',
            options: ['$0$', '$1$', '$+\\infty$', '$-\\infty$'],
            correct: 2,
            explication: 'Le degré du numérateur (3) > degré du dénominateur (2), donc la limite est $+\\infty$.',
          },
          {
            type: 'numerique',
            question: '$\\lim_{x \\to +\\infty} \\frac{5x + 3}{2x - 1}$ = ?',
            reponse: 2.5,
            tolerance: 0.01,
            explication: 'Factoriser par $x$ : $\\frac{5+3/x}{2-1/x} \\to 5/2 = 2.5$.',
          },
          {
            type: 'qcm',
            question: '$\\lim_{x \\to +\\infty} xe^{-x}$ vaut :',
            options: ['$+\\infty$', '$0$', '$1$', '$-\\infty$'],
            correct: 1,
            explication: 'Croissance comparée : $e^x$ l\'emporte sur $x$, donc $x/e^x \\to 0$.',
          },
        ],
        ressourcesExt: [
          { label: 'GeoGebra — Limites et asymptotes', url: 'https://www.geogebra.org/m/sXnBhKP7' },
        ],
      },

      // ── Continuité (sur des exemples) ─────────────────────────────────
      {
        id: 'continuite',
        titre: 'Continuité (sur des exemples)',
        niveau: 'approfondissement',
        difficulte: 4,
        pointsXP: 70,
        prerequis: ['limites-initiation'],
        competences: ['raisonner', 'communiquer', 'chercher'],
        contenu: {
          rappel:
            'Une fonction $f$ est continue en $a$ si $\\lim_{x \\to a} f(x) = f(a)$. Intuitivement, on peut tracer la courbe sans lever le crayon.',
          methode:
            '\\text{TVI : Si } f \\text{ continue sur } [a;b] \\text{ et } f(a) \\times f(b) < 0 \\\\ \\text{alors } \\exists\\, c \\in ]a;b[ \\text{ tel que } f(c) = 0',
          astuce:
            'Le TVI (Théorème des Valeurs Intermédiaires) est l\'outil principal pour montrer l\'existence d\'une solution. Il ne donne pas la valeur exacte, mais garantit l\'existence.',
          exercice: {
            question: 'Montrer que $f(x) = x^3 - 3x + 1$ admet au moins une racine dans $[0; 1]$.',
            reponse: 'Par le TVI : $f(0) = 1 > 0$ et $f(1) = -1 < 0$, donc $\\exists\\, c \\in ]0;1[$ tel que $f(c) = 0$.',
            etapes: [
              '$f$ est un polynôme, donc continue sur $\\mathbb{R}$.',
              '$f(0) = 0 - 0 + 1 = 1 > 0$.',
              '$f(1) = 1 - 3 + 1 = -1 < 0$.',
              '$f(0) \\times f(1) = -1 < 0$. Par le TVI, $f$ s\'annule dans $]0;1[$.',
            ],
          },
          erreursClassiques: [
            'Oublier de vérifier que $f$ est continue sur l\'intervalle.',
            'Le TVI donne l\'existence, pas l\'unicité (il peut y avoir plusieurs racines).',
            'Confondre TVI et théorème de la bijection (qui donne l\'unicité si $f$ est strictement monotone).',
          ],
          methodologieBac:
            'Pour montrer l\'existence d\'une solution : 1) Dire que $f$ est continue (justifier). 2) Calculer $f(a)$ et $f(b)$. 3) Constater le changement de signe. 4) Conclure par le TVI.',
          coupDePouce: {
            indice: 'Calculez $f(0)$ et $f(1)$, puis appliquez le TVI.',
            debutRaisonnement: '$f(0) = 1$ et $f(1) = -1$. Comme $f$ est continue et change de signe...',
            correctionDetaillee: [
              '$f$ est polynomiale donc continue sur $[0;1]$.',
              '$f(0) = 1 > 0$ et $f(1) = -1 < 0$.',
              'Par le TVI, $\\exists\\, c \\in ]0;1[$ tel que $f(c) = 0$.',
            ],
          },
        },
        exercices: [
          {
            type: 'qcm',
            question: 'Le TVI permet de :',
            options: [
              'Calculer la valeur exacte d\'une racine',
              'Montrer l\'existence d\'une racine dans un intervalle',
              'Montrer l\'unicité d\'une racine',
              'Calculer la dérivée',
            ],
            correct: 1,
            explication: 'Le TVI garantit l\'existence d\'une solution, pas sa valeur exacte ni son unicité.',
          },
          {
            type: 'ordonnancement',
            question: 'Remettre dans l\'ordre les étapes pour appliquer le TVI :',
            etapesDesordre: [
              'Conclure par le TVI : $\\exists\\, c$ tel que $f(c) = 0$',
              'Vérifier que $f$ est continue sur $[a;b]$',
              'Constater que $f(a)$ et $f(b)$ sont de signes opposés',
              'Calculer $f(a)$ et $f(b)$',
            ],
            ordreCorrect: [1, 3, 2, 0],
            explication: 'On vérifie la continuité, on calcule les valeurs aux bornes, on constate le changement de signe, puis on conclut.',
          },
        ],
      },
    ],
  },

  // ═══════════════════════════════════════════════════════════════════════════
  // GÉOMÉTRIE
  // ═══════════════════════════════════════════════════════════════════════════
  geometrie: {
    titre: 'Géométrie',
    icon: '📐',
    couleur: 'purple',
    chapitres: [
      // ── Produit Scalaire ────────────────────────────────────────────────
      {
        id: 'produit-scalaire',
        titre: 'Produit Scalaire',
        niveau: 'essentiel',
        difficulte: 3,
        pointsXP: 70,
        competences: ['calculer', 'representer', 'raisonner'],
        contenu: {
          rappel:
            'Le produit scalaire est un outil pour calculer longueurs et angles. $\\vec{u} \\cdot \\vec{v} = ||\\vec{u}|| \\times ||\\vec{v}|| \\times \\cos(\\vec{u},\\vec{v})$.',
          methode:
            "\\text{Analytique : } \\vec{u}(x;y) \\cdot \\vec{v}(x';y') = xx'+yy' \\\\ \\text{Orthogonalité : } \\vec{u} \\perp \\vec{v} \\iff \\vec{u} \\cdot \\vec{v} = 0 \\\\ \\text{Al-Kashi : } a^2 = b^2+c^2-2bc\\cos(A)",
          astuce:
            "Utilisez Al-Kashi pour les triangles quelconques. Si $\\cos(A)=0$, le triangle est rectangle en $A$.",
          exercice: {
            question: 'Calculer $\\vec{u}(2; -1) \\cdot \\vec{v}(3; 4)$.',
            reponse: '2',
            etapes: [
              "Formule $xx' + yy'$.",
              '$2 \\times 3 + (-1) \\times 4$',
              '$6 - 4 = 2$.',
            ],
          },
          erreursClassiques: [
            "Le produit scalaire est un NOMBRE, pas un vecteur.",
            "Ne pas confondre $\\vec{u} \\cdot \\vec{v}$ (scalaire) et $\\vec{u} \\times \\vec{v}$ (produit vectoriel, hors programme).",
            "Oublier que $||\\vec{u}||^2 = \\vec{u} \\cdot \\vec{u}$.",
          ],
          methodologieBac:
            "Pour montrer une orthogonalité : calculer le produit scalaire et vérifier qu'il vaut 0. Pour trouver un angle : utiliser $\\cos(\\theta) = \\frac{\\vec{u}\\cdot\\vec{v}}{||\\vec{u}|| \\times ||\\vec{v}||}$.",
          coupDePouce: {
            indice: "Utilisez la formule analytique $xx' + yy'$.",
            debutRaisonnement: '$2 \\times 3 + (-1) \\times 4 = ?$',
            correctionDetaillee: [
              "$\\vec{u} \\cdot \\vec{v} = x_u \\times x_v + y_u \\times y_v$.",
              '$= 2 \\times 3 + (-1) \\times 4 = 6 - 4 = 2$.',
            ],
          },
          geogebraId: 'fhBhKMtR',
        },
        exercices: [
          {
            type: 'numerique',
            question: 'Calculer $\\vec{a}(1;3) \\cdot \\vec{b}(-2;1)$.',
            reponse: 1,
            explication: '$1 \\times (-2) + 3 \\times 1 = -2 + 3 = 1$.',
          },
          {
            type: 'qcm',
            question: '$\\vec{u}(4;3)$ et $\\vec{v}(-3;4)$ sont :',
            options: ['Colinéaires', 'Orthogonaux', 'Égaux', 'Opposés'],
            correct: 1,
            explication: '$4 \\times (-3) + 3 \\times 4 = -12 + 12 = 0$. Produit scalaire nul → orthogonaux.',
          },
        ],
        ressourcesExt: [
          { label: 'GeoGebra — Produit scalaire interactif', url: 'https://www.geogebra.org/m/fhBhKMtR' },
        ],
      },

      // ── Équations de Droites ────────────────────────────────────────────
      {
        id: 'equations-droites',
        titre: 'Équations de Droites',
        niveau: 'essentiel',
        difficulte: 2,
        pointsXP: 40,
        competences: ['representer', 'calculer', 'modeliser'],
        contenu: {
          rappel:
            'Une droite du plan peut s\'écrire sous forme cartésienne $ax+by+c=0$ ou réduite $y=mx+p$ (si non verticale). $m$ est le coefficient directeur, $p$ l\'ordonnée à l\'origine.',
          methode:
            "m = \\frac{y_B - y_A}{x_B - x_A} \\quad \\text{(pente)} \\\\ \\text{Parallèles : } m_1 = m_2 \\quad \\text{Perpendiculaires : } m_1 \\times m_2 = -1",
          astuce:
            'Pour trouver l\'équation d\'une droite passant par $A(x_A;y_A)$ de pente $m$ : $y - y_A = m(x - x_A)$.',
          exercice: {
            question: 'Déterminer l\'équation de la droite passant par $A(1;3)$ et $B(4;9)$.',
            reponse: '$y = 2x + 1$',
            etapes: [
              '$m = \\frac{9-3}{4-1} = \\frac{6}{3} = 2$.',
              '$y - 3 = 2(x - 1)$.',
              '$y = 2x - 2 + 3 = 2x + 1$.',
            ],
          },
          erreursClassiques: [
            'Inverser numérateur et dénominateur dans le calcul de la pente.',
            'Oublier les droites verticales $x = k$ (pas de coefficient directeur).',
            'Confondre parallèle ($m_1 = m_2$) et perpendiculaire ($m_1 \\times m_2 = -1$).',
          ],
          coupDePouce: {
            indice: 'Calculez d\'abord la pente $m = \\frac{y_B - y_A}{x_B - x_A}$.',
            debutRaisonnement: '$m = \\frac{9-3}{4-1} = 2$. Puis utilisez $y - y_A = m(x - x_A)$.',
            correctionDetaillee: [
              '$m = \\frac{9-3}{4-1} = 2$.',
              '$y - 3 = 2(x-1) \\Rightarrow y = 2x + 1$.',
            ],
          },
        },
        exercices: [
          {
            type: 'qcm',
            question: 'Les droites $y = 3x + 1$ et $y = -\\frac{1}{3}x + 5$ sont :',
            options: ['Parallèles', 'Perpendiculaires', 'Sécantes non perpendiculaires', 'Confondues'],
            correct: 1,
            explication: '$3 \\times (-1/3) = -1$, donc perpendiculaires.',
          },
          {
            type: 'numerique',
            question: 'Ordonnée à l\'origine de la droite passant par $A(2;5)$ de pente $m=-3$ ?',
            reponse: 11,
            explication: '$y = -3x + p$. En $A$ : $5 = -6 + p$, donc $p = 11$.',
          },
        ],
      },

      // ── Géométrie Vectorielle (Approfondissement) ─────────────────────
      {
        id: 'geometrie-vectorielle',
        titre: 'Géométrie Vectorielle (Approfondissement)',
        niveau: 'maitrise',
        difficulte: 3,
        pointsXP: 60,
        prerequis: ['produit-scalaire'],
        competences: ['calculer', 'raisonner', 'representer'],
        contenu: {
          rappel:
            'Les vecteurs permettent de traduire des propriétés géométriques en calculs. $\\vec{AB} = B - A$. Deux vecteurs sont colinéaires ssi $\\det(\\vec{u}, \\vec{v}) = 0$.',
          methode:
            '\\vec{u}(x;y), \\vec{v}(x\';y\') \\text{ colinéaires} \\iff xy\' - x\'y = 0 \\\\ \\text{Milieu de } [AB] : I\\left(\\frac{x_A+x_B}{2}; \\frac{y_A+y_B}{2}\\right) \\\\ \\text{Distance : } AB = \\sqrt{(x_B-x_A)^2 + (y_B-y_A)^2}',
          tableau: [
            { f: '$\\vec{u} + \\vec{v}$', derivee: '$(x+x\'; y+y\')$' },
            { f: '$k\\vec{u}$', derivee: '$(kx; ky)$' },
            { f: '$||\\vec{u}||$', derivee: '$\\sqrt{x^2+y^2}$' },
            { f: '$\\det(\\vec{u},\\vec{v})$', derivee: '$xy\' - x\'y$' },
          ],
          astuce:
            'Le déterminant nul signifie colinéarité (points alignés). Le produit scalaire nul signifie orthogonalité. Ce sont deux outils complémentaires.',
          exercice: {
            question: 'Les points $A(1;2)$, $B(3;6)$, $C(5;10)$ sont-ils alignés ?',
            reponse: 'Oui',
            etapes: [
              '$\\vec{AB} = (2;4)$ et $\\vec{AC} = (4;8)$.',
              '$\\det(\\vec{AB}, \\vec{AC}) = 2 \\times 8 - 4 \\times 4 = 16 - 16 = 0$.',
              'Déterminant nul → vecteurs colinéaires → points alignés.',
            ],
          },
          erreursClassiques: [
            'Confondre déterminant (colinéarité) et produit scalaire (orthogonalité).',
            'Oublier l\'ordre dans $\\vec{AB} = B - A$ (et non $A - B$).',
            'Se tromper dans le calcul du déterminant : c\'est $xy\' - x\'y$, pas $xy\' + x\'y$.',
          ],
          methodologieBac:
            'Pour montrer un alignement : calculer le déterminant de deux vecteurs. Pour montrer un parallélisme : même méthode. Pour montrer une perpendicularité : produit scalaire.',
          coupDePouce: {
            indice: 'Calculez $\\vec{AB}$ et $\\vec{AC}$, puis leur déterminant.',
            debutRaisonnement: '$\\vec{AB} = (2;4)$, $\\vec{AC} = (4;8)$. $\\det = 2 \\times 8 - 4 \\times 4$.',
            correctionDetaillee: [
              '$\\vec{AB} = (3-1; 6-2) = (2;4)$.',
              '$\\vec{AC} = (5-1; 10-2) = (4;8)$.',
              '$\\det = 2 \\times 8 - 4 \\times 4 = 0$. Points alignés.',
            ],
          },
        },
        exercices: [
          {
            type: 'numerique',
            question: 'Distance entre $A(1;3)$ et $B(4;7)$ ?',
            reponse: 5,
            explication: '$AB = \\sqrt{(4-1)^2 + (7-3)^2} = \\sqrt{9+16} = \\sqrt{25} = 5$.',
          },
          {
            type: 'qcm',
            question: '$\\vec{u}(2;6)$ et $\\vec{v}(1;3)$ sont :',
            options: ['Orthogonaux', 'Colinéaires', 'Ni l\'un ni l\'autre', 'Opposés'],
            correct: 1,
            explication: '$\\det = 2 \\times 3 - 6 \\times 1 = 0$. Colinéaires (et même $\\vec{u} = 2\\vec{v}$).',
          },
          {
            type: 'numerique',
            question: 'Milieu de $[A(2;8), B(6;4)]$. Donner l\'abscisse du milieu.',
            reponse: 4,
            explication: '$x_I = (2+6)/2 = 4$.',
          },
        ],
      },

      // ── Équations de Cercles ──────────────────────────────────────────
      {
        id: 'equations-cercles',
        titre: 'Équations de Cercles',
        niveau: 'approfondissement',
        difficulte: 4,
        pointsXP: 70,
        prerequis: ['equations-droites', 'produit-scalaire'],
        competences: ['calculer', 'representer', 'chercher'],
        contenu: {
          rappel:
            'Le cercle de centre $\\Omega(a;b)$ et de rayon $r$ a pour équation : $(x-a)^2 + (y-b)^2 = r^2$. Développée : $x^2 + y^2 - 2ax - 2by + (a^2+b^2-r^2) = 0$.',
          methode:
            '\\text{Forme canonique : } (x-a)^2 + (y-b)^2 = r^2 \\\\ \\text{Centre : } \\Omega(a;b) \\quad \\text{Rayon : } r \\\\ \\text{Point sur le cercle : } (x_0-a)^2 + (y_0-b)^2 = r^2',
          astuce:
            'Pour retrouver centre et rayon à partir de la forme développée $x^2+y^2+Dx+Ey+F=0$ : compléter le carré. Centre $(-D/2; -E/2)$, rayon $\\sqrt{D^2/4 + E^2/4 - F}$.',
          exercice: {
            question: 'Déterminer le centre et le rayon du cercle $x^2 + y^2 - 4x + 6y - 3 = 0$.',
            reponse: 'Centre $(2; -3)$, rayon $4$',
            etapes: [
              'Compléter le carré en $x$ : $x^2 - 4x = (x-2)^2 - 4$.',
              'Compléter le carré en $y$ : $y^2 + 6y = (y+3)^2 - 9$.',
              '$(x-2)^2 - 4 + (y+3)^2 - 9 - 3 = 0$.',
              '$(x-2)^2 + (y+3)^2 = 16$.',
              'Centre $(2; -3)$, rayon $\\sqrt{16} = 4$.',
            ],
          },
          erreursClassiques: [
            'Se tromper dans le signe du centre : $(x-a)^2$ donne $a$, pas $-a$.',
            'Oublier de vérifier que $r^2 > 0$ (sinon pas de cercle).',
            'Confondre l\'équation d\'un cercle avec celle d\'une ellipse.',
          ],
          methodologieBac:
            'Pour identifier un cercle : mettre sous forme canonique par complétion du carré. Pour montrer qu\'un point est sur un cercle : vérifier que ses coordonnées satisfont l\'équation.',
          coupDePouce: {
            indice: 'Complétez le carré pour $x$ et pour $y$ séparément.',
            debutRaisonnement: '$x^2 - 4x = (x-2)^2 - 4$ et $y^2 + 6y = (y+3)^2 - 9$.',
            correctionDetaillee: [
              '$(x-2)^2 - 4 + (y+3)^2 - 9 - 3 = 0$.',
              '$(x-2)^2 + (y+3)^2 = 16$.',
              'Centre $(2;-3)$, rayon $4$.',
            ],
          },
          geogebraId: 'nBjGnpmA',
        },
        exercices: [
          {
            type: 'qcm',
            question: 'L\'équation $(x-1)^2 + (y+2)^2 = 9$ représente un cercle de :',
            options: [
              'Centre $(1;2)$, rayon $3$',
              'Centre $(1;-2)$, rayon $3$',
              'Centre $(-1;2)$, rayon $9$',
              'Centre $(1;-2)$, rayon $9$',
            ],
            correct: 1,
            explication: '$(x-1)^2 + (y-(-2))^2 = 3^2$. Centre $(1;-2)$, rayon $3$.',
          },
          {
            type: 'numerique',
            question: 'Rayon du cercle $x^2 + y^2 - 6x + 2y + 1 = 0$ ?',
            reponse: 3,
            explication: '$(x-3)^2 - 9 + (y+1)^2 - 1 + 1 = 0 \\Rightarrow (x-3)^2 + (y+1)^2 = 9$. Rayon $= 3$.',
          },
          {
            type: 'qcm',
            question: 'Le point $A(5; -3)$ est-il sur le cercle $(x-2)^2 + (y+3)^2 = 9$ ?',
            options: ['Oui', 'Non, il est à l\'intérieur', 'Non, il est à l\'extérieur', 'Impossible à dire'],
            correct: 0,
            explication: '$(5-2)^2 + (-3+3)^2 = 9 + 0 = 9$. Oui, le point est sur le cercle.',
          },
        ],
        ressourcesExt: [
          { label: 'GeoGebra — Équation de cercle', url: 'https://www.geogebra.org/m/nBjGnpmA' },
        ],
      },
    ],
  },

  // ═══════════════════════════════════════════════════════════════════════════
  // PROBABILITÉS & STATISTIQUES
  // ═══════════════════════════════════════════════════════════════════════════
  probabilites: {
    titre: 'Probabilités',
    icon: '🎲',
    couleur: 'amber',
    chapitres: [
      // ── Probabilités Conditionnelles ────────────────────────────────────
      {
        id: 'probabilites-cond',
        titre: 'Probabilités Conditionnelles',
        niveau: 'essentiel',
        difficulte: 3,
        pointsXP: 60,
        competences: ['modeliser', 'calculer', 'raisonner'],
        contenu: {
          rappel:
            'Probabilité de B sachant A : $P_A(B) = \\frac{P(A \\cap B)}{P(A)}$. L\'arbre pondéré est l\'outil principal.',
          methode:
            "\\text{Formule des probabilités totales :} \\\\ P(B) = P(A)P_A(B) + P(\\bar{A})P_{\\bar{A}}(B) \\\\ \\text{Indépendance : } P(A \\cap B) = P(A) \\times P(B)",
          cas: [
            { delta: 'Indépendance', solution: '$P(A \\cap B) = P(A) \\times P(B)$' },
            { delta: 'Probas Totales', solution: '$P(B) = P(A \\cap B) + P(\\bar{A} \\cap B)$' },
          ],
          astuce:
            'Ne confondez pas $P_A(B)$ (branche secondaire de l\'arbre) et $P(A \\cap B)$ (chemin complet = produit des branches).',
          exercice: {
            question: 'Si $P(A)=0.5$ et $P_A(B)=0.2$, calculer $P(A \\cap B)$.',
            reponse: '0.1',
            etapes: [
              'Formule : $P(A \\cap B) = P(A) \\times P_A(B)$.',
              '$0.5 \\times 0.2 = 0.1$.',
            ],
          },
          erreursClassiques: [
            'Confondre $P_A(B)$ et $P(A \\cap B)$.',
            'Oublier que la somme des branches issues d\'un nœud vaut 1.',
            'Écrire $P(A \\cup B) = P(A) + P(B)$ sans retirer $P(A \\cap B)$.',
          ],
          methodologieBac:
            'Toujours dessiner l\'arbre pondéré. Vérifier que chaque nœud a des branches qui somment à 1. Pour la formule des probabilités totales, identifier la partition.',
          coupDePouce: {
            indice: 'Utilisez la formule $P(A \\cap B) = P(A) \\times P_A(B)$.',
            debutRaisonnement: 'On multiplie les probabilités le long du chemin de l\'arbre.',
            correctionDetaillee: [
              '$P(A \\cap B) = P(A) \\times P_A(B) = 0.5 \\times 0.2 = 0.1$.',
            ],
          },
        },
        exercices: [
          {
            type: 'qcm',
            question: 'A et B indépendants, $P(A)=0.3$, $P(B)=0.4$. $P(A \\cap B)=$ ?',
            options: ['$0.7$', '$0.12$', '$0.1$', '$0.3$'],
            correct: 1,
            explication: 'Indépendance : $P(A \\cap B) = P(A) \\times P(B) = 0.3 \\times 0.4 = 0.12$.',
          },
          {
            type: 'numerique',
            question: '$P(A)=0.6$, $P(\\bar{A})=0.4$, $P_A(B)=0.3$, $P_{\\bar{A}}(B)=0.5$. Calculer $P(B)$.',
            reponse: 0.38,
            tolerance: 0.01,
            explication: '$P(B) = 0.6 \\times 0.3 + 0.4 \\times 0.5 = 0.18 + 0.20 = 0.38$.',
          },
        ],
      },

      // ── Variables Aléatoires ────────────────────────────────────────────
      {
        id: 'variables-aleatoires',
        titre: 'Variables Aléatoires',
        niveau: 'maitrise',
        difficulte: 3,
        pointsXP: 60,
        prerequis: ['probabilites-cond'],
        competences: ['modeliser', 'calculer', 'chercher'],
        contenu: {
          rappel:
            'Une variable aléatoire $X$ associe un nombre réel à chaque issue d\'une expérience aléatoire. Sa loi de probabilité donne $P(X=x_i)$ pour chaque valeur.',
          methode:
            "E(X) = \\sum x_i \\cdot P(X=x_i) \\quad V(X) = E(X^2) - [E(X)]^2 \\quad \\sigma(X) = \\sqrt{V(X)}",
          astuce:
            'L\'espérance est la "moyenne théorique". Si $E(X) > 0$ dans un jeu, le jeu est favorable au joueur.',
          exercice: {
            question: '$X$ prend les valeurs 1, 2, 3 avec $P(X=1)=0.5$, $P(X=2)=0.3$, $P(X=3)=0.2$. Calculer $E(X)$.',
            reponse: '1.7',
            etapes: [
              '$E(X) = 1 \\times 0.5 + 2 \\times 0.3 + 3 \\times 0.2$.',
              '$= 0.5 + 0.6 + 0.6 = 1.7$.',
            ],
          },
          erreursClassiques: [
            'Oublier de vérifier que $\\sum P(X=x_i) = 1$.',
            'Confondre $V(X) = E(X^2) - [E(X)]^2$ avec $E(X^2) - E(X)$.',
            'Oublier la racine carrée pour passer de la variance à l\'écart-type.',
          ],
          coupDePouce: {
            indice: 'Appliquez la formule $E(X) = \\sum x_i \\cdot P(X=x_i)$.',
            debutRaisonnement: '$E(X) = 1 \\times 0.5 + 2 \\times 0.3 + 3 \\times 0.2$.',
            correctionDetaillee: [
              '$E(X) = 1 \\times 0.5 + 2 \\times 0.3 + 3 \\times 0.2 = 0.5 + 0.6 + 0.6 = 1.7$.',
            ],
          },
        },
        exercices: [
          {
            type: 'numerique',
            question: '$X$ : gain d\'un jeu. $P(X=10)=0.2$, $P(X=-5)=0.8$. Calculer $E(X)$.',
            reponse: -2,
            explication: '$E(X) = 10 \\times 0.2 + (-5) \\times 0.8 = 2 - 4 = -2$. Jeu défavorable.',
          },
        ],
      },
    ],
  },

  // ═══════════════════════════════════════════════════════════════════════════
  // ALGORITHMIQUE & PYTHON
  // ═══════════════════════════════════════════════════════════════════════════
  algorithmique: {
    titre: 'Algorithmique & Python',
    icon: '💻',
    couleur: 'green',
    chapitres: [
      {
        id: 'algorithmique-python',
        titre: 'Algorithmique & Python',
        niveau: 'maitrise',
        difficulte: 2,
        pointsXP: 50,
        competences: ['chercher', 'modeliser', 'calculer'],
        contenu: {
          rappel:
            'Le programme de Première utilise Python pour implémenter les algorithmes liés aux suites, aux probabilités et à l\'analyse. Les structures de base : variables, boucles `for`/`while`, fonctions `def`, listes.',
          methode:
            '\\text{Boucle for : } \\texttt{for i in range(n)} \\\\ \\text{Boucle while : } \\texttt{while condition} \\\\ \\text{Fonction : } \\texttt{def f(x): return ...}',
          tableau: [
            { f: 'Calcul de $u_n$ (récurrence)', derivee: '`for i in range(n): u = f(u)`' },
            { f: 'Recherche de seuil', derivee: '`while u < seuil: u = f(u); n += 1`' },
            { f: 'Simulation probabilités', derivee: '`random.random() < p`' },
          ],
          astuce:
            'Utilisez `range(n)` pour itérer de 0 à $n-1$. Pour une suite récurrente, une simple boucle `for` suffit.',
          exercice: {
            question: 'Écrire une fonction Python qui calcule $u_n$ pour la suite $u_0=1$, $u_{n+1}=2u_n+1$.',
            reponse: 'def suite(n):\\n    u = 1\\n    for i in range(n):\\n        u = 2*u + 1\\n    return u',
            etapes: [
              'Initialiser $u = u_0 = 1$.',
              'Boucle `for i in range(n)` pour appliquer la récurrence $n$ fois.',
              'À chaque itération : $u \\leftarrow 2u + 1$.',
              'Retourner $u$.',
            ],
          },
          erreursClassiques: [
            '`range(n)` va de 0 à $n-1$, pas de 1 à $n$.',
            'Oublier l\'indentation en Python (erreur de syntaxe).',
            'Confondre `=` (affectation) et `==` (comparaison).',
          ],
          methodologieBac:
            'Au bac, on demande souvent de compléter un algorithme ou d\'expliquer ce qu\'il fait. Lisez ligne par ligne en faisant un "tableau de valeurs" à la main.',
        },
        exercices: [
          {
            type: 'ordonnancement',
            question: 'Remettre dans l\'ordre les lignes pour calculer la somme $1+2+\\ldots+n$ :',
            etapesDesordre: [
              'return s',
              's = 0',
              'def somme(n):',
              'for i in range(1, n+1):',
              's = s + i',
            ],
            ordreCorrect: [2, 1, 3, 4, 0],
            explication: 'On définit la fonction, initialise $s$, boucle de 1 à $n$, accumule, puis retourne.',
          },
          {
            type: 'qcm',
            question: 'Que retourne `len([1, 2, 3, 4])` en Python ?',
            options: ['3', '4', '10', 'Erreur'],
            correct: 1,
            explication: '`len()` retourne le nombre d\'éléments de la liste, ici 4.',
          },
        ],
      },
    ],
  },
};

// ─── Quiz Data (expanded) ───────────────────────────────────────────────────

export const quizData: QuizQuestion[] = [
  // Dérivation
  {
    id: 1,
    question: 'Quelle est la dérivée de $f(x) = x^2$ ?',
    options: ['$x$', '$2x$', '$1$', '$x^2$'],
    correct: 1,
    explication: "$(x^n)' = nx^{n-1}$, donc $(x^2)' = 2x$.",
    categorie: 'Dérivation',
    difficulte: 1,
  },
  {
    id: 2,
    question: "Dérivée de $f(x) = 5x^3 - 2x$ ?",
    options: ['$15x^2 - 2$', '$5x^2 - 2$', '$15x^2$', '$15x - 2$'],
    correct: 0,
    explication: "$(5x^3)' = 15x^2$ et $(-2x)' = -2$.",
    categorie: 'Dérivation',
    difficulte: 1,
  },
  {
    id: 3,
    question: "Dérivée de $h(x) = x \\cdot e^x$ ?",
    options: ['$e^x$', '$(1+x)e^x$', '$xe^x$', '$(x-1)e^x$'],
    correct: 1,
    explication: "Produit : $(x)'e^x + x(e^x)' = e^x + xe^x = (1+x)e^x$.",
    categorie: 'Dérivation',
    difficulte: 2,
  },
  // Second Degré
  {
    id: 4,
    question: 'Discriminant de $x^2 + x + 1$ ?',
    options: ['$3$', '$-3$', '$5$', '$1$'],
    correct: 1,
    explication: '$\\Delta = 1 - 4 = -3$. Pas de racine réelle.',
    categorie: 'Second Degré',
    difficulte: 1,
  },
  {
    id: 5,
    question: 'Sommet de la parabole $f(x) = 2x^2 - 8x + 3$ ?',
    options: ['$(2; -5)$', '$(4; 3)$', '$(2; 3)$', '$(-2; 5)$'],
    correct: 0,
    explication: '$\\alpha = -b/2a = 8/4 = 2$. $f(2) = 8 - 16 + 3 = -5$.',
    categorie: 'Second Degré',
    difficulte: 2,
  },
  // Exponentielle
  {
    id: 6,
    question: 'Que vaut $e^{\\ln(5)}$ ?',
    options: ['$e^5$', '$5$', '$\\ln(5)$', '$1$'],
    correct: 1,
    explication: '$e^{\\ln(x)} = x$ pour $x > 0$.',
    categorie: 'Exponentielle',
    difficulte: 1,
  },
  {
    id: 7,
    question: '$e^{2x} = e^6$. Que vaut $x$ ?',
    options: ['$2$', '$3$', '$6$', '$12$'],
    correct: 1,
    explication: '$2x = 6 \\Rightarrow x = 3$.',
    categorie: 'Exponentielle',
    difficulte: 1,
  },
  // Géométrie
  {
    id: 8,
    question: 'Si $\\vec{u} \\cdot \\vec{v} = 0$, alors...',
    options: ['Vecteurs égaux', 'Vecteurs colinéaires', 'Vecteurs orthogonaux', 'Norme nulle'],
    correct: 2,
    explication: "Définition de l'orthogonalité via le produit scalaire.",
    categorie: 'Géométrie',
    difficulte: 1,
  },
  {
    id: 9,
    question: 'Pente de la droite passant par $A(1;2)$ et $B(3;8)$ ?',
    options: ['$2$', '$3$', '$6$', '$1/3$'],
    correct: 1,
    explication: '$m = (8-2)/(3-1) = 6/2 = 3$.',
    categorie: 'Géométrie',
    difficulte: 1,
  },
  // Suites
  {
    id: 10,
    question: 'Suite $(u_n)$ : $u_{n+1} = 2u_n$. Elle est...',
    options: ['Arithmétique', 'Géométrique', 'Constante', 'Aléatoire'],
    correct: 1,
    explication: "On multiplie par une constante (2) : suite géométrique de raison $q=2$.",
    categorie: 'Suites',
    difficulte: 1,
  },
  {
    id: 11,
    question: 'Somme $1 + 2 + \\ldots + 100$ ?',
    options: ['$5000$', '$5050$', '$10000$', '$10100$'],
    correct: 1,
    explication: '$\\frac{100 \\times 101}{2} = 5050$.',
    categorie: 'Suites',
    difficulte: 1,
  },
  // Trigonométrie
  {
    id: 12,
    question: '$\\cos(\\pi) = $ ?',
    options: ['$0$', '$1$', '$-1$', '$\\pi$'],
    correct: 2,
    explication: 'Sur le cercle trigonométrique, $\\pi$ correspond au point $(-1; 0)$.',
    categorie: 'Trigonométrie',
    difficulte: 1,
  },
  {
    id: 13,
    question: '$\\sin(\\pi/2) = $ ?',
    options: ['$0$', '$1/2$', '$1$', '$\\sqrt{2}/2$'],
    correct: 2,
    explication: '$\\pi/2 = 90°$, le point est $(0; 1)$, donc $\\sin(\\pi/2) = 1$.',
    categorie: 'Trigonométrie',
    difficulte: 1,
  },
  // Probabilités
  {
    id: 14,
    question: '$P(A)=0.4$, $P_A(B)=0.5$. $P(A \\cap B)=$ ?',
    options: ['$0.9$', '$0.2$', '$0.1$', '$0.45$'],
    correct: 1,
    explication: '$P(A \\cap B) = P(A) \\times P_A(B) = 0.4 \\times 0.5 = 0.2$.',
    categorie: 'Probabilités',
    difficulte: 1,
  },
  {
    id: 15,
    question: '$E(X)$ avec $P(X=0)=0.5$ et $P(X=10)=0.5$ ?',
    options: ['$0$', '$5$', '$10$', '$2.5$'],
    correct: 1,
    explication: '$E(X) = 0 \\times 0.5 + 10 \\times 0.5 = 5$.',
    categorie: 'Probabilités',
    difficulte: 1,
  },
  // Combinatoire
  {
    id: 16,
    question: '$\\binom{4}{2} = $ ?',
    options: ['$4$', '$6$', '$8$', '$2$'],
    correct: 1,
    explication: '$\\binom{4}{2} = \\frac{4!}{2!2!} = \\frac{24}{4} = 6$.',
    categorie: 'Combinatoire',
    difficulte: 1,
  },
  // Algorithmique
  {
    id: 17,
    question: 'Que retourne `range(5)` en Python ?',
    options: ['$[1,2,3,4,5]$', '$[0,1,2,3,4]$', '$[0,1,2,3,4,5]$', '$[1,2,3,4]$'],
    correct: 1,
    explication: '`range(5)` génère les entiers de 0 à 4 (5 exclus).',
    categorie: 'Algorithmique',
    difficulte: 1,
  },
  {
    id: 18,
    question: 'En Python, `10 // 3` vaut :',
    options: ['$3.33$', '$3$', '$1$', '$30$'],
    correct: 1,
    explication: '`//` est la division entière. $10 \\div 3 = 3$ (reste 1).',
    categorie: 'Algorithmique',
    difficulte: 1,
  },
  // Limites
  {
    id: 19,
    question: '$\\lim_{x \\to +\\infty} \\frac{2x^2 + 1}{x^2 - 3}$ vaut :',
    options: ['$0$', '$2$', '$+\\infty$', '$-3$'],
    correct: 1,
    explication: 'Même degré : on divise les coefficients dominants $2/1 = 2$.',
    categorie: 'Limites',
    difficulte: 2,
  },
  {
    id: 20,
    question: '$\\lim_{x \\to +\\infty} \\frac{x}{e^x}$ vaut :',
    options: ['$+\\infty$', '$1$', '$0$', '$e$'],
    correct: 2,
    explication: 'Croissance comparée : $e^x$ l\'emporte sur tout polynôme.',
    categorie: 'Limites',
    difficulte: 2,
  },
  {
    id: 21,
    question: '$\\infty - \\infty$ est :',
    options: ['$0$', '$+\\infty$', 'Une forme indéterminée', '$-\\infty$'],
    correct: 2,
    explication: 'C\'est une forme indéterminée : le résultat dépend des fonctions en jeu.',
    categorie: 'Limites',
    difficulte: 1,
  },
  // Continuité / TVI
  {
    id: 22,
    question: 'Le TVI s\'applique si la fonction est :',
    options: ['Dérivable', 'Continue', 'Croissante', 'Positive'],
    correct: 1,
    explication: 'Le Théorème des Valeurs Intermédiaires nécessite la continuité sur un intervalle fermé.',
    categorie: 'Continuité',
    difficulte: 1,
  },
  {
    id: 23,
    question: '$f(x) = x^3 - 1$. $f(0)=-1$ et $f(2)=7$. Par le TVI :',
    options: ['$f$ n\'a pas de racine', '$f$ a au moins une racine dans $]0;2[$', '$f$ a exactement 3 racines', 'On ne peut rien dire'],
    correct: 1,
    explication: '$f$ continue, $f(0) < 0$ et $f(2) > 0$ : changement de signe → racine dans $]0;2[$.',
    categorie: 'Continuité',
    difficulte: 2,
  },
  // Géométrie vectorielle
  {
    id: 24,
    question: '$\\det(\\vec{u}(3;1), \\vec{v}(6;2))$ vaut :',
    options: ['$0$', '$12$', '$-12$', '$8$'],
    correct: 0,
    explication: '$3 \\times 2 - 1 \\times 6 = 6 - 6 = 0$. Vecteurs colinéaires.',
    categorie: 'Géométrie',
    difficulte: 1,
  },
  {
    id: 25,
    question: 'Distance entre $A(1;1)$ et $B(4;5)$ ?',
    options: ['$3$', '$4$', '$5$', '$7$'],
    correct: 2,
    explication: '$AB = \\sqrt{9+16} = \\sqrt{25} = 5$.',
    categorie: 'Géométrie',
    difficulte: 1,
  },
  // Cercles
  {
    id: 26,
    question: 'Centre du cercle $(x+3)^2 + (y-1)^2 = 4$ ?',
    options: ['$(3;1)$', '$(-3;1)$', '$(-3;-1)$', '$(3;-1)$'],
    correct: 1,
    explication: '$(x-(-3))^2 + (y-1)^2 = 4$. Centre $(-3;1)$.',
    categorie: 'Géométrie',
    difficulte: 1,
  },
  {
    id: 27,
    question: 'Le point $(0;0)$ est-il dans le cercle $(x-1)^2+(y-1)^2=4$ ?',
    options: ['Sur le cercle', 'À l\'intérieur', 'À l\'extérieur', 'Au centre'],
    correct: 1,
    explication: '$(0-1)^2+(0-1)^2 = 2 < 4$. Le point est à l\'intérieur.',
    categorie: 'Géométrie',
    difficulte: 2,
  },
  // Dérivation avancée
  {
    id: 28,
    question: 'Dérivée de $f(x) = \\frac{x}{x+1}$ ?',
    options: ['$\\frac{1}{(x+1)^2}$', '$\\frac{1}{x+1}$', '$\\frac{-1}{(x+1)^2}$', '$\\frac{x}{(x+1)^2}$'],
    correct: 0,
    explication: '$(u/v)\' = (u\'v - uv\')/v^2 = (1 \\cdot (x+1) - x \\cdot 1)/(x+1)^2 = 1/(x+1)^2$.',
    categorie: 'Dérivation',
    difficulte: 3,
  },
  // Suites avancée
  {
    id: 29,
    question: 'Suite $u_n = 3 \\times 2^n$. $u_0 + u_1 + u_2 + u_3 = $ ?',
    options: ['$24$', '$45$', '$30$', '$48$'],
    correct: 1,
    explication: '$3 + 6 + 12 + 24 = 45$.',
    categorie: 'Suites',
    difficulte: 2,
  },
  // Probabilités avancée
  {
    id: 30,
    question: 'A et B indépendants. $P(A)=0.5$, $P(B)=0.6$. $P(A \\cup B) = $ ?',
    options: ['$1.1$', '$0.8$', '$0.3$', '$0.5$'],
    correct: 1,
    explication: '$P(A \\cup B) = P(A) + P(B) - P(A \\cap B) = 0.5 + 0.6 - 0.3 = 0.8$.',
    categorie: 'Probabilités',
    difficulte: 2,
  },
  // Exponentielle avancée
  {
    id: 31,
    question: 'Résoudre $e^{x^2} = e^4$. Solutions ?',
    options: ['$x = 4$', '$x = 2$ uniquement', '$x = 2$ ou $x = -2$', '$x = \\pm 4$'],
    correct: 2,
    explication: '$x^2 = 4 \\Rightarrow x = 2$ ou $x = -2$.',
    categorie: 'Exponentielle',
    difficulte: 2,
  },
  // Trigonométrie avancée
  {
    id: 32,
    question: 'Nombre de solutions de $\\cos(x) = 0$ sur $[0; 2\\pi]$ ?',
    options: ['$1$', '$2$', '$3$', '$4$'],
    correct: 1,
    explication: '$x = \\pi/2$ et $x = 3\\pi/2$. Deux solutions.',
    categorie: 'Trigonométrie',
    difficulte: 2,
  },
];

// ─── Badge Definitions ──────────────────────────────────────────────────────

export interface BadgeDefinition {
  id: string;
  nom: string;
  description: string;
  icon: string;
  condition: string;
}

export const badgeDefinitions: BadgeDefinition[] = [
  { id: 'stakhanoviste', nom: 'Stakhanoviste', description: '7 jours de suite', icon: '🏅', condition: 'streak >= 7' },
  { id: 'sherlock', nom: 'Sherlock', description: 'Résoudre un exercice difficile sans indice', icon: '🧠', condition: 'hard_no_hint' },
  { id: 'fusee', nom: 'Fusée Ariane', description: 'Aucune erreur sur un chapitre complet', icon: '🚀', condition: 'perfect_chapter' },
  { id: 'debugger', nom: 'De-bugger', description: 'Réussir le premier exercice Python du premier coup', icon: '🐛', condition: 'first_python' },
  { id: 'combo-king', nom: 'Combo King', description: '10 bonnes réponses d\'affilée', icon: '⚡', condition: 'combo >= 10' },
  { id: 'marathonien', nom: 'Marathonien', description: '30 jours de streak', icon: '🏆', condition: 'streak >= 30' },
  { id: 'expert-discriminant', nom: 'Expert du Discriminant', description: 'Maîtriser le chapitre Second Degré', icon: '🎯', condition: 'mastered:second-degre' },
  { id: 'maitre-suites', nom: 'Maître des Suites', description: 'Maîtriser le chapitre Suites', icon: '📊', condition: 'mastered:suites' },
  { id: 'as-derivation', nom: 'As de la Dérivation', description: 'Maîtriser le chapitre Dérivation', icon: '📐', condition: 'mastered:derivation' },
  { id: 'geometre', nom: 'Géomètre', description: 'Maîtriser tous les chapitres de Géométrie', icon: '📏', condition: 'mastered:geometrie-all' },
  { id: 'probabiliste', nom: 'Probabiliste', description: 'Maîtriser Probabilités et Variables Aléatoires', icon: '🎲', condition: 'mastered:probabilites-all' },
  { id: 'polymathe', nom: 'Polymathe', description: 'Compléter tous les chapitres du programme', icon: '👑', condition: 'all_chapters_completed' },
];
