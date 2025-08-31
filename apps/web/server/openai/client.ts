import OpenAI from 'openai';

export const openai = (apiKey?: string) => new OpenAI({ apiKey: apiKey || process.env.OPENAI_API_KEY });
