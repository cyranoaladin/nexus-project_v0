import '@testing-library/jest-dom';
import { render, screen } from '@testing-library/react';
import React from 'react';

const sessionState: { data: unknown; status: string } = { data: null, status: 'loading' };

jest.mock('next-auth/react', () => ({
  signOut: jest.fn(),
  useSession: () => sessionState,
}));

jest.mock('next/navigation', () => {
  const router = { push: jest.fn() };
  return { useRouter: () => router };
});

jest.mock('@/components/dashboard/BilanGratuitBanner', () => ({ BilanGratuitBanner: () => <div>Bannière bilan</div> }));
jest.mock('@/app/dashboard/parent/add-child-dialog', () => ({ __esModule: true, default: () => null }));
jest.mock('@/components/dashboard/core-v2/ParentHousehold', () => ({ ParentHousehold: () => <h1>Mon foyer (Core v2)</h1> }));

import DashboardParent from '@/app/dashboard/parent/page';

describe('DashboardParent — authority routing (§AH)', () => {
  beforeEach(() => {
    global.fetch = jest.fn(async () => ({ ok: true, json: async () => ({ children: [] }) }) as unknown as Response) as unknown as typeof fetch;
  });

  it('a CORE_V2 parent gets the Core v2 household view and the Core v1 dashboard API is never called', async () => {
    sessionState.data = { user: { id: 'p-v2', role: 'PARENT', authority: 'CORE_V2', firstName: 'Amel', lastName: 'Synthetic' } };
    sessionState.status = 'authenticated';
    render(<DashboardParent />);
    expect(await screen.findByRole('heading', { name: 'Mon foyer (Core v2)' })).toBeInTheDocument();
    expect(screen.queryByText('Espace Famille')).not.toBeInTheDocument();
    expect(global.fetch).not.toHaveBeenCalled();
  });

  it('a V1 parent keeps the Core v1 dashboard', async () => {
    sessionState.data = { user: { id: 'p-v1', role: 'PARENT', authority: 'V1', firstName: 'Parent', lastName: 'Test' } };
    sessionState.status = 'authenticated';
    render(<DashboardParent />);
    expect(await screen.findByText('Espace Famille')).toBeInTheDocument();
    expect(global.fetch).toHaveBeenCalledWith('/api/parent/dashboard');
    expect(screen.queryByText('Mon foyer (Core v2)')).not.toBeInTheDocument();
  });
});
