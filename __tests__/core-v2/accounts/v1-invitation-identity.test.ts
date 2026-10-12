/**
 * D2: what Core v1 decides for each identity the invitation can meet, for
 * parent, student AND staff. Core v1 is the only authority; a refusal mutates
 * nothing and sends nothing.
 */
import { prisma } from '@/lib/prisma';
import { createActivationToken, type ActivationPurpose } from '@/lib/auth/activation-token';
import { ForbiddenError, InvalidStateError } from '@/lib/core-v2/errors';
import { requestAccountInvitation, requestAccountInvitationResend } from '@/lib/core-v2/services';
import { activationLink, newPassword, setupV1Fixture, type Role } from '../helpers/v1-provisioning-fixture';

const f = setupV1Fixture();
const { h } = f;

const ROLES: readonly Role[] = ['PARENT', 'ELEVE', 'ASSISTANTE', 'COACH'];
const PURPOSE: Record<string, ActivationPurpose> = { PARENT: 'parent', ELEVE: 'student', ASSISTANTE: 'staff', COACH: 'staff' };

/** Core row and v1 row sharing one id and e-mail: the contract of the one id space. */
async function pair(role: Role, label: string, shape: Parameters<typeof f.v1User>[2]) {
  const v1 = await f.v1User(role, label, shape);
  const core = await f.coreUser(role, label, { id: v1.id, email: v1.email });
  return { v1, core };
}

describe('V1 account ACTIVE -> link only', () => {
  test.each(ROLES)('%s: nothing in v1 is written, no mail, Core becomes ACTIVE without a credential', async (role) => {
    const { v1, core } = await pair(role, `active-${role.toLowerCase()}`, 'ACTIVE');
    const before = await f.snapshotV1(v1.id);
    await requestAccountInvitation(h.client, h.ctx(), core.id);
    await f.settle();
    await f.deliverMail();

    // Strict equality of every column, `updatedAt` included: not even a no-op UPDATE happened.
    expect(await f.snapshotV1(v1.id)).toEqual(before);
    expect(await f.v1InvitationMailCount()).toBe(0);
    expect(f.mailbox).toHaveLength(0);
    expect(await f.saga(core.id)).toMatchObject({ state: 'CORE_PROVISIONED', v1UserId: v1.id, lastErrorCode: null });
    const row = await h.client.user.findUniqueOrThrow({ where: { id: core.id } });
    expect(row).toMatchObject({ accountStatus: 'ACTIVE', password: null, sessionVersion: 0 });
    // The credential v1 already had keeps working, untouched.
    expect((await f.loginChain(v1.email, v1.password as string)).ok).toBe(true);
  });

  // ADMIN est volontairement EXCLU du cas « liaison seule ». Le lier amenait
  // l'acteur Core ADMIN a ACTIVE, et cela avec la seule capacite ACCOUNT_INVITE
  // que detient ASSISTANTE : une escalade de privilege. Les futurs ADMIN sont
  // promus par un ADMIN Core existant, jamais par une invitation privilegiee.
  test('un ADMIN V1 ACTIF est refuse des la demande : rien n est ecrit, aucune saga', async () => {
    const { v1, core } = await pair('ADMIN', 'active-admin', 'ACTIVE');
    const before = await f.snapshotV1(v1.id);
    await expect(requestAccountInvitation(h.client, h.ctx(), core.id)).rejects.toThrow();
    expect(await f.snapshotV1(v1.id)).toEqual(before);
    expect(await h.client.accountV1Provisioning.findUnique({ where: { userId: core.id } })).toBeNull();
    expect(await f.v1InvitationMailCount()).toBe(0);
    const row = await h.client.user.findUniqueOrThrow({ where: { id: core.id } });
    expect(row.accountStatus).toBe('PENDING_ACTIVATION');
  });
});

describe('V1 account PENDING -> canonical resend: rotate the token, invalidate the previous one', () => {
  test.each(ROLES)('%s', async (role) => {
    const v1 = await f.v1User(role, `pending-${role.toLowerCase()}`, 'PENDING');
    const previous = createActivationToken(PURPOSE[role]);
    await prisma.user.update({ where: { id: v1.id }, data: { activationToken: previous.tokenHash, activationExpiry: previous.expiresAt } });
    const core = await f.coreUser(role, 'pending-core', { id: v1.id, email: v1.email });
    const previousLink = { token: previous.rawToken, purpose: PURPOSE[role] };
    expect((await f.verifyLink(previousLink)).body).toMatchObject({ valid: true });

    await requestAccountInvitation(h.client, h.ctx(), core.id);
    await f.settle();
    await f.deliverMail();

    expect(f.mailbox).toHaveLength(1);
    const fresh = activationLink(f.mailbox[0]);
    expect(fresh.token).not.toBe(previous.rawToken);
    expect((await f.verifyLink(previousLink)).body).toMatchObject({ valid: false });
    expect((await f.verifyLink(fresh)).body).toMatchObject({ valid: true });
    expect((await prisma.user.findUniqueOrThrow({ where: { id: v1.id } })).password).toBeNull();
    expect((await f.saga(core.id)).state).toBe('SENT');
  });
});

describe('V1 account ABSENT -> created pending by the canonical v1 path', () => {
  test('a PARENT also gets the v1 parent profile; the role is the Core role, nothing else', async () => {
    const core = await f.coreUser('PARENT', 'absent-parent-profile');
    await requestAccountInvitation(h.client, h.ctx(), core.id);
    await f.settle();
    const created = await prisma.user.findUniqueOrThrow({ where: { id: core.id }, include: { parentProfile: true } });
    expect(created.role).toBe('PARENT');
    expect(created.parentProfile).not.toBeNull();
    expect(created.password).toBeNull();
  });

  test('ADMIN is never created or invited through an e-mailed link', async () => {
    const core = await f.coreUser('ADMIN', 'absent-admin');
    // Refus a la demande : aucune ecriture, aucun job enfile, donc aucune saga.
    await expect(requestAccountInvitation(h.client, h.ctx(), core.id)).rejects.toThrow();
    expect(await h.client.accountV1Provisioning.findUnique({ where: { userId: core.id } })).toBeNull();
    expect(await prisma.user.findUnique({ where: { id: core.id } })).toBeNull();
    expect(await f.v1InvitationMailCount()).toBe(0);
  });

  test('a PENDING v1 ADMIN is not re-invited either: its token stays untouched', async () => {
    const { v1, core } = await pair('ADMIN', 'pending-admin', 'PENDING');
    const before = await f.snapshotV1(v1.id);
    await expect(requestAccountInvitation(h.client, h.ctx(), core.id)).rejects.toThrow();
    expect(await h.client.accountV1Provisioning.findUnique({ where: { userId: core.id } })).toBeNull();
    expect(await f.snapshotV1(v1.id)).toEqual(before);
  });
});

describe('fail closed: no mutation, no delivery', () => {
  async function expectRefused(coreId: string, v1Id: string | null, code: string) {
    const before = v1Id ? await f.snapshotV1(v1Id) : null;
    await requestAccountInvitation(h.client, h.ctx(), coreId);
    await f.settle();
    await f.deliverMail();
    expect(await f.saga(coreId)).toMatchObject({ state: 'CANCELLED', lastErrorCode: code });
    if (v1Id) expect(await f.snapshotV1(v1Id)).toEqual(before);
    expect(await f.v1InvitationMailCount()).toBe(0);
    expect(f.mailbox).toHaveLength(0);
    expect((await h.client.user.findUniqueOrThrow({ where: { id: coreId } })).accountStatus).toBe('PENDING_ACTIVATION');
  }

  test.each(ROLES)('%s suspended in v1', async (role) => {
    const { v1, core } = await pair(role, `suspended-${role.toLowerCase()}`, 'SUSPENDED');
    await expectRefused(core.id, v1.id, 'V1_ACCOUNT_SUSPENDED');
  });

  test('a PARENT merged into another account', async () => {
    const { v1, core } = await pair('PARENT', 'merged-parent', 'MERGED');
    await expectRefused(core.id, v1.id, 'V1_ACCOUNT_MERGED');
  });

  test.each(ROLES)('%s: the e-mail belongs to ANOTHER v1 identity', async (role) => {
    const other = await f.v1User(role, `owner-${role.toLowerCase()}`, 'PENDING');
    const core = await f.coreUser(role, 'colliding-core', { email: other.email });
    await expectRefused(core.id, other.id, 'V1_IDENTITY_COLLISION');
    expect(await prisma.user.findUnique({ where: { id: core.id } })).toBeNull();
  });

  test('the id exists in v1 under a different e-mail', async () => {
    const v1 = await f.v1User('COACH', 'id-owner', 'PENDING');
    const core = await f.coreUser('COACH', 'id-clash', { id: v1.id });
    await expectRefused(core.id, v1.id, 'V1_IDENTITY_COLLISION');
  });

  test('same id and e-mail but another role: never reinterpreted', async () => {
    const v1 = await f.v1User('ASSISTANTE', 'role-clash', 'PENDING');
    const core = await f.coreUser('COACH', 'role-clash-core', { id: v1.id, email: v1.email });
    await expectRefused(core.id, v1.id, 'V1_IDENTITY_COLLISION');
  });

  test('ambiguous v1 state: a parent with a password but no activation timestamp', async () => {
    const v1 = await f.v1User('PARENT', 'ambiguous-parent', 'ACTIVE');
    await prisma.user.update({ where: { id: v1.id }, data: { activatedAt: null } });
    const core = await f.coreUser('PARENT', 'ambiguous-core', { id: v1.id, email: v1.email });
    await expectRefused(core.id, v1.id, 'V1_IDENTITY_AMBIGUOUS');
  });

  test('ambiguous v1 state: an activation timestamp without any credential', async () => {
    const v1 = await f.v1User('ASSISTANTE', 'ambiguous-staff', 'PENDING');
    await prisma.user.update({ where: { id: v1.id }, data: { activatedAt: new Date() } });
    const core = await f.coreUser('ASSISTANTE', 'ambiguous-staff-core', { id: v1.id, email: v1.email });
    await expectRefused(core.id, v1.id, 'V1_IDENTITY_AMBIGUOUS');
  });
});

describe('authorization and forgery', () => {
  test('an actor without ACCOUNT_INVITE changes nothing anywhere', async () => {
    const core = await f.coreUser('ASSISTANTE', 'no-capability');
    for (const actor of [h.parentActor, { userId: 'unknown-actor', role: 'COACH' as const }]) {
      await expect(requestAccountInvitation(h.client, h.ctx(actor), core.id)).rejects.toBeInstanceOf(ForbiddenError);
      await expect(requestAccountInvitationResend(h.client, h.ctx(actor), core.id)).rejects.toBeInstanceOf(ForbiddenError);
    }
    expect(await h.client.accountV1Provisioning.count()).toBe(0);
    expect(await h.client.coreV2JobOutbox.count()).toBe(0);
    expect(await prisma.user.findUnique({ where: { id: core.id } })).toBeNull();
  });

  // The provisioned V1 role must TRACK the Core row, for every invitable role —
  // that is the real invariant. (Asserting that JavaScript discards surplus
  // arguments would only test the language, so the extra argument below is a
  // secondary check: the weight is on the role actually written.)
  test.each(['ASSISTANTE', 'COACH'] as const)(
    'the provisioned V1 role is read from the Core row (%s), never from the call',
    async (coreRole) => {
      const core = await f.coreUser(coreRole, `role-from-core-${coreRole.toLowerCase()}`);
      await (requestAccountInvitation as (...args: unknown[]) => Promise<unknown>)(
        h.client, h.ctx(), core.id, { role: 'ADMIN' }, 'ADMIN',
      );
      await f.settle();
      const provisioned = await prisma.user.findUniqueOrThrow({ where: { id: core.id } });
      expect(provisioned.role).toBe(coreRole);
      // And the saga itself recorded the Core role, not the forged one.
      const saga = await h.client.accountV1Provisioning.findUnique({ where: { userId: core.id } });
      expect(JSON.stringify(saga)).not.toContain('ADMIN');
    },
  );

  test.each([
    ['role', { role: 'ADMIN' }],
    ['email', { email: 'someone@example.test' }],
    ['rawToken', { rawToken: 'x'.repeat(40) }],
    ['password', { password: 'x'.repeat(12) }],
  ])('the job payload cannot carry a %s: the database refuses the key', async (_name, extra) => {
    const core = await f.coreUser('PARENT', 'payload-forgery');
    const payload = { schemaVersion: 'account-v1-provisioning/v1', userId: core.id, generation: 1, kind: 'ADVANCE', ...extra };
    await expect(h.client.coreV2JobOutbox.create({
      data: {
        jobType: 'ACCOUNT_V1_PROVISIONING', aggregateType: 'ACCOUNT_V1_PROVISIONING', aggregateId: core.id,
        idempotencyKey: `forged:${core.id}`, payload,
      },
    })).rejects.toThrow();
    expect(await h.client.coreV2JobOutbox.count()).toBe(0);
  });

  test('a staff link cannot activate a parent, a student or an administrator, whatever purpose is claimed', async () => {
    for (const role of ['PARENT', 'ELEVE', 'ADMIN'] as const) {
      const staffToken = createActivationToken('staff');
      const v1 = await f.v1User(role, `staff-token-${role.toLowerCase()}`, 'PENDING');
      await prisma.user.update({ where: { id: v1.id }, data: { activationToken: staffToken.tokenHash, activationExpiry: staffToken.expiresAt } });
      for (const purpose of ['staff', 'parent', 'student']) {
        const result = await f.activate({ token: staffToken.rawToken, purpose }, newPassword());
        expect(result.status).toBe(400);
      }
      expect((await prisma.user.findUniqueOrThrow({ where: { id: v1.id } })).password).toBeNull();
      await prisma.user.update({ where: { id: v1.id }, data: { activationToken: null, activationExpiry: null } });
    }
  });

  test('a parent link cannot activate a staff account', async () => {
    const v1 = await f.v1User('COACH', 'parent-token-on-staff', 'PENDING');
    const parentToken = createActivationToken('parent');
    await prisma.user.update({ where: { id: v1.id }, data: { activationToken: parentToken.tokenHash, activationExpiry: parentToken.expiresAt } });
    for (const purpose of ['staff', 'parent', 'student']) {
      expect((await f.activate({ token: parentToken.rawToken, purpose }, newPassword())).status).toBe(400);
    }
    expect((await prisma.user.findUniqueOrThrow({ where: { id: v1.id } })).password).toBeNull();
  });
});

describe('an account that is not PENDING in Core is not invited', () => {
  test('an ACTIVE Core account is refused and v1 is never consulted', async () => {
    const core = await h.client.user.create({ data: { role: 'ASSISTANTE', email: 'already-active@d2.example.test', accountStatus: 'ACTIVE' } });
    await expect(requestAccountInvitation(h.client, h.ctx(), core.id)).rejects.toBeInstanceOf(InvalidStateError);
    expect(await h.client.accountV1Provisioning.count()).toBe(0);
  });
});
