import '@testing-library/jest-dom';
import { render, screen } from '@testing-library/react';
jest.mock('@/hooks/use-core-membership', () => ({ useCoreMembership: jest.fn() }));
jest.mock('@/components/auth/SessionRecoveryProvider', () => ({ useCanonicalSession: () => ({ data: { user: { id: 'core-user-id', role: 'COACH', authority: 'V1' } }, status: 'authenticated' }) }));
jest.mock('@/components/dashboard/core-v2/ParentHousehold', () => ({ ParentHousehold: () => <p>Foyer propre</p> }));
jest.mock('@/components/dashboard/core-v2/StudentEnrollments', () => ({ StudentEnrollments: () => <p>Inscriptions propres</p> }));
jest.mock('@/components/dashboard/core-v2/CoachAssignments', () => ({ CoachAssignments: () => <p>Affectations propres</p> }));
jest.mock('@/components/dashboard/core-v2/HouseholdsWorkspace', () => ({ HouseholdsWorkspace: ({ basePath }: { basePath: string }) => <p>{basePath}</p> }));
jest.mock('@/components/dashboard/core-v2/HouseholdDetail', () => ({ HouseholdDetail: () => <p>Dossier famille</p> }));
jest.mock('@/components/dashboard/core-v2/AcademicYearsPanel', () => ({ AcademicYearsPanel: () => <p>Années scolaires</p> }));
jest.mock('@/components/dashboard/core-v2/PlanningWeek', () => ({ PlanningWeek: () => <p>Planning</p> }));
jest.mock('@/components/dashboard/core-v2/PilotageWorkspace', () => ({ PilotageWorkspace: () => <p>Suivi et habilitations</p> }));
jest.mock('@/components/dashboard/core-v2/DiagnosticsQueueWorkspace', () => ({ DiagnosticsQueueWorkspace: () => <p>File bilans</p> }));
jest.mock('@/components/dashboard/core-v2/DiagnosticBilanReview', () => ({ DiagnosticBilanReview: () => <p>Revue bilan</p> }));
import { useCoreMembership } from '@/hooks/use-core-membership';
import { CoreWorkspace } from '@/components/dashboard/core-v2/CoreWorkspace';
const metadata = jest.mocked(useCoreMembership);
test('Core ADMIN navigation is independent of the unchanged V1 COACH role', () => {
  metadata.mockReturnValue({ state: 'ACTIVE', role: 'ADMIN', retry: jest.fn() });
  render(<CoreWorkspace view={[]} organizationTimezone="Africa/Tunis" />);
  expect(screen.getByRole('link', { name: 'Familles' })).toHaveAttribute('href', '/dashboard/core/familles');
  expect(screen.getByRole('link', { name: 'Accéder à mon espace V1' })).toHaveAttribute('href', '/dashboard/coach?surface=v1');
});
test.each([['PARENT', 'Foyer propre'], ['ELEVE', 'Inscriptions propres'], ['COACH', 'Affectations propres']] as const)('%s receives only its own resource view', (role, text) => {
  metadata.mockReturnValue({ state: 'ACTIVE', role, retry: jest.fn() });
  render(<CoreWorkspace view={[]} organizationTimezone="Africa/Tunis" />);
  expect(screen.getByText(text)).toBeInTheDocument();
  expect(screen.queryByRole('link', { name: 'Familles' })).not.toBeInTheDocument();
});
test.each(['INACTIVE', 'UNAVAILABLE', 'NOT_MEMBER', 'NOT_ENABLED'] as const)('%s never mounts a staff panel', state => {
  metadata.mockReturnValue({ state, retry: jest.fn() });
  render(<CoreWorkspace view={['familles']} organizationTimezone="Africa/Tunis" />);
  expect(screen.queryByText('/dashboard/core/familles')).not.toBeInTheDocument();
  expect(screen.getByRole('link', { name: 'Accéder à mon espace V1' })).toBeInTheDocument();
});
test('loss of membership unmounts the previously active panel', () => {
  metadata.mockReturnValue({ state: 'ACTIVE', role: 'ADMIN', retry: jest.fn() });
  const { rerender } = render(<CoreWorkspace view={['familles']} organizationTimezone="Africa/Tunis" />);
  expect(screen.getByText('/dashboard/core/familles')).toBeInTheDocument();
  metadata.mockReturnValue({ state: 'INACTIVE', retry: jest.fn() });
  rerender(<CoreWorkspace view={['familles']} organizationTimezone="Africa/Tunis" />);
  expect(screen.queryByText('/dashboard/core/familles')).not.toBeInTheDocument();
});
