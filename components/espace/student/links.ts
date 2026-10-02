import { MATHS_SUITES_ACTIVITY_SLUG, POO_ACTIVITY_SLUG } from '@/lib/espace/catalog';

/** Destination d'une activité dans l'espace élève. */
export function activityHref(slug: string, sessionId?: string | null): string {
  if (slug === POO_ACTIVITY_SLUG) return `/espace/nsi/poo${sessionId ? `?seance=${encodeURIComponent(sessionId)}` : ''}`;
  if (slug === MATHS_SUITES_ACTIVITY_SLUG) return '/espace/maths/suites';
  return '/espace/eleve/matieres';
}
