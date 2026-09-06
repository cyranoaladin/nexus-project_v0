import { UserRole } from '@prisma/client'

declare module 'next-auth' {
  interface Session {
    user: {
      id: string
      email: string | null
      role: UserRole
      firstName?: string
      lastName?: string
    }
  }

  interface User {
    role: UserRole
    firstName?: string
    lastName?: string
    sessionVersion?: number
  }
}

declare module 'next-auth/jwt' {
  interface JWT {
    role: UserRole
    firstName?: string
    lastName?: string
    sessionVersion?: number
  }
}
