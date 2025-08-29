import jwt from 'jsonwebtoken';

const secret = process.env.NEXTAUTH_SECRET as string;

export type DevPayload = { sub: string; role: 'ADMIN' | 'PARENT' | 'ELEVE' | 'COACH' | 'ASSISTANTE'; email: string; dev: true; };

export function issueDevToken(payload: DevPayload, exp: string = '12h'): string {
  if (!secret) throw new Error('NEXTAUTH_SECRET required to issue dev token');
  return jwt.sign(payload, secret, { algorithm: 'HS256', expiresIn: exp });
}

export function verifyDevToken(token?: string): DevPayload | null {
  try {
    if (!secret || !token) return null;
    const decoded = jwt.verify(token, secret, { algorithms: ['HS256'] }) as DevPayload;
    return decoded?.dev ? decoded : null;
  } catch {
    return null;
  }
}
