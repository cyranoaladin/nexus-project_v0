import { NextResponse } from 'next/server'
import { generateCsrfToken, setCsrfCookie } from '@/lib/security/csrf'

export async function GET() {
  const token = generateCsrfToken()
  setCsrfCookie(token, process.env.NODE_ENV === 'production')
  return NextResponse.json({ token })
}
