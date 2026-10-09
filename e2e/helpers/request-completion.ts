type RequestEvent = 'request' | 'requestfinished' | 'requestfailed';
interface RequestEvents<T> {
  on(event: RequestEvent, listener: (request: T) => void): unknown;
  off(event: RequestEvent, listener: (request: T) => void): unknown;
}

/** Attach before submission: response.finished() does not settle on requestfailed. */
export function observeSubmittedRequest<T>(events: RequestEvents<T>, matches: (request: T) => boolean) {
  let selected: T | undefined;
  let resolveRequest!: (request: T) => void;
  let resolveCompletion!: (result: { request: T; status: 'FINISHED' | 'FAILED' }) => void;
  const request = new Promise<T>(resolve => { resolveRequest = resolve; });
  const completion = new Promise<{ request: T; status: 'FINISHED' | 'FAILED' }>(resolve => { resolveCompletion = resolve; });
  const select = (candidate: T) => {
    if (selected !== undefined || !matches(candidate)) return;
    selected = candidate;
    resolveRequest(candidate);
  };
  const dispose = () => {
    events.off('request', select);
    events.off('requestfinished', finish);
    events.off('requestfailed', fail);
  };
  const settle = (candidate: T, status: 'FINISHED' | 'FAILED') => {
    if (selected !== candidate) return;
    dispose();
    resolveCompletion({ request: candidate, status });
  };
  const finish = (candidate: T) => settle(candidate, 'FINISHED');
  const fail = (candidate: T) => settle(candidate, 'FAILED');
  events.on('request', select);
  events.on('requestfinished', finish);
  events.on('requestfailed', fail);
  return { request, completion, dispose };
}
