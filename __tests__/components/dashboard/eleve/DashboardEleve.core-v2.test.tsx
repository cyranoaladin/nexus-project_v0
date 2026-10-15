import '@testing-library/jest-dom';
import { render, screen } from '@testing-library/react';
import React from 'react';

const sessionState: { data: unknown; status: string } = { data: null, status: 'loading' };

jest.mock('next-auth/react', () => ({ signOut: jest.fn(), useSession: () => sessionState }));
jest.mock('next/navigation', () => {
  const router = { push: jest.fn() };
  return { useRouter: () => router, useSearchParams: () => new URLSearchParams() };
});
jest.mock('@/components/aria/AriaChatLauncher', () => ({ AriaChatLauncher: () => null }));
// Pulls @react-pdf (ESM) at import time; irrelevant to the authority branch under test.
jest.mock('@/components/dashboard/eleve/BilanDiagMathsTerminale', () => ({ BilanDiagMathsTerminale: () => null }));
jest.mock('@/components/dashboard/core-v2/StudentEnrollments', () => ({ StudentEnrollments: () => <h1>Mon parcours (Core v2)</h1> }));

import DashboardEleve from '@/app/dashboard/eleve/page';

describe('DashboardEleve — authority routing (§AI)', () => {
  beforeEach(() => {
    global.fetch = jest.fn(async (input) => ({ ok: String(input) === '/api/v2/self/membership', status: String(input) === '/api/v2/self/membership' ? 200 : 500, json: async () => String(input) === '/api/v2/self/membership' ? { ok: true, data: { state: (sessionState.data as { user: { id: string } }).user.id === 's-v2' ? 'ACTIVE' : 'NOT_MEMBER', ...((sessionState.data as { user: { id: string } }).user.id === 's-v2' ? { role: 'ELEVE' } : {}) } } : {} }) as unknown as Response) as unknown as typeof fetch;
  });

  it('a V1-authenticated Core student gets the Core v2 view and the Core v1 student API is never called', async () => {
    sessionState.data = { user: { id: 's-v2', role: 'ELEVE', authority: 'V1', firstName: 'Yasmine', lastName: 'Synthetic' } };
    sessionState.status = 'authenticated';
    render(<DashboardEleve />);
    expect(await screen.findByRole('heading', { name: 'Mon parcours (Core v2)' })).toBeInTheDocument();
    expect(screen.queryByText('Espace Élève')).not.toBeInTheDocument();
    expect(jest.mocked(global.fetch).mock.calls.map(([url]) => String(url))).toEqual(['/api/v2/self/membership']);
  });

  it('a V1 student still goes through the Core v1 dashboard API', async () => {
    sessionState.data = { user: { id: 's-v1', role: 'ELEVE', authority: 'V1', firstName: 'Karim', lastName: 'Test' } };
    sessionState.status = 'authenticated';
    render(<DashboardEleve />);
    expect(await screen.findByText('Erreur lors du chargement')).toBeInTheDocument();
    expect(global.fetch).toHaveBeenCalledWith('/api/student/dashboard');
    expect(screen.queryByText('Mon parcours (Core v2)')).not.toBeInTheDocument();
  });
});
