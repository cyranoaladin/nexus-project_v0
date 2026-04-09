import { act, render, screen } from '@testing-library/react';
import CountdownChip from '@/components/sections/homepage/CountdownChip';

describe('CountdownChip', () => {
  beforeEach(() => {
    jest.useFakeTimers();
    jest.setSystemTime(new Date('2026-04-01T09:00:00Z'));
  });

  afterEach(() => {
    act(() => {
      jest.runOnlyPendingTimers();
    });
    jest.useRealTimers();
  });

  it('renders the expected J-X label', () => {
    render(<CountdownChip targetDate={new Date('2026-04-18T09:00:00Z')} label="avant le début" tone="stage" />);

    expect(screen.getByText(/j-17 avant le début/i)).toBeInTheDocument();
  });

  it('refreshes every minute', () => {
    render(<CountdownChip targetDate={new Date('2026-04-18T09:00:00Z')} label="avant le début" tone="stage" />);

    act(() => {
      jest.setSystemTime(new Date('2026-04-02T09:00:00Z'));
      jest.advanceTimersByTime(60_000);
    });

    expect(screen.getByText(/j-16 avant le début/i)).toBeInTheDocument();
  });
});
