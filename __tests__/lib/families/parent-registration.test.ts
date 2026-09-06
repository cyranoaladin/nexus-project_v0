jest.mock('@/lib/prisma', () => ({ prisma: {} }));
jest.mock('@/lib/bilans/parent-student-consent', () => ({
  createParentStudentConsentContext: jest.fn(),
}));

import { createParentStudentConsentContext } from '@/lib/bilans/parent-student-consent';
import { completeParentRegistration, loadParentRegistration } from '@/lib/families/parent-registration';

const parent = () => ({
  id: 'parent-1', role: 'PARENT', activatedAt: new Date('2026-09-06'), mergedIntoUserId: null,
  firstName: 'Parent', lastName: 'Test', phone: '20 00 00 01', email: null,
  registrationCompletedAt: null,
  parentProfile: { id: 'profile-1', children: [
    { id: 'child-1', user: { firstName: 'A', lastName: 'Test' }, gradeLevel: 'PREMIERE', academicTrack: 'EDS_GENERALE', school: null, schoolingStatus: 'INDIVIDUAL' },
    { id: 'child-2', user: { firstName: 'B', lastName: 'Test' }, gradeLevel: 'SECONDE', academicTrack: 'EDS_GENERALE', school: 'École', schoolingStatus: 'SCHOOL_ENROLLED' },
  ] },
});
const payload = { revision: '', firstName: 'Parent', lastName: 'Test', children: [{ studentId: 'child-1', confirmed: true }, { studentId: 'child-2', confirmed: true }], consentStudentIds: [] };
function database(record: unknown = parent()) {
  const tx = { user: { findUnique: jest.fn().mockResolvedValue(record), updateMany: jest.fn().mockResolvedValue({ count: 1 }) }, parentStudentLink: { findMany: jest.fn().mockResolvedValue([]) } };
  return { ...tx, $transaction: jest.fn((action) => action(tx)) };
}

describe('parent registration', () => {
  beforeEach(async () => {
    jest.clearAllMocks();
    payload.revision = (await loadParentRegistration('parent-1', database() as never)).revision;
  });
  it('loads only the current parent projection without account secrets', async () => {
    const db = database();
    const result = await loadParentRegistration('parent-1', db as never);
    expect(result.children).toHaveLength(2);
    expect(result.children[0]).toMatchObject({ id: 'child-1', schoolingStatus: 'INDIVIDUAL' });
    expect(db.user.findUnique).toHaveBeenCalledWith(expect.objectContaining({ where: { id: 'parent-1' } }));
    expect(JSON.stringify(result)).not.toContain('password');
    expect(JSON.stringify(result)).not.toContain('activationToken');
  });
  it.each([null, { ...parent(), activatedAt: null }, { ...parent(), role: 'ELEVE' }, { ...parent(), mergedIntoUserId: 'other' }])('refuses missing, inactive or wrong identities', async (record) => {
    await expect(loadParentRegistration('parent-1', database(record) as never)).rejects.toMatchObject({ code: 'NOT_FOUND' });
  });
  it.each(['firstName', 'lastName', 'gradeLevel', 'school', 'schoolingStatus', 'academicTrack'])('rejects a changed displayed child %s before confirmation or consent', async field => {
    const record = parent();
    if (field === 'firstName' || field === 'lastName') record.parentProfile.children[0].user[field] = 'Changed';
    else (record.parentProfile.children[0] as Record<string, unknown>)[field] = 'Changed';
    const db = database(record);
    await expect(completeParentRegistration('parent-1', { ...payload, consentStudentIds: ['child-1'] }, db as never)).rejects.toMatchObject({ code: 'FAMILY_CHANGED' });
    expect(db.user.updateMany).not.toHaveBeenCalled();
    expect(createParentStudentConsentContext).not.toHaveBeenCalled();
  });
  it('requires the displayed revision', async () => {
    const missing: Record<string, unknown> = { ...payload };
    delete missing.revision;
    await expect(completeParentRegistration('parent-1', missing, database() as never)).rejects.toMatchObject({ code: 'INVALID_INPUT' });
  });
  it('returns a stable opaque revision independent of completion time and child ordering', async () => {
    const record = parent();
    record.parentProfile.children.reverse();
    const loaded = await loadParentRegistration('parent-1', database({ ...record, registrationCompletedAt: new Date() }) as never);
    expect(loaded.revision).toMatch(/^[a-f0-9]{64}$/);
    expect(loaded.revision).toBe(payload.revision);
  });
  it('rejects an unrelated child before any mutation or consent', async () => {
    const db = database();
    await expect(completeParentRegistration('parent-1', { ...payload, children: [{ studentId: 'other', confirmed: true }] }, db as never)).rejects.toMatchObject({ code: 'FAMILY_CHANGED' });
    expect(db.user.updateMany).not.toHaveBeenCalled();
    expect(createParentStudentConsentContext).not.toHaveBeenCalled();
  });
  it('requires the exact current family, including newly attached children', async () => {
    const db = database();
    await expect(completeParentRegistration('parent-1', { ...payload, children: [payload.children[0]] }, db as never)).rejects.toMatchObject({ code: 'FAMILY_CHANGED' });
    expect(db.user.updateMany).not.toHaveBeenCalled();
  });
  it('completes the dossier without implicitly granting a pedagogical consent', async () => {
    const db = database();
    await completeParentRegistration('parent-1', payload, db as never);
    expect(db.$transaction).toHaveBeenCalledWith(expect.any(Function), { isolationLevel: 'Serializable' });
    expect(db.user.updateMany).toHaveBeenCalledWith(expect.objectContaining({ data: { firstName: 'Parent', lastName: 'Test', registrationCompletedAt: expect.any(Date) } }));
    expect(createParentStudentConsentContext).not.toHaveBeenCalled();
  });
  it('verifies only the explicitly selected owned consent in the same transaction', async () => {
    const verify = jest.fn().mockResolvedValue({ state: 'VERIFIED' });
    (createParentStudentConsentContext as jest.Mock).mockReturnValue({ verify });
    await completeParentRegistration('parent-1', { ...payload, consentStudentIds: ['child-2'] }, database() as never);
    expect(verify).toHaveBeenCalledTimes(1);
    expect(verify).toHaveBeenCalledWith({ parentUserId: 'parent-1', studentId: 'child-2', now: expect.any(Date) });
  });
  it('refuses an unowned consent and leaves confirmation unchanged', async () => {
    const db = database();
    await expect(completeParentRegistration('parent-1', { ...payload, consentStudentIds: ['other'] }, db as never)).rejects.toMatchObject({ code: 'FAMILY_CHANGED' });
    expect(db.user.updateMany).not.toHaveBeenCalled();
  });
  it('rejects duplicate or unconfirmed children', async () => {
    for (const children of [[payload.children[0], payload.children[0]], [{ studentId: 'child-1', confirmed: false }]]) {
      const db = database();
      await expect(completeParentRegistration('parent-1', { ...payload, children }, db as never)).rejects.toBeDefined();
      expect(db.user.updateMany).not.toHaveBeenCalled();
    }
  });
});
