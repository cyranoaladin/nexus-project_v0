import jwt, { type SignOptions } from 'jsonwebtoken';

export type DevPayload = { sub: string; role: 'ADMIN' | 'PARENT' | 'ELEVE' | 'COACH' | 'ASSISTANTE'; email: string; dev: true; };

export function issueDevToken(payload: DevPayload, exp: string = '12h'): string {
  const secret = (process.env.NEXTAUTH_SECRET || (process.env.E2E === '1' ? 'testsecretlongenough12345678901234567890' : '')) as string;
  if (!secret) throw new Error('NEXTAUTH_SECRET required to issue dev token');
  const opts: SignOptions = { algorithm: 'HS256', expiresIn: exp as any };
  return jwt.sign(payload as any, secret as any, opts);
}

export function verifyDevToken(token?: string): DevPayload | null {
  try {
    if (!token) return null;
    const candidates: string[] = [];
    const main = process.env.NEXTAUTH_SECRET || '';
    if (main) candidates.push(main);
    // Always accept common dev secrets in non-production environments
    if (process.env.NODE_ENV !== 'production') {
      candidates.push('dev-secret-not-for-production');
      candidates.push('testsecretlongenough12345678901234567890');
    }
    for (const secret of candidates) {
      try {
        const decoded = jwt.verify(token, secret, { algorithms: ['HS256'] }) as DevPayload;
        if (decoded?.dev) return decoded;
      } catch {}
    }
    return null;
  } catch {
    return null;
  }
}
