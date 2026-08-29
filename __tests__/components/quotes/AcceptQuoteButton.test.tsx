import { fireEvent, render, screen, waitFor } from '@testing-library/react';
import { AcceptQuoteButton } from '@/components/quotes/AcceptQuoteButton';

describe('AcceptQuoteButton token-only boundary', () => {
  test('derives the token endpoint from the existing family URL without receiving an id or token prop', async () => {
    const token = ['family', 'button', 'sentinel'].join('-');
    window.location.pathname = `/devis/${token}`;
    const fetchMock = jest.fn().mockResolvedValue({ ok: true });
    global.fetch = fetchMock;
    window.fetch = fetchMock;
    expect(window.location.pathname).toBe(`/devis/${token}`);

    const view = render(<AcceptQuoteButton />);
    fireEvent.click(screen.getByRole('button', { name: /J'accepte ce devis/i }));

    await waitFor(() => expect(fetchMock).toHaveBeenCalledWith(
      `/api/quotes/public/${token}/accept`,
      { method: 'POST' },
    ));
    expect(view.container.textContent).not.toContain(token);
    expect(await screen.findByText(/Devis accepté/)).toBeInTheDocument();
  });
});
