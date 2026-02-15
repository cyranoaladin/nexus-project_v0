export type Tier = 'pallier1' | 'pallier2';
export type Subject = 'maths' | 'nsi';
export type Level = 'premiere' | 'terminale';

export interface TierInfo {
  id: Tier;
  title: string;
  subtitle: string;
  description: string;
  bullets: string[];
  publicCible: string[];
}

export interface SubjectTierContent {
  subject: Subject;
  pallier1: string[];
  pallier2: string[];
}

export interface Academy {
  id: string;
  title: string;
  tier: Tier;
  subject: Subject;
  level: Level;
  badge: string;
  objective: string;
  durationHours: number;
  groupSizeMax: number;
  price: number;
  earlyBirdPrice: number;
  seatsLeft: number;
  promise: string;
  detailsAnchor: string;
}

export interface FAQ {
  question: string;
  answer: string;
}

export interface Stat {
  value: string;
  label: string;
}

export interface Testimonial {
  quote: string;
  author: string;
  role: string;
  tags?: string[];
}

export interface Deadlines {
  registrationCloseDate: string;
  earlyBirdEndDate: string;
}

export interface Situation {
  id: string;
  icon: string;
  title: string;
  problem: string;
  question: string;
  solution: string;
  ctaText: string;
  ctaLink: string;
}

export interface DaySchedule {
  id: string;
  day: string;
  date: string;
  pallier1: {
    morning: string[];
    afternoon: string[];
  };
  pallier2: {
    morning: string[];
    afternoon: string[];
  };
  highlight?: boolean;
}

export interface MaterialCategory {
  title: string;
  icon: string;
  items: string[];
  note?: string;
}

export interface SubjectMaterials {
  subject: string;
  icon: string;
  description: string;
  categories: MaterialCategory[];
}

// TIERS (Paliers)
export const tiers: TierInfo[] = [
  {
    id: 'pallier1',
    title: 'Pallier 1 : Prépa Bac / Essentiels',
    subtitle: 'Consolider, corriger, installer des méthodes fiables',
    description: 'Pour consolider les bases, corriger les erreurs récurrentes et installer des méthodes fiables.',
    bullets: [
      'Notions essentielles',
      'Méthode et rédaction',
      'Exercices types Bac',
      'Épreuves blanches + bilan individualisé'
    ],
    publicCible: [
      'Système français (élèves en difficulté)',
      'Système tunisien',
      'Candidats libres'
    ]
  },
  {
    id: 'pallier2',
    title: 'Pallier 2 : Objectif avancé / Excellence',
    subtitle: 'Transformer un bon niveau en maîtrise solide',
    description: 'Pour transformer un bon niveau en maîtrise solide, viser une mention, et préparer la suite.',
    bullets: [
      'Tests de maîtrise',
      'Renforcement ciblé sur points faibles',
      'Approfondissement',
      'Travail fin sur la rédaction'
    ],
    publicCible: [
      'Profils solides',
      'Objectif mention',
      'Prépa / ingénieur'
    ]
  }
];

// SUBJECTS CONTENT (Maths & NSI par pallier)
export const subjectsContent: SubjectTierContent[] = [
  {
    subject: 'maths',
    pallier1: [
      'Analyse & fonctions (méthode + raisonnement)',
      'Suites (maîtrise des techniques + interprétation)',
      'Probabilités (méthode, pièges, rédaction)',
      'Géométrie / espace selon profil',
      'Gestion du temps + rédaction'
    ],
    pallier2: [
      'Tests de maîtrise',
      'Approfondissement ciblé',
      'Exercices plus fins (raisonnement)',
      'Rédaction mathématique'
    ]
  },
  {
    subject: 'nsi',
    pallier1: [
      'TAD (Types Abstraits de Données) et POO',
      'SQL : conception et interrogation de bases de données',
      'Récursivité : maîtrise et applications',
      'Structures de données : pile, file, arbres binaires/ABR, graphes',
      'Exercices types Bac : entraînement méthodique'
    ],
    pallier2: [
      'Tests de maîtrise sur les fondamentaux',
      'Renforcement ciblé sur les points faibles',
      'Approfondissement : exercices avancés et rédaction fine',
      'Exposé de maîtrise : préparation études supérieures (Prépa/Ingénieur)',
      'Travail spécifique sur la rédaction technique'
    ]
  }
];

// ACADEMIES
export const academies: Academy[] = [
  // TERMINALE
  {
    id: 'maths-terminale-pallier1',
    title: 'Maths Terminale — Prépa Bac',
    tier: 'pallier1',
    subject: 'maths',
    level: 'terminale',
    badge: '🎯 ASSURER LE BAC',
    objective: 'Consolider les fondamentaux et sécuriser votre niveau',
    durationHours: 22,
    groupSizeMax: 6,
    price: 590,
    earlyBirdPrice: 502,
    seatsLeft: 5,
    promise: 'Méthode rigoureuse, exercices types Bac, épreuves blanches. Progression mesurée.',
    detailsAnchor: '#details-maths-t-p1'
  },
  {
    id: 'maths-terminale-pallier2',
    title: 'Maths Terminale — Excellence',
    tier: 'pallier2',
    subject: 'maths',
    level: 'terminale',
    badge: '👑 VISER MENTION',
    objective: 'Maîtrise avancée et préparation trajectoire',
    durationHours: 30,
    groupSizeMax: 6,
    price: 990,
    earlyBirdPrice: 842,
    seatsLeft: 3,
    promise: 'Approfondissement, rédaction fine, tests de maîtrise. Cadre exigeant.',
    detailsAnchor: '#details-maths-t-p2'
  },
  {
    id: 'nsi-terminale-pallier1',
    title: 'NSI Terminale — Prépa Bac',
    tier: 'pallier1',
    subject: 'nsi',
    level: 'terminale',
    badge: '💻 FONDAMENTAUX',
    objective: 'Consolider les essentiels : TAD, POO, SQL, structures',
    durationHours: 22,
    groupSizeMax: 6,
    price: 590,
    earlyBirdPrice: 502,
    seatsLeft: 4,
    promise: 'Méthode structurée, exercices types Bac, récursivité maîtrisée. L\'épreuve pratique sera travaillée au printemps.',
    detailsAnchor: '#details-nsi-t-p1'
  },
  {
    id: 'nsi-terminale-pallier2',
    title: 'NSI Terminale — Excellence',
    tier: 'pallier2',
    subject: 'nsi',
    level: 'terminale',
    badge: '🚀 INGÉNIEUR',
    objective: 'Renforcement avancé et préparation études supérieures',
    durationHours: 30,
    groupSizeMax: 6,
    price: 990,
    earlyBirdPrice: 842,
    seatsLeft: 3,
    promise: 'Approfondissement, rédaction fine, exposé de maîtrise. Trajectoire prépa/ingénieur.',
    detailsAnchor: '#details-nsi-t-p2'
  },

  // PREMIERE
  {
    id: 'maths-premiere-pallier1',
    title: 'Maths Première — Prépa Bac',
    tier: 'pallier1',
    subject: 'maths',
    level: 'premiere',
    badge: '📈 BASES SOLIDES',
    objective: 'Consolider dérivation, probas, géométrie',
    durationHours: 22,
    groupSizeMax: 6,
    price: 490,
    earlyBirdPrice: 417,
    seatsLeft: 6,
    promise: 'Dérivation, produit scalaire, probabilités. Méthode et confiance.',
    detailsAnchor: '#details-maths-p-p1'
  },
  {
    id: 'maths-premiere-pallier2',
    title: 'Maths Première — Excellence',
    tier: 'pallier2',
    subject: 'maths',
    level: 'premiere',
    badge: '🚀 TRAJECTOIRE PRÉPA',
    objective: 'Anticipation Terminale et excellence',
    durationHours: 30,
    groupSizeMax: 6,
    price: 990,
    earlyBirdPrice: 842,
    seatsLeft: 4,
    promise: 'Anticipation suites & limites, problèmes ouverts. Trajectoire prépa.',
    detailsAnchor: '#details-maths-p-p2'
  },
  {
    id: 'nsi-premiere-pallier1',
    title: 'NSI Première — Prépa Bac',
    tier: 'pallier1',
    subject: 'nsi',
    level: 'premiere',
    badge: '🌐 CODING STARTER',
    objective: 'Consolider Web, Python, algorithmique de base',
    durationHours: 22,
    groupSizeMax: 6,
    price: 490,
    earlyBirdPrice: 417,
    seatsLeft: 6,
    promise: 'Web (HTML/CSS), Python fondamental, traitement de données. Méthode structurée et projet fonctionnel.',
    detailsAnchor: '#details-nsi-p-p1'
  },
  {
    id: 'nsi-premiere-pallier2',
    title: 'NSI Première — Excellence',
    tier: 'pallier2',
    subject: 'nsi',
    level: 'premiere',
    badge: '🤖 MAKER AVANCÉ',
    objective: 'Renforcement avancé : algo, architecture, projet',
    durationHours: 30,
    groupSizeMax: 6,
    price: 990,
    earlyBirdPrice: 842,
    seatsLeft: 4,
    promise: 'Algo gloutons, Full Stack, architecture logicielle. Exposé de maîtrise et portfolio Github.',
    detailsAnchor: '#details-nsi-p-p2'
  }
];

// FAQ
export const faq: FAQ[] = [
  {
    question: "À qui s'adressent ces stages ?",
    answer: "Aux élèves de Première et Terminale (système français, tunisien, candidats libres) qui souhaitent consolider leurs acquis, combler des lacunes ou viser une mention. Deux paliers : Prépa Bac pour sécuriser, Excellence pour approfondir."
  },
  {
    question: "Pourquoi proposer un stage en février ?",
    answer: "Février est un moment clé : c'est là que se jouent la dynamique de fin d'année, la confiance et la maîtrise avant la dernière ligne droite des dossiers d'admission et du Bac. Une semaine structurée permet de transformer le travail en points décisifs."
  },
  {
    question: "Quels sont les objectifs pédagogiques ?",
    answer: "Pallier 1 : consolider les bases, corriger les erreurs récurrentes, installer des méthodes fiables. Pallier 2 : transformer un bon niveau en maîtrise solide, viser une mention, préparer la suite (prépa/ingénieur). Cadre exigeant, bilans individualisés, épreuves blanches."
  },
  {
    question: "Comment choisir entre le Pallier 1 et le Pallier 2 ?",
    answer: "Le choix du pallier dépend avant tout du niveau actuel de l'élève, de sa régularité de travail et de ses objectifs. Le Pallier 1 s'adresse aux élèves qui souhaitent consolider les bases, corriger leurs erreurs récurrentes et sécuriser le baccalauréat. Il convient particulièrement aux élèves en difficulté, aux profils fragiles et aux candidats libres. Le Pallier 2 s'adresse aux élèves déjà solides, qui maîtrisent l'essentiel du programme et souhaitent approfondir, viser une meilleure mention et préparer la suite de leur parcours (prépa, études scientifiques, ingénierie). En cas de doute, une consultation gratuite permet d'analyser la situation de l'élève et de recommander le pallier le plus adapté."
  },
  {
    question: "Les stages garantissent-ils des résultats ?",
    answer: "Les résultats dépendent du travail personnel et de l'implication de chacun. Nous observons en moyenne une progression de 4,2 points, mais chaque trajectoire est unique. Notre engagement : cadre structuré, méthode rigoureuse, bilan individualisé."
  },
  {
    question: "Quel est le rythme pendant la semaine ?",
    answer: "Pallier 1 : ~22h (5h/jour sur 4 jours + révisions + tests). Pallier 2 : ~30h (6h/jour sur 4 jours + exposé + tests). Adaptation possible au rythme Ramadan (organisation matin/après-midi). Groupes de 6 élèves maximum."
  },
  {
    question: "Qui encadre les stages ?",
    answer: "Enseignants experts : professeurs Agrégés et Certifiés, avec expérience du Bac. Pédagogie différenciée, bilans individualisés, suivi personnalisé."
  },
  {
    question: "Candidats libres : comment cela se passe ?",
    answer: "Nous accueillons les candidats libres. Important : vous ne passez pas l'épreuve pratique (NSI). Le stage se concentre sur les fondamentaux et l'écrit. Bilan individualisé en fin de stage avec plan de travail autonome."
  },
  {
    question: "Épreuve pratique & Grand Oral : quand les travailler ?",
    answer: "L'épreuve pratique (NSI) et le Grand Oral ne sont pas au centre du stage de février. Ils seront travaillés spécifiquement lors des vacances de printemps via un pack dédié. Février = fondamentaux + méthode + confiance."
  }
];

// STATS
export const stats: Stat[] = [
  { value: '98%', label: 'de satisfaction' },
  { value: '+4,2 pts', label: 'de progression moyenne' },
  { value: '150+', label: 'mentions TB obtenues' }
];

// TESTIMONIALS
export const testimonials: Testimonial[] = [
  {
    quote: "Une semaine qui a changé mon orientation",
    author: "Sarah",
    role: "Terminale",
    tags: ['NSI', 'Pallier 2']
  },
  {
    quote: "J'ai enfin compris la dérivation et les suites. Le cadre exigeant m'a forcé à progresser.",
    author: "Mehdi K.",
    role: "Première Maths",
    tags: ['Maths', 'Pallier 1']
  },
  {
    quote: "Le module Excellence m'a préparé à Louis-le-Grand. J'ai eu ma mention TB.",
    author: "Thomas L.",
    role: "Terminale Maths",
    tags: ['Maths', 'Pallier 2', 'Mention TB']
  }
];

// DEADLINES
export const deadlines: Deadlines = {
  registrationCloseDate: '2026-02-10',
  earlyBirdEndDate: '2026-02-05'
};

// TIMELINE
export const timeline = [
  {
    title: '16–26 février : accélérateur',
    description: 'Vos notes de février fixent votre moyenne du 2ᵉ trimestre. Cette moyenne détermine votre mention potentielle et vos appréciations.'
  },
  {
    title: 'Fin février : conseils de classe',
    description: 'Vos moyennes sont figées. Les professeurs établissent les prévisions de mention. Trop tard pour rattraper.'
  },
  {
    title: 'Mars–Avril : dossiers & sélections',
    description: 'Vos bulletins de février sont examinés par les jurys. Mars : TESCIA. Avril : dossiers finalisés.'
  }
];

// HOURS SCHEDULE
export const hoursSchedule = {
  pallier1: {
    description: '~22h sur une semaine structurée',
    detail: [
      'Lundi-Mardi : Cours (théorie + pratique)',
      'Mercredi : Travail personnel ou soutien individualisé',
      'Jeudi-Vendredi : Cours (consolidation + exercices)',
      'Samedi : Test général + bilan individualisé'
    ]
  },
  pallier2: {
    description: '~30h sur une semaine intensive',
    detail: [
      'Lundi-Mardi : Cours (théorie + pratique avancée)',
      'Mercredi : Exposé de maîtrise + approfondissement',
      'Jeudi-Vendredi : Cours (exercices avancés + rédaction fine)',
      'Samedi : Test général + bilan individualisé'
    ]
  },
  note: 'Adaptation possible au rythme Ramadan (organisation matin/après-midi).'
};

// SITUATIONS
export const situations: Situation[] = [
  {
    id: 'struggling',
    icon: '📉',
    title: 'Note 9-12/20',
    problem: 'Votre enfant oscille entre 9 et 12/20. Les bases sont fragiles, les erreurs se répètent, et la confiance s\'érode.',
    question: 'Mon enfant a un niveau faible, est-ce adapté ?',
    solution: 'Le Pallier 1 (Prépa Bac) est conçu pour cela : consolider les fondamentaux, corriger les erreurs récurrentes, installer des méthodes fiables. Petits groupes (6 max), bilan individualisé, épreuves blanches.',
    ctaText: 'Voir Pallier 1',
    ctaLink: '#academies'
  },
  {
    id: 'excellence',
    icon: '🎯',
    title: 'Objectif Mention TB',
    problem: 'Votre enfant a entre 14 et 16/20. Il/elle maîtrise l\'essentiel mais manque de finesse pour viser la mention TB et préparer la suite (prépa, ingénieur).',
    question: 'Comment passer de "bon" à "excellent" ?',
    solution: 'Le Pallier 2 (Excellence) transforme un bon niveau en maîtrise solide : tests de maîtrise, approfondissement ciblé, rédaction fine, exposé de maîtrise. Cadre exigeant pour trajectoire prépa/ingénieur.',
    ctaText: 'Voir Pallier 2',
    ctaLink: '#academies'
  },
  {
    id: 'nsi-practical',
    icon: '💻',
    title: 'Épreuve pratique NSI',
    problem: 'L\'épreuve pratique NSI approche et votre enfant manque de confiance sur la programmation en temps limité.',
    question: 'L\'épreuve pratique sera-t-elle travaillée en février ?',
    solution: 'Non. Février = fondamentaux + méthode + confiance. L\'épreuve pratique sera travaillée spécifiquement au printemps via un pack dédié. Février prépare le terrain solide pour réussir ensuite.',
    ctaText: 'Voir NSI Février',
    ctaLink: '#academies'
  }
];

// DETAILED SCHEDULE
export const detailedSchedule: DaySchedule[] = [
  {
    id: 'monday',
    day: 'Lundi 16 février',
    date: 'Jour 1 — Lancement',
    pallier1: {
      morning: [
        'Accueil et diagnostic de niveau',
        'Cours magistral : notions essentielles (théorie)',
        'Méthode et structuration du raisonnement'
      ],
      afternoon: [
        'Exercices d\'application guidés',
        'Correction collective et analyse des erreurs',
        'Synthèse du jour + plan de travail personnel'
      ]
    },
    pallier2: {
      morning: [
        'Test de maîtrise initial (diagnostic précis)',
        'Cours avancé : rappels rapides + approfondissement',
        'Identification des points faibles individuels'
      ],
      afternoon: [
        'Exercices avancés avec rédaction fine',
        'Correction exigeante et feedback personnalisé',
        'Travail autonome guidé + synthèse'
      ]
    }
  },
  {
    id: 'tuesday',
    day: 'Mardi 17 février',
    date: 'Jour 2 — Consolidation',
    pallier1: {
      morning: [
        'Cours : suite du programme (théorie + méthode)',
        'Exercices types Bac (difficulté progressive)',
        'Gestion du temps et organisation'
      ],
      afternoon: [
        'Pratique intensive : exercices encadrés',
        'Correction détaillée avec méthode explicite',
        'Bilan intermédiaire individuel (5-10 min/élève)'
      ]
    },
    pallier2: {
      morning: [
        'Cours avancé : notions complexes',
        'Exercices de raisonnement et démonstration',
        'Techniques de rédaction mathématique/technique'
      ],
      afternoon: [
        'Problèmes ouverts et situations nouvelles',
        'Correction exigeante + analyse fine',
        'Travail personnel dirigé sur points faibles'
      ]
    }
  },
  {
    id: 'wednesday',
    day: 'Mercredi 18 février',
    date: 'Jour 3 — Autonomie & Soutien',
    pallier1: {
      morning: [
        'Travail personnel guidé (révisions ciblées)',
        'Soutien individualisé (selon besoins identifiés)',
        'Exercices de remédiation ou d\'approfondissement'
      ],
      afternoon: [
        'Exercices en autonomie supervisée',
        'Feedback individuel sur progression',
        'Repos ou révision légère (selon rythme Ramadan)'
      ]
    },
    pallier2: {
      morning: [
        'Exposé de maîtrise (NSI) : préparation individuelle',
        'Approfondissement thématique avancé',
        'Travail personnel sur projet ou exercices complexes'
      ],
      afternoon: [
        'Soutien ciblé sur difficultés identifiées',
        'Rédaction fine : correction de copies',
        'Préparation tests de fin de semaine'
      ]
    },
    highlight: true
  },
  {
    id: 'thursday',
    day: 'Jeudi 19 février',
    date: 'Jour 4 — Approfondissement',
    pallier1: {
      morning: [
        'Cours : fin du programme + révisions transversales',
        'Exercices types Bac (sujets complets)',
        'Méthode de relecture et vérification'
      ],
      afternoon: [
        'Épreuve blanche partielle (2h)',
        'Correction immédiate et analyse des copies',
        'Travail ciblé sur erreurs récurrentes'
      ]
    },
    pallier2: {
      morning: [
        'Cours avancé : sujets difficiles et pièges',
        'Exercices exigeants (niveau prépa/concours)',
        'Rédaction mathématique/technique professionnelle'
      ],
      afternoon: [
        'Problèmes ouverts et créativité mathématique',
        'Correction exigeante avec notation stricte',
        'Feedback personnalisé sur progression'
      ]
    }
  },
  {
    id: 'friday',
    day: 'Vendredi 20 février',
    date: 'Jour 5 — Consolidation finale',
    pallier1: {
      morning: [
        'Révisions guidées : synthèse de la semaine',
        'Exercices de confiance (réussite garantie)',
        'Préparation mentale au test général'
      ],
      afternoon: [
        'Derniers points de méthode',
        'Questions/réponses individualisées',
        'Briefing avant test du samedi'
      ]
    },
    pallier2: {
      morning: [
        'Synthèse avancée : consolidation des acquis',
        'Exercices de synthèse (plusieurs chapitres)',
        'Rédaction finale et perfectionnement'
      ],
      afternoon: [
        'Préparation intensive au test général',
        'Stratégie d\'examen et gestion du stress',
        'Derniers ajustements personnalisés'
      ]
    }
  },
  {
    id: 'saturday',
    day: 'Samedi 21 février',
    date: 'Jour 6 — Évaluation finale',
    pallier1: {
      morning: [
        'Test général type Bac (3h)',
        'Conditions réelles d\'examen',
        'Notation stricte et professionnelle'
      ],
      afternoon: [
        'Correction collective du test',
        'Bilan individualisé (20 min/élève)',
        'Plan de travail personnalisé jusqu\'au Bac'
      ]
    },
    pallier2: {
      morning: [
        'Test général exigeant (3h30)',
        'Conditions d\'examen avec niveau élevé',
        'Évaluation stricte (critères prépa/concours)'
      ],
      afternoon: [
        'Correction détaillée et analyse fine',
        'Bilan individualisé approfondi (30 min/élève)',
        'Trajectoire personnalisée vers l\'excellence'
      ]
    },
    highlight: true
  }
];

// REQUIRED MATERIALS
export const requiredMaterials: SubjectMaterials[] = [
  {
    subject: 'Mathématiques',
    icon: '📊',
    description: 'Matériel de base + environnement Python',
    categories: [
      {
        title: 'Matériel de base',
        icon: '📝',
        items: [
          'Calculatrice scientifique (TI-83/84, Casio Graph ou NumWorks)',
          'Trousse complète (stylos, crayons, gomme, règle, équerre, compas)',
          'Cahier A4 ou classeur avec feuilles',
          'Copies doubles pour les épreuves blanches'
        ]
      },
      {
        title: 'Environnement Python pour Maths',
        icon: '🐍',
        items: [
          'Python 3.10+ installé (Anaconda ou Python.org)',
          'SymPy (calcul symbolique : dérivées, limites, intégrales)',
          'NumPy (calcul numérique et matrices)',
          'Matplotlib (tracé de courbes et visualisation)',
          'Jupyter Notebook ou IDE (VS Code, PyCharm, Thonny)'
        ],
        note: 'Installation guidée le premier jour si besoin. Nous fournirons un guide PDF avant le stage.'
      },
      {
        title: 'Facultatif mais recommandé',
        icon: '💡',
        items: [
          'Ordinateur portable (pour utiliser Python pendant le stage)',
          'Formulaire personnel de révision (sera complété pendant le stage)',
          'Anciennes copies corrigées (pour identifier les erreurs récurrentes)'
        ]
      }
    ]
  },
  {
    subject: 'NSI',
    icon: '💻',
    description: 'Setup technique complet',
    categories: [
      {
        title: 'Matériel obligatoire',
        icon: '🖥️',
        items: [
          'Ordinateur portable (Windows, macOS ou Linux)',
          'Souris (recommandée pour coder confortablement)',
          'Cahier ou bloc-notes pour algorithmes et schémas',
          'Copies doubles pour l\'épreuve écrite'
        ]
      },
      {
        title: 'Stack Python NSI',
        icon: '🐍',
        items: [
          'Python 3.10+ (installation standard)',
          'IDE : VS Code, PyCharm ou Thonny',
          'Extensions : Python, Pylint, autopep8',
          'SQLite3 (inclus avec Python)',
          'Bibliothèques : random, time, math, collections (standard library)'
        ],
        note: 'Vérification et installation guidée le jour 1. Un tutoriel vidéo sera envoyé 48h avant le stage.'
      },
      {
        title: 'Stack Web (Première uniquement)',
        icon: '🌐',
        items: [
          'Navigateur moderne (Chrome, Firefox ou Edge)',
          'VS Code avec extensions : Live Server, HTML CSS Support',
          'Notions de base HTML/CSS (seront consolidées pendant le stage)'
        ]
      },
      {
        title: 'Optionnel avancé (Pallier 2)',
        icon: '🚀',
        items: [
          'Git + compte GitHub (pour portfolio)',
          'Flask (framework web Python, installation guidée)',
          'Postman ou équivalent (test API)',
          'Notion ou Obsidian (prise de notes structurée)'
        ]
      }
    ]
  }
];
