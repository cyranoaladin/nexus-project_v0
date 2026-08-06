import { NextRequest, NextResponse } from 'next/server'
import { z } from 'zod'

import type { ActivationPurpose } from '@/lib/auth/activation-token'
import { withActivationSecurityHeaders } from '@/lib/auth/parent-activation'
import { guardSensitiveRateLimit } from '@/lib/rate-limit/sensitive'
import {
  completeStudentActivation,
  verifyActivationToken,
} from '@/lib/services/student-activation.service'

const purposeSchema = z.enum(['parent', 'student'])
const tokenSchema = z.string().min(32).max(512).regex(/^[A-Za-z0-9_-]+$/)
const setPasswordSchema = z.object({
  token: tokenSchema,
  password: z.string().min(8),
  purpose: purposeSchema.optional(),
}).strict()

function resolvePurpose(
  requested: string | null | undefined,
  fixedPurpose?: ActivationPurpose,
): ActivationPurpose | null {
  if (fixedPurpose && requested && requested !== fixedPurpose) return null
  if (fixedPurpose) return fixedPurpose
  const parsed = purposeSchema.safeParse(requested)
  return parsed.success ? parsed.data : null
}

async function verifyForPurpose(token: string, purpose: ActivationPurpose) {
  return purpose === 'student'
    ? verifyActivationToken(token)
    : verifyActivationToken(token, purpose)
}

async function completeForPurpose(
  token: string,
  password: string,
  purpose: ActivationPurpose,
) {
  return purpose === 'student'
    ? completeStudentActivation(token, password)
    : completeStudentActivation(token, password, purpose)
}

export async function handleActivationGet(
  request: NextRequest,
  fixedPurpose?: ActivationPurpose,
) {
  try {
    const url = new URL(request.url)
    const purpose = resolvePurpose(url.searchParams.get('purpose'), fixedPurpose)
    const token = url.searchParams.get('token')
    if (!purpose || !token || !tokenSchema.safeParse(token).success) {
      return withActivationSecurityHeaders(NextResponse.json(
        { valid: false, error: 'Token manquant ou invalide' },
        { status: 400 },
      ))
    }

    const blocked = await guardSensitiveRateLimit(request, {
      scope: purpose === 'parent' ? 'parent-activation' : 'student-activation',
      identity: token,
    })
    if (blocked) return withActivationSecurityHeaders(blocked)

    return withActivationSecurityHeaders(NextResponse.json(
      await verifyForPurpose(token, purpose),
    ))
  } catch (error) {
    console.error('[activation] Verification failed', {
      code: error instanceof Error ? error.name : 'ACTIVATION_VERIFY_FAILED',
    })
    return withActivationSecurityHeaders(NextResponse.json(
      { valid: false, error: 'Erreur interne' },
      { status: 500 },
    ))
  }
}

export async function handleActivationPost(
  request: NextRequest,
  fixedPurpose?: ActivationPurpose,
) {
  try {
    const parsed = setPasswordSchema.safeParse(await request.json())
    if (!parsed.success) {
      return withActivationSecurityHeaders(NextResponse.json(
        { error: 'Données invalides' },
        { status: 400 },
      ))
    }

    const purpose = resolvePurpose(parsed.data.purpose, fixedPurpose)
    if (!purpose) {
      return withActivationSecurityHeaders(NextResponse.json(
        { error: 'Données invalides' },
        { status: 400 },
      ))
    }

    const blocked = await guardSensitiveRateLimit(request, {
      scope: purpose === 'parent' ? 'parent-activation' : 'student-activation',
      identity: parsed.data.token,
    })
    if (blocked) return withActivationSecurityHeaders(blocked)

    const result = await completeForPurpose(parsed.data.token, parsed.data.password, purpose)
    if (!result.success) {
      return withActivationSecurityHeaders(NextResponse.json(
        { error: result.error },
        { status: 400 },
      ))
    }

    return withActivationSecurityHeaders(NextResponse.json({
      success: true,
      redirectUrl: result.redirectUrl,
      message: 'Compte activé avec succès. Vous pouvez maintenant vous connecter.',
    }))
  } catch (error) {
    console.error('[activation] Completion failed', {
      code: error instanceof Error ? error.name : 'ACTIVATION_COMPLETE_FAILED',
    })
    return withActivationSecurityHeaders(NextResponse.json(
      { error: 'Erreur interne du serveur' },
      { status: 500 },
    ))
  }
}
