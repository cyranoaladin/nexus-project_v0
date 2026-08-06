import { isIP } from 'node:net'
import { NextResponse } from 'next/server'

import { deriveRateLimitKey } from './keys'
import { MemoryStore } from './memory-store'
import { RedisStore } from './redis-store'
import type { DistributedRateLimitStore, RateLimitDecision } from './types'

export const RateLimitPresets = {
  auth: { limit: 5, windowMs: 15 * 60_000 },
  authIp: { limit: 30, windowMs: 15 * 60_000 },
  authIdentity: { limit: 5, windowMs: 15 * 60_000 },
  resendActivation: { limit: 3, windowMs: 15 * 60_000 },
  emailIp: { limit: 30, windowMs: 60 * 60_000 },
  emailIdentity: { limit: 5, windowMs: 60 * 60_000 },
  writeIp: { limit: 60, windowMs: 15 * 60_000 },
  writeIdentity: { limit: 10, windowMs: 60 * 60_000 },
  resourceWrite: { limit: 100, windowMs: 60 * 60_000 },
  expensive: { limit: 10, windowMs: 60 * 60_000 },
  expensiveIp: { limit: 60, windowMs: 60 * 60_000 },
  expensiveIdentity: { limit: 10, windowMs: 60 * 60_000 },
  readIp: { limit: 300, windowMs: 60_000 },
  readIdentity: { limit: 120, windowMs: 60_000 },
  ai: { limit: 10, windowMs: 60 * 60_000 },
  notifyEmail: { limit: 5, windowMs: 60 * 60_000 },
  api: { limit: 60, windowMs: 60_000 },
  public: { limit: 200, windowMs: 60_000 },
} as const

export type RateLimitPresetName = keyof typeof RateLimitPresets
export type RateLimitRuntimeMode = 'redis' | 'memory' | 'invalid'

type GlobalRateLimitState = {
  store?: DistributedRateLimitStore
  mode?: RateLimitRuntimeMode
  listenersRegistered?: boolean
}

const globalState = globalThis as typeof globalThis & {
  __nexusRateLimitState?: GlobalRateLimitState
}

function state(): GlobalRateLimitState {
  globalState.__nexusRateLimitState ??= {}
  return globalState.__nexusRateLimitState
}

export function getRateLimitRuntimeMode(): RateLimitRuntimeMode {
  const backend = process.env.RATE_LIMIT_BACKEND?.trim().toLowerCase()
  if (backend === 'redis') return process.env.REDIS_URL?.trim() ? 'redis' : 'invalid'
  if (backend === 'memory') return process.env.NODE_ENV === 'production' ? 'invalid' : 'memory'
  return 'invalid'
}

export function assertRateLimitRuntimeConfiguration(): void {
  const mode = getRateLimitRuntimeMode()
  if (process.env.NODE_ENV === 'production' && process.env.RATE_LIMIT_BACKEND === 'memory') {
    throw new Error('RATE_LIMIT_PRODUCTION_MEMORY_REFUSED')
  }
  if (mode === 'invalid') throw new Error('RATE_LIMIT_CONFIGURATION_INVALID')
  if (!process.env.RATE_LIMIT_KEY_SECRET?.trim() || process.env.RATE_LIMIT_KEY_SECRET.trim().length < 32) {
    throw new Error('RATE_LIMIT_KEY_SECRET_INVALID')
  }
  if (!process.env.RATE_LIMIT_KEY_NAMESPACE?.trim()) {
    throw new Error('RATE_LIMIT_KEY_NAMESPACE_INVALID')
  }
  const hops = Number(process.env.RATE_LIMIT_TRUST_PROXY_HOPS)
  if (!Number.isInteger(hops) || hops < 1 || hops > 8) {
    throw new Error('RATE_LIMIT_TRUST_PROXY_HOPS_INVALID')
  }
}

function getStore(): DistributedRateLimitStore {
  const mode = getRateLimitRuntimeMode()
  if (mode === 'invalid') throw new Error('RATE_LIMIT_CONFIGURATION_INVALID')

  const current = state()
  if (current.store && current.mode === mode) return current.store

  current.store = mode === 'redis'
    ? new RedisStore(process.env.REDIS_URL!.trim())
    : new MemoryStore()
  current.mode = mode
  registerShutdownHandlers()
  return current.store
}

function registerShutdownHandlers(): void {
  const current = state()
  if (current.listenersRegistered) return
  current.listenersRegistered = true
  const close = () => {
    void shutdownRateLimitRuntime()
  }
  process.once('SIGTERM', close)
  process.once('SIGINT', close)
}

export async function shutdownRateLimitRuntime(): Promise<void> {
  const current = state()
  const store = current.store as DistributedRateLimitStore & { close?: () => Promise<void> }
  current.store = undefined
  current.mode = undefined
  if (store?.close) await store.close()
}

export function resetRateLimitRuntimeForTests(): void {
  const current = state()
  const store = current.store as DistributedRateLimitStore & { close?: () => Promise<void> }
  current.store = undefined
  current.mode = undefined
  if (store?.close) void store.close()
}

/** Test-only compatibility alias; production controllers must use the async guards. */
export const _resetStoreForTests = resetRateLimitRuntimeForTests

function trustedProxyHops(): number | null {
  const raw = process.env.RATE_LIMIT_TRUST_PROXY_HOPS?.trim()
  if (!raw) return null
  const parsed = Number(raw)
  return Number.isInteger(parsed) && parsed >= 1 && parsed <= 8 ? parsed : null
}

function normalizedIp(value: string): string | null {
  const candidate = value.trim().replace(/^\[|\]$/g, '')
  if (candidate.toLowerCase().startsWith('::ffff:')) {
    const mapped = candidate.slice(7)
    return isIP(mapped) === 4 ? mapped : null
  }
  return isIP(candidate) ? candidate.toLowerCase() : null
}

export function resolveTrustedClientIp(request: Request): string | null {
  const hops = trustedProxyHops()
  if (hops === null) {
    return process.env.NODE_ENV === 'test' && process.env.RATE_LIMIT_BACKEND === 'memory'
      ? 'test-client'
      : null
  }

  const forwarded = request.headers.get('x-forwarded-for')
    ?.split(',')
    .map((entry) => normalizedIp(entry))
    .filter((entry): entry is string => Boolean(entry)) ?? []
  if (forwarded.length >= hops) return forwarded[forwarded.length - hops] ?? null

  if (hops === 1) {
    const realIp = normalizedIp(request.headers.get('x-real-ip') ?? '')
    if (realIp) return realIp
  }
  return process.env.NODE_ENV === 'test' && process.env.RATE_LIMIT_BACKEND === 'memory'
    ? 'test-client'
    : null
}

function privateHeaders(extra?: HeadersInit): Headers {
  const headers = new Headers(extra)
  headers.set('Cache-Control', 'private, no-store, max-age=0')
  headers.set('Pragma', 'no-cache')
  headers.set('Expires', '0')
  return headers
}

function deniedResponse(decision: RateLimitDecision): NextResponse {
  const retryAfter = Math.max(1, Math.ceil((decision.resetAt - Date.now()) / 1_000))
  return NextResponse.json(
    { error: { code: 'RATE_LIMIT_EXCEEDED', message: 'Too many requests' } },
    {
      status: 429,
      headers: privateHeaders({
        'Retry-After': String(retryAfter),
        'X-RateLimit-Limit': String(decision.limit),
        'X-RateLimit-Remaining': String(decision.remaining),
        'X-RateLimit-Reset': String(Math.ceil(decision.resetAt / 1_000)),
      }),
    },
  )
}

function unavailableResponse(): NextResponse {
  return NextResponse.json(
    { error: { code: 'RATE_LIMIT_BACKEND_UNAVAILABLE', message: 'Service temporarily unavailable' } },
    { status: 503, headers: privateHeaders({ 'Retry-After': '1' }) },
  )
}

async function evaluate(
  preset: RateLimitPresetName,
  scope: string,
  dimension: string,
  value: string,
): Promise<NextResponse | null> {
  try {
    const policy = RateLimitPresets[preset]
    const decision = await getStore().increment(
      deriveRateLimitKey(scope, dimension, value),
      policy.limit,
      policy.windowMs,
    )
    return decision.success ? null : deniedResponse(decision)
  } catch {
    return unavailableResponse()
  }
}

export async function guardRateLimitValueAsync(options: {
  preset: RateLimitPresetName
  keySuffix: string
  dimension: string
  value: string
}): Promise<NextResponse | null> {
  return evaluate(options.preset, options.keySuffix, options.dimension, options.value)
}

export async function guardRateLimitAsync(
  request: Request,
  options: { preset: RateLimitPresetName; keySuffix: string },
): Promise<NextResponse | null> {
  const ip = resolveTrustedClientIp(request)
  if (!ip) return unavailableResponse()
  return evaluate(options.preset, options.keySuffix, 'ip', ip)
}
