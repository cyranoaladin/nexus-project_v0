import { render, screen, waitFor } from '@testing-library/react';
import { AriaBilansCard } from '@/components/dashboard/parent/AriaBilansCard';

function mockFetch(body: unknown, ok = true) {
  return jest.spyOn(global, 'fetch').mockResolvedValue({ ok, json: async () => body } as Response);
}

describe('AriaBilansCard', () => {
  afterEach(() => jest.restoreAllMocks());

  it('renders nothing when the child has no published ARIA periodic bilan', async () => {
    mockFetch({ bilans: [] });
    const { container } = render(<AriaBilansCard studentId="student-1" />);
    await waitFor(() => expect(container.querySelector('[data-testid]')).toBeNull());
  });

  it('shows a real published bilan as a link to its real detail page', async () => {
    mockFetch({
      bilans: [
        { id: 'bilan-1', subject: 'MATHEMATIQUES', globalScore: 80, publishedAt: '2026-09-12T00:00:00.000Z' },
      ],
    });
    render(<AriaBilansCard studentId="student-1" />);
    await waitFor(() => expect(screen.getByTestId('aria-bilans-card')).toBeInTheDocument());
    const link = screen.getByTestId('aria-bilan-card-item');
    expect(link.tagName).toBe('A');
    expect(link).toHaveAttribute('href', '/dashboard/parent/bilans/bilan-1');
    expect(screen.getByText('80/100')).toBeInTheDocument();
  });

  it('never blocks or breaks when the fetch fails', async () => {
    jest.spyOn(global, 'fetch').mockRejectedValue(new Error('network down'));
    const { container } = render(<AriaBilansCard studentId="student-1" />);
    await waitFor(() => expect(container.querySelector('[data-testid]')).toBeNull());
  });
});
