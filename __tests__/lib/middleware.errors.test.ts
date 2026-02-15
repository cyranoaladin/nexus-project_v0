jest.mock('next/server', () => ({
  NextResponse: {
    json: (body: any, init?: { status?: number; headers?: Record<string, string> }) => ({
      status: init?.status,
      body,
      headers: init?.headers,
    }),
  },
}));

import { errorResponse, ErrorCode, HttpStatus } from '@/lib/middleware/errors';

describe('middleware errors', () => {
  it('formats error response with details', () => {
    const res = errorResponse(HttpStatus.BAD_REQUEST, ErrorCode.VALIDATION_ERROR, 'Bad', { field: 'x' }) as any;
    expect(res.status).toBe(400);
    expect(res.body.error).toBe(ErrorCode.VALIDATION_ERROR);
    expect(res.body.details).toEqual({ field: 'x' });
  });
});
