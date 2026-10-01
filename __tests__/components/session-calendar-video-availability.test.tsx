import { cleanup, fireEvent, render, screen } from '@testing-library/react';
import { SessionCalendar } from '@/components/ui/session-calendar';

jest.mock('react-day-picker', () => ({
  DayPicker: ({ onDayClick }: { onDayClick: (date: Date) => void }) => {
    return <button onClick={() => onDayClick(new Date())}>Choisir aujourd’hui</button>;
  },
}));

jest.mock('@/components/ui/popover', () => ({
  Popover: ({ children }: { children: React.ReactNode }) => children,
  PopoverTrigger: ({ children }: { children: React.ReactNode }) => children,
  PopoverContent: ({ children }: { children: React.ReactNode }) => children,
}));

jest.mock('@/components/ui/session-booking', () => () => null);

describe('SessionCalendar video entry point', () => {
  const previousMode = process.env.NEXT_PUBLIC_VIDEO_MODE;

  afterEach(() => {
    cleanup();
    if (previousMode === undefined) delete process.env.NEXT_PUBLIC_VIDEO_MODE;
    else process.env.NEXT_PUBLIC_VIDEO_MODE = previousMode;
  });

  function renderToday() {
    const now = new Date();
    const start = new Date(now.getTime() - 10 * 60 * 1000);
    const end = new Date(now.getTime() + 20 * 60 * 1000);
    const hhmm = (date: Date) => `${String(date.getHours()).padStart(2, '0')}:${String(date.getMinutes()).padStart(2, '0')}`;
    render(<SessionCalendar studentId="student-1" sessions={[{
      id: 'session-1', title: 'Mathématiques', subject: 'Mathématiques',
      scheduledDate: now, startTime: hhmm(start), endTime: hhmm(end),
      status: 'SCHEDULED', coach: null,
    }]} />);
    fireEvent.click(screen.getByRole('button', { name: 'Choisir aujourd’hui' }));
  }

  it('keeps booking available while replacing Join with the disabled message', () => {
    process.env.NEXT_PUBLIC_VIDEO_MODE = 'DISABLED';
    renderToday();

    expect(screen.getByRole('button', { name: 'Réserver une session' })).toBeEnabled();
    expect(screen.getByText('Visioconférence intégrée non activée sur cette Preview.')).toBeVisible();
    expect(screen.queryByRole('button', { name: /Rejoindre la session/ })).toBeNull();
    expect(screen.queryByRole('link', { name: /Rejoindre la session/ })).toBeNull();
  });

  it('links Join to the live video page in JITSI mode', () => {
    process.env.NEXT_PUBLIC_VIDEO_MODE = 'JITSI';
    renderToday();

    expect(screen.getByRole('link', { name: /Rejoindre la session/ })).toHaveAttribute(
      'href', '/session/video?sessionId=session-1',
    );
  });
});
