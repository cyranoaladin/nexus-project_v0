import { buildLlmsTxt } from '@/lib/llms-txt';

/** Fiche factuelle pour les assistants génératifs, régénérée toutes les heures (offres datées). */
export const revalidate = 3600;

export function GET(): Response {
  return new Response(buildLlmsTxt(), {
    headers: { 'Content-Type': 'text/plain; charset=utf-8' },
  });
}
