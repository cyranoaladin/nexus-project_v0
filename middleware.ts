import { withAuth } from "next-auth/middleware"
import { NextResponse } from "next/server"

export default withAuth(
  function middleware(req) {
    const token = req.nextauth.token
    const { pathname } = req.nextUrl

    // Protection des routes dashboard
    if (pathname.startsWith('/dashboard')) {
      if (!token) {
        return NextResponse.redirect(new URL('/auth/signin', req.url))
      }

      // Vérification des rôles spécifiques
      if (pathname.startsWith('/dashboard/eleve') && token.role !== 'ELEVE') {
        return NextResponse.redirect(new URL('/dashboard', req.url))
      }
      
      if (pathname.startsWith('/dashboard/parent') && token.role !== 'PARENT') {
        return NextResponse.redirect(new URL('/dashboard', req.url))
      }
      
      if (pathname.startsWith('/dashboard/coach') && token.role !== 'COACH') {
        return NextResponse.redirect(new URL('/dashboard', req.url))
      }
      
      if (pathname.startsWith('/dashboard/assistante') && token.role !== 'ASSISTANTE') {
        return NextResponse.redirect(new URL('/dashboard', req.url))
      }
      
      if (pathname.startsWith('/dashboard/admin') && token.role !== 'ADMIN') {
        return NextResponse.redirect(new URL('/dashboard', req.url))
      }
    }

    return NextResponse.next()
  },
  {
    callbacks: {
      authorized: ({ token, req }) => {
        // Permettre l'accès aux pages publiques
        if (!req.nextUrl.pathname.startsWith('/dashboard')) {
          return true
        }
        
        // Exiger une authentification pour les dashboards
        return !!token
      },
    },
  }
)

export const config = {
  matcher: ['/dashboard/:path*']
}