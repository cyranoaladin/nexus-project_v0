import type { UserRole } from '@prisma/client';
import type { AuthSession } from '@/lib/guards';
import { getTrustedApplicationOrigin } from './parent-activation';
import { readPrivateSessionSnapshot } from './session-revocation';

export interface PrivateV1Session {
  readonly userId: string;
  readonly role: UserRole;
  readonly sessionVersion: number;
  readonly expiresAt: number;
}
/** Bind the private encrypted cookie to the canonical session, never Bearer. */
export async function readBoundPrivateV1Session(request: Readonly<{ headers: Headers }>,
  session: Pick<AuthSession, 'expires'> & { readonly user: Pick<AuthSession['user'], 'id' | 'role' | 'authority'> }): Promise<PrivateV1Session | null> {
  const origin = getTrustedApplicationOrigin();
  const secret = process.env.AUTH_SECRET ?? process.env.NEXTAUTH_SECRET;
  if (!secret || secret.length < 32 || (process.env.AUTH_URL && new URL(process.env.AUTH_URL).origin !== origin.origin)) return null;
  const token = await readPrivateSessionSnapshot(request, { secret, secureCookie: origin.protocol === 'https:' });
  const expiresAt = Math.min(Number(token?.exp) * 1000, Date.parse(session.expires));
  if (!token || token.id !== session.user.id || token.role !== session.user.role
    || session.user.authority === 'CORE_V2' || (token.authority !== undefined && token.authority !== 'V1')
    || !Number.isSafeInteger(token.sessionVersion) || Number(token.sessionVersion) < 0
    || !Number.isFinite(expiresAt) || expiresAt <= Date.now()) return null;
  return { userId: session.user.id, role: session.user.role, sessionVersion: Number(token.sessionVersion), expiresAt };
}
