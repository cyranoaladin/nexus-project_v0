import winston from 'winston';
import DailyRotateFile from 'winston-daily-rotate-file';
import fs from 'fs';
import path from 'path';
import { loadConfig } from '../config/loader';
import type { LoggingConfig } from '../config/schema';

const { combine, timestamp, printf, colorize, errors, json } = winston.format;

let loggerInstance: winston.Logger | null = null;

function ensureLogDirectory(directory: string): void {
  const resolvedPath = path.resolve(process.cwd(), directory);
  
  if (!fs.existsSync(resolvedPath)) {
    try {
      fs.mkdirSync(resolvedPath, { recursive: true, mode: 0o755 });
    } catch (error) {
      throw new Error(
        `Failed to create log directory "${resolvedPath}": ${error instanceof Error ? error.message : String(error)}`
      );
    }
  }

  try {
    fs.accessSync(resolvedPath, fs.constants.W_OK);
  } catch (error) {
    throw new Error(
      `Log directory "${resolvedPath}" is not writable. Check permissions.`
    );
  }
}

function createTextFormat() {
  return printf(({ level, message, timestamp, ...metadata }) => {
    const metaStr = Object.keys(metadata).length > 0 
      ? ` ${JSON.stringify(metadata)}` 
      : '';
    return `${timestamp} [${level}]: ${message}${metaStr}`;
  });
}

function createConsoleTransport(level: string): winston.transport {
  return new winston.transports.Console({
    level,
    format: combine(
      colorize({ all: true }),
      timestamp({ format: 'YYYY-MM-DD HH:mm:ss' }),
      errors({ stack: true }),
      createTextFormat()
    ),
  });
}

function createFileTransport(config: LoggingConfig): winston.transport {
  const resolvedDirectory = path.resolve(process.cwd(), config.directory);
  
  const commonFormat = combine(
    timestamp({ format: 'YYYY-MM-DD HH:mm:ss' }),
    errors({ stack: true }),
    config.format === 'json' ? json() : createTextFormat()
  );

  if (config.rotation === 'daily') {
    return new DailyRotateFile({
      dirname: resolvedDirectory,
      filename: 'zenflow-%DATE%.log',
      datePattern: 'YYYY-MM-DD',
      zippedArchive: true,
      level: config.level,
      handleExceptions: true,
      maxSize: `${config.max_size_mb}m`,
      maxFiles: `${config.retention_days}d`,
      format: commonFormat,
    });
  } else if (config.rotation === 'weekly') {
    return new DailyRotateFile({
      dirname: resolvedDirectory,
      filename: 'zenflow-%DATE%.log',
      datePattern: 'YYYY-WW',
      zippedArchive: true,
      level: config.level,
      handleExceptions: true,
      maxSize: `${config.max_size_mb}m`,
      maxFiles: `${config.retention_days}d`,
      format: commonFormat,
    });
  } else {
    return new winston.transports.File({
      dirname: resolvedDirectory,
      filename: 'zenflow.log',
      level: config.level,
      handleExceptions: true,
      maxsize: config.max_size_mb * 1024 * 1024,
      maxFiles: config.retention_days,
      format: commonFormat,
    });
  }
}

export function createLogger(configOverride?: Partial<LoggingConfig>): winston.Logger {
  let config: LoggingConfig;
  
  try {
    const settings = loadConfig();
    config = { ...settings.logging, ...configOverride };
  } catch (error) {
    config = {
      level: 'info',
      directory: '.zenflow/logs',
      rotation: 'daily',
      retention_days: 30,
      max_size_mb: 100,
      format: 'text',
      ...configOverride,
    };
  }

  ensureLogDirectory(config.directory);

  const transports: winston.transport[] = [
    createConsoleTransport(config.level),
    createFileTransport(config),
  ];

  return winston.createLogger({
    level: config.level,
    levels: winston.config.npm.levels,
    transports,
    exitOnError: false,
  });
}

export function getLogger(): winston.Logger {
  if (!loggerInstance) {
    loggerInstance = createLogger();
  }
  return loggerInstance;
}

export function resetLogger(): void {
  if (loggerInstance) {
    loggerInstance.close();
    loggerInstance = null;
  }
}

export function setLogLevel(level: 'debug' | 'info' | 'warn' | 'error'): void {
  const logger = getLogger();
  logger.level = level;
  logger.transports.forEach(transport => {
    transport.level = level;
  });
}

export default getLogger();
