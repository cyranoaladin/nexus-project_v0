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
    badge: "Best-seller",
    badgeColor: "#f59e0b",
    highlight: true,
    icon: "target",
    title: 'Pack Doublé Première',
    subtitle: "PREMIÈRE — Français + Maths",
    hours: "40h",
    description:
      "Préparer les deux épreuves anticipées dans une seule semaine de travail intensive, avec méthode, entraînements corrigés et mise en conditions réelles.",
    features: [
      "Préparation complète des épreuves anticipées de Français et de Maths",
      "Entraînements écrits et oraux dans le format des épreuves",
      "2 épreuves blanches corrigées",
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
    icon: "book-open",
    title: "Français Première",
    subtitle: "PREMIÈRE — Écrit + Oral Anticipé",
    hours: "22h",
    description:
      "Maîtriser la méthode et gagner en régularité sur les deux épreuves anticipées. Entraînements corrigés et simulations dans le format réel de l'examen.",
    features: [
      "Préparation complète de l'écrit et de l'oral anticipés",
      "Entraînements dans le format réel de l'examen",
      "Épreuve blanche corrigée",
      "Plan de révision final",
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
    icon: "sigma",
    title: "Maths Première — Nouvelle Épreuve 2026",
    subtitle: "PREMIÈRE — Épreuve Anticipée",
    hours: "22h",
    description:
      "Prendre de l'avance sur la nouvelle épreuve anticipée de mathématiques : format court, sans calculatrice, avec méthode et automatismes. La vitesse d'exécution fait la différence.",
    features: [
      "Préparation complète de la nouvelle épreuve anticipée",
      "Entraînements au format de l'examen, sans calculatrice",
      "Épreuve blanche + correction détaillée",
      "Bilan individualisé + plan de révision final",
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
    icon: "calculator",
    title: "Maths Terminale",
    subtitle: "TERMINALE — Bac Écrit",
    hours: "30h",
    description:
      "Consolider l'ensemble du programme et aborder le Bac avec méthode et deux épreuves blanches complètes derrière soi.",
    features: [
      "Préparation complète de l'épreuve de Maths Terminale",
      "Travail sur l'ensemble du programme",
      "2 épreuves blanches corrigées",
      "Bilan individualisé + plan de révision final",
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
    badge: "Urgence 18 mai",
    badgeColor: "#ef4444",
    highlight: true,
    icon: "code-2",
    title: 'Pack NSI Terminale — Complet',
    subtitle: "TERMINALE — Pratique + Écrit + Oral de spécialité",
    hours: "40h",
    description:
      "La préparation complète de la spécialité NSI dans son nouveau format 2026 : partie pratique sur ordinateur, écrit de fond et Grand Oral de spécialité.",
    features: [
      "Préparation complète de la spécialité NSI",
      "Simulations de la partie pratique au format officiel 2026",
      "Préparation de l'écrit et du Grand Oral de spécialité",
      "Bilan individualisé + plan de révision final",
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
    icon: "monitor-smartphone",
    title: "NSI Terminale — Écrit",
    subtitle: "TERMINALE — Mono-matière",
    hours: "22h",
    description:
      "Consolider l'ensemble du programme écrit de NSI et s'entraîner au format de l'examen avec correction détaillée et bilan final.",
    features: [
      "Préparation complète de l'épreuve écrite de NSI",
      "Travail sur l'ensemble du programme",
      "Épreuve blanche + correction détaillée",
      "Plan de révision final",
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
    icon: "mic",
    title: "Grand Oral",
    subtitle: 'TERMINALE — Préparation complète',
    hours: "10h",
    isAddOn: true,
    description:
      "Pour construire deux questions solides, structurer une réponse convaincante et s'entraîner dans le format réel de l'épreuve : 10 minutes d'exposé + 10 minutes d'échange avec le jury.",
    features: [
      "Construction des deux questions et structuration de l'exposé",
      "Entraînement à l'échange avec le jury",
      "Simulations dans le format réel de l'épreuve",
      "Feedback individuel à chaque simulation",
    ],
    price: 350,
    earlyBird: 300,
    saving: 50,
    spots: 6,
    perHour: "30 TND/h",
    addOnLabel: "En complément d'un stage : 250 TND",
  },
];

export const TESTIMONIALS: Testimonial[] = [
  {
    name: "Yassine R.",
    role: "Terminale · Grand Oral",
    quote:
      "19/20 au Grand Oral alors que je perdais tous mes moyens en public. Le travail sur les questions et les simulations a tout changé.",
  },
  {
    name: "Lina M.",
    role: "Terminale NSI",
    quote:
      "Le format de la partie pratique m'était inconnu. Arriver le jour J en ayant déjà fait les simulations, ça change tout.",
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
      "J'ai enfin compris comment travailler les automatismes. Le cadre exigeant m'a forcé à progresser vraiment.",
  },
];

export const FAQS: FAQItem[] = [
  {
    question: "Comment choisir entre un pack et une formule mono-matière ?",
    answer:
      "Si l'élève a deux matières à préparer dans les mêmes délais, le pack est plus cohérent : une seule dynamique de travail, un tarif inférieur, et des épreuves blanches dans les deux matières. La formule mono-matière convient mieux quand une seule discipline concentre l'enjeu — par exemple, un élève qui gère bien le Français mais a besoin de renforcer uniquement les Maths.",
  },
  {
    question: "Le Grand Oral est-il inclus dans les stages ?",
    answer:
      "Il est inclus dans le Pack NSI Terminale Complet, sous la forme d'une préparation aux questions de spécialité. Pour tous les autres stages, il s'ajoute en option à 250 TND (au lieu de 300 TND en solo). La combinaison stage + Grand Oral est fréquemment choisie par les élèves de Terminale.",
  },
  {
    question: "Que comprend exactement la préparation NSI ? La partie pratique est-elle travaillée ?",
    answer:
      "Oui. La partie pratique est au cœur du Pack NSI Complet : entraînement sur ordinateur dans le format officiel 2026, simulations chronométrées et correction par dialogue avec un examinateur. Le stage NSI Écrit se concentre quant à lui sur la partie écrite (algorithmique, structures, SQL). Chaque formule est clairement délimitée.",
  },
  {
    question: "Les stages conviennent-ils aux candidats libres ?",
    answer:
      "Oui, avec une précision importante : les candidats individuels sont dispensés de l'épreuve pratique NSI. Si vous êtes candidat libre et préparez NSI, le stage Écrit est le plus adapté. Pour le Français, les Maths et le Grand Oral, les stages conviennent pleinement aux candidats libres.",
  },
  {
    question: "Comment se déroule une journée type ?",
    answer:
      "Matin (9h–12h30) : cours structuré + exercices avec correction immédiate. Après-midi (14h–17h30) : consolidation, simulations ou coaching oral selon le stage. Les groupes sont petits — 6 élèves maximum — ce qui permet un rythme soutenu et des interventions individualisées tout au long de la journée.",
  },
  {
    question: "Les groupes sont-ils vraiment limités à 6 élèves ?",
    answer:
      "Oui, sans exception. C'est un choix structurant : au-delà de 6, la correction individuelle devient symbolique. En dessous, chaque élève reçoit de l'attention, du feedback et des corrections sur ses propres erreurs, pas des corrections génériques.",
  },
  {
    question: "Que se passe-t-il après l'inscription ?",
    answer:
      "Vous recevez une confirmation avec le programme détaillé, les horaires, l'adresse et les informations pratiques. Un point d'orientation est possible si l'élève hésite entre deux formules. Le stage commence le 18 avril ; les places sont confirmées dans l'ordre des inscriptions.",
  },
  {
    question: "Jusqu'à quand le tarif Early Bird est-il valable ?",
    answer:
      "Le tarif Early Bird est valable jusqu'au 12 avril 2026. Passé cette date, le tarif normal s'applique. Les places étant limitées, l'inscription précoce permet à la fois de bénéficier du tarif préférentiel et de sécuriser sa place dans le groupe.",
  },
  {
    question: "Le stage remplace-t-il les révisions personnelles ou les structure-t-il ?",
    answer:
      "Il les structure. À l'issue de chaque stage, l'élève repart avec un bilan individualisé et un plan de révision clair pour les semaines suivantes. L'objectif n'est pas de tout couvrir en une semaine, mais de poser la méthode, de mesurer les points faibles et de repartir avec une feuille de route concrète.",
  },
  {
    question: "Les stages sont-ils adaptés à un élève déjà bon qui vise une mention ?",
    answer:
      "Oui. Le niveau d'exigence est adapté au profil de chaque groupe. Un élève solide va travailler la précision, la gestion du temps et les points susceptibles de faire la différence entre 14/20 et 17/20. Le cadre de travail profite autant à ceux qui veulent consolider qu'à ceux qui veulent progresser nettement.",
  },
  {
    question: "Que se passe-t-il si l'élève hésite entre deux formules ?",
    answer:
      "Contactez-nous sur WhatsApp avant de réserver. On prend le temps de comprendre le profil, les enjeux et les délais pour orienter vers la formule la plus utile. Il n'y a pas de bonne réponse universelle : tout dépend des matières concernées, de l'état actuel et des échéances prioritaires.",
  },
];

export const GRAND_ORAL_DAYS: GrandOralDay[] = [
  {
    day: 1,
    title: "Construction des Questions",
    description:
      "Travail approfondi sur les deux questions : formulation, problématisation, vérification de la solidité du propos. Livrable : deux questions finalisées, prêtes à défendre.",
    skill: "Questions maîtrisées",
    icon: "target",
  },
  {
    day: 2,
    title: "Architecture de la Réponse",
    description:
      "Structurer les 10 minutes d'exposé : introduction accrochée, développement clair, conclusion orientée projet. Script travaillé sans notes.",
    skill: "Structure claire",
    icon: "book-open",
  },
  {
    day: 3,
    title: "Maîtrise de la Forme",
    description:
      "Posture, voix, gestion du temps, silences stratégiques. Enregistrement vidéo + débriefing individuel.",
    skill: "Présence maîtrisée",
    icon: "camera",
  },
  {
    day: 4,
    title: "L'Échange avec le Jury",
    description:
      "Entraînement aux 10 minutes d'échange : rebond argumenté, humilité intelligente, défense du projet d'orientation face aux questions déstabilisantes.",
    skill: "Argumentation",
    icon: "message-circle",
  },
  {
    day: 5,
    title: "Simulation Complète",
    description:
      "Passage en conditions réelles : 20 minutes de préparation + 20 minutes d'épreuve (exposé + échange jury). Feedback final détaillé.",
    skill: "Prêt le jour J",
    icon: "trophy",
  },
];

export const PRICING_ROWS: PricingRow[] = [
  { label: "Français 1ère", hours: "22h", earlyBird: 550, normal: 650, classic: "880", popular: false },
  { label: "Maths 1ère", hours: "22h", earlyBird: 550, normal: 650, classic: "880", popular: false },
  { label: "Pack Doublé 1ère (Fr+Maths)", hours: "40h", earlyBird: 950, normal: 1100, classic: "1 600", popular: true },
  { label: "Maths Terminale", hours: "30h", earlyBird: 690, normal: 850, classic: "1 200", popular: false },
  { label: "NSI Terminale (écrit)", hours: "22h", earlyBird: 550, normal: 650, classic: "880", popular: false },
  { label: "Pack NSI Terminale Complet", hours: "40h", earlyBird: 990, normal: 1200, classic: "1 600+", popular: true },
  { label: "Grand Oral (solo)", hours: "10h", earlyBird: 300, normal: 350, classic: "—", popular: false },
  { label: "Grand Oral (+ stage)", hours: "10h", earlyBird: 250, normal: 300, classic: "—", popular: false },
  { label: "Simulation finale (veille examen)", hours: "1h", earlyBird: 60, normal: 60, classic: "—", popular: false },
];
