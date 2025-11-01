import OpenAI from 'openai';

type BilanAudience = 'STUDENT' | 'PARENT' | 'ASSISTANTE';

export interface BilanInput {
  studentName: string;
  level: string; // Seconde/Première/Terminale
  subjects: Array<{ name: string; strengths: string[]; weaknesses: string[]; goals: string[]; }>;
  context: string; // infos du formulaire bilan gratuit
}

let cachedClient: OpenAI | null | undefined;

function getOpenAIClient(): OpenAI | null {
  if (cachedClient !== undefined) {
    return cachedClient;
  }

  const apiKey = process.env.OPENAI_API_KEY;
  if (!apiKey) {
    if (process.env.NEXT_PHASE === 'phase-production-build') {
      console.warn('[bilan] OPENAI_API_KEY missing during build. Falling back to canned response.');
    }
    cachedClient = null;
    return cachedClient;
  }

  cachedClient = new OpenAI({ apiKey });
  return cachedClient;
}

function buildPrompt(audience: BilanAudience, input: BilanInput) {
  const base = `Tu es un conseiller pédagogique Nexus Réussite. Crée un bilan synthétique et actionnable.
Elève: ${input.studentName} (${input.level})
Contexte: ${input.context}
Matières:
${input.subjects.map(s => `- ${s.name}\n  Forces: ${s.strengths.join(', ')}\n  Faiblesses: ${s.weaknesses.join(', ')}\n  Objectifs: ${s.goals.join(', ')}`).join('\n')}
`;

  const style = audience === 'STUDENT'
    ? 'Public: Elève. Ton motivant, concret, plan d’action court (1-2 semaines).'
    : audience === 'PARENT'
      ? 'Public: Parent. Ton rassurant, axes d’accompagnement, visibilité planning et résultats attendus.'
      : 'Public: Assistante. Ton opérationnel, tâches à planifier, ressources/coach à assigner, prochaines étapes.';

  const format = `Structure demandée:
1) Synthèse générale (5-7 lignes)
2) Points forts clés (3-5)
3) Axes d’amélioration (3-5)
4) Plan d’action (prochaines 2 semaines)
5) Indicateurs de suivi (KPI simples)
`;

  return `${base}\n${style}\n${format}\nConcis, clair, sans jargon inutile.`;
}

export async function generateBilan(audience: BilanAudience, input: BilanInput): Promise<string> {
  const client = getOpenAIClient();
  if (!client) {
    return 'Le service de génération de bilan est momentanément indisponible. Veuillez réessayer plus tard.';
  }

  const prompt = buildPrompt(audience, input);
  const res = await client.chat.completions.create({
    model: 'gpt-4',
    messages: [
      { role: 'system', content: 'Conseiller pédagogique Nexus Réussite' },
      { role: 'user', content: prompt }
    ],
    max_tokens: 900,
    temperature: 0.6
  });
  return res.choices[0]?.message?.content || '';
}

