import { auth } from '@/auth';
import { ParentPhoneError, issueParentPhoneChallenge } from '@/lib/auth/parent-phone';
import { getTrustedApplicationOrigin, withActivationSecurityHeaders } from '@/lib/auth/parent-activation';
import { validParentResourceId } from '@/lib/bilans/api/parent-access';
import { checkCsrf } from '@/lib/csrf';
import { prisma } from '@/lib/prisma';
import { guardSensitiveRateLimit } from '@/lib/rate-limit/sensitive';
import { buildParentWhatsAppUrl } from '@/lib/whatsapp';
import { isManualParentWhatsAppDelivery } from '@/lib/whatsapp/delivery-mode';
import { NextRequest, NextResponse } from 'next/server';

export const dynamic = 'force-dynamic';
const respond = (body: unknown, status = 200) => withActivationSecurityHeaders(NextResponse.json(body, { status }));

/** One-time staff response, never an idempotency record or transport outbox. */
export async function POST(request: NextRequest, context: { params: Promise<{ parentId: string }> }) {
  try {
    const session = await auth();
    if (!session?.user?.id || !['ADMIN', 'ASSISTANTE'].includes(session.user.role)) return respond({ error: 'Not found' }, 404);
    const csrf = checkCsrf(request);
    if (csrf) return withActivationSecurityHeaders(csrf);
    const { parentId } = await context.params;
    if (!validParentResourceId(parentId)) return respond({ error: 'Données invalides.' }, 400);
    const blocked = await guardSensitiveRateLimit(request, { scope: 'parent-whatsapp-manual-invitation', identity: session.user.id, resource: parentId });
    if (blocked) return withActivationSecurityHeaders(blocked);
    if (!isManualParentWhatsAppDelivery()) return respond({ error: 'Le mode de livraison a changé. Actualisez le dossier.' }, 409);
    const origin = getTrustedApplicationOrigin();
    if (request.headers.get('origin') !== origin.origin) return respond({ error: 'Requête non autorisée.' }, 403);
    const result = await prisma.$transaction(async tx => {
      const parent = await tx.user.findUnique({ where: { id: parentId }, select: { activatedAt: true } });
      if (!parent) return null;
      // Canonical issuance locks the versioned user identity, rejects merged or
      // erased accounts, and revokes prior unused links in this transaction.
      const challenge = await issueParentPhoneChallenge(tx, { userId: parentId, purpose: parent.activatedAt ? 'RECOVERY' : 'ACTIVATION' });
      const link = new URL('/auth/parent-phone', origin);
      link.searchParams.set('token', challenge.rawToken);
      const message = `Bonjour, Nexus Réussite vous invite à ${challenge.purpose === 'ACTIVATION' ? 'activer votre espace parent' : 'rétablir votre accès parent'} : ${link.toString()}\nCe lien personnel est confidentiel. Ne le partagez pas.`;
      return { whatsappUrl: buildParentWhatsAppUrl(challenge.phoneNormalized, message), expiresAt: challenge.expiresAt.toISOString(), purpose: challenge.purpose };
    });
    return result ? respond(result) : respond({ error: 'Not found' }, 404);
  } catch (error) {
    if (error instanceof ParentPhoneError || ['P2002', 'P2034'].includes((error as { code?: string })?.code ?? '')) {
      return respond({ error: 'Ce compte ne permet pas de préparer ce lien. Actualisez le dossier.' }, 409);
    }
    return respond({ error: 'Le service est momentanément indisponible.' }, 500);
  }
}
