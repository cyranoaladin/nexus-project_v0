import { EspaceApiError } from '@/lib/espace/client/api';

/** Message sobre pour l'enseignant ; jamais de détail technique ni de contenu d'élève. */
export function describeError(e: unknown): string {
  if (e instanceof EspaceApiError) {
    if (e.status === 401) return 'Votre session a expiré : reconnectez-vous.';
    if (e.status === 429) return 'Trop de requêtes, réessayez dans un instant.';
    return e.message || 'Une erreur est survenue.';
  }
  if (e instanceof TypeError) return 'Connexion indisponible. Réessayez dans un instant.';
  return 'Une erreur est survenue.';
}
