import { authOptions } from '@/lib/auth';
import { getServerSession } from 'next-auth';
import { NextRequest, NextResponse } from 'next/server';

export async function GET(request: NextRequest) {
  try {
    const session = await getServerSession(authOptions);

    if (!session || session.user.role !== 'ELEVE') {
      return NextResponse.json(
        { error: 'Unauthorized' },
        { status: 401 }
      );
    }

    const _studentId = session.user.id;

    // Fetch resources available to the student
    // Modèle Resource non présent: renvoyer une liste vide (placeholder fonctionnel)
    const resources: Array<Record<string, unknown>> = [];

    const formattedResources = resources.map((resource) => {
      const r = resource as Record<string, any>;
      return {
        id: r.id,
        title: r.title,
        description: r.description,
        subject: r.subject?.name ?? 'UNKNOWN',
        type: r.type,
        fileUrl: r.fileUrl,
        thumbnailUrl: r.thumbnailUrl,
        downloads: Array.isArray(r.downloads) ? r.downloads.length : 0,
        lastUpdated: r.updatedAt ?? null,
        isDownloaded: Array.isArray(r.downloads) ? r.downloads.length > 0 : false
      };
    });

    return NextResponse.json(formattedResources);

  } catch (error) {
    console.error('Error fetching student resources:', error);
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    );
  }
}
