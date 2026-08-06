import { createHmac } from 'node:crypto'

export const RATE_LIMIT_KEY_SCHEMA_VERSION = 'v1'

function requiredSecret(): string {
  const secret = process.env.RATE_LIMIT_KEY_SECRET?.trim()
  if (!secret || secret.length < 32) {
    throw new Error('RATE_LIMIT_KEY_SECRET_INVALID')
  }
  return secret
}

function environmentNamespace(): string {
  const namespace = process.env.RATE_LIMIT_KEY_NAMESPACE?.trim().toLowerCase()
  if (!namespace || !/^[a-z0-9][a-z0-9_-]{0,31}$/.test(namespace)) {
    throw new Error('RATE_LIMIT_KEY_NAMESPACE_INVALID')
  }
  return namespace
}

function normalizeKeyMaterial(value: string): string {
  return value.normalize('NFKC').trim().toLowerCase()
}

export function deriveRateLimitKey(scope: string, dimension: string, rawValue: string): string {
  const namespace = environmentNamespace()
  const normalizedScope = normalizeKeyMaterial(scope)
  const normalizedDimension = normalizeKeyMaterial(dimension)
  const digest = createHmac('sha256', requiredSecret())
    .update(`${RATE_LIMIT_KEY_SCHEMA_VERSION}\0${namespace}\0${normalizedScope}\0${normalizedDimension}\0${normalizeKeyMaterial(rawValue)}`)
    .digest('hex')

  return `rl:${RATE_LIMIT_KEY_SCHEMA_VERSION}:${namespace}:${normalizedScope}:${normalizedDimension}:${digest}`
}
