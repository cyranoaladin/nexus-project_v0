import type { Page, Route, Request } from '@playwright/test';

export type SessionRouteLifecycleState =
  | 'STARTED'
  | 'HELD'
  | 'RELEASED'
  | 'FINISHED'
  | 'FAILED';

export interface SessionRouteRecord {
  id: number;
  url: string;
  method: string;
  state: SessionRouteLifecycleState;
  startTime: number;
  endTime?: number;
  error?: string;
  status?: number;
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
}

interface HeldEntry {
  route: Route;
  record: SessionRouteRecord;
  resolve: () => void;
}

/**
 * ControlledSessionRouteBarrier
 *
 * Deterministic request-drain barrier for Playwright E2E auth tests.
 * Solves the non-atomic drain race (R1) by explicitly accounting for every
 * intercepted session request through its full lifecycle:
 *   STARTED -> HELD -> RELEASED -> FINISHED / FAILED
 *
 * Ensures:
 *   1. started === finished + failed
 *   2. held === 0
 * before the drain operation returns.
 */
export class ControlledSessionRouteBarrier {
  private readonly _page: Page;
  private readonly _pattern: string;
  private readonly _options: ControlledSessionRouteBarrierOptions;

  private _seq = 0;
  private _abortRemaining: number;
  private _holdSubsequent: boolean;
  private _released = false;
  private _draining = false;
  private _detached = false;

  private _started = 0;
  private _held = 0;
  private _releasedCount = 0;
  private _finished = 0;
  private _failed = 0;

  private readonly _records: SessionRouteRecord[] = [];
  private readonly _recordByRequest = new Map<Request, SessionRouteRecord>();
  private readonly _heldQueue: HeldEntry[] = [];
  private readonly _listeners = new Set<() => void>();

  private readonly _routeHandler: (route: Route) => Promise<void>;
  private readonly _requestFinishedHandler: (request: Request) => void;
  private readonly _requestFailedHandler: (request: Request) => void;

  private constructor(page: Page, options: ControlledSessionRouteBarrierOptions = {}) {
    this._page = page;
    this._options = options;
    this._pattern = options.pattern ?? '**/api/auth/session';
    this._abortRemaining = options.abortCount ?? 0;
    this._holdSubsequent = options.holdSubsequent ?? true;

    this._routeHandler = this._handleRoute.bind(this);
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
    this._page.on('requestfinished', this._requestFinishedHandler);
    this._page.on('requestfailed', this._requestFailedHandler);
    await this._page.route(this._pattern, this._routeHandler);
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
   * Number of requests that started but have not yet finished or failed.
   */
  public get outstanding(): number {
    return this._started - (this._finished + this._failed);
  }

  /**
   * Returns true when all intercepted requests are settled and no requests are held.
   */
  public get isDrained(): boolean {
    return this._held === 0 && this.outstanding === 0;
  }

  public get stats(): BarrierStats {
    return {
      started: this._started,
      held: this._held,
      released: this._releasedCount,
      finished: this._finished,
      failed: this._failed,
      outstanding: this.outstanding,
    };
  }

  public get records(): readonly SessionRouteRecord[] {
    return [...this._records];
  }

  private _notifyChange(): void {
    for (const listener of this._listeners) {
      listener();
    }
  }

  private async _handleRoute(route: Route): Promise<void> {
    const request = route.request();
    const id = ++this._seq;
    const record: SessionRouteRecord = {
      id,
      url: request.url(),
      method: request.method(),
      state: 'STARTED',
      startTime: Date.now(),
    };

    this._records.push(record);
    this._recordByRequest.set(request, record);
    this._started++;
    this._notifyChange();

    const customAbort = this._options.shouldAbort?.(record, route);
    const shouldAbort = customAbort ?? (this._abortRemaining > 0);

    if (shouldAbort) {
      if (!customAbort) {
        this._abortRemaining--;
      }
      record.state = 'FAILED';
      this._failed++;
      this._notifyChange();
      await route.abort('failed');
      return;
    }

    const customHold = this._options.shouldHold?.(record, route);
    const shouldHold = !this._draining && !this._released && (customHold ?? this._holdSubsequent);

    if (shouldHold) {
      record.state = 'HELD';
      this._held++;
      this._notifyChange();

      await new Promise<void>((resolve) => {
        this._heldQueue.push({ route, record, resolve });
      });

      this._held--;
      this._releasedCount++;
      record.state = 'RELEASED';
      this._notifyChange();

      await route.continue();
      return;
    }

    this._releasedCount++;
    record.state = 'RELEASED';
    this._notifyChange();
    await route.continue();
  }

  private _handleRequestFinished(request: Request): void {
    const record = this._recordByRequest.get(request);
    if (!record) return;

    if (record.state !== 'FINISHED' && record.state !== 'FAILED') {
      record.state = 'FINISHED';
      record.endTime = Date.now();
      this._finished++;
      this._notifyChange();

      Promise.resolve(request.response())
        .then((response) => {
          record.status = response?.status();
        })
        .catch(() => {
          // Ignore
        });
    }
  }

  private _handleRequestFailed(request: Request): void {
    const record = this._recordByRequest.get(request);
    if (!record) return;

    if (record.state !== 'FINISHED' && record.state !== 'FAILED') {
      record.state = 'FAILED';
      record.endTime = Date.now();
      record.error = request.failure()?.errorText ?? 'failed';
      this._failed++;
      this._notifyChange();
    }
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
   * Wait until all held and in-flight requests are settled.
   * Invariant: held === 0 && started === finished + failed.
   */
  public async drain(options: { timeoutMs?: number } = {}): Promise<BarrierStats> {
    const timeoutMs = options.timeoutMs ?? 15_000;
    this._draining = true;
    this.release();

    if (this.isDrained) {
      return this.stats;
    }

    await new Promise<void>((resolve, reject) => {
      let timer: NodeJS.Timeout | undefined;

      const check = () => {
        if (this.isDrained) {
          if (timer) clearTimeout(timer);
          this._listeners.delete(check);
          resolve();
        }
      };

      this._listeners.add(check);

      timer = setTimeout(() => {
        this._listeners.delete(check);
        reject(
          new Error(
            `ControlledSessionRouteBarrier drain timeout after ${timeoutMs}ms. ` +
              `started=${this._started}, held=${this._held}, released=${this._releasedCount}, ` +
              `finished=${this._finished}, failed=${this._failed}, outstanding=${this.outstanding}`
          )
        );
      }, timeoutMs);

      // Initial check in case it settled synchronously
      check();
    });

    return this.stats;
  }

  /**
   * Assert that the barrier is completely idle (0 held, 0 outstanding).
   */
  public assertIdle(): void {
    if (this._held !== 0) {
      throw new Error(`ControlledSessionRouteBarrier assertion failed: held=${this._held} (expected 0)`);
    }
    if (this.outstanding !== 0) {
      throw new Error(
        `ControlledSessionRouteBarrier assertion failed: outstanding=${this.outstanding} ` +
          `(started=${this._started}, finished=${this._finished}, failed=${this._failed})`
      );
    }
  }

  /**
   * Cleanly detach the barrier from the page, unrouting the interceptor
   * and unregistering all event listeners.
   * If not yet drained, drains before detaching by default.
   */
  public async detach(options: { drainFirst?: boolean; timeoutMs?: number } = {}): Promise<void> {
    if (this._detached) return;

    if (options.drainFirst !== false && !this.isDrained) {
      await this.drain({ timeoutMs: options.timeoutMs });
    }

    this._page.off('requestfinished', this._requestFinishedHandler);
    this._page.off('requestfailed', this._requestFailedHandler);

    try {
      await this._page.unroute(this._pattern, this._routeHandler);
    } catch {
      // Ignore unroute errors if page or context already closed
    }

    this._detached = true;
  }
}
