import { createLoggerTo } from '@/lib/logger';

describe('logger (pino JSON) branches', () => {
  function capture() {
    const lines: string[] = [];
    const dest = { write: (str: string) => { lines.push(String(str)); return true; } } as any;
    const logger = createLoggerTo(dest);
    const parse = () => lines.map(l => { try { return JSON.parse(l); } catch { return null; } }).filter(Boolean) as any[];
    return { logger, parse };
  }

  it('info with string and object', () => {
    const { logger, parse } = capture();
    logger.info('hello');
    logger.info({ a: 1 }, 'ctx');
    const recs = parse();
    expect(recs.some(r => r.level === 30 && r.msg === 'hello')).toBeTruthy();
    expect(recs.some(r => r.level === 30 && r.msg === 'ctx' && r.a === 1)).toBeTruthy();
  });

  it('warn with string and object', () => {
    const { logger, parse } = capture();
    logger.warn('be careful');
    logger.warn({ w: true }, 'ctx');
    const recs = parse();
    expect(recs.some(r => r.level === 40 && r.msg === 'be careful')).toBeTruthy();
    expect(recs.some(r => r.level === 40 && r.msg === 'ctx' && r.w === true)).toBeTruthy();
  });

  it('error with string and object', () => {
    const { logger, parse } = capture();
    logger.error('boom');
    logger.error({ err: 'x' }, 'ctx');
    const recs = parse();
    expect(recs.some(r => r.level === 50 && r.msg === 'boom')).toBeTruthy();
    expect(recs.some(r => r.level === 50 && r.msg === 'ctx' && r.err === 'x')).toBeTruthy();
  });
});
