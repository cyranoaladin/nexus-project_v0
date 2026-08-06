import type { NextResponse } from 'next/server'

import {
  guardRateLimitAsync,
  guardRateLimitValueAsync,
  type RateLimitPresetName,
} from './runtime'

type SensitivePolicy = {
  ipPreset?: RateLimitPresetName
  identityPreset?: RateLimitPresetName
  resourcePreset?: RateLimitPresetName
}

export const SENSITIVE_RATE_LIMIT_POLICIES = {
  'parent-signup': { ipPreset: 'authIp', identityPreset: 'authIdentity' },
  'parent-activation': { ipPreset: 'authIp', identityPreset: 'authIdentity' },
  'student-activation': { ipPreset: 'authIp', identityPreset: 'authIdentity' },
  'activation-resend': { ipPreset: 'emailIp', identityPreset: 'resendActivation' },
  'credentials-login': { ipPreset: 'authIp', identityPreset: 'authIdentity' },
  'password-reset-request': { ipPreset: 'emailIp', identityPreset: 'emailIdentity' },
  'password-reset-confirm': { ipPreset: 'authIp', identityPreset: 'authIdentity' },
  'sessions-revoke': { ipPreset: 'authIp', identityPreset: 'authIdentity' },
  'child-create': { ipPreset: 'writeIp', identityPreset: 'writeIdentity' },
  'child-activation': { ipPreset: 'emailIp', identityPreset: 'resendActivation' },
  'test-email': { ipPreset: 'emailIp', identityPreset: 'emailIdentity' },
  'contact-submit': { ipPreset: 'writeIp', identityPreset: 'emailIdentity' },
  'newsletter-subscribe': { ipPreset: 'writeIp', identityPreset: 'emailIdentity' },
  'stage-registration': { ipPreset: 'writeIp', identityPreset: 'writeIdentity', resourcePreset: 'resourceWrite' },
  'assessment-submit': { ipPreset: 'expensiveIp', identityPreset: 'expensiveIdentity', resourcePreset: 'resourceWrite' },
  'reservation-submit': { ipPreset: 'writeIp', identityPreset: 'writeIdentity', resourcePreset: 'resourceWrite' },
  'notification-email': { ipPreset: 'emailIp', identityPreset: 'emailIdentity' },
  'quotes-pdf': { ipPreset: 'expensiveIp', identityPreset: 'expensiveIdentity' },
  'bilan-pallier2': { ipPreset: 'expensiveIp', identityPreset: 'expensiveIdentity', resourcePreset: 'resourceWrite' },
  'admin-stats': { ipPreset: 'readIp', identityPreset: 'readIdentity' },
  'admin-recompute': { ipPreset: 'expensiveIp', identityPreset: 'expensiveIdentity' },
  'session-video-ip': { ipPreset: 'readIp' },
  'session-video-user': { identityPreset: 'readIdentity' },
  'session-book': { ipPreset: 'expensiveIp', identityPreset: 'expensiveIdentity' },
  'session-cancel': { ipPreset: 'expensiveIp', identityPreset: 'expensiveIdentity' },
  'admin-users-read': { ipPreset: 'readIp', identityPreset: 'readIdentity' },
  'admin-users-create': { ipPreset: 'expensiveIp', identityPreset: 'expensiveIdentity' },
  'student-credits': { ipPreset: 'readIp', identityPreset: 'readIdentity' },
  'student-sessions': { ipPreset: 'readIp', identityPreset: 'readIdentity' },
} as const satisfies Record<string, SensitivePolicy>

export type SensitiveRateLimitScope = keyof typeof SENSITIVE_RATE_LIMIT_POLICIES

export async function guardSensitiveRateLimit(
  request: Request,
  input: {
    scope: SensitiveRateLimitScope
    identity?: string | null
    resource?: string | null
    dimensions?: ReadonlyArray<'ip' | 'identity' | 'resource'>
  },
): Promise<NextResponse | null> {
  const policy: SensitivePolicy = SENSITIVE_RATE_LIMIT_POLICIES[input.scope]
  const dimensions = new Set(input.dimensions ?? ['ip', 'identity', 'resource'])

  if (policy.ipPreset && dimensions.has('ip')) {
    const blocked = await guardRateLimitAsync(request, {
      preset: policy.ipPreset,
      keySuffix: `${input.scope}:ip`,
    })
    if (blocked) return blocked
  }

  if (policy.identityPreset && input.identity && dimensions.has('identity')) {
    const blocked = await guardRateLimitValueAsync({
      preset: policy.identityPreset,
      keySuffix: `${input.scope}:identity`,
      dimension: 'identity',
      value: input.identity,
    })
    if (blocked) return blocked
  }

  if (policy.resourcePreset && input.resource && dimensions.has('resource')) {
    const blocked = await guardRateLimitValueAsync({
      preset: policy.resourcePreset,
      keySuffix: `${input.scope}:resource`,
      dimension: 'resource',
      value: input.resource,
    })
    if (blocked) return blocked
  }

  return null
}
