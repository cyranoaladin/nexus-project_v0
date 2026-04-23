/**
 * F53: Legacy Stage Bilan Migration Tests — Preuve minimale
 * Vérifie la redirection legacy → nouvelle surface
 */

import { redirect } from 'next/navigation';

// Mock next/navigation
jest.mock('next/navigation', () => ({
  redirect: jest.fn(),
  notFound: jest.fn(),
}));

// Mock prisma
const mockFindUnique = jest.fn();
jest.mock('@/lib/prisma', () => ({
  prisma: {
    stageReservation: {
      findUnique: mockFindUnique,
    },
  },
}));

describe('F53: Legacy stage bilan migration', () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  it('should redirect to new surface when stage.slug !== fevrier-2026', async () => {
    // Simulate reservation with different stage slug
    mockFindUnique.mockResolvedValue({
      id: 'res-123',
      stage: { slug: 'mars-2026' },
      scoringResult: { globalScore: 75 },
    });

    // Import and call the page component logic
    const { default: BilanPage } = await import('@/app/stages/fevrier-2026/bilan/[reservationId]/page');
    
    const params = Promise.resolve({ reservationId: 'res-123' });
    
    try {
      await BilanPage({ params });
    } catch {
      // redirect() throws in Next.js
    }

    expect(redirect).toHaveBeenCalledWith('/stages/mars-2026/bilan/res-123');
  });

  it('should stay on legacy surface when stage.slug is fevrier-2026', async () => {
    mockFindUnique.mockResolvedValue({
      id: 'res-456',
      stage: { slug: 'fevrier-2026' },
      scoringResult: { globalScore: 80 },
      parentName: 'Parent Test',
      studentName: 'Student Test',
      email: 'test@example.com',
      academyTitle: 'Test Academy',
      status: 'CONFIRMED',
      createdAt: new Date('2026-01-01'),
    });

    const { default: BilanPage } = await import('@/app/stages/fevrier-2026/bilan/[reservationId]/page');
    
    const params = Promise.resolve({ reservationId: 'res-456' });
    
    // Should not redirect, should render
    const result = await BilanPage({ params });
    
    // Should not have been called with redirection URL
    const redirectCalls = (redirect as jest.Mock).mock.calls;
    const hasLegacyRedirect = redirectCalls.some(
      call => call[0]?.includes && call[0].includes('fevrier-2026')
    );
    expect(hasLegacyRedirect).toBe(false);
  });

  it('should handle missing reservation with notFound', async () => {
    mockFindUnique.mockResolvedValue(null);

    const { notFound } = await import('next/navigation');
    const { default: BilanPage } = await import('@/app/stages/fevrier-2026/bilan/[reservationId]/page');
    
    const params = Promise.resolve({ reservationId: 'nonexistent' });
    
    try {
      await BilanPage({ params });
    } catch {
      // May throw
    }

    expect(notFound).toHaveBeenCalled();
  });

  it('should redirect to diagnostic when no scoringResult', async () => {
    mockFindUnique.mockResolvedValue({
      id: 'res-789',
      stage: { slug: 'fevrier-2026' },
      scoringResult: null,
      email: 'test@example.com',
    });

    const { default: BilanPage } = await import('@/app/stages/fevrier-2026/bilan/[reservationId]/page');
    
    const params = Promise.resolve({ reservationId: 'res-789' });
    
    try {
      await BilanPage({ params });
    } catch {
      // redirect throws
    }

    expect(redirect).toHaveBeenCalledWith(
      expect.stringContaining('/stages/fevrier-2026/diagnostic')
    );
  });
});
