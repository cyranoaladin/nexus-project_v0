import { fireEvent, render, screen, waitFor } from '@testing-library/react';
import { HouseholdDetail } from '@/components/dashboard/core-v2/HouseholdDetail';
const mockV2 = jest.fn();
const mockCan = jest.fn();
jest.mock('@/components/dashboard/core-v2/useStaffActor', () => ({
  useStaffActor: () => ({ loading: false, can: (capability: string) => mockCan(capability) }),
}));
jest.mock('@/components/dashboard/core-v2/api', () => ({
  ...jest.requireActual('@/components/dashboard/core-v2/api'),
  v2: (...args: unknown[]) => mockV2(...args),
}));
const parent = {
  id: 'synthetic-parent', role: 'PARENT', accountStatus: 'ACTIVE', firstName: 'Parent', lastName: 'Synthétique',
  email: 'parent@example.test', phone: null, activatedAt: null, createdAt: '2026-09-01', updatedAt: '2026-09-01',
  isPrimaryContact: false, verificationStatus: 'PENDING', membershipRevision: 0,
};
beforeEach(() => {
  jest.clearAllMocks();
  mockCan.mockImplementation((capability: string) => capability !== 'INVITATION_SCOPE_MANAGE');
  mockV2.mockImplementation(async (path: string) => {
    if (path === '/staff/households/synthetic-household') return { ok: true, data: { id: 'synthetic-household', createdAt: '2026-09-01', parents: [parent], students: [] } };
    if (path === '/staff/academic-years') return { ok: true, data: [] };
    if (path.startsWith('/staff/coaches')) return { ok: true, data: { items: [], nextCursor: null } };
    return { ok: true, data: {} };
  });
});

const assignmentsPath = '/staff/households/synthetic-household/invitation-scopes';
const assignments = {
  householdId: 'synthetic-household',
  assistants: [{ id: 'synthetic-assistant', firstName: 'Assistante', lastName: 'Synthétique', accountStatus: 'ACTIVE' }],
  years: [{ id: 'synthetic-year', startYear: 2026, status: 'CURRENT' }],
  grants: [],
};
function adminAssignments(responses: unknown[]) {
  mockCan.mockReturnValue(true);
  const base = mockV2.getMockImplementation()!;
  mockV2.mockImplementation(async (path: string, init?: unknown) => {
    if (path === assignmentsPath) return responses.shift();
    return base(path, init);
  });
}

test('an initial assignment failure ends loading and allows an explicit retry', async () => {
  adminAssignments([
    { ok: false, status: 503, code: 'CORE_V2_UNAVAILABLE', message: 'Unavailable' },
    { ok: true, data: assignments },
  ]);
  render(<HouseholdDetail householdId="synthetic-household" basePath="/dashboard/admin/familles" />);
  expect(await screen.findByRole('alert')).toHaveTextContent('Le référentiel Core v2');
  expect(screen.queryByText('Chargement des affectations…')).not.toBeInTheDocument();
  fireEvent.click(screen.getByRole('button', { name: 'Actualiser les affectations' }));
  expect(await screen.findByLabelText('Assistante')).toBeInTheDocument();
  expect(screen.queryByRole('alert')).not.toBeInTheDocument();
});

test.each([{}, { ...assignments, householdId: 'another-household' }])('malformed or foreign assignment success is rejected without enabling a mutation', async payload => {
  adminAssignments([{ ok: true, data: payload }]);
  render(<HouseholdDetail householdId="synthetic-household" basePath="/dashboard/admin/familles" />);
  expect(await screen.findByRole('alert')).toHaveTextContent('Réponse des affectations invalide.');
  expect(screen.queryByText('Chargement des affectations…')).not.toBeInTheDocument();
  expect(screen.queryByRole('button', { name: 'Affecter' })).not.toBeInTheDocument();
  expect(mockV2.mock.calls.every(([, init]) => !init || init.method !== 'PUT')).toBe(true);
});

test('a conflicting assignment uses the displayed revision and refetches without retrying the mutation', async () => {
  adminAssignments([
    { ok: true, data: assignments },
    { ok: false, status: 409, code: 'CONFLICT', message: 'Affectation modifiée.' },
    { ok: true, data: { ...assignments, grants: [{ staffUserId: 'synthetic-assistant', academicYearId: 'synthetic-year', revision: 2, revokedAt: null }] } },
  ]);
  render(<HouseholdDetail householdId="synthetic-household" basePath="/dashboard/admin/familles" />);
  fireEvent.change(await screen.findByLabelText('Assistante'), { target: { value: 'synthetic-assistant' } });
  fireEvent.change(screen.getByLabelText('Année scolaire'), { target: { value: 'synthetic-year' } });
  fireEvent.click(screen.getByRole('button', { name: 'Affecter' }));
  expect(await screen.findByRole('alert')).toHaveTextContent('Affectation modifiée.');
  await screen.findByRole('button', { name: 'Retirer l’affectation' });
  expect(mockV2.mock.calls.filter(([, init]) => init?.method === 'PUT')).toEqual([
    [assignmentsPath, { method: 'PUT', json: { staffUserId: 'synthetic-assistant', academicYearId: 'synthetic-year', expectedRevision: 0, active: true } }],
  ]);
  expect(screen.getByRole('button', { name: 'Affecter' })).toBeDisabled();
});

test('staff can explicitly verify a pending membership only after evidence and confirmation', async () => {
  render(<HouseholdDetail householdId="synthetic-household" basePath="/dashboard/admin/familles" />);
  fireEvent.click(await screen.findByRole('button', { name: 'Vérifier le rattachement' }));
  const submit = screen.getByRole('button', { name: 'Confirmer la vérification' });
  expect(submit).toBeDisabled();
  fireEvent.change(screen.getByLabelText('Empreinte du justificatif'), { target: { value: 'a'.repeat(64) } });
  expect(submit).toBeDisabled();
  fireEvent.click(screen.getByLabelText('Je confirme avoir vérifié le rattachement de ce parent à ce foyer.'));
  expect(submit).toBeEnabled();
  fireEvent.click(submit);
  await waitFor(() => expect(mockV2).toHaveBeenCalledWith(
    '/staff/households/synthetic-household/parents/synthetic-parent/verify',
    { method: 'POST', json: { expectedRevision: 0, evidenceDigest: 'a'.repeat(64) } },
  ));
});
