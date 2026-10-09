import '@testing-library/jest-dom';
import { render, screen, cleanup, waitFor } from '@testing-library/react';
import React from 'react';
import AvailabilityPage from '@/app/dashboard/coach/availability/page';
import SessionsPage from '@/app/dashboard/coach/sessions/page';
import StudentsPage from '@/app/dashboard/coach/students/page';

const mockSession = { data: { user: { id: 'coach', role: 'COACH', authority: 'CORE_V2' as string | undefined } }, status: 'authenticated' };
const mockPush = jest.fn();
const mockRouter = { push: mockPush };
const mockFetch = jest.fn();
jest.mock('@/components/auth/SessionRecoveryProvider', () => ({ useCanonicalSession: () => mockSession, useProtectedFetch: () => mockFetch }));
jest.mock('next/navigation', () => ({ useRouter: () => mockRouter }));
jest.mock('@/components/ui/coach-availability', () => ({ __esModule: true, default: () => <div>Legacy availability editor</div> }));
jest.mock('@/components/ui/session-report-dialog', () => ({ SessionReportDialog: () => null }));

afterEach(cleanup);
beforeEach(() => {
  jest.clearAllMocks();
  mockFetch.mockResolvedValue({ ok: true, json: async () => ({ todaySessions: [], weekSessions: [], students: [] }) });
});

it.each([AvailabilityPage, SessionsPage, StudentsPage])('refuses direct legacy page access for a Core coach (%p)', Page => {
  mockSession.data.user.authority = 'CORE_V2';
  render(<Page />);
  expect(mockPush).toHaveBeenCalledWith('/dashboard/coach');
  expect(mockFetch).not.toHaveBeenCalled();
  expect(screen.queryByText('Legacy availability editor')).not.toBeInTheDocument();
});

it.each([AvailabilityPage, SessionsPage, StudentsPage])('refuses a session without authority (%p)', Page => {
  mockSession.data.user.authority = undefined;
  render(<Page />);
  expect(mockPush).toHaveBeenCalledWith('/dashboard/coach');
  expect(mockFetch).not.toHaveBeenCalled();
  expect(screen.queryByText('Legacy availability editor')).not.toBeInTheDocument();
});

it.each([[AvailabilityPage, 'Mes Disponibilités'], [SessionsPage, 'Mes Sessions'], [StudentsPage, 'Mes Étudiants']] as const)('retains the V1 page (%s)', async (Page, heading) => {
  mockSession.data.user.authority = 'V1';
  render(<Page />);
  await waitFor(() => expect(screen.getByRole('heading', { name: heading })).toBeInTheDocument());
  expect(mockPush).not.toHaveBeenCalled();
});
