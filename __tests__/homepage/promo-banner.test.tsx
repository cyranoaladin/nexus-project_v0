import { act, fireEvent, render, screen } from '@testing-library/react';
import PromoBanner from '@/components/layout/PromoBanner';

describe('PromoBanner', () => {
  beforeEach(() => {
    jest.useFakeTimers();
  });

  afterEach(() => {
    act(() => {
      jest.runOnlyPendingTimers();
    });
    jest.useRealTimers();
  });

  it('renders both offer links on desktop', () => {
    Object.defineProperty(window, 'innerWidth', { writable: true, configurable: true, value: 1280 });

    render(<PromoBanner />);

    expect(screen.getByRole('link', { name: /réserver/i })).toHaveAttribute('href', '/stages');
    expect(screen.getByRole('link', { name: /essayer gratuitement/i })).toHaveAttribute(
      'href',
      'https://eaf.nexusreussite.academy'
    );
    expect(screen.getByText(/stages printemps/i)).toBeInTheDocument();
    expect(screen.getByText(/plateforme eaf/i)).toBeInTheDocument();
  });

  it('can be closed without leaving residual content', () => {
    render(<PromoBanner />);

    fireEvent.click(screen.getByRole('button', { name: /fermer le bandeau/i }));

    expect(screen.queryByText(/stages printemps/i)).not.toBeInTheDocument();
    expect(screen.queryByText(/plateforme eaf/i)).not.toBeInTheDocument();
  });

  it('rotates mobile messages automatically', () => {
    Object.defineProperty(window, 'innerWidth', { writable: true, configurable: true, value: 375 });

    render(<PromoBanner />);

    expect(screen.getByText(/stages printemps/i)).toBeInTheDocument();

    act(() => {
      jest.advanceTimersByTime(4000);
    });

    expect(screen.getByText(/plateforme eaf/i)).toBeInTheDocument();
    expect(screen.getByRole('link', { name: /essayer/i })).toHaveAttribute(
      'href',
      'https://eaf.nexusreussite.academy'
    );
  });
});
