/**
 * RadioGroup Component Tests
 */

import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { RadioGroup, RadioGroupItem } from '@/components/ui/radio-group';

describe('RadioGroup', () => {
  it('renders radio group items', () => {
    render(
      <RadioGroup defaultValue="basic">
        <RadioGroupItem value="basic" aria-label="Basic" />
        <RadioGroupItem value="pro" aria-label="Pro" />
      </RadioGroup>
    );

    expect(screen.getByRole('radiogroup')).toBeInTheDocument();
    expect(screen.getByRole('radio', { name: 'Basic' })).toBeInTheDocument();
    expect(screen.getByRole('radio', { name: 'Pro' })).toBeInTheDocument();
  });

  it('sets default selected value', () => {
    render(
      <RadioGroup defaultValue="pro">
        <RadioGroupItem value="basic" aria-label="Basic" />
        <RadioGroupItem value="pro" aria-label="Pro" />
      </RadioGroup>
    );

    const pro = screen.getByRole('radio', { name: 'Pro' });
    expect(pro).toHaveAttribute('data-state', 'checked');
  });

  it('allows selection change', async () => {
    const user = userEvent.setup();
    render(
      <RadioGroup defaultValue="basic">
        <RadioGroupItem value="basic" aria-label="Basic" />
        <RadioGroupItem value="pro" aria-label="Pro" />
      </RadioGroup>
    );

    const pro = screen.getByRole('radio', { name: 'Pro' });
    await user.click(pro);

    expect(pro).toHaveAttribute('data-state', 'checked');
  });

  it('respects disabled state', async () => {
    const user = userEvent.setup();
    render(
      <RadioGroup defaultValue="basic">
        <RadioGroupItem value="basic" aria-label="Basic" />
        <RadioGroupItem value="pro" aria-label="Pro" disabled />
      </RadioGroup>
    );

    const disabled = screen.getByRole('radio', { name: 'Pro' });
    expect(disabled).toBeDisabled();

    await user.click(disabled);
    expect(disabled).toHaveAttribute('data-state', 'unchecked');
  });

  it('supports keyboard focus navigation', async () => {
    const user = userEvent.setup();
    render(
      <RadioGroup defaultValue="basic">
        <RadioGroupItem value="basic" aria-label="Basic" />
        <RadioGroupItem value="pro" aria-label="Pro" />
      </RadioGroup>
    );

    await user.tab();
    expect(screen.getByRole('radio', { name: 'Basic' })).toHaveFocus();
  });
});
