import { createReadStream, existsSync } from 'fs';
import { NextRequest, NextResponse } from 'next/server';
import path from 'path';

export async function GET(_req: NextRequest, { params }: { params: { path: string[]; }; }) {
  const rel = params.path.join('/');
  const abs = path.resolve(process.cwd(), 'storage/reports', rel);
  if (!existsSync(abs)) return NextResponse.json({ error: 'not found' }, { status: 404 });
  const stream = createReadStream(abs);
  return new NextResponse(stream as any, { headers: { 'Content-Type': 'application/pdf' } });
}
