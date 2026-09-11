/**
 * The one way to define a Core v2 staff endpoint. Every route gets, in this
 * order: correlation id, body-size and CSRF checks, an authenticated session,
 * a Core v2 client (503 when unconfigured — never a v1 fallback), the actor
 * mapping, parsed query/body, and a uniform error envelope. Capabilities are
 * asserted by the services themselves, so a route cannot forget one.
 */
import { randomUUID } from 'node:crypto';
import { NextRequest, NextResponse } from 'next/server';
import type { z } from 'zod';
import type { PrismaClient } from '@/core-v2/generated/client';
import { checkBodySize, checkCsrf } from '@/lib/csrf';
import { isErrorResponse, requireAuth } from '@/lib/guards';
import { logger } from '@/lib/logger';
import { requireCoreV2Client } from '../client';
import { ValidationError } from '../errors';
import { createServiceContext, type ServiceContext } from '../services/context';
import { resolveActor } from './actor';
import { CORRELATION_HEADER, fail, failFromError } from './respond';

const CORRELATION_ID_PATTERN = /^[A-Za-z0-9._:-]{8,128}$/;

export interface RouteArgs<TBody, TQuery> {
  readonly client: PrismaClient;
  readonly ctx: ServiceContext;
  readonly body: TBody;
  readonly query: TQuery;
  readonly params: Readonly<Record<string, string>>;
  readonly request: NextRequest;
}

export interface RouteResult {
  readonly status?: number;
  readonly data: unknown;
}

type RouteContext = { params?: Promise<Record<string, string>> | Record<string, string> };

export type RouteHandler = (request: NextRequest, context?: RouteContext) => Promise<NextResponse>;

export function correlationIdFrom(request: NextRequest): string {
  const provided = request.headers.get(CORRELATION_HEADER)?.trim();
  return provided && CORRELATION_ID_PATTERN.test(provided) ? provided : randomUUID();
}

async function readJsonBody(request: NextRequest): Promise<unknown> {
  const text = await request.text();
  if (text.trim().length === 0) return undefined;
  try {
    return JSON.parse(text) as unknown;
  } catch {
    throw new ValidationError('Request body is not valid JSON.');
  }
}

function parseWith<T extends z.ZodTypeAny>(schema: T | undefined, value: unknown): z.infer<T> | undefined {
  if (!schema) return undefined;
  const result = schema.safeParse(value);
  if (!result.success) {
    throw new ValidationError('Invalid input.', {
      issues: result.error.issues.map((issue) => ({ path: issue.path.join('.'), message: issue.message })),
    });
  }
  return result.data as z.infer<T>;
}

export function defineStaffRoute<B extends z.ZodTypeAny | undefined = undefined, Q extends z.ZodTypeAny | undefined = undefined>(options: {
  readonly body?: B;
  readonly query?: Q;
  readonly handler: (
    args: RouteArgs<B extends z.ZodTypeAny ? z.infer<B> : undefined, Q extends z.ZodTypeAny ? z.infer<Q> : undefined>,
  ) => Promise<RouteResult>;
}): RouteHandler {
  return async (request, context) => {
    const correlationId = correlationIdFrom(request);
    try {
      const tooLarge = checkBodySize(request);
      if (tooLarge) return fail(correlationId, 413, 'PAYLOAD_TOO_LARGE', 'Request body too large.');
      const csrf = checkCsrf(request);
      if (csrf) return fail(correlationId, 403, 'CSRF_REJECTED', 'Cross-origin request refused.');

      const session = await requireAuth();
      if (isErrorResponse(session)) return fail(correlationId, 401, 'UNAUTHENTICATED', 'Sign in required.');

      const client = await requireCoreV2Client();
      const actor = await resolveActor(client, session.user.id);
      const ctx = createServiceContext(actor, { correlationId });

      const rawParams = context?.params ? await context.params : {};
      const query = parseWith(options.query, Object.fromEntries(request.nextUrl.searchParams.entries()));
      const body = options.body ? parseWith(options.body, await readJsonBody(request)) : undefined;

      const result = await options.handler({
        client,
        ctx,
        body: body as never,
        query: query as never,
        params: rawParams,
        request,
      });
      return NextResponse.json(
        { ok: true, data: result.data },
        { status: result.status ?? 200, headers: { [CORRELATION_HEADER]: correlationId } },
      );
    } catch (error) {
      const response = failFromError(error, correlationId);
      if (response.status >= 500) {
        logger.error({ correlationId, path: request.nextUrl.pathname, err: error instanceof Error ? error.message : String(error) }, '[core-v2] unhandled route error');
      }
      return response;
    }
  };
}
