import 'server-only';
import { createHmac } from 'node:crypto';

/**
 * Server-only Jitsi helpers. Split out of lib/jitsi.ts specifically
 * because lib/jitsi.ts is also imported by a client component
 * (components/ui/video-conference.tsx) — importing `node:crypto` there
 * broke the client webpack bundle
 * (`UnhandledSchemeError: Reading from "node:crypto" is not handled by
 * plugins`). The `server-only` import makes any accidental future
 * client-side import of this file fail at build time instead of at
 * runtime in production.
 */

/**
 * Graine serveur pour `generateDeterministicRoomName` (lib/jitsi.ts),
 * pour un `SessionBooking` donné — sans elle, le nom de salle ne dépend
 * que du `sessionId` (un simple encodage Base64 réversible, `btoa`), donc
 * reconstituable hors ligne par quiconque connaît l'algorithme. Avec un
 * HMAC serveur, la salle reste déterministe (même valeur à chaque appel,
 * pour tous les participants légitimes) mais n'est plus calculable sans
 * le secret serveur. La vraie frontière d'accès reste le RBAC vérifié à
 * chaque appel de `GET /api/sessions/[sessionId]` (identité serveur, pas
 * un id client) — ceci est une défense en profondeur supplémentaire, pas
 * le contrôle d'accès principal.
 */
export function deterministicRoomSeedForSession(sessionId: string): string {
  const secret = process.env.JITSI_ROOM_SECRET || process.env.NEXTAUTH_SECRET;
  if (!secret) {
    throw new Error('JITSI_ROOM_SECRET_OR_NEXTAUTH_SECRET_REQUIRED');
  }
  return createHmac('sha256', secret).update(sessionId).digest('hex').slice(0, 16);
}
