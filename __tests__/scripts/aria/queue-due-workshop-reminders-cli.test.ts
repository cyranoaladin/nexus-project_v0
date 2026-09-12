import { runQueueDueAriaWorkshopReminders } from '@/scripts/aria/queue-due-workshop-reminders-cli';

describe('runQueueDueAriaWorkshopReminders', () => {
  it('writes the real scan result and exits 0 on success', async () => {
    const writes: string[] = [];
    const exitCode = await runQueueDueAriaWorkshopReminders({
      run: async () => ({ queued: 2, skippedNotYetEligible: 1, skippedTooLate: 0 }),
      disconnect: async () => {},
      write: (value) => writes.push(value),
      writeError: () => { throw new Error('should not write to stderr on success'); },
    });
    expect(exitCode).toBe(0);
    expect(writes.join('')).toContain('"queued":2');
  });

  it('exits 1 and reports on stderr when the real scan throws', async () => {
    const errors: string[] = [];
    const exitCode = await runQueueDueAriaWorkshopReminders({
      run: async () => { throw new Error('boom'); },
      disconnect: async () => {},
      write: () => {},
      writeError: (value) => errors.push(value),
    });
    expect(exitCode).toBe(1);
    expect(errors.join('')).toContain('ARIA_WORKSHOP_REMINDER_QUEUE_FAILED');
  });

  it('exits 1 when disconnect itself fails, even after a successful scan', async () => {
    const errors: string[] = [];
    const exitCode = await runQueueDueAriaWorkshopReminders({
      run: async () => ({ queued: 0, skippedNotYetEligible: 0, skippedTooLate: 0 }),
      disconnect: async () => { throw new Error('disconnect failed'); },
      write: () => {},
      writeError: (value) => errors.push(value),
    });
    expect(exitCode).toBe(1);
    expect(errors.join('')).toContain('ARIA_WORKSHOP_REMINDER_DISCONNECT_FAILED');
  });
});
