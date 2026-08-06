import { NextResponse } from 'next/server';

import { CanonicalApiError } from './errors';

export function canonicalErrorResponse(error: unknown): NextResponse {
  if (error instanceof CanonicalApiError) {
    return NextResponse.json(
      { error: { code: error.code, ...(error.details === undefined ? {} : { details: error.details }) } },
      { status: error.status },
    );
  }

  return NextResponse.json({ error: { code: 'INTERNAL_ERROR' } }, { status: 500 });
}
