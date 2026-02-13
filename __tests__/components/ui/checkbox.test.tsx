/**
 * Checkbox Component Tests
 */

import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { Checkbox } from '@/components/ui/checkbox';

describe('Checkbox', () => {
  it('renders unchecked by default', () => {
    render(<Checkbox aria-label="Accept terms" />);

    const checkbox = screen.getByRole('checkbox', { name: 'Accept terms' });
    expect(checkbox).toBeInTheDocument();
    expect(checkbox).not.toBeChecked();
  });

  it('supports controlled checked state', () => {
    const onCheckedChange = jest.fn();
    const { rerender } = render(
      <Checkbox aria-label="Accept terms" checked={false} onCheckedChange={onCheckedChange} />
    );

    const checkbox = screen.getByRole('checkbox', { name: 'Accept terms' });
    expect(checkbox).not.toBeChecked();

    rerender(
      <Checkbox aria-label="Accept terms" checked onCheckedChange={onCheckedChange} />
    );
    expect(checkbox).toBeChecked();
  });

  it('toggles checked state on click', async () => {
    const user = userEvent.setup();
    const onCheckedChange = jest.fn();
    render(<Checkbox aria-label="Accept terms" onCheckedChange={onCheckedChange} />);

    const checkbox = screen.getByRole('checkbox', { name: 'Accept terms' });
    await user.click(checkbox);
    expect(onCheckedChange).toHaveBeenCalledWith(true);
  });

  it('respects disabled state', async () => {
    const user = userEvent.setup();
    const onCheckedChange = jest.fn();
    render(<Checkbox aria-label="Accept terms" disabled onCheckedChange={onCheckedChange} />);

    const checkbox = screen.getByRole('checkbox', { name: 'Accept terms' });
    expect(checkbox).toBeDisabled();

    await user.click(checkbox);
    expect(onCheckedChange).not.toHaveBeenCalled();
  });

  it('supports keyboard focus', async () => {
    const user = userEvent.setup();
    render(<Checkbox aria-label="Accept terms" />);

    await user.tab();
    expect(screen.getByRole('checkbox', { name: 'Accept terms' })).toHaveFocus();
  });
});
