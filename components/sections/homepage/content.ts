export const STAGES_URL = "/stages";
export const EAF_URL = "https://eaf.nexusreussite.academy";
export const WHATSAPP_URL =
  "https://wa.me/21699192829?text=Bonjour%2C%20je%20souhaite%20des%20informations%20sur%20la%20préparation%20EAF%20Nexus%20Réussite";
export const PHONE_URL = "tel:+21699192829";
export const PHONE_LABEL = "+216 99 19 28 29";
export const CONTACT_EMAIL = "contact@nexusreussite.academy";
export const CONTACT_ADDRESS =
  "Centre Urbain Nord, Immeuble VENUS, Appt C13, 1082 Tunis";

export const STAGE_START_DATE = new Date("2026-04-18T09:00:00");
export const EAF_EXAM_DATE = new Date("2026-06-08T08:00:00");

export const TRUST_METRICS = [
  { value: "Toute l'année", label: "cours, stages et suivi régulier" },
  { value: "Petits groupes", label: "cadre de travail exigeant" },
  { value: "Packs ciblés", label: "mention, remise à niveau, excellence" },
  { value: "Mutuelleville", label: "ancrage présentiel rassurant" },
];

export const TRUST_COMMITMENTS = [
  {
    icon: "book",
    title: "Méthode structurée",
    description:
      "Chaque accompagnement commence par un objectif clair : consolider, reprendre confiance, préparer une épreuve ou viser l'excellence.",
  },
  {
    icon: "shield",
    title: "Enseignants et cadre sérieux",
    description:
      "Cours hebdomadaires, stages et packs gardent une exigence pédagogique lisible pour les élèves comme pour les parents.",
  },
  {
    icon: "barChart",
    title: "Progression mesurable",
    description:
      "Le suivi individualisé et la plateforme numérique rendent visibles les acquis, les fragilités et les priorités de travail.",
  },
];

export const METHOD_STEPS = [
  {
    icon: "target",
    title: "Diagnostiquer",
    description:
      "Comprendre le niveau réel, les échéances, les blocages de méthode et l'objectif familial avant de proposer une formule.",
  },
  {
    icon: "graduation",
    title: "Accompagner",
    description:
      "Installer un rythme avec cours hebdomadaires, stages intensifs, packs ciblés ou plateforme numérique selon le besoin.",
  },
  {
    icon: "barChart",
    title: "Mesurer",
    description:
      "Suivre les progrès, ajuster les priorités et donner aux parents une vision claire de l'avancement.",
  },
];

export const OBJECTIVES = [
  "Reprendre confiance après une période fragile",
  "Installer une méthode de travail régulière",
  "Préparer une échéance : EAF, Bac, spécialité, oral",
  "Viser la mention avec un cadre plus exigeant",
];

export const OFFER_FAMILIES = [
  {
    icon: "calendar",
    title: "Cours hebdomadaires & suivi personnalisé",
    description:
      "Un rythme stable toute l'année pour consolider les bases, structurer le travail et suivre la progression.",
    bullets: ["Mathématiques", "Français", "Méthode", "Suivi parent"],
    href: WHATSAPP_URL,
    cta: "Demander un diagnostic",
  },
  {
    icon: "zap",
    title: "Stages intensifs pendant les vacances",
    description:
      "Des formats courts pour remettre à niveau, accélérer avant une épreuve ou sécuriser les chapitres clés.",
    bullets: ["Printemps", "Vacances", "Petits groupes", "Bilan ciblé"],
    href: STAGES_URL,
    cta: "Voir les stages",
  },
  {
    icon: "book",
    title: "Plateforme EAF & outils numériques",
    description:
      "EAF signifie Épreuves anticipées de français : préparation écrit + oral, entraînement autonome et tableau de bord.",
    bullets: ["Freemium", "Quiz adaptatifs", "Écrit + oral", "Progression"],
    href: EAF_URL,
    cta: "Accéder à la plateforme",
  },
  {
    icon: "trophy",
    title: "Packs objectif mention, remise à niveau, excellence",
    description:
      "Des parcours conçus autour d'un objectif concret, avec priorités, calendrier et accompagnement ajusté.",
    bullets: ["Mention", "Remise à niveau", "Excellence", "Grand Oral"],
    href: WHATSAPP_URL,
    cta: "Choisir mon pack",
  },
];

export const SPECIALTIES = [
  "Préparation EAF : écrit, oral, méthode et autonomie",
  "Mathématiques Première et Terminale",
  "NSI : pratique, écrit et oral",
  "Grand Oral : structure, posture et entraînement",
  "Méthodologie et organisation du travail",
  "Suivi individualisé avec visibilité parent",
];

export const PRICING_PLANS = [
  {
    name: "Freemium",
    tagline: "Faites vos premiers pas vers le Bac.",
    price: "0 TND",
    cadence: "pour commencer",
    description:
      "Le point d'entrée numérique pour découvrir l'écosystème Nexus Réussite, tester la méthode et lancer les premiers entraînements.",
    features: [
      "Premiers repères de méthode",
      "Accès découverte à la plateforme EAF",
      "Quiz et exercices d'entraînement",
      "Orientation vers cours, stages ou packs",
    ],
    cta: "Commencer gratuitement",
    href: EAF_URL,
    highlighted: false,
  },
  {
    name: "Premium",
    tagline: "La méthode complète pour assurer votre réussite.",
    price: "Selon formule",
    cadence: "plateforme + suivi",
    description:
      "Le niveau complet pour articuler plateforme, entraînement régulier, suivi parent et accompagnement scolaire selon les besoins.",
    features: [
      "Préparation EAF renforcée",
      "Mathématiques, NSI ou Grand Oral selon objectif",
      "Tableau de bord et suivi parent",
      "Lien avec cours hebdomadaires ou stages",
    ],
    cta: "Booster mon plan",
    href: WHATSAPP_URL,
    highlighted: false,
  },
  {
    name: "Masterium",
    tagline: "L'excellence absolue pour décrocher la mention.",
    price: "Sur mesure",
    cadence: "accompagnement premium",
    description:
      "Le niveau le plus exigeant pour combiner stratégie de mention, packs ciblés, présentiel à Mutuelleville et suivi renforcé.",
    features: [
      "Stratégie mention personnalisée",
      "Cours, stages et packs coordonnés",
      "EAF, Maths, NSI ou Grand Oral selon profil",
      "Suivi parent prioritaire",
    ],
    cta: "Viser la mention",
    href: WHATSAPP_URL,
    highlighted: true,
  },
];

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

export const COMPARISON_ROWS = [
  { label: "Cadre", classique: "Cours isolés ou révisions au coup par coup", nexus: "Académie avec cours, stages, packs et plateforme" },
  { label: "Objectif", classique: "On travaille souvent sans cap précis", nexus: "Chaque formule vise un objectif concret" },
  { label: "Suivi", classique: "Peu de visibilité entre deux notes", nexus: "Progression suivie et priorités ajustées" },
  { label: "Épreuves", classique: "Préparation tardive des oraux et spécialités", nexus: "EAF, Maths, NSI et Grand Oral intégrés" },
  { label: "Famille", classique: "Les parents manquent de repères", nexus: "Contact clair, diagnostic et ancrage Mutuelleville" },
  { label: "Numérique", classique: "Outils dispersés", nexus: "Plateforme EAF et tableaux de bord associés" },
];
