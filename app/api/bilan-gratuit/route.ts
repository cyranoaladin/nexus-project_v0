export const dynamic = 'force-dynamic';

import { prisma } from '@/lib/prisma';
import { bilanGratuitSchema } from '@/lib/validations';
import { normalizeStudentLevelAndTrack } from '@/lib/utils/grade-utils';
import { guardSensitiveRateLimit } from '@/lib/rate-limit/sensitive';
import { checkCsrf } from '@/lib/csrf';
import { readBoundedRequestBody, RequestBodyTooLargeError } from '@/lib/http/bounded-request-body';
import { synchronizePreRentreeCampaignContext } from '@/lib/campaigns/pre-rentree-2026/bilan-prefill';
import { NextRequest, NextResponse } from 'next/server';
import { FAMILY_BODY_MAX_BYTES } from '@/lib/families/create-family';
import { createFamilyRequest } from '@/lib/families/requests';
import { normalizeParentPhone } from '@/lib/contact/parent-phone';
import {
  normalizeParentEmail,
  PARENT_ACTIVATION_PUBLIC_MESSAGE,
  withActivationSecurityHeaders,
} from '@/lib/auth/parent-activation';

function publicSuccessResponse() {
  return withActivationSecurityHeaders(NextResponse.json({
    success: true,
    message: PARENT_ACTIVATION_PUBLIC_MESSAGE,
  }));
}

function secureResponse(response: NextResponse) {
  return withActivationSecurityHeaders(response);
}

export async function POST(request: NextRequest) {
  try {
    // CSRF protection -- verify same-origin.
    const csrfResponse = checkCsrf(request);
    if (csrfResponse) return secureResponse(csrfResponse);

    // Rate-limit BEFORE reading the body: a public, unauthenticated endpoint
    // must reject a flood at the cheapest possible point, before spending
    // any CPU/IO reading the request. No parsed body exists yet at this
    // point, so this can only throttle by IP -- the per-email dimension used
    // to matter to avoid enumerating/hammering one victim's account, but
    // this route no longer creates or touches any account, so that
    // dimension no longer applies here.
    const blocked = await guardSensitiveRateLimit(request, { scope: 'parent-signup', identity: null });
    if (blocked) return secureResponse(blocked);

    let raw: unknown;
    try {
      raw = JSON.parse(await readBoundedRequestBody(request, FAMILY_BODY_MAX_BYTES));
    } catch (error) {
      if (error instanceof RequestBodyTooLargeError) {
        return secureResponse(NextResponse.json({ error: { code: 'REQUEST_BODY_TOO_LARGE' } }, { status: 413 }));
      }
      return secureResponse(NextResponse.json({ error: 'Données invalides' }, { status: 400 }));
    }

    // Honeypot check -- bots fill hidden fields, humans don't.
    if (raw && typeof raw === 'object') {
      const record = raw as Record<string, unknown>;
      if (record.website || record.url || record.honeypot) {
        return publicSuccessResponse();
      }
    }

    const normalizedBody = raw && typeof raw === 'object' &&
      'parentEmail' in (raw as Record<string, unknown>) && typeof (raw as Record<string, unknown>).parentEmail === 'string'
      ? { ...(raw as Record<string, unknown>), parentEmail: normalizeParentEmail((raw as Record<string, unknown>).parentEmail as string) }
      : raw;
    const validatedData = bilanGratuitSchema.parse(normalizedBody);
    const parentEmail = normalizeParentEmail(validatedData.parentEmail);
    const campaignContext = synchronizePreRentreeCampaignContext({
      campaignContext: validatedData.campaignContext ?? undefined,
      studentGrade: validatedData.studentGrade,
      // Les matières ne sont plus demandées à l'inscription : le picker les
      // recueille après activation, filtrées par niveau.
      subjects: validatedData.subjects ?? [],
    });

    const gTrack = normalizeStudentLevelAndTrack(validatedData.studentGrade);
    if (!gTrack) {
      return secureResponse(NextResponse.json(
        { error: `Niveau scolaire non reconnu : ${validatedData.studentGrade}` },
        { status: 400 }
      ));
    }

    let parentPhone;
    try {
      parentPhone = normalizeParentPhone(validatedData.parentPhone);
    } catch {
      return secureResponse(NextResponse.json({ error: 'Numéro de téléphone invalide' }, { status: 400 }));
    }

    const resolvedStudentLastName = validatedData.studentLastName ?? validatedData.parentLastName;
    const now = new Date();

    // Amendement 7 : une soumission publique du bilan gratuit ne crée plus
    // jamais de compte -- elle capture l'intention dans une FamilyRequest,
    // qu'un membre du staff (ADMIN/ASSISTANTE) qualifie puis convertit en
    // foyer réel via createFamily(). Le lead de campagne (attribution
    // marketing) reste écrit tel quel : c'est le mécanisme déjà établi,
    // indépendant de la création de compte.
    await prisma.$transaction(async (tx) => {
      await createFamilyRequest(tx, {
        type: 'BILAN_GRATUIT',
        contactFirstName: validatedData.parentFirstName,
        contactLastName: validatedData.parentLastName,
        contactEmail: parentEmail,
        contactPhone: parentPhone.display,
        contactPhoneNormalized: parentPhone.normalized,
        now,
        children: [{
          firstName: validatedData.studentFirstName,
          lastName: resolvedStudentLastName,
          birthDate: validatedData.studentBirthDate ? new Date(validatedData.studentBirthDate) : null,
          gradeLevel: gTrack.level,
          academicTrack: gTrack.track,
          school: validatedData.studentSchool || null,
        }],
      });

      if (campaignContext) {
        await tx.contactLead.create({
          data: {
            name: `${validatedData.parentFirstName} ${validatedData.parentLastName}`,
            email: parentEmail,
            phone: parentPhone.display,
            profile: JSON.stringify(campaignContext.profile),
            interest: `${campaignContext.packCode} · ${campaignContext.level} · ${campaignContext.subjectIds.join(', ')}`,
            source: campaignContext.programme,
          },
        });
      }
    });

    return publicSuccessResponse();

  } catch (error) {
    if (error instanceof Error && error.name === 'ZodError') {
      return secureResponse(NextResponse.json(
        { error: 'Données invalides' },
        { status: 400 }
      ));
    }

    if (process.env.NODE_ENV !== 'test') {
      console.error('[bilan-gratuit] Family request capture failed', {
        code: error && typeof error === 'object' && 'code' in error ? String(error.code) : 'FAMILY_REQUEST_FAILED',
        at: new Date().toISOString(),
      });
    }

    return secureResponse(NextResponse.json(
      { error: 'Erreur interne du serveur' },
      { status: 500 }
    ));
  }
}
