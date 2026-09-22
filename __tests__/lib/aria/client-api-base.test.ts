import { resolveAriaApiBase } from '@/lib/aria/client/api-base';
import { extractAriaErrorMessage, unwrapAriaResponseData } from '@/lib/aria/client/response';

describe('resolveAriaApiBase', () => {
  test('CORE_V2 authority resolves to the native v2 ARIA surface', () => {
    expect(resolveAriaApiBase('CORE_V2')).toBe('/api/v2/aria');
  });

  test('V1 authority resolves to the legacy surface', () => {
    expect(resolveAriaApiBase('V1')).toBe('/api/aria');
  });

  test('undefined authority defaults to the legacy surface', () => {
    expect(resolveAriaApiBase(undefined)).toBe('/api/aria');
  });
});

describe('unwrapAriaResponseData', () => {
  test('unwraps a Core v2 envelope', () => {
    expect(unwrapAriaResponseData<{ x: number }>({ ok: true, data: { x: 1 } })).toEqual({ x: 1 });
  });

  test('returns the body directly for a legacy (unwrapped) payload', () => {
    expect(unwrapAriaResponseData<{ x: number }>({ x: 2 })).toEqual({ x: 2 });
  });

  test('a Core v2-shaped body with no data falls back to the body itself', () => {
    expect(unwrapAriaResponseData<unknown>({ ok: false })).toEqual({ ok: false });
  });
});

describe('extractAriaErrorMessage', () => {
  test('extracts the message from a Core v2 error envelope', () => {
    expect(extractAriaErrorMessage({ ok: false, error: { code: 'NOT_FOUND', message: 'Not found.' } }, 'fallback')).toBe('Not found.');
  });

  test('extracts a legacy string error field', () => {
    expect(extractAriaErrorMessage({ error: 'Student not found' }, 'fallback')).toBe('Student not found');
  });

  test('falls back when the Core v2 envelope has no error message', () => {
    expect(extractAriaErrorMessage({ ok: false }, 'fallback')).toBe('fallback');
  });

  test('falls back for a body with neither shape', () => {
    expect(extractAriaErrorMessage({}, 'fallback')).toBe('fallback');
    expect(extractAriaErrorMessage(null, 'fallback')).toBe('fallback');
    expect(extractAriaErrorMessage('a string body', 'fallback')).toBe('fallback');
  });

  test('a non-string legacy error field falls back rather than rendering [object Object]', () => {
    expect(extractAriaErrorMessage({ error: { nested: true } }, 'fallback')).toBe('fallback');
  });
});
