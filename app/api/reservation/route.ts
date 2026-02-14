export const dynamic = 'force-dynamic';

import { prisma } from '@/lib/prisma';
import { stageReservationSchema } from '@/lib/validations';
import { sendStageDiagnosticInvitation } from '@/lib/email';
import { getServerSession } from 'next-auth';
import { authOptions } from '@/lib/auth';
import { checkRateLimit } from '@/lib/rate-limit';
import { NextRequest, NextResponse } from 'next/server';

/**
 * Sanitize user input for Telegram MarkdownV1.
 */
function sanitizeTelegram(str: string): string {
  return str.replace(/[_*[\]()~`>#+\-=|{}.!]/g, '\\$&');
}

/**
 * Send Telegram notification (non-blocking side-effect).
 * Never throws — logs errors silently.
 */
async function notifyTelegram(data: {
  parent: string;
  phone: string;
  classe: string;
  academyTitle: string;
  price: number;
  email: string;
  isUpdate: boolean;
}): Promise<boolean> {
  try {
    const token = process.env.TELEGRAM_BOT_TOKEN;
    const chatId = process.env.TELEGRAM_CHAT_ID;
    if (!token || !chatId) return false;

    const tag = data.isUpdate ? '🔄 MISE À JOUR RÉSERVATION' : '🚨 NOUVEAU LEAD CHAUD (Site Web)';
    const message = `
${tag} 🚨
➖➖➖➖➖➖➖➖➖➖➖
👤 *Parent :* ${sanitizeTelegram(data.parent)}
📞 *Tél :* ${sanitizeTelegram(data.phone)}
📧 *Email :* ${sanitizeTelegram(data.email)}
🎓 *Classe :* ${sanitizeTelegram(data.classe)}
🏫 *Intérêt :* ${sanitizeTelegram(data.academyTitle)}
💰 *Montant :* ${sanitizeTelegram(String(data.price))} TND
➖➖➖➖➖➖➖➖➖➖➖
_Ce prospect attend votre appel !_
`;

    const response = await fetch(
      `https://api.telegram.org/bot${token}/sendMessage`,
      {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ chat_id: chatId, text: message, parse_mode: 'Markdown' }),
      }
    );

    if (!response.ok) {
      console.error('[reservation] Telegram error:', response.status);
      return false;
    }
    return true;
  } catch (err) {
    console.error('[reservation] Telegram failed:', err instanceof Error ? err.message : 'unknown');
    return false;
  }
}

/**
 * POST /api/reservation
 *
 * Pipeline: Rate limit → Honeypot → Zod validate → Upsert DB → Telegram → Email
 * Returns: 201 Created | 200 Updated | 400 Bad Request | 429 Rate Limited | 500 Internal Error
 */
export async function POST(request: NextRequest) {
  try {
    // 1. Rate Limiting (10 requests per minute per IP)
    const rateLimitResponse = await checkRateLimit(request, 'api');
    if (rateLimitResponse) {
      return rateLimitResponse;
    }

    const body = await request.json();

    // 2. Honeypot check (bot trap field)
    if (body.website || body.url || body.honeypot) {
      console.warn('[reservation] Honeypot triggered:', { ip: request.headers.get('x-forwarded-for') });
      // Return success to fool bots, but don't save
      return NextResponse.json(
        { success: true, message: 'Réservation enregistrée avec succès !' },
        { status: 201 }
      );
    }

    // 3. Strict Zod validation
    const parseResult = stageReservationSchema.safeParse(body);
    if (!parseResult.success) {
      const firstError = parseResult.error.errors[0];
      return NextResponse.json(
        {
          success: false,
          error: 'Données invalides',
          field: firstError?.path?.join('.') || 'unknown',
          message: firstError?.message || 'Validation échouée',
        },
        { status: 400 }
      );
    }

    const data = parseResult.data;

    // 2. PII-safe log (no names, no emails, no phones)
    console.log(`[reservation] Processing: academy=${data.academyId} classe=${data.classe} price=${data.price}`);

    // 3. Upsert: create or update (anti-duplicate on email+academyId)
    let isUpdate = false;
    const existing = await prisma.stageReservation.findUnique({
      where: {
        email_academyId: {
          email: data.email,
          academyId: data.academyId,
        },
      },
      select: { id: true, status: true },
    });

    if (existing) {
      isUpdate = true;
      // Update existing reservation (allow re-submission to update phone/payment)
      await prisma.stageReservation.update({
        where: { id: existing.id },
        data: {
          parentName: data.parent,
          studentName: data.studentName || null,
          phone: data.phone,
          classe: data.classe,
          academyTitle: data.academyTitle,
          price: data.price,
          paymentMethod: data.paymentMethod || null,
          updatedAt: new Date(),
        },
      });
      console.log(`[reservation] Updated existing: id=${existing.id}`);
    } else {
      const reservation = await prisma.stageReservation.create({
        data: {
          parentName: data.parent,
          studentName: data.studentName || null,
          email: data.email,
          phone: data.phone,
          classe: data.classe,
          academyId: data.academyId,
          academyTitle: data.academyTitle,
          price: data.price,
          paymentMethod: data.paymentMethod || null,
          status: 'PENDING',
        },
      });
      console.log(`[reservation] Created: id=${reservation.id}`);
    }

    // 4. Telegram notification (non-blocking side-effect)
    const telegramSent = await notifyTelegram({
      parent: data.parent,
      phone: data.phone,
      classe: data.classe,
      academyTitle: data.academyTitle,
      price: data.price,
      email: data.email,
      isUpdate,
    });

    // 5. Update telegram tracking
    if (telegramSent && !isUpdate) {
      try {
        await prisma.stageReservation.updateMany({
          where: { email: data.email, academyId: data.academyId },
          data: { telegramSent: true },
        });
      } catch {
        // Non-critical — don't fail the request
      }
    }

    // 6. Email notification: Template A (diagnostic invitation) — non-blocking
    if (!isUpdate) {
      try {
        const baseUrl = process.env.NEXTAUTH_URL || 'https://nexusreussite.academy';
        const diagnosticUrl = `${baseUrl}/stages/fevrier-2026/diagnostic?email=${encodeURIComponent(data.email)}`;
        
        await sendStageDiagnosticInvitation(
          data.email,
          data.parent,
          data.studentName || null,
          data.academyTitle,
          diagnosticUrl
        );
      } catch (emailError) {
        // Non-blocking: log but don't fail the request
        console.error('[reservation] Email failed:', emailError instanceof Error ? emailError.message : 'unknown');
      }
    }

    return NextResponse.json(
      {
        success: true,
        message: isUpdate
          ? 'Votre réservation a été mise à jour avec succès.'
          : 'Réservation enregistrée avec succès ! Nous vous contactons dans les 24h.',
        isUpdate,
      },
      { status: isUpdate ? 200 : 201 }
    );
  } catch (error) {
    // Handle Prisma unique constraint violation (race condition fallback)
    if (error instanceof Error && error.message.includes('Unique constraint')) {
      return NextResponse.json(
        {
          success: false,
          error: 'Vous êtes déjà inscrit(e) pour cette académie.',
          code: 'DUPLICATE',
        },
        { status: 409 }
      );
    }

    console.error('[reservation] Error:', error instanceof Error ? error.message : 'unknown');
    return NextResponse.json(
      { success: false, error: 'Erreur interne du serveur' },
      { status: 500 }
    );
  }
}

/**
 * GET /api/reservation
 *
 * Staff-only: list all reservations (for admin dashboard).
 * RBAC: ADMIN or ASSISTANTE only
 */
export async function GET(request: NextRequest) {
  try {
    // RBAC Guard: Check session and role
    const session = await getServerSession(authOptions);
    const userRole = session?.user?.role;
    
    if (!session || (userRole !== 'ADMIN' && userRole !== 'ASSISTANTE')) {
      return NextResponse.json(
        { success: false, error: 'Accès non autorisé. Rôle ADMIN ou ASSISTANTE requis.' },
        { status: 403 }
      );
    }

    const { searchParams } = new URL(request.url);
    const status = searchParams.get('status');
    const academyId = searchParams.get('academyId');

    const where: Record<string, string> = {};
    if (status) where.status = status;
    if (academyId) where.academyId = academyId;

    const reservations = await prisma.stageReservation.findMany({
      where,
      orderBy: { createdAt: 'desc' },
      select: {
        id: true,
        parentName: true,
        studentName: true,
        email: true,
        phone: true,
        classe: true,
        academyId: true,
        academyTitle: true,
        price: true,
        paymentMethod: true,
        status: true,
        scoringResult: true,
        telegramSent: true,
        createdAt: true,
      },
    });

    return NextResponse.json({
      success: true,
      count: reservations.length,
      reservations,
    });
  } catch (error) {
    console.error('[reservation] GET error:', error instanceof Error ? error.message : 'unknown');
    return NextResponse.json(
      { success: false, error: 'Erreur interne du serveur' },
      { status: 500 }
    );
  }
}
