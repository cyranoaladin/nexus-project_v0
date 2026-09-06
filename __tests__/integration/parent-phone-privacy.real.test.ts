jest.unmock('@/lib/prisma');
import { randomBytes, randomUUID } from 'node:crypto';
import type { Prisma } from '@prisma/client';
import { prisma } from '@/lib/prisma';
import { issueParentPhoneChallenge, verifyParentPhoneChallenge } from '@/lib/auth/parent-phone';
import { emailTrustSelect, hasTrustedAccountEmail } from '@/lib/auth/email-trust';
import { enqueueParentWhatsAppInvitation, decryptWhatsAppInvitation } from '@/lib/whatsapp/invitation-outbox';
import { executeAnonymisation, type AnonymisationClient } from '@/lib/rgpd/anonymisation-executor';
import { buildProposal, TOMBSTONE } from '@/lib/rgpd/anonymisation';
import { assertDisposablePostgresUrl } from '@/__tests__/helpers/disposable-postgres';
const PREFIX = 'privacy-phone-' + randomUUID() + '-';
const savedKey = process.env.WHATSAPP_OUTBOX_ENCRYPTION_KEY;
let disposable = false;
let counter = 0;
function generateRuntimePassword() { return randomBytes(32).toString('hex'); }
async function fixture() {
  const user = await prisma.user.create({ data: { id: PREFIX + randomUUID(), role: 'PARENT', activatedAt: null,
    email: PREFIX + randomUUID() + '@example.test', phone: '29 98 76 50', phoneNormalized: String(29987650 + counter++), firstName: 'Synthetic', lastName: 'Parent' } });
  const invitation = await prisma.$transaction(async tx => {
    const challenge = await issueParentPhoneChallenge(tx, { userId: user.id, purpose: 'ACTIVATION' });
    const job = await enqueueParentWhatsAppInvitation(tx, { userId: user.id, ...challenge });
    return { ...challenge, jobId: job.id };
  });
  return { user, invitation };
}
function client(): { adapter: AnonymisationClient; journal: jest.Mock } {
  const journal = jest.fn().mockResolvedValue(undefined);
  return { journal, adapter: { phonePrivacyDatabase: prisma,
    updateRow: async ({ table, rowId, values }) => {
      if (table !== 'users') throw new Error('Unexpected fixture carrier');
      await prisma.user.update({ where: { id: rowId }, data: values as Prisma.UserUpdateInput });
    }, deleteFile: jest.fn(), recordJournalEntry: journal } };
}
const proposal = (userId: string) => buildProposal({ subjectRef: 'synthetic-subject', rows: [{ table: 'users', rowId: userId, kind: 'FOREIGN_KEY', heuristic: false }], files: [] });
async function cleanup() {
  await prisma.jobOutbox.deleteMany({ where: { aggregateId: { startsWith: PREFIX } } });
  await prisma.parentPhoneChallenge.deleteMany({ where: { userId: { startsWith: PREFIX } } });
  await prisma.user.deleteMany({ where: { id: { startsWith: PREFIX } } });
}
beforeAll(() => {
  assertDisposablePostgresUrl(process.env.TEST_DATABASE_URL || process.env.DATABASE_URL || ''); disposable = true;
  process.env.WHATSAPP_OUTBOX_ENCRYPTION_KEY = generateRuntimePassword();
});
afterEach(async () => { if (disposable) await cleanup(); });
afterAll(async () => {
  if (disposable) { await cleanup(); await prisma.$disconnect(); }
  if (savedKey === undefined) delete process.env.WHATSAPP_OUTBOX_ENCRYPTION_KEY; else process.env.WHATSAPP_OUTBOX_ENCRYPTION_KEY = savedKey;
});

it('canonical user-only erasure scrubs phone and encrypted intents but preserves email-trust provenance', async () => {
  const { user, invitation } = await fixture(); const other = await fixture();
  const oldJob = await prisma.jobOutbox.findUniqueOrThrow({ where: { id: invitation.jobId } });
  const now = new Date();
  await prisma.parentPhoneChallenge.update({ where: { id: invitation.challengeId }, data: { consumedAt: now } });
  await prisma.jobOutbox.update({ where: { id: invitation.jobId }, data: { status: 'COMPLETED', completedAt: now } });
  const pending = await prisma.$transaction(async tx => {
    const challenge = await issueParentPhoneChallenge(tx, { userId: user.id, purpose: 'ACTIVATION' });
    return { ...challenge, job: await enqueueParentWhatsAppInvitation(tx, { userId: user.id, ...challenge }) };
  });
  const unrelated = await prisma.jobOutbox.create({ data: { jobType: 'SCORE_ATTEMPT', aggregateType: 'USER', aggregateId: user.id,
    sourceEventKey: randomUUID(), idempotencyKey: randomUUID(), status: 'PENDING', payload: { preserved: true } } });
  const { adapter, journal } = client();
  const outcome = await executeAnonymisation(proposal(user.id), { confirmedBy: 'synthetic-staff' }, adapter, now);
  const erased = await prisma.user.findUniqueOrThrow({ where: { id: user.id }, include: { parentPhoneChallenges: true } });
  expect(erased.phoneNormalized).toBeNull(); expect(erased.phone).toBe(TOMBSTONE); expect(erased.password).toBeNull();
  expect(erased.parentPhoneState).toBe('NONE'); expect(erased.sessionVersion).toBeGreaterThan(user.sessionVersion);
  expect(erased.parentPhoneChallenges).toHaveLength(2);
  expect(erased.parentPhoneChallenges.every(c => c.phoneNormalized === TOMBSTONE && c.revokedAt !== null)).toBe(true);
  expect(erased.parentPhoneChallenges.find(c => c.id === invitation.challengeId)?.consumedAt).toEqual(now);
  expect(hasTrustedAccountEmail(await prisma.user.findUnique({ where: { id: user.id }, select: emailTrustSelect }))).toBe(false);
  expect(await verifyParentPhoneChallenge(pending.rawToken)).toEqual({ valid: false });
  const completed = await prisma.jobOutbox.findUniqueOrThrow({ where: { id: invitation.jobId } });
  const cancelled = await prisma.jobOutbox.findUniqueOrThrow({ where: { id: pending.job.id } });
  expect(completed.status).toBe('COMPLETED'); expect(cancelled.status).toBe('CANCELLED');
  for (const job of [completed, cancelled]) {
    expect(job.payload).toEqual({ anonymised: true }); expect(job.leaseOwner).toBeNull();
    expect(() => decryptWhatsAppInvitation(job.payload)).toThrow();
  }
  expect(completed.payload).not.toEqual(oldJob.payload);
  expect((await prisma.jobOutbox.findUniqueOrThrow({ where: { id: unrelated.id } })).payload).toEqual({ preserved: true });
  expect((await prisma.user.findUniqueOrThrow({ where: { id: other.user.id } })).phoneNormalized).toBe(other.user.phoneNormalized);
  expect(outcome.tables).toEqual(['canonical_job_outbox', 'parent_phone_challenges', 'users']);
  expect(outcome.rowsAnonymised).toBe(5); expect(journal).toHaveBeenCalledTimes(1);
});

it('an active provider lease refuses erasure before changing account, challenge or outbox', async () => {
  const { user, invitation } = await fixture();
  await prisma.jobOutbox.update({ where: { id: invitation.jobId }, data: { status: 'LEASED', leaseOwner: 'synthetic-worker', leaseExpiresAt: new Date(Date.now() + 60000) } });
  const before = await prisma.user.findUniqueOrThrow({ where: { id: user.id } });
  const { adapter, journal } = client();
  await expect(executeAnonymisation(proposal(user.id), { confirmedBy: 'synthetic-staff' }, adapter)).rejects.toThrow('WHATSAPP_SEND_IN_PROGRESS');
  expect(await prisma.user.findUniqueOrThrow({ where: { id: user.id } })).toEqual(before);
  expect((await prisma.parentPhoneChallenge.findUniqueOrThrow({ where: { id: invitation.challengeId } })).phoneNormalized).toBe(user.phoneNormalized);
  expect(decryptWhatsAppInvitation((await prisma.jobOutbox.findUniqueOrThrow({ where: { id: invitation.jobId } })).payload).userId).toBe(user.id);
  expect(journal).not.toHaveBeenCalled();
});
