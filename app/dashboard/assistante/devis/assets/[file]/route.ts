import { readFile } from 'fs/promises';
import path from 'path';

import { UserRole } from '@prisma/client';
import { NextResponse } from 'next/server';

import { isErrorResponse, requireAnyRole } from '@/lib/guards';
import { getAssistanteDevisCatalog } from '@/lib/assistante-devis-catalog';

export const dynamic = 'force-dynamic';

const toolDir = path.join(process.cwd(), 'src/static-pages/assistante-devis-v3');
const allowedFiles: Record<string, { contentType: string; path: string }> = {
  'app.js': {
    contentType: 'application/javascript; charset=utf-8',
    path: path.join(toolDir, 'app.js'),
  },
  'styles.css': {
    contentType: 'text/css; charset=utf-8',
    path: path.join(toolDir, 'styles.css'),
  },
};

interface RouteParams {
  params: Promise<{ file: string }>;
}

export async function GET(_request: Request, { params }: RouteParams) {
  const sessionOrError = await requireAnyRole([UserRole.ADMIN, UserRole.ASSISTANTE]);
  if (isErrorResponse(sessionOrError)) return sessionOrError;

  const { file } = await params;

  if (file === 'catalogue-operationnel.json') {
    return NextResponse.json(getAssistanteDevisCatalog(), {
      headers: {
        'Cache-Control': 'no-cache, no-store, must-revalidate',
        'X-Robots-Tag': 'noindex, nofollow, noarchive',
      },
    });
  }

  const asset = allowedFiles[file];

  if (!asset) {
    return new NextResponse('Not found', { status: 404 });
  }

  const body = await readFile(asset.path, 'utf8');

  return new NextResponse(body, {
    headers: {
      'Content-Type': asset.contentType,
      'Cache-Control': 'no-cache, no-store, must-revalidate',
      'X-Robots-Tag': 'noindex, nofollow, noarchive',
    },
  });
}
