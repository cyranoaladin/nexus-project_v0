import { ErrorBoundary } from '@/components/error-boundary';
import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import '@testing-library/jest-dom';
import React from 'react';

const ThrowError = ({ shouldThrow }: { shouldThrow: boolean }) => {
  if (shouldThrow) {
    throw new Error('Test error message');
  }
  return <div>Child component</div>;
};

describe('ErrorBoundary', () => {
  const originalEnv = process.env.NODE_ENV;
  let consoleErrorSpy: jest.SpyInstance;

  beforeEach(() => {
    consoleErrorSpy = jest.spyOn(console, 'error').mockImplementation(() => {});
  });

  afterEach(() => {
    consoleErrorSpy.mockRestore();
    process.env.NODE_ENV = originalEnv;
  });

  describe('Error Catching', () => {
    it('catches component errors and displays fallback UI', () => {
      render(
        <ErrorBoundary>
          <ThrowError shouldThrow={true} />
        </ErrorBoundary>
      );

      expect(screen.getByText(/Oups ! Une erreur s'est produite/i)).toBeInTheDocument();
      expect(screen.queryByText('Child component')).not.toBeInTheDocument();
    });

    it('renders children when no error occurs', () => {
      render(
        <ErrorBoundary>
          <ThrowError shouldThrow={false} />
        </ErrorBoundary>
      );

      expect(screen.getByText('Child component')).toBeInTheDocument();
      expect(screen.queryByText(/Oups ! Une erreur s'est produite/i)).not.toBeInTheDocument();
    });

    it('uses custom fallback when provided', () => {
      const customFallback = <div>Custom Error Message</div>;

      render(
        <ErrorBoundary fallback={customFallback}>
          <ThrowError shouldThrow={true} />
        </ErrorBoundary>
      );

      expect(screen.getByText('Custom Error Message')).toBeInTheDocument();
      expect(screen.queryByText(/Oups ! Une erreur s'est produite/i)).not.toBeInTheDocument();
    });
  });

  describe('Fallback UI', () => {
    it('renders all required UI elements', () => {
      render(
        <ErrorBoundary>
          <ThrowError shouldThrow={true} />
        </ErrorBoundary>
      );

      expect(screen.getByText(/Oups ! Une erreur s'est produite/i)).toBeInTheDocument();
      expect(screen.getByText(/Quelque chose s'est mal passé/i)).toBeInTheDocument();
      expect(screen.getByText('Recharger la page')).toBeInTheDocument();
      expect(screen.getByText('Réessayer')).toBeInTheDocument();
      expect(screen.getByText(/contacter le support/i)).toBeInTheDocument();
    });

    it('applies correct CSS classes for styling', () => {
      const { container } = render(
        <ErrorBoundary>
          <ThrowError shouldThrow={true} />
        </ErrorBoundary>
      );

      const errorContainer = container.querySelector('.min-h-screen');
      expect(errorContainer).toHaveClass('flex', 'items-center', 'justify-center', 'bg-neutral-950');
    });
  });

  describe('Reload Button', () => {
    it('reloads the page when reload button is clicked', async () => {
      const reloadMock = jest.fn();
      Object.defineProperty(window, 'location', {
        value: { reload: reloadMock },
        writable: true,
      });

      const user = userEvent.setup();

      render(
        <ErrorBoundary>
          <ThrowError shouldThrow={true} />
        </ErrorBoundary>
      );

      const reloadButton = screen.getByText('Recharger la page');
      await user.click(reloadButton);

      expect(reloadMock).toHaveBeenCalledTimes(1);
    });
  });

  describe('Retry Button', () => {
    it('resets error state when retry button is clicked', async () => {
      const user = userEvent.setup();
      let shouldThrow = true;

      const ConditionalThrow = () => {
        if (shouldThrow) {
          throw new Error('Test error');
        }
        return <div>Child component recovered</div>;
      };

      const { rerender } = render(
        <ErrorBoundary>
          <ConditionalThrow />
        </ErrorBoundary>
      );

      expect(screen.getByText(/Oups ! Une erreur s'est produite/i)).toBeInTheDocument();

      shouldThrow = false;

      const retryButton = screen.getByText('Réessayer');
      await user.click(retryButton);

      expect(screen.queryByText(/Oups ! Une erreur s'est produite/i)).not.toBeInTheDocument();
      expect(screen.getByText('Child component recovered')).toBeInTheDocument();
    });
  });

  describe('Development Mode', () => {
    beforeEach(() => {
      process.env.NODE_ENV = 'development';
    });

    it('shows error message in development mode', () => {
      render(
        <ErrorBoundary>
          <ThrowError shouldThrow={true} />
        </ErrorBoundary>
      );

      expect(screen.getByText('Test error message')).toBeInTheDocument();
    });

    it('displays error message in styled container', () => {
      const { container } = render(
        <ErrorBoundary>
          <ThrowError shouldThrow={true} />
        </ErrorBoundary>
      );

      const errorMessageContainer = container.querySelector('.bg-red-950\\/20');
      expect(errorMessageContainer).toBeInTheDocument();
      expect(errorMessageContainer).toHaveClass('border-red-900', 'rounded-lg');
    });

    it('logs error to console in development mode', () => {
      render(
        <ErrorBoundary>
          <ThrowError shouldThrow={true} />
        </ErrorBoundary>
      );

      expect(consoleErrorSpy).toHaveBeenCalledWith(
        'ErrorBoundary caught error:',
        expect.any(Error),
        expect.objectContaining({
          componentStack: expect.any(String),
        })
      );
    });
  });

  describe('Production Mode', () => {
    beforeEach(() => {
      process.env.NODE_ENV = 'production';
    });

    it('hides error message in production mode', () => {
      render(
        <ErrorBoundary>
          <ThrowError shouldThrow={true} />
        </ErrorBoundary>
      );

      expect(screen.queryByText('Test error message')).not.toBeInTheDocument();
    });

    it('still displays generic error UI in production', () => {
      render(
        <ErrorBoundary>
          <ThrowError shouldThrow={true} />
        </ErrorBoundary>
      );

      expect(screen.getByText(/Oups ! Une erreur s'est produite/i)).toBeInTheDocument();
      expect(screen.getByText(/Quelque chose s'est mal passé/i)).toBeInTheDocument();
    });

    it('does not log to console in production mode', () => {
      render(
        <ErrorBoundary>
          <ThrowError shouldThrow={true} />
        </ErrorBoundary>
      );

      expect(consoleErrorSpy).not.toHaveBeenCalledWith(
        'ErrorBoundary caught error:',
        expect.anything(),
        expect.anything()
      );
    });
  });

  describe('Multiple Errors', () => {
    it('handles multiple sequential errors', async () => {
      const user = userEvent.setup();

      const { rerender } = render(
        <ErrorBoundary>
          <ThrowError shouldThrow={true} />
        </ErrorBoundary>
      );

      expect(screen.getByText(/Oups ! Une erreur s'est produite/i)).toBeInTheDocument();

      const retryButton = screen.getByText('Réessayer');
      await user.click(retryButton);

      rerender(
        <ErrorBoundary>
          <ThrowError shouldThrow={true} />
        </ErrorBoundary>
      );

      expect(screen.getByText(/Oups ! Une erreur s'est produite/i)).toBeInTheDocument();
    });
  });

  describe('Contact Support Link', () => {
    it('renders contact support link with correct href', () => {
      render(
        <ErrorBoundary>
          <ThrowError shouldThrow={true} />
        </ErrorBoundary>
      );

      const supportLink = screen.getByText('contacter le support');
      expect(supportLink).toHaveAttribute('href', '/contact');
      expect(supportLink).toHaveClass('text-brand-primary', 'hover:underline');
    });
  });
});
