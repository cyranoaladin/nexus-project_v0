import { getServerSession } from 'next-auth';
import { NextRequest, NextResponse } from 'next/server';

import { authOptions } from '@/lib/auth';

export const dynamic = 'force-dynamic';

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
    type ResourcePlaceholder = {
      id?: string;
      title?: string;
      description?: string;
      subject?: { name?: string | null } | null;
      type?: string;
      fileUrl?: string;
      thumbnailUrl?: string;
      downloads?: unknown;
      updatedAt?: Date | string | null;
    };

    const resources: ResourcePlaceholder[] = [];

    const formattedResources = resources.map((resource) => {
      const downloadCount = Array.isArray(resource.downloads) ? resource.downloads.length : 0;
      return {
        id: resource.id ?? '',
        title: resource.title ?? 'Ressource',
        description: resource.description ?? '',
        subject: resource.subject?.name ?? 'UNKNOWN',
        type: resource.type ?? 'UNKNOWN',
        fileUrl: resource.fileUrl ?? null,
        thumbnailUrl: resource.thumbnailUrl ?? null,
        downloads: downloadCount,
        lastUpdated: resource.updatedAt ?? null,
        isDownloaded: downloadCount > 0
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
