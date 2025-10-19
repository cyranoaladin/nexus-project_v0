import { authOptions } from '@/lib/auth';
import { prisma } from '@/lib/prisma';
import { getServerSession } from 'next-auth';
import { NextRequest, NextResponse } from 'next/server';

export async function GET(request: NextRequest) {
  try {
    const session = await getServerSession(authOptions);

    if (!session || session.user.role !== 'ASSISTANTE') {
      return NextResponse.json(
        { error: 'Unauthorized' },
        { status: 401 }
      );
    }

    // Get all bilan requests from the bilan_gratuits table
    const bilans = await prisma.$queryRaw`
      SELECT
        id,
        student_name as "studentName",
        parent_name as "parentName",
        email,
        phone,
        grade,
        subjects,
        status,
        notes,
        assigned_to as "assignedTo",
        completed_at as "completedAt",
        created_at as "createdAt",
        updated_at as "updatedAt"
      FROM bilan_gratuits
      ORDER BY created_at DESC
    ` as any[];

    // Parse subjects JSON for each bilan
    const formattedBilans = bilans.map(bilan => ({
      ...bilan,
      subjects: JSON.parse(bilan.subjects || '[]'),
      completedAt: bilan.completedAt ? new Date(bilan.completedAt).toISOString() : null,
      createdAt: new Date(bilan.createdAt).toISOString(),
      updatedAt: new Date(bilan.updatedAt).toISOString()
    }));

    return NextResponse.json(formattedBilans);

  } catch (error) {
    console.error('Error fetching bilans:', error);
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    );
  }
}
