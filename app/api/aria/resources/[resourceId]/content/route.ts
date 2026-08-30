export const dynamic = 'force-dynamic';

import { NextRequest, NextResponse } from 'next/server';
import { auth } from '@/auth';
import { openAriaResourceContentForActor } from '@/lib/aria/application/resources/public';
import { createLogger } from '@/lib/middleware/logger';
import { toAriaErrorResponse } from '@/lib/aria/errors';

export async function GET(
  request: NextRequest,
  context: { params: Promise<{ resourceId: string }> }
) {
  const logger = createLogger(request);
  try {
    const session = await auth();

    if (!session?.user || session.user.role !== 'ELEVE') {
      return NextResponse.json({ error: 'Accès non autorisé' }, { status: 401 });
    }

    const { resourceId } = await context.params;
    const content = await openAriaResourceContentForActor({
      actor: { userId: session.user.id, role: session.user.role },
      resourceId,
    });
    const fileStream = content.createReadStream();

    // ReadableStream adaptateur pour NextResponse
    const webStream = new ReadableStream({
      start(ctrl) {
        fileStream.on('data', (chunk) => ctrl.enqueue(chunk));
        fileStream.on('end', () => {
          void content.close().then(() => ctrl.close(), (error) => ctrl.error(error));
        });
        fileStream.on('error', (err) => {
          void content.close().finally(() => ctrl.error(err));
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
