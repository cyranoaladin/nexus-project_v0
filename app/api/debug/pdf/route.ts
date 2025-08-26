import { NextRequest, NextResponse } from 'next/server';
import { generatePdfLocally } from '@/lib/aria/pdf-fallback';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

export async function POST(req: NextRequest) {
  try {
    const { content, fileBaseName, studentName, subject } = await req.json();
    if (!content || !fileBaseName) {
      return NextResponse.json({ error: 'content et fileBaseName requis' }, { status: 400 });
    }
    const result = await generatePdfLocally({
      content: String(content),
      fileBaseName: String(fileBaseName),
      studentName: studentName ? String(studentName) : undefined,
      subject: subject ? String(subject) : undefined,
    });
    return NextResponse.json({ url: result.url });
  } catch (e: any) {
    return NextResponse.json({ error: e?.message || 'Erreur interne' }, { status: 500 });
  }
}
