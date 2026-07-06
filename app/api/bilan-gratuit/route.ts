export const dynamic = 'force-dynamic';

import { bilanGratuitSchema, type BilanGratuitData } from '@/lib/validations';
import { guardRateLimitAsync } from '@/lib/rate-limit';
import { checkCsrf, checkBodySize } from '@/lib/csrf';
import { serializeError } from '@/lib/utils/serialize-error';
import { captureContactLead, ContactLeadValidationError } from '@/lib/crm/contact-leads';
import { Subject, Grade } from '@/lib/assessments/core/types';
import {
  ASSESSMENT_FLOW_COOKIE_NAME,
  ASSESSMENT_FLOW_TOKEN_TTL_SECONDS,
  createAssessmentFlowToken,
  hashAssessmentLeadEmail,
} from '@/lib/assessments/public-token';
import { NextRequest, NextResponse } from 'next/server';

const bilanGratuitPublicSchema = bilanGratuitSchema.omit({ parentPassword: true }).strict();
type BilanGratuitPublicData = Omit<BilanGratuitData, 'parentPassword'>;

const neutralSuccessBody = {
  success: true,
  message: 'Votre demande a bien été enregistrée. Notre équipe vous recontactera pour la suite.',
} as const;

function mapBilanSubjectToAssessmentSubject(subjects: string[]): Subject {
  if (subjects.includes('MATHEMATIQUES')) return Subject.MATHS;
  if (subjects.includes('NSI')) return Subject.NSI;
  return Subject.GENERAL;
}

function mapBilanGradeToAssessmentGrade(grade: string): Grade.PREMIERE | Grade.TERMINALE {
  return grade === 'terminale' || grade === 'TERMINALE'
    ? Grade.TERMINALE
    : Grade.PREMIERE;
}

function buildAssessmentFlowToken(data: BilanGratuitPublicData) {
  return createAssessmentFlowToken({
    subject: mapBilanSubjectToAssessmentSubject(data.subjects),
    grade: mapBilanGradeToAssessmentGrade(data.studentGrade),
    source: 'bilan-gratuit',
    leadEmailHash: hashAssessmentLeadEmail(data.parentEmail),
  });
}

function neutralSuccessResponse(assessmentFlowToken?: string) {
  const response = NextResponse.json(neutralSuccessBody);
  if (assessmentFlowToken) {
    response.cookies.set(ASSESSMENT_FLOW_COOKIE_NAME, assessmentFlowToken, {
      httpOnly: true,
      sameSite: 'lax',
      secure: process.env.NODE_ENV === 'production',
      path: '/bilan-gratuit/assessment',
      maxAge: ASSESSMENT_FLOW_TOKEN_TTL_SECONDS,
    });
  }
  return response;
}

function safeErrorSummary(error: unknown) {
  const serialized = serializeError(error);
  if (serialized && typeof serialized === 'object' && !Array.isArray(serialized)) {
    return {
      name: typeof serialized.name === 'string' ? serialized.name : 'Error',
      message: typeof serialized.message === 'string' ? serialized.message : 'unknown',
    };
  }
  return { name: 'Error', message: String(serialized) };
}

function compactText(value: string | undefined, maxLength = 140) {
  const text = value?.trim();
  if (!text) return null;
  return text.length > maxLength ? `${text.slice(0, maxLength - 1)}…` : text;
}

function buildLeadNotes(data: BilanGratuitPublicData) {
  const resolvedStudentLastName = data.studentLastName ?? data.parentLastName;
  const notes = [
    `Élève: ${data.studentFirstName} ${resolvedStudentLastName}`,
    `Niveau: ${data.studentGrade}`,
    compactText(data.studentSchool, 80) ? `Établissement: ${compactText(data.studentSchool, 80)}` : null,
    `Matières: ${data.subjects.join(', ')}`,
    compactText(data.currentLevel, 60) ? `Niveau actuel: ${compactText(data.currentLevel, 60)}` : null,
    compactText(data.objectives, 140) ? `Objectifs: ${compactText(data.objectives, 140)}` : null,
    compactText(data.difficulties, 120) ? `Difficultés: ${compactText(data.difficulties, 120)}` : null,
    compactText(data.preferredModality, 40) ? `Modalité: ${compactText(data.preferredModality, 40)}` : null,
    compactText(data.availability, 80) ? `Disponibilités: ${compactText(data.availability, 80)}` : null,
    `Newsletter: ${data.acceptNewsletter ? 'oui' : 'non'}`,
  ].filter(Boolean).join('\n');

  return notes.slice(0, 500);
}

function buildBilanLead(data: BilanGratuitPublicData) {
  return {
    name: `${data.parentFirstName} ${data.parentLastName}`.trim(),
    email: data.parentEmail,
    phone: data.parentPhone,
    profile: 'Parent',
    interest: `Bilan gratuit - ${data.studentGrade}`,
    urgency: data.currentLevel ?? null,
    source: 'bilan-gratuit',
    notes: buildLeadNotes(data),
    type: 'bilan_gratuit',
    consent: data.acceptTerms,
  };
}

export async function POST(request: NextRequest) {
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

    const body = await request.json().catch(() => null);
    if (!body || typeof body !== 'object' || Array.isArray(body)) {
      return NextResponse.json(
        { error: 'Données invalides' },
        { status: 400 }
      );
    }

    const bodyRecord = body as Record<string, unknown>;

    // Honeypot check — bots fill hidden fields, humans don't
    if (bodyRecord.website || bodyRecord.url || bodyRecord.honeypot) {
      // Silently reject bot submissions with a fake success response
      return neutralSuccessResponse();
    }

    const {
      website: _website,
      url: _url,
      honeypot: _honeypot,
      ...candidatePayload
    } = bodyRecord;

    // Validation des données
    const parsedPayload = bilanGratuitPublicSchema.safeParse(candidatePayload);
    if (!parsedPayload.success) {
      return NextResponse.json(
        { error: 'Données invalides' },
        { status: 400 }
      );
    }
    const validatedData = parsedPayload.data;

    try {
      await captureContactLead(buildBilanLead(validatedData));
    } catch (leadError) {
      if (leadError instanceof ContactLeadValidationError) {
        return NextResponse.json(
          { error: 'Données invalides' },
          { status: 400 }
        );
      }
      throw leadError;
    }

    return neutralSuccessResponse(buildAssessmentFlowToken(validatedData));

  } catch (error) {
    if (process.env.NODE_ENV !== 'test') {
      console.error('Erreur demande bilan gratuit:', safeErrorSummary(error));
    }

    return NextResponse.json(
      { error: 'Erreur interne du serveur' },
      { status: 500 }
    );
  }
}
