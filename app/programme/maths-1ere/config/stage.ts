/**
 * Configuration officielle du stage de printemps Nexus 2026
 * Dates : 20 Avril - 1er Mai 2026
 * Volume Maths : 14h
 */

export interface SeanceStage {
  date: string; // ISO format YYYY-MM-DD
  theme: string;
  duree: number; // en heures
  objectifs: string[];
  competences: string[];
  format: 'cours' | 'pratique' | 'blanc' | 'bilan';
  chapitresClés: string[];
}

export const STAGE_PRINTEMPS_2026 = {
  nom: "Stage de Printemps 2026 — Maths & Français",
  periode: "20 Avril au 1er Mai 2026",
  heuresMaths: 14,
  heuresFrancais: 16,
  seances: [
    {
      date: "2026-04-20",
      theme: "Fondamentaux : Algèbre et Second Degré",
      duree: 2,
      objectifs: ["Maîtriser le discriminant", "Factorisation rapide", "Signe du trinôme"],
      competences: ["ANALYSER", "CALCULER"],
      format: "cours",
      chapitresClés: ["second-degre"]
    },
    {
      date: "2026-04-21",
      theme: "Géométrie : Produit Scalaire et Applications",
      duree: 2,
      objectifs: ["Calculs de longueurs et d'angles", "Équations de cercles", "Orthogonalité"],
      competences: ["REPRÉSENTER", "CALCULER"],
      format: "cours",
      chapitresClés: ["produit-scalaire"]
    },
    {
      date: "2026-04-22",
      theme: "Suites Numériques : Modélisation et Limites",
      duree: 2,
      objectifs: ["Suites arithmétiques/géométriques", "Sommes de termes", "Sens de variation"],
      competences: ["MODÉLISER", "REPRÉSENTER"],
      format: "pratique",
      chapitresClés: ["suites-numeriques"]
    },
    {
      date: "2026-04-23",
      theme: "Analyse : Dérivation et Variations (Partie 1)",
      duree: 2,
      objectifs: ["Calcul de dérivées", "Tableau de variations", "Tangentes"],
      competences: ["CALCULER", "RAISONNER"],
      format: "cours",
      chapitresClés: ["derivation-variations"]
    },
    {
      date: "2026-04-24",
      theme: "Analyse : Dérivation et Convexité (Partie 2)",
      duree: 2,
      objectifs: ["Dérivée seconde", "Convexité", "Points d'inflexion"],
      competences: ["ANALYSER", "RAISONNER"],
      format: "cours",
      chapitresClés: ["derivation-variations"]
    },
    {
      date: "2026-04-27",
      theme: "Probabilités : Conditionnement et Variables",
      duree: 2,
      objectifs: ["Arbres pondérés", "Indépendance", "Espérance et Écart-type"],
      competences: ["COMMUNIQUER", "CALCULER"],
      format: "pratique",
      chapitresClés: ["probabilites-conditionnelles", "variables-aleatoires"]
    },
    {
      date: "2026-04-29",
      theme: "Épreuve Blanche : Format Anticipé 2026",
      duree: 2,
      objectifs: ["Gestion du temps (2h)", "Automatismes (20 min)", "Rédaction stratégique"],
      competences: ["TOUTES"],
      format: "blanc",
      chapitresClés: []
    },
    {
      date: "2026-04-30",
      theme: "Bilan Final : Analyse et Plan de Révision",
      duree: 2,
      objectifs: ["Correction détaillée", "Identification des points de vigilance", "Plan personnalisé"],
      competences: ["AUTO-ÉVALUATION"],
      format: "bilan",
      chapitresClés: []
    }
  ] as SeanceStage[]
};

/**
 * Récupère la séance du jour si elle existe
 */
export function getTodaySession(): SeanceStage | null {
  const today = new Date().toISOString().split('T')[0];
  return STAGE_PRINTEMPS_2026.seances.find(s => s.date === today) || null;
}

/**
 * Récupère la prochaine séance à venir
 */
export function getNextSession(): SeanceStage | null {
  const today = new Date().toISOString().split('T')[0];
  return STAGE_PRINTEMPS_2026.seances.find(s => s.date > today) || null;
}

/**
 * Formatage d'une date en français (ex: "Lundi 20 Avril")
 */
export function formatDateFr(dateStr: string): string {
  const date = new Date(dateStr);
  return new Intl.DateTimeFormat('fr-FR', { weekday: 'long', day: 'numeric', month: 'long' }).format(date);
}
