import { lessonHref } from '@/lib/espace/lesson-routes';

/** Destination d'une activité dans l'espace élève. */
export function activityHref(slug: string, sessionId?: string | null): string {
  return lessonHref(slug, sessionId) ?? '/espace/eleve/matieres';
}
