import { NextRequest, NextResponse } from 'next/server';
import { z } from 'zod';
import { prisma } from '@/lib/prisma';
import { requireRole } from '@/lib/server/authz';

const RequestAriaSchema = z.object({
  studentId: z.string().cuid(),
  subjects: z.array(z.string()).min(1),
  price: z.number().positive(),
  isPack: z.boolean(),
});

export async function POST(req: NextRequest) {
  try {
    const user = await requireRole('PARENT');
    const body = await req.json();
    const parsed = RequestAriaSchema.safeParse(body);

    if (!parsed.success) {
      return NextResponse.json({ error: 'Données invalides', details: parsed.error.flatten() }, { status: 400 });
    }

    const { studentId, subjects, price, isPack } = parsed.data;

    // Vérifier que le parent a bien le droit de faire une demande pour cet élève
    const student = await prisma.student.findFirst({
      where: {
        id: studentId,
        parent: {
          userId: user.id,
        },
      },
    });

    if (!student) {
      return NextResponse.json({ error: 'Élève non trouvé ou non associé à ce parent.' }, { status: 404 });
    }

    const planName = isPack ? 'ARIA_PACK_ALL' : `ARIA_ADDON_${subjects.length - 1}_SUBJECTS`;

    // Créer la demande d'abonnement
    const subscriptionRequest = await prisma.subscriptionRequest.create({
      data: {
        studentId,
        parentId: student.parentId as string,
        requestType: 'ARIA_ADDON',
        status: 'PENDING',
        details: {
          subjects,
          price,
          isPack,
        },
        planName,
      },
    });

    return NextResponse.json({ success: true, requestId: subscriptionRequest.id }, { status: 201 });
  } catch (e: any) {
    const status = e.status || 500;
    return NextResponse.json({ error: e.message || 'Erreur interne du serveur' }, { status });
  }
}
