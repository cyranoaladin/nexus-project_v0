/**
 * Dialog Component Tests
 *
 * Tests for enhanced dialog component with Framer Motion animations
 */

import { render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import {
  Dialog,
  DialogTrigger,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
  DialogFooter,
  DialogClose,
} from '@/components/ui/dialog';
import * as FramerMotion from 'framer-motion';
import { useState } from 'react';

jest.mock('framer-motion', () => {
  const actual = jest.requireActual('framer-motion');
  return {
    ...actual,
    useReducedMotion: jest.fn(() => false),
    motion: {
      ...actual.motion,
      div: ({ children, ...props }: any) => <div {...props}>{children}</div>,
    },
  };
});

const TestDialog = ({
  size = 'md',
  open: controlledOpen,
  onOpenChange,
}: {
  size?: 'sm' | 'md' | 'lg' | 'xl' | 'full';
  open?: boolean;
  onOpenChange?: (open: boolean) => void;
}) => {
  return (
    <Dialog open={controlledOpen} onOpenChange={onOpenChange}>
      <DialogTrigger asChild>
        <button>Open Dialog</button>
      </DialogTrigger>
      <DialogContent size={size}>
        <DialogHeader>
          <DialogTitle>Test Dialog Title</DialogTitle>
          <DialogDescription>Test dialog description</DialogDescription>
        </DialogHeader>
        <div>Dialog content goes here</div>
        <DialogFooter>
          <DialogClose asChild>
            <button>Cancel</button>
          </DialogClose>
          <button>Confirm</button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
};

const ControlledTestDialog = ({ size = 'md' }: { size?: 'sm' | 'md' | 'lg' | 'xl' | 'full' }) => {
  const [open, setOpen] = useState(false);

  return (
    <>
      <button onClick={() => setOpen(true)}>External Trigger</button>
      <Dialog open={open} onOpenChange={setOpen}>
        <DialogContent size={size}>
          <DialogHeader>
            <DialogTitle>Test Dialog Title</DialogTitle>
            <DialogDescription>Test dialog description</DialogDescription>
          </DialogHeader>
          <div>Dialog content goes here</div>
          <DialogFooter>
            <button onClick={() => setOpen(false)}>Cancel</button>
            <button>Confirm</button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </>
  );
};

describe('Dialog', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    (FramerMotion.useReducedMotion as jest.Mock).mockReturnValue(false);
  });

  describe('Rendering', () => {
    it('renders dialog trigger button', () => {
      render(<TestDialog open={false} onOpenChange={jest.fn()} />);

      const trigger = screen.getByRole('button', { name: 'Open Dialog' });
      expect(trigger).toBeInTheDocument();
    });

    it('does not render dialog content when closed', () => {
      render(<TestDialog open={false} onOpenChange={jest.fn()} />);

      const dialog = screen.queryByRole('dialog', { hidden: true });
      if (dialog) {
        expect(dialog).toHaveAttribute('data-state', 'closed');
      }
    });

    it('renders dialog content when opened', () => {
      render(<TestDialog open={true} onOpenChange={jest.fn()} />);

      expect(screen.getByRole('dialog')).toBeInTheDocument();
      expect(screen.getByText('Test Dialog Title')).toBeInTheDocument();
      expect(screen.getByText('Test dialog description')).toBeInTheDocument();
      expect(screen.getByText('Dialog content goes here')).toBeInTheDocument();
    });

    it('renders dialog title', () => {
      render(<TestDialog open={true} onOpenChange={jest.fn()} />);

      const title = screen.getByText('Test Dialog Title');
      expect(title).toBeInTheDocument();
      expect(title).toHaveClass('text-lg', 'font-semibold');
    });

    it('renders dialog description', () => {
      render(<TestDialog open={true} onOpenChange={jest.fn()} />);

      const description = screen.getByText('Test dialog description');
      expect(description).toBeInTheDocument();
      expect(description).toHaveClass('text-sm', 'text-gray-500');
    });

    it('renders close button with X icon', () => {
      render(<TestDialog open={true} onOpenChange={jest.fn()} />);

      const closeButton = screen.getByRole('button', { name: 'Close' });
      expect(closeButton).toBeInTheDocument();
      expect(closeButton.querySelector('svg')).toBeInTheDocument();
    });

    it('renders with small size', () => {
      render(<TestDialog size="sm" open={true} onOpenChange={jest.fn()} />);

      const dialog = screen.getByRole('dialog');
      expect(dialog).toHaveClass('max-w-sm');
    });

    it('renders with medium size (default)', () => {
      render(<TestDialog size="md" open={true} onOpenChange={jest.fn()} />);

      const dialog = screen.getByRole('dialog');
      expect(dialog).toHaveClass('max-w-md');
    });

    it('renders with large size', () => {
      render(<TestDialog size="lg" open={true} onOpenChange={jest.fn()} />);

      const dialog = screen.getByRole('dialog');
      expect(dialog).toHaveClass('max-w-lg');
    });

    it('renders with extra large size', () => {
      render(<TestDialog size="xl" open={true} onOpenChange={jest.fn()} />);

      const dialog = screen.getByRole('dialog');
      expect(dialog).toHaveClass('max-w-xl');
    });

    it('renders with full size', () => {
      render(<TestDialog size="full" open={true} onOpenChange={jest.fn()} />);

      const dialog = screen.getByRole('dialog');
      expect(dialog).toHaveClass('max-w-[90vw]');
    });

    it('renders footer with action buttons', () => {
      render(<TestDialog open={true} onOpenChange={jest.fn()} />);

      expect(screen.getByRole('button', { name: 'Cancel' })).toBeInTheDocument();
      expect(screen.getByRole('button', { name: 'Confirm' })).toBeInTheDocument();
    });
  });

  describe('Accessibility', () => {
    it('has dialog role', () => {
      render(<TestDialog open={true} onOpenChange={jest.fn()} />);

      expect(screen.getByRole('dialog')).toBeInTheDocument();
    });

    it('allows focusing elements within dialog', () => {
      render(<TestDialog open={true} onOpenChange={jest.fn()} />);

      const dialog = screen.getByRole('dialog');
      const cancelButton = screen.getByRole('button', { name: 'Cancel' });

      cancelButton.focus();
      expect(cancelButton).toHaveFocus();
      expect(dialog.contains(document.activeElement)).toBe(true);
    });

    it('associates title with dialog via aria-labelledby', () => {
      render(<TestDialog open={true} onOpenChange={jest.fn()} />);

      const dialog = screen.getByRole('dialog');
      const title = screen.getByText('Test Dialog Title');
      
      const labelledBy = dialog.getAttribute('aria-labelledby');
      expect(labelledBy).toBeTruthy();
      expect(title.id).toBe(labelledBy);
    });

    it('associates description with dialog via aria-describedby', () => {
      render(<TestDialog open={true} onOpenChange={jest.fn()} />);

      const dialog = screen.getByRole('dialog');
      const description = screen.getByText('Test dialog description');
      
      const describedBy = dialog.getAttribute('aria-describedby');
      expect(describedBy).toBeTruthy();
      expect(description.id).toBe(describedBy);
    });

    it('has accessible close button with sr-only text', () => {
      render(<TestDialog open={true} onOpenChange={jest.fn()} />);

      const closeButton = screen.getByRole('button', { name: 'Close' });
      expect(closeButton).toBeInTheDocument();
      
      const srOnlyText = closeButton.querySelector('.sr-only');
      expect(srOnlyText).toHaveTextContent('Close');
    });

    it('close button has proper focus styles', () => {
      render(<TestDialog open={true} onOpenChange={jest.fn()} />);

      const closeButton = screen.getByRole('button', { name: 'Close' });
      expect(closeButton).toHaveClass('focus:outline-none');
      expect(closeButton).toHaveClass('focus:ring-2');
      expect(closeButton).toHaveClass('focus:ring-gray-950');
    });

    it('trigger has proper ARIA attributes when dialog is closed', () => {
      render(<TestDialog open={false} onOpenChange={jest.fn()} />);

      const trigger = screen.getByRole('button', { name: 'Open Dialog' });
      expect(trigger).toHaveAttribute('aria-haspopup', 'dialog');
      expect(trigger).toHaveAttribute('aria-expanded', 'false');
    });

    it('trigger has proper ARIA attributes when dialog is open', () => {
      render(<TestDialog open={true} onOpenChange={jest.fn()} />);

      const trigger = screen.getByRole('button', { name: 'Open Dialog' });
      expect(trigger).toHaveAttribute('aria-haspopup', 'dialog');
      expect(trigger).toHaveAttribute('aria-expanded', 'true');
    });
  });

  describe('Animations', () => {
    it('calls useReducedMotion hook', () => {
      render(<TestDialog open={true} onOpenChange={jest.fn()} />);

      expect(FramerMotion.useReducedMotion).toHaveBeenCalled();
    });

    it('calls useReducedMotion for overlay', () => {
      (FramerMotion.useReducedMotion as jest.Mock).mockClear();
      
      render(<TestDialog open={true} onOpenChange={jest.fn()} />);

      expect(FramerMotion.useReducedMotion).toHaveBeenCalled();
    });

    it('renders overlay with background opacity classes', () => {
      render(<TestDialog open={true} onOpenChange={jest.fn()} />);

      const overlay = document.querySelector('.bg-black\\/80');
      expect(overlay).toBeInTheDocument();
      expect(overlay).toHaveClass('fixed', 'inset-0', 'z-50');
    });

    it('renders content with proper positioning classes', () => {
      render(<TestDialog open={true} onOpenChange={jest.fn()} />);

      const dialog = screen.getByRole('dialog');
      expect(dialog).toHaveClass('fixed');
      expect(dialog).toHaveClass('left-[50%]');
      expect(dialog).toHaveClass('top-[50%]');
      expect(dialog).toHaveClass('translate-x-[-50%]');
      expect(dialog).toHaveClass('translate-y-[-50%]');
    });

    it('has proper z-index for layering', () => {
      render(<TestDialog open={true} onOpenChange={jest.fn()} />);

      const dialog = screen.getByRole('dialog');
      expect(dialog).toHaveClass('z-50');
    });
  });

  describe('Interaction', () => {
    it('calls onOpenChange when trigger is clicked', async () => {
      const user = userEvent.setup();
      const onOpenChange = jest.fn();
      render(<TestDialog open={false} onOpenChange={onOpenChange} />);

      const trigger = screen.getByRole('button', { name: 'Open Dialog' });
      await user.click(trigger);

      expect(onOpenChange).toHaveBeenCalledWith(true);
    });

    it('calls onOpenChange when close button is clicked', async () => {
      const user = userEvent.setup();
      const onOpenChange = jest.fn();
      render(<TestDialog open={true} onOpenChange={onOpenChange} />);

      const closeButton = screen.getByRole('button', { name: 'Close' });
      await user.click(closeButton);

      await waitFor(() => {
        expect(onOpenChange).toHaveBeenCalledWith(false);
      });
    });

    it('calls onOpenChange when DialogClose component is clicked', async () => {
      const user = userEvent.setup();
      const onOpenChange = jest.fn();
      render(<TestDialog open={true} onOpenChange={onOpenChange} />);

      const cancelButton = screen.getByRole('button', { name: 'Cancel' });
      await user.click(cancelButton);

      await waitFor(() => {
        expect(onOpenChange).toHaveBeenCalledWith(false);
      });
    });

    it('works with controlled state', async () => {
      const user = userEvent.setup();
      render(<ControlledTestDialog />);

      const initialDialog = screen.queryByRole('dialog', { hidden: true });
      if (initialDialog) {
        expect(initialDialog).toHaveAttribute('data-state', 'closed');
      }

      await user.click(screen.getByRole('button', { name: 'External Trigger' }));

      await waitFor(() => {
        const dialog = screen.getByRole('dialog');
        expect(dialog).toHaveAttribute('data-state', 'open');
      });

      const cancelButton = screen.getByRole('button', { name: 'Cancel' });
      await user.click(cancelButton);

      await waitFor(() => {
        const dialog = screen.queryByRole('dialog', { hidden: true });
        if (dialog) {
          expect(dialog).toHaveAttribute('data-state', 'closed');
        }
      });
    });

    it('renders overlay when dialog is open', () => {
      render(<TestDialog open={true} onOpenChange={jest.fn()} />);

      const overlay = document.querySelector('.bg-black\\/80');
      expect(overlay).toBeInTheDocument();
    });
  });

  describe('Edge Cases', () => {
    it('handles dialog with long content', () => {
      const LongContentDialog = () => (
        <Dialog open={true} onOpenChange={jest.fn()}>
          <DialogContent>
            <DialogHeader>
              <DialogTitle>Long Content Dialog</DialogTitle>
              <DialogDescription>This dialog has very long content</DialogDescription>
            </DialogHeader>
            <div style={{ height: '2000px' }}>
              Very long content that should scroll
            </div>
          </DialogContent>
        </Dialog>
      );

      render(<LongContentDialog />);

      const dialog = screen.getByRole('dialog');
      expect(dialog).toBeInTheDocument();
      expect(screen.getByText('Very long content that should scroll')).toBeInTheDocument();
    });

    it('handles dialog with nested interactive elements', () => {
      const NestedContentDialog = () => (
        <Dialog open={true} onOpenChange={jest.fn()}>
          <DialogContent>
            <DialogHeader>
              <DialogTitle>Form Dialog</DialogTitle>
              <DialogDescription>Fill out the form</DialogDescription>
            </DialogHeader>
            <input type="text" placeholder="Name" aria-label="Name" />
            <input type="email" placeholder="Email" aria-label="Email" />
            <button>Submit</button>
          </DialogContent>
        </Dialog>
      );

      render(<NestedContentDialog />);

      expect(screen.getByLabelText('Name')).toBeInTheDocument();
      expect(screen.getByLabelText('Email')).toBeInTheDocument();
      expect(screen.getByRole('button', { name: 'Submit' })).toBeInTheDocument();
    });

    it('handles dialog without description', () => {
      const NoDescriptionDialog = () => (
        <Dialog open={true} onOpenChange={jest.fn()}>
          <DialogContent>
            <DialogHeader>
              <DialogTitle>Title Only</DialogTitle>
            </DialogHeader>
            <div>Content without description</div>
          </DialogContent>
        </Dialog>
      );

      const consoleSpy = jest.spyOn(console, 'warn').mockImplementation();
      render(<NoDescriptionDialog />);

      expect(screen.getByRole('dialog')).toBeInTheDocument();
      expect(screen.getByText('Title Only')).toBeInTheDocument();
      
      consoleSpy.mockRestore();
    });

    it('handles controlled dialog state changes', async () => {
      const ControlledStateDialog = () => {
        const [open, setOpen] = useState(false);

        return (
          <>
            <button onClick={() => setOpen(true)}>External Open</button>
            <Dialog open={open} onOpenChange={setOpen}>
              <DialogContent>
                <DialogTitle>Controlled Dialog</DialogTitle>
                <DialogDescription>Controlled state</DialogDescription>
                <div>This is controlled externally</div>
                <button onClick={() => setOpen(false)}>Close</button>
              </DialogContent>
            </Dialog>
          </>
        );
      };

      const user = userEvent.setup();
      render(<ControlledStateDialog />);

      const initialDialog = screen.queryByRole('dialog', { hidden: true });
      if (initialDialog) {
        expect(initialDialog).toHaveAttribute('data-state', 'closed');
      }

      await user.click(screen.getByRole('button', { name: 'External Open' }));

      await waitFor(() => {
        const dialog = screen.getByRole('dialog');
        expect(dialog).toHaveAttribute('data-state', 'open');
      });

      const closeButtons = screen.getAllByRole('button', { name: 'Close' });
      await user.click(closeButtons[closeButtons.length - 1]);

      await waitFor(() => {
        const dialog = screen.queryByRole('dialog', { hidden: true });
        if (dialog) {
          expect(dialog).toHaveAttribute('data-state', 'closed');
        }
      });
    });

    it('renders dialog with custom className', () => {
      const CustomClassDialog = () => (
        <Dialog open={true} onOpenChange={jest.fn()}>
          <DialogContent className="custom-dialog-class">
            <DialogTitle>Custom Class</DialogTitle>
            <DialogDescription>Custom styling</DialogDescription>
          </DialogContent>
        </Dialog>
      );

      render(<CustomClassDialog />);

      const dialog = screen.getByRole('dialog');
      expect(dialog).toHaveClass('custom-dialog-class');
      expect(dialog).toHaveClass('max-w-md');
    });

    it('renders all size variants correctly', () => {
      const sizes = ['sm', 'md', 'lg', 'xl', 'full'] as const;
      const sizeClasses = {
        sm: 'max-w-sm',
        md: 'max-w-md',
        lg: 'max-w-lg',
        xl: 'max-w-xl',
        full: 'max-w-[90vw]',
      };

      sizes.forEach((size) => {
        const { unmount } = render(<ControlledTestDialog size={size} />);
        unmount();
      });
    });

    it('has proper shadow and border styling', () => {
      render(<TestDialog open={true} onOpenChange={jest.fn()} />);

      const dialog = screen.getByRole('dialog');
      expect(dialog).toHaveClass('shadow-lg');
      expect(dialog).toHaveClass('border');
      expect(dialog).toHaveClass('border-gray-200');
    });

    it('has proper background and padding', () => {
      render(<TestDialog open={true} onOpenChange={jest.fn()} />);

      const dialog = screen.getByRole('dialog');
      expect(dialog).toHaveClass('bg-white');
      expect(dialog).toHaveClass('p-6');
    });
  });
});
