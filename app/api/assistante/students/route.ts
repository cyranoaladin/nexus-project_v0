import { createPaginationMeta,parseEnumParam,parsePagination } from '@/lib/api/pagination';
import { createActivationToken } from '@/lib/auth/activation-token';
import { getTrustedApplicationOrigin } from '@/lib/auth/parent-activation';
import { enqueueEmailIntent } from '@/lib/email/outbox';
import { kickEmailOutboxDrain } from '@/lib/email/outbox-scheduler';
import { isErrorResponse,requireAnyRole } from '@/lib/guards';
import { LEGAL } from '@/lib/legal';
import { generateResetToken } from '@/lib/password-reset-token';
import { prisma } from '@/lib/prisma';
import { can } from '@/lib/rbac';
import { activeAssignmentWhere } from '@/lib/rbac/coach-student-access';
import { normalizeStudentLevelAndTrack } from '@/lib/utils/grade-utils';
import { serializeError } from '@/lib/utils/serialize-error';
import { AcademicTrack,GradeLevel,StmgPathway } from '@prisma/client';
import { NextResponse } from 'next/server';
import { z } from 'zod';

/**
 * GET /api/assistante/students
 *
 * Returns a paginated and filterable list of all students.
 * Requires: ASSISTANTE or ADMIN role
 * Query params:
 *   - search: string (search by name or email)
 *   - gradeLevel: GradeLevel
 *   - academicTrack: AcademicTrack
 *   - stmgPathway: StmgPathway
 *   - hasCoach: 'true' | 'false' | 'all'
 *   - page: number (default: 1)
 *   - limit: number (default: 20, max: 100)
 */
export async function GET(request: Request) {
  try {
    const sessionOrError = await requireAnyRole(['ADMIN', 'ASSISTANTE']);
    if (isErrorResponse(sessionOrError)) return sessionOrError;

    const session = sessionOrError;

    // RBAC check
    if (!can(session.user.role, 'READ', 'STUDENT')) {
      return NextResponse.json(
        { error: 'Forbidden', message: 'Permission insuffisante' },
        { status: 403 }
      );
    }

    // Parse query parameters with validation
    const { searchParams } = new URL(request.url);
    const search = searchParams.get('search') || '';

    // Validate enum parameters - return 400 if explicitly provided but invalid
    const gradeLevelRaw = searchParams.get('gradeLevel');
    const academicTrackRaw = searchParams.get('academicTrack');
    const stmgPathwayRaw = searchParams.get('stmgPathway');

    const gradeLevel = parseEnumParam(gradeLevelRaw, GradeLevel);
    const academicTrack = parseEnumParam(academicTrackRaw, AcademicTrack);
    const stmgPathway = parseEnumParam(stmgPathwayRaw, StmgPathway);

    // Check for invalid enum values (param provided but not valid)
    if (gradeLevelRaw && gradeLevel === null) {
      return NextResponse.json(
        { error: 'Bad Request', message: `gradeLevel invalide: ${gradeLevelRaw}` },
        { status: 400 }
      );
    }
    if (academicTrackRaw && academicTrack === null) {
      return NextResponse.json(
        { error: 'Bad Request', message: `academicTrack invalide: ${academicTrackRaw}` },
        { status: 400 }
      );
    }
    if (stmgPathwayRaw && stmgPathway === null) {
      return NextResponse.json(
        { error: 'Bad Request', message: `stmgPathway invalide: ${stmgPathwayRaw}` },
        { status: 400 }
      );
    }

    const hasCoach = searchParams.get('hasCoach') || 'all';
    const { page, limit, skip } = parsePagination(searchParams);

    // Build where clause
    const where: import('@prisma/client').Prisma.StudentWhereInput = {};

    if (gradeLevel) {
      where.gradeLevel = gradeLevel;
    }

    if (academicTrack) {
      where.academicTrack = academicTrack;
    }

    if (stmgPathway) {
      where.stmgPathway = stmgPathway;
    }

    // Apply active assignment window for hasCoach filter
    const now = new Date();
    if (hasCoach === 'true') {
      where.coachAssignments = {
        some: activeAssignmentWhere(now),
      };
    } else if (hasCoach === 'false') {
      where.coachAssignments = {
        none: activeAssignmentWhere(now),
      };
    }

    if (search) {
      where.OR = [
        { user: { firstName: { contains: search, mode: 'insensitive' } } },
        { user: { lastName: { contains: search, mode: 'insensitive' } } },
        { user: { email: { contains: search, mode: 'insensitive' } } },
      ];
    }

    // Fetch students with pagination
    const [students, total] = await Promise.all([
      prisma.student.findMany({
        where,
        skip,
        take: limit,
        orderBy: { createdAt: 'desc' },
        include: {
          user: {
            select: {
              id: true,
              firstName: true,
              lastName: true,
              email: true,
              activatedAt: true,
            },
          },
          parent: {
            include: {
              user: {
                select: {
                  firstName: true,
                  lastName: true,
                  email: true,
                },
              },
            },
          },
          coachAssignments: {
            where: activeAssignmentWhere(now),
            include: {
              coach: {
                include: {
                  user: {
                    select: {
                      firstName: true,
                      lastName: true,
                    },
                  },
                },
              },
            },
          },
          subscriptions: {
            where: { status: 'ACTIVE' },
            take: 1,
          },
          _count: {
            select: {
              coachAssignments: true,
              sessions: true,
            },
          },
        },
      }),
      prisma.student.count({ where }),
    ]);

    return NextResponse.json({
      success: true,
      pagination: createPaginationMeta(page, limit, total),
      students,
    });
  } catch (error) {
    console.error('[API Assistante Students GET] Error:', serializeError(error));
    return NextResponse.json(
      { error: 'Internal Server Error', message: 'Erreur lors de la récupération des élèves' },
      { status: 500 }
    );
  }
}

const createStudentWithParentSchema = z.object({
  parentEmail: z.string().email('Email parent invalide'),
  parentFirstName: z.string().min(1, 'Prénom parent requis'),
  parentLastName: z.string().min(1, 'Nom parent requis'),
  parentPhone: z.string().optional(),
  studentFirstName: z.string().min(1, 'Prénom élève requis'),
  studentLastName: z.string().min(1, 'Nom élève requis'),
  studentEmail: z.string().email('Email élève invalide'),
  studentGrade: z.string().min(1, 'Niveau élève requis'),
  studentSchool: z.string().optional(),
});

function buildActivationEmailHtml(firstName: string, activationUrl: string) {
  return `
    <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto;">
      <div style="background: linear-gradient(135deg, #2563EB, #7C3AED); padding: 30px; text-align: center;">
        <h1 style="color: white; margin: 0;">Activation de votre compte</h1>
      </div>

      <div style="padding: 30px; background: #f9f9f9;">
        <h2>Bonjour ${firstName},</h2>

        <p>Votre compte élève Nexus Réussite a été créé.</p>

        <div style="background: white; padding: 20px; border-radius: 8px; margin: 20px 0; border-left: 4px solid #2563EB;">
          <p>Cliquez sur le bouton ci-dessous pour activer votre compte et choisir votre mot de passe :</p>
        </div>

        <div style="text-align: center; margin: 30px 0;">
          <a href="${activationUrl}"
             style="background: #2563EB; color: white; padding: 15px 30px; text-decoration: none; border-radius: 8px; display: inline-block; font-weight: bold;">
            Activer mon compte
          </a>
        </div>

        <div style="background: #fef3c7; padding: 16px; border-radius: 8px; margin: 20px 0;">
          <p style="margin: 0; font-size: 14px; color: #92400e;">
            ⏰ Ce lien expire dans <strong>72 heures</strong>.<br>
            🔒 Si vous n'avez pas demandé ce lien, ignorez cet email.
          </p>
        </div>

        <p style="color: #6b7280; font-size: 13px; margin-top: 24px;">
          Si le bouton ne fonctionne pas, copiez-collez ce lien dans votre navigateur :<br>
          <a href="${activationUrl}" style="color: #2563EB; word-break: break-all;">${activationUrl}</a>
        </p>

        <hr style="border: none; border-top: 1px solid #e5e7eb; margin: 24px 0;">

        <p>Une question ? Contactez-nous :</p>
        <ul>
          <li>📞 ${LEGAL.contact.phone}</li>
          <li>📧 ${LEGAL.contact.email}</li>
        </ul>

        <p>Cordialement,<br><strong>L'équipe Nexus Réussite</strong></p>
      </div>
    </div>
  `;
}

/**
 * POST /api/assistante/students
 *
 * Creates a parent + student (Modèle B) and sends:
 * - Parent password reset email
 * - Student activation email
 *
 * Requires: ASSISTANTE or ADMIN role with CREATE permission on STUDENT
 */
export async function POST(request: Request) {
  try {
    const sessionOrError = await requireAnyRole(['ADMIN', 'ASSISTANTE']);
    if (isErrorResponse(sessionOrError)) return sessionOrError;

    const session = sessionOrError;

    if (!can(session.user.role, 'CREATE', 'STUDENT')) {
      return NextResponse.json(
        { error: 'Forbidden', message: 'Permission insuffisante' },
        { status: 403 }
      );
    }

    const body = await request.json();
    const parsed = createStudentWithParentSchema.safeParse(body);
    if (!parsed.success) {
      return NextResponse.json(
        { error: 'Bad Request', message: parsed.error.errors[0]?.message ?? 'Données invalides' },
        { status: 400 }
      );
    }

    const data = parsed.data;
    const parentEmail = data.parentEmail.trim().toLowerCase();
    const studentEmail = data.studentEmail.trim().toLowerCase();

    const gTrack = normalizeStudentLevelAndTrack(data.studentGrade);
    if (!gTrack) {
      return NextResponse.json(
        { error: 'Bad Request', message: `Niveau scolaire non reconnu : ${data.studentGrade}` },
        { status: 400 }
      );
    }

    const studentActivation = createActivationToken('student');
    const result = await prisma.$transaction(async (tx) => {
      const existingParent = await tx.user.findUnique({
        where: { email: parentEmail },
        include: { parentProfile: true },
      });

      let parentUserId: string;
      let parentFirstName: string | null;
      let parentProfileId: string;
      let parentPasswordHash: string | null;

      if (existingParent) {
        if (existingParent.role !== 'PARENT') {
          return {
            ok: false as const,
            error: `Un compte existe déjà avec cet email (rôle: ${existingParent.role})`,
          };
        }

        parentUserId = existingParent.id;
        parentFirstName = existingParent.firstName;
        parentPasswordHash = existingParent.password;

        if (existingParent.parentProfile) {
          parentProfileId = existingParent.parentProfile.id;
        } else {
          const pp = await tx.parentProfile.create({ data: { userId: existingParent.id } });
          parentProfileId = pp.id;
        }

        // Keep parent identity up to date (non-destructive)
        await tx.user.update({
          where: { id: existingParent.id },
          data: {
            firstName: existingParent.firstName || data.parentFirstName.trim(),
            lastName: existingParent.lastName || data.parentLastName.trim(),
            phone: existingParent.phone || (data.parentPhone?.trim() || null),
            activatedAt: existingParent.activatedAt ?? new Date(),
            sessionVersion: existingParent.activatedAt ? undefined : { increment: 1 },
          },
        });
      } else {
        const createdParent = await tx.user.create({
          data: {
            email: parentEmail,
            role: 'PARENT',
            firstName: data.parentFirstName.trim(),
            lastName: data.parentLastName.trim(),
            phone: data.parentPhone?.trim() || null,
            password: null,
            activatedAt: new Date(),
          },
        });

        const pp = await tx.parentProfile.create({ data: { userId: createdParent.id } });

        parentUserId = createdParent.id;
        parentFirstName = createdParent.firstName;
        parentProfileId = pp.id;
        parentPasswordHash = createdParent.password;
      }

      const existingStudent = await tx.user.findUnique({ where: { email: studentEmail } });
      if (existingStudent) {
        return { ok: false as const, error: 'Un compte existe déjà avec l’email élève.' };
      }

      const studentUser = await tx.user.create({
        data: {
          email: studentEmail,
          role: 'ELEVE',
          firstName: data.studentFirstName.trim(),
          lastName: data.studentLastName.trim(),
          password: null,
          activatedAt: null,
          activationToken: studentActivation.tokenHash,
          activationExpiry: studentActivation.expiresAt,
        },
        select: { id: true, email: true, firstName: true, lastName: true },
      });

      const student = await tx.student.create({
        data: {
          parentId: parentProfileId,
          userId: studentUser.id,
          grade: data.studentGrade.trim(),
          gradeLevel: gTrack.level,
          academicTrack: gTrack.track,
          school: data.studentSchool?.trim() || null,
        },
        select: { id: true },
      });

      const origin = getTrustedApplicationOrigin();
      const resetToken = generateResetToken(parentUserId, parentEmail, parentPasswordHash);
      const resetUrl = new URL('/auth/reset-password', origin);
      resetUrl.searchParams.set('token', resetToken);
      await enqueueEmailIntent(tx, {
        aggregateId: parentUserId,
        messageType: 'PASSWORD_RESET',
        dedupeKey: resetToken,
        to: parentEmail,
        subject: 'Réinitialisation de votre mot de passe — Nexus Réussite',
        html: `<p>Bonjour ${parentFirstName || 'Parent'},</p><p><a href="${resetUrl.toString()}">Définir mon mot de passe</a></p>`,
        text: `Définissez votre mot de passe : ${resetUrl.toString()}`,
      });
      const activationUrl = new URL('/auth/activate', origin);
      activationUrl.searchParams.set('token', studentActivation.rawToken);
      await enqueueEmailIntent(tx, {
        aggregateId: studentUser.id,
        messageType: 'STUDENT_ACTIVATION',
        dedupeKey: studentActivation.tokenHash,
        to: studentUser.email,
        subject: 'Activation de votre compte — Nexus Réussite',
        html: buildActivationEmailHtml(studentUser.firstName || 'Utilisateur', activationUrl.toString()),
        text: `Bonjour ${studentUser.firstName || 'Utilisateur'}, activez votre compte : ${activationUrl.toString()}`,
      });

      return {
        ok: true as const,
        parent: { userId: parentUserId, email: parentEmail, firstName: parentFirstName, passwordHash: parentPasswordHash },
        student: { id: student.id, userId: studentUser.id, email: studentUser.email, firstName: studentUser.firstName },
      };
    });

    if (!result.ok) {
      return NextResponse.json(
        { error: 'Conflict', message: result.error },
        { status: 409 }
      );
    }

    kickEmailOutboxDrain();

    return NextResponse.json(
      {
        success: true,
        message: 'Parent et élève créés avec succès',
        studentId: result.student.id,
      },
      { status: 201 }
    );
  } catch (error) {
    console.error('[API Assistante Students POST] Error:', serializeError(error));
    return NextResponse.json(
      { error: 'Internal Server Error', message: 'Erreur lors de la création' },
      { status: 500 }
    );
  }
}
