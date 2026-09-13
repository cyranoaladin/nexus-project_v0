import { mountStaticSessionRecovery } from '@/lib/auth/static-session-recovery';

const session = { user: { id: 'synthetic-planning-admin', role: 'ADMIN' }, expires: '2099-01-01T00:00:00Z' };
const originalFetch = global.fetch;
afterEach(() => { global.fetch = originalFetch; document.body.replaceChildren(); jest.useRealTimers(); });

it.each(['.modal', '#side'])('keeps recovery controls beside the exact planning %s draft through unavailability', async scope => {
  const editor = '<input aria-label="Planning draft" value="unsaved workshop"><button>Save editor</button>';
  document.body.innerHTML = scope === '#side'
    ? `<div id="app"><aside id="side" class="side"><div class="side-head">Séance</div><div id="sideBody">${editor}</div></aside></div><div id="modalRoot"></div>`
    : `<div id="app"><button>Save planning</button></div><div id="modalRoot"><div class="modal">${editor}</div></div>`;
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
    const retry = document.querySelector<HTMLButtonElement>(`${scope} [data-session-recovery-control]`)!;
    expect(retry).not.toBeNull();
    expect(retry.disabled).toBe(false);
    // Chrome/editor siblings can change without replacing the draft or its
    // colocated retry, and the observer must not add duplicate notices.
    document.querySelector(scope)!.append(document.createElement('span'));
    await Promise.resolve();
    expect(document.querySelectorAll(`${scope} [data-session-notice]`)).toHaveLength(1);
    expect(document.querySelector(`${scope} [data-session-recovery-control]`)).toBe(retry);
    unavailable = false;
    retry.click();
    await mounted.whenVerified();
    expect(document.querySelector('input')).toBe(input);
    expect(input.value).toBe('actual unsaved work');
    expect(input.disabled).toBe(false);
  } finally { mounted.destroy(); }
});
