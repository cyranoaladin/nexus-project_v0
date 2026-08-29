export const dynamic = 'force-dynamic';

import { NextRequest, NextResponse } from 'next/server';
import fs from 'fs';
import { auth } from '@/auth';
import { prisma } from '@/lib/prisma';
import { getResource, resolveResourceFilePath } from '@/lib/aria/resources';
import { resolveAriaCourseAccess } from '@/lib/aria/access';

export async function GET(
  request: NextRequest,
  context: { params: Promise<{ resourceId: string }> }
) {
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
    const resource = getResource(resourceId);

    if (!resource) {
      return NextResponse.json({ error: 'Ressource introuvable' }, { status: 404 });
    }

    const student = await prisma.student.findUnique({
      where: { userId: session.user.id },
      include: {
        academicEnrollments: true,
      },
    });

    if (!student) {
      return NextResponse.json({ error: 'Profil élève introuvable' }, { status: 404 });
    }

    const access = resolveAriaCourseAccess({
      courseKey: resource.courseKey,
      student,
    });

    if (!access.academicallyRelevant) {
      return NextResponse.json(
        { error: 'Ressource non accessible pour votre niveau scolaire' },
        { status: 403 }
      );
    }

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
  } catch {
    return NextResponse.json(
      { error: 'Erreur lors du chargement du fichier de ressource' },
      { status: 500 }
    );
  }
}
