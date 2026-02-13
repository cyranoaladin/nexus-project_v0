/**
 * Select Component Tests
 */

import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import {
  Select,
  SelectTrigger,
  SelectValue,
  SelectContent,
  SelectItem,
} from '@/components/ui/select';

describe('Select', () => {
  it('renders placeholder when no value is selected', () => {
    render(
      <Select>
        <SelectTrigger>
          <SelectValue placeholder="Pick one" />
        </SelectTrigger>
        <SelectContent>
          <SelectItem value="a">Option A</SelectItem>
        </SelectContent>
      </Select>
    );

    expect(screen.getByText('Pick one')).toBeInTheDocument();
  });

  it('updates selected value when an item is clicked', async () => {
    const user = userEvent.setup();
    render(
      <Select defaultValue="a">
        <SelectTrigger>
          <SelectValue placeholder="Pick one" />
        </SelectTrigger>
        <SelectContent>
          <SelectItem value="a">Option A</SelectItem>
          <SelectItem value="b">Option B</SelectItem>
        </SelectContent>
      </Select>
    );

    expect(screen.getByText('a')).toBeInTheDocument();

    const optionB = screen.getByRole('option', { name: 'Option B' });
    await user.click(optionB);

    expect(screen.getByText('b')).toBeInTheDocument();
  });

  it('supports controlled value updates', async () => {
    const user = userEvent.setup();
    const onValueChange = jest.fn();

    const { rerender } = render(
      <Select value="a" onValueChange={onValueChange}>
        <SelectTrigger>
          <SelectValue placeholder="Pick one" />
        </SelectTrigger>
        <SelectContent>
          <SelectItem value="a">Option A</SelectItem>
          <SelectItem value="b">Option B</SelectItem>
        </SelectContent>
      </Select>
    );

    const optionB = screen.getByRole('option', { name: 'Option B' });
    await user.click(optionB);
    expect(onValueChange).toHaveBeenCalledWith('b');

    rerender(
      <Select value="b" onValueChange={onValueChange}>
        <SelectTrigger>
          <SelectValue placeholder="Pick one" />
        </SelectTrigger>
        <SelectContent>
          <SelectItem value="a">Option A</SelectItem>
          <SelectItem value="b">Option B</SelectItem>
        </SelectContent>
      </Select>
    );

    expect(screen.getByText('b')).toBeInTheDocument();
  });

  it('does not trigger onValueChange for disabled item', async () => {
    const user = userEvent.setup();
    const onValueChange = jest.fn();

    render(
      <Select defaultValue="a" onValueChange={onValueChange}>
        <SelectTrigger>
          <SelectValue placeholder="Pick one" />
        </SelectTrigger>
        <SelectContent>
          <SelectItem value="a">Option A</SelectItem>
          <SelectItem value="b" disabled>Option B</SelectItem>
        </SelectContent>
      </Select>
    );

    const optionB = screen.getByRole('option', { name: 'Option B' });
    await user.click(optionB);

    expect(onValueChange).not.toHaveBeenCalled();
    expect(screen.getByText('a')).toBeInTheDocument();
  });

  it('supports keyboard selection on focused item', async () => {
    const user = userEvent.setup();
    const onValueChange = jest.fn();

    render(
      <Select defaultValue="a" onValueChange={onValueChange}>
        <SelectTrigger>
          <SelectValue placeholder="Pick one" />
        </SelectTrigger>
        <SelectContent>
          <SelectItem value="a">Option A</SelectItem>
          <SelectItem value="b">Option B</SelectItem>
        </SelectContent>
      </Select>
    );

    const optionB = screen.getByRole('option', { name: 'Option B' });
    optionB.focus();
    await user.keyboard('{Enter}');

    expect(onValueChange).toHaveBeenCalledWith('b');
  });

  it('supports arrow navigation and Enter on focused item', async () => {
    const user = userEvent.setup();
    const onValueChange = jest.fn();

    render(
      <Select defaultValue="a" onValueChange={onValueChange}>
        <SelectTrigger>
          <SelectValue placeholder="Pick one" />
        </SelectTrigger>
        <SelectContent>
          <SelectItem value="a">Option A</SelectItem>
          <SelectItem value="b">Option B</SelectItem>
        </SelectContent>
      </Select>
    );

    const optionA = screen.getByRole('option', { name: 'Option A' });
    const optionB = screen.getByRole('option', { name: 'Option B' });

    optionA.focus();
    await user.keyboard('{ArrowDown}');
    optionB.focus();
    await user.keyboard('{Enter}');

    expect(onValueChange).toHaveBeenCalledWith('b');
  });
});
