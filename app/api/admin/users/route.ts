import { guardSensitiveRateLimit } from '@/lib/rate-limit/sensitive';
export const dynamic = 'force-dynamic';

import { ApiError,handleApiError,HttpStatus,successResponse } from '@/lib/api/errors';
import { assertExists,createPaginationMeta,getPagination,parseBody,parseSearchParams } from '@/lib/api/helpers';
import { SYSTEM_PARENT_EMAIL } from '@/lib/constants';
import { AcademicEnrollmentError, setStudentChosenCourses } from '@/lib/curriculum/enrollment';
import { isErrorResponse,requireRole } from '@/lib/guards';
import { createLogger } from '@/lib/middleware/logger';
import { prisma } from '@/lib/prisma';
import { createUserSchema,listUsersSchema,updateUserSchema } from '@/lib/validation';
import { AcademicTrack,GradeLevel,StmgPathway,UserRole } from '@/types/enums';
import type { Prisma } from '@prisma/client';
import bcrypt from 'bcryptjs';
import { NextRequest,NextResponse } from 'next/server';

/**
 * GET /api/admin/users - List users with filters and pagination
 */
export async function GET(request: NextRequest) {
  let logger = createLogger(request);

  try {
    // Rate limiting
    const rateLimitResult = await guardSensitiveRateLimit(request, {
      scope: 'admin-users-read',
      dimensions: ['ip'],
    });
    if (rateLimitResult) return rateLimitResult;

    // Require ADMIN role
    const session = await requireRole(UserRole.ADMIN);
    if (isErrorResponse(session)) return session;

    const identityBlocked = await guardSensitiveRateLimit(request, {
      scope: 'admin-users-read',
      identity: session.user.id,
      dimensions: ['identity'],
    });
    if (identityBlocked) return identityBlocked;

    // Update logger with session context
    logger = createLogger(request, session);
    logger.info('Listing users');

    // Parse and validate query parameters
    const params = parseSearchParams(request, listUsersSchema);

    // Convert page to offset if provided
    const limit = params.limit ?? 10;
    const offset = params.page ? (params.page - 1) * limit : (params.offset ?? 0);
    const { skip, take } = getPagination(limit, offset);

    // Build where clause
    const whereClause: Prisma.UserWhereInput = {};

    if (params.role && params.role !== 'ALL' && Object.values(UserRole).includes(params.role as UserRole)) {
      whereClause.role = params.role as UserRole;
    }

    // Note: isActive field does not exist in User schema
    // if (params.isActive !== undefined) {
    //   whereClause.isActive = params.isActive;
    // }

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
          phone: true,
          activatedAt: true,
          mergedIntoUserId: true,
          mergedAt: true,
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
      phone: user.phone,
      isActive: !!user.activatedAt,
      mergedIntoUserId: user.mergedIntoUserId,
      mergedAt: user.mergedAt,
      createdAt: user.createdAt,
      profile: user.student || user.coachProfile || user.parentProfile || null
    }));

    logger.logRequest(200, { count: formattedUsers.length, filters: params });

    return successResponse({
      users: formattedUsers,
      pagination: createPaginationMeta(total, limit, offset)
    });

  } catch (error) {
    logger.error('Failed to list users', error);
    logger.logRequest(500);
    return await handleApiError(error, 'GET /api/admin/users');
  }
}

/**
 * POST /api/admin/users - Create a new user
 */
export async function POST(request: NextRequest) {
  let logger = createLogger(request);

  try {
    // Rate limiting (stricter for write operations)
    const rateLimitResult = await guardSensitiveRateLimit(request, {
      scope: 'admin-users-create',
      dimensions: ['ip'],
    });
    if (rateLimitResult) return rateLimitResult;

    // Require ADMIN role
    const session = await requireRole(UserRole.ADMIN);
    if (isErrorResponse(session)) return session;

    const identityBlocked = await guardSensitiveRateLimit(request, {
      scope: 'admin-users-create',
      identity: session.user.id,
      dimensions: ['identity'],
    });
    if (identityBlocked) return identityBlocked;

    // Update logger with session context
    logger = createLogger(request, session);
    logger.info('Creating user');

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
        } : {}),
        // Create student profile if role is ELEVE
        ...(data.role === 'ELEVE' && data.gradeLevel ? {
          student: {
            create: {
              gradeLevel: data.gradeLevel as GradeLevel,
              academicTrack: data.academicTrack || (data.gradeLevel === GradeLevel.TROISIEME ? AcademicTrack.COLLEGE : AcademicTrack.EDS_GENERALE),
              stmgPathway: data.stmgPathway || null,
              grade: data.gradeLevel.toString(), // Sync legacy grade
              parentId: data.parentId!
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
        // isActive: true, // Field doesn't exist in User schema
        createdAt: true,
        coachProfile: true
      }
    });

    logger.logRequest(201, { userId: user.id, role: user.role });

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
        // isActive field removed - doesn't exist in User schema
        createdAt: user.createdAt,
        profile: user.coachProfile
      }
    }, HttpStatus.CREATED);

  } catch (error) {
    logger.error('Failed to create user', error);
    logger.logRequest(500);
    return await handleApiError(error, 'POST /api/admin/users');
  }
}

/**
 * PATCH /api/admin/users - Update an existing user
 */
export async function PATCH(request: NextRequest) {
  try {
    // Require ADMIN role
    const session = await requireRole(UserRole.ADMIN);
    if (isErrorResponse(session)) return session;

    // Parse and validate request body
    const body = await request.json();
    const { id, ...data } = body;

    if (!id || typeof id !== 'string') {
      throw ApiError.badRequest('User ID is required');
    }

    // Validate update data
    const validatedData = updateUserSchema.parse(data);
    const {
      gradeLevel,
      academicTrack,
      academicCourseKeys,
      stmgPathway,
      ...userUpdateFields
    } = validatedData;

    // Check if user exists
    const existingUser = await prisma.user.findUnique({
      where: { id }
    });

    assertExists(existingUser, 'User');

    if (typeof existingUser.mergedIntoUserId === 'string') {
      throw ApiError.conflict('Merged source accounts are immutable');
    }

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
    const updateData: Prisma.UserUpdateInput = userUpdateFields.password
      ? {
          ...userUpdateFields,
          password: await bcrypt.hash(userUpdateFields.password, 12)
        }
      : {
          ...userUpdateFields,
          password: undefined
        };

    const revokesSessions = Boolean(
      userUpdateFields.password ||
      (validatedData.role && validatedData.role !== existingUser.role) ||
      (validatedData.email && validatedData.email !== existingUser.email)
    );

    // Update user
    const updatedUser = await prisma.user.update({
      where: { id },
      data: {
        ...updateData,
        ...(revokesSessions ? { sessionVersion: { increment: 1 } } : {}),
      },
      select: {
        id: true,
        email: true,
        firstName: true,
        lastName: true,
        role: true,
        phone: true,
        // isActive: true, // Field doesn't exist in User schema
        updatedAt: true
      }
    });

    if (
      updatedUser.role === UserRole.ELEVE &&
      (gradeLevel || academicTrack || academicCourseKeys || stmgPathway)
    ) {
      const isStmg = academicTrack === 'STMG' || academicTrack === 'STMG_NON_LYCEEN';
      const studentData = {
        ...(gradeLevel ? { gradeLevel, grade: gradeLevel.toString() } : {}), // Keep grade in sync
        ...(academicTrack ? { academicTrack } : {}),
        ...(academicTrack ? { stmgPathway: (isStmg ? (stmgPathway ?? 'INDETERMINE') : null) as StmgPathway | null } : {}),
        updatedTrackAt: new Date(),
      };

      // Need parentId for create block
      let parentId = (data as { parentId?: string }).parentId;
      if (!parentId) {
        const existingStudent = await prisma.student.findUnique({ where: { userId: id } });
        parentId = existingStudent?.parentId;
      }
      if (!parentId) {
        const adminParent = await prisma.user.findFirst({
          where: { email: SYSTEM_PARENT_EMAIL },
          include: { parentProfile: true }
        });
        parentId = adminParent?.parentProfile?.id;
      }

      if (!parentId) {
        return NextResponse.json({ error: 'Un parentId est requis pour créer un profil élève' }, { status: 400 });
      }

      await prisma.student.upsert({
        where: { userId: id },
        update: studentData,
        create: {
          userId: id,
          gradeLevel: (gradeLevel || GradeLevel.AUTRE) as GradeLevel, // Ensure a value for new profiles
          academicTrack: academicTrack || (gradeLevel === GradeLevel.TROISIEME ? AcademicTrack.COLLEGE : AcademicTrack.EDS_GENERALE),
          stmgPathway: isStmg ? (stmgPathway ?? 'INDETERMINE') : null,
          grade: (gradeLevel || GradeLevel.AUTRE).toString(),
          updatedTrackAt: new Date(),
          parentId: parentId
        },
      });

      // Les enseignements choisis vivent dans le SSoT d'inscriptions, jamais
      // sur Student : un tronc commun n'est pas une spécialité.
      if (academicCourseKeys) {
        const student = await prisma.student.findUnique({
          where: { userId: id },
          select: { id: true, gradeLevel: true, academicTrack: true, stmgPathway: true },
        });
        if (student) {
          try {
            await setStudentChosenCourses(
              student.id,
              {
                gradeLevel: student.gradeLevel,
                academicTrack: student.academicTrack,
                stmgPathway: student.stmgPathway,
              },
              academicCourseKeys,
              { source: 'ADMIN', verifiedById: session.user.id },
            );
          } catch (enrollmentError) {
            if (enrollmentError instanceof AcademicEnrollmentError) {
              return NextResponse.json(
                { error: 'Validation failed', details: { issues: enrollmentError.issues } },
                { status: 400 },
              );
            }
            throw enrollmentError;
          }
        }
      }
    }

    return successResponse({
      success: true,
      message: 'User updated successfully',
      user: updatedUser
    });

  } catch (error) {
    return await handleApiError(error, 'PATCH /api/admin/users');
  }
}

/**
 * DELETE /api/admin/users - Delete a user
 */
export async function DELETE(request: NextRequest) {
  try {
    // Require ADMIN role
    const session = await requireRole(UserRole.ADMIN);
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

    if (typeof user.mergedIntoUserId === 'string') {
      throw ApiError.conflict('Merged source accounts cannot be deleted');
    }

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
    return await handleApiError(error, 'DELETE /api/admin/users');
  }
}
