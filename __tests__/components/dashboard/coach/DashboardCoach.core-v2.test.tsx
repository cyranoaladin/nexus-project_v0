import '@testing-library/jest-dom';
import { render, screen } from '@testing-library/react';
import React from 'react';

const sessionState: { data: unknown; status: string } = { data: null, status: 'loading' };

jest.mock('next-auth/react', () => ({ signOut: jest.fn(), useSession: () => sessionState }));
jest.mock('next/navigation', () => {
  const router = { push: jest.fn() };
  return { useRouter: () => router };
});
jest.mock('@/components/dashboard/core-v2/CoachAssignments', () => ({ CoachAssignments: () => <section>Mes affectations (Core v2)</section> }));
jest.mock('@/components/ui/coach-availability', () => ({ __esModule: true, default: () => null }));

import DashboardCoach from '@/app/dashboard/coach/page';

const v1Payload = { coach: { pseudonym: 'Helios' }, students: [], alerts: [], uniqueStudentsCount: 0, todaySessions: [] };

describe('DashboardCoach — Core v2 assignments panel (§AJ)', () => {
  beforeEach(() => {
    global.fetch = jest.fn(async (input: RequestInfo | URL) => {
      const url = String(input);
      if (url === '/api/coach/dashboard') return { ok: true, status: 200, json: async () => v1Payload } as unknown as Response;
      return { ok: true, status: 200, json: async () => ({ data: [] }) } as unknown as Response;
    }) as unknown as typeof fetch;
  });

  it('a CORE_V2 coach sees the Core v2 assignments panel in addition to the Core v1 pilotage', async () => {
    sessionState.data = { user: { id: 'c-v2', role: 'COACH', authority: 'CORE_V2' } };
    sessionState.status = 'authenticated';
    render(<DashboardCoach />);
    expect(await screen.findByText('Mes affectations (Core v2)')).toBeInTheDocument();
    expect(screen.getByText(/Coach — Helios/)).toBeInTheDocument();
  });

  it('a V1 coach sees no Core v2 panel', async () => {
    sessionState.data = { user: { id: 'c-v1', role: 'COACH', authority: 'V1' } };
    sessionState.status = 'authenticated';
    render(<DashboardCoach />);
    expect(await screen.findByText(/Coach — Helios/)).toBeInTheDocument();
    expect(screen.queryByText('Mes affectations (Core v2)')).not.toBeInTheDocument();
  });
});
