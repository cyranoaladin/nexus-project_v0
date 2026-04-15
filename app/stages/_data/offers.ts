// ─────────────────────────────────────────────────────────────
// Offers data model — single source of truth for stages pricing
// ─────────────────────────────────────────────────────────────

import type { Subject } from "../_lib/business-config";

export type Level = "premiere" | "terminale";
export type OfferCategory = "mono" | "duo" | "trio" | "complement";
export type Emphasis = "maximale" | "premium" | "forte" | "standard" | "secondaire";

/** Per-subject hour breakdown — must sum to `hours` */
export type HoursBreakdown = Partial<Record<Subject, number>>;

/** Strategic role within the product portfolio */
export type PortfolioRole = "lead" | "secondary" | "entry";

/** Profitability health indicator */
export type ProfitabilityProfile = "strong" | "fragile" | "entry";
export type IncludedBonusKind = "masterium" | "grand_oral_workshops";

export interface IncludedBonus {
  kind: IncludedBonusKind;
  shortLabel: string;
  shortSubLabel?: string;
  detailedText: string;
  valueLabel: string;
}

export interface Offer {
  id: string;
  level: Level;
  category: OfferCategory;
  badge: string;
  badgeColor: string;
  title: string;
  hours: number;
  price: number;
  priceReference?: number;
  saving?: number;
  emphasis: Emphasis;
  priority: number;
  accrocheCourte: string;
  intro: string;
  points: string[];
  pourQui: string;
  avantagePack?: string;
  includedBonus?: IncludedBonus;
  ctaClosed: string;
  ctaOpen: string;
  visible: boolean;

  // ── Visual & scheduling fields ─────────────────────────
  subjectKey: string;
  color: string;
  icon: string;
  planning: string[];
  followUp: string[];

  // ── Business model fields ──────────────────────────────
  /** Per-subject hour allocation — sum MUST equal `hours` */
  hoursBreakdown: HoursBreakdown;
  /** Minimum students required to open the group */
  openingThreshold: number;
  /** Maximum students per group */
  maxStudents: number;
  /** Strategic role: lead (push hard), secondary (visible), entry (credibility) */
  roleInPortfolio: PortfolioRole;
  /** Economic health: strong (healthy margin), fragile (tight), entry (zero-margin) */
  profitabilityProfile: ProfitabilityProfile;
  /** Absolute marketing priority (1 = highest across both levels) */
  marketingPriority: number;
  /** Internal profitability notes (not rendered) */
  profitabilityNotes?: string;
}

const PREMIERE_MASTERIUM_BONUS: IncludedBonus = {
  kind: "masterium",
  shortLabel: "Bonus inclus : accès Masterium offert",
  shortSubLabel:
    "Préparation à l’épreuve anticipée de Français — valeur réelle 258 TND.",
  detailedText:
    "Cette formule inclut également un accès offert à Masterium, notre plateforme de préparation à l’épreuve anticipée de Français.",
  valueLabel: "Valeur réelle de l’abonnement : 258 TND.",
};

const TERMINALE_GRAND_ORAL_BONUS: IncludedBonus = {
  kind: "grand_oral_workshops",
  shortLabel: "Bonus inclus : 3 ateliers Grand Oral offerts",
  shortSubLabel: "Valeur réelle 300 TND.",
  detailedText:
    "Cette formule inclut également 3 ateliers offerts de préparation au Grand Oral.",
  valueLabel: "Valeur réelle : 300 TND.",
};

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
    price: 1149,
    priceReference: 1188,
    saving: 39,
    emphasis: "maximale",
    priority: 2,
    accrocheCourte:
      "Les deux épreuves anticipées dans une seule formule plus cohérente et plus lisible.",
    intro:
      "Une formule pensée pour préparer les deux épreuves anticipées dans un même cadre de travail, au lieu de multiplier les préparations séparées.",
    points: [
      "Français et Maths dans une progression cohérente",
      "Entraînements corrigés et méthode claire",
      "Meilleure visibilité pour l'élève et sa famille",
      "Bilan individualisé et plan final",
    ],
    pourQui:
      "Pour les élèves de Première qui veulent sécuriser l'essentiel avec une formule sérieuse, structurée et plus avantageuse que deux inscriptions séparées.",
    avantagePack:
      "Une seule organisation, un seul rythme, une seule logique de travail.",
    includedBonus: PREMIERE_MASTERIUM_BONUS,
    ctaClosed: "Opter pour le duo",
    ctaOpen: "Réserver cette formule",
    visible: true,
    subjectKey: "duo-fr-maths",
    color: "from-amber-500 to-orange-500",
    icon: "Star",
    planning: [
      "Samedi 18 avril — 09h00 à 12h00 · Maths bloc 1",
      "Lundi 20 avril — 09h00 à 12h00 · Maths bloc 2",
      "Mardi 21 avril — 13h30 à 16h30 · Français bloc 1",
      "Jeudi 23 avril — 09h00 à 12h00 · Maths bloc 3",
      "Samedi 25 avril — 09h00 à 12h00 · Maths bloc 4",
      "Lundi 27 avril — 13h30 à 16h30 · Français bloc 2",
      "Mardi 28 avril — 09h00 à 12h00 · Français écrit blanc",
      "Mercredi 29 avril — 09h00 à 12h00 · Maths écrit blanc + correction",
      "Jeudi 30 avril — 13h30 à 16h30 · Français oral blanc",
      "Samedi 2 mai — 09h00 à 12h00 · Maths consolidation",
    ],
    followUp: [
      "Point d'étape intermédiaire",
      "Corrigés détaillés des épreuves blanches",
      "Bilan final avec priorités",
    ],
    hoursBreakdown: { francais: 12, maths: 18 },
    openingThreshold: 3,
    maxStudents: 6,
    roleInPortfolio: "lead",
    profitabilityProfile: "fragile",
    marketingPriority: 5,
    profitabilityNotes: "Maths absorbs 3h extra vs mono. Discount 39 TND on maths margin. Threshold=3 (français per-student cost = deficit at 2).",
  },
  {
    id: "p-mono-maths",
    level: "premiere",
    category: "mono",
    badge: "Mono-matière",
    badgeColor: "#10b981",
    title: "Maths Première — Nouvelle Épreuve 2026",
    hours: 15,
    price: 539,
    emphasis: "forte",
    priority: 1,
    accrocheCourte:
      "Une préparation méthodique pour la nouvelle épreuve anticipée de mathématiques.",
    intro:
      "Une préparation ciblée pour progresser avec méthode, au lieu d'accumuler des exercices sans vraie stratégie.",
    points: [
      "Automatismes et rapidité sans calculatrice",
      "Entraînements au format réel",
      "Correction détaillée",
      "Bilan final",
    ],
    pourQui:
      "Pour les élèves de Première qui veulent prendre de l'avance sur la nouvelle épreuve et mieux maîtriser ses exigences.",
    ctaClosed: "Choisir cette formule",
    ctaOpen: "Réserver ma place",
    visible: true,
    subjectKey: "maths",
    color: "from-cyan-500 to-blue-500",
    icon: "Brain",
    planning: [
      "Samedi 18 avril — 09h00 à 12h00 · Bloc 1 : diagnostic",
      "Lundi 20 avril — 09h00 à 12h00 · Bloc 2 : fonctions",
      "Jeudi 23 avril — 09h00 à 12h00 · Bloc 3 : probabilités",
      "Samedi 25 avril — 09h00 à 12h00 · Bloc 4 : suites",
      "Mercredi 29 avril — 09h00 à 11h00 · Épreuve blanche",
      "Mercredi 29 avril — 11h00 à 12h00 · Correction",
    ],
    followUp: [
      "Corrigé détaillé de l'épreuve blanche",
      "Bilan intermédiaire transmis à la famille",
      "Bilan final individualisé",
      "Plan de révision ciblé",
    ],
    hoursBreakdown: { maths: 15 },
    openingThreshold: 2,
    maxStudents: 6,
    roleInPortfolio: "lead",
    profitabilityProfile: "strong",
    marketingPriority: 2,
    profitabilityNotes: "Core margin driver. Maths is the only subject that carries Nexus margin.",
  },
  {
    id: "p-trio-fr-maths-nsi",
    level: "premiere",
    category: "trio",
    badge: "Formule complète",
    badgeColor: "#a78bfa",
    title: "Trio Première — Français + Maths + NSI",
    hours: 36,
    price: 1609,
    priceReference: 1697,
    saving: 88,
    emphasis: "standard",
    priority: 4,
    accrocheCourte:
      "Une préparation globale et structurée pour avancer avec plus de clarté sur l'ensemble des priorités.",
    intro:
      "Une formule complète pour travailler les trois matières dans un seul parcours, au lieu d'inscriptions dispersées et plus difficiles à piloter.",
    points: [
      "Une préparation globale et cohérente",
      "Vision claire des priorités",
      "Cadre intensif et structuré",
      "Plan de révision final",
    ],
    pourQui:
      "Pour les élèves de Première qui veulent une prise en charge plus complète avec une organisation simple et lisible.",
    avantagePack:
      "Le choix le plus complet, avec une logique de progression plus claire et un tarif plus avantageux que l'achat séparé.",
    includedBonus: PREMIERE_MASTERIUM_BONUS,
    ctaClosed: "Choisir la formule complète",
    ctaOpen: "Réserver cette formule",
    visible: true,
    subjectKey: "trio",
    color: "from-fuchsia-500 to-indigo-500",
    icon: "GraduationCap",
    planning: [
      "Samedi 18 avril — 09h00 à 12h00 · Maths bloc 1",
      "Lundi 20 avril — 09h00 à 12h00 · Maths bloc 2",
      "Mardi 21 avril — 13h30 à 16h30 · Français bloc 1",
      "Mercredi 22 avril — 09h00 à 12h00 · NSI bloc 1",
      "Jeudi 23 avril — 09h00 à 12h00 · Maths bloc 3",
      "Vendredi 24 avril — 09h00 à 12h00 · NSI bloc 2",
      "Samedi 25 avril — 09h00 à 12h00 · Maths bloc 4",
      "Lundi 27 avril — 13h30 à 16h30 · Français bloc 2",
      "Mardi 28 avril — 09h00 à 12h00 · Français écrit blanc",
      "Mercredi 29 avril — 09h00 à 12h00 · Maths écrit blanc + correction",
      "Jeudi 30 avril — 13h30 à 16h30 · Français oral blanc",
      "Samedi 2 mai — 09h00 à 12h00 · Maths consolidation",
    ],
    followUp: [
      "Point d'étape intermédiaire",
      "Corrigés détaillés des épreuves blanches",
      "Bilan final multi-matières",
    ],
    hoursBreakdown: { francais: 12, maths: 18, nsi: 6 },
    openingThreshold: 3,
    maxStudents: 6,
    roleInPortfolio: "secondary",
    profitabilityProfile: "fragile",
    marketingPriority: 11,
    profitabilityNotes: "Condensed parcours: maths gets bulk (18h), NSI reduced to 6h consolidation. Discount 88 TND on maths margin. Requires 3.",
  },
  {
    id: "p-duo-maths-nsi",
    level: "premiere",
    category: "duo",
    badge: "Parcours scientifique",
    badgeColor: "#10b981",
    title: "Duo Première — Maths + NSI",
    hours: 30,
    price: 1009,
    priceReference: 1048,
    saving: 39,
    emphasis: "forte",
    priority: 3,
    accrocheCourte:
      "Un parcours plus cohérent pour travailler les deux matières au lieu de deux stages isolés.",
    intro:
      "Une formule conçue pour avancer avec régularité sur deux matières complémentaires, au lieu d'empiler des révisions sans continuité.",
    points: [
      "Travail structuré sur les deux matières",
      "Gain de temps et de rythme",
      "Préparation plus lisible qu'un achat séparé",
      "Suivi final",
    ],
    pourQui:
      "Pour les élèves de Première à profil scientifique ou numérique qui veulent un cadre solide sur deux matières stratégiques.",
    avantagePack:
      "Un parcours cohérent, plus simple à suivre et plus avantageux que deux formules distinctes.",
    includedBonus: PREMIERE_MASTERIUM_BONUS,
    ctaClosed: "Choisir ce parcours",
    ctaOpen: "Réserver cette formule",
    visible: true,
    subjectKey: "duo-maths-nsi",
    color: "from-emerald-500 to-cyan-500",
    icon: "Sparkles",
    planning: [
      "Samedi 18 avril — 09h00 à 12h00 · Maths bloc 1",
      "Lundi 20 avril — 09h00 à 12h00 · Maths bloc 2",
      "Mercredi 22 avril — 09h00 à 12h00 · NSI bloc 1",
      "Jeudi 23 avril — 09h00 à 12h00 · Maths bloc 3",
      "Vendredi 24 avril — 09h00 à 12h00 · NSI bloc 2",
      "Samedi 25 avril — 09h00 à 12h00 · Maths bloc 4",
      "Lundi 27 avril — 09h00 à 12h00 · NSI bloc 3",
      "Mercredi 29 avril — 09h00 à 12h00 · Maths écrit blanc + correction",
      "Vendredi 1er mai — 09h00 à 12h00 · NSI bloc 4",
      "Samedi 2 mai — 09h00 à 12h00 · NSI bloc 5",
    ],
    followUp: [
      "Point d'étape intermédiaire",
      "Corrigé détaillé Maths + retour NSI",
      "Bilan final sur les deux matières",
    ],
    hoursBreakdown: { maths: 15, nsi: 15 },
    openingThreshold: 3,
    maxStudents: 6,
    roleInPortfolio: "lead",
    profitabilityProfile: "fragile",
    marketingPriority: 6,
    profitabilityNotes: "Exact mono sum. Discount 39 TND on maths margin. NSI cost at 100 TND/h requires 3+.",
  },
  {
    id: "p-mono-nsi",
    level: "premiere",
    category: "mono",
    badge: "Mono-matière",
    badgeColor: "#64748b",
    title: "NSI Première",
    hours: 15,
    price: 509,
    emphasis: "secondaire",
    priority: 6,
    accrocheCourte:
      "Une préparation structurée pour consolider les bases utiles et gagner en méthode.",
    intro:
      "Une formule pensée pour progresser de façon cohérente, au lieu d'avancer par fragments sans fil conducteur.",
    points: [
      "Consolidation des bases utiles",
      "Méthode et entraînements guidés",
      "Travail structuré",
      "Plan final",
    ],
    pourQui:
      "Pour les élèves de Première qui souhaitent renforcer leur niveau et travailler plus efficacement en NSI.",
    ctaClosed: "Choisir cette formule",
    ctaOpen: "Réserver ma place",
    visible: true,
    subjectKey: "nsi",
    color: "from-violet-500 to-fuchsia-500",
    icon: "Laptop",
    planning: [
      "Mercredi 22 avril — 09h00 à 12h00 · Bloc 1 : Python",
      "Vendredi 24 avril — 09h00 à 12h00 · Bloc 2 : structures",
      "Lundi 27 avril — 09h00 à 12h00 · Bloc 3 : algorithmique",
      "Vendredi 1er mai — 09h00 à 12h00 · Bloc 4 : sujet guidé",
      "Samedi 2 mai — 09h00 à 12h00 · Bloc 5 : consolidation",
    ],
    followUp: [
      "Sujet de synthèse corrigé",
      "Retour individualisé",
      "Bilan intermédiaire transmis à la famille",
      "Bilan final transmis",
    ],
    hoursBreakdown: { nsi: 15 },
    openingThreshold: 3,
    maxStudents: 6,
    roleInPortfolio: "entry",
    profitabilityProfile: "entry",
    marketingPriority: 14,
    profitabilityNotes: "Fragile at 2 students due to 100 TND/h group cost. Opens at 3 minimum.",
  },
  {
    id: "p-mono-francais",
    level: "premiere",
    category: "mono",
    badge: "Écrit + Oral",
    badgeColor: "#64748b",
    title: "Français Première — Sprint EAF",
    hours: 12,
    price: 649,
    emphasis: "secondaire",
    priority: 5,
    accrocheCourte:
      "Une préparation claire et ciblée pour l'écrit et l'oral du Français.",
    intro:
      "Une formule resserrée pour travailler l'essentiel avec méthode, au lieu de disperser son énergie sur des révisions floues.",
    points: [
      "Méthode claire pour l'écrit et l'oral",
      "Entraînements ciblés dans le bon format",
      "Travail guidé pour gagner en régularité",
      "Plan de révision final",
    ],
    pourQui:
      "Pour les élèves de Première qui veulent un cadre structuré pour mieux aborder les deux épreuves anticipées de Français.",
    ctaClosed: "Choisir cette formule",
    ctaOpen: "Réserver ma place",
    visible: true,
    subjectKey: "francais",
    color: "from-blue-500 to-indigo-500",
    icon: "BookOpen",
    planning: [
      "Mardi 21 avril — 13h30 à 16h30 · Bloc 1 : méthode",
      "Lundi 27 avril — 13h30 à 16h30 · Bloc 2 : oral",
      "Mardi 28 avril — 09h00 à 12h00 · Écrit blanc",
      "Jeudi 30 avril — 13h30 à 16h30 · Oral blanc",
    ],
    followUp: [
      "Corrigé commenté de l'écrit blanc",
      "Retour individualisé sur l'oral",
      "Bilan intermédiaire transmis à la famille",
      "Bilan final et plan de révision",
    ],
    hoursBreakdown: { francais: 12 },
    openingThreshold: 3,
    maxStudents: 6,
    roleInPortfolio: "entry",
    profitabilityProfile: "entry",
    marketingPriority: 13,
    profitabilityNotes: "Lead magnet / credibility offer. Cost is per-student (80 TND/student/90min). Zero margin by design.",
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
    hours: 30,
    price: 1279,
    priceReference: 1328,
    saving: 49,
    emphasis: "maximale",
    priority: 2,
    accrocheCourte:
      "Les deux piliers du parcours dans une formule plus cohérente et plus lisible qu'une préparation séparée.",
    intro:
      "Une formule pensée pour travailler les deux matières dans une même dynamique, au lieu de gérer deux préparations indépendantes.",
    points: [
      "Les deux matières dans un seul cadre de travail",
      "Continuité de progression",
      "Préparation plus simple à suivre",
      "Organisation plus lisible",
    ],
    pourQui:
      "Pour les élèves de Terminale à profil numérique qui veulent une préparation solide, cohérente et mieux structurée.",
    avantagePack:
      "Un seul parcours, un rythme plus clair, et un tarif plus avantageux que deux achats séparés.",
    includedBonus: TERMINALE_GRAND_ORAL_BONUS,
    ctaClosed: "Choisir ce parcours",
    ctaOpen: "Réserver cette formule",
    visible: true,
    subjectKey: "pack-maths-nsi",
    color: "from-emerald-500 to-cyan-500",
    icon: "Star",
    planning: [
      "Samedi 18 avril — 13h30 à 16h30 · Maths bloc 1",
      "Lundi 20 avril — 13h30 à 16h30 · Maths bloc 2",
      "Mardi 21 avril — 09h00 à 12h00 · NSI bloc 1",
      "Jeudi 23 avril — 13h30 à 16h30 · NSI bloc 2",
      "Samedi 25 avril — 13h30 à 16h30 · Maths bloc 3",
      "Mardi 28 avril — 09h00 à 12h00 · NSI écrit blanc + 13h30 à 16h30 Maths bloc 4 + 17h00 à 19h00 GO atelier 1",
      "Mercredi 29 avril — 09h00 à 12h00 · Maths écrit blanc",
      "Jeudi 30 avril — 09h00 à 12h00 · NSI pratique + débrief + 17h00 à 19h00 GO atelier 2",
      "Samedi 2 mai — 13h30 à 16h30 · Maths correction finale + 17h00 à 19h00 GO atelier 3",
    ],
    followUp: [
      "Bilan intermédiaire",
      "Corrigés détaillés + retour pratique",
      "Bilan final sur les deux matières",
    ],
    hoursBreakdown: { maths: 18, nsi: 12 },
    openingThreshold: 2,
    maxStudents: 6,
    roleInPortfolio: "lead",
    profitabilityProfile: "strong",
    marketingPriority: 3,
    profitabilityNotes: "Exact mono sum (18+12=30). Discount 49 TND absorbed by maths margin.",
  },
  {
    id: "t-duo-maths-pc",
    level: "terminale",
    category: "duo",
    badge: "Parcours scientifique",
    badgeColor: "#f59e0b",
    title: "Pack Terminale — Maths + Physique-Chimie",
    hours: 30,
    price: 1279,
    priceReference: 1328,
    saving: 49,
    emphasis: "maximale",
    priority: 3,
    accrocheCourte:
      "Une vraie ligne droite scientifique, plus lisible et plus cohérente que deux stages séparés.",
    intro:
      "Une formule conçue pour donner de la continuité au travail, au lieu de juxtaposer deux préparations sans lien clair.",
    points: [
      "Une progression cohérente sur les deux matières",
      "Préparation intensive mais lisible",
      "Cadre structuré",
      "Vision claire des priorités",
    ],
    pourQui:
      "Pour les élèves de Terminale scientifique qui veulent travailler sérieusement dans une formule complète et mieux organisée.",
    avantagePack:
      "Deux matières majeures dans un seul cadre de travail, avec un meilleur équilibre entre lisibilité et intensité.",
    includedBonus: TERMINALE_GRAND_ORAL_BONUS,
    ctaClosed: "Choisir ce parcours",
    ctaOpen: "Réserver cette formule",
    visible: true,
    subjectKey: "pack-maths-phys",
    color: "from-orange-500 to-rose-500",
    icon: "Sparkles",
    planning: [
      "Samedi 18 avril — 13h30 à 16h30 · Maths bloc 1",
      "Lundi 20 avril — 13h30 à 16h30 · Maths bloc 2",
      "Mardi 21 avril — 13h30 à 16h30 · Physique bloc 1",
      "Vendredi 24 avril — 13h30 à 16h30 · Physique bloc 2",
      "Samedi 25 avril — 13h30 à 16h30 · Maths bloc 3",
      "Mardi 28 avril — 09h00 à 12h00 · Physique écrit blanc + 13h30 à 16h30 Maths bloc 4 + 17h00 à 19h00 GO atelier 1",
      "Mercredi 29 avril — 09h00 à 12h00 · Maths écrit blanc",
      "Jeudi 30 avril — 17h00 à 19h00 · GO atelier 2",
      "Vendredi 1er mai — 13h30 à 16h30 · Physique correction",
      "Samedi 2 mai — 13h30 à 16h30 · Maths correction finale + 17h00 à 19h00 GO atelier 3",
    ],
    followUp: [
      "Bilan intermédiaire",
      "Corrigés détaillés Maths et Physique",
      "Bilan final avec priorités",
    ],
    hoursBreakdown: { maths: 18, physique: 12 },
    openingThreshold: 2,
    maxStudents: 6,
    roleInPortfolio: "lead",
    profitabilityProfile: "strong",
    marketingPriority: 4,
    profitabilityNotes: "Exact mono sum (18+12=30). Discount 49 TND absorbed by maths margin.",
  },
  {
    id: "t-trio-maths-nsi-go",
    level: "terminale",
    category: "trio",
    badge: "Premium",
    badgeColor: "#a78bfa",
    title: "Pack Terminale — Maths + NSI + Grand Oral",
    hours: 36,
    price: 1449,
    priceReference: 1537,
    saving: 88,
    emphasis: "standard",
    priority: 6,
    accrocheCourte:
      "Un parcours complet pour préparer l'écrit, la pratique et l'oral dans une seule logique de travail.",
    intro:
      "Une formule complète pour travailler l'écrit, la pratique et l'oral dans un même cadre, au lieu d'empiler plusieurs modules séparés.",
    points: [
      "Écrit, pratique et oral dans une même logique",
      "Préparation cohérente",
      "Gain de temps et de lisibilité",
      "Travail structuré jusqu'aux échéances",
    ],
    pourQui:
      "Pour les élèves de Terminale NSI qui veulent une formule plus complète, plus fluide à suivre et mieux optimisée.",
    avantagePack:
      "La formule la plus complète pour avancer avec un seul cadre, un seul rythme et un tarif plus avantageux que l'achat séparé.",
    ctaClosed: "Opter pour le parcours complet",
    ctaOpen: "Réserver cette formule",
    visible: true,
    subjectKey: "pack-maths-nsi-go",
    color: "from-indigo-500 to-fuchsia-500",
    icon: "GraduationCap",
    planning: [
      "Samedi 18 avril — 13h30 à 16h30 · Maths bloc 1",
      "Lundi 20 avril — 13h30 à 16h30 · Maths bloc 2",
      "Mardi 21 avril — 09h00 à 12h00 · NSI bloc 1",
      "Jeudi 23 avril — 13h30 à 16h30 · NSI bloc 2",
      "Samedi 25 avril — 13h30 à 16h30 · Maths bloc 3",
      "Mardi 28 avril — 09h00 à 12h00 · NSI écrit blanc + 13h30 à 16h30 Maths bloc 4 + 17h00 à 19h00 GO atelier 1",
      "Mercredi 29 avril — 09h00 à 12h00 · Maths écrit blanc",
      "Jeudi 30 avril — 09h00 à 12h00 · NSI pratique + débrief + 17h00 à 19h00 GO atelier 2",
      "Samedi 2 mai — 13h30 à 16h30 · Maths correction finale + 17h00 à 19h00 GO atelier 3",
    ],
    followUp: [
      "Bilan intermédiaire",
      "Corrigés détaillés + retour pratique/oral",
      "Bilan final complet",
    ],
    hoursBreakdown: { maths: 18, nsi: 12, grandOral: 6 },
    openingThreshold: 3,
    maxStudents: 6,
    roleInPortfolio: "secondary",
    profitabilityProfile: "strong",
    marketingPriority: 9,
    profitabilityNotes: "GO gets 6h (2h more than mono = pack bonus). Discount 88 TND on maths margin.",
  },
  {
    id: "t-trio-maths-pc-go",
    level: "terminale",
    category: "trio",
    badge: "Premium",
    badgeColor: "#a78bfa",
    title: "Pack Terminale — Maths + Physique-Chimie + Grand Oral",
    hours: 36,
    price: 1449,
    priceReference: 1537,
    saving: 88,
    emphasis: "standard",
    priority: 7,
    accrocheCourte:
      "Une préparation complète et mieux organisée pour l'écrit scientifique et l'oral.",
    intro:
      "Une formule pensée pour réunir l'essentiel dans un seul parcours, au lieu de multiplier les achats et les rythmes différents.",
    points: [
      "Une préparation complète et plus lisible",
      "Cadre intensif et structuré",
      "Travail utile et ciblé",
      "Simulations et méthode",
    ],
    pourQui:
      "Pour les élèves de Terminale scientifique qui veulent une formule complète, plus simple à piloter et plus avantageuse que des inscriptions séparées.",
    avantagePack:
      "Une seule formule pour mieux préparer l'écrit et l'oral, avec un meilleur équilibre entre organisation, clarté et budget.",
    ctaClosed: "Opter pour le parcours complet",
    ctaOpen: "Réserver cette formule",
    visible: true,
    subjectKey: "pack-maths-phys-go",
    color: "from-sky-500 to-indigo-500",
    icon: "GraduationCap",
    planning: [
      "Samedi 18 avril — 13h30 à 16h30 · Maths bloc 1",
      "Lundi 20 avril — 13h30 à 16h30 · Maths bloc 2",
      "Mardi 21 avril — 13h30 à 16h30 · Physique bloc 1",
      "Vendredi 24 avril — 13h30 à 16h30 · Physique bloc 2",
      "Samedi 25 avril — 13h30 à 16h30 · Maths bloc 3",
      "Mardi 28 avril — 09h00 à 12h00 · Physique écrit blanc + 13h30 à 16h30 Maths bloc 4 + 17h00 à 19h00 GO atelier 1",
      "Mercredi 29 avril — 09h00 à 12h00 · Maths écrit blanc",
      "Jeudi 30 avril — 17h00 à 19h00 · GO atelier 2",
      "Vendredi 1er mai — 13h30 à 16h30 · Physique correction",
      "Samedi 2 mai — 13h30 à 16h30 · Maths correction finale + 17h00 à 19h00 GO atelier 3",
    ],
    followUp: [
      "Bilan intermédiaire",
      "Corrigés détaillés + retour oral",
      "Bilan final complet",
    ],
    hoursBreakdown: { maths: 18, physique: 12, grandOral: 6 },
    openingThreshold: 3,
    maxStudents: 6,
    roleInPortfolio: "secondary",
    profitabilityProfile: "strong",
    marketingPriority: 10,
    profitabilityNotes: "GO gets 6h (2h more than mono = pack bonus). Discount 88 TND on maths margin.",
  },
  {
    id: "t-mono-maths",
    level: "terminale",
    category: "mono",
    badge: "Bac écrit",
    badgeColor: "#10b981",
    title: "Maths Terminale",
    hours: 18,
    price: 719,
    emphasis: "forte",
    priority: 1,
    accrocheCourte:
      "Une préparation méthodique pour consolider les acquis et mieux aborder l'épreuve écrite.",
    intro:
      "Une formule conçue pour travailler avec méthode et continuité, au lieu de révisions désordonnées à l'approche de l'examen.",
    points: [
      "Consolidation méthodique",
      "Entraînements ciblés",
      "Correction détaillée",
      "Plan final",
    ],
    pourQui:
      "Pour les élèves de Terminale qui veulent renforcer leur maîtrise de l'épreuve écrite de mathématiques.",
    ctaClosed: "Choisir cette formule",
    ctaOpen: "Réserver ma place",
    visible: true,
    subjectKey: "maths",
    color: "from-rose-500 to-orange-500",
    icon: "Brain",
    planning: [
      "Samedi 18 avril — 13h30 à 16h30 · Bloc 1 : diagnostic",
      "Lundi 20 avril — 13h30 à 16h30 · Bloc 2 : fonctions",
      "Samedi 25 avril — 13h30 à 16h30 · Bloc 3 : probabilités",
      "Mardi 28 avril — 13h30 à 16h30 · Bloc 4 : entraînement",
      "Mercredi 29 avril — 09h00 à 12h00 · Épreuve blanche",
      "Samedi 2 mai — 13h30 à 16h30 · Correction finale",
    ],
    followUp: [
      "Corrigé détaillé de l'épreuve blanche",
      "Bilan intermédiaire transmis à la famille",
      "Bilan final individualisé",
      "Conseils de méthode",
    ],
    hoursBreakdown: { maths: 18 },
    openingThreshold: 2,
    maxStudents: 6,
    roleInPortfolio: "lead",
    profitabilityProfile: "strong",
    marketingPriority: 1,
    profitabilityNotes: "Core Terminale margin driver. Maths at 60 TND/h group cost.",
  },
  {
    id: "t-mono-nsi",
    level: "terminale",
    category: "mono",
    badge: "Spécialité",
    badgeColor: "#64748b",
    title: "NSI Terminale — Écrit + Pratique",
    hours: 12,
    price: 609,
    emphasis: "standard",
    priority: 4,
    accrocheCourte:
      "Une préparation structurée pour travailler à la fois l'écrit et la pratique.",
    intro:
      "Une formule pensée pour préparer l'épreuve avec plus de clarté, au lieu de séparer artificiellement théorie et pratique.",
    points: [
      "Travail écrit et pratique",
      "Simulations guidées",
      "Méthode claire",
      "Préparation structurée",
    ],
    pourQui:
      "Pour les élèves de Terminale NSI qui veulent un cadre sérieux pour se préparer efficacement aux deux dimensions de l'épreuve.",
    ctaClosed: "Choisir cette formule",
    ctaOpen: "Réserver ma place",
    visible: true,
    subjectKey: "nsi",
    color: "from-violet-500 to-purple-500",
    icon: "Laptop",
    planning: [
      "Mardi 21 avril — 09h00 à 12h00 · Bloc 1 : données, SQL",
      "Jeudi 23 avril — 13h30 à 16h30 · Bloc 2 : algorithmique",
      "Mardi 28 avril — 09h00 à 12h00 · Écrit blanc NSI",
      "Jeudi 30 avril — 09h00 à 10h00 · Pratique blanche",
      "Jeudi 30 avril — 10h00 à 12h00 · Débrief",
    ],
    followUp: [
      "Corrigé détaillé écrit + retour pratique",
      "Analyse personnalisée",
      "Bilan intermédiaire transmis à la famille",
      "Bilan final transmis",
    ],
    hoursBreakdown: { nsi: 12 },
    openingThreshold: 3,
    maxStudents: 6,
    roleInPortfolio: "secondary",
    profitabilityProfile: "fragile",
    marketingPriority: 7,
    profitabilityNotes: "NSI at 100 TND/h group cost. Tight margin.",
  },
  {
    id: "t-mono-pc",
    level: "terminale",
    category: "mono",
    badge: "Spécialité",
    badgeColor: "#64748b",
    title: "Physique-Chimie Terminale",
    hours: 12,
    price: 609,
    emphasis: "standard",
    priority: 5,
    accrocheCourte:
      "Une préparation ciblée pour réviser de façon utile, rigoureuse et progressive.",
    intro:
      "Une formule conçue pour aller à l'essentiel avec méthode, au lieu de révisions trop larges et peu efficaces.",
    points: [
      "Révisions ciblées",
      "Entraînements utiles",
      "Travail méthodique",
      "Bilan final",
    ],
    pourQui:
      "Pour les élèves de Terminale qui veulent consolider leur préparation en Physique-Chimie dans un cadre structuré.",
    ctaClosed: "Choisir cette formule",
    ctaOpen: "Réserver ma place",
    visible: true,
    subjectKey: "physique",
    color: "from-emerald-500 to-teal-500",
    icon: "FlaskConical",
    planning: [
      "Mardi 21 avril — 13h30 à 16h30 · Bloc 1 : méthode",
      "Vendredi 24 avril — 13h30 à 16h30 · Bloc 2 : spécialité",
      "Mardi 28 avril — 09h00 à 12h00 · Écrit blanc",
      "Vendredi 1er mai — 13h30 à 16h30 · Correction finale",
    ],
    followUp: [
      "Corrigé détaillé individualisé",
      "Bilan intermédiaire transmis à la famille",
      "Bilan final avec axes de progrès",
      "Conseils de méthode",
    ],
    hoursBreakdown: { physique: 12 },
    openingThreshold: 3,
    maxStudents: 6,
    roleInPortfolio: "secondary",
    profitabilityProfile: "fragile",
    marketingPriority: 8,
    profitabilityNotes: "PC at 100 TND/h group cost. Tight margin.",
  },
  {
    id: "t-complement-go",
    level: "terminale",
    category: "complement",
    badge: "Add-on",
    badgeColor: "#a78bfa",
    title: "Grand Oral — Module complémentaire",
    hours: 4,
    price: 209,
    emphasis: "secondaire",
    priority: 8,
    accrocheCourte:
      "Un module court pour mieux structurer sa prise de parole et préparer l'échange avec le jury.",
    intro:
      "Un complément utile pour travailler l'oral avec méthode, au lieu d'improviser au dernier moment.",
    points: [
      "Construction des questions",
      "Structuration de l'exposé",
      "Simulation orale",
      "Feedback ciblé",
    ],
    pourQui:
      "Pour les élèves qui veulent compléter une préparation écrite ou renforcer leur aisance à l'oral.",
    ctaClosed: "Ajouter le Grand Oral",
    ctaOpen: "Ajouter ce module",
    visible: true,
    subjectKey: "grand-oral",
    color: "from-amber-500 to-yellow-500",
    icon: "Mic",
    planning: [
      "Mardi 28 avril — 17h00 à 19h00 · Atelier 1 : questions",
      "Jeudi 30 avril — 17h00 à 19h00 · Atelier 2 : exposé",
    ],
    followUp: [
      "Retour individualisé structure + posture",
      "Bilan intermédiaire transmis à la famille",
      "Conseils personnalisés",
    ],
    hoursBreakdown: { grandOral: 4 },
    openingThreshold: 3,
    maxStudents: 6,
    roleInPortfolio: "secondary",
    profitabilityProfile: "fragile",
    marketingPriority: 12,
    profitabilityNotes: "GO at 100 TND/h group cost. 4h mono. Tight margin at 2.",
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
  { id: "trio", label: "Parcours complet" },
];

export const COMPARISON_ITEMS = [
  {
    category: "1 matière" as const,
    description: "Pour cibler une priorité précise.",
    icon: "target" as const,
  },
  {
    category: "2 matières" as const,
    description:
      "Pour préparer deux épreuves de façon plus cohérente et plus avantageuse.",
    icon: "layers" as const,
  },
  {
    category: "Parcours complet" as const,
    description:
      "Pour choisir une formule plus complète, avec une organisation plus lisible.",
    icon: "crown" as const,
  },
];
