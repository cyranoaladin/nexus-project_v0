/** @jest-environment node */
import { EventEmitter } from 'node:events';
import type { Page, Request } from '@playwright/test';
import { sendFromComposerAndFinishTransport } from '../../../e2e/aria/helpers';
jest.mock('../../../e2e/helpers/auth', () => ({ loginAsUser: jest.fn() }));
// Observation has its separate native-browser diagnostic; this fixture tests
// the submitted Request contract, including concurrent requests and cleanup.
jest.mock('../../../e2e/helpers/aria-transport-probe', () => ({
  installAriaTransportProbe: jest.fn(async (page: { probeDisposed: () => void }) => ({
    snapshot: async () => ({
      selected: true, headersReceived: true, signalAborted: false,
      fetchRejected: false, bodyEof: false, bodyReadFailed: false, dialogPresent: true, composerEnabled: true, alertPresent: false,
    }),
    dispose: async () => page.probeDisposed(),
  })),
}));
jest.mock('@playwright/test', () => ({
  expect: (value: unknown) => expect(value),
  test: { step: (_title: string, action: () => unknown) => action() },
}));

type Outcome = 'FINISHED' | 'net::ERR_ABORTED' | 'net::ERR_CONNECTION_RESET'
  | 'NO_HEADERS' | 'RESPONSE_REJECTED' | 'BODY_REJECTED';

class SyntheticPage extends EventEmitter {
  readonly probeDisposed = jest.fn();
  private bodyFinished!: () => void;
  readonly submitted = {
    url: () => 'http://synthetic.test/api/aria/chat', method: () => 'POST',
    postDataJSON: () => ({ content: 'synthetic-turn' }),
    failure: () => ({ errorText: this.outcome }),
    response: async () => {
      if (this.outcome === 'NO_HEADERS') return null;
      if (this.outcome === 'RESPONSE_REJECTED') throw new Error('SYNTHETIC_RESPONSE_UNAVAILABLE');
      return { status: () => 200, finished: async () => {
        if (this.outcome === 'BODY_REJECTED') throw new Error('SYNTHETIC_BODY_READ_FAILED');
        return this.body;
      } };
    },
  } as unknown as Request;
  private readonly body = new Promise<null>(resolve => { this.bodyFinished = () => resolve(null); });
  constructor(private readonly outcome: Outcome) { super(); }
  url() { return 'http://synthetic.test/dashboard/eleve'; }
  getByLabel() { return { fill: async () => undefined }; }
  getByRole() { return { click: async () => {
    this.emit('request', this.submitted);
    // A concurrent request with even the same content cannot settle this turn.
    const concurrent = { ...this.submitted } as Request;
    this.emit('request', concurrent);
    this.emit('requestfinished', concurrent);
    if (this.outcome === 'FINISHED') { this.emit('requestfinished', this.submitted); this.bodyFinished(); }
    else this.emit('requestfailed', this.submitted);
  } }; }
  waitForRequest(predicate: (request: Request) => boolean) {
    return new Promise<Request>(resolve => {
      const listener = (request: Request) => { if (predicate(request)) { this.off('request', listener); resolve(request); } };
      this.on('request', listener);
    });
  }
}

test.each<Outcome>(['FINISHED', 'net::ERR_ABORTED', 'net::ERR_CONNECTION_RESET',
  'NO_HEADERS', 'RESPONSE_REJECTED', 'BODY_REJECTED'])('the exact submitted chat transport settles on %s without hiding failures', async outcome => {
  const page = new SyntheticPage(outcome);
  let disposition = 'pending';
  let failure: unknown;
  const operation = sendFromComposerAndFinishTransport(page as unknown as Page, 'synthetic-turn')
    .then(() => { disposition = 'finished'; }, error => { disposition = 'failed'; failure = error; });
  // Drain the bounded promise chain without advancing a clock or sleeping.
  for (let i = 0; i < 32; i++) await Promise.resolve();
  expect(disposition).toBe(outcome === 'FINISHED' ? 'finished' : 'failed');
  await operation;
  if (outcome === 'FINISHED') expect(failure).toBeUndefined();
  else if (outcome === 'NO_HEADERS') {
    expect(failure).toMatchObject({ message: 'ARIA_CHAT_TRANSPORT_NO_HEADERS' });
  } else {
    const expected = outcome === 'net::ERR_ABORTED' ? 'ARIA_CHAT_TRANSPORT_ABORTED'
      : outcome === 'RESPONSE_REJECTED' ? 'SYNTHETIC_RESPONSE_UNAVAILABLE'
        : 'ARIA_CHAT_TRANSPORT_FAILED';
    expect(failure).toMatchObject({ message: expected });
  }
  expect(page.probeDisposed).toHaveBeenCalledTimes(1);
  expect(page.listenerCount('request')).toBe(0);
  expect(page.listenerCount('requestfinished')).toBe(0);
  expect(page.listenerCount('requestfailed')).toBe(0);
});
