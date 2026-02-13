import { sanitizeLogData, LogPresets, timeOperation, Logger } from '@/lib/middleware/logger';

describe('middleware logger', () => {
  it('sanitizes sensitive keys deeply', () => {
    const data = {
      password: 'secret',
      token: 'abc',
      nested: { api_key: 'key', ok: true },
    };
    const result = sanitizeLogData(data);
    expect(result.password).toBe('[REDACTED]');
    expect((result.nested as any).api_key).toBe('[REDACTED]');
  });

  it('timeOperation logs debug on success', async () => {
    const logger = {
      debug: jest.fn(),
      error: jest.fn(),
    } as unknown as Logger;

    const result = await timeOperation('op', async () => 42, logger);
    expect(result).toBe(42);
    expect(logger.debug).toHaveBeenCalled();
  });

  it('timeOperation logs error on failure', async () => {
    const logger = {
      debug: jest.fn(),
      error: jest.fn(),
    } as unknown as Logger;

    await expect(timeOperation('op', async () => { throw new Error('fail'); }, logger))
      .rejects.toThrow('fail');
    expect(logger.error).toHaveBeenCalled();
  });

  it('LogPresets produce structured logs', () => {
    const logger = {
      info: jest.fn(),
      debug: jest.fn(),
    } as unknown as Logger;

    LogPresets.authAttempt(logger, 'user@test.com', true);
    LogPresets.authzCheck(logger, 'resource', true);
    LogPresets.dbQuery(logger, 'findMany', 'User', 10);
    LogPresets.externalApi(logger, 'service', '/endpoint', 200, 25);

    expect(logger.info).toHaveBeenCalled();
    expect(logger.debug).toHaveBeenCalled();
  });
});
