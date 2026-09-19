/**
 * Staff provisioning — the gap that blocked go-live: Core v2 could hold
 * families but could not create the ASSISTANTE and COACH who operate them.
 * These tests hold the whole contract against a real Core v2 database.
 */
import bcrypt from 'bcryptjs';
import type { Actor } from '@/lib/core-v2/rbac';
import { CoreV2DomainError } from '@/lib/core-v2/errors';
import {
  activateAccount,
  assignCoach,
  createStaffAccount,
  inviteAccount,
  isSessionStillValid,
  setCoachCapability,
  suspendAccount,
  verifyCredentials,
} from '@/lib/core-v2/services';
import { auditTrail, setupServiceHarness } from '../helpers/service-harness';

const h = setupServiceHarness();

// Synthetic fixture password (change_ prefix = the documented placeholder form
// the versioned-credential guard accepts).
const PW = 'change_me_staff_activation';

const assistanteInput = { role: 'ASSISTANTE', firstName: 'Ines', lastName: 'Staff', email: 'new-assistante@example.com' } as const;
const coachInput = { role: 'COACH', firstName: 'Karim', lastName: 'Staff', email: 'new-coach@example.com' } as const;

describe('createStaffAccount — authority', () => {
  test('ADMIN may create an ASSISTANTE and a COACH', async () => {
    const a = await createStaffAccount(h.client, h.ctx(h.admin), assistanteInput);
    expect(a.user.role).toBe('ASSISTANTE');
    expect(a.coachProfile).toBeNull();

    const c = await createStaffAccount(h.client, h.ctx(h.admin), coachInput);
    expect(c.user.role).toBe('COACH');
    expect(c.coachProfile).not.toBeNull();
  });

  test.each<[string, () => Actor]>([
    ['ASSISTANTE', () => h.assistante],
    ['PARENT', () => h.parentActor],
  ])('%s is denied — creating a colleague is not the same act as inviting one', async (_label, actor) => {
    await expect(createStaffAccount(h.client, h.ctx(actor()), assistanteInput)).rejects.toThrow(/STAFF_ACCOUNT_CREATE/);
  });

  test.each<['COACH' | 'ELEVE']>([['COACH'], ['ELEVE']])('%s holds no back-office capability at all', async (role) => {
    const user = await h.client.user.create({ data: { role, email: `denied-${role.toLowerCase()}@example.com`, accountStatus: 'ACTIVE' } });
    await expect(createStaffAccount(h.client, h.ctx({ userId: user.id, role }), assistanteInput)).rejects.toThrow(/STAFF_ACCOUNT_CREATE/);
  });

  test('ADMIN cannot be created through this door — the bootstrap is the only one', async () => {
    await expect(
      createStaffAccount(h.client, h.ctx(h.admin), { ...assistanteInput, role: 'ADMIN' } as never),
    ).rejects.toBeInstanceOf(CoreV2DomainError);
    expect(await h.client.user.count({ where: { role: 'ADMIN' } })).toBe(1); // only the harness admin
  });
});

describe('createStaffAccount — integrity', () => {
  test('a duplicate e-mail is refused, case-insensitively, and leaves nothing behind', async () => {
    await createStaffAccount(h.client, h.ctx(h.admin), coachInput);
    const before = await h.client.coachProfile.count();

    await expect(
      createStaffAccount(h.client, h.ctx(h.admin), { ...coachInput, email: coachInput.email.toUpperCase() }),
    ).rejects.toThrow(/email already exists/i);

    expect(await h.client.user.count({ where: { email: { contains: 'new-coach' } } })).toBe(1);
    expect(await h.client.coachProfile.count()).toBe(before);
  });

  test('a coach and its profile are created atomically — never a coach that works nowhere', async () => {
    const { user, coachProfile } = await createStaffAccount(h.client, h.ctx(h.admin), coachInput);
    expect(coachProfile?.userId).toBe(user.id);
    const orphans = await h.client.user.findMany({
      where: { role: 'COACH', coachProfile: { is: null } },
      select: { id: true },
    });
    expect(orphans).toHaveLength(0);
  });

  test('the account is born unusable: PENDING_ACTIVATION, no password, sessionVersion 0', async () => {
    const { user } = await createStaffAccount(h.client, h.ctx(h.admin), assistanteInput);
    expect(user.accountStatus).toBe('PENDING_ACTIVATION');
    expect(user.password).toBeNull();
    expect(user.activatedAt).toBeNull();
    expect(user.sessionVersion).toBe(0);
    await expect(verifyCredentials(h.client, { email: assistanteInput.email, password: PW })).resolves.toBeNull();
  });

  test('the audit names the acting administrator, and records no secret', async () => {
    const { user, coachProfile } = await createStaffAccount(h.client, h.ctx(h.admin), coachInput);
    expect(await auditTrail(h.client, user.id)).toEqual(['staff.account_created']);
    expect(await auditTrail(h.client, coachProfile!.id)).toEqual(['coach.profile_created']);

    const rows = await h.client.auditEvent.findMany({ where: { subjectId: user.id } });
    expect(rows[0].actorUserId).toBe(h.admin.userId);
    expect(JSON.stringify(rows[0].metadata)).not.toMatch(/password|token|\$2[aby]\$/i);
  });
});

describe('createStaffAccount — the account becomes usable only through the normal lifecycle', () => {
  test('invite → activate → sign in → suspend revokes the session', async () => {
    const { user } = await createStaffAccount(h.client, h.ctx(h.admin), assistanteInput);

    const issued = await inviteAccount(h.client, h.ctx(h.admin), user.id);
    const activated = await activateAccount(h.client, { rawToken: issued.rawToken, password: PW });
    expect(activated.accountStatus).toBe('ACTIVE');
    expect(await bcrypt.compare(PW, activated.password as string)).toBe(true);
    expect(activated.sessionVersion).toBe(1);

    const verified = await verifyCredentials(h.client, { email: assistanteInput.email, password: PW });
    expect(verified?.userId).toBe(user.id);
    expect(await isSessionStillValid(h.client, { userId: user.id, role: 'ASSISTANTE', sessionVersion: activated.sessionVersion })).toBe(true);

    const suspended = await suspendAccount(h.client, h.ctx(h.admin), user.id);
    expect(suspended.accountStatus).toBe('SUSPENDED');
    expect(suspended.sessionVersion).toBe(activated.sessionVersion + 1);
    expect(await isSessionStillValid(h.client, { userId: user.id, role: 'ASSISTANTE', sessionVersion: activated.sessionVersion })).toBe(false);
    await expect(verifyCredentials(h.client, { email: assistanteInput.email, password: PW })).resolves.toBeNull();
  });

  test('a freshly created coach can be granted a capability and assigned — the profile is real, not decorative', async () => {
    const { coachProfile } = await createStaffAccount(h.client, h.ctx(h.admin), coachInput);
    const granted = await setCoachCapability(h.client, h.ctx(h.admin), {
      coachId: coachProfile!.id,
      courseKey: 'mathematiques',
      granted: true,
    });
    expect(granted?.courseKey).toBe('mathematiques');

    // Without an enrollment the assignment must still be refused for the right
    // reason — the coach half of the precondition is satisfied.
    await expect(
      assignCoach(h.client, h.ctx(h.admin), { coachId: coachProfile!.id, enrollmentId: 'no-such-enrollment', courseKey: 'mathematiques' }),
    ).rejects.toThrow(/not found/i);
  });
});
