import jwt from 'jsonwebtoken';

type InvitePayload = {
  kind: 'student_invite';
  studentUserId: string;
  parentUserId: string;
  studentEmail: string;
};

const getSecret = (): string => {
  const s = process.env.NEXTAUTH_SECRET;
  if (!s || s.length < 16) throw new Error('NEXTAUTH_SECRET is required for invite tokens');
  return s;
};

export function createStudentInviteToken(payload: InvitePayload, expiresIn: string = '48h'): string {
  const secret = getSecret();
  return jwt.sign(payload as any, secret, { expiresIn } as any);
}

export function verifyStudentInviteToken(token: string): InvitePayload | null {
  try {
    const decoded = jwt.verify(token, getSecret()) as InvitePayload;
    if (decoded && decoded.kind === 'student_invite' && decoded.studentUserId) return decoded;
    return null;
  } catch {
    return null;
  }
}
