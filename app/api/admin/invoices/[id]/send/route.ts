import { checkCsrf } from '@/lib/csrf';
/** Administrative invoice email requests require an explicit UUID operation key.
 * HTTP 202 means committed queue acceptance, never provider delivery.
 */
export const dynamic = 'force-dynamic';
import { NextRequest, NextResponse } from 'next/server';
import { auth } from '@/auth';
import { canPerformStatusAction, TOKEN_EXPIRY_HOURS } from '@/lib/invoice';
import { InvoiceEmailRequestError, queueInvoiceEmailRequest } from '@/lib/invoice/queue-email-request';
const PRIVATE_HEADERS = { 'Cache-Control': 'private, no-store' } as const;
const NOT_FOUND = Object.freeze({ error: 'Facture introuvable' });
const ERRORS = {
  400: 'Une clé d’opération UUID valide est requise.',
  404: NOT_FOUND.error,
  409: 'La facture doit être au statut "SENT" pour être envoyée par email.',
  422: 'Aucune adresse email vérifiée du payeur disponible pour cette facture.',
  429: 'Limite atteinte : 3 envois maximum par 24h pour cette facture. Réessayez plus tard.',
} as const;
export async function POST(request: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  try {
    const session = await auth();
    if (!session?.user?.id || !canPerformStatusAction(session.user.role)) {
      return NextResponse.json(NOT_FOUND, { status: 404, headers: PRIVATE_HEADERS });
    }
    const csrfRefusal = checkCsrf(request);
    if (csrfRefusal) return NextResponse.json({ error: 'Accès refusé' }, { status: 403, headers: PRIVATE_HEADERS });

    const { id } = await params;
    const result = await queueInvoiceEmailRequest({ invoiceId: id, actorUserId: session.user.id,
      role: session.user.role, operationKey: request.headers.get('Idempotency-Key') });
    return NextResponse.json({ success: true, deliveryStatus: 'QUEUED',
      expiresAt: result.expiresAt.toISOString(), expiryHours: TOKEN_EXPIRY_HOURS }, { status: 202, headers: PRIVATE_HEADERS });
  } catch (error) {
    if (error instanceof InvoiceEmailRequestError) {
      return NextResponse.json({ error: ERRORS[error.status] }, { status: error.status, headers: PRIVATE_HEADERS });
    }
    console.error('INVOICE_EMAIL_REQUEST_FAILED');
    return NextResponse.json({ error: 'Erreur interne du serveur.' }, { status: 500, headers: PRIVATE_HEADERS });
  }
}
