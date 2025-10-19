import { withAuth } from 'next-auth/middleware'
import { NextResponse } from 'next/server'

export default withAuth(
  function middleware(req) {
    const token = req.nextauth.token
    const { pathname } = req.nextUrl

    if (pathname.startsWith('/dashboard')) {
      if (!token) {
        return NextResponse.redirect(new URL('/auth/signin', req.url))
      }

      const role = token.role
      if (pathname.startsWith('/dashboard/eleve') && role !== 'ELEVE') return NextResponse.redirect(new URL('/dashboard', req.url))
      if (pathname.startsWith('/dashboard/parent') && role !== 'PARENT') return NextResponse.redirect(new URL('/dashboard', req.url))
      if (pathname.startsWith('/dashboard/coach') && role !== 'COACH') return NextResponse.redirect(new URL('/dashboard', req.url))
      if (pathname.startsWith('/dashboard/assistante') && role !== 'ASSISTANTE') return NextResponse.redirect(new URL('/dashboard', req.url))
      if (pathname.startsWith('/dashboard/admin') && role !== 'ADMIN') return NextResponse.redirect(new URL('/dashboard', req.url))
    }

    return NextResponse.next()
  },
  {
    callbacks: {
      authorized: ({ token, req }) => {
        if (!req.nextUrl.pathname.startsWith('/dashboard')) return true
        return !!token
      },
    },
  }
)

export const config = {
  matcher: ['/dashboard/:path*']
}
