import { randomUUID } from 'node:crypto';
import { prisma } from '@/lib/prisma';
import { authorizeCoreV2AriaConversation, withCoreV2AriaActor } from '@/lib/core-v2/aria/conversation-authority';
import { CoreV2AriaConversationRepository } from '@/lib/core-v2/aria/conversation-repository';
import { loadCoreV2AriaStudentContext } from '@/lib/core-v2/aria/student-context';
import { setupV1Fixture } from '../helpers/v1-provisioning-fixture';
import { seedAcademicYear, waitForLockWaiter } from '../helpers/service-harness';

const f = setupV1Fixture();
async function prepare() {
  const v1 = await f.v1User('ELEVE', 'aria-live-authority', 'ACTIVE');
  const user = await f.h.client.user.create({ data: { id: v1.id, email: v1.email, role: 'ELEVE', accountStatus: 'ACTIVE' } });
  const household = await f.h.client.household.create({ data: {} });
  const student = await f.h.client.student.create({ data: { userId: user.id, householdId: household.id } });
  const year = await seedAcademicYear(f.h.client, 2026);
  const enrollment = await f.h.client.studentAcademicYearEnrollment.create({ data: {
    studentId: student.id, academicYearId: year.id, status: 'ACTIVE', gradeLevel: 'TERMINALE', academicTrack: 'EDS_GENERALE',
  } });
  const grant = await f.h.client.ariaAccessGrant.create({ data: {
    studentId: student.id, featureKey: 'aria_maths', courseScopes: ['philosophie-terminale'], ariaTier: 'ARIA_AUTONOMIE',
  } });
  const row = await prisma.user.findUniqueOrThrow({ where: { id: user.id }, select: { sessionVersion: true } });
  const claims = { userId: user.id, role: 'ELEVE' as const, sessionVersion: row.sessionVersion, expiresAt: Date.now() + 60_000 };
  const ctx = f.h.ctx({ userId: user.id, role: 'ELEVE' });
  const bound = await authorizeCoreV2AriaConversation(f.h.client, claims, ctx, { courseKey: 'philosophie-terminale' });
  const input = { actorUserId: user.id, subjectStudentId: student.id, clientRequestId: randomUUID(),
    requestFingerprint: 'c'.repeat(64), courseKey: 'philosophie-terminale', message: 'synthetic question',
    academicSnapshot: {}, pedagogicalMode: 'DISCOVERY', agentRole: 'TUTOR', modelPolicy: { policyId: 'test' },
    now: new Date(), pendingRecoveryAt: new Date(Date.now() + 60_000) };
  return { ...bound, claims, ctx, input, user, student, year, enrollment, grant };
}
test.each(['reset', 'disabled', 'merged', 'role', 'pin'] as const)('does not adopt changed V1 authority before reservation: %s', async kind => {
  const a = await prepare();
  await prisma.user.update({ where: { id: a.user.id }, data: kind === 'reset' ? { sessionVersion: { increment: 1 } }
    : kind === 'pin' ? { pinHash: 'synthetic-reset-pin-hash' } : kind === 'disabled' ? { disabledAt: new Date() } : kind === 'merged' ? { mergedIntoUserId: f.h.admin.userId } : { role: 'PARENT' } });
  await expect(a.repository.reserveTurn(a.input)).rejects.toThrow('ARIA_AUTHORITY_REVOKED');
  expect(await f.h.client.ariaConversationTurnCoreV2.count()).toBe(0);
  expect(await f.h.client.ariaMessageCoreV2.count()).toBe(0);
  expect(await f.h.client.coreV2JobOutbox.count()).toBe(0);
});
test.each(['core', 'grant', 'expiry', 'year', 'withdrawn', 'owner', 'aba'] as const)('refuses current Core authority changes without reservation: %s', async kind => {
  const a = await prepare();
  if (kind === 'core') await f.h.client.user.update({ where: { id: a.user.id }, data: { accountStatus: 'DISABLED' } });
  if (kind === 'grant') await f.h.client.ariaAccessGrant.update({ where: { id: a.grant.id }, data: { status: 'REVOKED' } });
  if (kind === 'expiry') await f.h.client.ariaAccessGrant.update({ where: { id: a.grant.id }, data: { endsAt: new Date(Date.now() - 1) } });
  if (kind === 'year') await f.h.client.academicYear.update({ where: { id: a.year.id }, data: { status: 'CLOSED' } });
  if (kind === 'withdrawn') await f.h.client.studentAcademicYearEnrollment.update({ where: { id: a.enrollment.id }, data: { status: 'WITHDRAWN' } });
  if (kind === 'owner') await f.h.client.student.update({ where: { id: a.student.id }, data: { userId: f.h.parentActor.userId } });
  if (kind === 'aba') { await f.h.client.ariaAccessGrant.update({ where: { id: a.grant.id }, data: { status: 'REVOKED' } }); await f.h.client.ariaAccessGrant.update({ where: { id: a.grant.id }, data: { status: 'ACTIVE' } }); }
  await expect(a.repository.reserveTurn(a.input)).rejects.toThrow('ARIA_AUTHORITY_REVOKED');
  expect(await f.h.client.ariaConversationTurnCoreV2.count()).toBe(0);
});
test('active personal-code V1 identity keeps its canonical ARIA authorization', async () => {
  const a = await prepare();
  await prisma.user.update({ where: { id: a.user.id }, data: { activatedAt: null, password: null, pinHash: 'synthetic-pin-hash' } });
  const row = await prisma.user.findUniqueOrThrow({ where: { id: a.user.id }, select: { sessionVersion: true } });
  const rebound = await authorizeCoreV2AriaConversation(f.h.client, { ...a.claims, sessionVersion: row.sessionVersion }, a.ctx, { courseKey: 'philosophie-terminale' });
  expect((await rebound.repository.reserveTurn(a.input)).disposition).toBe('RESERVED');
});
test('emission holds both authority locks and refuses later delivery after a revocation', async () => {
  const a = await prepare(); let ready!: () => void; let release!: () => void;
  const started = new Promise<void>(r => { ready = r; }); const gate = new Promise<void>(r => { release = r; });
  let emitted = 0; let suspended = false;
  const delivery = a.repository.withAuthority!(async () => { ready(); await gate; emitted += 1; }); await started;
  const revoke = Promise.resolve(prisma.user.update({ where: { id: a.user.id }, data: { disabledAt: new Date() } })).then(() => { suspended = true; });
  try { await waitForLockWaiter(prisma as never); expect(suspended).toBe(false); release(); await delivery; await revoke;
    await expect(a.repository.withAuthority!(async () => { emitted += 1; })).rejects.toThrow('ARIA_AUTHORITY_REVOKED'); expect(emitted).toBe(1);
  } finally { release(); await Promise.allSettled([delivery, revoke]); }
});
test('revoked running turn is retired once with no generated text, citations or live watchdog', async () => {
  const a = await prepare(); const turn = await a.repository.reserveTurn(a.input);
  await a.repository.claimTurn({ ...turn, actorUserId: a.user.id, subjectStudentId: a.student.id,
    executionToken: 'synthetic-execution-fence', now: new Date(), leaseExpiresAt: new Date(Date.now() + 60_000) });
  await prisma.user.update({ where: { id: a.user.id }, data: { disabledAt: new Date() } });
  await expect(a.repository.heartbeatTurn({ ...turn, executionToken: 'synthetic-execution-fence', now: new Date(), leaseExpiresAt: new Date(Date.now() + 60_000) })).rejects.toThrow('ARIA_AUTHORITY_REVOKED');
  const retirement = { ...turn, executionToken: 'synthetic-execution-fence' };
  await expect(a.repository.retireRevokedTurn!(retirement)).resolves.toBe(true);
  await expect(a.repository.retireRevokedTurn!(retirement)).resolves.toBe(false);
  expect(await f.h.client.ariaConversationTurnCoreV2.findUniqueOrThrow({ where: { id: turn.turnId } })).toMatchObject({ status: 'ERROR', leaseExpiresAt: null, executionMetadata: { failureCode: 'NOT_ENTITLED', reasonCode: 'ARIA_AUTHORITY_REVOKED' } });
  expect(await f.h.client.ariaMessageCoreV2.findUniqueOrThrow({ where: { id: turn.assistantMessageId } })).toMatchObject({ content: '' });
  expect(await f.h.client.ariaMessageCitationCoreV2.count()).toBe(0);
  expect(await f.h.client.coreV2JobOutbox.findFirstOrThrow()).toMatchObject({ status: 'COMPLETED', leaseExpiresAt: null });
});
test('a forged execution token cannot retire another running turn', async () => {
  const a = await prepare(); const turn = await a.repository.reserveTurn(a.input);
  await a.repository.claimTurn({ ...turn, actorUserId: a.user.id, subjectStudentId: a.student.id,
    executionToken: 'real-fence', now: new Date(), leaseExpiresAt: new Date(Date.now() + 60_000) });
  await prisma.user.update({ where: { id: a.user.id }, data: { disabledAt: new Date() } });
  await expect(a.repository.withAuthority!(() => undefined)).rejects.toThrow('ARIA_AUTHORITY_REVOKED');
  await expect(a.repository.retireRevokedTurn!({ ...turn, executionToken: 'forged-fence' })).resolves.toBe(false);
  expect(await f.h.client.ariaConversationTurnCoreV2.findUniqueOrThrow({ where: { id: turn.turnId } })).toMatchObject({ status: 'RUNNING' });
});

test.each(['PENDING', 'LEASED', 'RETRY_SCHEDULED'] as const)('retirement atomically closes a %s watchdog and never preserves a generated payload', async status => {
  const a = await prepare(); const turn = await a.repository.reserveTurn(a.input);
  await a.repository.claimTurn({ ...turn, actorUserId: a.user.id, subjectStudentId: a.student.id,
    executionToken: 'exact-cleanup-fence', now: new Date(), leaseExpiresAt: new Date(Date.now() + 60_000) });
  await f.h.client.coreV2JobOutbox.updateMany({ where: { aggregateId: turn.turnId }, data: {
    status, leaseOwner: status === 'LEASED' ? 'synthetic-watchdog-owner' : null,
    leaseExpiresAt: status === 'LEASED' ? new Date(Date.now() + 60_000) : null,
  } });
  await f.h.client.user.update({ where: { id: a.user.id }, data: { accountStatus: 'DISABLED' } });
  await expect(a.repository.withAuthority!(() => undefined)).rejects.toThrow('ARIA_AUTHORITY_REVOKED');
  expect(await a.repository.retireRevokedTurn!({ ...turn, executionToken: 'exact-cleanup-fence' })).toBe(true);
  expect(await f.h.client.coreV2JobOutbox.findFirstOrThrow()).toMatchObject({ status: 'COMPLETED', leaseOwner: null, leaseExpiresAt: null });
});
test('an exact unclaimed PENDING reservation can be retired, while another execution and a terminal remain immutable', async () => {
  const a = await prepare(); const turn = await a.repository.reserveTurn(a.input);
  await prisma.user.update({ where: { id: a.user.id }, data: { sessionVersion: { increment: 1 } } });
  await expect(a.repository.claimTurn({ ...turn, actorUserId: a.user.id, subjectStudentId: a.student.id,
    executionToken: 'never-issued-fence', now: new Date(), leaseExpiresAt: new Date(Date.now() + 60_000) })).rejects.toThrow('ARIA_AUTHORITY_REVOKED');
  expect(await a.repository.retireRevokedTurn!({ ...turn, executionToken: 'never-issued-fence' })).toBe(false);
  expect(await a.repository.retireRevokedTurn!({ ...turn, executionToken: null })).toBe(true);
  const before = await f.h.client.ariaConversationTurnCoreV2.findUniqueOrThrow({ where: { id: turn.turnId } });
  expect(await a.repository.retireRevokedTurn!({ ...turn, executionToken: null })).toBe(false);
  expect(await f.h.client.ariaConversationTurnCoreV2.findUniqueOrThrow({ where: { id: turn.turnId } })).toEqual(before);
});
test('an absent watchdog rolls retirement back without any terminal or message mutation', async () => {
  const a = await prepare(); const turn = await a.repository.reserveTurn(a.input);
  await f.h.client.coreV2JobOutbox.deleteMany({ where: { aggregateId: turn.turnId } });
  await prisma.user.update({ where: { id: a.user.id }, data: { disabledAt: new Date() } });
  await expect(a.repository.withAuthority!(() => undefined)).rejects.toThrow('ARIA_AUTHORITY_REVOKED');
  const before = await f.h.client.ariaConversationTurnCoreV2.findUniqueOrThrow({ where: { id: turn.turnId } });
  const messages = await f.h.client.ariaMessageCoreV2.findMany();
  await expect(a.repository.retireRevokedTurn!({ ...turn, executionToken: null })).rejects.toThrow('ARIA_AUTHORITY_UNAVAILABLE');
  expect(await f.h.client.ariaConversationTurnCoreV2.findUniqueOrThrow({ where: { id: turn.turnId } })).toEqual(before);
  expect(await f.h.client.ariaMessageCoreV2.findMany()).toEqual(messages);
});
test('owned preferences and stop-only operations require no remaining CHAT grant', async () => {
  const a = await prepare(); await f.h.client.ariaAccessGrant.deleteMany();
  await withCoreV2AriaActor(f.h.client, a.claims, a.ctx, async (tx, ctx) => {
    const student = await loadCoreV2AriaStudentContext(tx, ctx);
    await tx.ariaCockpitProfileCoreV2.create({ data: { studentId: student.studentId } });
  });
  expect(await f.h.client.ariaCockpitProfileCoreV2.count()).toBe(1);
});
test.each(['core', 'v1', 'role', 'owner'] as const)('a lost %s authority makes an owned-profile mutation write nothing', async loss => {
  const a = await prepare();
  if (loss === 'core') await f.h.client.user.update({ where: { id: a.user.id }, data: { accountStatus: 'DISABLED' } });
  if (loss === 'v1') await prisma.user.update({ where: { id: a.user.id }, data: { sessionVersion: { increment: 1 } } });
  if (loss === 'role') await f.h.client.user.update({ where: { id: a.user.id }, data: { role: 'COACH' } });
  if (loss === 'owner') await f.h.client.student.update({ where: { id: a.student.id }, data: { userId: f.h.parentActor.userId } });
  await expect(withCoreV2AriaActor(f.h.client, a.claims, a.ctx, async (tx, ctx) => {
    const student = await loadCoreV2AriaStudentContext(tx, ctx);
    await tx.ariaCockpitProfileCoreV2.create({ data: { studentId: student.studentId } });
  })).rejects.toThrow();
  expect(await f.h.client.ariaCockpitProfileCoreV2.count()).toBe(0);
});

test('grant expiration during an atomic reservation rolls back all its writes', async () => {
  const a = await prepare(); const endsAt = new Date(Date.now() + 2_000);
  await f.h.client.ariaAccessGrant.update({ where: { id: a.grant.id }, data: { endsAt } });
  const bound = await authorizeCoreV2AriaConversation(f.h.client, a.claims, a.ctx, { courseKey: 'philosophie-terminale' });
  const original = CoreV2AriaConversationRepository.prototype.reserveTurn;
  const spy = jest.spyOn(CoreV2AriaConversationRepository.prototype, 'reserveTurn').mockImplementation(async function (this: CoreV2AriaConversationRepository, input) {
    const result = await original.call(this, input);
    await new Promise(resolve => setTimeout(resolve, Math.max(0, endsAt.getTime() - Date.now() + 10)));
    return result;
  });
  try {
    await expect(bound.repository.reserveTurn(a.input)).rejects.toThrow('ARIA_AUTHORITY_REVOKED');
    expect(await f.h.client.ariaConversationTurnCoreV2.count()).toBe(0);
    expect(await f.h.client.ariaMessageCoreV2.count()).toBe(0); expect(await f.h.client.coreV2JobOutbox.count()).toBe(0);
  } finally { spy.mockRestore(); }
});
test('the returned context uses the freshly authorized actor and clock', async () => {
  const a = await prepare(); await f.h.client.ariaAccessGrant.update({ where: { id: a.grant.id }, data: { endsAt: new Date(Date.now() + 60_000) } });
  const bound = await authorizeCoreV2AriaConversation(f.h.client, a.claims, { ...a.ctx, now: () => new Date('2099-01-01') }, { courseKey: 'philosophie-terminale' });
  expect(bound.context.subject.studentId).toBe(a.student.id);
});
