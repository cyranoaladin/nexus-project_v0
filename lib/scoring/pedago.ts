// Simplified scoring adapters for Volet 2 indices
export type PedagoAnswers = Record<string, any>;

export function computeIndices(answers: PedagoAnswers) {
  // Map some Likert-like fields to normalized scales; placeholders aligned with V2 doc
  const to01 = (v: any, max: number) => Math.max(0, Math.min(1, Number(v) / max || 0));
  const idxAutonomie = to01(answers?.B_AUTONOMIE ?? answers?.autonomie, 5) * 5; // 0..5
  const idxOrganisation = to01(answers?.B_ORGA ?? answers?.organisation, 10) * 10; // 0..10
  const idxMotivation = to01(answers?.B_MOTIV ?? answers?.motivation, 5) * 5; // 0..5
  const idxStress = to01(answers?.B_STRESS ?? answers?.stress, 5) * 5; // 0..5
  const idxConcentration = to01(answers?.B_CONC ?? answers?.concentration, 4) * 4; // 0..4
  const idxMemorisation = to01(answers?.B_MEMO ?? answers?.memorisation, 4) * 4; // 0..4
  const idxAnalyseSynthese = to01(answers?.B_ANALYSE ?? answers?.analyse, 4) * 4; // 0..4
  const idxSuspectDys = to01(answers?.B_DYS ?? answers?.suspect_dys, 4) * 4; // 0..4
  return {
    IDX_AUTONOMIE: Number(idxAutonomie.toFixed(2)),
    IDX_ORGANISATION: Number(idxOrganisation.toFixed(2)),
    IDX_MOTIVATION: Number(idxMotivation.toFixed(2)),
    IDX_STRESS: Number(idxStress.toFixed(2)),
    IDX_CONCENTRATION: Number(idxConcentration.toFixed(2)),
    IDX_MEMORISATION: Number(idxMemorisation.toFixed(2)),
    IDX_ANALYSE_SYNTHESE: Number(idxAnalyseSynthese.toFixed(2)),
    IDX_SUSPECT_DYS: Number(idxSuspectDys.toFixed(2)),
  };
}

// Types étendus (facultatifs) pour analyse fine
export type DomainKey = string;
export type PedagoAnswersExtended = {
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
  environment?: { quiet?: boolean; hasDevice?: boolean; alone?: boolean; };
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

export function analyzePedago(a: PedagoAnswersExtended): PedagoProfile {
  const profile: PedagoProfile = {
    style: a.style || "mixte",
    rhythm: a.rhythm || "regulier",
    motivation: Array.isArray(a.motivation) ? a.motivation.join(", ") : (a.motivation || "mixte"),
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
  domain: string;
  percent: number;
};

export type FinalSynthesis = {
  forces: DomainKey[];
  faiblesses: DomainKey[];
  risques: string[];
  feuilleDeRoute: string[];
  offers: { primary: string; alternatives: string[]; reasoning: string; };
};

export function synthesize(
  domains: DomainSynthesis[],
  pedago: PedagoProfile,
  opts?: { statut?: string; }
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

  // Règles de décision (matrice Nexus)
  const avg = domains.reduce((s, d) => s + d.percent, 0) / Math.max(1, domains.length);
  const weak = faiblesses.length;
  const autonomieFaible = pedago.expectations?.includes('guidage') || pedago.expectations?.includes('suivi');
  const motivationText = typeof pedago.motivation === 'string'
    ? pedago.motivation
    : Array.isArray((pedago as any).motivation)
      ? (pedago as any).motivation.join(' ')
      : String((pedago as any).motivation ?? '');
  const motivationFaible = motivationText.toLowerCase().includes('faible');

  let primary = "Cortex";
  const alternatives: string[] = [];
  let reasoning = "Profil autonome et homogène: Cortex (IA 24/7) recommandé.";

  if ((opts?.statut || '').toLowerCase().includes('candidat')) {
    primary = "Odyssée Candidat Libre";
    reasoning = "Statut candidat libre: besoin d’un cadre complet qui remplace le lycée.";
    alternatives.push("Académies");
  } else if (avg >= 70 && weak <= 1 && !autonomieFaible) {
    primary = "Cortex";
    alternatives.push("Académies");
    reasoning = "Très bon niveau et autonomie: Cortex convient; Académies pour perfectionnement ciblé.";
  } else if (avg >= 55 && weak <= 2 && !motivationFaible) {
    primary = "Studio Flex";
    alternatives.push("Cortex", "Académies");
    reasoning = "Niveau correct avec 1–2 lacunes: Studio Flex en renfort ciblé, Cortex/Académies en complément.";
  } else if (avg >= 40 && weak >= 2) {
    primary = "Académies";
    alternatives.push("Odyssée");
    reasoning = "Plusieurs faiblesses: stage intensif Académies; Odyssée si projet mention/Parcoursup.";
  } else if (avg < 55 || autonomieFaible || motivationFaible) {
    primary = "Odyssée";
    alternatives.push("Studio Flex");
    reasoning = "Besoin d’un suivi structurant: Odyssée recommandé, Flex pour renfort ponctuel.";
  }

  return { forces, faiblesses, risques, feuilleDeRoute, offers: { primary, alternatives, reasoning } };
}
