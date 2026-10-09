/** @jest-environment node */
import {
  authorizeParentStudentRecords, familyAuthorityAvailable, familyReadAllowed, resolveParentStudentAccess,
} from '@/lib/families/student-access-authority';
import { getFamilyAuthorityMode, readCoreFamilyAuthority } from '@/lib/core-v2/queries/family-authority';
import { prisma } from '@/lib/prisma';

jest.mock('@/lib/core-v2/queries/family-authority', () => ({
  getFamilyAuthorityMode: jest.fn(), readCoreFamilyAuthority: jest.fn(),
}));

const record = { id: 'synthetic-student', userId: 'synthetic-student-user', parent: { userId: 'synthetic-parent' } };
const mode = jest.mocked(getFamilyAuthorityMode);
const core = jest.mocked(readCoreFamilyAuthority);

beforeEach(() => {
  jest.clearAllMocks();
  mode.mockReturnValue('HYBRID');
  core.mockResolvedValue({ parentOwned: true, students: [{ id: record.id, owned: true, allowed: true }] });
});

test('V1_ONLY retains explicit legacy reads and mutations without opening Core', async () => {
  mode.mockReturnValue('V1_ONLY');
  expect(await authorizeParentStudentRecords('synthetic-parent', [record])).toEqual([{ id: record.id, status: 'LEGACY_ALLOWED' }]);
  expect(await authorizeParentStudentRecords('synthetic-parent', [record], 'mutation')).toEqual([{ id: record.id, status: 'LEGACY_ALLOWED' }]);
  expect(await authorizeParentStudentRecords('other-parent', [record])).toEqual([{ id: record.id, status: 'DENIED' }]);
  expect(core).not.toHaveBeenCalled();
});

test('HYBRID allows a completely V1-owned family through its historical relation', async () => {
  core.mockResolvedValue({ parentOwned: false, students: [{ id: record.id, owned: false, allowed: false }] });
  expect(await authorizeParentStudentRecords('synthetic-parent', [record])).toEqual([{ id: record.id, status: 'LEGACY_ALLOWED' }]);
  expect(await authorizeParentStudentRecords('other-parent', [record])).toEqual([{ id: record.id, status: 'DENIED' }]);
});

test('HYBRID refuses parent V1 / child Core without a verified Core membership', async () => {
  core.mockResolvedValue({ parentOwned: false, students: [{ id: record.id, owned: true, allowed: false }] });
  expect(await authorizeParentStudentRecords('synthetic-parent', [record])).toEqual([{ id: record.id, status: 'DENIED' }]);
});

test('HYBRID refuses parent Core / child V1 rather than reviving the historical relation', async () => {
  core.mockResolvedValue({ parentOwned: true, students: [{ id: record.id, owned: false, allowed: false }] });
  expect(await authorizeParentStudentRecords('synthetic-parent', [record])).toEqual([{ id: record.id, status: 'DENIED' }]);
});

test.each(['HYBRID', 'V2_ONLY'] as const)('%s grants only a verified Core read, independent of the historical parent', async rollout => {
  mode.mockReturnValue(rollout);
  expect(await authorizeParentStudentRecords('synthetic-parent', [{ ...record, parent: { userId: 'old-parent' } }]))
    .toEqual([{ id: record.id, status: 'CORE_VERIFIED_READ' }]);
});

test.each(['HYBRID', 'V2_ONLY'] as const)('%s refuses a V1 mutation even when a Core read is permitted', async rollout => {
  mode.mockReturnValue(rollout);
  expect(await authorizeParentStudentRecords('synthetic-parent', [record], 'mutation')).toEqual([{ id: record.id, status: 'DENIED' }]);
});

test('V2_ONLY never falls back for unmigrated identities', async () => {
  mode.mockReturnValue('V2_ONLY');
  core.mockResolvedValue({ parentOwned: false, students: [{ id: record.id, owned: false, allowed: false }] });
  expect(await authorizeParentStudentRecords('synthetic-parent', [record])).toEqual([{ id: record.id, status: 'DENIED' }]);
});

test('bulk decisions preserve order and do not confuse a denied child with an allowed one', async () => {
  const other = { ...record, id: 'other-student', userId: 'other-student-user' };
  core.mockResolvedValue({ parentOwned: true, students: [
    { id: other.id, owned: true, allowed: false }, { id: record.id, owned: true, allowed: true },
  ] });
  const decisions = await authorizeParentStudentRecords('synthetic-parent', [record, other]);
  expect(decisions).toEqual([{ id: record.id, status: 'CORE_VERIFIED_READ' }, { id: other.id, status: 'DENIED' }]);
  expect(decisions.filter(familyReadAllowed).map(decision => decision.id)).toEqual([record.id]);
  expect(core).toHaveBeenCalledTimes(1);
});

test('a missing Core decision is a denial, never a legacy fallback', async () => {
  core.mockResolvedValue({ parentOwned: false, students: [] });
  expect(await authorizeParentStudentRecords('synthetic-parent', [record])).toEqual([{ id: record.id, status: 'DENIED' }]);
});

test('an authority outage is explicit and its internal error is never returned', async () => {
  core.mockRejectedValue(new Error('SYNTHETIC_PRIVATE_DRIVER_DIAGNOSTIC'));
  expect(await authorizeParentStudentRecords('synthetic-parent', [record])).toEqual([{ id: record.id, status: 'AUTHORITY_UNAVAILABLE' }]);
});

test('missing identity inputs are refused before opening Core', async () => {
  expect(await authorizeParentStudentRecords('', [record])).toEqual([{ id: record.id, status: 'DENIED' }]);
  expect(await authorizeParentStudentRecords('synthetic-parent', [{ ...record, userId: '' }])).toEqual([{ id: record.id, status: 'DENIED' }]);
  expect(await authorizeParentStudentRecords('synthetic-parent', [])).toEqual([]);
  expect(core).not.toHaveBeenCalled();
});

test('the public resolver reads only server-owned identity facts before authorization', async () => {
  jest.mocked(prisma.student.findUnique).mockResolvedValue(record as never);
  expect(await resolveParentStudentAccess('synthetic-parent', record.id)).toEqual({ id: record.id, status: 'CORE_VERIFIED_READ' });
  expect(prisma.student.findUnique).toHaveBeenCalledWith({
    where: { id: record.id }, select: { id: true, userId: true, parent: { select: { userId: true } } },
  });
  jest.mocked(prisma.student.findUnique).mockResolvedValue(null);
  expect(await resolveParentStudentAccess('synthetic-parent', 'missing-student')).toEqual({ id: 'missing-student', status: 'DENIED' });
});

test('the outage probe opens Core without any student identity', async () => {
  expect(await familyAuthorityAvailable('synthetic-parent')).toBe(true);
  expect(core).toHaveBeenCalledWith('synthetic-parent', []);
  core.mockRejectedValue(new Error('SYNTHETIC_PRIVATE_DRIVER_DIAGNOSTIC'));
  expect(await familyAuthorityAvailable('synthetic-parent')).toBe(false);
});

test('V1_ONLY has no Core authority to lose', async () => {
  mode.mockReturnValue('V1_ONLY');
  expect(await familyAuthorityAvailable('synthetic-parent')).toBe(true);
  jest.mocked(prisma.student.findUnique).mockResolvedValue(null);
  expect(await resolveParentStudentAccess('synthetic-parent', 'missing-student')).toEqual({ id: 'missing-student', status: 'DENIED' });
  expect(core).not.toHaveBeenCalled();
});

test('during an outage an unknown student answers exactly like a known one', async () => {
  core.mockRejectedValue(new Error('SYNTHETIC_PRIVATE_DRIVER_DIAGNOSTIC'));
  jest.mocked(prisma.student.findUnique).mockResolvedValue(record as never);
  const known = await resolveParentStudentAccess('synthetic-parent', record.id);
  jest.mocked(prisma.student.findUnique).mockResolvedValue(null);
  const unknown = await resolveParentStudentAccess('synthetic-parent', 'missing-student');
  expect(known.status).toBe('AUTHORITY_UNAVAILABLE');
  expect(unknown.status).toBe(known.status);
});
