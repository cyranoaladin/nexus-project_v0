/**
 * Configuration officielle du stage de printemps Nexus 2026
 * Réseau AEFE Tunisie — Classe de Première
 * Période : 20 Avril – 1er Mai 2026
 * Total : 15 séances · 30h (Français 16h · Mathématiques 14h)
 *
 * Planning réel :
 * SEMAINE 1 (20-24 avr.)
 *   Lun 20 : FR 09h-11h + FR 13h30-15h30 (double mono)
 *   Mar 21 : FR 09h-11h + MA 11h30-13h30 (duo)
 *   Mer 22 : FR 09h-11h + MA 11h30-13h30 (duo)
 *   Jeu 23 : MA 11h30-13h30 (matinée libre)
 *   Ven 24 : FR 13h30-15h30 (matinée libre)
 * SEMAINE 2 (27 avr.–1er mai)
 *   Lun 27 : FR 09h-11h + MA 11h30-13h30 (duo)
 *   Mar 28 : FR 09h-11h + MA 11h30-13h30 (duo)
 *   Mer 29 : MA 09h-11h (mono matin, après-midi libre)
 *   Jeu 30 : FR 09h-11h (mono matin, après-midi libre)
 *   Ven 01 : MA 09h-11h (mono matin, après-midi libre)
 */

export interface SeanceStage {
  date: string;           // ISO format YYYY-MM-DD
  heureDebut: string;     // ex: "09:00"
  heureFin: string;       // ex: "11:00"
  matiere: 'Mathématiques' | 'Français';
  theme: string;
  duree: number;          // en heures
  objectifs: string[];
  competences: string[];
  format: 'cours' | 'pratique' | 'blanc' | 'bilan';
  chapitresClés: string[];
  journee: 'duo' | 'mono-matin' | 'mono-apres-midi' | 'double-mono'; // type de journée
}

export const STAGE_PRINTEMPS_2026 = {
  nom: "Stage de Printemps 2026 — Classe de Première",
  sousTitre: "Réseau AEFE Tunisie · Français · Mathématiques",
  periode: "20 Avril – 1er Mai 2026",
  debut: "20 Avril",
  fin: "1er Mai",
  totalSeances: 15,
  totalHeures: 30,
  heuresMaths: 14,
  heuresFrancais: 16,
  // Liste exhaustive des 15 séances (Français & Mathématiques)
  seances: [
    // --- SEMAINE 1 ---
    {
      date: "2026-04-20",
      heureDebut: "09:00",
      heureFin: "11:00",
      matiere: "Français",
      theme: "Français : Méthodologie et Analyse",
      duree: 2,
      objectifs: ["Commentaire de texte", "Analyse linéaire"],
      competences: ["ANALYSER", "RÉDIGER"],
      format: "cours",
      chapitresClés: [],
      journee: "double-mono"
    },
    {
      date: "2026-04-20",
      heureDebut: "13:30",
      heureFin: "15:30",
      matiere: "Français",
      theme: "Français : Étude d'œuvre intégrale",
      duree: 2,
      objectifs: ["Parcours associé", "Contexte historique"],
      competences: ["ANALYSER", "COMMUNIQUER"],
      format: "cours",
      chapitresClés: [],
      journee: "double-mono"
    },
    {
      date: "2026-04-21",
      heureDebut: "09:00",
      heureFin: "11:00",
      matiere: "Français",
      theme: "Français : Dissertation et Écrit",
      duree: 2,
      objectifs: ["Structure du plan", "Argumentation"],
      competences: ["RÉDIGER", "RAISONNER"],
      format: "cours",
      chapitresClés: [],
      journee: "duo"
    },
    {
      date: "2026-04-21",
      heureDebut: "11:30",
      heureFin: "13:30",
      matiere: "Mathématiques",
      theme: "Second Degré & Fonctions du Second Degré",
      duree: 2,
      objectifs: ["Maîtriser le discriminant", "Forme canonique et factorisation", "Signe du trinôme sur ℝ"],
      competences: ["CALCULER", "ANALYSER"],
      format: "cours",
      chapitresClés: ["second-degre"],
      journee: "duo"
    },
    {
      date: "2026-04-22",
      heureDebut: "09:00",
      heureFin: "11:00",
      matiere: "Français",
      theme: "Français : Préparation à l'Oral",
      duree: 2,
      objectifs: ["Lecture expressive", "Entretien"],
      competences: ["COMMUNIQUER"],
      format: "pratique",
      chapitresClés: [],
      journee: "duo"
    },
    {
      date: "2026-04-22",
      heureDebut: "11:30",
      heureFin: "13:30",
      matiere: "Mathématiques",
      theme: "Suites Numériques — Arithmétiques et Géométriques",
      duree: 2,
      objectifs: ["Terme général d'une suite", "Sens de variation", "Somme de termes"],
      competences: ["MODÉLISER", "CALCULER"],
      format: "cours",
      chapitresClés: ["suites"],
      journee: "duo"
    },
    {
      date: "2026-04-23",
      heureDebut: "11:30",
      heureFin: "13:30",
      matiere: "Mathématiques",
      theme: "Suites — Récurrence et Modélisation",
      duree: 2,
      objectifs: ["Suites définies par récurrence", "Démonstration par récurrence", "Modèles de croissance"],
      competences: ["RAISONNER", "MODÉLISER"],
      format: "pratique",
      chapitresClés: ["suites"],
      journee: "mono-apres-midi"
    },
    {
      date: "2026-04-24",
      heureDebut: "13:30",
      heureFin: "15:30",
      matiere: "Français",
      theme: "Français : Grammaire et Syntaxe",
      duree: 2,
      objectifs: ["Points de grammaire", "Analyse syntaxique"],
      competences: ["CONNAÎTRE", "RÉDIGER"],
      format: "cours",
      chapitresClés: [],
      journee: "mono-apres-midi"
    },
    // --- SEMAINE 2 ---
    {
      date: "2026-04-27",
      heureDebut: "09:00",
      heureFin: "11:00",
      matiere: "Français",
      theme: "Français : Corpus et Textes",
      duree: 2,
      objectifs: ["Lien entre les textes", "Synthèse"],
      competences: ["ANALYSER", "RÉDIGER"],
      format: "cours",
      chapitresClés: [],
      journee: "duo"
    },
    {
      date: "2026-04-27",
      heureDebut: "11:30",
      heureFin: "13:30",
      matiere: "Mathématiques",
      theme: "Dérivation — Calcul et Tableaux de Variations",
      duree: 2,
      objectifs: ["Calcul de dérivées (polynômes, quotients)", "Tableaux de variations", "Extrema locaux"],
      competences: ["CALCULER", "REPRÉSENTER"],
      format: "cours",
      chapitresClés: ["derivation", "variations-courbes"],
      journee: "duo"
    },
    {
      date: "2026-04-28",
      heureDebut: "09:00",
      heureFin: "11:00",
      matiere: "Français",
      theme: "Français : Perfectionnement Écrit",
      duree: 2,
      objectifs: ["Vocabulaire soutenu", "Transitions"],
      competences: ["RÉDIGER"],
      format: "pratique",
      chapitresClés: [],
      journee: "duo"
    },
    {
      date: "2026-04-28",
      heureDebut: "11:30",
      heureFin: "13:30",
      matiere: "Mathématiques",
      theme: "Probabilités — Conditionnelles et Bayes",
      duree: 2,
      objectifs: ["Arbres pondérés", "Formule des probabilités totales", "Formule de Bayes"],
      competences: ["CALCULER", "COMMUNIQUER"],
      format: "cours",
      chapitresClés: ["probabilites-cond"],
      journee: "duo"
    },
    {
      date: "2026-04-29",
      heureDebut: "09:00",
      heureFin: "11:00",
      matiere: "Mathématiques",
      theme: "Probabilités — Variables Aléatoires et Loi Binomiale",
      duree: 2,
      objectifs: ["Espérance et écart-type", "Loi binomiale B(n,p)", "Interprétation et modélisation"],
      competences: ["CALCULER", "MODÉLISER"],
      format: "pratique",
      chapitresClés: ["variables-aleatoires"],
      journee: "mono-matin"
    },
    {
      date: "2026-04-30",
      heureDebut: "09:00",
      heureFin: "11:00",
      matiere: "Français",
      theme: "Français : Examen Blanc",
      duree: 2,
      objectifs: ["Conditions réelles", "Gestion du temps"],
      competences: ["TOUTES"],
      format: "blanc",
      chapitresClés: [],
      journee: "mono-matin"
    },
    {
      date: "2026-05-01",
      heureDebut: "09:00",
      heureFin: "11:00",
      matiere: "Mathématiques",
      theme: "Épreuve Blanche — Format Officiel 2h",
      duree: 2,
      objectifs: ["Gestion du temps : automatismes (20 min) + exercices (100 min)", "Rédaction et justification", "Correction collective intégrale"],
      competences: ["TOUTES"],
      format: "blanc",
      chapitresClés: [],
      journee: "mono-matin"
    }
  ] as SeanceStage[],
  promessesNexus: [
    "Groupes réduits (max 8 élèves)",
    "Préparation structurée épreuve 2026",
    "Épreuves blanches en conditions réelles",
    "Corrections détaillées et personnalisées",
    "Bilan final individualisé",
    "Plan de révision post-stage"
  ]
};

// Dates de référence
export const DATE_DEBUT_STAGE = "2026-04-20";
export const DATE_FIN_STAGE = "2026-05-01";
export const DATE_EXAMEN_ANTICIPE = "2026-06-15"; // Date indicative Juin 2026

/**
 * Récupère la séance du jour si elle existe
 */
export function getTodaySession(baseDate?: Date, matiere?: 'Mathématiques' | 'Français'): SeanceStage | null {
  const d = baseDate || new Date();
  const today = d.toISOString().split('T')[0];
  const sessions = STAGE_PRINTEMPS_2026.seances.filter(s => s.date === today);
  
  if (matiere) {
    return (sessions.find(s => s.matiere === matiere) as SeanceStage) || null;
  }
  
  return (sessions[0] as SeanceStage) || null;
}

/**
 * Récupère la prochaine séance à venir
 */
export function getNextSession(baseDate?: Date, matiere?: 'Mathématiques' | 'Français'): SeanceStage | null {
  const d = baseDate || new Date();
  const today = d.toISOString().split('T')[0];
  const sessions = STAGE_PRINTEMPS_2026.seances.filter(s => s.date > today);
  
  if (matiere) {
    return (sessions.find(s => s.matiere === matiere) as SeanceStage) || null;
  }
  
  return (sessions[0] as SeanceStage) || null;
}

/**
 * Détermine la phase actuelle par rapport au stage
 */
export function getStagePhase(baseDate?: Date): 'avant' | 'pendant' | 'apres' {
  const d = baseDate || new Date();
  const today = d.toISOString().split('T')[0];
  if (today < DATE_DEBUT_STAGE) return 'avant';
  if (today > DATE_FIN_STAGE) return 'apres';
  return 'pendant';
}

/**
 * Calcule le nombre de jours avant le stage
 */
export function getDaysUntilStage(baseDate?: Date): number {
  const d = baseDate || new Date();
  const diff = new Date(DATE_DEBUT_STAGE).getTime() - d.getTime();
  return Math.max(0, Math.ceil(diff / (1000 * 60 * 60 * 24)));
}

/**
 * Calcule le nombre de jours avant l'examen
 */
export function getDaysUntilExam(baseDate?: Date): number {
  const d = baseDate || new Date();
  const diff = new Date(DATE_EXAMEN_ANTICIPE).getTime() - d.getTime();
  return Math.max(0, Math.ceil(diff / (1000 * 60 * 60 * 24)));
}

/**
 * Formatage d'une date en français (ex: "Lundi 20 Avril")
 */
export function formatDateFr(dateStr: string): string {
  const date = new Date(dateStr);
  return new Intl.DateTimeFormat('fr-FR', { weekday: 'long', day: 'numeric', month: 'long' }).format(date);
}

