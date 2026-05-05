import { NextResponse } from 'next/server';
import { requireAnyRole, isErrorResponse } from '@/lib/guards';
import { can } from '@/lib/rbac';
import { activeAssignmentWhere } from '@/lib/rbac/coach-student-access';
import { prisma } from '@/lib/prisma';
import { GradeLevel, AcademicTrack, StmgPathway } from '@prisma/client';
import { parsePagination, parseEnumParam, createPaginationMeta } from '@/lib/api/pagination';
import { z } from 'zod';
import { normalizeStudentLevelAndTrack } from '@/lib/utils/grade-utils';
import { generateResetToken } from '@/lib/password-reset-token';
import { sendPasswordResetEmail } from '@/lib/email';
import crypto from 'crypto';
import { sendMail } from '@/lib/email/mailer';

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
    const where: any = {};

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
    console.error('[API Assistante Students GET] Error:', error);
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

function hashToken(token: string): string {
  return crypto.createHash('sha256').update(token).digest('hex');
}

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
          <li>📞 +216 99 19 28 29</li>
          <li>📧 contact@nexusreussite.academy</li>
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

    // Parent: send password reset email (so parent can set a password)
    try {
      const baseUrl = process.env.NEXTAUTH_URL || 'https://nexusreussite.academy';
      const token = generateResetToken(result.parent.userId, result.parent.email, result.parent.passwordHash);
      const resetUrl = `${baseUrl}/auth/reset-password?token=${encodeURIComponent(token)}`;
      await sendPasswordResetEmail(result.parent.email, result.parent.firstName || 'Parent', resetUrl);
    } catch (emailError) {
      if (process.env.NODE_ENV !== 'test') {
        console.error('[assistante/students POST] parent reset email failed:', emailError);
      }
    }

    // Student: generate activation link + send activation email
    try {
      const rawToken = crypto.randomBytes(32).toString('hex');
      const hashedToken = hashToken(rawToken);
      const expiresAt = new Date(Date.now() + 72 * 60 * 60 * 1000);

      await prisma.user.update({
        where: { id: result.student.userId },
        data: { activationToken: hashedToken, activationExpiry: expiresAt },
      });

      const baseUrl = process.env.NEXTAUTH_URL || 'https://nexusreussite.academy';
      const activationUrl = `${baseUrl}/auth/activate?token=${encodeURIComponent(rawToken)}`;

      await sendMail({
        to: result.student.email,
        subject: '🔐 Activation de votre compte — Nexus Réussite',
        html: buildActivationEmailHtml(result.student.firstName || 'Utilisateur', activationUrl),
        text: `Bonjour ${result.student.firstName || 'Utilisateur'}, activez votre compte: ${activationUrl}`,
      });
    } catch (emailError) {
      if (process.env.NODE_ENV !== 'test') {
        console.error('[assistante/students POST] student activation email failed:', emailError);
      }
    }

    return NextResponse.json(
      {
        success: true,
        message: 'Parent et élève créés avec succès',
        studentId: result.student.id,
      },
      { status: 201 }
    );
  } catch (error) {
    console.error('[API Assistante Students POST] Error:', error);
    return NextResponse.json(
      { error: 'Internal Server Error', message: 'Erreur lors de la création' },
      { status: 500 }
    );
  }
}
