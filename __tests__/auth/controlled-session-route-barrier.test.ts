import { EventEmitter } from 'events';
import type { Page, Route, Request, Response } from '@playwright/test';
import { ControlledSessionRouteBarrier } from '../../e2e/helpers/session-route-barrier';

const SESSION_URL = 'http://localhost:3000/api/auth/session';

interface Deferred<T = void> {
  promise: Promise<T>;
  resolve: (value: T | PromiseLike<T>) => void;
  reject: (reason?: unknown) => void;
}

function deferred<T = void>(): Deferred<T> {
  let resolve!: (value: T | PromiseLike<T>) => void;
  let reject!: (reason?: unknown) => void;
  const promise = new Promise<T>((res, rej) => {
    resolve = res;
    reject = rej;
  });
  return { promise, resolve, reject };
}

/**
 * Yield to the microtask queue. This is ordering, not synchronisation: it never
 * waits for wall-clock time and never hides a race behind a delay.
 */
async function flush(): Promise<void> {
  for (let i = 0; i < 8; i++) {
    await Promise.resolve();
  }
}

class MockRequest {
  constructor(
    public readonly _url: string = SESSION_URL,
    public readonly _method: string = 'GET',
    public readonly _status: number = 200,
    public readonly _error?: string
  ) {}

  public url(): string {
    return this._url;
  }

  public method(): string {
    return this._method;
  }

  public response(): Response | null {
    if (this._error) return null;
    return { status: () => this._status } as unknown as Response;
  }

  public failure(): { errorText: string } | null {
    return this._error ? { errorText: this._error } : null;
  }
}

class MockRoute {
  public aborted = false;
  public continued = false;
  public abortReason?: string;
  public continueGate?: Promise<void>;

  constructor(public readonly _request: Request) {}

  public request(): Request {
    return this._request;
  }

  public async abort(errorCode?: string): Promise<void> {
    this.aborted = true;
    this.abortReason = errorCode;
  }

  public async continue(): Promise<void> {
    if (this.continueGate) {
      await this.continueGate;
    }
    this.continued = true;
  }
}

class MockPage extends EventEmitter {
  public routeHandler?: (route: Route) => Promise<void>;
  public routePattern?: string;
  /** Ordered teardown log, used to prove shutdown ordering. */
  public readonly teardownLog: string[] = [];
  /** Injection hook fired synchronously inside unroute(). */
  public onUnroute?: () => void | Promise<void>;

  public async route(pattern: string, handler: (route: Route) => Promise<void>): Promise<void> {
    this.routePattern = pattern;
    this.routeHandler = handler;
  }

  public async unroute(pattern: string, handler: (route: Route) => Promise<void>): Promise<void> {
    if (this.routeHandler === handler) {
      this.routeHandler = undefined;
      this.routePattern = undefined;
    }
    this.teardownLog.push('unroute');
    if (this.onUnroute) {
      await this.onUnroute();
    }
  }

  public off(event: string, listener: (...args: unknown[]) => void): this {
    this.teardownLog.push(`off:${event}`);
    return super.off(event, listener) as this;
  }

  /**
   * Issue a request the way a browser does: the page announces it, and the
   * interceptor sees it only if one is still installed.
   */
  public issue(route: MockRoute): Promise<void> | undefined {
    this.emit('request', route.request());
    return this.routeHandler ? this.routeHandler(route as unknown as Route) : undefined;
  }

  public finish(request: MockRequest): void {
    this.emit('requestfinished', request);
  }

  public fail(request: MockRequest): void {
    this.emit('requestfailed', request);
  }
}

function newRoute(url: string = SESSION_URL): { request: MockRequest; route: MockRoute } {
  const request = new MockRequest(url);
  return { request, route: new MockRoute(request as unknown as Request) };
}

describe('ControlledSessionRouteBarrier', () => {
  let page: MockPage;

  beforeEach(() => {
    page = new MockPage();
  });

  const install = (options = {}) =>
    ControlledSessionRouteBarrier.install(page as unknown as Page, options);

  describe('R1 regression reproducer — TEST_HARNESS_REQUEST_DRAIN_RACE', () => {
    /**
     * Faithful reproduction of the pre-fix drain: a mutable Route[] queue and a
     * non-atomic `Promise.all(snapshot)`. Nothing here is asserted by constant —
     * the race is produced by real promise scheduling.
     */
    class LegacyPendingQueueHarness {
      public pending: Route[] = [];
      public hold = true;

      public async handleRoute(route: MockRoute): Promise<void> {
        if (this.hold) {
          this.pending.push(route as unknown as Route);
          return;
        }
        await route.continue();
      }

      public async drain(): Promise<void> {
        this.hold = false;
        const snapshot = this.pending;
        this.pending = [];
        await Promise.all(snapshot.map((route) => route.continue()));
      }
    }

    test('legacy non-atomic drain returns while a request admitted after the snapshot is still in flight', async () => {
      const legacy = new LegacyPendingQueueHarness();

      const a = newRoute();
      const gateA = deferred();
      a.route.continueGate = gateA.promise;
      await legacy.handleRoute(a.route);
      expect(legacy.pending).toHaveLength(1);

      // The snapshot is taken here; A's continue() is now parked on its gate.
      let drainReturned = false;
      const drainPromise = legacy.drain().then(() => {
        drainReturned = true;
      });
      await flush();
      expect(drainReturned).toBe(false);

      // B is admitted AFTER the snapshot, so the drain has no record of it.
      const b = newRoute();
      const gateB = deferred();
      b.route.continueGate = gateB.promise;
      const bInFlight = legacy.handleRoute(b.route);

      let bSettled = false;
      void bInFlight.then(() => {
        bSettled = true;
      });

      gateA.resolve();
      await drainPromise;

      // The defect, observed rather than declared: drain is done, B is not.
      expect(drainReturned).toBe(true);
      expect(bSettled).toBe(false);
      expect(b.route.continued).toBe(false);

      gateB.resolve();
      await bInFlight;
      expect(bSettled).toBe(true);
    });

    test('closeAndDrain does not return under the same choreography', async () => {
      const barrier = await install({ holdSubsequent: true });

      const a = newRoute();
      const gateA = deferred();
      a.route.continueGate = gateA.promise;
      const aHandler = page.issue(a.route)!;
      await flush();
      expect(barrier.held).toBe(1);

      let closeReturned = false;
      const closePromise = barrier.closeAndDrain().then((stats) => {
        closeReturned = true;
        return stats;
      });
      await flush();

      // A has been released and is parked inside continue(); the equivalent of
      // the legacy snapshot boundary.
      expect(barrier.state).toBe('CLOSING');
      expect(closeReturned).toBe(false);

      // B is issued after that boundary — exactly what the legacy drain missed.
      const b = newRoute();
      const gateB = deferred();
      b.route.continueGate = gateB.promise;
      const bHandler = page.issue(b.route)!;
      await flush();

      expect(barrier.started).toBe(2);
      expect(closeReturned).toBe(false);

      gateA.resolve();
      await aHandler;
      page.finish(a.request);
      await flush();

      // A is fully settled. The legacy drain returned here. This one must not.
      expect(barrier.finished).toBe(1);
      expect(closeReturned).toBe(false);

      gateB.resolve();
      await bHandler;
      page.finish(b.request);

      const stats = await closePromise;
      expect(closeReturned).toBe(true);
      expect(stats.started).toBe(2);
      expect(stats.finished).toBe(2);
      expect(stats.outstanding).toBe(0);
      expect(stats.activeHandlers).toBe(0);
      expect(barrier.state).toBe('CLOSED');
    });
  });

  describe('shutdown authority', () => {
    test('a request arriving during CLOSING is accounted and blocks the close', async () => {
      const barrier = await install({ holdSubsequent: true });

      // An in-flight request keeps the barrier genuinely in CLOSING.
      const held = newRoute();
      const heldHandler = page.issue(held.route)!;
      await flush();
      expect(barrier.held).toBe(1);

      const closePromise = barrier.closeAndDrain();
      await flush();
      expect(barrier.state).toBe('CLOSING');

      const late = newRoute();
      const lateHandler = page.issue(late.route)!;
      await flush();

      expect(barrier.started).toBe(2);
      expect(barrier.outstanding).toBe(2);
      expect(barrier.isDrained).toBe(false);
      // CLOSING must never hold a request in the controlled queue.
      expect(barrier.held).toBe(0);

      await heldHandler;
      page.finish(held.request);
      await lateHandler;
      page.finish(late.request);

      const stats = await closePromise;
      expect(stats.started).toBe(2);
      expect(stats.outstanding).toBe(0);
      expect(barrier.state).toBe('CLOSED');
    });

    test('a handler entered before close is awaited to completion', async () => {
      const barrier = await install({ holdSubsequent: false });

      const a = newRoute();
      const gate = deferred();
      a.route.continueGate = gate.promise;
      const handler = page.issue(a.route)!;
      await flush();

      expect(barrier.activeHandlers).toBe(1);

      let closed = false;
      const closePromise = barrier.closeAndDrain().then(() => {
        closed = true;
      });
      await flush();
      expect(closed).toBe(false);

      gate.resolve();
      await handler;
      await flush();
      expect(barrier.activeHandlers).toBe(0);
      expect(closed).toBe(false); // still outstanding on the network

      page.finish(a.request);
      await closePromise;
      expect(closed).toBe(true);
    });

    test('a request that finishes during close is counted as finished', async () => {
      const barrier = await install({ holdSubsequent: true });
      const a = newRoute();
      const handler = page.issue(a.route)!;
      await flush();

      const closePromise = barrier.closeAndDrain();
      await handler;
      page.finish(a.request);

      const stats = await closePromise;
      expect(stats.finished).toBe(1);
      expect(stats.failed).toBe(0);
      expect(stats.released).toBe(1);
    });

    test('a request that fails during close is counted as failed', async () => {
      const barrier = await install({ holdSubsequent: true });
      const a = newRoute();
      const handler = page.issue(a.route)!;
      await flush();

      const closePromise = barrier.closeAndDrain();
      await handler;
      page.fail(a.request);

      const stats = await closePromise;
      expect(stats.failed).toBe(1);
      expect(stats.finished).toBe(0);
      expect(stats.outstanding).toBe(0);
    });

    test('a request aborted by the barrier is accounted through requestfailed', async () => {
      const barrier = await install({ abortCount: 1, holdSubsequent: true });
      const a = newRoute();
      const handler = page.issue(a.route)!;
      await handler;

      expect(a.route.aborted).toBe(true);
      expect(a.route.abortReason).toBe('failed');
      expect(barrier.outstanding).toBe(1);

      const closePromise = barrier.closeAndDrain();
      page.fail(a.request);

      const stats = await closePromise;
      expect(stats.failed).toBe(1);
      expect(stats.outstanding).toBe(0);
    });

    test('a request issued after unroute is still accounted before CLOSED', async () => {
      const barrier = await install({ holdSubsequent: false });

      const late = newRoute();
      let lateIssued = false;

      page.onUnroute = () => {
        // The interceptor is gone, but the page still announces the request.
        page.emit('request', late.request);
        lateIssued = true;
      };

      const closePromise = barrier.closeAndDrain();
      await flush();

      expect(lateIssued).toBe(true);
      expect(barrier.started).toBe(1);
      expect(barrier.outstanding).toBe(1);
      expect(barrier.state).toBe('CLOSING');

      page.finish(late.request);
      const stats = await closePromise;

      expect(stats.finished).toBe(1);
      expect(stats.outstanding).toBe(0);
      expect(barrier.state).toBe('CLOSED');
    });

    test('route interception is removed before the accounting listeners', async () => {
      const barrier = await install({ holdSubsequent: false });
      await barrier.closeAndDrain();

      expect(page.teardownLog).toEqual([
        'unroute',
        'off:request',
        'off:requestfinished',
        'off:requestfailed',
      ]);
      expect(page.teardownLog.indexOf('unroute')).toBeLessThan(
        page.teardownLog.indexOf('off:requestfinished')
      );
    });

    test('close called twice shares one shutdown', async () => {
      const barrier = await install({ holdSubsequent: false });

      const first = barrier.closeAndDrain();
      const second = barrier.closeAndDrain();
      const [a, b] = await Promise.all([first, second]);

      expect(a).toEqual(b);
      expect(barrier.state).toBe('CLOSED');
      expect(page.teardownLog.filter((entry) => entry === 'unroute')).toHaveLength(1);
    });

    test('close after the barrier already drained is a no-op that still closes', async () => {
      const barrier = await install({ holdSubsequent: true });
      const a = newRoute();
      const handler = page.issue(a.route)!;
      await flush();

      const drainPromise = barrier.drain();
      await handler;
      page.finish(a.request);
      await drainPromise;

      expect(barrier.isDrained).toBe(true);
      expect(barrier.state).toBe('OPEN');

      const stats = await barrier.closeAndDrain();
      expect(stats.state).toBe('CLOSED');
      expect(stats.outstanding).toBe(0);
      expect(page.teardownLog.filter((entry) => entry === 'unroute')).toHaveLength(1);
    });

    test('detach is idempotent and delegates to the shutdown authority', async () => {
      const barrier = await install({ holdSubsequent: false });

      await barrier.detach();
      expect(barrier.state).toBe('CLOSED');

      await barrier.detach();
      await barrier.detach({ drainFirst: false });

      expect(page.teardownLog.filter((entry) => entry === 'unroute')).toHaveLength(1);
      expect(page.teardownLog.filter((entry) => entry === 'off:request')).toHaveLength(1);
    });

    test('detach({drainFirst:false}) still tears down in the safe order', async () => {
      const barrier = await install({ holdSubsequent: true });
      const a = newRoute();
      void page.issue(a.route);
      await flush();

      expect(barrier.held).toBe(1);

      await barrier.detach({ drainFirst: false });

      expect(barrier.state).toBe('CLOSED');
      expect(page.teardownLog).toEqual([
        'unroute',
        'off:request',
        'off:requestfinished',
        'off:requestfailed',
      ]);
    });
  });

  describe('accounting', () => {
    test('tracks the full lifecycle across held, released and finished states', async () => {
      const barrier = await install({ abortCount: 1, holdSubsequent: true });

      expect(barrier.stats).toMatchObject({
        started: 0,
        held: 0,
        finished: 0,
        failed: 0,
        outstanding: 0,
        activeHandlers: 0,
        state: 'OPEN',
      });
      expect(barrier.isDrained).toBe(true);

      const first = newRoute();
      await page.issue(first.route);
      expect(first.route.aborted).toBe(true);
      page.fail(first.request);
      expect(barrier.started).toBe(1);
      expect(barrier.failed).toBe(1);
      expect(barrier.outstanding).toBe(0);

      const second = newRoute();
      const handler = page.issue(second.route)!;
      await flush();
      expect(barrier.held).toBe(1);
      expect(barrier.outstanding).toBe(1);
      expect(barrier.isDrained).toBe(false);

      barrier.release();
      await handler;
      expect(second.route.continued).toBe(true);
      expect(barrier.held).toBe(0);
      expect(barrier.released).toBe(1);
      expect(barrier.outstanding).toBe(1);

      page.finish(second.request);
      expect(barrier.finished).toBe(1);
      expect(barrier.outstanding).toBe(0);
      barrier.assertIdle();

      await barrier.detach();
    });

    test('a request is counted once even though the page and the interceptor both see it', async () => {
      const barrier = await install({ holdSubsequent: false });
      const a = newRoute();
      await page.issue(a.route);

      expect(barrier.started).toBe(1);
      expect(barrier.records).toHaveLength(1);
      expect(barrier.records[0].intercepted).toBe(true);

      page.finish(a.request);
      await barrier.closeAndDrain();
    });

    test('non-matching requests are ignored', async () => {
      const barrier = await install({ holdSubsequent: false });

      page.emit('request', new MockRequest('http://localhost:3000/api/other'));
      expect(barrier.started).toBe(0);

      await barrier.closeAndDrain();
      expect(barrier.state).toBe('CLOSED');
    });

    test('a session request carrying a query string is still accounted', async () => {
      const barrier = await install({ holdSubsequent: false });
      const a = newRoute(`${SESSION_URL}?_=1732`);
      await page.issue(a.route);

      expect(barrier.started).toBe(1);

      page.finish(a.request);
      await barrier.closeAndDrain();
    });

    test('drain leaves the barrier OPEN and reusable', async () => {
      const barrier = await install({ holdSubsequent: true });

      const a = newRoute();
      const handlerA = page.issue(a.route)!;
      await flush();

      const drainPromise = barrier.drain();
      await handlerA;
      page.finish(a.request);
      const drained = await drainPromise;

      expect(drained.state).toBe('OPEN');
      expect(barrier.state).toBe('OPEN');
      expect(page.routeHandler).toBeDefined();

      await barrier.closeAndDrain();
      expect(barrier.state).toBe('CLOSED');
    });

    test('assertIdle fails while a handler is still mid-flight', async () => {
      const barrier = await install({ holdSubsequent: false });
      const a = newRoute();
      const gate = deferred();
      a.route.continueGate = gate.promise;
      const handler = page.issue(a.route)!;
      await flush();

      expect(() => barrier.assertIdle()).toThrow(/activeHandlers=1/);

      gate.resolve();
      await handler;
      page.finish(a.request);
      await barrier.closeAndDrain();
    });
  });
});
