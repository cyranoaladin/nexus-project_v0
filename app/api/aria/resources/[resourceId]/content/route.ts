export const dynamic = 'force-dynamic';

import { NextRequest, NextResponse } from 'next/server';
import fs from 'fs';
import { auth } from '@/auth';
import { authorizeAriaResourceForActor } from '@/lib/aria/application/resources/public';
import { resolveResourceFilePath } from '@/lib/aria/resources';
import { createLogger } from '@/lib/middleware/logger';
import { toAriaErrorResponse } from '@/lib/aria/errors';

export async function GET(
  request: NextRequest,
  context: { params: Promise<{ resourceId: string }> }
) {
  const logger = createLogger(request);
  try {
    let session: import('next-auth').Session | null = null;
    try {
      session = await auth();
    } catch {
      // Standalone mode auth fallback
    }

    if (!session?.user || session.user.role !== 'ELEVE') {
      return NextResponse.json({ error: 'Accès non autorisé' }, { status: 401 });
    }

    const { resourceId } = await context.params;
    await authorizeAriaResourceForActor({
      actor: { userId: session.user.id, role: session.user.role },
      resourceId,
    });

    const filePath = resolveResourceFilePath(resourceId);
    if (!filePath || !fs.existsSync(filePath)) {
      return NextResponse.json(
        { error: 'Document non disponible au format fichier' },
        { status: 404 }
      );
    }

    const stat = fs.statSync(filePath);
    const fileStream = fs.createReadStream(filePath);

    // ReadableStream adaptateur pour NextResponse
    const webStream = new ReadableStream({
      start(ctrl) {
        fileStream.on('data', (chunk) => ctrl.enqueue(chunk));
        fileStream.on('end', () => ctrl.close());
        fileStream.on('error', (err) => ctrl.error(err));
      },
      cancel() {
        fileStream.destroy();
      },
    });

    const isPdf = filePath.endsWith('.pdf');
    const contentType = isPdf ? 'application/pdf' : 'application/octet-stream';
    const filename = filePath.split('/').pop() || `${resourceId}.pdf`;

    return new NextResponse(webStream, {
      status: 200,
      headers: {
        'Content-Type': contentType,
        'Content-Length': stat.size.toString(),
        'Content-Disposition': `inline; filename="${filename}"`,
        'Cache-Control': 'private, max-age=3600',
      },
    });
  } catch (error) {
    return toAriaErrorResponse(error, logger);
  }
}
