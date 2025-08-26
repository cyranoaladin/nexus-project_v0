import { authOptions } from '@/lib/auth';
import { prisma } from '@/lib/prisma';
import { UserRole } from '@prisma/client';
import { getServerSession } from 'next-auth';
import { NextRequest, NextResponse } from 'next/server';

export const dynamic = 'force-dynamic';

export async function GET(req: NextRequest) {
  try {
    const session = await getServerSession(authOptions);
    const role = session?.user?.role as UserRole | undefined;
    if (
      !role ||
      !([UserRole.ADMIN, UserRole.ASSISTANTE, UserRole.COACH] as UserRole[]).includes(role)
    ) {
      return NextResponse.json({ error: 'Accès non autorisé.' }, { status: 403 });
    }

    // Fetch documents directly from DB for admin listing
    const rows = await prisma.pedagogicalContent.findMany({
      orderBy: { createdAt: 'desc' },
      take: 100,
    });

    const documents = rows.map((r) => ({
      document_id: r.id,
      contenu: r.content,
      metadata: {
        titre: r.title,
        matiere: r.subject,
        niveau: r.grade ?? undefined,
        tags: (() => {
          try {
            return JSON.parse(r.tags || '[]');
          } catch {
            return [];
          }
        })(),
      },
    }));

    return NextResponse.json({ documents });
  } catch (error: any) {
    console.error('[API_RAG_DOCUMENTS_ERROR]', error);
    return NextResponse.json({ error: 'Une erreur interne est survenue.' }, { status: 500 });
  }
}
