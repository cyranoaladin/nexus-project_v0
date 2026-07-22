import { readFile } from 'fs/promises';
import path from 'path';

import { UserRole } from '@prisma/client';
import { NextResponse } from 'next/server';

import { isErrorResponse, requireAnyRole } from '@/lib/guards';

export const dynamic = 'force-dynamic';

const toolDir = path.join(process.cwd(), 'src/static-pages/assistante-devis-v3');

function buildToolHtml(html: string) {
  return html
    .replace('href="../Visuels/nexus_icon.svg"', 'href="/images/logo_slogan_nexus_x3.png"')
    .replace('href="styles.css"', 'href="/dashboard/assistante/devis/assets/styles.css"')
    .replace('href="tailwind-build.css"', 'href="/dashboard/assistante/devis/assets/tailwind-build.css"')
    .replace('src="app.js"', 'src="/dashboard/assistante/devis/assets/app.js"');
}

function toolContentSecurityPolicy() {
  return [
    "default-src 'self'",
    "script-src 'self' 'unsafe-inline' 'unsafe-eval' https://cdnjs.cloudflare.com",
    "style-src 'self' 'unsafe-inline' https://fonts.googleapis.com https://cdnjs.cloudflare.com",
    "font-src 'self' data: https://fonts.gstatic.com https://cdnjs.cloudflare.com",
    "img-src 'self' data: https: blob:",
    "connect-src 'self'",
    "frame-ancestors 'self'",
    "base-uri 'self'",
    "form-action 'self'",
    "object-src 'none'",
  ].join('; ');
}

export async function GET() {
  const sessionOrError = await requireAnyRole([UserRole.ADMIN, UserRole.ASSISTANTE]);
  if (isErrorResponse(sessionOrError)) return sessionOrError;

  const html = await readFile(path.join(toolDir, 'index.html'), 'utf8');
  const response = new NextResponse(buildToolHtml(html), {
    headers: {
      'Content-Type': 'text/html; charset=utf-8',
      'Cache-Control': 'no-cache, no-store, must-revalidate',
      'Content-Security-Policy': toolContentSecurityPolicy(),
      'X-Frame-Options': 'SAMEORIGIN',
      'X-Robots-Tag': 'noindex, nofollow, noarchive',
    },
  });

  return response;
}
