import OpenAI from "openai";

/**
 * Initialise le client OpenAI.
 * La clé API est récupérée depuis les variables d'environnement.
 * @param apiKey - Clé API OpenAI (optionnelle, surcharge process.env.OPENAI_API_KEY)
 * @returns Une instance du client OpenAI.
 */
export const openai = (apiKey?: string) => new OpenAI({ apiKey: apiKey || process.env.OPENAI_API_KEY });
