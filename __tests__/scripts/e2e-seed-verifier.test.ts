/** @jest-environment node */
import { verifyE2eSeed } from '@/scripts/verify-e2e-seed';
import { ARIA_E2E_PERSONAS } from '@/scripts/e2e/aria-personas';
import { CORE_V2_ARIA_FOUNDATION_EMAIL } from '@/scripts/e2e/aria-foundation-identity';
import bcrypt from 'bcryptjs';
jest.mock('bcryptjs', () => ({ compare: jest.fn(async () => true) }));
const exitSpy = jest.spyOn(process, 'exit').mockImplementation(() => undefined as never);
afterAll(() => exitSpy.mockRestore());

function fixture() {
  const roles: Record<string, string> = { admin: 'ADMIN', parent: 'PARENT', student: 'ELEVE', student2: 'ELEVE',
    studentSurvival: 'ELEVE', coach: 'COACH', coachV1: 'COACH', coach2: 'COACH', assistante: 'ASSISTANTE', zenon: 'COACH',
    ariaPersonasParent: 'PARENT', coreV2AriaFoundation: 'ELEVE', ...Object.fromEntries(ARIA_E2E_PERSONAS.map(p => [p.key, 'ELEVE'])) };
  const credentials = Object.fromEntries(Object.keys(roles).map(key => [key, { email: `${key}@example.test`, password: 'x'.repeat(64) }]));
  credentials.coreV2AriaFoundation.email = CORE_V2_ARIA_FOUNDATION_EMAIL;
  for (const persona of ARIA_E2E_PERSONAS) credentials[persona.key].email = persona.email;
  const users = Object.fromEntries(Object.entries(roles).map(([key, role]) => [key, { id: `identity-${key}`, role,
    email: credentials[key].email, password: 'h'.repeat(60), activatedAt: new Date(), disabledAt: null, mergedIntoUserId: null,
    student: ARIA_E2E_PERSONAS.some(p => p.key === key) ? { id: `student-${key}`, userId: `identity-${key}`, parentId: 'aria-parent-profile' } : null,
    parentProfile: key === 'ariaPersonasParent' ? { id: 'aria-parent-profile', userId: 'identity-ariaPersonasParent' } : null,
  }]));
  const client = { user: { count: jest.fn(async () => Object.keys(users).length),
    findUnique: jest.fn(async ({ where }: { where: { email: string } }) => Object.values(users).find(u => u.email === where.email) ?? null) } };
  return { credentials, users, client, run: () => verifyE2eSeed(client as never, credentials) };
}
beforeEach(() => jest.mocked(bcrypt.compare).mockResolvedValue(true as never));
it('qualifies the exact nineteen V1 identities, their seven authoritative parent relations and a foundation without legacy Student', async () => {
  const h = fixture();
  await expect(h.run()).resolves.toEqual({ identities: 19, ariaPersonas: 7 });
  expect(h.client.user.findUnique).toHaveBeenCalledTimes(19);
});
it.each(['missing-key', 'extra-key', 'role', 'inactive', 'disabled', 'merged', 'foreign-parent', 'foreign-student-user',
  'duplicate-student', 'duplicate-identity', 'foreign-persona-email', 'foundation-student', 'foundation-parent'] as const)
('refuses incomplete or incoherent authoritative fixture data: %s', async fault => {
  const h = fixture();
  if (fault === 'missing-key') delete h.credentials.ariaPersonasParent;
  else if (fault === 'extra-key') h.credentials.extra = { email: 'extra@example.test', password: 'x'.repeat(64) };
  else if (fault === 'role') h.users.ariaNsi.role = 'ADMIN';
  else if (fault === 'inactive') h.users.coach.activatedAt = null as never;
  else if (fault === 'disabled') h.users.coach.disabledAt = new Date() as never;
  else if (fault === 'merged') h.users.coach.mergedIntoUserId = 'other' as never;
  else if (fault === 'foreign-parent') h.users.ariaNsi.student!.parentId = 'foreign-profile';
  else if (fault === 'foreign-student-user') h.users.ariaNsi.student!.userId = 'foreign-user';
  else if (fault === 'duplicate-student') h.users.ariaNsiPeer.student!.id = h.users.ariaNsi.student!.id;
  else if (fault === 'duplicate-identity') h.users.ariaNsiPeer.id = h.users.ariaNsi.id;
  else if (fault === 'foreign-persona-email') { h.credentials.ariaNsi.email = 'foreign@example.test'; h.users.ariaNsi.email = 'foreign@example.test'; }
  else if (fault === 'foundation-student') h.users.coreV2AriaFoundation.student = h.users.ariaNsi.student;
  else if (fault === 'foundation-parent') h.users.coreV2AriaFoundation.parentProfile = h.users.ariaPersonasParent.parentProfile;
  await expect(h.run()).rejects.toThrow('E2E_SEED_VERIFICATION_FAILED');
});
it('refuses a credential that the real V1 bcrypt comparison does not validate', async () => {
  const h = fixture(); jest.mocked(bcrypt.compare).mockResolvedValueOnce(false as never);
  await expect(h.run()).rejects.toThrow('E2E_SEED_VERIFICATION_FAILED');
});
