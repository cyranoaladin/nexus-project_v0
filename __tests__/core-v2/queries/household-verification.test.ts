import { holdOpenTransaction, setupServiceHarness, waitForLockWaiter } from '../helpers/service-harness';
import { getOwnHousehold } from '@/lib/core-v2/queries/parent';
import { getOwnStudent } from '@/lib/core-v2/queries/student';

const h = setupServiceHarness();
async function unverifiedFamily() {
  const household = await h.client.household.create({
    data: { parents: { create: { userId: h.parentActor.userId, isPrimaryContact: true } } },
  });
  const child = await h.client.user.create({ data: { role: 'ELEVE', accountStatus: 'ACTIVE' } });
  await h.client.student.create({ data: { userId: child.id, householdId: household.id } });
  return { household, child };
}

test('a membership created without an explicit verification never grants parent household access', async () => {
  await unverifiedFamily();
  expect(await getOwnHousehold(h.client, h.ctx(h.parentActor))).toBeNull();
});
test('the student projection excludes parents whose membership has not been verified', async () => {
  const { child } = await unverifiedFamily();
  const own = await getOwnStudent(h.client, h.ctx({ userId: child.id, role: 'ELEVE' }));
  expect(own?.parents).toEqual([]);
});

test('explicit staff verification grants access; revocation removes it immediately without logout', async () => {
  const { verifyHouseholdParent, revokeHouseholdParent } = await import('@/lib/core-v2/services/household-verification');
  const { household, child } = await unverifiedFamily();
  const verified = await verifyHouseholdParent(h.client, h.ctx(), {
    householdId: household.id, parentUserId: h.parentActor.userId, expectedRevision: 0, evidenceDigest: 'a'.repeat(64),
  });
  expect(verified).toMatchObject({ verificationStatus: 'VERIFIED', revision: 1, verifiedById: h.admin.userId, revokedAt: null });
  expect((await getOwnHousehold(h.client, h.ctx(h.parentActor)))?.id).toBe(household.id);
  expect((await getOwnStudent(h.client, h.ctx({ userId: child.id, role: 'ELEVE' })))?.parents).toHaveLength(1);
  const revoked = await revokeHouseholdParent(h.client, h.ctx(), {
    householdId: household.id, parentUserId: h.parentActor.userId, expectedRevision: 1,
  });
  expect(revoked).toMatchObject({ verificationStatus: 'REVOKED', revision: 2, isPrimaryContact: false });
  expect(await getOwnHousehold(h.client, h.ctx(h.parentActor))).toBeNull();
  expect((await getOwnStudent(h.client, h.ctx({ userId: child.id, role: 'ELEVE' })))?.parents).toEqual([]);
  const audit = await h.client.auditEvent.findMany({ where: { subjectId: household.id }, orderBy: { createdAt: 'asc' } });
  expect(audit.map(row => row.action)).toEqual(['household.parent_verified', 'household.parent_revoked']);
  expect(JSON.stringify(audit)).not.toContain('a'.repeat(64));
});

test('parents cannot verify themselves and wrong household ids cannot redirect a staff verification', async () => {
  const { verifyHouseholdParent } = await import('@/lib/core-v2/services/household-verification');
  const { household } = await unverifiedFamily();
  const input = { householdId: household.id, parentUserId: h.parentActor.userId, expectedRevision: 0, evidenceDigest: 'a'.repeat(64) };
  await expect(verifyHouseholdParent(h.client, h.ctx(h.parentActor), input)).rejects.toMatchObject({ code: 'FORBIDDEN' });
  const other = await h.client.household.create({ data: {} });
  await expect(verifyHouseholdParent(h.client, h.ctx(), { ...input, householdId: other.id })).rejects.toMatchObject({ code: 'NOT_FOUND' });
  expect(await getOwnHousehold(h.client, h.ctx(h.parentActor))).toBeNull();
  expect(await h.client.auditEvent.count()).toBe(0);
});

test('stale retries cannot reverify a revoked membership or create a duplicate audit event', async () => {
  const { verifyHouseholdParent, revokeHouseholdParent } = await import('@/lib/core-v2/services/household-verification');
  const { household } = await unverifiedFamily();
  const input = { householdId: household.id, parentUserId: h.parentActor.userId, expectedRevision: 0, evidenceDigest: 'a'.repeat(64) };
  await verifyHouseholdParent(h.client, h.ctx(), input);
  await revokeHouseholdParent(h.client, h.ctx(), { householdId: household.id, parentUserId: h.parentActor.userId, expectedRevision: 1 });
  await expect(verifyHouseholdParent(h.client, h.ctx(), input)).rejects.toMatchObject({ code: 'CONFLICT' });
  expect(await getOwnHousehold(h.client, h.ctx(h.parentActor))).toBeNull();
  expect(await h.client.auditEvent.count()).toBe(2);
});

test('two competing verification/revocation decisions on the same revision have exactly one winner', async () => {
  const { verifyHouseholdParent, revokeHouseholdParent } = await import('@/lib/core-v2/services/household-verification');
  const { household } = await unverifiedFamily();
  const input = { householdId: household.id, parentUserId: h.parentActor.userId, expectedRevision: 0 };
  const outcomes = await Promise.allSettled([
    verifyHouseholdParent(h.client, h.ctx(), { ...input, evidenceDigest: 'a'.repeat(64) }),
    revokeHouseholdParent(h.client, h.ctx(), input),
  ]);
  expect(outcomes.filter(result => result.status === 'fulfilled')).toHaveLength(1);
  const failure = outcomes.find(result => result.status === 'rejected');
  expect(failure).toMatchObject({ status: 'rejected', reason: { code: 'CONFLICT' } });
  expect(await h.client.auditEvent.count()).toBe(1);
  expect((await h.client.householdParent.findUniqueOrThrow({ where: { userId: h.parentActor.userId } })).revision).toBe(1);
});

test('PostgreSQL refuses VERIFIED rows without evidence and refuses a revoked primary contact', async () => {
  const { household } = await unverifiedFamily();
  await expect(h.client.householdParent.update({
    where: { userId: h.parentActor.userId }, data: { verificationStatus: 'VERIFIED' },
  })).rejects.toThrow(/household_membership_verification_state/);
  await expect(h.client.householdParent.update({
    where: { userId: h.parentActor.userId }, data: { verificationStatus: 'REVOKED', revokedAt: new Date() },
  })).rejects.toThrow(/household_membership_verification_state/);
  expect(await getOwnHousehold(h.client, h.ctx(h.parentActor))).toBeNull();
  expect(household.id).toBeTruthy();
});

test('a decision blocked by a concurrent revision change cannot grant access', async () => {
  const { verifyHouseholdParent } = await import('@/lib/core-v2/services/household-verification');
  const { household } = await unverifiedFamily();
  const held = await holdOpenTransaction(h.client, async tx => {
    await tx.householdParent.update({ where: { userId: h.parentActor.userId }, data: { revision: { increment: 1 } } });
  });
  const decision = verifyHouseholdParent(h.client, h.ctx(), {
    householdId: household.id, parentUserId: h.parentActor.userId, expectedRevision: 0, evidenceDigest: 'a'.repeat(64),
  });
  const outcome = decision.then(value => ({ value }), error => ({ error: error as unknown }));
  try { await waitForLockWaiter(h.client); } finally { await held.release(); }
  expect(await outcome).toMatchObject({ error: { code: 'CONFLICT' } });
  expect(await getOwnHousehold(h.client, h.ctx(h.parentActor))).toBeNull();
  expect(await h.client.auditEvent.count()).toBe(0);
});

test('failure to append the audit event rolls back verification and revocation', async () => {
  const { verifyHouseholdParent, revokeHouseholdParent } = await import('@/lib/core-v2/services/household-verification');
  const { household } = await unverifiedFamily();
  const input = { householdId: household.id, parentUserId: h.parentActor.userId, expectedRevision: 0, evidenceDigest: 'a'.repeat(64) };
  await h.client.$executeRaw`CREATE FUNCTION recovery_test_membership_audit_failure() RETURNS trigger
    LANGUAGE plpgsql AS $$ BEGIN
      IF NEW.action IN ('household.parent_verified', 'household.parent_revoked') THEN
        RAISE EXCEPTION 'SYNTHETIC_MEMBERSHIP_AUDIT_FAILURE';
      END IF;
      RETURN NEW;
    END $$`;
  await h.client.$executeRaw`CREATE TRIGGER recovery_test_membership_audit_failure
    BEFORE INSERT ON audit_events FOR EACH ROW EXECUTE FUNCTION recovery_test_membership_audit_failure()`;
  try {
    await expect(verifyHouseholdParent(h.client, h.ctx(), input)).rejects.toThrow(/SYNTHETIC_MEMBERSHIP_AUDIT_FAILURE/);
    await expect(revokeHouseholdParent(h.client, h.ctx(), {
      householdId: household.id, parentUserId: h.parentActor.userId, expectedRevision: 0,
    })).rejects.toThrow(/SYNTHETIC_MEMBERSHIP_AUDIT_FAILURE/);
    expect(await h.client.householdParent.findUniqueOrThrow({ where: { userId: h.parentActor.userId } }))
      .toMatchObject({ verificationStatus: 'PENDING', revision: 0, isPrimaryContact: true, verifiedAt: null, revokedAt: null });
    expect(await h.client.auditEvent.count()).toBe(0);
  } finally {
    await h.client.$executeRaw`DROP TRIGGER IF EXISTS recovery_test_membership_audit_failure ON audit_events`;
    await h.client.$executeRaw`DROP FUNCTION IF EXISTS recovery_test_membership_audit_failure()`;
  }
});
