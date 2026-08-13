import { NextResponse } from 'next/server';

import { verifyAndConsumeShareToken } from '@/lib/bilans/staff/share-link-service';
import { guardSensitiveRateLimit } from '@/lib/rate-limit/sensitive';

export const dynamic = 'force-dynamic';

/**
 * Document d'un bilan par lien signé — le contenu HTML seul, embarqué par la
 * page d'accueil famille (/bilan/consultation/[token]). Mêmes gardes que
 * depuis toujours : secret 256 bits vérifié en temps constant, expiration,
 * révocation, journalisation ; jamais le document Nexus. Toute anomalie
 * reçoit exactement la même réponse : 404 sans en-tête discriminant.
 */
export async function GET(
  request: Request,
  { params }: { params: Promise<{ token: string }> },
) {
  const limited = await guardSensitiveRateLimit(request, {
    scope: 'bilan-share-consult',
    dimensions: ['ip'],
  });
  if (limited) return limited;

  const { token } = await params;
  const verified = await verifyAndConsumeShareToken(token);
  if (verified === null) {
    return new NextResponse('Document introuvable ou lien expiré.', {
      status: 404,
      headers: {
        'content-type': 'text/plain; charset=utf-8',
        'x-robots-tag': 'noindex, nofollow, noarchive',
        'cache-control': 'private, no-store',
      },
    });
  }

  return new NextResponse(verified.html, {
    status: 200,
    headers: {
      'content-type': 'text/html; charset=utf-8',
      'x-robots-tag': 'noindex, nofollow, noarchive',
      'cache-control': 'private, no-store',
      'referrer-policy': 'no-referrer',
    },
  });
}
