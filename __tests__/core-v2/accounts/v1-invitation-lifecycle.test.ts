/**
 * D2: Core v2 invitations under CORE_V2_AUTH_MODE=V1_ONLY with Core v1 as the
 * SOLE credential authority. Two real PostgreSQL databases, the real
 * activation route, the real Auth.js handlers; SMTP is captured, never sent.
 */
import { prisma } from '@/lib/prisma';
import { hashActivationToken } from '@/lib/auth/activation-token';
import { requestAccountInvitation } from '@/lib/core-v2/services';
import { activationLink, newPassword, setupV1Fixture, type Role } from '../helpers/v1-provisioning-fixture';
import { assertNoSecretInCore } from '../helpers/no-secret';

const f = setupV1Fixture();
const { h } = f;

const CASES: ReadonlyArray<readonly [Role, string]> = [
  ['PARENT', 'parent'], ['ELEVE', 'student'], ['ASSISTANTE', 'staff'], ['COACH', 'staff'],
];

describe('absent in v1: create pending, send, activate, real login, provision Core', () => {
  test.each(CASES)('%s', async (role, purpose) => {
    const user = await f.coreUser(role, `absent-${role.toLowerCase()}`);
    const requested = await requestAccountInvitation(h.client, h.ctx(), user.id);

    // The request carries no credential material at all.
    expect(requested.authority).toBe('V1');
    expect(JSON.stringify(requested)).not.toMatch(/token|password|hash/i);
    expect(await h.client.invitation.count()).toBe(0);
    const queued = await h.client.coreV2JobOutbox.findMany({ where: { aggregateType: 'ACCOUNT_V1_PROVISIONING' } });
    expect(queued).toHaveLength(1);
    expect(Object.keys(queued[0].payload as object).sort()).toEqual(['generation', 'kind', 'schemaVersion', 'userId']);
    expect((await h.client.accountV1Provisioning.findUniqueOrThrow({ where: { userId: user.id } })).state).toBe('REQUESTED');

    await f.settle();
    const sent = await h.client.accountV1Provisioning.findUniqueOrThrow({ where: { userId: user.id } });
    expect(sent.state).toBe('SENT');
    expect(sent.v1UserId).toBe(user.id);
    expect(sent.invitationExpiresAt).not.toBeNull();

    // v1 created the pending identity itself: no password, a hashed token, the Core role.
    const pending = await prisma.user.findUniqueOrThrow({ where: { id: user.id } });
    expect(pending.role).toBe(role);
    expect(pending.password).toBeNull();
    expect(pending.activatedAt).toBeNull();
    expect(pending.activationToken).toMatch(/^[0-9a-f]{64}$/);

    await f.deliverMail();
    expect(f.mailbox).toHaveLength(1);
    expect(f.mailbox[0].to).toBe(user.email);
    const link = activationLink(f.mailbox[0]);
    expect(link.purpose).toBe(purpose);
    expect(hashActivationToken(link.token)).toBe(pending.activationToken);
    expect((await f.verifyLink(link)).body).toMatchObject({ valid: true, email: user.email });

    const password = newPassword();
    expect((await f.activate(link, password)).status).toBe(200);
    await f.settle();

    const provisioned = await h.client.accountV1Provisioning.findUniqueOrThrow({ where: { userId: user.id } });
    expect(provisioned.state).toBe('CORE_PROVISIONED');
    const core = await h.client.user.findUniqueOrThrow({ where: { id: user.id } });
    expect(core.accountStatus).toBe('ACTIVE');
    expect(core.password).toBeNull();
    expect(core.sessionVersion).toBe(0);
    expect(core.activatedAt).not.toBeNull();

    const login = await f.loginChain(user.email as string, password);
    expect(login.ok).toBe(true);
    expect(login.session?.user).toMatchObject({ id: user.id, role });
    expect((await f.loginChain(user.email as string, `${password}x`)).ok).toBe(false);

    await assertNoSecretInCore(h.client, [link.token, password, hashActivationToken(link.token), (await prisma.user.findUniqueOrThrow({ where: { id: user.id } })).password as string]);
  });
});
