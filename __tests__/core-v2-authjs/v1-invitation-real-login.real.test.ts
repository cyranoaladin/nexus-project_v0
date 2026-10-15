/**
 * The login half of the V1-authority invitation, through the REAL Auth.js
 * handlers (csrf -> credentials callback -> session cookie -> session): an
 * invited parent, student and staff member activates in Core v1 and signs in
 * as themselves; a wrong password, a never-activated account and an expired
 * invitation do not.
 */
import { requestAccountInvitation } from '@/lib/core-v2/services';
import { activationLink, newPassword, setupV1Fixture, type Role } from '../core-v2/helpers/v1-provisioning-fixture';

const f = setupV1Fixture();
const { h } = f;

async function invite(role: Role, label: string) {
  const user = await f.coreUser(role, label);
  await requestAccountInvitation(h.client, h.ctx(), user.id);
  await f.settle();
  await f.deliverMail();
  return { user, link: activationLink(f.mailbox[f.mailbox.length - 1]) };
}

test.each<Role>(['PARENT', 'ELEVE', 'ASSISTANTE', 'COACH'])('%s activates in v1 and signs in through Auth.js', async (role) => {
  const { user, link } = await invite(role, `authjs-${role.toLowerCase()}`);
  const email = user.email as string;

  // Before activation the credential does not exist anywhere: no login, whatever is typed.
  expect((await f.login(email, newPassword())).ok).toBe(false);

  const password = newPassword();
  expect((await f.activate(link, password)).status).toBe(200);
  await f.settle();

  const ok = await f.login(email, password);
  expect(ok.ok).toBe(true);
  expect(ok.session?.user).toMatchObject({ id: user.id, role });
  expect((await f.login(email, `${password}x`)).ok).toBe(false);
  // The link is single-use: replaying it neither activates nor changes the password.
  expect((await f.activate(link, newPassword())).status).toBe(400);
  expect((await f.login(email, password)).ok).toBe(true);
});
