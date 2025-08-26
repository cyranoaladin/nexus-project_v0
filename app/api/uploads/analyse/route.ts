import { authOptions } from '@/lib/auth';
import { getServerSession } from 'next-auth';
import { NextRequest, NextResponse } from 'next/server';

// Simple secure upload endpoint (MVP): validates content-type and size; stores in memory or discards.

const MAX_SIZE_BYTES = 10 * 1024 * 1024; // 10MB
const ALLOWED_TYPES = new Set([
  'application/pdf',
  'image/png',
  'image/jpeg',
]);

// Note: Edge runtime incompatible avec certaines APIs (auth). Garder runtime Node.

export async function POST(request: NextRequest) {
  try {
    // Rate limit uploads per IP to prevent abuse
    const ip = request.headers.get('x-forwarded-for')?.split(',')[0]?.trim() || request.headers.get('x-real-ip') || 'unknown';
    const { rateLimit } = await import('@/lib/rate-limit');
    const { getRateLimitConfig } = await import('@/lib/rate-limit.config');
  const rlConf = getRateLimitConfig('UPLOADS_ANALYSE', { windowMs: 60_000, max: 10 });
  const rl = await rateLimit(rlConf)(`upload_analyse:${ip}`);
  if (!rl.ok) {
    return NextResponse.json({ error: 'Trop de requêtes, réessayez plus tard.' }, { status: 429 });
  }

    const session = await getServerSession(authOptions);
    if (!session?.user) {
      return NextResponse.json({ error: 'Authentification requise' }, { status: 401 });
    }

    const contentType = request.headers.get('content-type') || '';
    const lengthHeader = request.headers.get('content-length');
    const size = lengthHeader ? parseInt(lengthHeader, 10) : NaN;

    if (!ALLOWED_TYPES.has(contentType)) {
      return NextResponse.json({ error: 'Type de fichier non autorisé' }, { status: 415 });
    }
    if (!Number.isFinite(size) || size <= 0 || size > MAX_SIZE_BYTES) {
      return NextResponse.json({ error: 'Fichier trop volumineux' }, { status: 413 });
    }

    // For Edge runtime, buffer the body (limit checked above). In production, prefer signed URLs to object storage.
    const arrayBuffer = await request.arrayBuffer();
    if (arrayBuffer.byteLength > MAX_SIZE_BYTES) {
      return NextResponse.json({ error: 'Fichier trop volumineux' }, { status: 413 });
    }

    // TODO: Antivirus scanning integration (e.g., ClamAV via separate service). For now, accept and return a fake URL.
    const fakeId = crypto.randomUUID();
    const fileExt = contentType === 'application/pdf' ? 'pdf' : (contentType === 'image/png' ? 'png' : 'jpg');
    const signedUrl = `/secure-uploads/${fakeId}.${fileExt}`; // Placeholder; use real signed URLs from storage service.

    return NextResponse.json({
      success: true,
      fileId: fakeId,
      url: signedUrl,
      contentType,
      size: arrayBuffer.byteLength,
    }, { status: 201 });

  } catch (error) {
    console.error('[UPLOAD_ANALYSE_ERROR]', error);
    return NextResponse.json({ error: 'Erreur lors du téléversement' }, { status: 500 });
  }
}
