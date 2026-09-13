import { mountStaticSessionRecovery } from '@/lib/auth/static-session-recovery';

const session = { user: { id: 'synthetic-planning-admin', role: 'ADMIN' }, expires: '2099-01-01T00:00:00Z' };
const originalFetch = global.fetch;
afterEach(() => { global.fetch = originalFetch; document.body.replaceChildren(); jest.useRealTimers(); });

it('keeps the exact planning modal input and draft through ten-second unavailability and recovery', async () => {
  document.body.innerHTML = '<div id="app"><button>Save planning</button></div><div id="modalRoot"><div class="modal"><input aria-label="Planning draft" value="unsaved workshop"><button>Save dialog</button></div></div>';
  let unavailable = false;
  global.fetch = jest.fn(async () => unavailable ? new Promise<Response>(() => {}) : ({ ok: true, json: async () => session }) as Response);
  const ended = jest.fn();
  const changed = jest.fn();
  const mounted = mountStaticSessionRecovery({ onSessionEnded: ended, onIdentityChanged: changed });
  try {
    await mounted.whenVerified();
    const input = document.querySelector('input')!;
    input.value = 'actual unsaved work';
    jest.useFakeTimers();
    unavailable = true;
    mounted.controller.retry();
    jest.advanceTimersByTime(10_000);
    expect(mounted.controller.getSnapshot().state).toBe('UNAVAILABLE');
    expect(document.querySelector('input')).toBe(input);
    expect(input.value).toBe('actual unsaved work');
    expect(input.disabled).toBe(true);
    expect(ended).not.toHaveBeenCalled();
    expect(changed).not.toHaveBeenCalled();
    const retry = document.querySelector<HTMLButtonElement>('.modal [data-session-recovery-control]')!;
    expect(retry.disabled).toBe(false);
    unavailable = false;
    retry.click();
    await mounted.whenVerified();
    expect(document.querySelector('input')).toBe(input);
    expect(input.value).toBe('actual unsaved work');
    expect(input.disabled).toBe(false);
  } finally { mounted.destroy(); }
});
