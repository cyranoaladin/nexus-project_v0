import { NextRequest, NextResponse } from 'next/server';
import { getServerSession } from 'next-auth';
import { authOptions } from '@/lib/auth';
import { prisma } from '@/lib/prisma';
import { recordAriaFeedback } from '@/lib/aria';
import { checkAndAwardBadges } from '@/lib/badges';
import { AriaFeedbackSchema } from '@/shared/schemas/aria';

export async function POST(request: NextRequest) {
  try {
    const session = await getServerSession(authOptions);

    if (!session || session.user.role !== 'ELEVE') {
      return NextResponse.json({ error: 'Accès non autorisé' }, { status: 401 });
    }

    const body = await request.json();
    const validatedData = AriaFeedbackSchema.parse(body);

    // Vérifier que le message appartient à l'élève
    const message = await prisma.ariaMessage.findFirst({
      where: {
        id: validatedData.messageId,
        conversation: {
          student: {
            userId: session.user.id,
          },
        },
      },
    });

    if (!message) {
      return NextResponse.json({ error: 'Message non trouvé' }, { status: 404 });
    }

    // Enregistrer le feedback
    await recordAriaFeedback(validatedData.messageId, validatedData.feedback);

    // Récupérer l'élève pour les badges
    const student = await prisma.student.findUnique({
      where: { userId: session.user.id },
    });

    if (student) {
      // Vérifier et attribuer des badges
      const newBadges = await checkAndAwardBadges(student.id, 'aria_feedback');

      return NextResponse.json({
        success: true,
        newBadges: newBadges.map((badge) => ({
          name: badge.badge.name,
          description: badge.badge.description,
          icon: badge.badge.icon,
        })),
      });
    }

    return NextResponse.json({ success: true });
  } catch (error) {
    console.error('Erreur feedback ARIA:', error);

    return NextResponse.json({ error: 'Erreur interne du serveur' }, { status: 500 });
  }
}
