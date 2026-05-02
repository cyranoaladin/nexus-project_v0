import { createMistralJsonCompletion } from '@/lib/llm/mistral';
import type { StageReportContext } from './buildReportContext';
import { premiumPedagogicalReportSchemaDescription } from './schema';

export async function generateStructuredReportWithMistral(
  context: StageReportContext,
): Promise<{ json: unknown; modelUsed: string }> {
  const systemPrompt = `Tu es un expert en ingénierie pédagogique, en évaluation formative et en rédaction de bilans scolaires premium pour élèves de lycée.

Tu dois produire un bilan pédagogique structuré, bienveillant, précis, professionnel et utile pour trois publics : l'élève, les parents et le coach pédagogique.

Règles strictes :
- retourne uniquement du JSON valide ;
- ne retourne jamais de Markdown ;
- ne retourne jamais de LaTeX ;
- ne retourne aucun commentaire hors JSON ;
- respecte strictement les données fournies dans le contexte ;
- n'invente jamais de note, présence, progression, difficulté, qualité personnelle, diagnostic, information familiale ou information médicale ;
- si une donnée manque, signale-la dans qualityFlags.missingData ou qualityFlags.uncertainties.`;

  const userPrompt = `Voici le contexte canonique d'un bilan de stage Nexus Réussite.

Contexte JSON :
${JSON.stringify(context)}

Schéma de sortie obligatoire :
${premiumPedagogicalReportSchemaDescription}

Réponds avec le JSON seulement.`;

  const completion = await createMistralJsonCompletion(
    [
      { role: 'system', content: systemPrompt },
      { role: 'user', content: userPrompt },
    ],
    { temperature: 0.2 },
  );

  return { json: completion.json, modelUsed: completion.model };
}
