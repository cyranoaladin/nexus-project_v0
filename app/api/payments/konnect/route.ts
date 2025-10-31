import { authOptions } from '@/lib/auth';
import { getServerSession } from 'next-auth';
import { NextRequest, NextResponse } from 'next/server';
import { z } from 'zod';
import crypto from 'crypto';
import { upsertPaymentByExternalId } from '@/lib/payments';
import { prisma } from '@/lib/prisma';
import { rateLimit, ipKey } from '@/lib/security/rate-limit';
import { verifyCsrf } from '@/lib/security/csrf';
import { mapPaymentToResponse, paymentResponseInclude } from '@/app/api/sessions/contracts';

const konnectPaymentSchema = z.object({
  type: z.enum(['subscription', 'addon', 'pack']),
  key: z.string(),
  studentId: z.string(),
  amount: z.number(),
  description: z.string()
});

export async function POST(request: NextRequest) {
  try {
    const session = await getServerSession(authOptions);

    if (!session || session.user.role !== 'PARENT') {
      return NextResponse.json(
        { error: 'Accès non autorisé' },
        { status: 401 }
      );
    }

    // Rate limiting
    const ip = request.headers.get('x-forwarded-for')?.split(',')[0].trim() || request.headers.get('x-real-ip') || 'unknown';
    if (process.env.NODE_ENV === 'production') {
      const rl = rateLimit(ipKey(ip, 'payments_konnect_init'), { max: 5, windowMs: 60_000 });
      if (!rl.allowed) {
        return NextResponse.json({ error: 'Trop de requêtes, réessayez plus tard' }, { status: 429 });
      }
    }

    // CSRF (enforced only in production inside verifyCsrf)
    if (!verifyCsrf(request)) {
      return NextResponse.json({ error: 'CSRF invalide' }, { status: 403 });
    }

    const body = await request.json();
    const validatedData = konnectPaymentSchema.parse(body);

    // Vérifier que l'élève appartient au parent
    const student = await prisma.student.findFirst({
      where: {
        id: validatedData.studentId,
        parent: {
          userId: session.user.id
        }
      }
    });

    if (!student) {
      return NextResponse.json(
        { error: 'Élève non trouvé ou non autorisé' },
        { status: 404 }
      );
    }

    // Construire un externalId déterministe pour l'idempotence (même requête => même externalId)
    const idempotencyKey = `konnect:${session.user.id}:${validatedData.studentId}:${validatedData.type}:${validatedData.key}:${validatedData.amount}`;
    const externalId = crypto.createHash('sha256').update(idempotencyKey).digest('hex').slice(0, 32);

    // Créer ou récupérer l'enregistrement de paiement (idempotent)
    const mappedType = validatedData.type === 'subscription'
      ? 'SUBSCRIPTION'
      : validatedData.type === 'addon'
        ? 'SPECIAL_PACK'
        : 'CREDIT_PACK';

    const { payment, created } = await upsertPaymentByExternalId({
      externalId,
      method: 'konnect',
      type: mappedType,
      userId: session.user.id,
      amount: validatedData.amount,
      currency: 'TND',
      description: validatedData.description,
      metadata: {
        studentId: validatedData.studentId,
        itemKey: validatedData.key,
        itemType: validatedData.type,
      },
    });

    // Intégration Konnect réelle si configurée
    const KONNECT_API_URL = process.env.KONNECT_API_URL;
    const KONNECT_API_KEY = process.env.KONNECT_API_KEY;
    let payUrl: string | null = null;

    if (KONNECT_API_URL && KONNECT_API_KEY) {
      try {
        // Exemple (à adapter selon l'API Konnect réelle)
        const initRes = await fetch(`${KONNECT_API_URL}/payments/init`, {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            'Authorization': `Bearer ${KONNECT_API_KEY}`
          },
          body: JSON.stringify({
            amount: validatedData.amount,
            currency: 'TND',
            externalId: payment.externalId,
            description: validatedData.description,
            returnUrl: process.env.KONNECT_RETURN_URL,
            cancelUrl: process.env.KONNECT_CANCEL_URL,
          })
        });
        if (initRes.ok) {
          const data = await initRes.json();
          payUrl = data?.payment_url || data?.redirect_url || null;
          // Stocker l'ID de transaction provider si fourni
          const providerId = data?.payment_id || data?.id || null;
          if (providerId) {
            await prisma.payment.update({ where: { id: payment.id }, data: { externalId: String(providerId) } });
          }
        }
      } catch (e) {
        // Fallback sur démo si l'API n'est pas accessible
        payUrl = null;
      }
    }

    const paymentWithUser = await prisma.payment.findUnique({
      where: { id: payment.id },
      include: paymentResponseInclude,
    });

    if (!paymentWithUser) {
      return NextResponse.json(
        { error: 'Paiement introuvable' },
        { status: 500 }
      );
    }

    if (!payUrl) {
      // Fallback local (démo)
      payUrl = `${process.env.NEXTAUTH_URL}/dashboard/parent/paiement/konnect-demo?paymentId=${payment.id}`;
    }

    return NextResponse.json({
      success: true,
      paymentId: payment.id,
      created,
      payment: mapPaymentToResponse(paymentWithUser),
      payUrl,
      message: 'Session de paiement Konnect créée'
    });

  } catch (error) {
    const { logger } = await import('@/lib/logger');
    logger.error('Erreur paiement Konnect', { error: String(error) });

    return NextResponse.json(
      { error: 'Erreur interne du serveur' },
      { status: 500 }
    );
  }
}
