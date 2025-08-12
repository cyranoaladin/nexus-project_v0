import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import { getServerSession } from 'next-auth';
import { authOptions } from '@/lib/auth';

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
    const type = searchParams.get('type') || 'ALL';
    const page = parseInt(searchParams.get('page') || '1');
    const limit = parseInt(searchParams.get('limit') || '20');
    const search = searchParams.get('search') || '';

    const skip = (page - 1) * limit;

    // Get all activities from different sources
    const [
      sessions,
      users,
      subscriptions,
      creditTransactions
    ] = await Promise.all([
      // Sessions
      prisma.session.findMany({
        take: 50,
        orderBy: { createdAt: 'desc' },
        include: {
          student: { include: { user: true } },
          coach: { include: { user: true } }
        }
      }),
      
      // Users
      prisma.user.findMany({
        take: 50,
        orderBy: { createdAt: 'desc' }
      }),
      
      // Subscriptions
      prisma.subscription.findMany({
        take: 50,
        orderBy: { createdAt: 'desc' },
        include: {
          student: { include: { user: true } }
        }
      }),
      
      // Credit transactions
      prisma.creditTransaction.findMany({
        take: 50,
        orderBy: { createdAt: 'desc' },
        include: {
          student: { include: { user: true } }
        }
      })
    ]);

    // Format all activities
    const allActivities = [
      // Format sessions
      ...sessions.map((activity: any) => ({
        id: activity.id,
        type: 'session',
        title: `Session ${activity.subject}`,
        description: `${activity.student?.user?.firstName || 'Unknown'} ${activity.student?.user?.lastName || 'Student'} avec ${activity.coach?.pseudonym || 'Unknown Coach'}`,
        time: activity.createdAt,
        status: activity.status,
        studentName: `${activity.student?.user?.firstName || 'Unknown'} ${activity.student?.user?.lastName || 'Student'}`,
        coachName: activity.coach?.pseudonym || 'Unknown Coach',
        subject: activity.subject,
        action: activity.status === 'COMPLETED' ? 'Session terminée' : 
                activity.status === 'SCHEDULED' ? 'Session programmée' : 
                activity.status === 'CANCELLED' ? 'Session annulée' : 'Session en cours'
      })),
      
      // Format new users
      ...users.map((user: any) => ({
        id: user.id,
        type: 'user',
        title: `Nouvel utilisateur: ${user.firstName} ${user.lastName}`,
        description: `${user.firstName} ${user.lastName} (${user.role})`,
        time: user.createdAt,
        status: 'CREATED',
        studentName: `${user.firstName} ${user.lastName}`,
        coachName: '',
        subject: user.role,
        action: 'Utilisateur créé'
      })),
      
      // Format new subscriptions
      ...subscriptions.map((subscription: any) => ({
        id: subscription.id,
        type: 'subscription',
        title: `Nouvel abonnement: ${subscription.planName}`,
        description: `${subscription.student?.user?.firstName || 'Unknown'} ${subscription.student?.user?.lastName || 'Student'} - ${subscription.planName}`,
        time: subscription.createdAt,
        status: subscription.status,
        studentName: `${subscription.student?.user?.firstName || 'Unknown'} ${subscription.student?.user?.lastName || 'Student'}`,
        coachName: '',
        subject: subscription.planName,
        action: 'Abonnement créé'
      })),
      
      // Format credit transactions
      ...creditTransactions.map((transaction: any) => ({
        id: transaction.id,
        type: 'credit',
        title: `Transaction crédit: ${transaction.type}`,
        description: `${transaction.student?.user?.firstName || 'Unknown'} ${transaction.student?.user?.lastName || 'Student'} - ${transaction.amount} crédits`,
        time: transaction.createdAt,
        status: 'COMPLETED',
        studentName: `${transaction.student?.user?.firstName || 'Unknown'} ${transaction.student?.user?.lastName || 'Student'}`,
        coachName: '',
        subject: transaction.type,
        action: `Transaction ${transaction.type}`
      }))
    ];

    // Sort by time (most recent first)
    const sortedActivities = allActivities.sort((a, b) => 
      new Date(b.time).getTime() - new Date(a.time).getTime()
    );

    // Apply filters
    let filteredActivities = sortedActivities;
    
    if (type !== 'ALL') {
      filteredActivities = filteredActivities.filter(activity => activity.type === type);
    }
    
    if (search) {
      filteredActivities = filteredActivities.filter(activity =>
        activity.title.toLowerCase().includes(search.toLowerCase()) ||
        activity.description.toLowerCase().includes(search.toLowerCase()) ||
        activity.studentName.toLowerCase().includes(search.toLowerCase()) ||
        activity.coachName.toLowerCase().includes(search.toLowerCase()) ||
        activity.subject.toLowerCase().includes(search.toLowerCase())
      );
    }

    // Apply pagination
    const totalActivities = filteredActivities.length;
    const paginatedActivities = filteredActivities.slice(skip, skip + limit);

    return NextResponse.json({
      activities: paginatedActivities,
      pagination: {
        page,
        limit,
        total: totalActivities,
        totalPages: Math.ceil(totalActivities / limit)
      }
    });

  } catch (error) {
    console.error('Error fetching activities:', error);
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    );
  }
} 