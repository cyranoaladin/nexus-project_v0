import { createHash } from 'node:crypto';
import { prisma } from '@/lib/prisma';
import { requestAccountInvitation, requestAccountInvitationResend } from '@/lib/core-v2/services';
import { ForbiddenError } from '@/lib/core-v2/errors';
import { setupV1Fixture } from './helpers/v1-provisioning-fixture';

const f = setupV1Fixture();
async function snapshot(database: { $queryRawUnsafe: (sql: string) => Promise<unknown> }) {
  const tables = await database.$queryRawUnsafe("SELECT table_name FROM information_schema.tables WHERE table_schema='public' AND table_type='BASE TABLE' ORDER BY table_name") as Array<{ table_name: string }>;
  const hashes: Record<string,string> = {};
  for (const { table_name } of tables) {
    if (!/^[a-zA-Z0-9_]+$/.test(table_name)) throw new Error('UNSAFE_TEST_TABLE');
    const rows = await database.$queryRawUnsafe('SELECT to_jsonb(t) AS row FROM public."' + table_name + '" t ORDER BY to_jsonb(t)::text');
    hashes[table_name] = createHash('sha256').update(JSON.stringify(rows)).digest('hex');
  }
  return hashes;
}
const databases = () => Promise.all([snapshot(f.h.client), snapshot(prisma)]);

describe('invitation scope refuses before every side effect', () => {
  test.each(['absent', 'unlinked-family', 'staff'] as const)('ASSISTANTE %s uses the same generic refusal and leaves both databases invariant', async kind => {
    const id = kind === 'absent' ? 'absent-scope-user' : (await f.coreUser(kind === 'staff' ? 'COACH' : 'ELEVE', kind)).id;
    const before = await databases();
    await expect(requestAccountInvitation(f.h.client, f.h.ctx(f.h.assistante), id))
      .rejects.toThrow('Invitation operation unavailable.');
    expect(await databases()).toEqual(before);
  });
  test('a forged issuer role does not become authority', async () => {
    const target = await f.coreUser('ASSISTANTE', 'forged-issuer');
    const before = await databases();
    await expect(requestAccountInvitation(f.h.client, f.h.ctx({ ...f.h.assistante, role: 'ADMIN' }), target.id)).rejects.toBeInstanceOf(ForbiddenError);
    expect(await databases()).toEqual(before);
  });
  test.each(['ACTIVE', 'PENDING', 'SUSPENDED'] as const)('email belonging to another V1 %s identity refuses before enqueue', async state => {
    const other = await f.v1User('COACH', 'email-owner', state);
    const target = await f.coreUser('COACH', 'different-id', { email: other.email });
    const before = await databases();
    await expect(requestAccountInvitation(f.h.client, f.h.ctx(), target.id)).rejects.toThrow('Invitation operation unavailable.');
    expect(await databases()).toEqual(before);
  });
  test('resend never changes the bound recipient, even when Core contact was edited', async () => {
    const target = await f.coreUser('ASSISTANTE', 'original-recipient');
    await requestAccountInvitation(f.h.client, f.h.ctx(), target.id);
    await f.h.client.user.update({ where: { id: target.id }, data: { email: 'different-recipient@example.test' } });
    const before = await databases();
    await expect(requestAccountInvitationResend(f.h.client, f.h.ctx(), target.id)).rejects.toThrow('Invitation operation unavailable.');
    expect(await databases()).toEqual(before);
  });
  test('a suspended V1 issuer cannot enqueue while its Core membership is active', async () => {
    await prisma.user.update({ where: { id: f.h.admin.userId }, data: { disabledAt: new Date() } });
    const target = await f.coreUser('ASSISTANTE', 'suspended-issuer');
    const before = await databases();
    await expect(requestAccountInvitation(f.h.client, f.h.ctx(), target.id)).rejects.toThrow('Invitation operation unavailable.');
    expect(await databases()).toEqual(before);
  });
});
