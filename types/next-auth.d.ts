import { UserRole } from '@prisma/client'

declare module 'next-auth' {
  interface Session {
    user: {
      id: string
      email: string | null
      role: UserRole
      firstName?: string
      lastName?: string
      /** Which store owns this identity (go-live §U/§V); drives which dashboard view renders. */
      authority?: 'CORE_V2' | 'V1'
    }
  }

  interface User {
    role: UserRole
    firstName?: string
    lastName?: string
    sessionVersion?: number
    /** Credential authority that verified this identity (go-live §U/§V). */
    authority?: 'CORE_V2' | 'V1'
  }
}

declare module 'next-auth/jwt' {
  interface JWT {
    role: UserRole
    firstName?: string
    lastName?: string
    sessionVersion?: number
    authority?: 'CORE_V2' | 'V1'
  }
}
