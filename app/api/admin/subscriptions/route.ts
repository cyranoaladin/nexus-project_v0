export const dynamic = 'force-dynamic';

import { authOptions } from '@/lib/auth';
import { prisma } from '@/lib/prisma';
import { getServerSession } from 'next-auth';
import { NextRequest, NextResponse } from 'next/server';

export async function GET(request: NextRequest) {
  try {
    const session = await getServerSession(authOptions);

    if (!session || session.user.role !== 'ADMIN') {
      return NextResponse.json(
        { error: 'Unauthorized' },
        { status: 401 }
      );
    }

    const { searchParams } = new URL(request.url);
    const status = searchParams.get('status') || 'ACTIVE';
    const page = parseInt(searchParams.get('page') || '1');
    const limit = parseInt(searchParams.get('limit') || '10');
    const search = searchParams.get('search') || '';

    const skip = (page - 1) * limit;

    // Build where clause
    const whereClause: any = {};

    if (status && status !== 'ALL') {
      whereClause.status = status;
    }

    if (search) {
      whereClause.OR = [
        {
          student: {
            user: {
              OR: [
                { firstName: { contains: search, mode: 'insensitive' } },
                { lastName: { contains: search, mode: 'insensitive' } },
                { email: { contains: search, mode: 'insensitive' } }
              ]
            }
          }
        },
        {
          planName: { contains: search, mode: 'insensitive' }
        }
      ];
    }

    // Get subscriptions with pagination
    const [subscriptions, totalSubscriptions] = await Promise.all([
      prisma.subscription.findMany({
        where: whereClause,
        skip,
        take: limit,
        orderBy: {
          createdAt: 'desc'
        },
        include: {
          student: {
            include: {
              user: true,
              parent: {
                include: {
                  user: true
                }
              }
            }
          }
        }
      }),
      prisma.subscription.count({ where: whereClause })
    ]);

    const formattedSubscriptions = subscriptions.map((subscription: any) => ({
      id: subscription.id,
      planName: subscription.planName,
      monthlyPrice: subscription.monthlyPrice,
      status: subscription.status,
      startDate: subscription.startDate,
      endDate: subscription.endDate,
      createdAt: subscription.createdAt,
      student: {
        id: subscription.student.id,
        firstName: subscription.student.user.firstName,
        lastName: subscription.student.user.lastName,
        email: subscription.student.user.email,
        grade: subscription.student.grade,
        school: subscription.student.school
      },
      parent: {
        firstName: subscription.student.parent.user.firstName,
        lastName: subscription.student.parent.user.lastName,
        email: subscription.student.parent.user.email
      }
    }));

    return NextResponse.json({
      subscriptions: formattedSubscriptions,
      pagination: {
        page,
        limit,
        total: totalSubscriptions,
        totalPages: Math.ceil(totalSubscriptions / limit)
      }
    });

  } catch (error) {
    console.error('Error fetching subscriptions:', error);
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    );
  }
}

export async function PUT(request: NextRequest) {
  try {
    const session = await getServerSession(authOptions);

    if (!session || session.user.role !== 'ADMIN') {
      return NextResponse.json(
        { error: 'Unauthorized' },
        { status: 401 }
      );
    }

    const contentType = request.headers.get('content-type') || '';
    if (!contentType.toLowerCase().includes('application/json')) {
      return NextResponse.json({ error: 'Content-Type invalide. Utilisez application/json.' }, { status: 415 });
    }
    let raw = '';
    try { raw = await request.text(); } catch { raw = ''; }
    if (!raw || raw.trim().length === 0) {
      return NextResponse.json({ error: 'Requête invalide: corps vide.' }, { status: 400 });
    }
    let body: any;
    try { body = JSON.parse(raw); } catch {
      return NextResponse.json({ error: 'Requête invalide: JSON mal formé.' }, { status: 400 });
    }
    const { subscriptionId, status, endDate } = body;

    if (!subscriptionId) {
      return NextResponse.json(
        { error: 'Subscription ID is required' },
        { status: 400 }
      );
    }

    // Update subscription
    const updatedSubscription = await prisma.subscription.update({
      where: { id: subscriptionId },
      data: {
        status,
        endDate: endDate ? new Date(endDate) : undefined
      },
      include: {
        student: {
          include: {
            user: true
          }
        }
      }
    });

    return NextResponse.json({
      success: true,
      message: 'Subscription updated successfully',
      subscription: {
        id: updatedSubscription.id,
        status: updatedSubscription.status,
        endDate: updatedSubscription.endDate,
        studentName: `${updatedSubscription.student.user.firstName} ${updatedSubscription.student.user.lastName}`
      }
    });

  } catch (error) {
    console.error('Error updating subscription:', error);
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    );
  }
}
