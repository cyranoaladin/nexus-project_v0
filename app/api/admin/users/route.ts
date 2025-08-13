import { authOptions } from '@/lib/auth';
import { prisma } from '@/lib/prisma';
import bcrypt from 'bcryptjs';
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
    const role = searchParams.get('role');
    const page = parseInt(searchParams.get('page') || '1');
    const limit = parseInt(searchParams.get('limit') || '10');
    const search = searchParams.get('search') || '';

    const skip = (page - 1) * limit;

    // Build where clause
    const whereClause: any = {};

    if (role && role !== 'ALL') {
      whereClause.role = role;
    }

    if (search) {
      whereClause.OR = [
        { firstName: { contains: search, mode: 'insensitive' } },
        { lastName: { contains: search, mode: 'insensitive' } },
        { email: { contains: search, mode: 'insensitive' } }
      ];
    }

    // Get users with pagination
    const [users, totalUsers] = await Promise.all([
      prisma.user.findMany({
        where: whereClause,
        skip,
        take: limit,
        orderBy: {
          createdAt: 'desc'
        },
        include: {
          student: true,
          coachProfile: true,
          parentProfile: true
        }
      }),
      prisma.user.count({ where: whereClause })
    ]);

    const formattedUsers = users.map((user: any) => ({
      id: user.id,
      email: user.email,
      firstName: user.firstName,
      lastName: user.lastName,
      role: user.role,
      createdAt: user.createdAt,
      profile: user.student || user.coachProfile || user.parentProfile || null
    }));

    return NextResponse.json({
      users: formattedUsers,
      pagination: {
        page,
        limit,
        total: totalUsers,
        totalPages: Math.ceil(totalUsers / limit)
      }
    });

  } catch (error) {
    console.error('Error fetching users:', error);
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    );
  }
}

export async function POST(request: NextRequest) {
  try {
    const session = await getServerSession(authOptions);

    if (!session || session.user.role !== 'ADMIN') {
      return NextResponse.json(
        { error: 'Unauthorized' },
        { status: 401 }
      );
    }

    const body = await request.json();
    const { email, firstName, lastName, role, password, profileData } = body;

    if (!email || !firstName || !lastName || !role || !password) {
      return NextResponse.json(
        { error: 'Missing required fields' },
        { status: 400 }
      );
    }

    // Check if user already exists
    const existingUser = await prisma.user.findUnique({
      where: { email }
    });

    if (existingUser) {
      return NextResponse.json(
        { error: 'User with this email already exists' },
        { status: 400 }
      );
    }

    // Hash password
    const hashedPassword = await bcrypt.hash(password, 12);

    // Create user with profile based on role
    const user = await prisma.user.create({
      data: {
        email,
        firstName,
        lastName,
        role,
        password: hashedPassword,
        ...(role === 'COACH' && profileData ? {
          coachProfile: {
            create: {
              pseudonym: profileData.pseudonym || `${firstName} ${lastName}`,
              subjects: JSON.stringify(profileData.subjects || [])
            }
          }
        } : {}),
        ...(role === 'ASSISTANTE' && profileData ? {
          // Assistant profile can be extended later
        } : {})
      },
      include: {
        coachProfile: true
      }
    });

    return NextResponse.json({
      success: true,
      message: 'User created successfully',
      user: {
        id: user.id,
        email: user.email,
        firstName: user.firstName,
        lastName: user.lastName,
        role: user.role,
        profile: user.coachProfile
      }
    });

  } catch (error) {
    console.error('Error creating user:', error);
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

    const body = await request.json();
    const { id, email, firstName, lastName, role, profileData } = body;

    if (!id) {
      return NextResponse.json(
        { error: 'User ID is required' },
        { status: 400 }
      );
    }

    // Update user
    const updatedUser = await prisma.user.update({
      where: { id },
      data: {
        email,
        firstName,
        lastName,
        role,
        ...(role === 'COACH' && profileData ? {
          coachProfile: {
            upsert: {
              create: {
                pseudonym: profileData.pseudonym || `${firstName} ${lastName}`,
                subjects: JSON.stringify(profileData.subjects || [])
              },
              update: {
                pseudonym: profileData.pseudonym,
                subjects: profileData.subjects ? JSON.stringify(profileData.subjects) : undefined
              }
            }
          }
        } : {})
      },
      include: {
        coachProfile: true
      }
    });

    return NextResponse.json({
      success: true,
      message: 'User updated successfully',
      user: {
        id: updatedUser.id,
        email: updatedUser.email,
        firstName: updatedUser.firstName,
        lastName: updatedUser.lastName,
        role: updatedUser.role,
        profile: updatedUser.coachProfile
      }
    });

  } catch (error) {
    console.error('Error updating user:', error);
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    );
  }
}

export async function DELETE(request: NextRequest) {
  try {
    const session = await getServerSession(authOptions);

    if (!session || session.user.role !== 'ADMIN') {
      return NextResponse.json(
        { error: 'Unauthorized' },
        { status: 401 }
      );
    }

    const { searchParams } = new URL(request.url);
    const id = searchParams.get('id');

    if (!id) {
      return NextResponse.json(
        { error: 'User ID is required' },
        { status: 400 }
      );
    }

    // Check if user exists
    const user = await prisma.user.findUnique({
      where: { id }
    });

    if (!user) {
      return NextResponse.json(
        { error: 'User not found' },
        { status: 404 }
      );
    }

    // Delete user (this will cascade to related profiles)
    await prisma.user.delete({
      where: { id }
    });

    return NextResponse.json({
      success: true,
      message: 'User deleted successfully'
    });

  } catch (error) {
    console.error('Error deleting user:', error);
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    );
  }
}
