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
  "https://wa.me/21699192829?text=Bonjour%2C%20je%20souhaite%20recevoir%20les%20informations%20sur%20le%20stage%20Nexus%20Select%2040%C2%A0h.%20Mon%20enfant%20est%20admis%20ou%20candidat%20%C3%A0%20une%20fili%C3%A8re%20s%C3%A9lective%20et%20je%20souhaite%20v%C3%A9rifier%20si%20ce%20stage%20est%20adapt%C3%A9%20%C3%A0%20son%20profil.";
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
  personalizedSupport: {
    src: "/images/accompagnement-personnalise.webp",
    alt: "Suivi individualisé avec livret de travail et tableau de progression.",
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
    "À Mutuelleville, Nexus Réussite accompagne les élèves de Première et de Terminale avec des stages intensifs, des cours hebdomadaires, des bilans personnalisés et un suivi structuré pour progresser avec méthode, rigueur et confiance.",
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

// Nexus Select business model:
// Format: 40 h / student, group of 4 students max.
// Price: 1 800 TND / student.
// Group revenue: 4 × 1 800 = 7 200 TND.
// Teacher cost estimate: 40 h × 100 TND = 4 000 TND.
// Gross margin before fixed costs: 3 200 TND.
// This stage is a premium high-intensity program and should not be priced like standard weekly support.

export const NEXUS_SELECT = {
  eyebrow: "Nexus Select · Post-épreuves",
  title: "40 h pour entrer dans le rythme du supérieur scientifique",
  headline:
    "Après les épreuves, les élèves admis dans les filières sélectives doivent changer de rythme.",
  description:
    "En deux semaines, Nexus Select installe un cadre intensif : 40 h de mathématiques, 4 h par jour, en groupe de 4 élèves maximum, pour préparer l'entrée en CPGE, EPFL, doubles licences maths-info et parcours scientifiques exigeants.",
  pedagogy:
    "Le stage est conçu par un enseignant maîtrisant les programmes, les méthodes et les attentes des classes préparatoires et des parcours scientifiques exigeants. Le travail ne se limite pas à refaire des exercices : il apprend à chercher, rédiger, structurer une preuve, tenir un raisonnement long et adopter une méthode de travail compatible avec le supérieur.",
  disclaimer:
    "Nexus Select ne prépare pas un dossier Parcoursup : il prépare l'élève au niveau qui l'attend après l'admission.",
  audience: [
    "Admis en CPGE scientifique",
    "Admis en double licence maths-info",
    "Admis dans une filière scientifique sélective",
    "Admis ou en attente d'admission à l'EPFL",
    "Élèves solides visant le passage Terminale → supérieur sans décrochage",
    "Élèves motivés, prêts à accepter un rythme intensif",
  ],
  audienceFilter:
    "Ce stage n'est pas un stage de remise à niveau généraliste. Il s'adresse à des élèves motivés, déjà solides, qui veulent aborder le supérieur avec une vraie avance méthodologique.",
  format: [
    { value: "40 h", label: "de mathématiques intensives", detail: "Un volume conséquent pour installer un vrai changement de rythme." },
    { value: "4 h / jour", label: "pendant deux semaines", detail: "Un entraînement quotidien pour développer endurance et concentration." },
    { value: "2 semaines", label: "après les épreuves du bac", detail: "Un format court, dense et structurant après les épreuves." },
    { value: "4 élèves max", label: "pour un suivi précis", detail: "Un groupe restreint pour garder un suivi précis et des corrections individualisées." },
  ],
  expertiseTitle: "Un stage conçu par un enseignant qui connaît les exigences du supérieur",
  expertiseBullets: [
    "Maîtrise des attendus de CPGE",
    "Connaissance des écarts entre Terminale et supérieur",
    "Identification des faiblesses qui deviennent bloquantes après la rentrée",
    "Entraînement à la rédaction mathématique",
    "Travail sur les raisonnements longs",
    "Exigence de clarté, de méthode et de rigueur",
    "Progression vers une posture d'étudiant scientifique",
  ],
  expertiseNote:
    "L'un des enjeux majeurs de l'entrée en CPGE ou en filière sélective n'est pas seulement le niveau des notions : c'est le changement de rythme, de profondeur et de rigueur. Nexus Select prépare précisément cette bascule.",
  objectives: [
    "Changer de rythme — tenir 4 h de travail mathématique exigeant par jour",
    "Renforcer les fondamentaux utiles au supérieur — fonctions, suites, calcul, raisonnement, logique, rédaction",
    "Passer des exercices courts aux problèmes longs — rester mobilisé, sans abandonner trop vite",
    "Améliorer la rédaction mathématique — structurer une solution, justifier chaque étape",
    "Développer une vraie capacité de recherche — explorer, tester, comparer plusieurs méthodes",
    "Installer une méthode de travail compatible avec CPGE / EPFL / doubles licences",
    "Identifier les fragilités avant la rentrée — repérer les lacunes qui deviennent bloquantes",
    "Construire un plan de progression post-stage — repartir avec des priorités claires",
  ],
  pricing: {
    label: "Forfait unique",
    price: "1 800 TND*",
    details: "40 h · 4 h/jour · 2 semaines · groupe de 4 élèves maximum",
    note: "*Tarif par élève, pour un groupe de 4 élèves maximum. Le tarif inclut les 40 h de stage, les supports de travail, le livret Select, les corrections et le bilan de fin de stage.",
  },
  pricingIncludes: [
    "40 h de stage",
    "4 h par jour",
    "2 semaines",
    "Groupe de 4 élèves maximum",
    "Livret Select inclus",
    "Corrections individualisées",
    "Bilan de fin de stage",
    "Plan de travail post-stage",
  ],
  features: [
    "40 h de mathématiques intensives",
    "Livret Select personnalisé",
    "Exercices progressifs et exigeants",
    "Problèmes longs et raisonnements structurés",
    "Corrections individualisées",
    "Entraînement à la rédaction mathématique",
    "Bilan de fin de stage",
    "Plan de travail pour l'été",
    "Conseils méthodologiques pour la rentrée",
    "Suivi en groupe restreint de 4 élèves maximum",
  ],
  admissionNote:
    "Admission au stage après échange sur le profil de l'élève.",
  ctaLabel: "Candidater au stage Nexus Select",
  ctaSecondary: "Échanger sur le profil de l'élève",
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
      "Stage intensif de 40 h pour les élèves admis en CPGE, EPFL, doubles licences maths-info et filières sélectives. Préparer le choc de niveau avant la rentrée.",
    bullets: ["40 h intensives", "CPGE / EPFL", "Livret Select", "Bilan fin de stage"],
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
      "Un stage classique consolide le programme en cours. Nexus Select va plus loin : 40 h de mathématiques intensives en 2 semaines, en groupe de 4 élèves maximum, pour préparer l'entrée en CPGE, EPFL, doubles licences maths-info et filières sélectives. Livret Select personnalisé, corrections individualisées et bilan de fin de stage inclus.",
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
