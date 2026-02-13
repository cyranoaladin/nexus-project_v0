/**
 * Switch Component Tests
 */

import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { Switch } from '@/components/ui/switch';

describe('Switch', () => {
  it('renders unchecked by default', () => {
    render(<Switch aria-label="Enable notifications" />);

    const control = screen.getByRole('switch', { name: 'Enable notifications' });
    expect(control).toBeInTheDocument();
    expect(control).toHaveAttribute('data-state', 'unchecked');
  });

  it('supports defaultChecked', () => {
    render(<Switch aria-label="Enable notifications" defaultChecked />);

    const control = screen.getByRole('switch', { name: 'Enable notifications' });
    expect(control).toHaveAttribute('data-state', 'checked');
  });

  it('toggles state on click', async () => {
    const user = userEvent.setup();
    render(<Switch aria-label="Enable notifications" />);

    const control = screen.getByRole('switch', { name: 'Enable notifications' });
    await user.click(control);
    expect(control).toHaveAttribute('data-state', 'checked');

    await user.click(control);
    expect(control).toHaveAttribute('data-state', 'unchecked');
  });

  it('respects disabled state', async () => {
    const user = userEvent.setup();
    render(<Switch aria-label="Enable notifications" disabled />);

    const control = screen.getByRole('switch', { name: 'Enable notifications' });
    expect(control).toBeDisabled();

    await user.click(control);
    expect(control).toHaveAttribute('data-state', 'unchecked');
  });

  it('supports keyboard focus', async () => {
    const user = userEvent.setup();
    render(<Switch aria-label="Enable notifications" />);

    await user.tab();

    const control = screen.getByRole('switch', { name: 'Enable notifications' });
    expect(control).toHaveFocus();
  });
});
