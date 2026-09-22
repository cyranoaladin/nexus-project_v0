/**
 * HTTP-boundary proof for the bilan review routes (mission §7): every
 * mutation (generate/correct/validate/publish) and the ADMIN review read
 * are DIAGNOSTIC_BILAN_REVIEW-only — ASSISTANTE gets 403 on every one of
 * them, never a partial/redacted 200. The full ADMIN lifecycle is also
 * exercised end-to-end through the real route handlers (not just the
 * service functions), and the student route is proven to serve nothing
 * until the bilan is actually PUBLISHED.
 */
import { createHash, randomUUID } from 'node:crypto';
import { NextRequest } from 'next/server';

jest.mock('@/auth', () => ({ auth: jest.fn() }));

import { auth } from '@/auth';
import { type RouteContext } from '@/lib/core-v2/http/staff-route';
import { setupServiceHarness } from '../helpers/service-harness';
import { createHousehold, createStudent } from '@/lib/core-v2/services';
import { attributeDiagnostic } from '@/lib/core-v2/services/diagnostics';
import { depositOwnDiagnosticSubmission } from '@/lib/core-v2/diagnostics/submission-pipeline';
import { renderHtmlToPdf } from '@/lib/bilans/render/pdf';
import { drainDiagnosticSubmissionProcessingQueue, enqueueDiagnosticSubmissionProcessing } from '@/lib/core-v2/services/diagnostic-processing';
import { DEMO_ANSWER_HTML } from '@/lib/core-v2/diagnostics/demo-content';
import * as bilanRoute from '@/app/api/v2/staff/diagnostics/processing/[processingId]/bilan/route';
import * as correctRoute from '@/app/api/v2/staff/diagnostics/processing/[processingId]/bilan/correct/route';
import * as validateRoute from '@/app/api/v2/staff/diagnostics/processing/[processingId]/bilan/validate/route';
import * as publishRoute from '@/app/api/v2/staff/diagnostics/processing/[processingId]/bilan/publish/route';
import * as studentBilanRoute from '@/app/api/v2/student/diagnostics/processing/[processingId]/bilan/route';

const h = setupServiceHarness();
const mockedAuth = auth as unknown as jest.Mock;

beforeEach(() => {
  process.env.DIAGNOSTIC_DEMO_MODE = '1';
  process.env.DIAGNOSTIC_DEMO_STUDENT_IDS = '';
  process.env.OPENROUTER_API_KEY = ''; // deliberately unset: PREFLIGHT_BLOCKED, never a real network call from this HTTP-boundary suite
});

function allowDemoFixtureFor(...studentIds: string[]) {
  const existing = (process.env.DIAGNOSTIC_DEMO_STUDENT_IDS ?? '').split(',').filter(Boolean);
  process.env.DIAGNOSTIC_DEMO_STUDENT_IDS = [...existing, ...studentIds].join(',');
}

function signInAs(actor: { userId: string; role: string }) {
  mockedAuth.mockResolvedValue({ user: { id: actor.userId, role: actor.role, email: 'x@synthetic.test' }, expires: '2099-01-01' });
}

function paramsOf(params: Record<string, string>): RouteContext {
  return { params: Promise.resolve(params) };
}

async function callJson(
  handler: (req: NextRequest, ctx: RouteContext) => Promise<Response>,
  method: 'GET' | 'POST',
  path: string,
  params: Record<string, string>,
  json?: unknown,
) {
  const request = new NextRequest(`http://localhost:3000${path}`, {
    method,
    headers: { origin: 'http://localhost:3000', ...(json !== undefined ? { 'content-type': 'application/json' } : {}) },
    body: json !== undefined ? JSON.stringify(json) : undefined,
  });
  const response = await handler(request, paramsOf(params));
  const text = await response.text();
  return { status: response.status, text, body: text ? JSON.parse(text) : null };
}

async function seedExtractedProcessing(label: string) {
  const ctx = h.ctx();
  const { household } = await createHousehold(h.client, ctx, {
    parent: { firstName: `P${label}`, lastName: 'Synthetic', email: `parent-bilan-api-${label}@synthetic.test` },
  });
  const { student, user } = await createStudent(h.client, ctx, {
    householdId: household.id,
    student: { firstName: `S${label}`, lastName: 'Synthetic' },
  });
  allowDemoFixtureFor(student.id);
  await h.client.user.update({ where: { id: user.id }, data: { accountStatus: 'ACTIVE' } }); // resolveActor requires ACTIVE; createStudent defaults to PENDING_ACTIVATION
  const instrumentKey = `BILAN-API-${label}`;
  const instrument = await h.client.diagnosticInstrumentRef.create({
    data: {
      instrumentKey,
      version: '1.0.0',
      title: `Bilan API instrument ${label}`,
      subject: 'Test',
      level: 'Toutes',
      targetSession: 'DEMO',
      form: 'FORM_TEST',
      durationMinutes: 30,
      modalities: 'Test only.',
      catalogStatus: 'DEMO_FIXTURE',
      manifestChecksum: createHash('sha256').update(instrumentKey).digest('hex'),
      manifestVersion: 'test/1.0',
      subjectSha256: createHash('sha256').update(`subject-${instrumentKey}`).digest('hex'),
    },
  });
  const assignment = await attributeDiagnostic(h.client, ctx, { studentId: student.id, instrumentRefId: instrument.id });
  const pdf = await renderHtmlToPdf(DEMO_ANSWER_HTML);
  const { submission } = await depositOwnDiagnosticSubmission(h.client, h.ctx({ userId: user.id, role: 'ELEVE' }), {
    assignmentId: assignment.id,
    originalFilename: 'reponses.pdf',
    mimeType: 'application/pdf',
    bytes: pdf,
  });
  const processing = await enqueueDiagnosticSubmissionProcessing(h.client, ctx, submission.id);
  await drainDiagnosticSubmissionProcessingQueue(h.client);
  return { processingId: processing.id, user };
}

describe('ASSISTANTE is refused on every bilan-review route — never a partial 200', () => {
  test('GET/POST bilan, correct, validate, publish all return 403 for ASSISTANTE', async () => {
    const { processingId } = await seedExtractedProcessing(`ASST-${randomUUID()}`);
    signInAs(h.assistante);

    const getResult = await callJson(bilanRoute.GET, 'GET', `/api/v2/staff/diagnostics/processing/${processingId}/bilan`, { processingId });
    expect(getResult.status).toBe(403);

    const postResult = await callJson(bilanRoute.POST, 'POST', `/api/v2/staff/diagnostics/processing/${processingId}/bilan`, { processingId });
    expect(postResult.status).toBe(403);

    const correctResult = await callJson(
      correctRoute.POST,
      'POST',
      `/api/v2/staff/diagnostics/processing/${processingId}/bilan/correct`,
      { processingId },
      { editVersion: 1, humanReview: {} },
    );
    expect(correctResult.status).toBe(403);

    const validateResult = await callJson(
      validateRoute.POST,
      'POST',
      `/api/v2/staff/diagnostics/processing/${processingId}/bilan/validate`,
      { processingId },
      { editVersion: 1 },
    );
    expect(validateResult.status).toBe(403);

    const publishResult = await callJson(
      publishRoute.POST,
      'POST',
      `/api/v2/staff/diagnostics/processing/${processingId}/bilan/publish`,
      { processingId },
      { editVersion: 1, audienceScope: 'own-student' },
    );
    expect(publishResult.status).toBe(403);
  });
});

describe('ADMIN — full lifecycle through the real route handlers', () => {
  test('generate -> correct -> validate -> publish, then the candidate reads exactly the published revision', async () => {
    const { processingId, user } = await seedExtractedProcessing(`ADMIN-${randomUUID()}`);
    signInAs(h.admin);

    const generated = await callJson(bilanRoute.POST, 'POST', `/api/v2/staff/diagnostics/processing/${processingId}/bilan`, { processingId });
    expect(generated.status).toBe(201);
    expect(generated.body.data.status).toBe('DRAFT');
    expect(generated.body.data.aiProvenance.outcome).toBe('PREFLIGHT_BLOCKED'); // no OPENROUTER_API_KEY in this suite — by design
    const editVersion0 = generated.body.data.editVersion as number;

    const corrected = await callJson(
      correctRoute.POST,
      'POST',
      `/api/v2/staff/diagnostics/processing/${processingId}/bilan/correct`,
      { processingId },
      { editVersion: editVersion0, humanReview: { note: 'Vérifié.' } },
    );
    expect(corrected.status).toBe(200);

    const validated = await callJson(
      validateRoute.POST,
      'POST',
      `/api/v2/staff/diagnostics/processing/${processingId}/bilan/validate`,
      { processingId },
      { editVersion: corrected.body.data.editVersion },
    );
    expect(validated.status).toBe(200);
    expect(validated.body.data.status).toBe('VALIDATED');

    const published = await callJson(
      publishRoute.POST,
      'POST',
      `/api/v2/staff/diagnostics/processing/${processingId}/bilan/publish`,
      { processingId },
      { editVersion: validated.body.data.editVersion, audienceScope: 'own-student' },
    );
    expect(published.status).toBe(200);
    expect(published.body.data.status).toBe('PUBLISHED');

    signInAs({ userId: user.id, role: 'ELEVE' });
    const ownRead = await callJson(studentBilanRoute.GET, 'GET', `/api/v2/student/diagnostics/processing/${processingId}/bilan`, { processingId });
    expect(ownRead.status).toBe(200);
    expect(ownRead.body.data.revision).toBe(1);
  });

  test('the candidate gets 404, never the draft content, before publication', async () => {
    const { processingId, user } = await seedExtractedProcessing(`PREPUB-${randomUUID()}`);
    signInAs(h.admin);
    await callJson(bilanRoute.POST, 'POST', `/api/v2/staff/diagnostics/processing/${processingId}/bilan`, { processingId });

    signInAs({ userId: user.id, role: 'ELEVE' });
    const ownRead = await callJson(studentBilanRoute.GET, 'GET', `/api/v2/student/diagnostics/processing/${processingId}/bilan`, { processingId });
    expect(ownRead.status).toBe(404);
    expect(JSON.stringify(ownRead.body)).not.toMatch(/constat|deterministicResults/i);
  });
});
