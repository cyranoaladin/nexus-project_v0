/** Slugs et adresses des leçons — sans import de contenu (utilisable côté client). */
export const POO_ACTIVITY_SLUG = 'nsi-poo-objets-qui-agissent';
export const POO2_ACTIVITY_SLUG = 'nsi-poo-structures-lineaires';
export const RECURSIVITE_ACTIVITY_SLUG = 'nsi-recursivite';
export const MATHS_SUITES_ACTIVITY_SLUG = 'maths-suites-synthese';
export const MATHS_LIMITES_ACTIVITY_SLUG = 'maths-fonctions-limites';

export function lessonHref(slug: string, sessionId?: string | null): string | null {
  const q = sessionId ? `?seance=${encodeURIComponent(sessionId)}` : '';
  switch (slug) {
    case POO_ACTIVITY_SLUG:
      return `/espace/nsi/poo${q}`;
    case POO2_ACTIVITY_SLUG:
      return `/espace/nsi/structures-lineaires${q}`;
    case RECURSIVITE_ACTIVITY_SLUG:
      return `/espace/nsi/recursivite${q}`;
    case MATHS_SUITES_ACTIVITY_SLUG:
      return '/espace/maths/suites';
    case MATHS_LIMITES_ACTIVITY_SLUG:
      return `/espace/maths/fonctions-limites${q}`;
    default:
      return null;
  }
}
