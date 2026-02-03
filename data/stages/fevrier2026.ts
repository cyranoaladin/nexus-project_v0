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
      'TAD et POO',
      'SQL conception et interrogation',
      'Récursivité',
      'Structures : pile, file, AB/ABR, graphes',
      'Exercices types bac'
    ],
    pallier2: [
      'Tests de maîtrise sur bases',
      'Renforcement sur points faibles uniquement',
      'Approfondissement sur exercices plus fins',
      'Travail spécifique rédaction (important)'
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
    objective: 'Consolider TAD, POO, SQL, structures',
    durationHours: 22,
    groupSizeMax: 6,
    price: 590,
    earlyBirdPrice: 502,
    seatsLeft: 4,
    promise: 'Méthode structurée, exercices types Bac. Pack printemps pour épreuve pratique.',
    detailsAnchor: '#details-nsi-t-p1'
  },
  {
    id: 'nsi-terminale-pallier2',
    title: 'NSI Terminale — Excellence',
    tier: 'pallier2',
    subject: 'nsi',
    level: 'terminale',
    badge: '🚀 INGÉNIEUR',
    objective: 'Maîtrise avancée et trajectoire ingénieur',
    durationHours: 30,
    groupSizeMax: 6,
    price: 990,
    earlyBirdPrice: 842,
    seatsLeft: 3,
    promise: 'Approfondissement, rédaction fine, tests exigeants. Trajectoire prépa/ingénieur.',
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
    objective: 'Web, Python, algorithmique de base',
    durationHours: 22,
    groupSizeMax: 6,
    price: 490,
    earlyBirdPrice: 417,
    seatsLeft: 6,
    promise: 'Web (HTML/CSS), Python, traitement données. Projet fonctionnel.',
    detailsAnchor: '#details-nsi-p-p1'
  },
  {
    id: 'nsi-premiere-pallier2',
    title: 'NSI Première — Excellence',
    tier: 'pallier2',
    subject: 'nsi',
    level: 'premiere',
    badge: '🤖 MAKER AVANCÉ',
    objective: 'Algo avancé, projet web dynamique',
    durationHours: 30,
    groupSizeMax: 6,
    price: 990,
    earlyBirdPrice: 842,
    seatsLeft: 4,
    promise: 'Algo gloutons, Full Stack, architecture. Portfolio Github.',
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
    answer: "Enseignants experts : professeurs agrégés et certifiés, avec expérience du Bac. Pédagogie différenciée, bilans individualisés, suivi personnalisé."
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
    quote: "8 jours qui ont changé mon orientation",
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
    description: '~22h (5h/jour sur 4 jours + révisions + tests)',
    detail: [
      'Lun-Jeu : 5h/jour (théorie + pratique)',
      'Mercredi : révisions dirigées',
      'Jeudi : tests',
      'Samedi : test final + bilan'
    ]
  },
  pallier2: {
    description: '~30h (6h/jour sur 4 jours + exposé + tests)',
    detail: [
      'Lun-Jeu : 6h/jour (théorie + pratique avancée)',
      'Mercredi : exposé + approfondissement',
      'Jeudi : tests de maîtrise',
      'Samedi : test final + bilan individualisé'
    ]
  },
  note: 'Adaptation possible au rythme Ramadan (organisation matin/après-midi).'
};
