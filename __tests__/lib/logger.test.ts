import { logger } from '@/lib/logger';

describe('logger ConsoleLogger branches', () => {
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

  it('info with string and object', () => {
    logger.info('hello');
    logger.info({ a: 1 }, 'ctx');
    expect(console.log).toHaveBeenCalledWith('[INFO] hello');
    expect((console.log as jest.Mock).mock.calls.some(c => String(c[0]).startsWith('[INFO]') && typeof c[1] === 'object')).toBeTruthy();
  });

  it('warn with string and object', () => {
    logger.warn('be careful');
    logger.warn({ w: true }, 'ctx');
    expect(console.warn).toHaveBeenCalledWith('[WARN] be careful');
    expect((console.warn as jest.Mock).mock.calls.some(c => String(c[0]).startsWith('[WARN]') && typeof c[1] === 'object')).toBeTruthy();
  });

  it('error with string and object', () => {
    logger.error('boom');
    logger.error({ err: 'x' }, 'ctx');
    expect(console.error).toHaveBeenCalledWith('[ERROR] boom');
    expect((console.error as jest.Mock).mock.calls.some(c => String(c[0]).startsWith('[ERROR]') && typeof c[1] === 'object')).toBeTruthy();
  });
});
