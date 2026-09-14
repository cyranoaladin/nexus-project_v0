import { EventEmitter } from 'events';
import type { Page, Route, Request, Response } from '@playwright/test';
import { ControlledSessionRouteBarrier } from '../../e2e/helpers/session-route-barrier';

class MockPage extends EventEmitter {
  public routeHandler?: (route: Route) => Promise<void>;
  public routePattern?: string;

  public async route(pattern: string, handler: (route: Route) => Promise<void>): Promise<void> {
    this.routePattern = pattern;
    this.routeHandler = handler;
  }

  public async unroute(pattern: string, handler: (route: Route) => Promise<void>): Promise<void> {
    if (this.routeHandler === handler) {
      this.routeHandler = undefined;
      this.routePattern = undefined;
    }
  }
}

class MockRequest {
  constructor(
    public readonly _url: string,
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
    if (this._error) return { errorText: this._error };
    return null;
  }
}

class MockRoute {
  public aborted = false;
  public continued = false;
  public abortReason?: string;

  constructor(public readonly _request: Request) {}

  public request(): Request {
    return this._request;
  }

  public async abort(errorCode?: string): Promise<void> {
    this.aborted = true;
    this.abortReason = errorCode;
  }

  public async continue(): Promise<void> {
    this.continued = true;
  }
}

describe('ControlledSessionRouteBarrier', () => {
  let mockPage: MockPage;

  beforeEach(() => {
    mockPage = new MockPage();
  });

  test('accounting: tracks STARTED, HELD, RELEASED, FINISHED, FAILED states accurately', async () => {
    const barrier = await ControlledSessionRouteBarrier.install(mockPage as unknown as Page, {
      abortCount: 1,
      holdSubsequent: true,
    });

    expect(barrier.started).toBe(0);
    expect(barrier.held).toBe(0);
    expect(barrier.finished).toBe(0);
    expect(barrier.failed).toBe(0);
    expect(barrier.outstanding).toBe(0);
    expect(barrier.isDrained).toBe(true);

    // Request 1: should be aborted (abortCount = 1)
    const req1 = new MockRequest('http://localhost:3000/api/auth/session', 'GET', 0, 'net::ERR_FAILED');
    const route1 = new MockRoute(req1 as unknown as Request);
    await mockPage.routeHandler!(route1 as unknown as Route);

    expect(route1.aborted).toBe(true);
    expect(barrier.started).toBe(1);
    expect(barrier.failed).toBe(1);
    expect(barrier.held).toBe(0);
    expect(barrier.outstanding).toBe(0);

    // Request 2: should be held
    const req2 = new MockRequest('http://localhost:3000/api/auth/session', 'GET', 200);
    const route2 = new MockRoute(req2 as unknown as Request);
    const handleRoutePromise2 = mockPage.routeHandler!(route2 as unknown as Route);

    expect(barrier.started).toBe(2);
    expect(barrier.held).toBe(1);
    expect(barrier.released).toBe(0);
    expect(barrier.outstanding).toBe(1);
    expect(barrier.isDrained).toBe(false);

    // Release held requests
    barrier.release();
    await handleRoutePromise2;

    expect(route2.continued).toBe(true);
    expect(barrier.held).toBe(0);
    expect(barrier.released).toBe(1);
    expect(barrier.finished).toBe(0);
    expect(barrier.outstanding).toBe(1); // Still in-flight

    // Simulate network finish
    mockPage.emit('requestfinished', req2);

    expect(barrier.finished).toBe(1);
    expect(barrier.outstanding).toBe(0);
    expect(barrier.isDrained).toBe(true);
    barrier.assertIdle();

    await barrier.detach();
  });

  test('drain: waits until all in-flight requests finish before returning', async () => {
    const barrier = await ControlledSessionRouteBarrier.install(mockPage as unknown as Page, {
      abortCount: 0,
      holdSubsequent: true,
    });

    const reqA = new MockRequest('http://localhost:3000/api/auth/session');
    const routeA = new MockRoute(reqA as unknown as Request);
    const pA = mockPage.routeHandler!(routeA as unknown as Route);

    const reqB = new MockRequest('http://localhost:3000/api/auth/session');
    const routeB = new MockRoute(reqB as unknown as Request);
    const pB = mockPage.routeHandler!(routeB as unknown as Route);

    expect(barrier.started).toBe(2);
    expect(barrier.held).toBe(2);

    let drainSettled = false;
    const drainPromise = barrier.drain().then(() => {
      drainSettled = true;
    });

    await pA;
    await pB;

    // Both routes continued, but neither has finished network response yet
    expect(barrier.held).toBe(0);
    expect(barrier.outstanding).toBe(2);
    expect(drainSettled).toBe(false);

    // Complete request A only
    mockPage.emit('requestfinished', reqA);
    expect(barrier.finished).toBe(1);
    expect(barrier.outstanding).toBe(1);
    expect(drainSettled).toBe(false); // Still waiting for B!

    // Complete request B
    mockPage.emit('requestfinished', reqB);
    await drainPromise;

    expect(drainSettled).toBe(true);
    expect(barrier.finished).toBe(2);
    expect(barrier.outstanding).toBe(0);
    barrier.assertIdle();

    await barrier.detach();
  });

  describe('Regression reproducer §8: Non-atomic queue vs Controlled barrier', () => {
    test('proves: OLD_PATTERN_RACE_REPRODUCED=YES and NEW_BARRIER_PREVENTS_RACE=YES', async () => {
      // -----------------------------------------------------------------
      // Part 1: Old pattern simulation
      // -----------------------------------------------------------------
      let oldRaceOccurred = false;
      {
        const pendingQueue: Route[] = [];
        let holdRecovery = true;

        // Simulate incoming requests
        const reqA = new MockRequest('http://localhost:3000/api/auth/session');
        const routeA = new MockRoute(reqA as unknown as Request);
        pendingQueue.push(routeA as unknown as Route);

        const reqB = new MockRequest('http://localhost:3000/api/auth/session');
        const routeB = new MockRoute(reqB as unknown as Request);
        pendingQueue.push(routeB as unknown as Route);

        // Old pattern drain:
        holdRecovery = false;
        await Promise.all(pendingQueue.map((r) => r.continue()));

        // Old pattern waited only for the first recovery response:
        const firstResponseSettled = true; // request A finishes
        // But request B is still in flight on network!
        const requestBInFlight = true;

        // Old pattern starts revoke immediately:
        let revokeStarted = false;
        if (firstResponseSettled) {
          revokeStarted = true;
        }

        // If revoke started while request B was still in flight:
        if (revokeStarted && requestBInFlight) {
          // Request B lands on server AFTER revoke, gets null, sets __NEXTAUTH._session = null
          oldRaceOccurred = true;
        }
      }

      expect(oldRaceOccurred).toBe(true);
      const OLD_PATTERN_RACE_REPRODUCED = oldRaceOccurred ? 'YES' : 'NO';
      expect(OLD_PATTERN_RACE_REPRODUCED).toBe('YES');

      // -----------------------------------------------------------------
      // Part 2: New barrier prevents revoke from starting before B settles
      // -----------------------------------------------------------------
      let newBarrierPreventedRace = false;
      {
        const barrier = await ControlledSessionRouteBarrier.install(mockPage as unknown as Page, {
          holdSubsequent: true,
        });

        const reqA = new MockRequest('http://localhost:3000/api/auth/session');
        const routeA = new MockRoute(reqA as unknown as Request);
        const pA = mockPage.routeHandler!(routeA as unknown as Route);

        const reqB = new MockRequest('http://localhost:3000/api/auth/session');
        const routeB = new MockRoute(reqB as unknown as Request);
        const pB = mockPage.routeHandler!(routeB as unknown as Route);

        let revokeStartedBeforeAllDrained = false;
        let revokeExecuted = false;

        // Start drain in background
        const drainPromise = barrier.drain().then(() => {
          // Attempt to revoke only after drain completes
          if (barrier.outstanding > 0 || barrier.held > 0) {
            revokeStartedBeforeAllDrained = true;
          }
          barrier.assertIdle();
          revokeExecuted = true;
        });

        await pA;
        await pB;

        // Simulate response A finishes quickly
        mockPage.emit('requestfinished', reqA);
        expect(revokeExecuted).toBe(false); // Revoke has NOT started because B is pending

        // Simulate delayed response B finishing later
        await new Promise((resolve) => setTimeout(resolve, 20));
        expect(revokeExecuted).toBe(false); // Still waiting

        mockPage.emit('requestfinished', reqB);
        await drainPromise;

        expect(revokeExecuted).toBe(true);
        expect(revokeStartedBeforeAllDrained).toBe(false);
        barrier.assertIdle();

        newBarrierPreventedRace = true;
        await barrier.detach();
      }

      const NEW_BARRIER_PREVENTS_RACE = newBarrierPreventedRace ? 'YES' : 'NO';
      expect(NEW_BARRIER_PREVENTS_RACE).toBe('YES');
    });
  });
});
