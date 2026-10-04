import { fireEvent, render, screen, waitFor } from '@testing-library/react';
import { HouseholdDetail } from '@/components/dashboard/core-v2/HouseholdDetail';
const mockV2 = jest.fn();
jest.mock('@/components/dashboard/core-v2/useStaffActor', () => ({
  useStaffActor: () => ({ loading: false, can: () => true }),
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
  mockV2.mockImplementation(async (path: string) => {
    if (path === '/staff/households/synthetic-household') return { ok: true, data: { id: 'synthetic-household', createdAt: '2026-09-01', parents: [parent], students: [] } };
    if (path === '/staff/academic-years') return { ok: true, data: [] };
    if (path.startsWith('/staff/coaches')) return { ok: true, data: { items: [], nextCursor: null } };
    return { ok: true, data: {} };
  });
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
