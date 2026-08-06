/** Legacy student-only adapter. The canonical controller is /api/auth/activate. */
export const dynamic = 'force-dynamic'

import { NextRequest } from 'next/server'

import {
  handleActivationGet,
  handleActivationPost,
} from '@/lib/auth/activation-controller'

export function GET(request: NextRequest) {
  return handleActivationGet(request, 'student')
}

export function POST(request: NextRequest) {
  return handleActivationPost(request, 'student')
}
