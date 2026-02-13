/**
 * Modal Component Tests
 */

import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { Modal } from '@/components/ui/modal';

describe('Modal', () => {
  it('renders title, description, and content when open', () => {
    render(
      <Modal
        open
        onOpenChange={jest.fn()}
        title="Modal Title"
        description="Modal description"
      >
        <div>Modal body</div>
      </Modal>
    );

    expect(screen.getByText('Modal Title')).toBeInTheDocument();
    expect(screen.getByText('Modal description')).toBeInTheDocument();
    expect(screen.getByText('Modal body')).toBeInTheDocument();
  });

  it('does not render content when closed', () => {
    render(
      <Modal open={false} onOpenChange={jest.fn()} title="Hidden">
        <div>Hidden body</div>
      </Modal>
    );

    expect(screen.queryByText('Hidden')).not.toBeInTheDocument();
    expect(screen.queryByText('Hidden body')).not.toBeInTheDocument();
  });

  it('hides close button when showClose is false', () => {
    render(
      <Modal
        open
        onOpenChange={jest.fn()}
        showClose={false}
        title="No Close"
        description="Modal description"
      >
        <div>Body</div>
      </Modal>
    );

    expect(screen.queryByLabelText('Fermer')).not.toBeInTheDocument();
  });

  it('calls onOpenChange when close button is clicked', async () => {
    const user = userEvent.setup();
    const onOpenChange = jest.fn();

    render(
      <Modal open onOpenChange={onOpenChange} title="Closable" description="Modal description">
        <div>Body</div>
      </Modal>
    );

    const closeButton = screen.getByLabelText('Fermer');
    await user.click(closeButton);

    expect(onOpenChange).toHaveBeenCalledWith(false);
  });
});
