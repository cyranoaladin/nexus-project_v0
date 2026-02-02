export const dynamic = 'force-dynamic';

import { authOptions } from '@/lib/auth';
import { prisma } from '@/lib/prisma';
import bcrypt from 'bcryptjs';
import { getServerSession } from 'next-auth/next';
import { NextRequest, NextResponse } from 'next/server';
import { z } from 'zod';

// Validation schema for coach update
const coachUpdateSchema = z.object({
  firstName: z.string().min(1, 'Prénom requis'),
  lastName: z.string().min(1, 'Nom requis'),
  email: z.string().email('Email invalide'),
  password: z.string().optional(),
  pseudonym: z.string().min(1, 'Pseudonyme requis'),
  tag: z.string().min(1, 'Tag requis'),
  description: z.string().min(10, 'Description doit contenir au moins 10 caractères'),
  philosophy: z.string().min(10, 'Philosophie doit contenir au moins 10 caractères'),
  expertise: z.string().min(10, 'Expertise doit contenir au moins 10 caractères'),
  subjects: z.array(z.string()).min(1, 'Au moins une matière requise'),
  availableOnline: z.boolean(),
  availableInPerson: z.boolean()
});

export async function PUT(
  req: NextRequest,
  { params }: { params: { id: string } }
) {
  try {
    const session = await getServerSession(authOptions);

    if (!session?.user || session.user.role !== 'ASSISTANTE') {
      return NextResponse.json(
        { error: 'Unauthorized' },
        { status: 401 }
      );
    }

    const coachId = params.id;
    const body = await req.json();
    const validatedData = coachUpdateSchema.parse(body);

    // Check if coach exists
    const existingCoach = await prisma.coachProfile.findUnique({
      where: { userId: coachId },
      include: { user: true }
    });

    if (!existingCoach) {
      return NextResponse.json(
        { error: 'Coach non trouvé' },
        { status: 404 }
      );
    }

    // Check if email is being changed and if it already exists
    if (validatedData.email !== existingCoach.user.email) {
      const existingUser = await prisma.user.findUnique({
        where: { email: validatedData.email }
      });

      if (existingUser) {
        return NextResponse.json(
          { error: 'Un utilisateur avec cet email existe déjà' },
          { status: 400 }
        );
      }
    }

    // Check if pseudonym is being changed and if it already exists
    if (validatedData.pseudonym !== existingCoach.pseudonym) {
      const existingCoachWithPseudonym = await prisma.coachProfile.findUnique({
        where: { pseudonym: validatedData.pseudonym }
      });

      if (existingCoachWithPseudonym) {
        return NextResponse.json(
          { error: 'Un coach avec ce pseudonyme existe déjà' },
          { status: 400 }
        );
      }
    }

    // Update user and coach profile in a transaction
    const result = await prisma.$transaction(async (tx) => {
      // Update user
      const userData = {
        firstName: validatedData.firstName,
        lastName: validatedData.lastName,
        email: validatedData.email
      };

      // Only update password if provided
      if (validatedData.password) {
        // @ts-expect-error password is a valid field for user update
        userData.password = await bcrypt.hash(validatedData.password, 10);
      }

      const user = await tx.user.update({
        where: { id: coachId },
        data: userData
      });

      // Update coach profile
      const coachProfile = await tx.coachProfile.update({
        where: { userId: coachId },
        data: {
          pseudonym: validatedData.pseudonym,
          tag: validatedData.tag,
          description: validatedData.description,
          philosophy: validatedData.philosophy,
          expertise: validatedData.expertise,
          subjects: JSON.stringify(validatedData.subjects),
          availableOnline: validatedData.availableOnline,
          availableInPerson: validatedData.availableInPerson
        }
      });

      return { user, coachProfile };
    });

    return NextResponse.json({
      success: true,
      message: 'Coach mis à jour avec succès',
      coach: {
        id: result.user.id,
        firstName: result.user.firstName,
        lastName: result.user.lastName,
        email: result.user.email,
        pseudonym: result.coachProfile.pseudonym
      }
    });

  } catch (error) {
    console.error('Error updating coach:', error);

    if (error instanceof z.ZodError) {
      return NextResponse.json(
        {
          success: false,
          error: 'Données invalides',
          details: error.errors
        },
        { status: 400 }
      );
    }

    return NextResponse.json(
      {
        success: false,
        error: 'Internal server error'
      },
      { status: 500 }
    );
  }
}

export async function DELETE(
  req: NextRequest,
  { params }: { params: { id: string } }
) {
  try {
    const session = await getServerSession(authOptions);

    if (!session?.user || session.user.role !== 'ASSISTANTE') {
      return NextResponse.json(
        { error: 'Unauthorized' },
        { status: 401 }
      );
    }

    const coachId = params.id;

    // Check if coach exists
    const existingCoach = await prisma.coachProfile.findUnique({
      where: { userId: coachId },
      include: { user: true }
    });

    if (!existingCoach) {
      return NextResponse.json(
        { error: 'Coach non trouvé' },
        { status: 404 }
      );
    }

    // Check if coach has any sessions
    const sessionsCount = await prisma.sessionBooking.count({
      where: { coachId: coachId }
    });

    if (sessionsCount > 0) {
      return NextResponse.json(
        { error: 'Impossible de supprimer un coach qui a des sessions programmées' },
        { status: 400 }
      );
    }

    // Delete coach profile and user in a transaction
    await prisma.$transaction(async (tx) => {
      // Delete coach profile first (due to foreign key constraints)
      await tx.coachProfile.delete({
        where: { userId: coachId }
      });

      // Delete user
      await tx.user.delete({
        where: { id: coachId }
      });
    });

    return NextResponse.json({
      success: true,
      message: 'Coach supprimé avec succès'
    });

  } catch (error) {
    console.error('Error deleting coach:', error);
    return NextResponse.json(
      {
        success: false,
        error: 'Internal server error'
      },
      { status: 500 }
    );
  }
}
