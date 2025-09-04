import { createLoggerTo } from '@/lib/logger';

describe('logger: object payload without message (JSON logs)', () => {
  function capture() {
    const lines: string[] = [];
    const dest = { write: (str: string) => { lines.push(String(str)); return true; } } as any;
    const logger = createLoggerTo(dest);
    const parse = () => lines.map(l => { try { return JSON.parse(l); } catch { return null; } }).filter(Boolean) as any[];
    return { logger, parse };
  }

  it('info/warn/error with object only', () => {
    const { logger, parse } = capture();
    const obj = { a: 1 } as any;
    logger.info(obj);
    logger.warn(obj);
    logger.error(obj);
    const recs = parse();
    expect(recs.some(r => r.level === 30 && r.a === 1)).toBeTruthy();
    expect(recs.some(r => r.level === 40 && r.a === 1)).toBeTruthy();
    expect(recs.some(r => r.level === 50 && r.a === 1)).toBeTruthy();
  });
});
