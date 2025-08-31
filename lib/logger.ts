// lib/logger.ts
// Logger basé sur pino, avec niveau configurable
import pino from 'pino';

export const logger = pino({
  level: process.env.LOG_LEVEL || (process.env.NODE_ENV === 'production' ? 'info' : 'debug'),
  base: undefined, // pas d'ajout de pid/hostname par défaut pour des logs plus concis
});
