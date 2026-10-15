/** @jest-environment node */
import { randomBytes } from 'node:crypto';
import { Pool } from 'pg';
import { NextRequest } from 'next/server';
import { NextResponse } from 'next/server';
jest.mock('@/auth', () => ({ auth: jest.fn() }));
jest.mock('@/lib/aria/gateway', () => ({ streamChatCompletion: jest.fn() }));
jest.mock('@/lib/aria/infrastructure/prisma/learning-evidence-repository', () => {
  const real = jest.requireActual('@/lib/aria/infrastructure/prisma/learning-evidence-repository');
  return { ...real, makePrismaLearningEvidenceRepository: jest.fn(real.makePrismaLearningEvidenceRepository) };
});
jest.mock('@/lib/auth/v1-session-authority', () => {
  const real = jest.requireActual('@/lib/auth/v1-session-authority');
  return { ...real, withV1SessionAuthority: jest.fn(real.withV1SessionAuthority) };
});
import { auth } from '@/auth';
import { prisma } from '@/lib/prisma';
import { ariaHttpCookie } from '../core-v2/helpers/aria-http-cookie';
import { seedAriaRealDbFixture, cleanupAriaRealDbFixture, type AriaRealDbFixtureIds } from '../helpers/aria-real-db';
import { authorAriaActivity } from '@/lib/aria/application/practice/author';
import { startAriaPracticeAttempt } from '@/lib/aria/application/practice/start-attempt';
import { submitAriaPracticeAttempt } from '@/lib/aria/application/practice/submit-attempt';
import { streamChatCompletion } from '@/lib/aria/gateway';
import * as evidenceRepositories from '@/lib/aria/infrastructure/prisma/learning-evidence-repository';
import { AriaAuthorityUnavailableError } from '@/lib/aria/kernel/errors';
import { withV1SessionAuthority } from '@/lib/auth/v1-session-authority';
import { delayFinalV1Verification } from '../helpers/delay-v1-final-authority';
import { DEFAULT_ARIA_LEARNING_PREFERENCES_V1 } from '@/lib/aria/domain/profile/preferences';
import { POST as startRoute } from '@/app/api/aria/practice/attempts/route';
import { POST as submitRoute } from '@/app/api/aria/practice/attempts/[attemptId]/submit/route';
import { PUT as profileRoute } from '@/app/api/aria/profile/route';
import { POST as feedbackRoute } from '@/app/api/aria/feedback/route';
import { POST as correctRoute } from '@/app/api/aria/practice/attempts/[attemptId]/correct/route';
process.env.NEXTAUTH_URL = 'http://localhost:3000';
process.env.AUTH_SECRET ??= randomBytes(32).toString('base64url');
const courseKey = 'eds-maths-premiere';
const snapshotSql = `SELECT table_name, (xpath('/row/fingerprint/text()', query_to_xml(format('SELECT md5(coalesce(string_agg(row_to_json(t)::text, %L ORDER BY row_to_json(t)::text), %L)) AS fingerprint FROM %I t', '', '', table_name), false, true, '')))[1]::text AS fingerprint FROM information_schema.tables WHERE table_schema = 'public' AND table_type = 'BASE TABLE' ORDER BY table_name`;
type Operation = 'start' | 'submit' | 'profile' | 'feedback';
describe('original V1 request authority, including V1-only pupils without Core membership', () => {
  let pool: Pool; let child: AriaRealDbFixtureIds; let activityId: string; let attemptId: string; let messageId: string;
  beforeAll(() => { pool = new Pool({ connectionString: process.env.TEST_DATABASE_URL ?? process.env.DATABASE_URL }); });
  beforeEach(async () => {
    jest.mocked(streamChatCompletion).mockReset();
    child = await seedAriaRealDbFixture(pool, courseKey);
    await prisma.user.update({ where: { id: child.studentUser }, data: { activatedAt: new Date() } });
    const activity = await authorAriaActivity({ courseKey, skillId: null, curriculumVersion: '2026-v1', activityType: 'MCQ', versionLabel: 'v1',
      prompt: { questionText: 'Synthetic question', options: [{ id: 'a', label: 'A' }, { id: 'b', label: 'B' }] },
      expectedAnswerShape: { field: 'selectedOptionId', type: 'string' }, correctionRubric: { correctOptionId: 'a' } });
    activityId = activity.id;
    const conversation = await prisma.ariaConversation.create({ data: { studentId: child.student, courseKey, contextState: 'ACTIVE' } });
    const message = await prisma.ariaMessage.create({ data: { conversationId: conversation.id, role: 'assistant', status: 'COMPLETED', content: 'Synthetic terminal answer' } });
    messageId = message.id;
    jest.mocked(auth).mockResolvedValue({ user: { id: child.studentUser, role: 'ELEVE', email: `student-${child.studentUser}@invalid.test`, authority: 'V1' },
      expires: '2099-01-01' } as Awaited<ReturnType<typeof auth>>);
  });
  afterEach(async () => {
    await cleanupAriaRealDbFixture(pool, child);
    await prisma.activity.delete({ where: { id: activityId } });
  });
  afterAll(async () => { await pool.end(); });
  async function prepare(operation: Operation) {
    if (operation === 'submit') attemptId = (await startAriaPracticeAttempt({ actor: { userId: child.studentUser, role: 'ELEVE' }, activityId })).id;
    const body = operation === 'start' ? { activityId } : operation === 'submit' ? { payload: { selectedOptionId: 'a' } }
      : operation === 'profile' ? DEFAULT_ARIA_LEARNING_PREFERENCES_V1 : { messageId, useful: true };
    return { cookie: await ariaHttpCookie(child.studentUser), body };
  }
  function call(operation: Operation, request: NextRequest) {
    if (operation === 'start') return startRoute(request);
    if (operation === 'submit') return submitRoute(request, { params: Promise.resolve({ attemptId }) });
    if (operation === 'profile') return profileRoute(request);
    return feedbackRoute(request);
  }
  test.each(['start', 'submit', 'profile', 'feedback'] as const)('%s persists valid V1 work without depending on Core', async operation => {
    const a = await prepare(operation);
    const response = await call(operation, new NextRequest('http://localhost:3000/api/aria/synthetic', {
      method: operation === 'profile' ? 'PUT' : 'POST', headers: a.cookie, body: JSON.stringify(a.body) }));
    expect(response.status).toBe(200);
  });
  describe.each(['start', 'submit', 'profile', 'feedback'] as const)('%s', operation => {
    test.each(['revoke', 'role', 'suspend', 'pin'] as const)('refuses %s committed while the request body is incomplete and preserves the complete database', async change => {
      const a = await prepare(operation);
      let controller!: ReadableStreamDefaultController<Uint8Array>; let started!: () => void;
      const reading = new Promise<void>(resolve => { started = resolve; });
      const bytes = new TextEncoder().encode(JSON.stringify(a.body));
      const stream = new ReadableStream<Uint8Array>({ start(value) { controller = value; },
        pull() { started(); } }, { highWaterMark: 0 });
      const request = new NextRequest('http://localhost:3000/api/aria/synthetic', { method: operation === 'profile' ? 'PUT' : 'POST',
        headers: a.cookie, body: stream, duplex: 'half' } as ConstructorParameters<typeof NextRequest>[1]);
      const pending = call(operation, request);
      await reading;
      await prisma.user.update({ where: { id: child.studentUser }, data: change === 'revoke' ? { sessionVersion: { increment: 1 } }
        : change === 'role' ? { role: 'PARENT' } : change === 'suspend' ? { disabledAt: new Date() } : { pinHash: 'synthetic-replaced-code' } });
      const before = await prisma.$queryRawUnsafe(snapshotSql);
      controller.enqueue(bytes); controller.close();
      const response = await pending;
      expect(response.status).toBe(403);
      expect(await prisma.$queryRawUnsafe(snapshotSql)).toEqual(before);
    });
    test('refuses a missing original cookie before any write', async () => {
      const a = await prepare(operation); const before = await prisma.$queryRawUnsafe(snapshotSql);
      expect((await call(operation, new NextRequest('http://localhost:3000/api/aria/synthetic', {
        method: operation === 'profile' ? 'PUT' : 'POST', body: JSON.stringify(a.body) }))).status).toBe(403);
      expect(await prisma.$queryRawUnsafe(snapshotSql)).toEqual(before);
    });
  });
  async function prepareCorrection() {
    const a = await prepare('submit');
    await submitAriaPracticeAttempt({ actor: { userId: child.studentUser, role: 'ELEVE' }, attemptId, payload: { selectedOptionId: 'a' } });
    return new NextRequest('http://localhost:3000/api/aria/practice/attempts/correct', { method: 'POST', headers: a.cookie });
  }
  const feedback = { outcome: 'CORRECT', summary: 'Synthetic valid feedback', strengths: ['Synthetic'], improvements: [] };
  test.each(['revoke', 'suspend', 'curriculum', 'entitlement'] as const)('correction refuses %s committed during the model and writes neither result nor evidence', async change => {
    const request = await prepareCorrection();
    let release!: () => void; let started!: () => void;
    const gate = new Promise<void>(resolve => { release = resolve; });
    const modelStarted = new Promise<void>(resolve => { started = resolve; });
    jest.mocked(streamChatCompletion).mockImplementation(() => (async function* () { started(); await gate; yield JSON.stringify(feedback); })());
    const pending = correctRoute(request, { params: Promise.resolve({ attemptId }) });
    try {
      await modelStarted;
      if (change === 'revoke') await prisma.user.update({ where: { id: child.studentUser }, data: { sessionVersion: { increment: 1 } } });
      if (change === 'suspend') await prisma.user.update({ where: { id: child.studentUser }, data: { disabledAt: new Date() } });
      if (change === 'curriculum') await prisma.studentAcademicEnrollment.deleteMany({ where: { studentId: child.student } });
      if (change === 'entitlement') await prisma.entitlement.update({ where: { id: child.entitlement }, data: { status: 'REVOKED' } });
      const before = await prisma.$queryRawUnsafe(snapshotSql); release();
      expect((await pending).status).toBe(403);
      expect(await prisma.$queryRawUnsafe(snapshotSql)).toEqual(before);
      expect(await prisma.activityResult.count({ where: { attemptId } })).toBe(0);
      expect(await prisma.learningEvidence.count({ where: { sourceRefId: attemptId } })).toBe(0);
    } finally { release(); await pending; }
  });
  test('a silent model receives an actual abort when the original session is revoked', async () => {
    const request = await prepareCorrection();
    let started!: () => void; let stopped!: () => void; let finish!: () => void;
    const began = new Promise<void>(resolve => { started = resolve; });
    const aborted = new Promise<void>(resolve => { stopped = resolve; });
    const gate = new Promise<void>(resolve => { finish = resolve; });
    jest.mocked(streamChatCompletion).mockImplementation((_messages, options) => (async function* () {
      options?.signal?.addEventListener('abort', () => { stopped(); finish(); }, { once: true });
      started(); await gate;
    })());
    const pending = correctRoute(request, { params: Promise.resolve({ attemptId }) });
    let timeout: ReturnType<typeof setTimeout> | undefined;
    try {
      await began;
      await prisma.user.update({ where: { id: child.studentUser }, data: { sessionVersion: { increment: 1 } } });
      await Promise.race([aborted, new Promise<never>((_resolve, reject) => {
        timeout = setTimeout(() => reject(new Error('SYNTHETIC_MODEL_NOT_ABORTED')), 2500);
      })]);
      expect((await pending).status).toBe(403);
      expect(await prisma.activityResult.count({ where: { attemptId } })).toBe(0);
    } finally { if (timeout) clearTimeout(timeout); finish(); await pending; }
  });
  test('revocation before a malformed response retry prevents the second model call', async () => {
    const request = await prepareCorrection();
    jest.mocked(streamChatCompletion).mockImplementation(() => (async function* () {
      yield 'synthetic malformed correction';
      await prisma.user.update({ where: { id: child.studentUser }, data: { sessionVersion: { increment: 1 } } });
    })());
    expect((await correctRoute(request, { params: Promise.resolve({ attemptId }) })).status).toBe(403);
    expect(streamChatCompletion).toHaveBeenCalledTimes(1);
    expect(await prisma.activityResult.count({ where: { attemptId } })).toBe(0);
  });
  test('failure to persist the evidence rolls back the result and leaves the attempt submitted', async () => {
    const request = await prepareCorrection();
    jest.mocked(streamChatCompletion).mockImplementation(() => (async function* () { yield JSON.stringify(feedback); })());
    const real = jest.requireActual<typeof evidenceRepositories>('@/lib/aria/infrastructure/prisma/learning-evidence-repository').makePrismaLearningEvidenceRepository;
    const failing = jest.mocked(evidenceRepositories.makePrismaLearningEvidenceRepository).mockImplementation(client => {
      const repository = real(client);
      return { resolveStudentIdByUserId: repository.resolveStudentIdByUserId.bind(repository),
        listForStudent: repository.listForStudent.bind(repository), create: async () => { throw new AriaAuthorityUnavailableError(); } };
    });
    try {
      expect((await correctRoute(request, { params: Promise.resolve({ attemptId }) })).status).toBe(503);
      expect(await prisma.activityResult.count({ where: { attemptId } })).toBe(0);
      expect(await prisma.learningEvidence.count({ where: { sourceRefId: attemptId } })).toBe(0);
      expect((await prisma.activityAttempt.findUniqueOrThrow({ where: { id: attemptId } })).status).toBe('SUBMITTED');
    } finally { failing.mockImplementation(real); }
  });
  test('two concurrent HTTP corrections write one result and one evidence, and replay returns that same result', async () => {
    const firstRequest = await prepareCorrection();
    const secondRequest = new NextRequest(firstRequest.url, { method: 'POST', headers: firstRequest.headers });
    let release!: () => void; let bothStarted!: () => void; let starts = 0;
    const gate = new Promise<void>(resolve => { release = resolve; });
    const began = new Promise<void>(resolve => { bothStarted = resolve; });
    jest.mocked(streamChatCompletion).mockImplementation(() => (async function* () {
      starts++; if (starts === 2) bothStarted(); await gate; yield JSON.stringify(feedback);
    })());
    const pending = [correctRoute(firstRequest, { params: Promise.resolve({ attemptId }) }),
      correctRoute(secondRequest, { params: Promise.resolve({ attemptId }) })];
    try {
      await began; release();
      const responses = await Promise.all(pending); expect(responses.map(response => response.status)).toEqual([200, 200]);
      const bodies = await Promise.all(responses.map(response => response.json()));
      expect(bodies[0].result.id).toBe(bodies[1].result.id);
      expect(bodies.map(body => body.alreadyCorrected).sort()).toEqual([false, true]);
      expect(responses[0].headers.get('cache-control')).toBe('private, no-store');
      expect(await prisma.activityResult.count({ where: { attemptId } })).toBe(1);
      expect(await prisma.learningEvidence.count({ where: { sourceRefId: attemptId } })).toBe(1);
      const replay = await correctRoute(new NextRequest(firstRequest.url, { method: 'POST', headers: firstRequest.headers }),
        { params: Promise.resolve({ attemptId }) });
      expect(replay.status).toBe(200); expect(await replay.json()).toMatchObject({ alreadyCorrected: true, result: { id: bodies[0].result.id } });
      expect(streamChatCompletion).toHaveBeenCalledTimes(2);
    } finally { release(); await Promise.allSettled(pending); }
  });
  test('a correction never adds a new authorization refusal after its authorized atomic commit', async () => {
    const request = await prepareCorrection(); let revoked = false;
    jest.mocked(streamChatCompletion).mockImplementation(() => (async function* () { yield JSON.stringify(feedback); })());
    const real = jest.requireActual<typeof import('@/lib/auth/v1-session-authority')>('@/lib/auth/v1-session-authority');
    jest.mocked(withV1SessionAuthority).mockImplementation(async (claims, operation, publish) => {
      if (!revoked && await prisma.activityResult.count({ where: { attemptId } }) === 1) {
        revoked = true;
        await prisma.user.update({ where: { id: child.studentUser }, data: { sessionVersion: { increment: 1 } } });
      }
      return real.withV1SessionAuthority(claims, operation, publish);
    });
    try {
      expect((await correctRoute(request, { params: Promise.resolve({ attemptId }) })).status).toBe(200);
      expect(await prisma.activityResult.count({ where: { attemptId } })).toBe(1);
      expect(await prisma.learningEvidence.count({ where: { sourceRefId: attemptId } })).toBe(1);
    } finally { jest.mocked(withV1SessionAuthority).mockImplementation(real.withV1SessionAuthority); }
  });
  test('commercial expiry during the final identity read rolls back a newly started attempt', async () => {
    const a = await prepare('start'); const expires = new Date(Date.now() + 1000);
    await prisma.entitlement.update({ where: { id: child.entitlement }, data: { endsAt: expires } });
    const delayed = delayFinalV1Verification(prisma, expires, async tx => (await tx.activityAttempt.count({ where: { studentId: child.student } })) === 1);
    try {
      const response = await call('start', new NextRequest('http://localhost:3000/api/aria/practice/attempts', {
        method: 'POST', headers: a.cookie, body: JSON.stringify(a.body) }));
      expect(response.status).toBe(403); expect(delayed.didWait()).toBe(true);
      expect(await prisma.activityAttempt.count({ where: { studentId: child.student } })).toBe(0);
    } finally { delayed.restore(); }
  });
  test('commercial expiry during the final correction identity read rolls back result and evidence', async () => {
    const request = await prepareCorrection(); const expires = new Date(Date.now() + 1000);
    await prisma.entitlement.update({ where: { id: child.entitlement }, data: { endsAt: expires } });
    jest.mocked(streamChatCompletion).mockImplementation(() => (async function* () { yield JSON.stringify(feedback); })());
    const delayed = delayFinalV1Verification(prisma, expires, async tx => (await tx.activityResult.count({ where: { attemptId } })) === 1);
    try {
      expect((await correctRoute(request, { params: Promise.resolve({ attemptId }) })).status).toBe(403);
      expect(delayed.didWait()).toBe(true);
      expect(await prisma.activityResult.count({ where: { attemptId } })).toBe(0);
      expect(await prisma.learningEvidence.count({ where: { sourceRefId: attemptId } })).toBe(0);
      expect((await prisma.activityAttempt.findUniqueOrThrow({ where: { id: attemptId } })).status).toBe('SUBMITTED');
    } finally { delayed.restore(); }
  });
  test('failure to project a correction response rolls back its result and evidence', async () => {
    const request = await prepareCorrection();
    jest.mocked(streamChatCompletion).mockImplementation(() => (async function* () { yield JSON.stringify(feedback); })());
    const json = jest.spyOn(NextResponse, 'json').mockImplementationOnce(() => { throw new Error('SYNTHETIC_PUBLIC_PROJECTION_FAILURE'); });
    try {
      expect((await correctRoute(request, { params: Promise.resolve({ attemptId }) })).status).toBe(500);
      expect(await prisma.activityResult.count({ where: { attemptId } })).toBe(0);
      expect(await prisma.learningEvidence.count({ where: { sourceRefId: attemptId } })).toBe(0);
      expect((await prisma.activityAttempt.findUniqueOrThrow({ where: { id: attemptId } })).status).toBe('SUBMITTED');
    } finally { json.mockRestore(); }
  });
  test('feedback never adds a new authorization refusal after its authorized primary commit', async () => {
    const a = await prepare('feedback'); let revoked = false;
    const real = jest.requireActual<typeof import('@/lib/auth/v1-session-authority')>('@/lib/auth/v1-session-authority');
    jest.mocked(withV1SessionAuthority).mockImplementation(async (claims, operation, publish) => {
      if (!revoked && await prisma.ariaFeedback.count({ where: { messageId } }) === 1) {
        revoked = true; await prisma.user.update({ where: { id: child.studentUser }, data: { sessionVersion: { increment: 1 } } });
      }
      return real.withV1SessionAuthority(claims, operation, publish);
    });
    try {
      const response = await call('feedback', new NextRequest('http://localhost:3000/api/aria/feedback', {
        method: 'POST', headers: a.cookie, body: JSON.stringify(a.body) }));
      expect(response.status).toBe(200); expect(await prisma.ariaFeedback.count({ where: { messageId } })).toBe(1);
    } finally { jest.mocked(withV1SessionAuthority).mockImplementation(real.withV1SessionAuthority); }
  });
});
