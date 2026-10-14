import '@testing-library/jest-dom';
import { render, screen } from '@testing-library/react';
jest.mock('@/hooks/use-core-membership', () => ({ useCoreMembership: jest.fn() }));
jest.mock('@/components/auth/SessionRecoveryProvider', () => ({ useCanonicalSession: () => ({ data: { user: { id: 'v1-id', role: 'COACH', authority: 'V1' } }, status: 'authenticated' }) }));
let search = new URLSearchParams();
jest.mock('next/navigation', () => ({ useSearchParams: () => search }));
import { useCoreMembership } from '@/hooks/use-core-membership';
import { CoreRoleHome } from '@/components/dashboard/core-v2/CoreRoleHome';
const metadata = jest.mocked(useCoreMembership);
const renderHome = () => render(<CoreRoleHome role="COACH" legacy={<p>Parcours V1</p>}><p>Affectations Core</p></CoreRoleHome>);
beforeEach(() => { search = new URLSearchParams(); });
test('an active V1-authenticated Core coach sees Core resources and an explicit V1 link', () => {
  metadata.mockReturnValue({ state: 'ACTIVE', role: 'COACH', retry: jest.fn() }); renderHome();
  expect(screen.getByText('Affectations Core')).toBeInTheDocument();
  expect(screen.queryByText('Parcours V1')).not.toBeInTheDocument();
  expect(screen.getByRole('link', { name: 'Accéder à mon espace V1' })).toHaveAttribute('href', '/dashboard/coach?surface=v1');
});
test.each(['INACTIVE', 'UNAVAILABLE'] as const)('state %s unmounts Core resources and keeps explicit V1 navigation', state => {
  metadata.mockReturnValue({ state, retry: jest.fn() }); renderHome();
  expect(screen.queryByText('Affectations Core')).not.toBeInTheDocument();
  expect(screen.queryByText('Parcours V1')).not.toBeInTheDocument();
  expect(screen.getByRole('link', { name: 'Accéder à mon espace V1' })).toHaveAttribute('href', '/dashboard/coach?surface=v1');
});
test.each(['NOT_MEMBER', 'NOT_ENABLED'] as const)('state %s keeps the existing V1 page', state => {
  metadata.mockReturnValue({ state, retry: jest.fn() }); renderHome();
  expect(screen.getByText('Parcours V1')).toBeInTheDocument();
  expect(screen.queryByText('Affectations Core')).not.toBeInTheDocument();
});
test('an explicit V1 choice remains available during a Core outage', () => {
  search = new URLSearchParams('surface=v1');
  metadata.mockReturnValue({ state: 'UNAVAILABLE', retry: jest.fn() }); renderHome();
  expect(screen.getByText('Parcours V1')).toBeInTheDocument();
});
test('a promoted Core ADMIN enters the separate Core workspace without impersonating a V1 ADMIN', () => {
  metadata.mockReturnValue({ state: 'ACTIVE', role: 'ADMIN', retry: jest.fn() }); renderHome();
  expect(screen.queryByText('Affectations Core')).not.toBeInTheDocument();
  expect(screen.getByRole('link', { name: 'Ouvrir mon espace académique' })).toHaveAttribute('href', '/dashboard/core');
  expect(screen.queryByRole('link', { name: /ADMIN V1/ })).not.toBeInTheDocument();
});
