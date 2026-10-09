/** @jest-environment node */
import { EventEmitter } from 'node:events';
import type { Page, Request } from '@playwright/test';
import { captureBrowserDiagnostics, captureBrowserFailures } from '../../../e2e/aria/helpers';
jest.mock('../../../e2e/helpers/auth', () => ({ loginAsUser: jest.fn() }));
jest.mock('@playwright/test', () => ({ expect: jest.fn() }));

class SyntheticPage extends EventEmitter {
  url() { return 'http://synthetic.test/dashboard/eleve'; }
}
function request(path = '/api/v2/auth/password-change', kind = 'fetch', headers: Record<string, string> = {}, error = 'net::ERR_ABORTED'): Request {
  return {
    url: () => `http://synthetic.test${path}`, method: () => 'GET', resourceType: () => kind,
    headers: () => headers, failure: () => ({ errorText: error }),
  } as unknown as Request;
}

test.each([
  ['business API', '/api/v2/auth/password-change', 'fetch', {}],
  ['ordinary dashboard fetch', '/dashboard/account/security', 'fetch', {}],
  ['document navigation', '/dashboard/account/security', 'document', {}],
  ['RSC without prefetch', '/dashboard/account/security', 'fetch', { rsc: '1' }],
  ['prefetch without RSC', '/dashboard/account/security', 'fetch', { 'next-router-prefetch': '1' }],
  ['API with prefetch headers', '/api/parent/children', 'fetch', { rsc: '1', 'next-router-prefetch': '1' }],
] as const)('captureBrowserFailures preserves an unexpected abort: %s', (_name, path, kind, headers) => {
  const page = new SyntheticPage();
  const failures = captureBrowserFailures(page as unknown as Page);
  page.emit('requestfailed', request(path, kind, headers));
  expect(failures).toEqual([`requestfailed:GET:${path}:net::ERR_ABORTED`]);
});

test('query values never enter the failure diagnostic', () => {
  const page = new SyntheticPage();
  const diagnostics = captureBrowserDiagnostics(page as unknown as Page);
  page.emit('requestfailed', request('/api/parent/children?synthetic-private-value=omitted'));
  expect(diagnostics.failures).toEqual(['requestfailed:GET:/api/parent/children:net::ERR_ABORTED']);
  expect(JSON.stringify(diagnostics)).not.toContain('synthetic-private-value');
});


test.each(['next-router-prefetch', 'purpose'])('only a proven same-origin RSC prefetch is accepted (%s)', marker => {
  const page = new SyntheticPage();
  const diagnostics = captureBrowserDiagnostics(page as unknown as Page);
  const headers = { rsc: '1', [marker]: marker === 'purpose' ? 'prefetch' : '1', authorization: 'synthetic-private-header' };
  page.emit('requestfailed', request('/dashboard/account/security?private=omitted', 'fetch', headers));
  expect(diagnostics.failures).toEqual([]);
  expect(diagnostics.networkFailures[0].disposition).toBe('expected-rsc-prefetch');
  expect(JSON.stringify(diagnostics)).not.toContain('synthetic-private-header');
  expect(JSON.stringify(diagnostics)).not.toContain('private=');
});

test.each([
  ['document', '/dashboard/account/security', 'document', 'net::ERR_ABORTED'],
  ['unknown route', '/dashboard/not-approved', 'fetch', 'net::ERR_ABORTED'],
  ['API', '/api/aria/chat', 'fetch', 'net::ERR_ABORTED'],
  ['different error', '/dashboard/account/security', 'fetch', 'net::ERR_CONNECTION_RESET'],
] as const)('prefetch flags never excuse %s', (_label, path, kind, error) => {
  const page = new SyntheticPage();
  const failures = captureBrowserFailures(page as unknown as Page);
  page.emit('requestfailed', request(path, kind, { rsc: '1', 'next-router-prefetch': '1' }, error));
  expect(failures).toEqual([`requestfailed:GET:${path}:${error}`]);
});

test('cross-origin prefetch is not covered by a local path', () => {
  const page = new SyntheticPage();
  const diagnostics = captureBrowserDiagnostics(page as unknown as Page);
  const foreign = Object.assign(request('/dashboard/account/security', 'fetch', { rsc: '1', 'next-router-prefetch': '1' }), {
    url: () => 'https://another-synthetic.test/dashboard/account/security',
  });
  page.emit('requestfailed', foreign);
  expect(diagnostics.failures).toHaveLength(1);
});

function chat(): Request {
  return Object.assign(request('/api/aria/chat'), { method: () => 'POST' });
}

test('an explicit cancellation applies to one already active request, never the next chat', () => {
  const page = new SyntheticPage();
  const diagnostics = captureBrowserDiagnostics(page as unknown as Page);
  const first = chat();
  page.emit('request', first);
  diagnostics.expectChatCancellation();
  const second = chat();
  page.emit('request', second);
  page.emit('requestfailed', second);
  page.emit('requestfailed', first);
  expect(diagnostics.failures).toEqual(['requestfailed:POST:/api/aria/chat:net::ERR_ABORTED']);
  expect(diagnostics.networkFailures.map(event => event.disposition)).toEqual(['failure', 'expected-chat-cancellation']);
});

test('a chat abort without a cancellation intent remains a failure', () => {
  const page = new SyntheticPage();
  const diagnostics = captureBrowserDiagnostics(page as unknown as Page);
  const active = chat();
  page.emit('request', active);
  page.emit('requestfailed', active);
  expect(diagnostics.failures).toHaveLength(1);
});

test('an intentional cancellation never excuses another network error or an HTTP 500', () => {
  const page = new SyntheticPage();
  const diagnostics = captureBrowserDiagnostics(page as unknown as Page);
  const active = Object.assign(chat(), { failure: () => ({ errorText: 'net::ERR_CONNECTION_RESET' }) });
  page.emit('request', active);
  diagnostics.expectChatCancellation();
  page.emit('response', { url: () => active.url(), status: () => 500 });
  page.emit('requestfailed', active);
  expect(diagnostics.failures).toEqual(['response:500:/api/aria/chat', 'requestfailed:POST:/api/aria/chat:net::ERR_CONNECTION_RESET']);
});

test('finished requests and ambiguous concurrent chats cannot acquire a cancellation intent', () => {
  const page = new SyntheticPage();
  const diagnostics = captureBrowserDiagnostics(page as unknown as Page);
  expect(() => diagnostics.expectChatCancellation()).toThrow('REQUIRES_ONE_ACTIVE_CHAT');
  const first = chat();
  page.emit('request', first);
  page.emit('requestfinished', first);
  expect(() => diagnostics.expectChatCancellation()).toThrow('REQUIRES_ONE_ACTIVE_CHAT');
  page.emit('request', chat());
  page.emit('request', chat());
  expect(() => diagnostics.expectChatCancellation()).toThrow('REQUIRES_ONE_ACTIVE_CHAT');
});
