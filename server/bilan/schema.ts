import { z } from "zod";

export const BilanOutSchema = z.object({
  intro_text: z.string().describe("Texte d'introduction pour le rapport."),
  diagnostic_text: z.string().describe("Analyse détaillée du diagnostic académique."),
  profile_text: z.string().describe("Description du profil pédagogique de l'élève."),
  roadmap_text: z.string().describe("Feuille de route suggérée pour les 3-6 prochains mois."),
  offers_text: z.string().describe("Recommandations d'offres Nexus adaptées."),
  conclusion_text: z.string().describe("Conclusion du rapport, adaptée à la variante (parent/élève)."),
  table_domain_rows: z.array(z.object({
    domain: z.string().describe("Nom du domaine de compétence (ex: Algèbre)."),
    points: z.number().describe("Points obtenus par l'élève dans ce domaine."),
    max: z.number().describe("Nombre de points maximum pour ce domaine."),
    masteryPct: z.number().describe("Pourcentage de maîtrise (points/max * 100)."),
    remark: z.string().optional().describe("Remarque qualitative sur la performance dans ce domaine."),
  })).describe("Lignes du tableau des scores par domaine."),
});

export const AdminSummarySchema = z.object({
  riskAnalysis: z.string().describe("Courte analyse des risques principaux (académiques, motivationnels, etc.)."),
  criticalPoints: z.array(z.string()).describe("Liste des 2-3 points les plus critiques à adresser."),
  offerRecommendation: z.string().describe("Recommandation de l'offre Nexus la plus adaptée et justification."),
  nextSteps: z.array(z.string()).describe("Liste des 2-3 prochaines étapes concrètes à proposer à la famille."),
});

export type BilanOut = z.infer<typeof BilanOutSchema>;
export type AdminSummaryOut = z.infer<typeof AdminSummarySchema>;
