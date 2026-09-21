/**
 * Diagnostics candidats libres — C1, wire-level proof. Mirrors the exact
 * acceptance list from the mission (§10): staff attribution from a dossier,
 * candidate self-service subject access and deposit, staff follow-up,
 * refusal across candidates, and refusal without a session.
 */
import { createHash } from 'node:crypto';
import { NextRequest } from 'next/server';

jest.mock('@/auth', () => ({ auth: jest.fn() }));

import { auth } from '@/auth';
import { NO_PARAMS, type RouteContext } from '@/lib/core-v2/http/staff-route';
import { setupServiceHarness } from '../helpers/service-harness';
import * as catalogRoute from '@/app/api/v2/staff/diagnostics/catalog/route';
import * as studentDiagnosticsRoute from '@/app/api/v2/staff/students/[id]/diagnostics/route';
import * as revokeRoute from '@/app/api/v2/staff/diagnostics/assignments/[assignmentId]/revoke/route';
import * as ownAssignmentsRoute from '@/app/api/v2/student/diagnostics/assignments/route';
import * as subjectRoute from '@/app/api/v2/student/diagnostics/assignments/[assignmentId]/subject/route';
import * as submissionsRoute from '@/app/api/v2/student/diagnostics/assignments/[assignmentId]/submissions/route';
import { diagnosticInstrumentSubjectRelativePath, writeDiagnosticStorageFixture } from '@/lib/core-v2/diagnostics/storage';

const h = setupServiceHarness();
const mockedAuth = auth as unknown as jest.Mock;

beforeEach(() => {
  process.env.DIAGNOSTIC_DEMO_MODE = '1';
  process.env.DIAGNOSTIC_DEMO_STUDENT_IDS = '';
});

/** Extends the demo allowlist for this test — mirrors the real env-var contract (mission §3), never a bypass. */
function allowDemoFixtureFor(...studentIds: string[]) {
  const existing = (process.env.DIAGNOSTIC_DEMO_STUDENT_IDS ?? '').split(',').filter(Boolean);
  process.env.DIAGNOSTIC_DEMO_STUDENT_IDS = [...existing, ...studentIds].join(',');
}

function signInAs(user: { id: string; role: string } | null) {
  mockedAuth.mockResolvedValue(
    user ? { user: { id: user.id, role: user.role, email: 'x@synthetic.test' }, expires: '2099-01-01' } : null,
  );
}

function paramsOf(params: Record<string, string>): RouteContext {
  return { params: Promise.resolve(params) };
}

async function getJson(handler: (req: NextRequest, ctx: RouteContext) => Promise<Response>, path: string, params: Record<string, string> = {}) {
  const request = new NextRequest(`http://localhost:3000${path}`, { method: 'GET', headers: { origin: 'http://localhost:3000' } });
  const response = await handler(request, Object.keys(params).length ? paramsOf(params) : NO_PARAMS);
  return { status: response.status, body: await response.json() };
}

/** For the subject route, whose success body is raw PDF bytes, never JSON. */
async function getRaw(handler: (req: NextRequest, ctx: RouteContext) => Promise<Response>, path: string, params: Record<string, string> = {}) {
  const request = new NextRequest(`http://localhost:3000${path}`, { method: 'GET', headers: { origin: 'http://localhost:3000' } });
  const response = await handler(request, Object.keys(params).length ? paramsOf(params) : NO_PARAMS);
  return { status: response.status, contentType: response.headers.get('content-type'), response };
}

async function postJson(
  handler: (req: NextRequest, ctx: RouteContext) => Promise<Response>,
  path: string,
  body: unknown,
  params: Record<string, string> = {},
) {
  const request = new NextRequest(`http://localhost:3000${path}`, {
    method: 'POST',
    headers: { origin: 'http://localhost:3000', 'content-type': 'application/json' },
    body: JSON.stringify(body),
  });
  const response = await handler(request, Object.keys(params).length ? paramsOf(params) : NO_PARAMS);
  return { status: response.status, body: await response.json() };
}

async function seedStudentWithAccount(label: string) {
  const parent = await h.client.user.create({ data: { role: 'PARENT', email: `parent-${label}@synthetic.test`, accountStatus: 'ACTIVE' } });
  const household = await h.client.household.create({ data: { parents: { create: { userId: parent.id, isPrimaryContact: true } } } });
  const eleveUser = await h.client.user.create({
    data: { role: 'ELEVE', email: `eleve-${label}@synthetic.test`, accountStatus: 'ACTIVE' },
  });
  const student = await h.client.student.create({ data: { userId: eleveUser.id, householdId: household.id } });
  return { student, eleveUser };
}

async function seedInstrument(label: string, catalogStatus: 'DEMO_FIXTURE' | 'IN_REVIEW' | 'COMPROMISED' = 'DEMO_FIXTURE') {
  const instrumentKey = `HTTP-TEST-${label}`;
  const instrument = await h.client.diagnosticInstrumentRef.create({
    data: {
      instrumentKey,
      version: '1.0.0',
      title: `Instrument ${label}`,
      subject: 'Test',
      level: 'Toutes',
      targetSession: 'DEMO',
      form: 'FORM_TEST',
      durationMinutes: 30,
      modalities: 'Test only.',
      catalogStatus,
      manifestChecksum: createHash('sha256').update(instrumentKey).digest('hex'),
      manifestVersion: 'test/1.0',
    },
  });
  await writeDiagnosticStorageFixture(
    diagnosticInstrumentSubjectRelativePath(instrument.id),
    Buffer.from('%PDF-1.0\n1 0 obj<</Type/Catalog>>endobj\ntrailer<</Root 1 0 R>>\n%%EOF\n'),
  );
  return instrument;
}

describe('GET /api/v2/staff/diagnostics/catalog', () => {
  test('ASSISTANTE can read it; ELEVE, PARENT and an anonymous caller cannot', async () => {
    await seedInstrument('CATALOG-1');
    signInAs({ id: h.assistante.userId, role: 'ASSISTANTE' });
    const staffRead = await getJson(catalogRoute.GET, '/api/v2/staff/diagnostics/catalog');
    expect(staffRead.status).toBe(200);
    expect(staffRead.body.data.some((i: { instrumentKey: string }) => i.instrumentKey === 'HTTP-TEST-CATALOG-1')).toBe(true);

    signInAs({ id: h.parentActor.userId, role: 'PARENT' });
    expect((await getJson(catalogRoute.GET, '/api/v2/staff/diagnostics/catalog')).status).toBe(403);

    signInAs(null);
    expect((await getJson(catalogRoute.GET, '/api/v2/staff/diagnostics/catalog')).status).toBe(401);
  });
});

describe('POST /api/v2/staff/students/[id]/diagnostics — attribution from the dossier', () => {
  test('ASSISTANTE attributes a DEMO_FIXTURE instrument; the assignment appears in the staff dossier view', async () => {
    const { student } = await seedStudentWithAccount('A');
    allowDemoFixtureFor(student.id);
    const instrument = await seedInstrument('ATTRIBUTE-1');

    signInAs({ id: h.assistante.userId, role: 'ASSISTANTE' });
    const attributed = await postJson(
      studentDiagnosticsRoute.POST,
      `/api/v2/staff/students/${student.id}/diagnostics`,
      { instrumentRefId: instrument.id },
      { id: student.id },
    );
    expect(attributed.status).toBe(201);
    expect(attributed.body.data.status).toBe('ASSIGNED');
    expect(attributed.body.data.instrumentKeySnapshot).toBe('HTTP-TEST-ATTRIBUTE-1');

    const dossier = await getJson(studentDiagnosticsRoute.GET, `/api/v2/staff/students/${student.id}/diagnostics`, { id: student.id });
    expect(dossier.status).toBe(200);
    expect(dossier.body.data).toHaveLength(1);
    expect(dossier.body.data[0].instrumentRef.instrumentKey).toBe('HTTP-TEST-ATTRIBUTE-1');
  });

  test('refuses an IN_REVIEW instrument with 409 INVALID_STATE — never silently accepted', async () => {
    const { student } = await seedStudentWithAccount('B');
    const instrument = await seedInstrument('ATTRIBUTE-REVIEW-1', 'IN_REVIEW');

    signInAs({ id: h.admin.userId, role: 'ADMIN' });
    const attributed = await postJson(
      studentDiagnosticsRoute.POST,
      `/api/v2/staff/students/${student.id}/diagnostics`,
      { instrumentRefId: instrument.id },
      { id: student.id },
    );
    expect(attributed.status).toBe(409);
    expect(attributed.body.error.code).toBe('INVALID_STATE');
  });

  test('a double click (same instrument, same student, twice) is refused as a 409 conflict — never two rows', async () => {
    const { student } = await seedStudentWithAccount('C');
    allowDemoFixtureFor(student.id);
    const instrument = await seedInstrument('DOUBLE-CLICK-HTTP-1');
    signInAs({ id: h.assistante.userId, role: 'ASSISTANTE' });

    const body = { instrumentRefId: instrument.id };
    const first = await postJson(studentDiagnosticsRoute.POST, `/api/v2/staff/students/${student.id}/diagnostics`, body, { id: student.id });
    expect(first.status).toBe(201);
    const second = await postJson(studentDiagnosticsRoute.POST, `/api/v2/staff/students/${student.id}/diagnostics`, body, { id: student.id });
    expect(second.status).toBe(409);

    const all = await h.client.diagnosticAssignment.findMany({ where: { studentId: student.id } });
    expect(all).toHaveLength(1);
  });
});

describe('POST /api/v2/staff/diagnostics/assignments/[assignmentId]/revoke', () => {
  test('ADMIN revokes; the assignment keeps its history (row is not deleted)', async () => {
    const { student } = await seedStudentWithAccount('D');
    allowDemoFixtureFor(student.id);
    const instrument = await seedInstrument('REVOKE-HTTP-1');
    signInAs({ id: h.assistante.userId, role: 'ASSISTANTE' });
    const attributed = await postJson(
      studentDiagnosticsRoute.POST,
      `/api/v2/staff/students/${student.id}/diagnostics`,
      { instrumentRefId: instrument.id },
      { id: student.id },
    );
    const assignmentId = attributed.body.data.id;

    signInAs({ id: h.admin.userId, role: 'ADMIN' });
    const revoked = await postJson(
      revokeRoute.POST,
      `/api/v2/staff/diagnostics/assignments/${assignmentId}/revoke`,
      { reason: 'Test revocation.' },
      { assignmentId },
    );
    expect(revoked.status).toBe(200);
    expect(revoked.body.data.status).toBe('REVOKED');

    const stillThere = await h.client.diagnosticAssignment.findUniqueOrThrow({ where: { id: assignmentId } });
    expect(stillThere.status).toBe('REVOKED');
  });
});

describe('candidate self-service: assignments, subject, deposit', () => {
  test('the candidate sees only their own assignment; another candidate cannot read it (404, not 403)', async () => {
    const { student: studentA, eleveUser: userA } = await seedStudentWithAccount('E1');
    const { eleveUser: userB } = await seedStudentWithAccount('E2');
    allowDemoFixtureFor(studentA.id);
    const instrument = await seedInstrument('SELF-SERVICE-HTTP-1');
    signInAs({ id: h.assistante.userId, role: 'ASSISTANTE' });
    const attributed = await postJson(
      studentDiagnosticsRoute.POST,
      `/api/v2/staff/students/${studentA.id}/diagnostics`,
      { instrumentRefId: instrument.id },
      { id: studentA.id },
    );
    const assignmentId = attributed.body.data.id;

    signInAs({ id: userA.id, role: 'ELEVE' });
    const ownList = await getJson(ownAssignmentsRoute.GET, '/api/v2/student/diagnostics/assignments');
    expect(ownList.status).toBe(200);
    expect(ownList.body.data).toHaveLength(1);

    const ownSubject = await getRaw(subjectRoute.GET, `/api/v2/student/diagnostics/assignments/${assignmentId}/subject`, { assignmentId });
    expect(ownSubject.status).toBe(200);
    expect(ownSubject.contentType).toBe('application/pdf');

    signInAs({ id: userB.id, role: 'ELEVE' });
    const foreignList = await getJson(ownAssignmentsRoute.GET, '/api/v2/student/diagnostics/assignments');
    expect(foreignList.body.data).toHaveLength(0);
    const foreignSubject = await getRaw(subjectRoute.GET, `/api/v2/student/diagnostics/assignments/${assignmentId}/subject`, { assignmentId });
    expect(foreignSubject.status).toBe(404);
  });

  test('subject access is refused without a session (401)', async () => {
    const { student } = await seedStudentWithAccount('F');
    allowDemoFixtureFor(student.id);
    const instrument = await seedInstrument('ANON-SUBJECT-1');
    signInAs({ id: h.assistante.userId, role: 'ASSISTANTE' });
    const attributed = await postJson(
      studentDiagnosticsRoute.POST,
      `/api/v2/staff/students/${student.id}/diagnostics`,
      { instrumentRefId: instrument.id },
      { id: student.id },
    );

    signInAs(null);
    const anon = await getJson(
      subjectRoute.GET as never,
      `/api/v2/student/diagnostics/assignments/${attributed.body.data.id}/subject`,
      { assignmentId: attributed.body.data.id },
    );
    expect(anon.status).toBe(401);
  });

  test('a real PDF deposit is recorded as version 1, confirmation is persisted, and it is retrievable by staff follow-up', async () => {
    const { student, eleveUser } = await seedStudentWithAccount('G');
    allowDemoFixtureFor(student.id);
    const instrument = await seedInstrument('DEPOSIT-HTTP-1');
    signInAs({ id: h.assistante.userId, role: 'ASSISTANTE' });
    const attributed = await postJson(
      studentDiagnosticsRoute.POST,
      `/api/v2/staff/students/${student.id}/diagnostics`,
      { instrumentRefId: instrument.id },
      { id: student.id },
    );
    const assignmentId = attributed.body.data.id;

    signInAs({ id: eleveUser.id, role: 'ELEVE' });
    const pdfBytes = Buffer.from('%PDF-1.0\n1 0 obj<</Type/Catalog>>endobj\ntrailer<</Root 1 0 R>>\n%%EOF\n');
    const formData = new FormData();
    formData.set('file', new File([pdfBytes], 'mes-reponses.pdf', { type: 'application/pdf' }));
    const request = new NextRequest(`http://localhost:3000/api/v2/student/diagnostics/assignments/${assignmentId}/submissions`, {
      method: 'POST',
      headers: { origin: 'http://localhost:3000' },
      body: formData,
    });
    const response = await submissionsRoute.POST(request, paramsOf({ assignmentId }));
    const body = await response.json();
    expect(response.status).toBe(201);
    expect(body.data.version).toBe(1);

    signInAs({ id: h.admin.userId, role: 'ADMIN' });
    const dossier = await getJson(studentDiagnosticsRoute.GET, `/api/v2/staff/students/${student.id}/diagnostics`, { id: student.id });
    expect(dossier.body.data[0].submissions).toHaveLength(1);
    expect(dossier.body.data[0].submissions[0].sha256).toBe(body.data.sha256);
    expect(dossier.body.data[0].status).toBe('SUBMITTED');
  });

  test('a non-PDF deposit is rejected (400 VALIDATION), no row and no file are created', async () => {
    const { student, eleveUser } = await seedStudentWithAccount('H');
    allowDemoFixtureFor(student.id);
    const instrument = await seedInstrument('DEPOSIT-REJECT-1');
    signInAs({ id: h.assistante.userId, role: 'ASSISTANTE' });
    const attributed = await postJson(
      studentDiagnosticsRoute.POST,
      `/api/v2/staff/students/${student.id}/diagnostics`,
      { instrumentRefId: instrument.id },
      { id: student.id },
    );
    const assignmentId = attributed.body.data.id;

    signInAs({ id: eleveUser.id, role: 'ELEVE' });
    const formData = new FormData();
    formData.set('file', new File([Buffer.from('not a pdf')], 'x.pdf', { type: 'application/pdf' }));
    const request = new NextRequest(`http://localhost:3000/api/v2/student/diagnostics/assignments/${assignmentId}/submissions`, {
      method: 'POST',
      headers: { origin: 'http://localhost:3000' },
      body: formData,
    });
    const response = await submissionsRoute.POST(request, paramsOf({ assignmentId }));
    expect(response.status).toBe(400);

    const rows = await h.client.diagnosticSubmission.findMany({ where: { assignmentId } });
    expect(rows).toHaveLength(0);
  });

  test('a cross-candidate deposit attempt with a MALFORMED file still gets 404, never a 400 that would leak "the assignment exists, only your file is wrong" (found via browser rehearsal, mission §4/§5)', async () => {
    const { student } = await seedStudentWithAccount('I');
    const { eleveUser: otherUser } = await seedStudentWithAccount('J');
    allowDemoFixtureFor(student.id);
    const instrument = await seedInstrument('DEPOSIT-CROSS-MALFORMED-1');
    signInAs({ id: h.assistante.userId, role: 'ASSISTANTE' });
    const attributed = await postJson(
      studentDiagnosticsRoute.POST,
      `/api/v2/staff/students/${student.id}/diagnostics`,
      { instrumentRefId: instrument.id },
      { id: student.id },
    );
    const assignmentId = attributed.body.data.id;

    signInAs({ id: otherUser.id, role: 'ELEVE' });
    const formData = new FormData();
    formData.set('file', new File([new Uint8Array([1, 2, 3])], 'x.pdf', { type: 'application/pdf' }));
    const request = new NextRequest(`http://localhost:3000/api/v2/student/diagnostics/assignments/${assignmentId}/submissions`, {
      method: 'POST',
      headers: { origin: 'http://localhost:3000' },
      body: formData,
    });
    const response = await submissionsRoute.POST(request, paramsOf({ assignmentId }));
    expect(response.status).toBe(404);

    const rows = await h.client.diagnosticSubmission.findMany({ where: { assignmentId } });
    expect(rows).toHaveLength(0);
  });
});
