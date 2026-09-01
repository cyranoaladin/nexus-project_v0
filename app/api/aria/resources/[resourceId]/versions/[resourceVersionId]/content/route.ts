export const dynamic = 'force-dynamic';

import { NextRequest, NextResponse } from 'next/server';
import { auth } from '@/auth';
import { unauthorizedAriaResponse } from '@/lib/aria/transport/session';
import { openAriaResourceContentForActor } from '@/lib/aria/application/resources/public';
import { createLogger } from '@/lib/middleware/logger';
import { toAriaErrorResponse } from '@/lib/aria/errors';

export async function GET(
  request: NextRequest,
  context: { params: Promise<{ resourceId: string; resourceVersionId: string }> },
) {
  const logger = createLogger(request);
  try {
    const session = await auth();
    if (!session?.user || session.user.role !== 'ELEVE') {
      return unauthorizedAriaResponse(logger);
    }

    const { resourceId, resourceVersionId } = await context.params;
    const content = await openAriaResourceContentForActor({
      actor: { userId: session.user.id, role: session.user.role },
      resourceId,
      resourceVersionId,
    });
    const fileStream = content.createReadStream();
    const webStream = new ReadableStream({
      start(controller) {
        fileStream.on('data', (chunk) => controller.enqueue(chunk));
        fileStream.on('end', () => {
          void content.close().then(
            () => controller.close(),
            (closeError) => controller.error(closeError),
          );
        });
        fileStream.on('error', (streamError) => {
          void content.close().then(
            () => controller.error(streamError),
            (closeError) => controller.error(new AggregateError(
              [streamError, closeError],
              'ARIA resource stream and close failed',
            )),
          );
        });
      },
      cancel() {
        fileStream.destroy();
        return content.close();
      },
    });

    return new NextResponse(webStream, {
      status: 200,
      headers: {
        'Content-Type': content.contentType,
        'Content-Length': content.sizeBytes.toString(),
        'Content-Disposition': `inline; filename="${content.filename}"`,
        'Cache-Control': 'private, max-age=3600',
      },
    });
  } catch (error) {
    return toAriaErrorResponse(error, logger);
  }
}
