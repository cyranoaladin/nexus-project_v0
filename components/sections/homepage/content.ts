export const STAGES_URL = "/stages";
export const EAF_URL = "https://eaf.nexusreussite.academy";
export const WHATSAPP_URL =
  "https://wa.me/21699192829?text=Bonjour%2C%20je%20souhaite%20réserver%20pour%20les%20stages%20printemps%202026";
export const PHONE_URL = "tel:+21699192829";
export const PHONE_LABEL = "+216 99 19 28 29";
export const CONTACT_EMAIL = "contact@nexusreussite.academy";
export const CONTACT_ADDRESS =
  "Centre Urbain Nord, Immeuble VENUS, Appt C13, 1082 Tunis";

export const STAGE_START_DATE = new Date("2026-04-18T09:00:00");
export const EAF_EXAM_DATE = new Date("2026-06-08T08:00:00");

export const TRUST_METRICS = [
  { value: "98%", label: "de satisfaction observée" },
  { value: "+4.2 pts", label: "de progression moyenne" },
  { value: "6 max", label: "élèves par groupe (stages)" },
  { value: "3 min", label: "pour corriger une copie (EAF)" },
];

export const TRUST_COMMITMENTS = [
  {
    icon: "🎓",
    title: "Enseignants agrégés et certifiés",
    description:
      "Chaque intervenant est un professionnel du système éducatif français.",
  },
  {
    icon: "🔒",
    title: "Anti-copie par design",
    description:
      "La plateforme EAF ne rédige jamais à la place de l'élève. Le travail reste authentique.",
  },
  {
    icon: "📊",
    title: "Progression mesurée",
    description:
      "Bilans individualisés en stages et tableau de bord clair sur la plateforme EAF.",
  },
];

export const TESTIMONIALS = [
  {
    name: "Mehdi K.",
    school: "Lycée PMF Tunis",
    result: "8/20 → 16/20 · Mention Bien",
    quote:
      "Les simulations d'oral m'ont permis de prendre confiance. Le jour J, j'avais l'impression d'avoir déjà passé l'épreuve dix fois.",
    tags: ["📖 Plateforme EAF", "📅 Stage"],
  },
  {
    name: "Yassine R.",
    school: "Terminale · Grand Oral",
    result: "19/20",
    quote:
      "J'ai eu 19/20 au Grand Oral alors que je perdais tous mes moyens en public. Le coaching a tout changé.",
    tags: ["📅 Stage Grand Oral"],
  },
  {
    name: "Sarah L.",
    school: "Lycée International Lyon",
    result: "9/20 → 14/20 · Mention AB",
    quote:
      "ChatGPT me donnait des réponses génériques. Nexus corrige avec le barème réel et mes parents suivent tout depuis leur tableau de bord.",
    tags: ["📖 Plateforme EAF"],
  },
  {
    name: "Lina M.",
    school: "Terminale NSI",
    result: "Préparation pratique sécurisée",
    quote:
      "Le focus épreuve pratique m'a sauvée. Arrivée le jour J en connaissant déjà les pièges des sujets.",
    tags: ["📅 Stage NSI"],
  },
];

export const COMPARISON_ROWS = [
  { label: "Format", stages: "Présentiel, petit groupe", eaf: "100% en ligne, autonome" },
  { label: "Matières", stages: "Maths, Français, NSI, Grand Oral", eaf: "Français EAF uniquement" },
  { label: "Niveau", stages: "Première & Terminale", eaf: "Première uniquement" },
  { label: "Prix", stages: "À partir de 550 TND", eaf: "Gratuit puis 129 TND/mois" },
  { label: "Quand", stages: "18 avril — 2 mai 2026", eaf: "Disponible maintenant, 24/7" },
  { label: "Idéal pour", stages: "Consolidation intensive + cadre", eaf: "Entraînement régulier + oral" },
];
