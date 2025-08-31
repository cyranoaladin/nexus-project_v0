import { logger } from '@/lib/logger';

describe('logger: object payload without message covers msg ?? "" branch', () => {
  const origLog = console.log;
  const origWarn = console.warn;
  const origError = console.error;

  beforeEach(() => {
    console.log = jest.fn();
    console.warn = jest.fn();
    console.error = jest.fn();
  });

  afterEach(() => {
    console.log = origLog;
    console.warn = origWarn;
    console.error = origError;
  });

  it('info/warn/error with object only', () => {
    const obj = { a: 1 };
    logger.info(obj as any);
    logger.warn(obj as any);
    logger.error(obj as any);
    expect((console.log as jest.Mock).mock.calls.some(c => String(c[0]).startsWith('[INFO]') && c.length > 1)).toBeTruthy();
    expect((console.warn as jest.Mock).mock.calls.some(c => String(c[0]).startsWith('[WARN]') && c.length > 1)).toBeTruthy();
    expect((console.error as jest.Mock).mock.calls.some(c => String(c[0]).startsWith('[ERROR]') && c.length > 1)).toBeTruthy();
  });
});
