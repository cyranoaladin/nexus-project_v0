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
 * Dedicated Jitsi room-identity secret — same pattern as
 * `RATE_LIMIT_KEY_SECRET` (lib/rate-limit/keys.ts): required, ≥32 bytes,
 * fails closed with no fallback of any kind. Deliberately NOT
 * `NEXTAUTH_SECRET`: that secret has its own rotation policy (session
 * signing), and silently reusing it here would mean rotating auth
 * sessions also rotates every active room's identity — a surprising,
 * undocumented coupling between two unrelated concerns. Rotating
 * `JITSI_ROOM_SECRET` on its own is safe and has exactly one visible
 * effect: every in-flight session's room name changes, so anyone with a
 * stale room link (e.g. a previously opened tab) needs to reload
 * `/session/video?sessionId=...` to get the new one — there is no stored
 * room name anywhere to invalidate.
 */
function requiredJitsiRoomSecret(): string {
  const secret = process.env.JITSI_ROOM_SECRET?.trim();
  if (!secret || secret.length < 32) {
    throw new Error('JITSI_ROOM_SECRET_INVALID');
  }
  return secret;
}

/**
 * Resolves the Jitsi room name for a given `SessionBooking.id` —
 * deterministic (same session always maps to the same room, so every
 * participant lands together) but NOT reconstructible without the server
 * secret, and the output never echoes any part of `sessionId` in the
 * clear.
 *
 * The previous implementation (`generateDeterministicRoomName`, removed
 * from lib/jitsi.ts) built the name via `btoa(sessionId + '-' + seed)`
 * AND additionally prefixed the raw `sessionId.slice(0, 8)` onto the
 * output — reversible Base64 of a value that already contained the
 * public `sessionId` before the (secret-derived) seed leaks nothing
 * useful about the secret, but the literal `sessionId` prefix defeated
 * the entire point: anyone who saw a room name recovered 8 real
 * characters of the booking id outright, and the Base64 portion decoded
 * straight back to `sessionId-seed` with no cryptography actually
 * protecting it. This version feeds `sessionId` through a single
 * HMAC-SHA256 keyed by the server secret and builds the room name purely
 * from that digest — no raw or partial `sessionId` appears anywhere in
 * the result, and it cannot be computed or decoded without the secret.
 *
 * Access control itself is never this function's job: real authorization
 * is the server-side ownership check in
 * `app/api/sessions/[sessionId]/route.ts` (`resolveJoinableBooking`),
 * re-verified on every request from the caller's real session identity,
 * never from a client-supplied id. An unguessable room name is
 * defense-in-depth on top of that, not a substitute for it.
 */
export function resolveJitsiRoomNameForSession(sessionId: string): string {
  const digest = createHmac('sha256', requiredJitsiRoomSecret()).update(sessionId).digest('hex');
  return `nexus-session-${digest.slice(0, 24)}`;
}
