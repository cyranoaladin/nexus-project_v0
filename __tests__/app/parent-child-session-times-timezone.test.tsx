import '@testing-library/jest-dom';
import { render, screen } from '@testing-library/react';
import React from 'react';

// `scheduledAt`/`endAt` on a child's `sessions` are built server-side by
// `combineDateAndTime()` (lib/planning/invariants.ts): a documented
// "pseudo-UTC" encoding where the Tunis wall-clock hour/minute are written
// directly into the UTC accessors of the ISO string. Rendering that string
// with the *browser's real* local timezone (the default behaviour of
// `toLocaleTimeString` without an explicit `timeZone`) silently shifts the
// displayed time whenever the browser's real offset isn't zero — which is
// every real Tunis-based parent. This test pins the JS runtime timezone to
// Africa/Tunis (the real device timezone of the affected users) to make
// that shift observable, independent of whatever timezone the CI/dev
// machine actually runs in.
jest.mock('next-auth/react', () => ({
  useSession: () => ({ status: 'authenticated' }),
}));

const mockPush = jest.fn();
jest.mock('next/navigation', () => ({
  useParams: () => ({ studentId: 'student-1' }),
  useRouter: () => ({ push: mockPush }),
}));

jest.mock('@/app/dashboard/parent/enfant/[studentId]/canonical-consent-card', () => ({
  CanonicalConsentCard: () => null,
}));
jest.mock('@/components/bilans/ParentCanonicalReports', () => ({
  ParentCanonicalReports: () => null,
}));
jest.mock('@/components/dashboard/parent/ProgressEvolutionChart', () => ({
  ProgressEvolutionChart: () => null,
}));
jest.mock('@/components/dashboard/DashboardPilotage', () => ({
  DashboardPilotage: ({ children }: { children: React.ReactNode }) => <>{children}</>,
}));

import ChildDetailPage from '@/app/dashboard/parent/enfant/[studentId]/page';

describe('Parent child detail page — session time rendering across real device timezones', () => {
  const originalTz = process.env.TZ;

  afterEach(() => {
    if (originalTz === undefined) delete process.env.TZ;
    else process.env.TZ = originalTz;
    jest.restoreAllMocks();
  });

  it('shows the encoded Tunis wall-clock time, not a browser-timezone-shifted one, on a device set to Africa/Tunis', async () => {
    process.env.TZ = 'Africa/Tunis';

    global.fetch = jest.fn().mockResolvedValue({
      ok: true,
      json: async () => ({
        children: [
          {
            id: 'student-1',
            firstName: 'Léa',
            lastName: 'Test',
            email: 'lea@example.test',
            gradeLevel: 'Terminale',
            academicTrack: 'GENERAL',
            activationStatus: 'ACTIVE',
            activationExpiresAt: null,
            sessions: [
              {
                id: 'session-1',
                subject: 'MATHEMATIQUES',
                courseLabel: 'Mathématiques',
                // Pseudo-UTC encoding of 14:30-16:00 Tunis wall-clock time.
                scheduledAt: '2026-09-10T14:30:00.000Z',
                endAt: '2026-09-10T16:00:00.000Z',
                coachName: 'M. Coach',
                modality: 'ONLINE',
                status: 'SCHEDULED',
              },
            ],
          },
        ],
      }),
    }) as unknown as typeof fetch;

    render(<ChildDetailPage />);

    const sessionTime = await screen.findByText(/14:30\s*–\s*16:00/);
    expect(sessionTime).toBeInTheDocument();
    expect(screen.queryByText(/15:30/)).not.toBeInTheDocument();
    expect(screen.queryByText(/17:00/)).not.toBeInTheDocument();
  });
});
