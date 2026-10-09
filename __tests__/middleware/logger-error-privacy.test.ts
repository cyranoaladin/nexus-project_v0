/** @jest-environment node */
import pino from 'pino';
import { NextRequest } from 'next/server';

const mockRecords: Array<Record<string, unknown>> = [];
jest.mock('pino', () => {
  const actual = jest.requireActual<typeof pino>('pino');
  const factory = jest.fn((options: pino.LoggerOptions) => actual(options, {
    write(chunk: string) { mockRecords.push(JSON.parse(chunk) as Record<string, unknown>); },
  }));
  return Object.assign(factory, actual, { default: factory });
});
jest.mock('pino-pretty', () => jest.fn(() => undefined));

import { Logger, logger as middlewareLogger } from '@/lib/middleware/logger';
import { logger as appLogger } from '@/lib/logger';

const marker = 'synthetic-private-diagnostic';
function privateError(): Error {
  const error = new Error(marker, { cause: new Error(marker) });
  error.stack = marker;
  return error;
}

beforeEach(() => {
  mockRecords.length = 0;
  middlewareLogger.level = 'debug';
  appLogger.level = 'debug';
});

it('projects request-class errors while preserving request correlation and timing', () => {
  const logger = new Logger(new NextRequest('http://localhost/api/admin/users', { method: 'POST' }));
  logger.error('Synthetic user creation failure', privateError(), { duration: 10 });
  expect(mockRecords).toHaveLength(1);
  expect(JSON.stringify(mockRecords)).not.toContain(marker);
  expect(mockRecords[0]).toMatchObject({ requestId: logger.getRequestId(), duration: 10, msg: 'Synthetic user creation failure', errorSummary: { name: 'Error' } });
});

for (const [name, logger] of [['middleware', middlewareLogger], ['application', appLogger]] as const) {
  it(`${name} object-first formatting cannot disclose private interpolation arguments`, () => {
    logger.error({ statusCode: 500 }, 'Synthetic failure %s', marker);
    expect(mockRecords).toHaveLength(1);
    expect(JSON.stringify(mockRecords)).not.toContain(marker);
    expect(mockRecords[0]).toMatchObject({ statusCode: 500 });
  });
  it(`${name} direct Error calls use a bounded serializer`, () => {
    logger.error(privateError(), 'Synthetic direct failure');
    expect(mockRecords).toHaveLength(1);
    expect(JSON.stringify(mockRecords)).not.toContain(marker);
    expect(mockRecords[0]).toMatchObject({ msg: 'Synthetic direct failure', err: { name: 'Error' } });
  });
  it(`${name} Error calls without an event label never inherit private text`, () => {
    logger.error(privateError());
    expect(mockRecords).toHaveLength(1);
    expect(JSON.stringify(mockRecords)).not.toContain(marker);
  });
  it(`${name} nested errors and ordinary free-text metadata are excluded`, () => {
    const error = privateError();
    error.name = marker;
    logger.error({ details: { err: error, description: marker }, description: marker, duration: 12 }, 'Synthetic nested failure');
    expect(mockRecords).toHaveLength(1);
    expect(JSON.stringify(mockRecords)).not.toContain(marker);
    expect(mockRecords[0]).toMatchObject({ duration: 12, msg: 'Synthetic nested failure' });
  });
  it(`${name} string error fields and exposed stacks are not emitted`, () => {
    logger.error({ error: marker, stack: marker, cause: marker, statusCode: 500 }, 'Synthetic provider failure');
    expect(mockRecords).toHaveLength(1);
    expect(JSON.stringify(mockRecords)).not.toContain(marker);
    expect(mockRecords[0]).toMatchObject({ msg: 'Synthetic provider failure', statusCode: 500 });
  });
  it(`${name} child bindings redact contact data without losing correlation`, () => {
    logger.child({ email: marker, phone: marker, requestId: 'synthetic-request' }).info({ body: { private: marker }, count: 1 }, 'Synthetic operation');
    expect(mockRecords).toHaveLength(1);
    expect(JSON.stringify(mockRecords)).not.toContain(marker);
    expect(mockRecords[0]).toMatchObject({ requestId: 'synthetic-request', count: 1, msg: 'Synthetic operation' });
  });
}

it('never embeds guessed private resource parameters in request-completion events', () => {
  const logger = new Logger(new NextRequest(`http://localhost/api/parent/children/${marker}/aria/mastery`));
  logger.logRequest(403);
  expect(mockRecords).toHaveLength(1);
  expect(JSON.stringify(mockRecords)).not.toContain(marker);
  expect(mockRecords[0]).toMatchObject({ statusCode: 403, path: '/api/parent/children/[parameter]/aria/mastery' });
});
