export const dynamic = 'force-dynamic';
import { auth } from '@/auth';
import { NextRequest, NextResponse } from 'next/server';

// Keep the authorization boundary for older clients; never alter legacy balances.
export async function GET(_request: NextRequest) {
  try {
    const session = await auth();
    if (!session || !['ADMIN', 'ASSISTANTE'].includes(session.user.role)) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }
    return NextResponse.json({ error: 'La gestion des crédits a été retirée.' }, { status: 410 });
  } catch {
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}
export async function POST(request: NextRequest) { return GET(request); }
