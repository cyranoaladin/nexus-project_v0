import { isBankTransferEnabled } from '@/lib/payments/availability';
import { serializeError } from '@/lib/utils/serialize-error';
export const dynamic = 'force-dynamic';

import { auth } from '@/auth';
import { prisma } from '@/lib/prisma';
import { NextRequest, NextResponse } from 'next/server';
import { z } from 'zod';
import { resolveSellablePaymentCatalogItem } from '@/lib/security/payment-catalog';
import { resolveParentStudentAccess } from '@/lib/families/student-access-authority';
import { BankTransferOwnershipError, declarePendingBankTransfer } from '@/lib/payments/bank-transfer-declaration';

/**
 * POST /api/payments/bank-transfer/confirm
 *
 * Appelé par le parent après avoir effectué un virement bancaire.
 * Crée un Payment PENDING + notifie ADMIN/ASSISTANTE.
 */

const confirmBankTransferSchema = z.object({
  type: z.enum(['subscription', 'addon', 'pack']),
  key: z.string().trim().min(1),
  studentId: z.string().trim().optional().nullable(),
  amount: z.number().positive().optional(),
  description: z.string().trim().min(1).max(500).optional(),
  termsAccepted: z.literal(true, {
    errorMap: () => ({ message: 'L\'acceptation des CGV est obligatoire avant paiement.' }),
  }),
  termsVersion: z.string().trim().min(1),
  immediateExecution: z.boolean().optional().default(false),
});

export async function POST(request: NextRequest) {
  try {
    const session = await auth();

    if (!session?.user?.id || session.user.role !== 'PARENT') {
      return NextResponse.json(
        { error: 'Authentification requise (rôle PARENT)' },
        { status: 401 }
      );
    }

    if (!isBankTransferEnabled()) return NextResponse.json({ error: 'Paiements indisponibles.', code: 'BANK_TRANSFER_DISABLED' }, { status: 403, headers: { 'Cache-Control': 'private, no-store' } });

    const body = await request.json();
    const data = confirmBankTransferSchema.parse(body);

    // Sale-suspension is checked before any POST-AUTH BUSINESS database
    // read (`auth()` above may itself touch Prisma for session lookup —
    // this claim is about this route's own business logic, not about
    // auth): a suspended surface must be unreachable regardless of which UI
    // (or hand-crafted URL/request) got the client here (P0-ARIA-03).
    // Deliberately still AFTER auth: gating on business state before
    // authentication would let an unauthenticated caller distinguish
    // "suspended" from "not found" — an information leak this ordering
    // avoids.
    const catalogResolution = resolveSellablePaymentCatalogItem(data.type, data.key);

    if (catalogResolution.status === 'NOT_FOUND') {
      return NextResponse.json(
        { error: 'Produit ou formule invalide' },
        { status: 400 }
      );
    }

    if (catalogResolution.status === 'SALE_SUSPENDED') {
      return NextResponse.json(
        { error: catalogResolution.reason, code: 'SALE_SUSPENDED' },
        { status: 409 }
      );
    }

    const catalogItem = catalogResolution.item;

    if ((data.type === 'subscription' || data.type === 'addon') && !data.studentId) {
      return NextResponse.json(
        { error: 'Élève requis pour ce paiement' },
        { status: 400 }
      );
    }

    if (data.studentId) {
      const authority = await resolveParentStudentAccess(session.user.id, data.studentId, 'mutation');
      if (authority.status === 'AUTHORITY_UNAVAILABLE') {
        return NextResponse.json(
          { error: 'Autorisation temporairement indisponible', code: 'FAMILY_AUTHORITY_UNAVAILABLE' },
          { status: 503, headers: { 'cache-control': 'private, no-store' } },
        );
      }
      // Core membership grants reads only until a cross-store write fence exists.
      if (authority.status !== 'LEGACY_ALLOWED') {
        return NextResponse.json(
          { error: 'Élève introuvable ou non autorisé' },
          { status: 404 },
        );
      }
      const parentProfile = await prisma.parentProfile.findUnique({
        where: { userId: session.user.id },
        select: { id: true },
      });

      if (!parentProfile) {
        return NextResponse.json(
          { error: 'Profil parent introuvable' },
          { status: 404 }
        );
      }

      const student = await prisma.student.findFirst({
        where: {
          id: data.studentId,
          parentId: parentProfile.id,
        },
        select: { id: true },
      });

      if (!student) {
        return NextResponse.json(
          { error: 'Élève introuvable ou non autorisé' },
          { status: 404 }
        );
      }
    }

    const forwarded = request.headers.get('x-forwarded-for');
    const clientIp = forwarded?.split(',')[0]?.trim() ?? request.headers.get('x-real-ip') ?? 'unknown';
    const parentName = [session.user.firstName, session.user.lastName].filter(Boolean).join(' ') || session.user.email || 'Parent';
    const declaration = await declarePendingBankTransfer({
      parentUserId: session.user.id, parentName, studentId: data.studentId ?? null,
      itemType: data.type, itemKey: data.key, catalog: catalogItem,
      termsVersion: data.termsVersion, clientIp, immediateExecution: data.immediateExecution, now: new Date(),
    });
    return NextResponse.json({
      success: true, paymentId: declaration.paymentId,
      message: declaration.alreadyExists
        ? 'Un virement est déjà en attente de validation pour cette commande.'
        : 'Votre déclaration de virement a été transmise. Elle sera validée sous 24/48h.',
      ...(declaration.alreadyExists ? { alreadyExists: true } : {}),
    });
  } catch (error) {
    if (error instanceof BankTransferOwnershipError) {
      return NextResponse.json({ error: 'Élève introuvable ou non autorisé' }, { status: 404 });
    }
    if (error instanceof z.ZodError) {
      return NextResponse.json(
        { error: 'Données invalides', details: error.errors },
        { status: 400 }
      );
    }

    console.error('[BankTransfer Confirm] Erreur:', serializeError(error));
    return NextResponse.json(
      { error: 'Erreur interne du serveur' },
      { status: 500 }
    );
  }
}
