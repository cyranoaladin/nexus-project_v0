import { DomainKey } from "./qcmData";

export type PedagoAnswers = {
  motivation?: string; // e.g., "examens" | "comprendre" | ...
  projects?: string;
  fears?: string;
  confidence?: number; // 1..5
  style?: "visuel" | "auditif" | "kinesthesique";
  rhythm?: "regulier" | "intensif";
  dayTime?: "matin" | "apresmidi" | "soir";
  methods?: string[]; // ["exos","videos","fiches","groupe","quiz","apps"]
  weeklyTime?: number; // hours
  planning?: boolean;
  difficulties?: string[]; // ["dys","tdah","anxiete", ...]
  environment?: { quiet?: boolean; hasDevice?: boolean; alone?: boolean };
  expectations?: string[]; // ["guidage","autonomie","defis","suivi","bilans","exos"]
};

export type PedagoProfile = {
  style: string;
  rhythm: string;
  motivation: string;
  confidence: number;
  risks: string[]; // dys/tdah/anxiete flags
  methods: string[];
  environment: string[];
  expectations: string[];
};

export function analyzePedago(a: PedagoAnswers): PedagoProfile {
  const profile: PedagoProfile = {
    style: a.style || "mixte",
    rhythm: a.rhythm || "regulier",
    motivation: a.motivation || "mixte",
    confidence: a.confidence ?? 3,
    risks: a.difficulties || [],
    methods: a.methods || [],
    environment: [
      a.environment?.quiet ? "calme" : "agité",
      a.environment?.hasDevice ? "outillé" : "limité",
      a.environment?.alone ? "solo" : "accompagné",
    ],
    expectations: a.expectations || [],
  };
  return profile;
}

export type DomainSynthesis = {
  domain: DomainKey;
  percent: number;
};

export type FinalSynthesis = {
  forces: DomainKey[];
  faiblesses: DomainKey[];
  risques: string[];
  feuilleDeRoute: string[];
  offers: { primary: string; alternatives: string[]; reasoning: string };
};

export function synthesize(
  domains: DomainSynthesis[],
  pedago: PedagoProfile
): FinalSynthesis {
  const forces = domains.filter(d => d.percent >= 75).map(d => d.domain);
  const faiblesses = domains.filter(d => d.percent < 50).map(d => d.domain);
  const risques = pedago.risks || [];

  const feuilleDeRoute: string[] = [];
  if (faiblesses.length) {
    feuilleDeRoute.push(
      `Semaines 1–4: refaire automatismes sur ${faiblesses.join(", ")}, exos progressifs, fiches synthèse.`
    );
  }
  feuilleDeRoute.push(
    `Semaines 5–8: approfondissements ciblés, problèmes type bac, révisions actives.`
  );
  if (risques.includes("dys") || risques.includes("tdah") || risques.includes("anxiete")) {
    feuilleDeRoute.push(
      `Adaptations pédagogiques: consignes claires, fractionnement des tâches, temps supplémentaires, pauses.`
    );
  }

  // Règles simples d’offre
  let primary = "Cortex"; // autonome & homogène
  const alternatives: string[] = ["Studio Flex"];
  let reasoning = "Profil équilibré recommandé pour Cortex (autonomie) et Studio Flex en renfort.";

  const avg = domains.reduce((s, d) => s + d.percent, 0) / Math.max(1, domains.length);
  if (faiblesses.length >= 2 || avg < 55) {
    primary = "Académies";
    alternatives.push("Odyssée");
    reasoning = "Plusieurs domaines fragiles: accompagnement intensif via Académies. Odyssée si objectif mention/Parcoursup.";
  } else if (faiblesses.length === 1 || avg < 65) {
    primary = "Studio Flex";
    alternatives.push("Académies");
    reasoning = "Une ou deux lacunes ciblées: Studio Flex pour interventions ponctuelles. Académies si besoin d’intensif.";
  }

  return { forces, faiblesses, risques, feuilleDeRoute, offers: { primary, alternatives, reasoning } };
}

