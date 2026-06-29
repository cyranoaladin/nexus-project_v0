import { readFile, stat } from 'fs/promises';
import { join } from 'path';
import { serializeError } from '@/lib/utils/serialize-error';

import { NextResponse } from 'next/server';

const FILE_NAME = 'Corrige_DNB_Maths_2026_Nexus_Reussite.pdf';
const FILE_PATH = join(process.cwd(), 'public', 'documents', FILE_NAME);

export const dynamic = 'force-dynamic';

export async function GET() {
  try {
    const fileStats = await stat(FILE_PATH);
    const fileBuffer = await readFile(FILE_PATH);

    return new NextResponse(fileBuffer, {
      status: 200,
      headers: {
        'Content-Type': 'application/pdf',
        'Content-Length': fileStats.size.toString(),
        'Content-Disposition': `inline; filename="${FILE_NAME}"`,
        'Cache-Control': 'public, max-age=3600, stale-while-revalidate=86400',
        'X-Content-Type-Options': 'nosniff',
        'X-Frame-Options': 'SAMEORIGIN',
        'Content-Security-Policy': "frame-ancestors 'self'; object-src 'none'; base-uri 'self'",
      },
    });
  } catch (error) {
    console.error('[public-documents/corrige-dnb-maths-2026] PDF unavailable', serializeError(error));
    return NextResponse.json(
      { error: 'PDF not found' },
      { status: 404 }
    );
  }
}
