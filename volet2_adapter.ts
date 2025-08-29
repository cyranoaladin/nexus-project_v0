/*
  Nexus Réussite — Volet 2 Adapter & Scoring (TypeScript)
  -------------------------------------------------------
  - Normalise les réponses du Volet 2 (questionnaire pédagogique enrichi)
  - Calcule les indices (Autonomie, Organisation, Motivation, Stress, Signaux d'appel)
  - Prépare un payload unifié pour Dashboard & PDF (radars, badges, portraits)

  Utilisation rapide :
  import { normalizeVolet2 } from "./volet2_adapter";
  const { indices, portrait, exportPayload } = normalizeVolet2(answers);

  Où `answers` est un Record<string, unknown> avec des clés A1..H2.
*/

// ---------------------- Types & constantes ----------------------

export type Answer = string | number | boolean | null | string[];
export type Answers = Record<string, Answer>;

export type LikertName = "AGREE5" | "FREQ4" | "CONF4" | "MOTIV5" | "STRESS5";

export type IndexValue = {
  id: string;
  label: string;
  value: number; // valeur normalisée (1..5 ou 0..10 selon l'indice)
  scale?: { min: number; max: number };
  band?: string; // fourchette textuelle
  interpretation: string; // texte court
};

export type Indices = {
  AUTONOMIE: IndexValue;
  ORGANISATION: IndexValue;
  MOTIVATION: IndexValue;
  STRESS: IndexValue;
  SUSPECT_DYS: IndexValue;
};

export type Portrait = {
  styleVARK?: string[];
  cycleKolb?: string[];
  strategies?: string[];
  rapportErreur?: string | undefined;
  confiance?: string | undefined;
  stress?: string | undefined;
  pointsVigilance?: string[];
  resume: string; // synthèse narrative courte
};

export type PdfRadars = Array<{
  title: string;
  axes: string[];
  values: number[];
}>;

export type PdfBadges = Array<{ id: string; label: string }>;

export type ExportPayload = {
  indices: Indices;
  radars: PdfRadars;
  badges: PdfBadges;
  mapping: Record<string, Answer>;
};

// Likert mappings → valeurs numériques
const LIKERT: Record<LikertName, Record<string, number>> = {
  AGREE5: {
    "Pas du tout d'accord": 1,
    "Plutôt pas d'accord": 2,
    "Neutre": 3,
    "Plutôt d'accord": 4,
    "Tout à fait d'accord": 5,
  },
  FREQ4: {
    Jamais: 1,
    Rarement: 2,
    Souvent: 3,
    "Très souvent": 4,
  },
  CONF4: {
    Faible: 1,
    Moyenne: 2,
    Bonne: 3,
    "Très bonne": 4,
  },
  MOTIV5: {
    "Très faible": 1,
    Faible: 2,
    Moyenne: 3,
    Bonne: 4,
    "Très élevée": 5,
  },
  STRESS5: {
    "Très faible": 1,
    Faible: 2,
    Modéré: 3,
    Élevé: 4,
    "Très élevé": 5,
  },
};

// Utilitaires numériques
const mean = (arr: number[]) => (arr.length ? arr.reduce((a, b) => a + b, 0) / arr.length : 0);
const clamp = (x: number, min: number, max: number) => Math.max(min, Math.min(max, x));

// Récupère la valeur likert numérique d'une réponse texte
function likertValue(scale: LikertName, ans?: Answer): number | null {
  if (ans == null) return null;
  const m = LIKERT[scale];
  if (typeof ans === "string" && ans in m) return m[ans as keyof typeof m];
  return null;
}

function mapLikertAvg(scale: LikertName, ids: string[], answers: Answers): number {
  const arr = ids
    .map((id) => likertValue(scale, answers[id]))
    .filter((v): v is number => typeof v === "number");
  return mean(arr);
}

// ---------------------- Scoring auxiliaires (Organisation) ----------------------

// B1 : organisation du travail
// "Planning écrit détaillé" > "Organisation mentale" > "Au jour le jour" > "Je ne planifie que les évaluations"
function scorePlan(b1?: Answer): number {
  switch (b1) {
    case "Planning écrit détaillé":
      return 3;
    case "Organisation mentale (sans planning)":
      return 2;
    case "Au jour le jour":
      return 1;
    case "Je ne planifie que les évaluations importantes":
      return 1.5;
    default:
      return 0;
  }
}

// B2a/B2b : heures/semaine → plus on déclare un volume raisonnable, meilleur le score (plateau)
// Catégories: "0 h", "<1 h", "1–3 h", "3–5 h", "5–8 h", ">8 h"
function hoursCategoryToScore(opt?: Answer): number {
  switch (opt) {
    case "0 h":
      return 0;
    case "<1 h":
      return 0.5;
    case "1–3 h":
      return 1.5;
    case "3–5 h":
      return 2.5;
    case "5–8 h":
      return 3;
    case ">8 h":
      return 2.5; // décote légère (risque surcharge inefficace)
    default:
      return 0;
  }
}

function scoreHours(ids: string[], answers: Answers): number {
  return ids.reduce((s, id) => s + hoursCategoryToScore(answers[id]), 0); // max ≈ 6
}

// B6 : sommeil
function scoreSleep(opt?: Answer): number {
  switch (opt) {
    case "<6 h":
      return 0;
    case "6–7 h":
      return 1.5;
    case "7–8 h":
      return 2.5;
    case ">8 h":
      return 2;
    default:
      return 0;
  }
}

// B7 : temps d'écran (hors travail) — score négatif
function scoreScreen(opt?: Answer): number {
  switch (opt) {
    case "<1 h":
      return 0; // aucun malus
    case "1–2 h":
      return -0.5;
    case "2–3 h":
      return -1;
    case "3–4 h":
      return -1.5;
    case ">4 h":
      return -2.5;
    default:
      return 0;
  }
}

// ---------------------- Interprétations ----------------------

function bandText(value: number, bands: Array<{ range: [number, number]; text: string }>): string {
  const hit = bands.find((b) => value >= b.range[0] && value <= b.range[1]);
  return hit ? hit.text : "";
}

// ---------------------- Calcul des indices ----------------------

function computeIndices(answers: Answers): Indices {
  // AUTONOMIE = moyenne (C8, H1, H2) sur AGREE5 → 1..5
  const auto = mapLikertAvg("AGREE5", ["C8", "H1", "H2"], answers);
  const autoText = bandText(auto, [
    { range: [0, 2.0], text: "Autonomie à structurer : besoin d'un cadre et d'un suivi rapproché." },
    { range: [2.01, 3.5], text: "Autonomie intermédiaire : routines à stabiliser, coaching ponctuel utile." },
    { range: [3.51, 5], text: "Bonne autonomie : Cortex + objectifs ambitieux possibles." },
  ]);

  // ORGANISATION (0..10)
  const orgRaw =
    scorePlan(answers["B1"]) +
    scoreHours(["B2a", "B2b"], answers) +
    scoreSleep(answers["B6"]) +
    scoreScreen(answers["B7"]);
  const org = clamp(orgRaw, 0, 10);
  const orgText = bandText(org, [
    { range: [0, 4], text: "Organisation fragile : proposer planning guidé + Studio Flex." },
    { range: [4.01, 7], text: "Organisation correcte : consolider outils numériques et rituels." },
    { range: [7.01, 10], text: "Organisation solide : autonomie compatible avec Cortex." },
  ]);

  // MOTIVATION 1..5
  const mot = likertValue("MOTIV5", answers["D3"]) ?? 0;
  const motText = bandText(mot, [
    { range: [1, 2], text: "Motivation faible : activer leviers projet/valeur, objectifs courts." },
    { range: [2.01, 4], text: "Motivation moyenne : gains rapides, feedbacks fréquents." },
    { range: [4.01, 5], text: "Motivation élevée : autoriser accélération (Académies/avancé)." },
  ]);

  // STRESS 1..5 (plus haut = plus de stress)
  const stress = likertValue("STRESS5", answers["E4"]) ?? 0;
  const stressText = bandText(stress, [
    { range: [1, 2], text: "Stress faible à modéré : OK." },
    { range: [2.01, 4], text: "Stress notable : techniques (respiration, rétro‑planning, sujets blancs)." },
    { range: [4.01, 5], text: "Stress élevé : coaching méthodo + simulations encadrées." },
  ]);

  // SUSPECT_DYS (1..4)
  const dys = mapLikertAvg("FREQ4", ["G1", "G2", "G3", "G4", "G5", "G6"], answers);
  const dysText = bandText(dys, [
    { range: [0, 1.5], text: "Peu de signaux." },
    { range: [1.51, 2.5], text: "Surveiller, ajuster ergonomie et consignes." },
    { range: [2.51, 4], text: "Plusieurs signaux : conseiller avis professionnel (orthophoniste/neuropsy)." },
  ]);

  return {
    AUTONOMIE: {
      id: "IDX_AUTONOMIE",
      label: "Autonomie d'apprentissage",
      value: Number(auto.toFixed(2)),
      scale: { min: 1, max: 5 },
      interpretation: autoText,
    },
    ORGANISATION: {
      id: "IDX_ORGANISATION",
      label: "Organisation & gestion du temps",
      value: Number(org.toFixed(2)),
      scale: { min: 0, max: 10 },
      interpretation: orgText,
    },
    MOTIVATION: {
      id: "IDX_MOTIVATION",
      label: "Motivation perçue",
      value: Number(mot.toFixed(2)),
      scale: { min: 1, max: 5 },
      interpretation: motText,
    },
    STRESS: {
      id: "IDX_STRESS",
      label: "Stress aux évaluations",
      value: Number(stress.toFixed(2)),
      scale: { min: 1, max: 5 },
      interpretation: stressText,
    },
    SUSPECT_DYS: {
      id: "IDX_SUSPECT_DYS",
      label: "Signaux d'appel DYS/TDAH (auto‑perçus)",
      value: Number(dys.toFixed(2)),
      scale: { min: 1, max: 4 },
      interpretation: dysText,
    },
  };
}

// ---------------------- Portrait pédagogique (narratif) ----------------------

function buildPortrait(answers: Answers, idx: Indices): Portrait {
  const styleVARK = (answers["C2"] as string[] | undefined) ?? [];
  const cycleKolb = (answers["C3"] as string[] | undefined) ?? [];
  const strategies = (answers["C4"] as string[] | undefined) ?? [];
  const rapportErreur = (answers["E1"] as string | undefined) ?? undefined;
  const confiance = (answers["E3"] as string | undefined) ?? undefined; // étiquette Likert brute
  const stress = (answers["E4"] as string | undefined) ?? undefined; // étiquette Likert brute

  const pointsVigilance: string[] = [];
  if (idx.ORGANISATION.value < 4) pointsVigilance.push("Organisation fragile (planning à mettre en place)");
  if (idx.MOTIVATION.value <= 2) pointsVigilance.push("Motivation basse : fixer des objectifs courts, concrets");
  if (idx.STRESS.value >= 4) pointsVigilance.push("Stress élevé aux évaluations : simulations, respiration, rétro‑planning");
  if (idx.SUSPECT_DYS.value >= 2.6)
    pointsVigilance.push("Plusieurs signaux d'appel : envisager un avis professionnel (orthophoniste/neuropsy)");

  const resume = `Profil ${styleVARK.join("/") || "mixte"} ; autonomie ${idx.AUTONOMIE.value}/5 ; organisation ${idx.ORGANISATION.value}/10 ; motivation ${idx.MOTIVATION.value}/5 ; stress ${idx.STRESS.value}/5. ${
    pointsVigilance.length ? "Points de vigilance : " + pointsVigilance.join(" ; ") + "." : ""
  }`;

  return { styleVARK, cycleKolb, strategies, rapportErreur, confiance, stress, pointsVigilance, resume };
}

// ---------------------- Badges & Radars (PDF) ----------------------

function buildBadges(idx: Indices, answers: Answers): PdfBadges {
  const badges: PdfBadges = [];
  if (idx.AUTONOMIE.value >= 3.8) badges.push({ id: "BADGE_AUTONOME", label: "Autonomie solide" });
  if (idx.ORGANISATION.value >= 7) badges.push({ id: "BADGE_ORGA", label: "Organisation efficace" });
  if (answers["E1"] === "Analyser les erreurs") badges.push({ id: "BADGE_PERSO", label: "Capacité de feedback" });
  return badges;
}

function buildRadars(idx: Indices): PdfRadars {
  return [
    {
      title: "Indices pédagogiques",
      axes: ["Autonomie", "Organisation", "Motivation", "Stress"],
      values: [idx.AUTONOMIE.value, idx.ORGANISATION.value, idx.MOTIVATION.value, idx.STRESS.value],
    },
  ];
}

// ---------------------- Normalisation principale ----------------------

export function normalizeVolet2(answers: Answers) {
  const indices = computeIndices(answers);
  const portrait = buildPortrait(answers, indices);
  const radars = buildRadars(indices);
  const badges = buildBadges(indices, answers);

  // mapping brut utile pour logs/export
  const mapping: Record<string, Answer> = { ...answers };

  const exportPayload: ExportPayload = {
    indices,
    radars,
    badges,
    mapping,
  };

  return {
    indices,
    portrait,
    exportPayload,
  };
}

// ---------------------- Helpers exportés (si besoin côté app) ----------------------

export const _internal = {
  LIKERT,
  likertValue,
  mapLikertAvg,
  scorePlan,
  scoreHours,
  scoreSleep,
  scoreScreen,
  mean,
  clamp,
};

