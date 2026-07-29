export const dynamic = 'force-dynamic';

import { prisma } from '@/lib/prisma';
import { bilanGratuitSchema, type BilanGratuitData } from '@/lib/validations';
import { normalizeStudentLevelAndTrack } from '@/lib/utils/grade-utils';
import { UserRole } from '@/types/enums';
import { guardRateLimitAsync } from '@/lib/rate-limit';
import { checkCsrf, checkBodySize } from '@/lib/csrf';
import { serializeError } from '@/lib/utils/serialize-error';
import { synchronizePreRentreeCampaignContext } from '@/lib/campaigns/pre-rentree-2026/bilan-prefill';
import { captureContactLead } from '@/lib/crm/contact-leads';
import { createId } from '@paralleldrive/cuid2';
import crypto from 'crypto';
import { NextRequest, NextResponse } from 'next/server';

// Réponse générique : ne doit jamais permettre de distinguer, depuis l'extérieur,
// une création de compte d'une demande reçue sur un email de parent déjà client
// (énumération de comptes sur un endpoint public non authentifié).
const GENERIC_SUCCESS_MESSAGE =
  'Votre demande a bien été enregistrée. Vous allez recevoir un e-mail avec la marche à suivre.';

/**
 * Notifie l'équipe qu'une demande de bilan gratuit vient d'arriver — quel
 * que soit son issue (nouveau compte, compte existant, échec technique).
 * Aucune donnée personnelle du mineur (pas de prénom élève, pas de niveau,
 * pas d'établissement) : seulement l'identité du parent et le canal
 * technique de la demande. Même mécanisme que les autres canaux
 * (`captureContactLead`), pas un second système de notification.
 */
async function notifyStaffOfBilanSubmission(
  validatedData: { parentFirstName: string; parentLastName: string; parentEmail: string; parentPhone: string; acceptTerms: boolean },
  source: 'bilan-gratuit-new-account' | 'bilan-gratuit-existing-account' | 'bilan-gratuit-error',
  interest: string,
  isTestEnv: boolean,
) {
  try {
    await captureContactLead({
      name: `${validatedData.parentFirstName} ${validatedData.parentLastName}`.trim(),
      email: validatedData.parentEmail,
      phone: validatedData.parentPhone,
      profile: source === 'bilan-gratuit-existing-account' ? 'Parent (compte existant)' : 'Parent',
      interest,
      source,
      type: source.replace(/-/g, '_'),
      consent: validatedData.acceptTerms,
    });
  } catch (leadError) {
    if (!isTestEnv) {
      console.error(`Erreur notification interne (${source}):`, serializeError(leadError));
    }
  }
}

export async function POST(request: NextRequest) {
  const isTestEnv = process.env.NODE_ENV === 'test';
  // Hoisted above the try/catch so the failure path (Décision 3) can notify
  // staff for a genuine, validated submission that failed technically —
  // without needing to notify for a request that never even parsed (Zod
  // validation failure, honeypot rejection): those aren't real submissions.
  let validatedData: BilanGratuitData | undefined;

  try {

    // CSRF protection — verify same-origin
    const csrfResponse = checkCsrf(request);
    if (csrfResponse) return csrfResponse;

    // Body size limit — reject oversized payloads (1MB)
    const bodySizeResponse = checkBodySize(request);
    if (bodySizeResponse) return bodySizeResponse;

    // Rate limiting
    const blocked = await guardRateLimitAsync(request, { preset: 'api', keySuffix: 'bilan-gratuit' });
    if (blocked) return blocked;

    const body = await request.json();

    // Honeypot check — bots fill hidden fields, humans don't
    if (body.website || body.url || body.honeypot) {
      // Silently reject bot submissions with a fake success response
      return NextResponse.json({ success: true, message: 'Inscription réussie !' });
    }

    // Validation des données
    validatedData = bilanGratuitSchema.parse(body);
    const campaignContext = synchronizePreRentreeCampaignContext({
      campaignContext: validatedData.campaignContext ?? undefined,
      studentGrade: validatedData.studentGrade,
      subjects: validatedData.subjects,
    });

    // Vérifier si l'email parent existe déjà
    let existingUser = null;
    try {
      existingUser = await prisma.user.findUnique({ where: { email: validatedData.parentEmail } });
    } catch (dbErr) {
      if (!isTestEnv) {
        console.error('DB check failed:', serializeError(dbErr));
      }
    }

    if (existingUser) {
      // Ne jamais révéler qu'un compte existe déjà (énumération de comptes) :
      // même statut, même forme de réponse, même ordre de grandeur de travail
      // que le chemin de création — voir docs/audits/2026-07-28-bilan-gratuit-cemetery-and-account-creation-bug.md.
      let existingParentId = existingUser.id;
      let existingStudentId = existingUser.id;
      try {
        const parentProfile = await prisma.parentProfile.findUnique({
          where: { userId: existingUser.id },
          include: { children: { take: 1, select: { id: true } } },
        });
        if (parentProfile?.children?.[0]?.id) {
          existingStudentId = parentProfile.children[0].id;
        }
      } catch (lookupErr) {
        if (!isTestEnv) {
          console.error('Erreur résolution profil parent existant:', serializeError(lookupErr));
        }
      }

      await notifyStaffOfBilanSubmission(
        validatedData,
        'bilan-gratuit-existing-account',
        'Bilan gratuit - nouvelle demande sur compte existant',
        isTestEnv,
      );

      // Email cohérent pour le parent : ni une erreur, ni une invitation à créer un doublon.
      try {
        const { sendExistingAccountBilanEmail } = await import('@/lib/email');
        await sendExistingAccountBilanEmail(
          existingUser.email,
          `${validatedData.parentFirstName} ${validatedData.parentLastName}`
        );
      } catch (emailError) {
        if (!isTestEnv) {
          console.error('Erreur envoi email (compte existant):', serializeError(emailError));
        }
      }

      return NextResponse.json({
        success: true,
        message: GENERIC_SUCCESS_MESSAGE,
        parentId: existingParentId,
        studentId: existingStudentId,
      });
    }

    // Rebind to a const: TypeScript can't carry the "defined past this point"
    // narrowing of the outer `let validatedData` into the async closures below
    // (prisma.$transaction's callback).
    const data = validatedData;
    const resolvedStudentLastName = data.studentLastName ?? data.parentLastName;
    const rawActivationToken = `act_${createId()}_${crypto.randomBytes(16).toString('hex')}`;
    const hashedActivationToken = crypto.createHash('sha256').update(rawActivationToken).digest('hex');
    const activationExpiry = new Date(Date.now() + 72 * 60 * 60 * 1000);

    // Normaliser le niveau scolaire AVANT la transaction
    const gTrack = normalizeStudentLevelAndTrack(data.studentGrade);
    
    if (!gTrack) {
      return NextResponse.json(
        { error: `Niveau scolaire non reconnu : ${data.studentGrade}` },
        { status: 400 }
      );
    }

    // Transaction pour créer parent et élève
    const result = await prisma.$transaction(async (tx) => {
      // Créer le compte parent
      const parentUser = await tx.user.create({
        data: {
          email: data.parentEmail,
          password: null,
          role: UserRole.PARENT,
          firstName: data.parentFirstName,
          lastName: data.parentLastName,
          phone: data.parentPhone,
          activatedAt: null,
          activationToken: hashedActivationToken,
          activationExpiry,
        }
      });

      // Créer le profil parent
      const parentProfile = await tx.parentProfile.create({
        data: {
          userId: parentUser.id
        }
      });

      // Créer le compte élève sans accès direct.
      // Email format: prenom.nom.random@nexus-student.local to ensure uniqueness
      const studentEmailSlug = `${data.studentFirstName.toLowerCase()}.${resolvedStudentLastName.toLowerCase()}.${createId().slice(0, 4)}@nexus-student.local`;
      
      const studentUser = await tx.user.create({
        data: {
          email: studentEmailSlug,
          role: UserRole.ELEVE,
          firstName: data.studentFirstName,
          lastName: resolvedStudentLastName,
          password: null,
          activatedAt: null,
        }
      });

      const student = await tx.student.create({
        data: {
          parentId: parentProfile.id,
          userId: studentUser.id,
          grade: data.studentGrade,
          gradeLevel: gTrack.level,
          academicTrack: gTrack.track,
          school: data.studentSchool,
          birthDate: data.studentBirthDate ? new Date(data.studentBirthDate) : null
        }
      });

      const campaignLead = campaignContext
        ? await tx.contactLead.create({
            data: {
              name: `${data.parentFirstName} ${data.parentLastName}`,
              email: data.parentEmail,
              phone: data.parentPhone,
              profile: JSON.stringify(campaignContext.profile),
              interest: `${campaignContext.packCode} · ${campaignContext.level} · ${campaignContext.subjectIds.join(', ')}`,
              source: campaignContext.programme,
            },
          })
        : null;

      return { parentUser, studentUser, student, campaignLead };
    });

    await notifyStaffOfBilanSubmission(
      validatedData,
      'bilan-gratuit-new-account',
      'Bilan gratuit - nouvelle demande, nouveau compte créé',
      isTestEnv,
    );

    // Envoyer email de bienvenue
    try {
      const { sendWelcomeParentEmail } = await import('@/lib/email');
      const activationUrl = `${process.env.NEXTAUTH_URL || 'https://nexusreussite.academy'}/auth/activate?token=${encodeURIComponent(rawActivationToken)}&source=bilan-gratuit`;
      await sendWelcomeParentEmail(
        result.parentUser.email,
        `${result.parentUser.firstName} ${result.parentUser.lastName}`,
        `${result.studentUser.firstName} ${result.studentUser.lastName}`,
        activationUrl
      );
    } catch (emailError) {
      if (!isTestEnv) {
        console.error('Erreur envoi email de bienvenue:', serializeError(emailError));
      }
      // Ne pas faire échouer l'inscription si l'email ne part pas
    }

    return NextResponse.json({
      success: true,
      message: GENERIC_SUCCESS_MESSAGE,
      parentId: result.parentUser.id,
      studentId: result.student.id
    });

  } catch (error) {
    if (process.env.NODE_ENV !== 'test') {
      console.error('Erreur inscription bilan gratuit:', serializeError(error));
    }

    const isZodError = error instanceof Error && error.name === 'ZodError';

    // Notify staff for a genuine, validated submission that failed
    // technically (e.g. a transaction error during account creation) — not
    // for a request that never validated (Zod error) or was silently
    // rejected as a bot (no validatedData in either case).
    if (validatedData && !isZodError) {
      await notifyStaffOfBilanSubmission(
        validatedData,
        'bilan-gratuit-error',
        'Bilan gratuit - nouvelle demande, échec technique de création de compte',
        isTestEnv,
      );
    }

    if (isZodError) {
      return NextResponse.json(
        { error: 'Données invalides', details: (error as Error).message },
        { status: 400 }
      );
    }

    return NextResponse.json(
      { error: 'Erreur interne du serveur' },
      { status: 500 }
    );
  }
}
