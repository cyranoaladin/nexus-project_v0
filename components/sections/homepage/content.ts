/* ─────────────────────────────────────────────────────────────────────────────
   Homepage content — single source of truth for all landing page data.
   Edit values here; components consume them.
   ───────────────────────────────────────────────────────────────────────────── */

// ── Business model (internal — never displayed to clients) ──────────────────
//
// Standard group = 4 élèves.
// Teacher cost ≈ 100 DT / h → 200 DT / session of 2 h.
//
// Pricing per student (group of 4):
//   Déclic   4 h → 180 DT  → 90.0 DT / session → group revenue 360 DT → margin 160 DT / session
//   Méthode  8 h → 340 DT  → 85.0 DT / session → group revenue 1360 DT → margin 560 DT total
//   Intensif 12 h → 495 DT → 82.5 DT / session → group revenue 1980 DT → margin 780 DT total
//   Excellence 16 h → 640 DT → 80.0 DT / session → group revenue 2560 DT → margin 960 DT total
//   Select   2 h → 120 DT  → group revenue 480 DT → margin 280 DT / session (premium)
//
// Volume discount logic: higher volume → lower per-session rate → higher total margin.
// Do NOT display margin details publicly.
// ─────────────────────────────────────────────────────────────────────────────

// ── URLs & contact ──────────────────────────────────────────────────────────

export const STAGES_URL = "/stages";
export const EAF_URL = "https://eaf.nexusreussite.academy";

// WhatsApp variants — contextual pre-filled messages
export const WHATSAPP_URL =
  "https://wa.me/21699192829?text=Bonjour%2C%20je%20souhaite%20recevoir%20les%20informations%20sur%20les%20offres%20Nexus%20R%C3%A9ussite.%20Mon%20enfant%20est%20en%20%5Bclasse%5D%20et%20je%20souhaite%20%C3%AAtre%20conseill%C3%A9%20sur%20la%20formule%20la%20plus%20adapt%C3%A9e.";
export const WHATSAPP_URL_FINISH =
  "https://wa.me/21699192829?text=Bonjour%2C%20je%20souhaite%20des%20informations%20sur%20le%20Pack%20Premi%C3%A8re%20%E2%80%94%20Finish%208%20juin.%20Mon%20enfant%20est%20en%20Premi%C3%A8re.";
export const WHATSAPP_URL_SELECT =
  "https://wa.me/21699192829?text=Bonjour%2C%20je%20souhaite%20des%20informations%20sur%20les%20stages%20Nexus%20Select%20post-%C3%A9preuves%20et%20les%20groupes%20de%20math%C3%A9matiques.";
export const WHATSAPP_URL_FORFAITS =
  "https://wa.me/21699192829?text=Bonjour%2C%20je%20souhaite%20conna%C3%AEtre%20les%20forfaits%20Nexus%20R%C3%A9ussite%20adapt%C3%A9s%20au%20profil%20de%20mon%20enfant.";

export const PHONE_URL = "tel:+21699192829";
export const PHONE_LABEL = "+216 99 19 28 29";
export const CONTACT_EMAIL = "contact@nexusreussite.academy";
export const CONTACT_ADDRESS = "Mutuelleville, Tunis";

// ── Landing images (centralized paths & alt texts) ──────────────────────────

export const LANDING_IMAGES = {
  hero: {
    src: "/images/hero-study-session.webp",
    alt: "Élèves accompagnés par un enseignant dans un cadre de travail premium Nexus Réussite.",
  },
  finish: {
    src: "/images/finish-8-juin.webp",
    alt: "Séance de révision intensive avant les échéances de juin.",
  },
  premiereFinish: {
    src: "/images/premiere-finish-pack.webp",
    alt: "Accompagnement ciblé avec livret de révision et correction personnalisée.",
  },
  select: {
    src: "/images/nexus-select.webp",
    alt: "Groupe d'élèves travaillant des mathématiques exigeantes avec un enseignant.",
  },
  selectGroups: {
    src: "/images/select-groups.webp",
    alt: "Parcours de groupes de niveau en mathématiques Nexus Select.",
  },
  personalizedSupport: {
    src: "/images/accompagnement-personnalise.webp",
    alt: "Suivi individualisé avec livret de travail et tableau de progression.",
  },
  platform: {
    src: "/images/plateforme-eleve-parent.webp",
    alt: "Plateforme élève-parent avec tableau de progression et objectifs de travail.",
  },
  value: {
    src: "/images/bilans-livrets-personnalises.webp",
    alt: "Bilan personnalisé, livret de travail et suivi de progression élève-parent.",
  },
  forfaits: {
    src: "/images/forfaits-formules.webp",
    alt: "Forfaits Nexus Réussite organisés par objectifs et volume horaire.",
  },
  finalCta: {
    src: "/images/cta-final-whatsapp.webp",
    alt: "Échange personnalisé pour choisir la formule Nexus Réussite adaptée à l'élève.",
  },
} as const;

// ── Key dates ───────────────────────────────────────────────────────────────

export const EAF_EXAM_DATE = new Date("2026-06-08T08:00:00");

// ── Pricing footnote (shared across all pricing sections) ───────────────────

export const PRICING_FOOTNOTE =
  "*Tarifs indiqués par élève, pour un groupe de 4 élèves. Les cours individuels, binômes, groupes réduits et accompagnements sur mesure font l'objet d'un tarif spécifique.";

export const PRICING_GROUP_NOTE =
  "Le format en groupe de 4 élèves permet de maintenir un tarif accessible tout en garantissant des corrections individualisées et un suivi précis de chaque élève.";

// ── Hero ────────────────────────────────────────────────────────────────────

export const HERO = {
  badge: "Centre d'entraînement académique · Mutuelleville",
  title: "Le finish avant les épreuves, l'avance pour la suite.",
  subtitle:
    "À Mutuelleville, Nexus Réussite accompagne les élèves de Première et de Terminale avec des stages intensifs, des groupes de niveau, des cours hebdomadaires, des bilans personnalisés et un suivi structuré pour progresser avec méthode, rigueur et confiance.",
  transition:
    "Deux temps forts : finaliser l'année avec méthode, puis préparer l'entrée dans un niveau d'exigence supérieur.",
  chips: [
    "Finish avant le 8 juin",
    "Nexus Select post-épreuves",
    "Groupes de 4 élèves",
    "Bilans personnalisés",
    "Mutuelleville",
  ],
  ctaPrimary: "Réserver une place sur WhatsApp",
  ctaSecondary: "Voir les offres",
};

// ── Urgency block — 8 juin ──────────────────────────────────────────────────

export const URGENCY = {
  eyebrow: "Échéances de juin 2026",
  title: "Dernière ligne droite avant les échéances du 8 juin",
  description:
    "Les dernières semaines ne servent pas à tout refaire. Elles servent à cibler les priorités, corriger les erreurs récurrentes, consolider les méthodes et s'entraîner dans les conditions de l'épreuve.",
  bullets: [
    "Sujets types et entraînement guidé",
    "Automatismes essentiels",
    "Rédaction rigoureuse",
    "Gestion du temps en conditions réelles",
    "Correction des erreurs fréquentes",
    "Fiches de méthode ciblées",
    "Bilan rapide des priorités",
    "Priorisation des chapitres à fort rendement",
  ],
};

// ── Offre Première Finish 8 juin ────────────────────────────────────────────

export const PREMIERE_FINISH = {
  eyebrow: "Offre Première",
  title: "Pack Première — Finish 8 juin",
  subtitle:
    "Arriver aux échéances de juin avec des méthodes plus claires, des automatismes consolidés et une meilleure maîtrise des attendus en français et en mathématiques.",
  audience:
    "Pour les élèves de Première : dernière ligne droite avant les épreuves et évaluations de juin, avec un travail ciblé en français et en mathématiques.",
  formulas: [
    {
      name: "Déclic",
      hours: "4 h",
      sessions: "2 séances de 2 h",
      price: "180 DT*",
      // 90 DT / session / student → group 360 DT − 200 DT teacher = 160 DT margin / session
      description:
        "Pour cibler rapidement les principales difficultés et corriger les erreurs prioritaires avant les épreuves.",
      features: [
        "Diagnostic express des lacunes",
        "Ciblage des difficultés prioritaires",
        "Correction guidée",
        "Recommandations de travail",
      ],
    },
    {
      name: "Méthode",
      hours: "8 h",
      sessions: "4 séances de 2 h",
      price: "340 DT*",
      // 85 DT / session / student → group 1360 DT − 800 DT teacher = 560 DT total margin
      description:
        "Pour consolider les chapitres clés et s'entraîner sur des sujets types avec correction détaillée et suivi des erreurs.",
      features: [
        "Bilan initial",
        "Entraînement sur sujets types",
        "Fiches de méthode",
        "Corrections individualisées",
        "Mini-bilan de fin de parcours",
      ],
      highlighted: true,
    },
    {
      name: "Intensif",
      hours: "12 h",
      sessions: "6 séances de 2 h",
      price: "495 DT*",
      // 82.5 DT / session / student → group 1980 DT − 1200 DT teacher = 780 DT total margin
      description:
        "Accompagnement complet de fin d'année avec bilan initial, entraînements, corrections détaillées, livret personnalisé et plan de révision.",
      features: [
        "Bilan initial personnalisé",
        "Séances structurées et progressives",
        "Sujets types et épreuves blanches",
        "Corrections individualisées",
        "Livret personnalisé de travail",
        "Plan de révision final",
      ],
    },
  ],
  ctaLabel: "Réserver un pack Finish",
  priceNote: PRICING_FOOTNOTE,
};

// ── Nexus Select — post-épreuves ────────────────────────────────────────────

export const NEXUS_SELECT = {
  eyebrow: "Nexus Select",
  title: "Stages intensifs post-épreuves",
  headline:
    "Après les épreuves, le travail change de nature : il ne s'agit plus seulement de réviser, mais de préparer le niveau supérieur.",
  description:
    "Nexus Select prépare les élèves ambitieux à l'entrée dans un environnement beaucoup plus exigeant. Une transition progressive vers les attentes du supérieur, en mathématiques et au-delà.",
  disclaimer:
    "Nexus Select n'est pas une aide au dossier Parcoursup : c'est une préparation au niveau attendu après l'admission.",
  audience: [
    "Élèves visant CPGE scientifiques",
    "Doubles licences maths-info",
    "EPFL et écoles polytechniques",
    "Écoles d'ingénieurs sélectives",
    "Parcours universitaires scientifiques exigeants",
  ],
  objectives: [
    "Reprendre les bases importantes avec rigueur",
    "Renforcer la rédaction mathématique",
    "Travailler des exercices plus longs et progressifs",
    "Apprendre à chercher et structurer un raisonnement",
    "S'habituer à un rythme de travail soutenu",
    "Combler l'écart avec les lycées très sélectifs",
  ],
  pricing: {
    label: "À partir de 120 DT* / séance de 2 h",
    // 120 DT / student → group 480 DT − 200 DT teacher = 280 DT margin / session (premium)
    note: "*Tarif par élève, en groupe Select de 4 élèves maximum. Forfait communiqué selon le groupe, le niveau et le volume horaire.",
  },
  features: [
    "Positionnement initial obligatoire",
    "Groupe de niveau (4 élèves max)",
    "Exercices avancés et progressifs",
    "Rédaction mathématique exigeante",
    "Livret Select personnalisé",
    "Bilan de progression",
    "Transition vers les exigences du supérieur",
  ],
  groups: [
    {
      name: "Consolidation sélective",
      level: "Groupe 1",
      description:
        "Pour les élèves qui ont un niveau correct mais qui doivent solidifier les bases avant d'aller plus loin.",
      tags: ["Bases solides", "Progression méthodique"],
    },
    {
      name: "Prépa scientifique",
      level: "Groupe 2",
      description:
        "Pour les élèves visant CPGE, écoles d'ingénieurs, doubles licences ou parcours scientifiques exigeants.",
      tags: ["CPGE", "Écoles d'ingénieurs", "Doubles licences"],
    },
    {
      name: "Maths avancées",
      level: "Groupe 3",
      description:
        "Pour les élèves déjà solides souhaitant travailler des raisonnements plus ambitieux, des exercices longs et une rédaction plus exigeante.",
      tags: ["Raisonnement avancé", "Rédaction exigeante"],
    },
    {
      name: "Excellence & transition supérieur",
      level: "Groupe 4",
      description:
        "Pour les élèves très motivés souhaitant se confronter à des méthodes proches du supérieur, sans prétendre reproduire un programme officiel de CPGE.",
      tags: ["Transition supérieur", "Exigence maximale"],
    },
  ],
  ctaLabel: "Demander le positionnement Select",
  groupsNote:
    "Effectifs limités par groupe. Positionnement possible après entretien ou évaluation.",
};

// ── Nos accompagnements ─────────────────────────────────────────────────────

export const ACCOMPAGNEMENTS_INTRO =
  "Chez Nexus Réussite, les familles ne réservent pas seulement des heures de cours : elles choisissent un cadre de travail, un suivi lisible et une progression structurée.";

export const ACCOMPAGNEMENTS = [
  {
    icon: "calendar",
    title: "Cours hebdomadaires",
    description:
      "Un rythme régulier toute l'année pour consolider les chapitres, structurer le travail et suivre la progression avec bilans et retours aux familles.",
    bullets: ["Suivi régulier", "Devoirs encadrés", "Bilans personnalisés", "Lien avec les parents"],
  },
  {
    icon: "zap",
    title: "Stages intensifs",
    description:
      "Pendant les vacances ou avant les épreuves : un rythme soutenu, un entraînement ciblé, des corrections individualisées et un livret de travail.",
    bullets: ["Vacances scolaires", "Pré-épreuves", "Groupes limités", "Livret de travail"],
  },
  {
    icon: "graduation",
    title: "Préparation aux examens",
    description:
      "EAF, mathématiques, NSI, oraux : méthode, gestion du temps, sujets types, épreuves blanches et corrections détaillées.",
    bullets: ["EAF écrit & oral", "Mathématiques", "NSI", "Épreuves blanches"],
  },
  {
    icon: "target",
    title: "Accompagnement personnalisé",
    description:
      "Bilan initial, objectifs définis, plan de travail structuré, suivi individuel, livret personnalisé et communication structurée avec les familles.",
    bullets: ["Bilan initial", "Plan de travail", "Livret personnalisé", "Suivi famille"],
  },
  {
    icon: "trophy",
    title: "Nexus Select",
    description:
      "Pour les élèves ambitieux visant des parcours sélectifs : mathématiques exigeantes, groupes de niveau, livret Select et transition vers le supérieur.",
    bullets: ["Niveau avancé", "Filières sélectives", "Groupes de niveau", "Livret Select"],
  },
];

// ── Forfaits ────────────────────────────────────────────────────────────────

export const FORFAITS = {
  eyebrow: "Forfaits et formules",
  title: "Des formules claires, adaptées à chaque objectif.",
  description:
    "Chaque forfait est conçu autour d'un volume horaire et d'un objectif précis. Les forfaits incluent un accompagnement structuré, des corrections individualisées et un suivi de progression.",
  plans: [
    {
      name: "Déclic",
      hours: "4 h",
      sessions: "2 séances de 2 h",
      price: "180 DT*",
      tagline: "Pour débloquer une difficulté urgente.",
      // 90 DT / session / student
      features: [
        "Diagnostic express",
        "Ciblage des difficultés prioritaires",
        "Correction guidée",
        "Recommandations de travail",
      ],
      highlighted: false,
      badge: null as string | null,
    },
    {
      name: "Méthode",
      hours: "8 h",
      sessions: "4 séances de 2 h",
      price: "340 DT*",
      tagline: "Pour remettre de l'ordre dans les méthodes.",
      // 85 DT / session / student
      features: [
        "Bilan initial",
        "Entraînement progressif",
        "Fiches de méthode",
        "Corrections individualisées",
        "Mini-bilan de fin de parcours",
      ],
      highlighted: true,
      badge: "Formule recommandée",
    },
    {
      name: "Intensif",
      hours: "12 h",
      sessions: "6 séances de 2 h",
      price: "495 DT*",
      tagline: "Pour préparer sérieusement une échéance proche.",
      // 82.5 DT / session / student
      features: [
        "Bilan initial",
        "Séances structurées",
        "Sujets types et corrections détaillées",
        "Livret personnalisé",
        "Plan de révision",
      ],
      highlighted: false,
      badge: null as string | null,
    },
    {
      name: "Excellence",
      hours: "16 h",
      sessions: "8 séances de 2 h",
      price: "640 DT*",
      tagline: "Pour construire une progression complète et suivie.",
      // 80 DT / session / student
      features: [
        "Bilan initial complet",
        "Entraînements approfondis",
        "Épreuve blanche ou sujet long",
        "Corrections individualisées",
        "Livret personnalisé",
        "Suivi famille et plan de progression",
      ],
      highlighted: false,
      badge: "Accompagnement complet",
    },
  ],
  note: PRICING_FOOTNOTE,
  groupNote: PRICING_GROUP_NOTE,
};

// ── Méthode Nexus ───────────────────────────────────────────────────────────

export const METHODE_STEPS = [
  {
    icon: "target",
    step: "01",
    title: "Diagnostiquer",
    description: "Identifier les difficultés, les priorités et les objectifs de l'élève.",
  },
  {
    icon: "compass",
    step: "02",
    title: "Structurer",
    description: "Construire un plan de travail réaliste et adapté au calendrier.",
  },
  {
    icon: "book",
    step: "03",
    title: "S'entraîner",
    description: "Travailler sur des exercices ciblés et des sujets types avec correction individualisée.",
  },
  {
    icon: "checkCircle",
    step: "04",
    title: "Corriger",
    description: "Comprendre les erreurs, améliorer la rédaction et construire des automatismes durables.",
  },
  {
    icon: "barChart",
    step: "05",
    title: "Suivre",
    description: "Donner des retours clairs à l'élève et aux parents avec livret personnalisé et bilan de progression.",
  },
];

// ── Trust / confiance ───────────────────────────────────────────────────────

export const TRUST_POINTS = [
  { value: "Groupes de 4 élèves", label: "tarifs accessibles, suivi réel" },
  { value: "Bilans personnalisés", label: "priorités visibles pour chaque élève" },
  { value: "Livrets de travail", label: "méthode, révision et progression" },
  { value: "Plateforme élève-parent", label: "progression lisible à tout moment" },
  { value: "Mutuelleville", label: "cadre présentiel rassurant" },
];

// ── Témoignages ─────────────────────────────────────────────────────────────

export const TESTIMONIALS = [
  {
    name: "Mehdi K.",
    school: "Lycée PMF Tunis",
    result: "8/20 → 16/20 · Mention Bien",
    quote:
      "Le suivi m'a aidé à reprendre une méthode de travail. Les stages ont ensuite sécurisé les points faibles avant les épreuves.",
    tags: ["Suivi", "Stage"],
  },
  {
    name: "Yassine R.",
    school: "Terminale · Grand Oral",
    result: "Oral structuré",
    quote:
      "Je savais enfin comment construire mon propos, tenir mon temps et répondre aux questions sans réciter.",
    tags: ["Grand Oral"],
  },
  {
    name: "Sarah L.",
    school: "Lycée International Lyon",
    result: "9/20 → 14/20 · Mention AB",
    quote:
      "ChatGPT me donnait des réponses génériques. Nexus corrige avec le barème réel et mes parents suivent tout depuis leur tableau de bord.",
    tags: ["Plateforme EAF"],
  },
  {
    name: "Lina M.",
    school: "Première · Suivi parent",
    result: "Travail régulier",
    quote:
      "Le suivi nous a permis de voir les progrès et de relancer au bon moment, sans transformer la maison en salle de classe.",
    tags: ["Parents", "Progression"],
  },
];

// ── FAQ ─────────────────────────────────────────────────────────────────────

export const FAQ_ITEMS = [
  {
    question: "À qui s'adresse le Pack Première — Finish 8 juin ?",
    answer:
      "Aux élèves de Première qui préparent les échéances de juin en français et en mathématiques. Le pack permet de cibler les priorités, consolider les méthodes et s'entraîner sur des sujets types.",
  },
  {
    question: "Quelle est la différence entre un stage classique et Nexus Select ?",
    answer:
      "Un stage classique consolide le programme en cours. Nexus Select va plus loin : il prépare la transition vers le supérieur avec un rythme soutenu, des exercices plus exigeants, un livret Select personnalisé et des groupes de niveau pour les élèves visant CPGE, EPFL ou des parcours sélectifs.",
  },
  {
    question: "Les tarifs affichés correspondent-ils à des cours individuels ?",
    answer:
      "Non. Les tarifs avec astérisque (*) correspondent à un tarif par élève dans un groupe de 4 élèves. Les cours individuels, binômes ou groupes réduits font l'objet d'un tarif spécifique, communiqué selon le besoin, le niveau et le volume horaire.",
  },
  {
    question: "Qu'est-ce qui est inclus dans un forfait Nexus ?",
    answer:
      "Selon la formule, un forfait inclut un bilan initial, des séances structurées, des corrections individualisées, un livret personnalisé de travail et de révision, un accès aux supports numériques, un suivi de progression et un retour structuré aux familles.",
  },
  {
    question: "Pourquoi un groupe de 4 plutôt que des cours particuliers ?",
    answer:
      "Le groupe restreint de 4 élèves crée une émulation de travail, permet des corrections individualisées et réduit le coût par rapport à un cours particulier classique. Chaque élève dispose d'un livret personnalisé, d'un suivi famille et d'un bilan de progression, comme en cours individuel — mais dans un cadre plus stimulant.",
  },
  {
    question: "Comment réserver une place ?",
    answer:
      "Contactez-nous directement sur WhatsApp au 99 19 28 29. Nous échangeons sur le profil de l'élève, ses objectifs et la formule la plus adaptée avant de confirmer l'inscription. Les groupes sont limités à 4 élèves.",
  },
];
