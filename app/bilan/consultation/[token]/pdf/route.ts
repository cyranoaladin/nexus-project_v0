import { NextResponse } from 'next/server';

import { verifyAndConsumeShareTokenPdf } from '@/lib/bilans/staff/share-link-service';
import { guardSensitiveRateLimit } from '@/lib/rate-limit/sensitive';

export const dynamic = 'force-dynamic';

/**
 * Téléchargement PDF d'un bilan par lien signé. Mêmes gardes que le
 * document HTML, plus la vérification d'intégrité par somme de contrôle.
 * Réponse uniforme (404) pour toute anomalie, PDF indisponible compris.
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
  const served = await verifyAndConsumeShareTokenPdf(token);
  if (served === null) {
    return new NextResponse('Document introuvable ou lien expiré.', {
      status: 404,
      headers: {
        'content-type': 'text/plain; charset=utf-8',
        'x-robots-tag': 'noindex, nofollow, noarchive',
        'cache-control': 'private, no-store',
      },
    });
  }

  return new NextResponse(new Uint8Array(served.pdf), {
    status: 200,
    headers: {
      'content-type': 'application/pdf',
      'content-disposition': 'inline; filename="bilan.pdf"',
      'x-robots-tag': 'noindex, nofollow, noarchive',
      'cache-control': 'private, no-store',
      'referrer-policy': 'no-referrer',
    },
  });
}
