// app/api/admin/aria-config/route.ts
import { NextRequest, NextResponse } from 'next/server';
import { getAriaConfig, setAriaConfig } from '@/lib/aria/runtime-config';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

export async function GET() {
  try {
    const cfg = getAriaConfig();
    return NextResponse.json(cfg);
  } catch (e: any) {
    return NextResponse.json({ error: e?.message || 'Erreur' }, { status: 500 });
  }
}

export async function POST(req: NextRequest) {
  try {
    const body = await req.json();
    const amplify = !!body?.amplify;
    const cfg = setAriaConfig({ amplify });
    return NextResponse.json(cfg);
  } catch (e: any) {
    return NextResponse.json({ error: e?.message || 'Erreur' }, { status: 500 });
  }
}
