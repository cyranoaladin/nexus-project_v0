// ─────────────────────────────────────────────────────────────
// Offers data model — single source of truth for stages pricing
// ─────────────────────────────────────────────────────────────

export type Level = "premiere" | "terminale";
export type OfferCategory = "mono" | "duo" | "trio" | "complement";
export type Emphasis = "maximale" | "premium" | "forte" | "standard" | "secondaire";

export interface Offer {
  id: string;
  level: Level;
  category: OfferCategory;
  badge: string;
  badgeColor: string;
  title: string;
  hours: number;
  price: number;
  /** Reference price (sum of separate formulas). Only for duo/trio. */
  priceReference?: number;
  /** Saving shown to user. Only for duo/trio. */
  saving?: number;
  emphasis: Emphasis;
  /** Sort priority within its level — lower = higher priority */
  priority: number;
  description: string;
  arguments: string[];
  cta: string;
  /** Visible in main listing */
  visible: boolean;
}

// ──── PREMIÈRE ────────────────────────────────────────────────

const PREMIERE_OFFERS: Offer[] = [
  {
    id: "p-duo-fr-maths",
    level: "premiere",
    category: "duo",
    badge: "Best-seller",
    badgeColor: "#f59e0b",
    title: "Duo Première — Français + Maths",
    hours: 30,
    price: 1139,
    priceReference: 1178,
    saving: 39,
    emphasis: "maximale",
    priority: 1,
    description:
      "Les deux épreuves anticipées dans un seul cadre de travail cohérent.",
    arguments: [
      "Une progression cohérente au lieu de deux préparations séparées",
      "Entraînements corrigés et méthode",
      "Bilan individualisé + plan final",
      "Le meilleur rapport préparation / investissement",
    ],
    cta: "Choisir cette formule",
    visible: true,
  },
  {
    id: "p-mono-maths",
    level: "premiere",
    category: "mono",
    badge: "Mono-matière",
    badgeColor: "#10b981",
    title: "Maths Première — Nouvelle Épreuve 2026",
    hours: 18,
    price: 539,
    emphasis: "forte",
    priority: 2,
    description:
      "Automatismes, rapidité et format réel — pour la nouvelle épreuve sans calculatrice.",
    arguments: [
      "Automatismes et rapidité sans calculatrice",
      "Entraînements au format réel",
      "Correction détaillée",
      "Bilan final",
    ],
    cta: "Choisir cette formule",
    visible: true,
  },
  {
    id: "p-trio-fr-maths-nsi",
    level: "premiere",
    category: "trio",
    badge: "Formule complète",
    badgeColor: "#a78bfa",
    title: "Trio Première — Français + Maths + NSI",
    hours: 45,
    price: 1589,
    priceReference: 1677,
    saving: 88,
    emphasis: "premium",
    priority: 3,
    description:
      "Une préparation globale au lieu d'inscriptions dispersées.",
    arguments: [
      "Vision claire des priorités",
      "Cadre intensif et structuré",
      "Économie de 88 TND vs achat séparé",
      "Plan de révision final",
    ],
    cta: "Opter pour le parcours complet",
    visible: true,
  },
  {
    id: "p-duo-maths-nsi",
    level: "premiere",
    category: "duo",
    badge: "Parcours scientifique",
    badgeColor: "#10b981",
    title: "Duo Première — Maths + NSI",
    hours: 33,
    price: 999,
    priceReference: 1038,
    saving: 39,
    emphasis: "forte",
    priority: 4,
    description:
      "Un parcours plus cohérent au lieu de deux stages isolés.",
    arguments: [
      "Travail structuré sur les deux matières",
      "Gain de temps et de rythme",
      "Suivi final",
      "Économie de 39 TND vs achat séparé",
    ],
    cta: "Choisir cette formule",
    visible: true,
  },
  {
    id: "p-mono-nsi",
    level: "premiere",
    category: "mono",
    badge: "Mono-matière",
    badgeColor: "#64748b",
    title: "NSI Première",
    hours: 15,
    price: 499,
    emphasis: "secondaire",
    priority: 5,
    description:
      "Consolidation des bases utiles pour la suite.",
    arguments: [
      "Méthode et entraînements guidés",
      "Travail structuré",
      "Plan final",
      "Consolidation des bases utiles",
    ],
    cta: "Choisir cette formule",
    visible: true,
  },
  {
    id: "p-mono-francais",
    level: "premiere",
    category: "mono",
    badge: "Écrit + Oral",
    badgeColor: "#64748b",
    title: "Français Première — Sprint EAF",
    hours: 12,
    price: 639,
    emphasis: "standard",
    priority: 6,
    description:
      "Méthode claire pour l'écrit et l'oral anticipés.",
    arguments: [
      "Entraînements ciblés au bon format",
      "Travail guidé pour gagner en régularité",
      "Plan de révision final",
      "Méthode claire pour l'écrit et l'oral",
    ],
    cta: "Choisir cette formule",
    visible: true,
  },
];

// ──── TERMINALE ───────────────────────────────────────────────

const TERMINALE_OFFERS: Offer[] = [
  {
    id: "t-duo-maths-nsi",
    level: "terminale",
    category: "duo",
    badge: "Parcours numérique",
    badgeColor: "#10b981",
    title: "Pack Terminale — Maths + NSI",
    hours: 42,
    price: 1269,
    priceReference: 1318,
    saving: 49,
    emphasis: "maximale",
    priority: 1,
    description:
      "Les deux piliers du parcours dans un même cadre.",
    arguments: [
      "Plus lisible qu'une préparation séparée",
      "Continuité de travail",
      "Préparation solide",
      "Économie de 49 TND vs achat séparé",
    ],
    cta: "Choisir cette formule",
    visible: true,
  },
  {
    id: "t-duo-maths-pc",
    level: "terminale",
    category: "duo",
    badge: "Parcours scientifique",
    badgeColor: "#f59e0b",
    title: "Pack Terminale — Maths + Physique-Chimie",
    hours: 42,
    price: 1269,
    priceReference: 1318,
    saving: 49,
    emphasis: "maximale",
    priority: 2,
    description:
      "Une vraie ligne droite scientifique.",
    arguments: [
      "Cohérence de progression",
      "Préparation intensive mais lisible",
      "Cadre structuré",
      "Économie de 49 TND vs achat séparé",
    ],
    cta: "Choisir cette formule",
    visible: true,
  },
  {
    id: "t-trio-maths-nsi-go",
    level: "terminale",
    category: "trio",
    badge: "Premium",
    badgeColor: "#a78bfa",
    title: "Pack Terminale — Maths + NSI + Grand Oral",
    hours: 48,
    price: 1399,
    priceReference: 1517,
    saving: 118,
    emphasis: "premium",
    priority: 3,
    description:
      "Un parcours complet au lieu d'un empilement de modules.",
    arguments: [
      "Écrit, pratique et oral dans une même logique",
      "Préparation cohérente",
      "Gain de temps et de lisibilité",
      "Économie de 118 TND vs achat séparé",
    ],
    cta: "Opter pour le parcours complet",
    visible: true,
  },
  {
    id: "t-trio-maths-pc-go",
    level: "terminale",
    category: "trio",
    badge: "Premium",
    badgeColor: "#a78bfa",
    title: "Pack Terminale — Maths + Physique-Chimie + Grand Oral",
    hours: 48,
    price: 1399,
    priceReference: 1517,
    saving: 118,
    emphasis: "premium",
    priority: 4,
    description:
      "Une préparation complète au lieu de plusieurs achats dispersés.",
    arguments: [
      "Cadre intensif et plus simple à suivre",
      "Travail utile et ciblé",
      "Simulations + méthode",
      "Économie de 118 TND vs achat séparé",
    ],
    cta: "Opter pour le parcours complet",
    visible: true,
  },
  {
    id: "t-mono-maths",
    level: "terminale",
    category: "mono",
    badge: "Bac écrit",
    badgeColor: "#10b981",
    title: "Maths Terminale",
    hours: 24,
    price: 719,
    emphasis: "forte",
    priority: 5,
    description:
      "Consolidation méthodique et entraînements ciblés.",
    arguments: [
      "Entraînements ciblés",
      "Correction détaillée",
      "Plan final",
      "Consolidation méthodique",
    ],
    cta: "Choisir cette formule",
    visible: true,
  },
  {
    id: "t-mono-nsi",
    level: "terminale",
    category: "mono",
    badge: "Spécialité",
    badgeColor: "#64748b",
    title: "NSI Terminale — Écrit + Pratique",
    hours: 18,
    price: 599,
    emphasis: "standard",
    priority: 6,
    description:
      "Travail écrit et pratique avec simulations guidées.",
    arguments: [
      "Simulations guidées",
      "Méthode claire",
      "Préparation structurée",
      "Travail écrit et pratique",
    ],
    cta: "Choisir cette formule",
    visible: true,
  },
  {
    id: "t-mono-pc",
    level: "terminale",
    category: "mono",
    badge: "Spécialité",
    badgeColor: "#64748b",
    title: "Physique-Chimie Terminale",
    hours: 18,
    price: 599,
    emphasis: "standard",
    priority: 7,
    description:
      "Révisions ciblées et entraînements utiles.",
    arguments: [
      "Entraînements utiles",
      "Travail méthodique",
      "Bilan final",
      "Révisions ciblées",
    ],
    cta: "Choisir cette formule",
    visible: true,
  },
  {
    id: "t-complement-go",
    level: "terminale",
    category: "complement",
    badge: "Add-on",
    badgeColor: "#a78bfa",
    title: "Grand Oral — Module complémentaire",
    hours: 6,
    price: 199,
    emphasis: "secondaire",
    priority: 8,
    description:
      "Construction, structuration et simulation orale.",
    arguments: [
      "Construction des questions",
      "Structuration de l'exposé",
      "Simulation orale",
      "Feedback ciblé",
    ],
    cta: "Ajouter le Grand Oral",
    visible: true,
  },
];

// ──── EXPORTS ─────────────────────────────────────────────────

export const ALL_OFFERS: Offer[] = [
  ...PREMIERE_OFFERS,
  ...TERMINALE_OFFERS,
].sort((a, b) => a.priority - b.priority);

export function getOffersByLevel(level: Level): Offer[] {
  return ALL_OFFERS
    .filter((o) => o.level === level && o.visible)
    .sort((a, b) => a.priority - b.priority);
}

export type CategoryFilter = "all" | "mono" | "duo" | "trio";

export const CATEGORY_FILTERS: { id: CategoryFilter; label: string }[] = [
  { id: "all", label: "Toutes" },
  { id: "mono", label: "1 matière" },
  { id: "duo", label: "2 matières" },
  { id: "trio", label: "3+ matières" },
];

export const COMPARISON_ITEMS = [
  {
    category: "Mono" as const,
    description: "Pour cibler une matière précise",
    icon: "target" as const,
  },
  {
    category: "Duo" as const,
    description: "Deux matières, un seul cadre, un tarif plus cohérent",
    icon: "layers" as const,
  },
  {
    category: "Trio / Complet" as const,
    description: "Prise en charge globale au tarif le plus avantageux",
    icon: "crown" as const,
  },
];
