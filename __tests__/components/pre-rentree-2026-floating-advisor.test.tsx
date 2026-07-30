import { render, screen, waitFor } from '@testing-library/react';
import { FloatingAdvisorBubble } from '@/components/marketing/acadomia-inspired';
import { usePathname } from 'next/navigation';

jest.mock('next/navigation', () => ({
  usePathname: jest.fn(),
}));

const mockUsePathname = jest.mocked(usePathname);

class IntersectionObserverStub implements IntersectionObserver {
  readonly root = null;
  readonly rootMargin = '';
  readonly thresholds: readonly number[] = [];

  constructor(
    _callback: IntersectionObserverCallback,
    _options?: IntersectionObserverInit,
  ) {}

  disconnect(): void {}
  observe(): void {}
  takeRecords(): IntersectionObserverEntry[] { return []; }
  unobserve(): void {}
}

describe('FloatingAdvisorBubble on the Pré-rentrée campaign', () => {
  beforeEach(() => {
    mockUsePathname.mockReturnValue('/stages/pre-rentree-2026');
    window.IntersectionObserver = IntersectionObserverStub;
  });

  it('stays out of the DOM because the campaign already exposes contextual WhatsApp CTAs', async () => {
    render(<FloatingAdvisorBubble />);

    await waitFor(() => {
      expect(
        screen.queryByRole('link', { name: /Échangez avec un conseiller Nexus/i }),
      ).not.toBeInTheDocument();
    });
  });
});
