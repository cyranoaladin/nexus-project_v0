import { NextRequest, NextResponse } from 'next/server';
import { z } from 'zod';
import { withActivationSecurityHeaders } from '@/lib/auth/parent-activation';
import { parentPhoneTokenPattern, verifyParentPhoneChallenge, consumeParentPhoneChallenge } from '@/lib/auth/parent-phone';
import { guardSensitiveRateLimit } from '@/lib/rate-limit/sensitive';
export const dynamic = 'force-dynamic';
const bodySchema = z.object({ token: z.string().regex(parentPhoneTokenPattern), password: z.string().min(8).max(72).refine(value => Buffer.byteLength(value, 'utf8') <= 72) }).strict();
const response = (body: object, status = 200) => withActivationSecurityHeaders(NextResponse.json(body, { status }));
export async function GET(request: NextRequest) {
  const token = request.nextUrl.searchParams.get('token') ?? '';
  const blocked = await guardSensitiveRateLimit(request, { scope: 'parent-activation', identity: token });
  if (blocked) return withActivationSecurityHeaders(blocked);
  if (!parentPhoneTokenPattern.test(token)) return response({ valid: false }, 400);
  try { return response(await verifyParentPhoneChallenge(token)); }
  catch { return response({ error: 'Impossible de vérifier ce lien.' }, 500); }
}
export async function POST(request: NextRequest) {
  const ipBlocked = await guardSensitiveRateLimit(request, { scope: 'parent-activation', dimensions: ['ip'] });
  if (ipBlocked) return withActivationSecurityHeaders(ipBlocked);
  const parsed = bodySchema.safeParse(await request.json().catch(() => null));
  if (!parsed.success) return response({ error: 'Données invalides.' }, 400);
  const blocked = await guardSensitiveRateLimit(request, { scope: 'parent-activation', identity: parsed.data.token, dimensions: ['identity'] });
  if (blocked) return withActivationSecurityHeaders(blocked);
  try {
    const result = await consumeParentPhoneChallenge(parsed.data.token, parsed.data.password);
    return result.success ? response(result) : response({ error: 'Lien invalide ou expiré.' }, 400);
  } catch { return response({ error: 'Impossible de finaliser votre accès.' }, 500); }
}
