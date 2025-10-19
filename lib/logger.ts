export type LogLevel = 'debug' | 'info' | 'warn' | 'error'

function log(level: LogLevel, msg: string, meta?: unknown) {
  const payload = { level, msg, ts: new Date().toISOString(), ...(meta ? { meta } : {}) }
  // eslint-disable-next-line no-console
  console[level === 'debug' ? 'log' : level](JSON.stringify(payload))
}

export const logger = {
  debug: (msg: string, meta?: unknown) => log('debug', msg, meta),
  info: (msg: string, meta?: unknown) => log('info', msg, meta),
  warn: (msg: string, meta?: unknown) => log('warn', msg, meta),
  error: (msg: string, meta?: unknown) => log('error', msg, meta),
}