/**
 * C2 counter-proof (mission §4): triggering/tracking a processing run
 * (DIAGNOSTIC_SUBMISSION_TRACK, ASSISTANTE has it) must never leak the
 * academic content itself — that stays behind the dedicated /content
 * route's DIAGNOSTIC_SUBMISSION_CONTENT_READ (ADMIN only). A unique
 * sentinel string is planted in the deposited answer's real, extracted
 * text; every ASSISTANTE-reachable response (POST trigger, POST retry
 * after a forced failure, GET status) is asserted to never contain it,
 * while the dedicated content route — reached only by ADMIN — does.
 */
import { createHash, randomUUID } from 'node:crypto';
import { NextRequest } from 'next/server';

jest.mock('@/auth', () => ({ auth: jest.fn() }));
jest.mock('@/lib/core-v2/diagnostics/text-extraction', () => {
  const actual = jest.requireActual('@/lib/core-v2/diagnostics/text-extraction');
  return { ...actual, extractSubmissionTextBounded: jest.fn(actual.extractSubmissionTextBounded) };
});

import { auth } from '@/auth';
import { type RouteContext } from '@/lib/core-v2/http/staff-route';
import { setupServiceHarness } from '../helpers/service-harness';
import { createHousehold, createStudent } from '@/lib/core-v2/services';
import { attributeDiagnostic } from '@/lib/core-v2/services/diagnostics';
import { depositOwnDiagnosticSubmission } from '@/lib/core-v2/diagnostics/submission-pipeline';
import { renderHtmlToPdf } from '@/lib/bilans/render/pdf';
import { extractSubmissionTextBounded } from '@/lib/core-v2/diagnostics/text-extraction';
import * as processingRoute from '@/app/api/v2/staff/diagnostics/submissions/[submissionId]/processing/route';
import * as contentRoute from '@/app/api/v2/staff/diagnostics/submissions/[submissionId]/processing/content/route';

const h = setupServiceHarness();
const mockedAuth = auth as unknown as jest.Mock;
const mockedExtract = extractSubmissionTextBounded as jest.MockedFunction<typeof extractSubmissionTextBounded>;

beforeEach(() => {
  process.env.DIAGNOSTIC_DEMO_MODE = '1';
  process.env.DIAGNOSTIC_DEMO_STUDENT_IDS = '';
  mockedExtract.mockClear();
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
) {
  const request = new NextRequest(`http://localhost:3000${path}`, { method, headers: { origin: 'http://localhost:3000' } });
  const response = await handler(request, paramsOf(params));
  const text = await response.text();
  return { status: response.status, text, body: text ? JSON.parse(text) : null };
}

async function seedAssignmentWithSubmission(label: string, sentinel: string) {
  const ctx = h.ctx();
  const { household } = await createHousehold(h.client, ctx, {
    parent: { firstName: `P${label}`, lastName: 'Synthetic', email: `parent-processing-api-${label}@synthetic.test` },
  });
  const { student, user } = await createStudent(h.client, ctx, {
    householdId: household.id,
    student: { firstName: `S${label}`, lastName: 'Synthetic' },
  });
  allowDemoFixtureFor(student.id);

  const instrumentKey = `PROCESSING-API-${label}`;
  const instrument = await h.client.diagnosticInstrumentRef.create({
    data: {
      instrumentKey,
      version: '1.0.0',
      title: `Processing API instrument ${label}`,
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

  const pdf = await renderHtmlToPdf(`<html><body><p>${sentinel}</p></body></html>`);
  const { submission } = await depositOwnDiagnosticSubmission(h.client, h.ctx({ userId: user.id, role: 'ELEVE' }), {
    assignmentId: assignment.id,
    originalFilename: 'reponses.pdf',
    mimeType: 'application/pdf',
    bytes: pdf,
  });
  return { submission };
}

function assertNoSentinel(haystack: string, sentinel: string) {
  expect(haystack).not.toContain(sentinel);
}

describe('processing routes — ASSISTANTE never sees the academic content', () => {
  test('POST trigger, GET status: 202/200, ASSISTANTE gets a real result, sentinel never appears', async () => {
    const sentinel = `SENTINEL-${randomUUID()}`;
    const { submission } = await seedAssignmentWithSubmission('A', sentinel);

    signInAs(h.assistante);
    const posted = await callJson(processingRoute.POST, 'POST', `/api/v2/staff/diagnostics/submissions/${submission.id}/processing`, {
      submissionId: submission.id,
    });
    expect(posted.status).toBe(202);
    expect(posted.body.data.extraction.status).toBe('SUCCEEDED');
    expect(posted.body.data.extraction.extractedText).toBeUndefined();
    assertNoSentinel(posted.text, sentinel);

    const status = await callJson(processingRoute.GET, 'GET', `/api/v2/staff/diagnostics/submissions/${submission.id}/processing`, {
      submissionId: submission.id,
    });
    expect(status.status).toBe(200);
    assertNoSentinel(status.text, sentinel);

    signInAs(h.admin);
    const content = await callJson(contentRoute.GET, 'GET', `/api/v2/staff/diagnostics/submissions/${submission.id}/processing/content`, {
      submissionId: submission.id,
    });
    expect(content.status).toBe(200);
    expect(content.text).toContain(sentinel);
  });

  test('ASSISTANTE is refused on the dedicated content route (403), never a silent empty body', async () => {
    const sentinel = `SENTINEL-${randomUUID()}`;
    const { submission } = await seedAssignmentWithSubmission('B', sentinel);

    signInAs(h.assistante);
    await callJson(processingRoute.POST, 'POST', `/api/v2/staff/diagnostics/submissions/${submission.id}/processing`, {
      submissionId: submission.id,
    });

    const content = await callJson(contentRoute.GET, 'GET', `/api/v2/staff/diagnostics/submissions/${submission.id}/processing/content`, {
      submissionId: submission.id,
    });
    expect(content.status).toBe(403);
    assertNoSentinel(content.text, sentinel);
  });

  test('a forced failure then a retry: both ASSISTANTE-visible responses stay free of the sentinel', async () => {
    const sentinel = `SENTINEL-${randomUUID()}`;
    const { submission } = await seedAssignmentWithSubmission('C', sentinel);

    mockedExtract.mockResolvedValueOnce({ status: 'FAILED', errorMessage: 'SIMULATED_TRANSIENT_FAILURE' });

    signInAs(h.assistante);
    const first = await callJson(processingRoute.POST, 'POST', `/api/v2/staff/diagnostics/submissions/${submission.id}/processing`, {
      submissionId: submission.id,
    });
    expect(first.status).toBe(202);
    expect(first.body.data.extraction.status).toBe('FAILED');
    assertNoSentinel(first.text, sentinel);

    const retry = await callJson(processingRoute.POST, 'POST', `/api/v2/staff/diagnostics/submissions/${submission.id}/processing`, {
      submissionId: submission.id,
    });
    expect(retry.status).toBe(202);
    expect(retry.body.data.extraction.status).toBe('SUCCEEDED');
    assertNoSentinel(retry.text, sentinel);

    signInAs(h.admin);
    const content = await callJson(contentRoute.GET, 'GET', `/api/v2/staff/diagnostics/submissions/${submission.id}/processing/content`, {
      submissionId: submission.id,
    });
    expect(content.status).toBe(200);
    expect(content.text).toContain(sentinel);
  });

  test('no session at all: refused before any data is read', async () => {
    const sentinel = `SENTINEL-${randomUUID()}`;
    const { submission } = await seedAssignmentWithSubmission('D', sentinel);
    mockedAuth.mockResolvedValue(null);

    const posted = await callJson(processingRoute.POST, 'POST', `/api/v2/staff/diagnostics/submissions/${submission.id}/processing`, {
      submissionId: submission.id,
    });
    expect(posted.status).toBe(401);
    assertNoSentinel(posted.text, sentinel);
  });
});
