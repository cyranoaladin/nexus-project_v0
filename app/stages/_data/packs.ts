export interface Pack {
  id: string;
  badge?: string;
  badgeColor?: string;
  highlight?: boolean;
  icon: string;
  title: string;
  subtitle: string;
  hours: string;
  description: string;
  features: string[];
  price: number;
  earlyBird: number;
  saving: number;
  spots: number;
  perHour: string;
  vsClassic?: string;
  isAddOn?: boolean;
  addOnLabel?: string;
}

export interface Testimonial {
  name: string;
  role: string;
  quote: string;
}

export interface FAQItem {
  question: string;
  answer: string;
}

export interface GrandOralDay {
  day: number;
  title: string;
  description: string;
  skill: string;
  icon: string;
}

export interface PricingRow {
  label: string;
  hours: string;
  earlyBird: number;
  normal: number;
  classic: string;
  popular: boolean;
}

export const PACKS: Pack[] = [
  {
    id: "premiere-combo",
    badge: "🔥 BEST-SELLER",
    badgeColor: "#f59e0b",
    highlight: true,
    icon: "🎯",
    title: 'Pack « Doublé Anticipé »',
    subtitle: "PREMIÈRE — Français + Maths",
    hours: "40h",
    description:
      "Le combo décisif : commentaire, dissertation, simulations orales (20 textes) + automatismes Maths complets.",
    features: [
      "Méthodologie commentaire & dissertation",
      "Simulations orales : les 20 textes du descriptif",
      "Maths : dérivation, probas, suites, automatismes",
      "2 épreuves blanches (1 Français + 1 Maths)",
      "Bilan individualisé + plan de révision final",
    ],
    price: 1100,
    earlyBird: 950,
    saving: 150,
    spots: 4,
    perHour: "~24 TND/h",
    vsClassic: "1 600 TND",
  },
  {
    id: "premiere-francais",
    icon: "📖",
    title: "Français Première",
    subtitle: "PREMIÈRE — Mono-matière",
    hours: "22h",
    description:
      "Méthodologie commentaire & dissertation. Simulations orales intensives sur les 20 textes.",
    features: [
      "Méthodologie commentaire littéraire",
      "Méthodologie dissertation",
      "Simulations orales : 20 textes",
      "Épreuve blanche écrit + correction détaillée",
    ],
    price: 650,
    earlyBird: 550,
    saving: 100,
    spots: 5,
    perHour: "25 TND/h",
    vsClassic: "880 TND",
  },
  {
    id: "premiere-maths",
    icon: "📐",
    title: "Maths Première",
    subtitle: "PREMIÈRE — Mono-matière",
    hours: "22h",
    description:
      "Dérivation, probabilités, suites, automatismes. Méthode rigoureuse et épreuves blanches.",
    features: [
      "Dérivation, probabilités, suites",
      "Méthode et rédaction mathématique",
      "Exercices types épreuves anticipées",
      "Épreuve blanche + bilan individualisé",
    ],
    price: 650,
    earlyBird: 550,
    saving: 100,
    spots: 6,
    perHour: "25 TND/h",
    vsClassic: "880 TND",
  },
  {
    id: "terminale-maths",
    icon: "∫",
    title: "Maths Terminale",
    subtitle: "TERMINALE — Excellence Bac",
    hours: "30h",
    description:
      "Analyse, géométrie dans l'espace, probabilités avancées. 2 épreuves blanches type Bac.",
    features: [
      "Analyse : limites, continuité, intégrales",
      "Géométrie dans l'espace",
      "Probabilités conditionnelles & lois",
      "2 épreuves blanches corrigées",
      "Stratégie de points par chapitre",
    ],
    price: 850,
    earlyBird: 690,
    saving: 160,
    spots: 4,
    perHour: "23 TND/h",
    vsClassic: "1 200 TND",
  },
  {
    id: "terminale-nsi-fullstack",
    badge: "⚡ URGENCE 18 MAI",
    badgeColor: "#ef4444",
    highlight: true,
    icon: "💻",
    title: 'Pack « Full Stack NSI »',
    subtitle: "TERMINALE — Pratique + Écrit + Oral",
    hours: "40h",
    description:
      "30 variantes officielles chrono. Écrit complet. Grand Oral technique inclus.",
    features: [
      "Épreuve pratique : 30 variantes chrono",
      "Écrit : TAD, POO, SQL, récursivité, arbres, graphes",
      "Grand Oral : validation technique du projet",
      "2 simulations conditions réelles",
      "Coaching individuel épreuve pratique",
    ],
    price: 1200,
    earlyBird: 990,
    saving: 210,
    spots: 3,
    perHour: "~25 TND/h",
    vsClassic: "1 600+ TND",
  },
  {
    id: "terminale-nsi-ecrit",
    icon: "🖥️",
    title: "NSI Terminale — Écrit",
    subtitle: "TERMINALE — Mono-matière",
    hours: "22h",
    description:
      "Algorithmique, SQL, arbres, graphes, récursivité. Rédaction rigoureuse.",
    features: [
      "TAD, POO, SQL, récursivité",
      "Structures : arbres, graphes, piles, files",
      "Rédaction algorithmique rigoureuse",
      "Épreuve blanche écrit + correction",
    ],
    price: 650,
    earlyBird: 550,
    saving: 100,
    spots: 5,
    perHour: "25 TND/h",
    vsClassic: "880 TND",
  },
  {
    id: "grand-oral",
    icon: "🎤",
    title: "Pack Grand Oral",
    subtitle: 'TERMINALE — « L\'Art de Convaincre »',
    hours: "10h",
    isAddOn: true,
    description:
      "10h de coaching : pitch, posture, voix, stress, simulations jury.",
    features: [
      "Audit & affinement des deux questions",
      "Storytelling : accroche percutante",
      "Posture, voix, regard, silences stratégiques",
      "Simulations intensives (5'+10'+5')",
      "Anticipation des questions pièges",
    ],
    price: 350,
    earlyBird: 300,
    saving: 50,
    spots: 6,
    perHour: "30 TND/h",
    addOnLabel: "En complément d'un stage : seulement 250 TND",
  },
];

export const TESTIMONIALS: Testimonial[] = [
  {
    name: "Yassine R.",
    role: "Terminale · Grand Oral",
    quote:
      "19/20 au Grand Oral alors que je perdais tous mes moyens en public. Le coaching a tout changé.",
  },
  {
    name: "Lina M.",
    role: "Terminale NSI",
    quote:
      "Le focus épreuve pratique m'a sauvée. Arrivée le jour J en connaissant déjà les pièges.",
  },
  {
    name: "Sarah K.",
    role: "Terminale",
    quote:
      "Une semaine qui a changé mon orientation. Rigueur et bienveillance.",
  },
  {
    name: "Mehdi K.",
    role: "Première Maths",
    quote:
      "J'ai enfin compris la dérivation et les suites. Le cadre exigeant m'a forcé à progresser.",
  },
];

export const FAQS: FAQItem[] = [
  {
    question: "Pourquoi c'est moins cher que les cours à 40 TND/h ?",
    answer:
      "Le format petit groupe (6 max) optimise les coûts. Vous bénéficiez d'agrégés, d'un cadre structuré jour par jour, d'épreuves blanches et de bilans individualisés — à un tarif horaire 35 à 40% inférieur au marché.",
  },
  {
    question: "Pack Combo vs mono-matière : comment choisir ?",
    answer:
      "Le Pack Combo (40h) intègre deux matières avec réduction. Le mono (22-30h) permet de se concentrer sur une seule discipline. Les deux incluent épreuves blanches et bilan.",
  },
  {
    question: "L'épreuve pratique NSI est-elle travaillée ?",
    answer:
      "Oui, c'est la priorité absolue du Pack Full Stack NSI : entraînement chronométré sur les 30 variantes de sujets officiels.",
  },
  {
    question: "Le Grand Oral est-il inclus ?",
    answer:
      "Inclus dans le Pack Full Stack NSI. Pour les autres stages : add-on à 250 TND (300 en solo). Combinaison recommandée.",
  },
  {
    question: "Les stages conviennent aux candidats libres ?",
    answer:
      "Oui. Ils ne passent pas l'épreuve pratique NSI mais bénéficient de tout le programme écrit et du Grand Oral.",
  },
  {
    question: "Comment se déroule une journée type ?",
    answer:
      "Matin (9h-12h30) : cours structuré + exercices. Après-midi (14h-17h30) : consolidation, simulations ou coaching oral. Horaires adaptables.",
  },
];

export const GRAND_ORAL_DAYS: GrandOralDay[] = [
  {
    day: 1,
    title: "Fondations & Angle d'Attaque",
    description:
      "Audit des questions. Construction de l'accroche. Livrable : structure validée + intro percutante.",
    skill: "Hook maîtrisé",
    icon: "🎯",
  },
  {
    day: 2,
    title: "Vulgarisation & Storytelling",
    description:
      "Technique du « Pont » pour Maths/NSI. Script complet sans notes.",
    skill: "Récit fluide",
    icon: "📖",
  },
  {
    day: 3,
    title: "Le Corps-Instrument",
    description:
      "Posture, voix, silences stratégiques. Enregistrement vidéo + débriefing.",
    skill: "Zéro trac",
    icon: "🎭",
  },
  {
    day: 4,
    title: "L'Art du Rebond",
    description:
      "Questions pièges. Humilité intelligente. Défense du projet d'orientation.",
    skill: "Répartie",
    icon: "⚔️",
  },
  {
    day: 5,
    title: "Le Grand Crash-Test",
    description:
      "Passage conditions réelles (20 min). Feedback final + Guide de Survie PDF.",
    skill: "Confiance totale",
    icon: "🏆",
  },
];

export const PRICING_ROWS: PricingRow[] = [
  { label: "Français 1ère", hours: "22h", earlyBird: 550, normal: 650, classic: "880", popular: false },
  { label: "Maths 1ère", hours: "22h", earlyBird: 550, normal: 650, classic: "880", popular: false },
  { label: "Pack Doublé 1ère (Fr+Maths)", hours: "40h", earlyBird: 950, normal: 1100, classic: "1 600", popular: true },
  { label: "Maths Terminale", hours: "30h", earlyBird: 690, normal: 850, classic: "1 200", popular: false },
  { label: "NSI Terminale (écrit)", hours: "22h", earlyBird: 550, normal: 650, classic: "880", popular: false },
  { label: "Pack Full Stack NSI (P+E+O)", hours: "40h", earlyBird: 990, normal: 1200, classic: "1 600+", popular: true },
  { label: "Grand Oral (solo)", hours: "10h", earlyBird: 300, normal: 350, classic: "—", popular: false },
  { label: "Grand Oral (+ stage)", hours: "10h", earlyBird: 250, normal: 300, classic: "—", popular: false },
  { label: "Simulation finale (veille examen)", hours: "1h", earlyBird: 60, normal: 60, classic: "—", popular: false },
];
