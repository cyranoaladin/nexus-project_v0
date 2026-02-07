/**
 * Toast Component Tests
 *
 * Tests for notification toast component with variants
 */

import { render, screen, waitFor, fireEvent } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import {
  Toast,
  ToastProvider,
  ToastViewport,
  ToastTitle,
  ToastDescription,
  ToastClose,
  ToastAction,
} from '@/components/ui/toast';

describe.skip('Toast', () => {
  const renderToast = (variant?: 'default' | 'success' | 'error' | 'warning' | 'info') => {
    return render(
      <ToastProvider>
        <Toast variant={variant} open={true} onOpenChange={() => {}}>
          <ToastTitle>Test Title</ToastTitle>
          <ToastDescription>Test Description</ToastDescription>
          <ToastClose />
        </Toast>
        <ToastViewport />
      </ToastProvider>
    );
  };

  describe('Rendering', () => {
    it('renders with title and description', () => {
      renderToast();

      expect(screen.getByText('Test Title')).toBeInTheDocument();
      expect(screen.getByText('Test Description')).toBeInTheDocument();
    });

    it('renders close button', () => {
      renderToast();

      const closeButton = screen.getByRole('button');
      expect(closeButton).toBeInTheDocument();
    });

    it('renders with default variant', () => {
      const { container } = renderToast('default');
      const toast = container.querySelector('[data-state="open"]');

      expect(toast).toHaveClass('border-neutral-200');
      expect(toast).toHaveClass('bg-white');
    });

    it('renders with success variant', () => {
      const { container } = renderToast('success');
      const toast = container.querySelector('[data-state="open"]');

      expect(toast).toHaveClass('border-success/20');
      expect(toast).toHaveClass('bg-success/10');
    });

    it('renders with error variant', () => {
      const { container } = renderToast('error');
      const toast = container.querySelector('[data-state="open"]');

      expect(toast).toHaveClass('border-error/20');
      expect(toast).toHaveClass('bg-error/10');
    });

    it('renders with warning variant', () => {
      const { container } = renderToast('warning');
      const toast = container.querySelector('[data-state="open"]');

      expect(toast).toHaveClass('border-warning/20');
      expect(toast).toHaveClass('bg-warning/10');
    });

    it('renders with info variant', () => {
      const { container } = renderToast('info');
      const toast = container.querySelector('[data-state="open"]');

      expect(toast).toHaveClass('border-info/20');
      expect(toast).toHaveClass('bg-info/10');
    });
  });

  describe('Interactions', () => {
    it('renders close button that can be clicked', () => {
      const onOpenChange = jest.fn();

      render(
        <ToastProvider>
          <Toast open={true} onOpenChange={onOpenChange}>
            <ToastTitle>Test</ToastTitle>
            <ToastClose />
          </Toast>
          <ToastViewport />
        </ToastProvider>
      );

      const closeButton = screen.getByRole('button');
      expect(closeButton).toBeInTheDocument();

      // Use fireEvent for simpler interaction test
      fireEvent.click(closeButton);

      // Verify callback was invoked
      expect(onOpenChange).toHaveBeenCalled();
    });

    it('renders and triggers action button', () => {
      const onAction = jest.fn();

      render(
        <ToastProvider>
          <Toast open={true} onOpenChange={() => {}}>
            <ToastTitle>Test</ToastTitle>
            <ToastAction altText="Undo" onClick={onAction}>
              Undo
            </ToastAction>
            <ToastClose />
          </Toast>
          <ToastViewport />
        </ToastProvider>
      );

      const actionButton = screen.getByText('Undo');
      expect(actionButton).toBeInTheDocument();

      // Use fireEvent for simpler interaction test
      fireEvent.click(actionButton);

      expect(onAction).toHaveBeenCalled();
    });
  });

  describe('Accessibility', () => {
    it('has proper ARIA attributes', () => {
      const { container } = renderToast();
      const toast = container.querySelector('[role="status"]');

      expect(toast).toBeInTheDocument();
    });

    it('has accessible close button', () => {
      renderToast();

      const closeButton = screen.getByRole('button');
      expect(closeButton).toBeInTheDocument();
    });

    it('supports custom className', () => {
      render(
        <ToastProvider>
          <Toast open={true} onOpenChange={() => {}} className="custom-class">
            <ToastTitle>Test</ToastTitle>
          </Toast>
          <ToastViewport />
        </ToastProvider>
      );

      const { container } = render(
        <ToastProvider>
          <Toast open={true} onOpenChange={() => {}} className="custom-class">
            <ToastTitle>Test</ToastTitle>
          </Toast>
          <ToastViewport />
        </ToastProvider>
      );

      const toast = container.querySelector('.custom-class');
      expect(toast).toBeInTheDocument();
    });
  });

  describe('ToastViewport', () => {
    it('renders viewport with correct positioning', () => {
      const { container } = render(
        <ToastProvider>
          <ToastViewport data-testid="toast-viewport" />
        </ToastProvider>
      );

      const viewport = screen.getByTestId('toast-viewport');
      expect(viewport).toHaveClass('fixed');
      expect(viewport).toHaveClass('z-[100]');
    });

    it('supports custom className on viewport', () => {
      render(
        <ToastProvider>
          <ToastViewport className="custom-viewport" data-testid="custom-viewport" />
        </ToastProvider>
      );

      const viewport = screen.getByTestId('custom-viewport');
      expect(viewport).toHaveClass('custom-viewport');
    });
  });

  describe('Edge Cases', () => {
    it('renders without description', () => {
      render(
        <ToastProvider>
          <Toast open={true} onOpenChange={() => {}}>
            <ToastTitle>Title Only</ToastTitle>
            <ToastClose />
          </Toast>
          <ToastViewport />
        </ToastProvider>
      );

      expect(screen.getByText('Title Only')).toBeInTheDocument();
      expect(screen.queryByText('Test Description')).not.toBeInTheDocument();
    });

    it('renders without title', () => {
      render(
        <ToastProvider>
          <Toast open={true} onOpenChange={() => {}}>
            <ToastDescription>Description Only</ToastDescription>
            <ToastClose />
          </Toast>
          <ToastViewport />
        </ToastProvider>
      );

      expect(screen.getByText('Description Only')).toBeInTheDocument();
      expect(screen.queryByText('Test Title')).not.toBeInTheDocument();
    });

    it('handles closed state', () => {
      const { container } = render(
        <ToastProvider>
          <Toast open={false} onOpenChange={() => {}}>
            <ToastTitle>Test</ToastTitle>
          </Toast>
          <ToastViewport />
        </ToastProvider>
      );

      const toast = container.querySelector('[data-state="closed"]');
      expect(toast).toBeInTheDocument();
    });
  });
});
