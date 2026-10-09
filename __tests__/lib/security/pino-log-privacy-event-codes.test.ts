/**
 * Bounded machine codes must survive the Pino privacy projector; nothing else may.
 *
 * Routes and workers emit machine event codes (CORE_V2_ROUTE_UNEXPECTED_ERROR,
 * PASSWORD_RESET_PROCESSING_FAILED, EMAIL_OUTBOX_DELIVERY_FAILED, …) plus a bounded
 * `errorKind` / `errorCode` so operators can alert on them. The projector denies
 * unknown strings by default and was removing them. Codes now cross only by exact
 * membership in the versioned allowlist lib/security/log-event-codes.json; error
 * classifications only through the same closed vocabularies as serialize-error.
 */
import { readFileSync, readdirSync, statSync } from 'node:fs';
import { join } from 'node:path';
import { Writable } from 'node:stream';
import pino from 'pino';
import registry from '@/lib/security/log-event-codes.json';
import { pinoPrivacyOptions, projectLogRecord } from '@/lib/security/pino-log-privacy';
import { serializeError, isSafeLogErrorName, isSafeLogErrorCode } from '@/lib/utils/serialize-error';

function emitRaw(record: Record<string, unknown>, msg = 'probe'): string[] {
  const chunks: string[] = [];
  const sink = new Writable({ write(chunk, _enc, cb) { chunks.push(String(chunk)); cb(); } });
  const log = pino({ ...pinoPrivacyOptions, formatters: { bindings: projectLogRecord }, level: 'info' }, sink);
  log.error(record, msg);
  return chunks;
}
function emit(record: Record<string, unknown>, msg?: string): Record<string, unknown> {
  return JSON.parse(emitRaw(record, msg)[0]);
}

// Pino logger calls only: the same `event:` key is also used by non-log domain data
// (e.g. Espace export timelines) and by console JSON lines that never reach Pino.
const LOGGER_CALL_OPEN = /[\w$)\]]\??\.(?:trace|debug|info|warn|error|fatal)\(\s*\{[^;]*$/;
const EVENT_LITERAL = /\bevent: ['"]([A-Za-z][A-Za-z0-9_.:-]*)['"]/g;
const GENERIC_LABELS = new Set(['FAILED', 'ERROR', 'COMPLETED', 'CANCELLED', 'PENDING', 'RUNNING']);

export function emittedLoggerEventCodes(sources: Array<{ path: string; text: string }>): Map<string, string[]> {
  const found = new Map<string, string[]>();
  for (const { path, text } of sources) {
    for (const m of text.matchAll(EVENT_LITERAL)) {
      const before = text.slice(Math.max(0, (m.index ?? 0) - 400), m.index);
      if (!LOGGER_CALL_OPEN.test(before) || GENERIC_LABELS.has(m[1])) continue;
      found.set(m[1], [...(found.get(m[1]) ?? []), path]);
    }
  }
  return found;
}
function repositorySources(): Array<{ path: string; text: string }> {
  const out: Array<{ path: string; text: string }> = [];
  const walk = (dir: string) => {
    for (const entry of readdirSync(dir)) {
      const path = join(dir, entry);
      if (statSync(path).isDirectory()) { walk(path); continue; }
      if (/\.(ts|tsx)$/.test(entry) && !/\.test\.tsx?$/.test(entry)) out.push({ path, text: readFileSync(path, 'utf8') });
    }
  };
  walk(join(process.cwd(), 'app'));
  walk(join(process.cwd(), 'lib'));
  return out;
}

describe('Pino privacy projector — bounded machine codes', () => {
  test('the allowlist is well-formed: closed grammar, bounded length, sorted, unique', () => {
    const grammar = new RegExp(registry.grammar);
    expect(registry.eventCodes.length).toBeGreaterThan(0);
    expect(registry.eventCodes.length).toBeLessThanOrEqual(200);
    for (const code of registry.eventCodes) {
      expect(code).toMatch(grammar);
      expect(code.length).toBeLessThanOrEqual(registry.maxLength);
    }
    expect([...registry.eventCodes].sort()).toEqual(registry.eventCodes);
    expect(new Set(registry.eventCodes).size).toBe(registry.eventCodes.length);
  });

  // 1. known application code
  test.each(['CORE_V2_ROUTE_UNEXPECTED_ERROR', 'PASSWORD_RESET_PROCESSING_FAILED', 'EMAIL_OUTBOX_DELIVERY_FAILED', 'account.password_change_failed'])(
    'registered code %s is kept in the emitted JSON', (event) => {
      expect(emit({ correlationId: 'corr-1', event })).toMatchObject({ correlationId: 'corr-1', event });
    });

  // 2. technical codes inside their closed vocabularies
  test('errorKind and errorCode inside their closed vocabularies are kept', () => {
    expect(emit({ event: 'CORE_V2_ROUTE_UNEXPECTED_ERROR', errorKind: 'TypeError', errorCode: 'P2002' }))
      .toMatchObject({ event: 'CORE_V2_ROUTE_UNEXPECTED_ERROR', errorKind: 'TypeError', errorCode: 'P2002' });
    expect(emit({ errorKind: 'NonErrorThrown' })).toMatchObject({ errorKind: 'NonErrorThrown' });
  });

  // 3. unknown code, 4. over-long value
  test.each([
    ['an unregistered well-formed code', 'SOME_UNREGISTERED_CODE'],
    ['an unregistered dotted code', 'account.something_else'],
    ['an over-long value', `CORE_V2_${'X'.repeat(200)}`],
  ])('event carrying %s is omitted', (_label, event) => {
    expect(emit({ event })).not.toHaveProperty('event');
  });

  // 5. CR/LF and injection attempts
  test.each([
    'CORE_V2_ROUTE_UNEXPECTED_ERROR\n{"level":60,"msg":"forged"}',
    'PASSWORD_RESET_PROCESSING_FAILED\r\n',
    ' CORE_V2_ROUTE_UNEXPECTED_ERROR',
    'CORE_V2_ROUTE_UNEXPECTED_ERROR"',
    'CORE_V2_ROUTE_UNEXPECTED_ERROR ',
  ])('injection attempt %j is omitted and the line stays single', (event) => {
    const chunks = emitRaw({ event, errorKind: `TypeError${event}`, errorCode: `P2002${event}` });
    expect(chunks).toHaveLength(1);
    expect(chunks[0].endsWith('\n')).toBe(true);
    expect(chunks[0].slice(0, -1)).not.toMatch(/[\r\n]/);
    const line = JSON.parse(chunks[0]);
    expect(line).not.toHaveProperty('event');
    expect(line).not.toHaveProperty('errorKind');
    expect(line).not.toHaveProperty('errorCode');
  });

  // 6. e-mail, URL, token, free text placed in a code field
  test.each([
    'jean.dupont@example.com',
    'https://user:pass@example.com/reset?token=abc',
    'eyJhbGciOiJIUzI1NiJ9.eyJzdWIiOiIxIn0.sig',
    'reset failed for jean',
    '+21699192829',
  ])('%s is never accepted in event, errorKind or errorCode', (value) => {
    const line = emit({ event: value, errorKind: value, errorCode: value });
    expect(JSON.stringify(line)).not.toContain(value);
  });

  // 7. no message, stack, cause, payload, headers or query
  test('private error and request material never reaches the emitted JSON', () => {
    const err = Object.assign(new TypeError('secret detail for jean@example.com'), { code: 'P2002', cause: new Error('db password=x') });
    const line = emit({
      event: 'CORE_V2_ROUTE_UNEXPECTED_ERROR', err, errorKind: 'TypeError', errorCode: 'P2002',
      message: 'free text', stack: 'at x', cause: 'c', payload: { a: 1 }, body: { b: 2 },
      headers: { cookie: 'sid=1' }, query: { email: 'jean@example.com' }, sql: 'select * from users',
    }, 'Application event');
    const text = JSON.stringify(line);
    for (const key of ['message', 'stack', 'cause', 'payload', 'body', 'headers', 'query', 'sql']) expect(line).not.toHaveProperty(key);
    for (const leaked of ['secret detail', 'jean@example.com', 'password=x', 'sid=1', 'select * from']) expect(text).not.toContain(leaked);
  });

  // 8. single-line valid JSON
  test('every emitted record is exactly one valid JSON line', () => {
    const chunks = emitRaw({ event: 'EMAIL_OUTBOX_DELIVERY_FAILED', errorKind: 'Error', errorCode: 'P2025' });
    expect(chunks).toHaveLength(1);
    expect(chunks[0].split('\n')).toEqual([expect.any(String), '']);
    expect(() => JSON.parse(chunks[0])).not.toThrow();
  });

  // 9. identical behaviour to serialize-error
  test('error serialization and code vocabularies are identical to serialize-error', () => {
    const err = Object.assign(new RangeError('private'), { code: 'P2034' });
    expect(projectLogRecord({ err }).err).toEqual(serializeError(err));
    const kinds = ['Error', 'TypeError', 'RangeError', 'PrismaClientKnownRequestError', 'ZodError', 'MyCustomError', 'error', 'UnknownError'];
    for (const kind of kinds) expect(projectLogRecord({ errorKind: kind }).errorKind === kind).toBe(isSafeLogErrorName(kind));
    const codes = ['P2002', 'P2025', 'P2034', 'P9999', 'E_FAIL', 'p2002'];
    for (const code of codes) expect(projectLogRecord({ errorCode: code }).errorCode === code).toBe(isSafeLogErrorCode(code));
  });

  // 10. every code really emitted by the repository is declared — and nothing stale
  test('the allowlist equals the set of event codes passed to Pino logger calls in app/ and lib/', () => {
    const emitted = emittedLoggerEventCodes(repositorySources());
    expect([...emitted.keys()].sort()).toEqual(registry.eventCodes);
    for (const code of emitted.keys()) expect(projectLogRecord({ event: code }).event).toBe(code);
  });

  // 11. governance: a newly emitted, undeclared code is detected
  test('a new logger event code that is not declared is reported', () => {
    const fixture = [{ path: 'lib/new-feature.ts', text: "logger.error({ correlationId, event: 'NEW_FEATURE_FAILED' }, 'x');\nlogger?.warn({\n  event: 'ANOTHER_NEW_CODE',\n});" }];
    const undeclared = [...emittedLoggerEventCodes(fixture).keys()].filter((code) => !registry.eventCodes.includes(code));
    expect(undeclared.sort()).toEqual(['ANOTHER_NEW_CODE', 'NEW_FEATURE_FAILED']);
    // console JSON lines and non-log domain data are not Pino calls and are not counted.
    const notLogs = [{ path: 'lib/x.ts', text: "console.error(JSON.stringify({ event: 'CONSOLE_ONLY' }));\ntimeline.push({ at, event: 'STARTED' });" }];
    expect([...emittedLoggerEventCodes(notLogs).keys()]).toEqual([]);
  });
});
