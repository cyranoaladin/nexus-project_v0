import { prisma } from '@/lib/prisma';
import bcrypt from 'bcryptjs';
import { NextRequest } from 'next/server';
import { requireRole, isErrorResponse } from '@/lib/guards';
import { createUserSchema, updateUserSchema, listUsersSchema } from '@/lib/validation';
import { parseBody, parseSearchParams, getPagination, createPaginationMeta, assertExists } from '@/lib/api/helpers';
import { successResponse, handleApiError, ApiError, HttpStatus } from '@/lib/api/errors';
import type { Prisma } from '@prisma/client';

/**
 * GET /api/admin/users - List users with filters and pagination
 */
export async function GET(request: NextRequest) {
  try {
    // Require ADMIN role
    const session = await requireRole('ADMIN');
    if (isErrorResponse(session)) return session;

    // Parse and validate query parameters
    const params = parseSearchParams(request, listUsersSchema);
    const { skip, take } = getPagination(params.limit, params.offset);

    // Build where clause
    const whereClause: Prisma.UserWhereInput = {};

    if (params.role) {
      whereClause.role = params.role;
    }

    if (params.isActive !== undefined) {
      whereClause.isActive = params.isActive;
    }

    if (params.search) {
      whereClause.OR = [
        { firstName: { contains: params.search, mode: 'insensitive' } },
        { lastName: { contains: params.search, mode: 'insensitive' } },
        { email: { contains: params.search, mode: 'insensitive' } }
      ];
    }

    // Get users with pagination
    const [users, total] = await Promise.all([
      prisma.user.findMany({
        where: whereClause,
        skip,
        take,
        orderBy: {
          createdAt: 'desc'
        },
        select: {
          id: true,
          email: true,
          firstName: true,
          lastName: true,
          role: true,
          isActive: true,
          createdAt: true,
          student: true,
          coachProfile: true,
          parentProfile: true
        }
      }),
      prisma.user.count({ where: whereClause })
    ]);

    const formattedUsers = users.map((user) => ({
      id: user.id,
      email: user.email,
      firstName: user.firstName,
      lastName: user.lastName,
      role: user.role,
      isActive: user.isActive,
      createdAt: user.createdAt,
      profile: user.student || user.coachProfile || user.parentProfile || null
    }));

    return successResponse({
      users: formattedUsers,
      pagination: createPaginationMeta(total, params.limit, params.offset)
    });

  } catch (error) {
    return handleApiError(error, 'GET /api/admin/users');
  }
}

/**
 * POST /api/admin/users - Create a new user
 */
export async function POST(request: NextRequest) {
  try {
    // Require ADMIN role
    const session = await requireRole('ADMIN');
    if (isErrorResponse(session)) return session;

    // Parse and validate request body
    const data = await parseBody(request, createUserSchema);

    // Check if user already exists
    const existingUser = await prisma.user.findUnique({
      where: { email: data.email }
    });

    if (existingUser) {
      throw ApiError.conflict('User with this email already exists');
    }

    // Hash password
    const hashedPassword = await bcrypt.hash(data.password, 12);

    // Create user (profile creation handled by role-specific logic)
    const user = await prisma.user.create({
      data: {
        email: data.email,
        firstName: data.firstName,
        lastName: data.lastName,
        role: data.role,
        password: hashedPassword,
        phone: data.phone,
        // Create coach profile if role is COACH
        ...(data.role === 'COACH' ? {
          coachProfile: {
            create: {
              pseudonym: `${data.firstName} ${data.lastName}`,
              subjects: JSON.stringify([])
            }
          }
        } : {})
      },
      select: {
        id: true,
        email: true,
        firstName: true,
        lastName: true,
        role: true,
        phone: true,
        isActive: true,
        createdAt: true,
        coachProfile: true
      }
    });

    return successResponse({
      success: true,
      message: 'User created successfully',
      user: {
        id: user.id,
        email: user.email,
        firstName: user.firstName,
        lastName: user.lastName,
        role: user.role,
        phone: user.phone,
        isActive: user.isActive,
        createdAt: user.createdAt,
        profile: user.coachProfile
      }
    }, HttpStatus.CREATED);

  } catch (error) {
    return handleApiError(error, 'POST /api/admin/users');
  }
}

/**
 * PATCH /api/admin/users - Update an existing user
 */
export async function PATCH(request: NextRequest) {
  try {
    // Require ADMIN role
    const session = await requireRole('ADMIN');
    if (isErrorResponse(session)) return session;

    // Parse and validate request body
    const body = await request.json();
    const { id, ...data } = body;

    if (!id || typeof id !== 'string') {
      throw ApiError.badRequest('User ID is required');
    }

    // Validate update data
    const validatedData = updateUserSchema.parse(data);

    // Check if user exists
    const existingUser = await prisma.user.findUnique({
      where: { id }
    });

    assertExists(existingUser, 'User');

    // If email is being updated, check for conflicts
    if (validatedData.email && validatedData.email !== existingUser.email) {
      const emailConflict = await prisma.user.findUnique({
        where: { email: validatedData.email }
      });

      if (emailConflict) {
        throw ApiError.conflict('Email already in use');
      }
    }

    // Hash password if provided
    const updateData: Prisma.UserUpdateInput = {
      ...validatedData,
      ...(validatedData.password ? {
        password: await bcrypt.hash(validatedData.password, 12)
      } : {})
    };

    // Remove password from validated data to avoid passing plain text
    delete (updateData as any).password;

    // Update user
    const updatedUser = await prisma.user.update({
      where: { id },
      data: updateData,
      select: {
        id: true,
        email: true,
        firstName: true,
        lastName: true,
        role: true,
        phone: true,
        isActive: true,
        updatedAt: true
      }
    });

    return successResponse({
      success: true,
      message: 'User updated successfully',
      user: updatedUser
    });

  } catch (error) {
    return handleApiError(error, 'PATCH /api/admin/users');
  }
}

/**
 * DELETE /api/admin/users - Delete a user
 */
export async function DELETE(request: NextRequest) {
  try {
    // Require ADMIN role
    const session = await requireRole('ADMIN');
    if (isErrorResponse(session)) return session;

    // Get user ID from query params
    const { searchParams } = new URL(request.url);
    const id = searchParams.get('id');

    if (!id) {
      throw ApiError.badRequest('User ID is required');
    }

    // Check if user exists
    const user = await prisma.user.findUnique({
      where: { id }
    });

    assertExists(user, 'User');

    // Prevent self-deletion
    if (user.id === session.user.id) {
      throw ApiError.badRequest('Cannot delete your own account');
    }

    // Delete user (cascade will handle related records)
    await prisma.user.delete({
      where: { id }
    });

    return successResponse({
      success: true,
      message: 'User deleted successfully'
    });

  } catch (error) {
    return handleApiError(error, 'DELETE /api/admin/users');
  }
}
