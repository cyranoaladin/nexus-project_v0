// lib/logger.ts
// Logger structuré minimal. Si une lib de logging (ex: pino) est disponible, on l'utilise, sinon fallback console.

type Fields = Record<string, unknown>;

class ConsoleLogger {
  info(fields: Fields | string, msg?: string) {
    if (typeof fields === 'string') {
      console.log(`[INFO] ${fields}`);
    } else {
      console.log(`[INFO] ${msg ?? ''}`, fields);
    }
  }
  warn(fields: Fields | string, msg?: string) {
    if (typeof fields === 'string') {
      console.warn(`[WARN] ${fields}`);
    } else {
      console.warn(`[WARN] ${msg ?? ''}`, fields);
    }
  }
  error(fields: Fields | string, msg?: string) {
    if (typeof fields === 'string') {
      console.error(`[ERROR] ${fields}`);
    } else {
      console.error(`[ERROR] ${msg ?? ''}`, fields);
    }
  }
}

export const logger = new ConsoleLogger();
