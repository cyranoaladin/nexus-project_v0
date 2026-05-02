import OpenAI from 'openai';

const openai = new OpenAI({
  apiKey: process.env.OPENAI_API_KEY || 'ollama',
  baseURL: process.env.OPENAI_BASE_URL || undefined,
});

export async function generateStructuredReportWithMistral(contextJson: string, schemaDescription: string): Promise<any> {
  const model = process.env.OPENAI_MODEL || 'gpt-4o-mini';

  const systemPrompt = `Tu es un expert en ingénierie pédagogique, en évaluation formative et en rédaction de bilans scolaires premium pour élèves de lycée.

Tu dois produire un bilan pédagogique structuré, bienveillant, précis, professionnel et utile pour trois publics :
1. l'élève ;
2. les parents ;
3. le coach pédagogique.

Tu dois respecter strictement les données fournies dans le contexte.
Tu ne dois jamais inventer :
- une note ;
- une présence ;
- une progression ;
- une difficulté ;
- une qualité personnelle ;
- un diagnostic ;
- une information familiale ;
- une information médicale ;
- une information absente du contexte.

Tu peux reformuler, synthétiser, hiérarchiser et interpréter pédagogiquement les données, mais chaque interprétation doit rester raisonnable et explicitement liée aux éléments fournis.

Le style attendu est :
- premium ;
- clair ;
- nuancé ;
- bienveillant ;
- exigeant ;
- sans flatterie excessive ;
- sans dramatisation ;
- orienté action.

Tu dois retourner uniquement un JSON valide conforme au schéma demandé.
Aucun Markdown.
Aucun LaTeX.
Aucun commentaire hors JSON.`;

  const userPrompt = `Voici le contexte canonique d'un bilan de stage Nexus Réussite.

Tu dois produire un JSON structuré pour générer ensuite un PDF LaTeX premium.

Contraintes :
- ne jamais inventer d'information ;
- distinguer les faits, les observations et les recommandations ;
- produire un document utile pour l'élève et lisible par les parents ;
- inclure un plan d'action concret ;
- signaler les données manquantes ;
- signaler si une relecture coach est nécessaire.

Contexte :
${contextJson}

Schéma de sortie obligatoire :
${schemaDescription}`;

  try {
    const completion = await openai.chat.completions.create({
      model,
      messages: [
        { role: 'system', content: systemPrompt },
        { role: 'user', content: userPrompt },
      ],
      response_format: { type: 'json_object' },
      temperature: 0.2,
    });

    const output = completion.choices[0]?.message?.content || '{}';
    return JSON.parse(output);
  } catch (error) {
    console.error('Error generating structured report with LLM:', error);
    throw error;
  }
}
