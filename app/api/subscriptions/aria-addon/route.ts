export const dynamic = 'force-dynamic';

import { NextResponse } from 'next/server'

export async function POST() {
  return NextResponse.json(
    {
      error: 'Route dépréciée. Utiliser /api/parent/subscription-requests avec requestType=ARIA_ADDON.'
    },
    { status: 410 }
  )
}
