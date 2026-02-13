/**
 * Popover Component Tests
 */

import { render, screen, fireEvent } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import {
  Popover,
  PopoverTrigger,
  PopoverContent,
} from '@/components/ui/popover';

describe('Popover', () => {
  it('renders content when open', () => {
    render(
      <Popover open onOpenChange={jest.fn()}>
        <PopoverTrigger>Open</PopoverTrigger>
        <PopoverContent>Popover Content</PopoverContent>
      </Popover>
    );

    expect(screen.getByText('Popover Content')).toBeInTheDocument();
  });

  it('toggles content when trigger is clicked', async () => {
    const user = userEvent.setup();
    render(
      <Popover>
        <PopoverTrigger>Open</PopoverTrigger>
        <PopoverContent>Popover Content</PopoverContent>
      </Popover>
    );

    expect(screen.queryByText('Popover Content')).not.toBeInTheDocument();

    await user.click(screen.getByText('Open'));
    expect(screen.getByText('Popover Content')).toBeInTheDocument();
  });

  it('calls onOpenChange when trigger is clicked (controlled)', async () => {
    const user = userEvent.setup();
    const onOpenChange = jest.fn();

    render(
      <Popover open={false} onOpenChange={onOpenChange}>
        <PopoverTrigger>Open</PopoverTrigger>
        <PopoverContent>Popover Content</PopoverContent>
      </Popover>
    );

    await user.click(screen.getByText('Open'));
    expect(onOpenChange).toHaveBeenCalledWith(true);
  });

  it('closes on Escape key when open (controlled)', () => {
    const onOpenChange = jest.fn();
    render(
      <Popover open={true} onOpenChange={onOpenChange}>
        <PopoverTrigger>Open</PopoverTrigger>
        <PopoverContent>Popover Content</PopoverContent>
      </Popover>
    );

    fireEvent.keyDown(document, { key: 'Escape' });

    expect(onOpenChange).toHaveBeenCalledWith(false);
  });
});
