import { readBoundedRequestBody, RequestBodyTooLargeError } from '@/lib/http/bounded-request-body';
import { NextRequest, NextResponse } from 'next/server';
import { z } from 'zod';
import { isManualParentWhatsAppDelivery } from '@/lib/whatsapp/delivery-mode';
import { prisma } from '@/lib/prisma';
import { normalizeParentPhone } from '@/lib/contact/parent-phone';
import { issueParentPhoneChallenge } from '@/lib/auth/parent-phone';
import { kickParentWhatsAppOutboxDrain } from '@/lib/whatsapp/invitation-scheduler';
import { enqueueParentWhatsAppInvitation } from '@/lib/whatsapp/invitation-outbox';
import { withActivationSecurityHeaders } from '@/lib/auth/parent-activation';
import { guardSensitiveRateLimit } from '@/lib/rate-limit/sensitive';
export const dynamic = 'force-dynamic';
const schema = z.object({ identifier: z.string().min(1).max(64), purpose: z.enum(['ACTIVATION','RECOVERY']).default('RECOVERY') }).strict();
const answer = () => withActivationSecurityHeaders(NextResponse.json({ success: true, message: 'Si ce numéro permet de retrouver votre compte, un lien personnel sera envoyé sur WhatsApp.' }));
export async function POST(request: NextRequest) {
  const ipBlocked = await guardSensitiveRateLimit(request, { scope: 'password-reset-request', dimensions: ['ip'] });
  if (ipBlocked) return withActivationSecurityHeaders(ipBlocked);
  let body: unknown;
  try { body = JSON.parse(await readBoundedRequestBody(request)); }
  catch (error) {
    const status = error instanceof RequestBodyTooLargeError ? 413 : 400;
    const message = error instanceof RequestBodyTooLargeError ? 'Requête trop volumineuse.' : 'Données invalides.';
    return withActivationSecurityHeaders(NextResponse.json({ error: message }, { status }));
  }
  const parsed = schema.safeParse(body);
  if (!parsed.success) return withActivationSecurityHeaders(NextResponse.json({ error: 'Numéro invalide.' }, { status: 400 }));
  let phone: string;
  try { phone = normalizeParentPhone(parsed.data.identifier).normalized; }
  catch { return withActivationSecurityHeaders(NextResponse.json({ error: 'Numéro invalide.' }, { status: 400 })); }
  const blocked = await guardSensitiveRateLimit(request, { scope: 'password-reset-request', identity: phone, dimensions: ['identity'] });
  if (blocked) return withActivationSecurityHeaders(blocked);
  if (isManualParentWhatsAppDelivery()) return withActivationSecurityHeaders(NextResponse.json({
    success: true, deliveryMode: 'MANUAL', message: 'Contactez l’assistante Nexus Réussite pour recevoir votre lien personnel sur WhatsApp.',
  }));
  try {
    const queued = await prisma.$transaction(async tx => {
      const activation = parsed.data.purpose === 'ACTIVATION';
      const users = await tx.user.findMany({
        where: { role: 'PARENT', mergedIntoUserId: null, phoneNormalized: phone,
          parentPhoneState: activation ? 'RESERVED' : 'VERIFIED',
          ...(activation ? { activatedAt: null } : { activatedAt: { not: null }, phoneVerifiedAt: { not: null } }),
        }, select: { id: true }, take: 2,
      });
      if (users.length !== 1) return false;
      const challenge = await issueParentPhoneChallenge(tx, { userId: users[0].id, purpose: parsed.data.purpose });
      await enqueueParentWhatsAppInvitation(tx, { userId: users[0].id, ...challenge });
      return true;
    });
    if (queued) kickParentWhatsAppOutboxDrain();
  } catch (error) {
    // Never leak phone, existence, raw challenge or provider configuration.
    console.error('[parent-phone-recovery]', { code: error instanceof Error ? error.name : 'UNKNOWN' });
  }
  return answer();
}
