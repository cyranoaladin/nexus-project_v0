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

    // Get all credit requests with student information
    const requests = await prisma.creditTransaction.findMany({
      where: {
        type: 'CREDIT_REQUEST'
      },
      include: {
        student: {
          include: {
            user: {
              select: {
                firstName: true,
                lastName: true,
                email: true
              }
            }
          }
        }
      },
      orderBy: {
        createdAt: 'desc'
      }
    });

    // Format the response
    const formattedRequests = requests.map(request => {
      const desc = request.description || ''
      const m = desc.match(/\[status:(\w+)\]/)
      const status = m?.[1] || 'PENDING'
      return {
        id: request.id,
        studentId: request.studentId,
        type: request.type,
        amount: request.amount,
        description: request.description,
        status,
        metadata: null,
        createdAt: request.createdAt.toISOString(),
        student: request.student ? {
          firstName: request.student.user.firstName,
          lastName: request.student.user.lastName,
          email: request.student.user.email
        } : null
      }
    });

    return NextResponse.json(formattedRequests);

  } catch (error) {
    console.error('Error fetching credit requests:', error);
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    );
  }
}

export async function POST(request: NextRequest) {
  try {
    const session = await getServerSession(authOptions)
    if (!session || session.user.role !== 'ASSISTANTE') {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    const { requestId, action, reason } = await request.json()
    if (!requestId || !action) {
      return NextResponse.json({ error: 'Invalid payload' }, { status: 400 })
    }

    const current = await prisma.creditTransaction.findUnique({ where: { id: requestId } })
    if (!current) return NextResponse.json({ error: 'Not found' }, { status: 404 })

    // Approve = add credits; Reject = annotate
    if (action === 'approve') {
      await prisma.$transaction(async (tx) => {
        await tx.creditTransaction.update({ where: { id: requestId }, data: { description: `${current.description ?? ''} [status:APPROVED]` } })
        await tx.creditTransaction.create({
          data: {
            studentId: current.studentId,
            type: 'CREDIT_ADDITION',
            amount: Math.abs(current.amount),
            description: `Crédits ajoutés suite à l'approbation de la demande ${requestId}${reason ? ` (${reason})` : ''}`,
          }
        })
      })
    } else if (action === 'reject') {
      await prisma.creditTransaction.update({ where: { id: requestId }, data: { description: `${current.description ?? ''} [status:REJECTED]${reason ? ` (${reason})` : ''}` } })
    } else {
      return NextResponse.json({ error: 'Unknown action' }, { status: 400 })
    }

    return NextResponse.json({ success: true })
  } catch (e) {
    console.error('Error updating credit request:', e)
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 })
  }
}
