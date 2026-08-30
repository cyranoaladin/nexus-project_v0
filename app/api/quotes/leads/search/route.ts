import { NextResponse } from 'next/server';

export async function GET(_request: Request) {
  return NextResponse.json(
    { error: 'METHOD_NOT_ALLOWED' },
    {
      status: 405,
      headers: {
        'Cache-Control': 'private, no-store, max-age=0',
        Pragma: 'no-cache',
      },
    }
  );
}
