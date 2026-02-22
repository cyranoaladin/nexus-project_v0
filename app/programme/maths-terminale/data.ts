// Seed Pack v1 — Terminale Spé Maths (EDS) — Prépa Bac (contenu original + extension)

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

export type CompetenceBO =
  | 'chercher'
  | 'modeliser'
  | 'representer'
  | 'raisonner'
  | 'calculer'
  | 'communiquer';

export type Difficulty = 1 | 2 | 3 | 4 | 5;

export interface ChapterContent {
  rappelHtml: string;
  methodesHtml: string;
  erreursClassiques: string[];
  checklistBac: string[];
  miniExoGuide: {
    enonceHtml: string;
    attenduHtml: string;
    correctionHtml: string;
  };
  exercicesInteractifs: Exercice[];
  competences: CompetenceBO[];
  difficulty: Difficulty;
  tags: string[];
  focusBacPriority: number;
}

export interface Chapter {
  id: string;
  title: string;
  description: string;
  content: ChapterContent;
}
export interface Category {
  id: string;
  title: string;
  description: string;
  chapters: Chapter[];
}

const checklistBase = [
  'Domaine écrit',
  'Théorème cité',
  'Équation exacte résolue',
  'Conclusion en français',
  '+2kπ si trigonométrie',
  'Valeur absolue si distance/formule concernée',
  'Point final donné',
  'Arrondi conforme à la consigne',
];

const exercicesBase: Exercice[] = [
  {
    type: 'qcm',
    question: 'Quelle est la première étape au bac ?',
    options: ['Calculer immédiatement', 'Poser le cadre et les hypothèses', 'Tracer sans lire', 'Choisir au hasard'],
    correct: 1,
    explication: 'Le cadre théorique et les hypothèses sont notés.',
  },
  {
    type: 'numerique',
    question: 'Donner 2^5',
    reponse: 32,
    explication: '2^5 = 32.',
  },
  {
    type: 'qcm',
    question: 'Une conclusion attendue doit être :',
    options: ['Abrégée', 'En français avec le résultat', 'Uniquement symbolique', 'Sans unité'],
    correct: 1,
    explication: 'La rédaction finale est évaluée.',
  },
  {
    type: 'ordonnancement',
    question: 'Ordonner une méthode standard.',
    etapesDesordre: ['Calculer', 'Conclure', 'Modéliser'],
    ordreCorrect: [2, 0, 1],
    explication: 'Modéliser puis calculer puis conclure.',
  },
];

function mkChapter(
  id: string,
  title: string,
  description: string,
  focusBacPriority: number,
  difficulty: Difficulty,
  tags: string[],
  competences: CompetenceBO[],
  rappelHtml: string,
  methodesHtml: string,
  mini: { enonceHtml: string; attenduHtml: string; correctionHtml: string },
  erreursClassiques: string[],
  exos?: Exercice[]
): Chapter {
  return {
    id,
    title,
    description,
    content: {
      rappelHtml,
      methodesHtml,
      erreursClassiques,
      checklistBac: [...checklistBase],
      miniExoGuide: mini,
      exercicesInteractifs: exos ?? exercicesBase,
      competences,
      difficulty,
      tags,
      focusBacPriority,
    },
  };
}

export const programmeDataTerminale: Category[] = [
  {
    id: 'A',
    title: 'Algèbre & Géométrie',
    description:
      "Dénombrement et géométrie dans l’espace : vecteurs, droites, plans, équations, orthogonalité, distances.",
    chapters: [
      mkChapter(
        'A1-combinatoire',
        'Combinatoire & dénombrement',
        'Compter proprement : produit, factorielle, combinaisons, Pascal.',
        3,
        2,
        ['dénombrement', 'factorielle', 'C(n,k)', 'Pascal'],
        ['modeliser', 'raisonner', 'calculer', 'communiquer'],
        `<p><b>Objectif :</b> traduire une situation en ensemble d’issues puis compter.</p>
         <ul><li>Produit cartésien pour choix successifs.</li><li>Factorielle n! pour permutations.</li><li>Combinaisons $\\binom{n}{k}$ si ordre indifférent.</li><li>Pascal et symétrie des coefficients.</li></ul>`,
        `<ol><li>Modéliser : ordre/répétition.</li><li>Choisir formule adaptée.</li><li>Justifier en français.</li></ol>`,
        {
          enonceHtml: 'On forme un code de 5 caractères avec 26 lettres et 10 chiffres (répétition autorisée).',
          attenduHtml: '5 choix indépendants, 36 possibilités par position.',
          correctionHtml: 'Total = $36^5$.',
        },
        [
          'Confondre permutation et combinaison.',
          'Oublier l’hypothèse avec/sans répétition.',
          'Appliquer une formule sans justification contextuelle.',
          'Inverser n et k dans les combinaisons.',
        ],
        [
          {
            type: 'qcm',
            question: 'Que compte $\\binom{n}{k}$ ?',
            options: ['Listes ordonnées', 'Sous-ensembles de taille k', 'Suites avec répétition', 'Permutations de n'],
            correct: 1,
            explication: 'Ordre indifférent, sans répétition.',
          },
          {
            type: 'numerique',
            question: 'Calculer 6!.',
            reponse: 720,
            explication: '6! = 720.',
          },
          {
            type: 'qcm',
            question: 'Sans remise et successif :',
            options: ['Combinaison', 'Liste ordonnée', 'Répétition', 'Normale'],
            correct: 1,
            explication: 'Ordre important.',
          },
          {
            type: 'ordonnancement',
            question: 'Méthode pour mots de longueur 4 sur 3 lettres.',
            etapesDesordre: ['Conclure : 3^4', '4 positions indépendantes', '3 choix par position'],
            ordreCorrect: [1, 2, 0],
            explication: 'Produit des choix.',
          },
        ]
      ),
      mkChapter(
        'A2-espace-bases',
        'Vecteurs, droites, plans : bases & positions relatives',
        'Traduire l’espace en équations : alignement, parallélisme, coplanarité, appartenance.',
        5,
        3,
        ['espace', 'droite', 'plan', 'paramètres', 'coplanarité'],
        ['representer', 'raisonner', 'calculer', 'communiquer'],
        `<p><b>Droite :</b> un point + un vecteur directeur. <b>Plan :</b> un point + 2 vecteurs non colinéaires.</p>
         <p>Appartenance : $\\overrightarrow{AM}=t\\vec u$ (droite), $\\overrightarrow{AM}=s\\vec u+t\\vec v$ (plan).</p>`,
        `<ol><li>Choisir le bon modèle (droite/plan).</li><li>Écrire les paramètres.</li><li>Résoudre et conclure par une phrase.</li></ol>`,
        {
          enonceHtml: 'A(1,0,2), $\\vec u=(2,-1,3)$ : donner une paramétrique de la droite passant par A.',
          attenduHtml: '$\\overrightarrow{AM}=t\\vec u$ puis coordonnées.',
          correctionHtml: '$x=1+2t$, $y=-t$, $z=2+3t$.',
        },
        [
          'Confondre normal et directeur.',
          'Oublier d’introduire les paramètres.',
          'Conclure sans vérification.',
          'Oublier la non-colinéarité des directeurs du plan.',
        ]
      ),
      mkChapter(
        'A3-ortho-dist',
        'Orthogonalité & distances dans l’espace',
        'Produit scalaire, orthogonalité, distance point-plan.',
        5,
        4,
        ['espace', 'produit scalaire', 'distance', 'orthogonalité'],
        ['raisonner', 'calculer', 'communiquer'],
        `<p>Orthogonalité : $\\vec u\\cdot\\vec v=0$. Plan $ax+by+cz+d=0$ de normal $(a,b,c)$.</p>
         <p>Distance point-plan : $d(M,P)=\\dfrac{|ax_0+by_0+cz_0+d|}{\\sqrt{a^2+b^2+c^2}}$.</p>`,
        `<ol><li>Identifier le normal.</li><li>Appliquer la formule avec valeur absolue.</li><li>Simplifier et conclure.</li></ol>`,
        {
          enonceHtml: 'P: $2x-y+2z-4=0$, M(1,0,0).',
          attenduHtml: 'Utiliser la formule distance point-plan.',
          correctionHtml: '$d=\\frac{|2-4|}{\\sqrt{4+1+4}}=\\frac{2}{3}$.',
        },
        [
          'Oublier la valeur absolue.',
          'Erreur sur la norme du normal.',
          'Confondre distance point-plan et point-droite.',
          'Conclure sans unité/contexte.',
        ]
      ),
      mkChapter(
        'A4-param-cartesien',
        'Paramétriques (droites) & cartésiennes (plans)',
        'Lien géométrie ↔ algèbre : intersections et appartenance.',
        5,
        3,
        ['paramétrique', 'cartésien', 'intersection', 'normal'],
        ['representer', 'raisonner', 'calculer', 'communiquer'],
        `<p>Droite paramétrique : $(x,y,z)=A+t\\vec u$. Plan cartésien : $ax+by+cz+d=0$.</p>
         <p>Intersection droite-plan : substitution puis résolution en t.</p>`,
        `<ol><li>Identifier données.</li><li>Écrire les équations.</li><li>Substituer et conclure avec le point final.</li></ol>`,
        {
          enonceHtml: 'Plan passant par A(1,2,0) de normal n(2,-1,3).',
          attenduHtml: 'Écrire $\\vec n\\cdot\\overrightarrow{AM}=0$.',
          correctionHtml: '$2(x-1)-(y-2)+3z=0 \\iff 2x-y+3z=0$.',
        },
        [
          'Substitution incomplète.',
          'Conserver t mais oublier de calculer le point.',
          'Erreur entre normal/directeur.',
          'Perte de signe au développement.',
        ]
      ),
    ],
  },
  {
    id: 'B',
    title: 'Analyse',
    description:
      'Suites, limites, dérivation, continuité/TVI, logarithme, trigonométrie, primitives/EDO, intégrales.',
    chapters: [
      mkChapter(
        'B1-suites',
        'Suites : convergence, limites, seuils',
        'Monotone+bornée, point fixe, seuils.',
        5,
        4,
        ['suite', 'récurrence', 'point fixe', 'seuil'],
        ['raisonner', 'calculer', 'communiquer', 'modeliser'],
        `<ul><li>Croissante majorée ⇒ convergente.</li><li>Récurrence $u_{n+1}=f(u_n)$ : stabilité+monotonie.</li><li>Si $u_n\\to\\ell$, alors $\\ell=f(\\ell)$.</li></ul>`,
        `<ol><li>Montrer l'encadrement.</li><li>Montrer la monotonie.</li><li>Conclure par point fixe + exclusion.</li></ol>`,
        {
          enonceHtml: '$u_0=0,2$, $u_{n+1}=2u_n-u_n^2$. Trouver la limite.',
          attenduHtml: '[0,1] stable + croissance + point fixe.',
          correctionHtml: 'La suite converge vers 1.',
        },
        [
          'Convergence sans justification.',
          'Erreur de signe dans $u_{n+1}-u_n$.',
          'Point fixe non résolu complètement.',
          'Absence d’exclusion des limites impossibles.',
        ]
      ),
      mkChapter(
        'B2-limites',
        'Limites de fonctions',
        'Limites en un point/infini, asymptotes, formes indéterminées.',
        4,
        3,
        ['limites', 'dominant', 'asymptotes'],
        ['calculer', 'raisonner', 'communiquer'],
        `<ul><li>Asymptote verticale : limite infinie en un point.</li><li>Asymptote horizontale : limite finie en ±∞.</li><li>Traiter 0/0, ∞/∞ par transformation.</li></ul>`,
        `<ol><li>Identifier la forme.</li><li>Transformer (dominant).</li><li>Conclure et donner l’asymptote.</li></ol>`,
        {
          enonceHtml: '$\\lim_{x\\to+\\infty}\\frac{3x^2-1}{2x^2+5}$',
          attenduHtml: 'Diviser par $x^2$.',
          correctionHtml: 'Limite $=3/2$, asymptote $y=3/2$.',
        },
        ['Asymptote conclue sans limite.', 'Dominant mal choisi.', 'Transformation inadaptée.', 'Domaine oublié.']
      ),
      mkChapter(
        'B3-derivation',
        'Compléments dérivation (variations/tangentes/convexité)',
        'Signe de f’, f’’, tangente, inflexion.',
        5,
        4,
        ['dérivée', 'variations', 'tangente', 'convexité'],
        ['raisonner', 'calculer', 'communiquer'],
        `<ul><li>Variations via f'.</li><li>Tangente: $y=f'(a)(x-a)+f(a)$.</li><li>Convexité via f''.</li></ul>`,
        `<ol><li>Calculer/factoriser f'.</li><li>Tableau de signe puis variations.</li><li>Étudier f'' et l’inflexion.</li></ol>`,
        {
          enonceHtml: '$f(x)=x^2\\ln x$ sur ]0,+∞[, variations ?',
          attenduHtml: "$f\\'(x)=x(2\\\\ln x+1)$.",
          correctionHtml: 'Décroît sur ]0,e^{-1/2}], puis croît.',
        },
        ['Résoudre $\\ln x=0$ au lieu de $2\\ln x+1=0$.', 'Domaine x>0 oublié.', 'Erreur dans f".', 'Tangente mal formulée.']
      ),
      mkChapter(
        'B4-continuite-tvi',
        'Continuité/TVI/dichotomie',
        'Existence, unicité, encadrement.',
        5,
        4,
        ['TVI', 'continuité', 'unicité', 'dichotomie'],
        ['raisonner', 'communiquer', 'modeliser', 'calculer'],
        `<ul><li>TVI : continuité + encadrement de k.</li><li>Unicité via monotonie stricte.</li><li>Dichotomie pour encadrer numériquement.</li></ul>`,
        `<ol><li>Continuité.</li><li>Signes aux bornes.</li><li>TVI puis monotonie.</li></ol>`,
        {
          enonceHtml: 'Montrer que $\\ln(x)+x-2=0$ a une unique solution sur [1,2].',
          attenduHtml: 'TVI + dérivée >0.',
          correctionHtml: "Existence par TVI, unicité car $f\\'(x)=1/x+1>0$.",
        },
        ['TVI sans continuité.', 'Unicité sans monotonie.', 'Dichotomie incohérente.', 'Largeur finale non respectée.']
      ),
      mkChapter(
        'B5-ln',
        'Fonction logarithme',
        'Propriétés, équations/inéquations, dérivée.',
        5,
        3,
        ['ln', 'équations', 'domaine', 'exp'],
        ['calculer', 'raisonner', 'communiquer'],
        `<ul><li>Domaine: x>0.</li><li>$\\ln(ab)=\\ln a + \\ln b$.</li><li>$(\\ln x)'=1/x$.</li></ul><p>Attention: $\\ln(a+b)\\neq\\ln a+\\ln b$.</p>`,
        `<ol><li>Poser le domaine.</li><li>Isoler ln.</li><li>Exponentier et vérifier.</li></ol>`,
        {
          enonceHtml: 'Résoudre $2\\ln(x)-3=0$.',
          attenduHtml: 'Isoler puis exponentier.',
          correctionHtml: '$x=e^{3/2}$.',
        },
        ['Domaine oublié.', 'Propriété fausse sur ln(a+b).', 'Exponentiation mal faite.', 'Solution non vérifiée.']
      ),
      mkChapter(
        'B6-trigo',
        'Sinus/Cosinus',
        'Dérivées, périodicité, résolution trigonométrique.',
        3,
        3,
        ['trigo', 'sin', 'cos', 'périodicité'],
        ['representer', 'calculer', 'communiquer'],
        `<ul><li>Période $2\\pi$.</li><li>$(\\sin x)'=\\cos x$, $(\\cos x)'=-\\sin x$.</li><li>Résoudre sur [0,2π] puis +2kπ.</li></ul>`,
        `<ol><li>Résoudre sur un intervalle de référence.</li><li>Donner toutes les solutions.</li><li>Étendre avec +2kπ.</li></ol>`,
        {
          enonceHtml: 'Résoudre $\\cos(x)=1/2$ sur ℝ.',
          attenduHtml: 'Référence [0,2π].',
          correctionHtml: '$x=\\pi/3+2k\\pi$ ou $x=5\\pi/3+2k\\pi$.',
        },
        ['+2kπ oublié.', 'Une seule solution donnée.', 'Confusion sin/cos.', 'Angles remarquables faux.']
      ),
      mkChapter(
        'B7-primitives-edo',
        'Primitives & équations différentielles',
        'Primitives usuelles, y’=ay, y’=ay+b, condition initiale.',
        4,
        4,
        ['primitive', 'EDO', 'exp', 'condition initiale'],
        ['calculer', 'raisonner', 'communiquer', 'modeliser'],
        `<ul><li>Primitives: +C.</li><li>$y'=ay \\Rightarrow y=Ce^{ax}$.</li><li>$y'=ay+b$: homogène + particulière.</li></ul>`,
        `<ol><li>Écrire la forme générale.</li><li>Utiliser la condition initiale.</li><li>Contrôler par dérivation.</li></ol>`,
        {
          enonceHtml: 'Résoudre $y’=2y$, $y(0)=3$.',
          attenduHtml: '$y=Ce^{2x}$.',
          correctionHtml: '$C=3$, donc $y=3e^{2x}$.',
        },
        ['+C oublié.', 'Condition initiale mal appliquée.', 'Confusion général/particulier.', 'Primitive erronée.']
      ),
      mkChapter(
        'B8-integrales',
        'Calcul intégral',
        'Primitive, aire, additivité, signe.',
        3,
        3,
        ['intégrale', 'primitive', 'aire'],
        ['calculer', 'raisonner', 'communiquer'],
        `<ul><li>$\\int_a^b f = F(b)-F(a)$.</li><li>Si f change de signe, découper pour l’aire.</li><li>Linéarité et additivité des intégrales.</li></ul>`,
        `<ol><li>Trouver une primitive.</li><li>Appliquer F(b)-F(a).</li><li>Interpréter selon le signe.</li></ol>`,
        {
          enonceHtml: 'Calculer $\\int_0^1 3x^2dx$.',
          attenduHtml: 'Primitive $x^3$.',
          correctionHtml: '$[x^3]_0^1=1$.',
        },
        ['Bornes oubliées.', 'Aire et intégrale confondues.', 'Primitive fausse.', 'Découpage ignoré.']
      ),
    ],
  },
  {
    id: 'C',
    title: 'Probabilités',
    description: 'Schéma de Bernoulli/binomiale, sommes de VA, concentration et loi des grands nombres.',
    chapters: [
      mkChapter(
        'C1-binomiale',
        'Schéma de Bernoulli / binomiale',
        'Justifier le modèle, calculer P(X=k), compléments.',
        5,
        4,
        ['Bernoulli', 'binomiale', 'espérance', 'complément'],
        ['modeliser', 'calculer', 'raisonner', 'communiquer'],
        `<p>Si répétitions indépendantes et p constant: $X\\sim\\mathcal{B}(n,p)$.</p>
         <p>$P(X=k)=\\binom{n}{k}p^k(1-p)^{n-k}$, $E(X)=np$.</p>`,
        `<ol><li>Rédiger les 3 conditions.</li><li>Identifier n,p,k.</li><li>Appliquer formule/complément.</li></ol>`,
        {
          enonceHtml: '10 pièces, p=0,9 conforme. P(X=8) ?',
          attenduHtml: 'X~B(10,0,9), formule.',
          correctionHtml: '$P(X=8)=\\binom{10}{8}0,9^8 0,1^2$.',
        },
        ['Justification absente.', 'Puissance n-k erronée.', 'Complément non utilisé.', 'Confusion proba/espérance.']
      ),
      mkChapter(
        'C2-sommes-va',
        'Sommes de VA + espérance/variance',
        'Linéarité, indépendance, variance de binomiale.',
        4,
        4,
        ['espérance', 'variance', 'indépendance', 'binomiale'],
        ['calculer', 'raisonner', 'communiquer'],
        `<ul><li>$E(X+Y)=E(X)+E(Y)$.</li><li>Si indépendantes: $V(X+Y)=V(X)+V(Y)$.</li><li>$V(aX)=a^2V(X)$.</li></ul>`,
        `<ol><li>Repérer indépendance.</li><li>Appliquer les formules correctement.</li><li>Interpréter.</li></ol>`,
        {
          enonceHtml: '$X\\sim B(20,0,3)$ : calculer $E(X)$ et $V(X)$.',
          attenduHtml: '$np$ et $np(1-p)$.',
          correctionHtml: '$E=6$, $V=4,2$.',
        },
        ['Indépendance oubliée.', 'Carré oublié dans V(aX).', 'σ et V confondus.', 'Formule binomiale mal appliquée.']
      ),
      mkChapter(
        'C3-concentration-lgn',
        'Concentration / loi des grands nombres',
        'Fréquence observée et stabilisation autour de p.',
        3,
        3,
        ['LGN', 'fréquence', 'concentration', 'simulation'],
        ['modeliser', 'raisonner', 'communiquer'],
        `<p>Dans un grand nombre d’essais indépendants, la fréquence se rapproche de p.</p>
         <p>Pour $X\\sim B(n,p)$, la fréquence $F=X/n$ se concentre autour de p quand n augmente.</p>`,
        `<ol><li>Définir X et F.</li><li>Relier $E(F)$ à p.</li><li>Interpréter qualitativement la concentration.</li></ol>`,
        {
          enonceHtml: 'Avec n=200, p=0,3, quelle fréquence attendue ?',
          attenduHtml: 'Fréquence attendue = p.',
          correctionHtml: 'Fréquence attendue 0,3.',
        },
        ['Fréquence = probabilité “à coup sûr”.', 'Formulation absolue au lieu de probabiliste.', 'Dispersion mal interprétée.', 'Pas de conclusion contextualisée.']
      ),
    ],
  },
  {
    id: 'D',
    title: 'Algorithmique & Logique',
    description: 'Python pour seuil/simulation et logique de rédaction mathématique.',
    chapters: [
      mkChapter(
        'D1-python',
        'Python : boucles, seuils, simulation',
        'for/while, simulation Bernoulli, seuils algorithmiques.',
        3,
        3,
        ['python', 'seuil', 'simulation'],
        ['calculer', 'modeliser', 'communiquer'],
        `<ul><li>for quand le nombre d’itérations est connu.</li><li>while pour un seuil.</li><li>Simulation Bernoulli via random()&lt;p.</li></ul>`,
        `<ol><li>Initialiser.</li><li>Mettre à jour dans la boucle.</li><li>Tester et conclure.</li></ol>`,
        {
          enonceHtml: 'Plus petit n tel que $0{,}9^{2^n}\\le 0{,}01$.',
          attenduHtml: 'Boucle while et mise à jour n.',
          correctionHtml: 'n=0; while 0.9**(2**n)>0.01: n+=1.',
        },
        ['Variable non initialisée.', 'Boucle infinie.', 'range mal compris.', 'Indentation incorrecte.']
      ),
      mkChapter(
        'D2-logique',
        'Vocabulaire ensembliste & logique',
        'Négation, contraposée, récurrence, contre-exemple.',
        4,
        3,
        ['logique', 'récurrence', 'contraposée'],
        ['raisonner', 'communiquer'],
        `<ul><li>Négation de “pour tout” ↔ “il existe”.</li><li>Contraposée: $\\neg Q\\Rightarrow\\neg P$.</li><li>Récurrence: initialisation + hérédité + conclusion.</li></ul>`,
        `<ol><li>Énoncer P(n).</li><li>Initialisation.</li><li>Hérédité puis conclusion.</li></ol>`,
        {
          enonceHtml: 'Montrer par récurrence: $2^n\\ge n+1$ pour $n\\ge1$.',
          attenduHtml: 'Base + hérédité rigoureuses.',
          correctionHtml: 'Preuve standard par multiplication par 2.',
        },
        ['Hérédité non justifiée.', 'Réciproque/contraposée confondues.', 'Négation incorrecte.', 'Conclusion manquante.']
      ),
    ],
  },
];

export const dailyChallengesTerminale = [
  {
    id: 'dc-deriv-1',
    title: 'Zéro faute de signe (ln)',
    xp: 40,
    prompt: 'Résoudre exactement 2ln(x)+1=0 puis donner le signe sur ]0,+∞[.',
    solution: 'x=e^{-1/2}. Négatif sur ]0,e^{-1/2}[, positif sur ]e^{-1/2},+∞[.',
    tags: ['ln', 'signe'],
  },
  {
    id: 'dc-espace-1',
    title: 'Plan instantané',
    xp: 40,
    prompt: 'Plan passant par A(1,2,0) de normal n(2,-1,3) : donner une équation cartésienne.',
    solution: '2(x-1)-(y-2)+3z=0 ⇔ 2x-y+3z=0.',
    tags: ['espace', 'plan'],
  },
  {
    id: 'dc-tvi-1',
    title: 'TVI express',
    xp: 40,
    prompt: 'Montrer que ln(x)+x-2=0 a une solution sur [1,2] (1 phrase TVI).',
    solution: 'f continue, f(1)<0, f(2)>0 ⇒ TVI ⇒ ∃c∈[1,2], f(c)=0.',
    tags: ['TVI'],
  },
];

export const badgesTerminale = [
  { id: 'b-espace', title: 'Espace Pro', rule: 'Valider 12 exos espace', xp: 200 },
  { id: 'b-tvi', title: 'TVI Master', rule: 'Valider 10 exos TVI/unicité', xp: 150 },
  { id: 'b-binom', title: 'Binomiale Clean', rule: '5 exos binomiale avec justification parfaite', xp: 150 },
  { id: 'b-nosign', title: 'Anti-Signes', rule: '7 jours sans erreur de signe', xp: 250 },
];

export interface BacQuestion {
  id: string;
  texteHtml: string;
  points: number;
  attenduHtml: string;
  methodoHtml: string;
  correctionHtml: string;
  erreursClassiques: string[];
}
export interface BacExercice {
  id: string;
  titre: string;
  theme: string;
  questions: BacQuestion[];
}
export interface BacSujet {
  id: string;
  titre: string;
  dureeMin: 30 | 60 | 120 | 240;
  difficulte: Difficulty;
  tags: string[];
  consignesRedaction: string[];
  exercices: BacExercice[];
  baremeTotal: number;
}

const redacBase = [
  'Domaine écrit',
  'Théorème cité',
  'Équation exacte résolue',
  'Conclusion en français',
  'Arrondi conforme',
];

function q(
  id: string,
  texteHtml: string,
  points: number,
  attenduHtml: string,
  methodoHtml: string,
  correctionHtml: string,
  erreursClassiques: string[]
): BacQuestion {
  return { id, texteHtml, points, attenduHtml, methodoHtml, correctionHtml, erreursClassiques };
}

function miniSujet(
  id: string,
  titre: string,
  dureeMin: 30 | 60,
  difficulte: Difficulty,
  tags: string[],
  ex: BacExercice[],
  baremeTotal: number
): BacSujet {
  return { id, titre, dureeMin, difficulte, tags, consignesRedaction: redacBase, exercices: ex, baremeTotal };
}

export const bacSubjectsTerminale: BacSujet[] = [
  {
    id: 'bac-30-1',
    titre: "Mini Bac 30' — TVI + ln",
    dureeMin: 30,
    difficulte: 3,
    tags: ['TVI', 'ln', 'dichotomie'],
    baremeTotal: 10,
    consignesRedaction: ['Écrire la continuité avant TVI.', 'Justifier l’unicité par monotonie.', 'Donner un encadrement final.'],
    exercices: [
      {
        id: 'ex1',
        titre: 'Existence, unicité, encadrement',
        theme: 'TVI / ln',
        questions: [
          q('q1', 'Soit f(x)=ln(x)+x-2 sur ]0,+∞[. Montrer que f(x)=0 admet une solution sur [1,2].', 3, 'Continuité + signes opposés.', '1) Continuité 2) f(1), f(2) 3) TVI.', 'f continue sur [1,2], f(1)=-1<0, f(2)=ln2>0 => TVI.', ['TVI sans continuité']),
          q('q2', 'Montrer que la solution est unique.', 2, 'Monotonie stricte.', 'Étudier f\'(x)=1/x+1.', 'f\'(x)>0 => unicité.', ['unicité sans monotonie']),
          q('q3', 'Encadrer la solution à 0,1 près.', 5, 'Dichotomie.', 'Tester deux valeurs successives.', 'Ex: c ∈ [1,5 ; 1,6].', ['encadrement trop large']),
        ],
      },
    ],
  },
  {
    id: 'bac-60-1',
    titre: "Mini Bac 60' — Suite récurrente + distance point-plan",
    dureeMin: 60,
    difficulte: 4,
    tags: ['suites', 'point fixe', 'espace', 'distance'],
    baremeTotal: 20,
    consignesRedaction: ['Suite: encadrement + monotonie + point fixe.', 'Distance: valeur absolue obligatoire.'],
    exercices: [
      {
        id: 'ex1',
        titre: 'Suite u_{n+1}=2u_n-u_n^2',
        theme: 'Suites',
        questions: [
          q('q1', 'Montrer que 0≤u_n≤1.', 5, 'Stabilité de [0,1].', 'Récurrence.', 'f([0,1])⊂[0,1], donc par récurrence.', ['stabilité non démontrée']),
          q('q2', 'Montrer que (u_n) est croissante.', 4, 'u_{n+1}-u_n=u_n(1-u_n)≥0.', 'Différence de deux termes.', 'u_{n+1}-u_n≥0.', ['signe erroné']),
          q('q3', 'Déterminer la limite.', 6, 'Point fixe + exclusion.', 'Monotone bornée puis ℓ=f(ℓ).', 'ℓ=1.', ['pas d’exclusion']),
        ],
      },
      {
        id: 'ex2',
        titre: 'Distance',
        theme: 'Espace',
        questions: [
          q('q1', 'P:2x-y+2z-4=0, M(1,0,0). Calculer d(M,P).', 5, 'Formule distance point-plan.', 'Appliquer directement.', 'd=2/3.', ['valeur absolue oubliée']),
        ],
      },
    ],
  },
  {
    id: 'bac-30-2',
    titre: "Mini Bac 30' — Dérivation + tangente",
    dureeMin: 30,
    difficulte: 3,
    tags: ['dérivation', 'tangente', 'ln'],
    baremeTotal: 10,
    consignesRedaction: ['Formule tangente correcte', 'Résolution exacte'],
    exercices: [
      {
        id: 'ex1',
        titre: 'Variations + tangente',
        theme: 'Analyse',
        questions: [
          q('q1', 'Pour f(x)=x^2 ln x, donner les variations.', 6, 'f\'(x)=x(2lnx+1).', 'Tableau de signe.', 'Décroît puis croît avec seuil e^{-1/2}.', ['équation de signe inexacte']),
          q('q2', 'Tangente en a=1.', 4, 'y=f\'(1)(x-1)+f(1).', 'Calculer f(1), f\'(1).', 'Tangente y=x-1.', ['mauvaise formule']),
        ],
      },
    ],
  },
  {
    id: 'bac-60-2',
    titre: "Mini Bac 60' — Paramétrique + intersection droite/plan",
    dureeMin: 60,
    difficulte: 4,
    tags: ['espace', 'paramétrique', 'intersection'],
    baremeTotal: 20,
    consignesRedaction: ['Substitution complète', 'Point final explicite'],
    exercices: [
      {
        id: 'ex1',
        titre: 'Intersection',
        theme: 'Espace',
        questions: [
          q('q1', 'd: x=1+2t,y=-t,z=2+3t ; P:2x-y+3z-6=0. Trouver l’intersection.', 10, 'Substitution puis résolution en t.', 'Remplacer x(t),y(t),z(t).', 't=-1/7, point (5/7,1/7,11/7).', ['point final absent']),
        ],
      },
      {
        id: 'ex2',
        titre: 'Vérification',
        theme: 'Espace',
        questions: [
          q('q1', 'Vérifier la distance du point au plan.', 10, 'Distance = 0.', 'Tester l’appartenance.', 'Le point appartient au plan, distance nulle.', ['vérification oubliée']),
        ],
      },
    ],
  },

  // +2 mini (30/60) to reach 6 mini total
  miniSujet(
    'bac-30-3',
    "Mini Bac 30' — Binomiale",
    30,
    3,
    ['binomiale', 'espérance'],
    [
      {
        id: 'ex1',
        titre: 'Modélisation binomiale',
        theme: 'Probabilités',
        questions: [
          q('q1', 'Justifier que X suit une loi binomiale B(15,0,4).', 4, '3 conditions.', 'Répétition + indépendance + p constant.', 'X~B(15,0,4).', ['justification incomplète']),
          q('q2', 'Calculer P(X=6).', 3, 'Formule binomiale.', 'Appliquer C(15,6)0,4^6 0,6^9.', 'Expression exacte attendue.', ['n-k erroné']),
          q('q3', 'Calculer E(X).', 3, 'np.', '15×0,4.', 'E(X)=6.', ['espérance/probabilité confondues']),
        ],
      },
    ],
    10
  ),
  miniSujet(
    'bac-60-3',
    "Mini Bac 60' — Intégrales + EDO",
    60,
    4,
    ['intégrales', 'EDO'],
    [
      {
        id: 'ex1',
        titre: 'Intégrale',
        theme: 'Analyse',
        questions: [
          q('q1', 'Calculer $\\int_1^3 (2x+1)dx$.', 6, 'Primitive x^2+x.', 'F(3)-F(1).', 'Résultat: 10.', ['bornes inversées']),
          q('q2', 'Interpréter le signe de l’intégrale.', 4, 'Fonction positive.', 'Étudier le signe de 2x+1.', 'Intégrale positive.', ['aire/intégrale confondues']),
        ],
      },
      {
        id: 'ex2',
        titre: 'EDO',
        theme: 'EDO',
        questions: [
          q('q1', 'Résoudre y\'=3y, y(0)=2.', 10, 'y=Ce^{3x}.', 'Condition initiale.', 'y=2e^{3x}.', ['constante oubliée']),
        ],
      },
    ],
    20
  ),

  // 2 medium 120
  {
    id: 'bac-120-1',
    titre: "Sujet Bac 120' — Analyse complète",
    dureeMin: 120,
    difficulte: 4,
    tags: ['limites', 'dérivation', 'TVI', 'ln'],
    consignesRedaction: redacBase,
    baremeTotal: 20,
    exercices: [
      {
        id: 'ex1',
        titre: 'Étude de fonction',
        theme: 'Analyse',
        questions: [
          q('q1', 'Étudier le domaine de f(x)=ln(x)+1/x.', 3, 'x>0.', 'Poser domaine avant tout calcul.', 'Domaine ]0,+∞[.', ['domaine oublié']),
          q('q2', 'Calculer les limites en 0+ et +∞.', 4, '0+: +∞ ; +∞: +∞.', 'Séparer les termes.', 'ln(x)+1/x -> +∞ en 0+, +∞ en +∞.', ['forme indéterminée mal traitée']),
          q('q3', 'Étudier f\'(x) et variations.', 5, 'f\'(x)=1/x-1/x^2=(x-1)/x^2.', 'Signe via (x-1).', 'Décroît puis croît, min en x=1.', ['tableau faux']),
          q('q4', 'Montrer qu’une équation f(x)=2 admet une unique solution.', 4, 'TVI + monotonie sur intervalle adapté.', 'Encadrer + injectivité.', 'Existence et unicité justifiées.', ['TVI incomplet']),
          q('q5', 'Donner une valeur approchée à 10^-2 près.', 4, 'Dichotomie/itérations.', 'Encadrement progressif.', 'Valeur approchée cohérente.', ['arrondi non conforme']),
        ],
      },
    ],
  },
  {
    id: 'bac-120-2',
    titre: "Sujet Bac 120' — Espace & probabilités",
    dureeMin: 120,
    difficulte: 5,
    tags: ['espace', 'distance', 'binomiale', 'variance'],
    consignesRedaction: redacBase,
    baremeTotal: 20,
    exercices: [
      {
        id: 'ex1',
        titre: 'Géométrie dans l’espace',
        theme: 'Espace',
        questions: [
          q('q1', 'Donner une équation du plan passant par A avec normal n.', 4, 'n.AM=0.', 'Développer proprement.', 'Équation cartésienne correcte.', ['normal/directeur confondus']),
          q('q2', 'Intersection d’une droite paramétrique avec ce plan.', 6, 'Substitution.', 'Résoudre t puis point.', 'Point d’intersection trouvé.', ['substitution incomplète']),
          q('q3', 'Distance d’un point au plan.', 4, 'Formule distance.', 'Valeur absolue + norme.', 'Distance exacte.', ['val abs oubliée']),
        ],
      },
      {
        id: 'ex2',
        titre: 'Probabilités',
        theme: 'Binomiale',
        questions: [
          q('q1', 'Justifier X~B(n,p).', 2, '3 conditions.', 'Rédaction.', 'Justification valide.', ['conditions incomplètes']),
          q('q2', 'Calculer P(X≥k).', 2, 'Complément conseillé.', '1-P(X≤k-1).', 'Résultat cohérent.', ['complément oublié']),
          q('q3', 'Calculer E(X) et V(X).', 2, 'np et np(1-p).', 'Formules.', 'Valeurs correctes.', ['formule variance erronée']),
        ],
      },
    ],
  },

  // 2 long 240
  {
    id: 'bac-240-1',
    titre: "Sujet Bac 240' — Simulation complète A",
    dureeMin: 240,
    difficulte: 5,
    tags: ['mix complet', 'bac blanc'],
    consignesRedaction: [...redacBase, 'Présenter les parties numérotées et les transitions.'],
    baremeTotal: 20,
    exercices: [
      {
        id: 'ex1',
        titre: 'Analyse approfondie',
        theme: 'Analyse',
        questions: [
          q('q1', 'Étude complète d’une fonction avec ln et exponentielle.', 7, 'Domaine + limites + variations + convexité.', 'Plan de copie en 4 blocs.', 'Correction détaillée attendue.', ['copie non structurée']),
          q('q2', 'Résolution d’équation par TVI + unicité + dichotomie.', 5, 'TVI + monotonie + encadrement.', 'Rédaction théorème.', 'Encadrement final correct.', ['TVI sans continuité']),
        ],
      },
      {
        id: 'ex2',
        titre: 'Espace',
        theme: 'Géométrie',
        questions: [
          q('q1', 'Droite, plan, distance, orthogonalité.', 4, 'Normal/directeur + produits scalaires.', 'Calculs coordonnés.', 'Résultats géométriques cohérents.', ['erreur de vecteur']),
        ],
      },
      {
        id: 'ex3',
        titre: 'Probabilités',
        theme: 'Binomiale/LGN',
        questions: [
          q('q1', 'Modélisation Bernoulli + calculs + interprétation LGN.', 4, 'n,p, P(X=k), E, V, fréquence.', 'Justification + interprétation.', 'Synthèse rédigée.', ['interprétation faible']),
        ],
      },
    ],
  },
  {
    id: 'bac-240-2',
    titre: "Sujet Bac 240' — Simulation complète B",
    dureeMin: 240,
    difficulte: 5,
    tags: ['mix complet', 'bac blanc'],
    consignesRedaction: [...redacBase, 'Vérifier chaque résultat par substitution/calcul de contrôle.'],
    baremeTotal: 20,
    exercices: [
      {
        id: 'ex1',
        titre: 'Suites + algorithmique',
        theme: 'Suites/Python',
        questions: [
          q('q1', 'Suite récurrente : convergence et limite.', 6, 'Stabilité + monotonie + point fixe.', 'Récurrence structurée.', 'Limite justifiée.', ['point fixe incomplet']),
          q('q2', 'Écrire un algorithme de seuil.', 4, 'while avec condition d’arrêt.', 'Initialisation + update.', 'Pseudo-code correct.', ['boucle infinie']),
        ],
      },
      {
        id: 'ex2',
        titre: 'Trigonométrie + intégrales',
        theme: 'Trigo/Intégral',
        questions: [
          q('q1', 'Résoudre cos(x)=a sur ℝ.', 4, 'Solutions sur [0,2π] + 2kπ.', 'Angles remarquables.', 'Ensemble des solutions complet.', ['+2kπ oublié']),
          q('q2', 'Intégrale avec interprétation géométrique.', 6, 'Primitive + signe.', 'Découpage si besoin.', 'Résultat et interprétation.', ['aire/intégrale confondue']),
        ],
      },
    ],
  },
];
