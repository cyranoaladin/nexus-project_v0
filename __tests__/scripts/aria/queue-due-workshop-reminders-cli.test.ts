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

  it('falls back to its real write/writeError/run/disconnect defaults when called with no overrides at all', async () => {
    // @/lib/prisma is globally auto-mocked in this lane (jest.setup.js) —
    // its `findMany` defaults to an empty array, so the real (unmocked)
    // `run` default genuinely resolves to a real zero-candidate scan
    // result, exercising every `??` default (write, writeError, run,
    // disconnect) in a single real call, on the success path.
    const stdoutSpy = jest.spyOn(process.stdout, 'write').mockImplementation(() => true);
    const stderrSpy = jest.spyOn(process.stderr, 'write').mockImplementation(() => true);
    try {
      const exitCode = await runQueueDueAriaWorkshopReminders();
      expect(exitCode).toBe(0);
      expect(stdoutSpy).toHaveBeenCalledWith(expect.stringContaining('"queued":0'));
      expect(stderrSpy).not.toHaveBeenCalled();
    } finally {
      stdoutSpy.mockRestore();
      stderrSpy.mockRestore();
    }
  });
});
