import { UserRole } from '@prisma/client'
import NextAuth from 'next-auth'

declare module 'next-auth' {
  interface Session {
    user: {
      id: string
      email: string
      role: UserRole
      firstName?: string
      lastName?: string
      bilanRequestId?: string
    }
  }

  interface User {
    role: UserRole
    firstName?: string
    lastName?: string
    bilanRequestId?: string
  }
}

declare module 'next-auth/jwt' {
  interface JWT {
    role: UserRole
    firstName?: string
    lastName?: string
    bilanRequestId?: string
  }
}
