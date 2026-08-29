import 'server-only';

import { NextRequest, NextResponse } from 'next/server';
import { ZodError } from 'zod';

import { auth } from '@/auth';
import { checkBodySize, checkCsrf } from '@/lib/csrf';
import { readBoundedJson } from '@/lib/http/bounded-json';
import { loadPedagogyCatalog } from '@/lib/pre-rentree/pedagogy/catalog';
import { prisma } from '@/lib/prisma';
import { guardRateLimitAsync } from '@/lib/rate-limit';
import { getBilanFeatureFlags } from '@/lib/bilans/requests/feature-flags';

import { AssessmentEngineError } from './errors';
import type {
  AssessmentEngineActor,
  AssessmentEngineContext,
} from './workflow-service';

const ENGINE_ROLES = new Set<AssessmentEngineActor['role']>([
  'PARENT',
  'ELEVE',
  'ASSISTANTE',
  'COACH',
  'ADMIN',
]);
const IDENTIFIER = /^[A-Za-z0-9][A-Za-z0-9._:/-]{0,159}$/;

export function assessmentEngineContext(): AssessmentEngineContext {
  return {
    prisma,
    catalog: loadPedagogyCatalog(),
  };
}

export function engineDisabledResponse(): NextResponse | null {
  if (getBilanFeatureFlags().canonicalIntakeEnabled) return null;
  return NextResponse.json(
    { error: 'Ressource indisponible.' },
    { status: 404, headers: { 'Cache-Control': 'private, no-store' } },
  );
}

export async function requireAssessmentActor(
  allowedRoles: readonly AssessmentEngineActor['role'][],
): Promise<AssessmentEngineActor | NextResponse> {
  try {
    const session = await auth();
    const user = session?.user;
    if (
      !user
      || typeof user.id !== 'string'
      || !IDENTIFIER.test(user.id)
      || typeof user.role !== 'string'
      || !ENGINE_ROLES.has(user.role as AssessmentEngineActor['role'])
    ) {
      return NextResponse.json({ error: 'Authentification requise.' }, {
        status: 401,
        headers: { 'Cache-Control': 'private, no-store' },
      });
    }
    const actor = {
      userId: user.id,
      role: user.role as AssessmentEngineActor['role'],
    };
    if (!allowedRoles.includes(actor.role)) {
      return NextResponse.json({ error: 'Accès refusé.' }, {
        status: 403,
        headers: { 'Cache-Control': 'private, no-store' },
      });
    }
    return actor;
  } catch {
    return NextResponse.json({ error: 'Authentification requise.' }, {
      status: 401,
      headers: { 'Cache-Control': 'private, no-store' },
    });
  }
}

export function isEngineResponse(
  value: unknown,
): value is NextResponse {
  return value instanceof NextResponse;
}

export function parseEngineIdentifier(value: unknown): string | null {
  return typeof value === 'string' && IDENTIFIER.test(value) ? value : null;
}

export function readIdempotencyKey(request: NextRequest): string | null {
  const value = request.headers.get('idempotency-key');
  return value && /^[A-Za-z0-9_-]{16,128}$/.test(value) ? value : null;
}

export async function guardEngineMutation(
  request: NextRequest,
  input: Readonly<{ routeKey: string; userId: string }>,
): Promise<NextResponse | null> {
  const csrf = checkCsrf(request);
  if (csrf) return csrf;
  const bodySize = checkBodySize(request);
  if (bodySize) return bodySize;
  return guardRateLimitAsync(request, {
    preset: 'api',
    userId: input.userId,
    keySuffix: `bilan-engine-${input.routeKey}`,
    requireDistributed: true,
  });
}

export async function readEngineBody(
  request: NextRequest,
  maxBytes = 8_192,
): Promise<unknown | NextResponse> {
  const body = await readBoundedJson(request, { maxBytes });
  if (body.ok) return body.value;
  return NextResponse.json(
    { error: body.kind === 'TOO_LARGE' ? 'Payload trop volumineux.' : 'Requête invalide.' },
    { status: body.kind === 'TOO_LARGE' ? 413 : 400 },
  );
}

export function engineErrorResponse(error: unknown): NextResponse {
  if (error instanceof AssessmentEngineError) {
    const hidden = error.status === 404;
    return NextResponse.json(
      hidden
        ? { error: 'Ressource indisponible.' }
        : { error: 'Opération impossible.', code: error.code },
      {
        status: error.status,
        headers: { 'Cache-Control': 'private, no-store' },
      },
    );
  }
  if (error instanceof ZodError) {
    return NextResponse.json({ error: 'Requête invalide.' }, { status: 400 });
  }
  if (
    typeof error === 'object'
    && error !== null
    && (error as { name?: unknown }).name === 'PedagogyCatalogError'
  ) {
    return NextResponse.json(
      { error: 'Contenu pédagogique indisponible.' },
      { status: 409 },
    );
  }
  return NextResponse.json(
    { error: 'Service temporairement indisponible.' },
    { status: 500 },
  );
}

export function engineJson(value: unknown, status = 200): NextResponse {
  return NextResponse.json(value, {
    status,
    headers: { 'Cache-Control': 'private, no-store' },
  });
}
