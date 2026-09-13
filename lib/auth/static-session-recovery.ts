import { SessionRecoveryController, sessionIdentity } from './client-session-recovery';

/** DOM projection for the standalone Planning document; all policy stays in the shared controller. */
export function mountStaticSessionRecovery(options: { onSessionEnded(): void; onIdentityChanged(): void }) {
  const root = document.getElementById('app');
  const modalRoot = document.getElementById('modalRoot');
  if (!root || !modalRoot) throw new Error('PROTECTED_PLANNING_ROOT_REQUIRED');
  const controller = new SessionRecoveryController(
    signal => fetch('/api/auth/session', { credentials: 'same-origin', cache: 'no-store', signal }),
    async () => null, null, undefined, 'canonical-server',
  );
  const disabled = new Map<HTMLInputElement | HTMLButtonElement | HTMLSelectElement | HTMLTextAreaElement, boolean>();
  const waiters = new Set<{ resolve(): void; reject(error: Error): void }>();
  let identity = '';
  let retired = false;
  const banner = document.createElement('div');
  root.before(banner);

  function notice(container: Element, visible: boolean, unavailable: boolean) {
    let element = container.querySelector<HTMLDivElement>(':scope > [data-session-notice]');
    if (!element) {
      element = document.createElement('div');
      element.dataset.sessionNotice = 'true';
      element.setAttribute('role', 'status');
      element.className = 'session-recovery-notice';
      const message = document.createElement('p');
      const retry = document.createElement('button');
      retry.type = 'button'; retry.className = 'btn'; retry.dataset.sessionRecoveryControl = 'true';
      retry.textContent = 'Réessayer la vérification'; retry.addEventListener('click', controller.retry);
      element.append(message, retry); container.prepend(element);
    }
    element.hidden = !visible;
    const message = unavailable
      ? 'La vérification de session est indisponible. Votre travail est conservé ; les actions sont suspendues.'
      : 'Vérification de votre session en cours. Votre travail est conservé.';
    if (element.firstElementChild?.textContent !== message) element.firstElementChild!.textContent = message;
  }

  function update() {
    if (retired) return;
    const snapshot = controller.getSnapshot();
    if (snapshot.state.endsWith('_CONFIRMED')) {
      retired = true;
      root!.replaceChildren(); modalRoot!.replaceChildren();
      waiters.forEach(waiter => waiter.reject(new Error('SESSION_TERMINATED'))); waiters.clear();
      options.onSessionEnded(); return;
    }
    const nextIdentity = sessionIdentity(controller.getView().data);
    if (nextIdentity && identity && nextIdentity !== identity) {
      retired = true;
      controller.stop();
      root!.replaceChildren(); modalRoot!.replaceChildren();
      waiters.forEach(waiter => waiter.reject(new Error('SESSION_IDENTITY_CHANGED'))); waiters.clear();
      options.onIdentityChanged(); return;
    }
    if (nextIdentity) identity = nextIdentity;
    const visible = !snapshot.canMutate;
    notice(banner, visible, snapshot.state === 'UNAVAILABLE');
    modalRoot!.querySelectorAll('.modal').forEach(modal => notice(modal, visible, snapshot.state === 'UNAVAILABLE'));
    for (const scope of [root!, modalRoot!]) {
      scope.querySelectorAll<HTMLInputElement | HTMLButtonElement | HTMLSelectElement | HTMLTextAreaElement>('input,button,select,textarea').forEach(control => {
        if (control.closest('[data-session-notice]')) return;
        if (visible) {
          if (!disabled.has(control)) disabled.set(control, control.disabled);
          control.disabled = true;
        }
      });
    }
    if (!visible) {
      disabled.forEach((wasDisabled, control) => { control.disabled = wasDisabled; }); disabled.clear();
      waiters.forEach(waiter => waiter.resolve()); waiters.clear();
    }
  }
  const unsubscribe = controller.subscribe(update);
  const observer = new MutationObserver(update);
  observer.observe(root, { childList: true, subtree: true });
  observer.observe(modalRoot, { childList: true, subtree: true });
  const block = (event: Event) => {
    if (controller.getSnapshot().canMutate) return;
    const element = event.target instanceof Element ? event.target : null;
    if (element?.closest('[data-session-recovery-control]')) return;
    if (element && (root.contains(element) || modalRoot.contains(element))) {
      event.preventDefault(); event.stopImmediatePropagation();
    }
  };
  for (const type of ['click', 'submit', 'keydown', 'pointerdown', 'drop']) document.addEventListener(type, block, true);
  const observe = () => controller.observe({ data: null, status: 'loading' }, location.pathname + location.search);
  const refresh = () => { if (!retired && document.visibilityState !== 'hidden') controller.retry(); };
  const restore = (event: PageTransitionEvent) => { if (event.persisted && !retired) observe(); };
  const stop = () => controller.stop();
  window.addEventListener('pagehide', stop);
  window.addEventListener('pageshow', restore);
  window.addEventListener('online', refresh);
  window.addEventListener('focus', refresh);
  document.addEventListener('visibilitychange', refresh);
  const channel = typeof BroadcastChannel === 'undefined' ? null : new BroadcastChannel('next-auth');
  channel?.addEventListener('message', refresh);
  observe();
  return {
    controller,
    /** Bootstrap/readiness only. Privileged actions must capture a ticket, never await/replay here. */
    whenVerified(): Promise<void> {
      if (retired) return Promise.reject(new Error('SESSION_TERMINATED'));
      if (controller.getSnapshot().canMutate) return Promise.resolve();
      return new Promise((resolve, reject) => { waiters.add({ resolve, reject }); });
    },
    destroy() {
      retired = true; unsubscribe(); observer.disconnect(); controller.stop(); channel?.close();
      waiters.forEach(waiter => waiter.reject(new Error('SESSION_OBSERVER_STOPPED'))); waiters.clear();
      for (const type of ['click', 'submit', 'keydown', 'pointerdown', 'drop']) document.removeEventListener(type, block, true);
      window.removeEventListener('pagehide', stop); window.removeEventListener('pageshow', restore);
      window.removeEventListener('online', refresh); window.removeEventListener('focus', refresh);
      document.removeEventListener('visibilitychange', refresh); banner.remove();
    },
  };
}
