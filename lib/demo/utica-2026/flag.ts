/**
 * Kill switch du démonstrateur UTICA 2026 (amendement A2).
 *
 * Désactivé par défaut. Server-only : jamais exposé au bundle client (aucune
 * page /demo/utica-2026 n'a besoin de connaître ce flag côté navigateur —
 * seul le layout serveur en dépend pour décider d'un notFound()).
 *
 * Aucun bypass du middleware/auth : ce flag ne fait que déclencher un 404 sur
 * les routes /demo/utica-2026/** quand il est désactivé, il n'ouvre jamais
 * d'accès à une route protégée existante.
 */
import 'server-only';

export function isUticaDemoEnabled(): boolean {
  return process.env.UTICA_DEMO_ENABLED === 'true';
}
