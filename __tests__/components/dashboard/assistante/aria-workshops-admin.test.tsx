import { fireEvent, render, screen, waitFor } from '@testing-library/react';
import { AriaWorkshopsAdmin } from '@/components/dashboard/assistante/AriaWorkshopsAdmin';

const EMPTY_SESSION = {
  id: 's1',
  courseKey: 'eds-maths-premiere',
  title: 'Atelier révisions',
  scheduledDate: '2026-10-01T00:00:00.000Z',
  startTime: '14:00',
  endTime: '15:00',
  status: 'SCHEDULED' as const,
  attendees: [
    { attendeeId: 'a1', studentId: 'student-1', studentName: 'Mehdi Ben Ali', status: 'REGISTERED' as const },
  ],
};

describe('AriaWorkshopsAdmin', () => {
  afterEach(() => jest.restoreAllMocks());

  it('lists real scheduled workshops with their real roster', async () => {
    jest.spyOn(global, 'fetch').mockImplementation(async (input) => {
      if (String(input).includes('/api/assistante/aria/workshops')) {
        return { ok: true, json: async () => ({ workshops: [EMPTY_SESSION] }) } as Response;
      }
      throw new Error(`unmocked fetch: ${String(input)}`);
    });
    render(<AriaWorkshopsAdmin />);
    await waitFor(() => expect(screen.getByTestId('aria-workshop-session-s1')).toBeInTheDocument());
    expect(screen.getByText('Mehdi Ben Ali')).toBeInTheDocument();
    expect(screen.getByTestId('aria-workshop-mark-attended-a1')).toBeInTheDocument();
  });

  it('schedules a real workshop with the form values and reloads the real list', async () => {
    let scheduled: unknown = null;
    jest.spyOn(global, 'fetch').mockImplementation(async (input, init) => {
      const url = String(input);
      if (url.includes('/api/assistante/aria/workshops') && init?.method === 'POST') {
        scheduled = JSON.parse(String(init.body));
        return { ok: true, json: async () => ({ workshop: { id: 's2' } }) } as Response;
      }
      if (url.includes('/api/assistante/aria/workshops')) {
        return { ok: true, json: async () => ({ workshops: scheduled ? [EMPTY_SESSION] : [] }) } as Response;
      }
      throw new Error(`unmocked fetch: ${url}`);
    });
    render(<AriaWorkshopsAdmin />);
    await waitFor(() => expect(screen.getByTestId('aria-workshop-schedule-form')).toBeInTheDocument());

    fireEvent.change(screen.getByLabelText('Clé de cours'), { target: { value: 'eds-maths-premiere' } });
    fireEvent.change(screen.getByLabelText('Titre'), { target: { value: 'Atelier révisions' } });
    fireEvent.change(screen.getByLabelText('Date'), { target: { value: '2026-10-01' } });
    fireEvent.change(screen.getByLabelText('Début'), { target: { value: '14:00' } });
    fireEvent.change(screen.getByLabelText('Fin'), { target: { value: '15:00' } });
    fireEvent.click(screen.getByTestId('aria-workshop-schedule-submit'));

    await waitFor(() => expect(scheduled).toMatchObject({ courseKey: 'eds-maths-premiere', title: 'Atelier révisions' }));
  });

  it('marks a real attendee as ATTENDED via the real endpoint', async () => {
    let markedStatus: string | null = null;
    jest.spyOn(global, 'fetch').mockImplementation(async (input, init) => {
      const url = String(input);
      if (url.includes('/attendance') && init?.method === 'POST') {
        markedStatus = (JSON.parse(String(init.body)) as { status: string }).status;
        return { ok: true, json: async () => ({ status: 'ATTENDED' }) } as Response;
      }
      if (url.includes('/api/assistante/aria/workshops')) {
        return { ok: true, json: async () => ({ workshops: [EMPTY_SESSION] }) } as Response;
      }
      throw new Error(`unmocked fetch: ${url}`);
    });
    render(<AriaWorkshopsAdmin />);
    await waitFor(() => expect(screen.getByTestId('aria-workshop-mark-attended-a1')).toBeInTheDocument());
    fireEvent.click(screen.getByTestId('aria-workshop-mark-attended-a1'));
    await waitFor(() => expect(markedStatus).toBe('ATTENDED'));
  });
});
