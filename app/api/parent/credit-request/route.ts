export const dynamic = 'force-dynamic';

import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import { getServerSession } from 'next-auth';
import { authOptions } from '@/lib/auth';

export async function POST(request: NextRequest) {
  try {
    const session = await getServerSession(authOptions);
    
    if (!session || session.user.role !== 'PARENT') {
      return NextResponse.json(
        { error: 'Unauthorized' },
        { status: 401 }
      );
    }

    const body = await request.json();
    const { studentId, creditAmount, reason } = body;

    if (!studentId || !creditAmount) {
      return NextResponse.json(
        { error: 'Missing required fields' },
        { status: 400 }
      );
    }

    // Verify student belongs to parent
    const userId = session.user.id;
    const parentProfile = await prisma.parentProfile.findUnique({
      where: { userId: userId },
    });

    if (!parentProfile) {
      return NextResponse.json(
        { error: 'Parent profile not found' },
        { status: 404 }
      );
    }

    const student = await prisma.student.findFirst({
      where: {
        id: studentId,
        parentId: parentProfile.id
      },
      include: {
        user: true
      }
    });

    if (!student) {
      return NextResponse.json(
        { error: 'Student not found or unauthorized' },
        { status: 404 }
      );
    }

    // Create credit request notification
    const creditRequest = await prisma.creditTransaction.create({
      data: {
        studentId: studentId,
        type: 'CREDIT_REQUEST',
        amount: creditAmount,
        description: `Demande d'achat de ${creditAmount} crédits par ${session.user.firstName} ${session.user.lastName}. Raison: ${reason || 'Non spécifiée'}`
      }
    });

    return NextResponse.json({
      success: true,
      message: 'Demande de crédits envoyée à l\'assistant. Vous recevrez une notification une fois traitée.',
      requestId: creditRequest.id
    });

  } catch (error) {
    console.error('Error creating credit request:', error);
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    );
  }
} 