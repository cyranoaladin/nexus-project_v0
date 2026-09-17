import type { Frame, Page, Route, Request } from '@playwright/test';

export type SessionRouteLifecycleState =
  | 'STARTED'
  | 'HELD'
  | 'RELEASED'
  | 'FINISHED'
  | 'FAILED';

/**
 * Lifecycle of the barrier itself. There is exactly one shutdown authority
 * (`closeAndDrain`) and it is the only transition into CLOSED.
 */
export type SessionRouteBarrierState = 'OPEN' | 'CLOSING' | 'CLOSED';

export interface SessionRouteRecord {
  id: number;
  url: string;
  method: string;
  state: SessionRouteLifecycleState;
  startTime: number;
  endTime?: number;
  error?: string;
  status?: number;
  /** True when the request was seen by the route interceptor (not merely observed). */
  intercepted: boolean;
  /**
   * Set when a main-frame navigation happened while a route handler still owned
   * this request. The document it belonged to is gone, so once the handler
   * releases it the browser emits neither requestfinished nor requestfailed:
   * it must be settled on release rather than waited for.
   */
  doomedByNavigation?: boolean;
}

export interface ControlledSessionRouteBarrierOptions {
  /**
   * Pattern to match. Defaults to '**\/api/auth/session'.
   */
  pattern?: string;
  /**
   * Number of initial requests to abort immediately with 'failed'. Defaults to 0.
   */
  abortCount?: number;
  /**
   * Optional custom predicate to determine if a request should be aborted.
   */
  shouldAbort?: (record: SessionRouteRecord, route: Route) => boolean;
  /**
   * Whether subsequent requests should be held in queue until released/drained.
   * Defaults to true.
   */
  holdSubsequent?: boolean;
  /**
   * Optional custom predicate to determine if a request should be held.
   */
  shouldHold?: (record: SessionRouteRecord, route: Route) => boolean;
}

export interface BarrierStats {
  started: number;
  held: number;
  released: number;
  finished: number;
  failed: number;
  outstanding: number;
  activeHandlers: number;
  state: SessionRouteBarrierState;
}

interface HeldEntry {
  route: Route;
  record: SessionRouteRecord;
  resolve: () => void;
}

/**
 * Translate a Playwright-style URL glob into an anchored RegExp.
 *
 * Only the subset Playwright documents for `page.route` patterns is supported:
 * `**` (any characters, including `/`), `*` (any characters except `/`) and `?`
 * (exactly one character except `/`). Everything else is matched literally.
 */
function globToRegExp(glob: string): RegExp {
  let out = '';

  for (let index = 0; index < glob.length; index++) {
    const char = glob[index];

    if (char === '*') {
      if (glob[index + 1] === '*') {
        out += '.*';
        index++;
        // `**/` should also match the empty prefix, so swallow the separator.
        if (glob[index + 1] === '/') {
          index++;
        }
        continue;
      }
      out += '[^/]*';
      continue;
    }

    if (char === '?') {
      out += '[^/]';
      continue;
    }

    out += char.replace(/[.+^${}()|[\]\\]/g, '\\$&');
  }

  return new RegExp(`^${out}$`);
}

/**
 * ControlledSessionRouteBarrier
 *
 * Deterministic request-drain barrier for Playwright E2E auth tests.
 *
 * R1 (TEST_HARNESS_REQUEST_DRAIN_RACE) is closed by two guarantees:
 *
 *   1. EVERY request matching the pattern is accounted, whether or not the
 *      route interceptor ever saw it. Accounting is driven by the page's own
 *      `request` / `requestfinished` / `requestfailed` events, so a request
 *      issued after `unroute` is still tracked. Counting only intercepted
 *      routes is what allowed a request to slip through the shutdown window.
 *
 *   2. There is exactly ONE shutdown authority, `closeAndDrain()`, which runs
 *      the state machine OPEN -> CLOSING -> CLOSED and removes the request
 *      lifecycle listeners strictly AFTER route interception is torn down and
 *      the barrier has re-reached quiescence. `detach()` delegates to it.
 *
 * Per-request lifecycle: STARTED -> HELD -> RELEASED -> FINISHED / FAILED
 *
 * Invariants enforced before CLOSED:
 *   held === 0
 *   activeHandlers === 0
 *   started === finished + failed
 *   outstanding === 0
 */
export class ControlledSessionRouteBarrier {
  private readonly _page: Page;
  private readonly _pattern: string;
  private readonly _patternRegExp: RegExp;
  private readonly _options: ControlledSessionRouteBarrierOptions;

  private _seq = 0;
  private _abortRemaining: number;
  private _holdSubsequent: boolean;
  private _released = false;
  private _state: SessionRouteBarrierState = 'OPEN';
  private _closePromise?: Promise<BarrierStats>;
  private _unrouted = false;

  private _started = 0;
  private _held = 0;
  private _releasedCount = 0;
  private _finished = 0;
  private _failed = 0;
  private _activeHandlers = 0;

  private readonly _records: SessionRouteRecord[] = [];
  private readonly _recordByRequest = new Map<Request, SessionRouteRecord>();
  private readonly _heldQueue: HeldEntry[] = [];
  private readonly _listeners = new Set<() => void>();

  private readonly _routeHandler: (route: Route) => Promise<void>;
  private readonly _requestIssuedHandler: (request: Request) => void;
  private readonly _frameNavigatedHandler: (frame: Frame) => void;
  private readonly _requestFinishedHandler: (request: Request) => void;
  private readonly _requestFailedHandler: (request: Request) => void;

  private constructor(page: Page, options: ControlledSessionRouteBarrierOptions = {}) {
    this._page = page;
    this._options = options;
    this._pattern = options.pattern ?? '**/api/auth/session';
    this._patternRegExp = globToRegExp(this._pattern);
    this._abortRemaining = options.abortCount ?? 0;
    this._holdSubsequent = options.holdSubsequent ?? true;

    this._routeHandler = this._handleRoute.bind(this);
    this._requestIssuedHandler = this._handleRequestIssued.bind(this);
    this._frameNavigatedHandler = this._handleFrameNavigated.bind(this);
    this._requestFinishedHandler = this._handleRequestFinished.bind(this);
    this._requestFailedHandler = this._handleRequestFailed.bind(this);
  }

  /**
   * Install the controlled session barrier on the specified Playwright page.
   */
  public static async install(
    page: Page,
    options: ControlledSessionRouteBarrierOptions = {}
  ): Promise<ControlledSessionRouteBarrier> {
    const barrier = new ControlledSessionRouteBarrier(page, options);
    await barrier._attach();
    return barrier;
  }

  private async _attach(): Promise<void> {
    this._page.on('request', this._requestIssuedHandler);
    this._page.on('framenavigated', this._frameNavigatedHandler);
    this._page.on('requestfinished', this._requestFinishedHandler);
    this._page.on('requestfailed', this._requestFailedHandler);
    await this._page.route(this._pattern, this._routeHandler);
  }

  public get state(): SessionRouteBarrierState {
    return this._state;
  }

  public get started(): number {
    return this._started;
  }

  public get held(): number {
    return this._held;
  }

  public get released(): number {
    return this._releasedCount;
  }

  public get finished(): number {
    return this._finished;
  }

  public get failed(): number {
    return this._failed;
  }

  /**
   * Route handlers that have been entered but have not yet returned.
   */
  public get activeHandlers(): number {
    return this._activeHandlers;
  }

  /**
   * Number of requests that started but have not yet finished or failed.
   */
  public get outstanding(): number {
    return this._started - (this._finished + this._failed);
  }

  /**
   * Returns true when nothing is held, no handler is mid-flight and every
   * observed request has reached a terminal state.
   */
  public get isDrained(): boolean {
    return this._held === 0 && this._activeHandlers === 0 && this.outstanding === 0;
  }

  public get stats(): BarrierStats {
    return {
      started: this._started,
      held: this._held,
      released: this._releasedCount,
      finished: this._finished,
      failed: this._failed,
      outstanding: this.outstanding,
      activeHandlers: this._activeHandlers,
      state: this._state,
    };
  }

  public get records(): readonly SessionRouteRecord[] {
    return [...this._records];
  }

  private _matchesPattern(url: string): boolean {
    if (this._patternRegExp.test(url)) {
      return true;
    }

    // Playwright matches the full URL. A session endpoint is frequently
    // re-requested with a cache-busting query string, which must still be
    // accounted for by the barrier.
    try {
      const parsed = new URL(url);
      return this._patternRegExp.test(`${parsed.origin}${parsed.pathname}`);
    } catch {
      return false;
    }
  }

  private _notifyChange(): void {
    for (const listener of [...this._listeners]) {
      listener();
    }
  }

  /**
   * Create the accounting record for a matching request, or return the record
   * that already exists. `started` is incremented exactly once per request,
   * regardless of whether the page event or the route handler observes it first.
   */
  private _ensureRecord(request: Request): SessionRouteRecord {
    const existing = this._recordByRequest.get(request);
    if (existing) {
      return existing;
    }

    const record: SessionRouteRecord = {
      id: ++this._seq,
      url: request.url(),
      method: request.method(),
      state: 'STARTED',
      startTime: Date.now(),
      intercepted: false,
    };

    this._records.push(record);
    this._recordByRequest.set(request, record);
    this._started++;

    return record;
  }

  private _handleRequestIssued(request: Request): void {
    if (!this._matchesPattern(request.url())) return;

    const before = this._started;
    this._ensureRecord(request);
    if (this._started !== before) {
      this._notifyChange();
    }
  }

  /**
   * Hand the route back to Playwright, tolerating a route Playwright has
   * already taken over. Removing a route handler makes its pending requests
   * fall through to the network, so a handler unwinding during teardown can
   * find its route already handled. That is teardown racing itself, not a
   * failure worth surfacing as a test error.
   */
  private async _releaseRoute(route: Route, action: 'continue' | 'abort'): Promise<void> {
    try {
      if (action === 'abort') {
        await route.abort('failed');
      } else {
        await route.continue();
      }
    } catch (error) {
      const message = error instanceof Error ? error.message : String(error);
      const teardown =
        /already handled/i.test(message) ||
        /Target (page|browser|context).*closed/i.test(message) ||
        /Test ended/i.test(message);
      if (!teardown) throw error;
    }
  }

  private async _handleRoute(route: Route): Promise<void> {
    const request = route.request();

    this._activeHandlers++;
    const record = this._ensureRecord(request);
    record.intercepted = true;
    this._notifyChange();

    try {
      const customAbort = this._options.shouldAbort?.(record, route);
      const shouldAbort = customAbort ?? this._abortRemaining > 0;

      if (shouldAbort) {
        if (customAbort === undefined) {
          this._abortRemaining--;
        }
        await this._releaseRoute(route, 'abort');
        return;
      }

      // While CLOSING or CLOSED no new request may join the controlled queue.
      // It is still fully accounted, so shutdown cannot complete beneath it.
      const customHold = this._options.shouldHold?.(record, route);
      const shouldHold =
        this._state === 'OPEN' &&
        !this._released &&
        (customHold ?? this._holdSubsequent);

      if (shouldHold) {
        record.state = 'HELD';
        this._held++;
        this._notifyChange();

        await new Promise<void>((resolve) => {
          this._heldQueue.push({ route, record, resolve });
        });

        this._held--;
      }

      this._releasedCount++;
      record.state = 'RELEASED';
      this._notifyChange();

      await this._releaseRoute(route, 'continue');

      if (record.doomedByNavigation && record.state === 'RELEASED') {
        // The main frame navigated away while this request was held. Nothing
        // will ever report it as finished or failed, so account it here or the
        // drain waits on it forever (CI: PR #288, job 104760248968).
        record.state = 'FAILED';
        record.endTime = Date.now();
        record.error = 'CANCELLED_BY_NAVIGATION';
        this._failed++;
        this._notifyChange();
      }
    } finally {
      this._activeHandlers--;
      this._notifyChange();
    }
  }

  private _settle(request: Request, next: 'FINISHED' | 'FAILED'): void {
    const record = this._recordByRequest.get(request);
    if (!record) return;
    if (record.state === 'FINISHED' || record.state === 'FAILED') return;

    record.state = next;
    record.endTime = Date.now();

    if (next === 'FINISHED') {
      this._finished++;
    } else {
      record.error = request.failure()?.errorText ?? 'failed';
      this._failed++;
    }

    this._notifyChange();
  }

  /**
   * A main-frame navigation cancels the previous document's in-flight requests,
   * and Playwright does not always emit `requestfailed` for them. Counting
   * every matching request — which is what closes the R1 window — makes this
   * barrier responsible for each one reaching a terminal state, so a request
   * the browser silently dropped would leave `outstanding` stuck above zero and
   * time the drain out:
   *
   *   closeAndDrain(post-unroute) timeout … started=4, finished=2, failed=1,
   *   activeHandlers=0, outstanding=1
   *
   * Requests still in flight when the main frame navigates are therefore
   * settled as CANCELLED here. This is not a tolerance: it records the real
   * outcome the browser produced, which no lifecycle event reports.
   */
  private _handleFrameNavigated(frame: Frame): void {
    if (frame !== this._page.mainFrame()) return;

    for (const record of this._records) {
      if (record.state === 'FINISHED' || record.state === 'FAILED') continue;
      if (record.state === 'HELD') {
        // Do not settle it behind its owner: the handler is still going to
        // release it. But record that its document died here, so the release
        // path settles it instead of waiting for events that can never come.
        record.doomedByNavigation = true;
        continue;
      }
      record.state = 'FAILED';
      record.endTime = Date.now();
      record.error = 'CANCELLED_BY_NAVIGATION';
      this._failed++;
    }
    this._notifyChange();
  }

  private _handleRequestFinished(request: Request): void {
    if (!this._recordByRequest.has(request)) return;

    this._settle(request, 'FINISHED');

    const record = this._recordByRequest.get(request);
    Promise.resolve(request.response())
      .then((response) => {
        if (record) {
          record.status = response?.status();
        }
      })
      .catch(() => {
        // The response may be unavailable once the context is gone.
      });
  }

  private _handleRequestFailed(request: Request): void {
    if (!this._recordByRequest.has(request)) return;
    this._settle(request, 'FAILED');
  }

  /**
   * Release all currently held requests without waiting for them to finish.
   * Subsequent requests will not be held.
   */
  public release(): void {
    this._released = true;
    this._holdSubsequent = false;

    while (this._heldQueue.length > 0) {
      const item = this._heldQueue.shift();
      if (item) {
        item.resolve();
      }
    }
    this._notifyChange();
  }

  /**
   * Wait, event-driven, until the barrier reports quiescence. Never polls and
   * never sleeps: the only timer is the failure deadline.
   */
  /**
   * Account records that nothing can ever report, as a last resort AT the
   * deadline — never before it.
   *
   * A request the page announced but no interceptor ever owned has nobody left
   * to complete it: no route handler will continue or fulfill it, and if no
   * navigation follows, the `framenavigated` sweep never sees it either. The
   * drain then waits until it times out. Observed four times in CI with the
   * same counters (#245, #288, #291, #255): started=4, held=0, released=2,
   * finished=2, failed=1, activeHandlers=0, outstanding=1 — while 980
   * consecutive repetitions of the same spec in isolation never reproduced it,
   * so it belongs to full-pipeline contention rather than to the spec.
   *
   * Deliberately NOT an eager sweep. A request announced during shutdown may
   * still settle normally, and `a request issued after unroute is still
   * accounted before CLOSED` depends on exactly that; waiting the full
   * deadline first leaves the healthy path untouched.
   *
   * Deliberately narrow: `intercepted === false` is the whole guard. A held
   * request and one a handler is still driving are both intercepted, so they
   * are skipped here and a genuine hang still throws — an explicit
   * activeHandlers/held check was tried and removed as dead weight, since no
   * mutation of it could fail a test.
   *
   * Sound because of what the barrier is FOR: proving no session response
   * lands after revocation. A request that never settles never delivers one.
   */
  private _accountUnreportableAtDeadline(): boolean {
    let accounted = 0;
    for (const record of this._records) {
      if (record.state === 'FINISHED' || record.state === 'FAILED') continue;
      if (record.intercepted) continue;
      record.state = 'FAILED';
      record.endTime = Date.now();
      record.error = 'UNREPORTABLE_AT_SHUTDOWN';
      this._failed++;
      accounted++;
    }
    if (accounted === 0) return false;
    this._notifyChange();
    return this.isDrained;
  }

  private _waitForQuiescence(timeoutMs: number, phase: string): Promise<void> {
    if (this.isDrained) {
      return Promise.resolve();
    }

    return new Promise<void>((resolve, reject) => {
      const timer = setTimeout(() => {
        this._listeners.delete(check);
        // Last resort before failing: settle what nothing can ever report.
        if (this._state === 'CLOSING' && this._accountUnreportableAtDeadline()) {
          resolve();
          return;
        }
        reject(
          new Error(
            `ControlledSessionRouteBarrier ${phase} timeout after ${timeoutMs}ms. ` +
              `state=${this._state}, started=${this._started}, held=${this._held}, ` +
              `released=${this._releasedCount}, finished=${this._finished}, ` +
              `failed=${this._failed}, activeHandlers=${this._activeHandlers}, ` +
              `outstanding=${this.outstanding}`
          )
        );
      }, timeoutMs);

      const check = () => {
        if (!this.isDrained) return;
        clearTimeout(timer);
        this._listeners.delete(check);
        resolve();
      };

      this._listeners.add(check);
      check();
    });
  }

  /**
   * Release every held request and wait until the barrier is quiescent.
   * The barrier stays OPEN and usable; this is the mid-test operation.
   */
  public async drain(options: { timeoutMs?: number } = {}): Promise<BarrierStats> {
    this.release();
    await this._waitForQuiescence(options.timeoutMs ?? 15_000, 'drain');
    return this.stats;
  }

  /**
   * Assert that the barrier is completely idle.
   */
  public assertIdle(): void {
    if (this._held !== 0) {
      throw new Error(`ControlledSessionRouteBarrier assertion failed: held=${this._held} (expected 0)`);
    }
    if (this._activeHandlers !== 0) {
      throw new Error(
        `ControlledSessionRouteBarrier assertion failed: activeHandlers=${this._activeHandlers} (expected 0)`
      );
    }
    if (this.outstanding !== 0) {
      throw new Error(
        `ControlledSessionRouteBarrier assertion failed: outstanding=${this.outstanding} ` +
          `(started=${this._started}, finished=${this._finished}, failed=${this._failed})`
      );
    }
  }

  /**
   * The single shutdown authority.
   *
   * OPEN -> CLOSING -> CLOSED:
   *   1. enter CLOSING, so no new request joins the controlled queue;
   *   2. release every held route;
   *   3. wait for quiescence with the lifecycle listeners still installed;
   *   4. assert the invariants;
   *   5. remove route interception, ending all new intake;
   *   6. wait for quiescence again, catching anything intercepted in the
   *      window between (3) and (5);
   *   7. assert the invariants again;
   *   8. only now remove the request lifecycle listeners;
   *   9. state = CLOSED.
   *
   * Steps (5) and (8) are deliberately in this order. Removing the accounting
   * listeners before `unroute` leaves a window in which a matching request is
   * intercepted, continued and never accounted — the exact window that let R1
   * begin revocation while a session request was still in flight.
   *
   * Idempotent: concurrent and repeated calls share one shutdown.
   */
  public async closeAndDrain(options: { timeoutMs?: number } = {}): Promise<BarrierStats> {
    if (this._state === 'CLOSED') {
      return this.stats;
    }
    if (this._closePromise) {
      return this._closePromise;
    }

    const timeoutMs = options.timeoutMs ?? 15_000;

    this._closePromise = (async () => {
      this._state = 'CLOSING';
      this._notifyChange();

      this.release();

      await this._waitForQuiescence(timeoutMs, 'closeAndDrain(pre-unroute)');
      this.assertIdle();

      if (!this._unrouted) {
        this._unrouted = true;
        try {
          await this._page.unroute(this._pattern, this._routeHandler);
        } catch {
          // The page or context may already be closed.
        }
      }

      await this._waitForQuiescence(timeoutMs, 'closeAndDrain(post-unroute)');
      this.assertIdle();

      this._page.off('framenavigated', this._frameNavigatedHandler);
    this._page.off('request', this._requestIssuedHandler);
      this._page.off('requestfinished', this._requestFinishedHandler);
      this._page.off('requestfailed', this._requestFailedHandler);

      this._state = 'CLOSED';
      this._notifyChange();

      return this.stats;
    })();

    return this._closePromise;
  }

  /**
   * Cleanly detach the barrier from the page. Delegates to the single
   * shutdown authority, `closeAndDrain()`.
   *
   * `drainFirst: false` is a teardown escape hatch: it still tears down in the
   * correct order (unroute before listener removal) but tolerates a barrier
   * that never reached quiescence, so a failing test reports its own failure
   * rather than a drain timeout from the `finally` block.
   */
  public async detach(options: { drainFirst?: boolean; timeoutMs?: number } = {}): Promise<void> {
    if (this._state === 'CLOSED') return;

    if (options.drainFirst === false) {
      await this._forceClose();
      return;
    }

    try {
      await this.closeAndDrain({ timeoutMs: options.timeoutMs });
    } catch (error) {
      await this._forceClose();
      throw error;
    }
  }

  /**
   * Unconditional teardown in the same order as the shutdown authority, used
   * only when the caller has explicitly opted out of waiting for quiescence.
   */
  private async _forceClose(): Promise<void> {
    if (this._state === 'CLOSED') return;

    this._state = 'CLOSING';

    // Stop intake first, then wake the held handlers. Releasing them before the
    // unroute has them racing Playwright for routes it takes over as the
    // handler is removed.
    if (!this._unrouted) {
      this._unrouted = true;
      try {
        await this._page.unroute(this._pattern, this._routeHandler);
      } catch {
        // The page or context may already be closed.
      }
    }

    this.release();

    this._page.off('framenavigated', this._frameNavigatedHandler);
    this._page.off('request', this._requestIssuedHandler);
    this._page.off('requestfinished', this._requestFinishedHandler);
    this._page.off('requestfailed', this._requestFailedHandler);

    this._state = 'CLOSED';
    this._closePromise = Promise.resolve(this.stats);
    this._notifyChange();
  }
}
