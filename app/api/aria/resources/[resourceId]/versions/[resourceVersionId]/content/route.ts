export const dynamic = 'force-dynamic';

import { NextRequest, NextResponse } from 'next/server';
import { auth } from '@/auth';
import { lockAriaV1Subject } from '@/lib/aria/application/v1-composition';
import { unauthorizedAriaResponse } from '@/lib/aria/transport/session';
import { openAriaResourceContentForActor, authorizeAriaResourceForActor } from '@/lib/aria/application/resources/public';
import { readBoundPrivateV1Session } from '@/lib/auth/private-v1-session';
import { withV1SessionAuthority } from '@/lib/auth/v1-session-authority';
import { AriaAuthorityRevokedError } from '@/lib/aria/kernel/errors';
import { createLogger } from '@/lib/middleware/logger';
import { toAriaErrorResponse } from '@/lib/aria/errors';

export async function GET(
  request: NextRequest,
  context: { params: Promise<{ resourceId: string; resourceVersionId: string }> },
) {
  const logger = createLogger(request);
  let content: Awaited<ReturnType<typeof openAriaResourceContentForActor>> | undefined;
  let closing: Promise<void> | undefined;
  const closeOnce = () => closing ??= content ? content.close() : Promise.resolve();
  try {
    const session = await auth();
    if (!session?.user || session.user.role !== 'ELEVE') {
      return unauthorizedAriaResponse(logger);
    }

    const claims = await readBoundPrivateV1Session(request, session);
    if (!claims) throw new AriaAuthorityRevokedError();
    const { resourceId, resourceVersionId } = await context.params;
    const input = Object.freeze({ actor: claims, resourceId, resourceVersionId });
    await withV1SessionAuthority(claims, async tx => {
      await lockAriaV1Subject(tx, claims.userId, true);
      content = await openAriaResourceContentForActor(input, tx);
    });
    const opened = content!;
    const fileStream = opened.createReadStream();
    const iterator = fileStream[Symbol.asyncIterator]();
    let cancelled = false;
    const webStream = new ReadableStream<Uint8Array>({
      async pull(controller) {
        try {
          const next = await iterator.next();
          if (cancelled) return;
          await withV1SessionAuthority(claims, async tx => {
            await lockAriaV1Subject(tx, claims.userId, true);
            const authorization = await authorizeAriaResourceForActor(input, tx);
            return { next, authorization };
          }, value => {
            value.authorization.assertCurrent();
            if (!cancelled && !value.next.done) controller.enqueue(value.next.value);
          });
          if (next.done) { await closeOnce(); if (!cancelled) controller.close(); }
        } catch (error) {
          if (!fileStream.destroyed) fileStream.destroy();
          let failure = error;
          try { await closeOnce(); }
          catch (closeError) { if (closeError !== error) failure = new AggregateError([error, closeError], 'ARIA resource stream and close failed'); }
          if (!cancelled) controller.error(failure);
        }
      },
      cancel() {
        cancelled = true;
        if (!fileStream.destroyed) fileStream.destroy();
        return closeOnce();
      },
    }, { highWaterMark: 0 });

    return new NextResponse(webStream, {
      status: 200,
      headers: {
        'Content-Type': opened.contentType,
        'Content-Length': opened.sizeBytes.toString(),
        'Content-Disposition': `inline; filename="${opened.filename}"`,
        'Cache-Control': 'private, no-store',
        Vary: 'Cookie',
      },
    });
  } catch (error) {
    try { await closeOnce(); }
    catch (closeError) { return toAriaErrorResponse(new AggregateError([error, closeError], 'ARIA resource open and close failed'), logger); }
    return toAriaErrorResponse(error, logger);
  }
}
