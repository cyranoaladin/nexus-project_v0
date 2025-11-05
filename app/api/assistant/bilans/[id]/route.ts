import { authOptions } from '@/lib/auth';
import { prisma } from '@/lib/prisma';
import { getServerSession } from 'next-auth';
import { NextRequest, NextResponse } from 'next/server';

export async function PATCH(
  request: NextRequest,
  { params }: { params: { id: string; }; }
) {
  try {
    const session = await getServerSession(authOptions);

    if (!session || session.user.role !== 'ASSISTANTE') {
      return NextResponse.json(
        { error: 'Unauthorized' },
        { status: 401 }
      );
    }

    const bilanId = params.id;
    const body = await request.json();
    const { status, notes, assignedTo } = body;

    const allowedStatuses = ['PENDING', 'IN_PROGRESS', 'COMPLETED', 'CANCELLED'];
    if (status && !allowedStatuses.includes(status)) {
      return NextResponse.json(
        { error: `Invalid status. Allowed: ${allowedStatuses.join(', ')}` },
        { status: 400 }
      );
    }

    await prisma.$executeRaw`
      UPDATE bilan_gratuits
      SET
        status = COALESCE(${status}, status),
        notes = COALESCE(${notes}, notes),
        assigned_to = COALESCE(${assignedTo}, assigned_to),
        completed_at = CASE
          WHEN ${status} = 'COMPLETED' AND completed_at IS NULL THEN NOW()
          ELSE completed_at
        END,
        updated_at = NOW()
      WHERE id = ${bilanId}
    `;

    return NextResponse.json({
      success: true,
      message: `Bilan ${bilanId} updated successfully`
    });

  } catch (error) {
    console.error('Error updating bilan:', error);
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    );
  }
}
