"use client"

import { useSession } from "next-auth/react"
import { useRouter } from "next/navigation"
import { useEffect } from "react"
import { Loader2 } from "lucide-react"

export default function DashboardRedirect() {
  const { data: session, status } = useSession()
  const router = useRouter()

  useEffect(() => {
    if (status === "loading") return

    if (!session) {
      router.push("/auth/signin")
      return
    }

    // Redirection selon le rôle
    switch (session.user.role) {
      case 'ELEVE':
        router.push('/dashboard/eleve')
        break
      case 'PARENT':
        router.push('/dashboard/parent')
        break
      case 'COACH':
        router.push('/dashboard/coach')
        break
      case 'ASSISTANTE':
        router.push('/dashboard/assistante')
        break
      case 'ADMIN':
        router.push('/dashboard/admin')
        break
      default:
        router.push('/auth/signin')
    }
  }, [session, status, router])

  return (
    <div className="min-h-screen bg-surface-darker flex items-center justify-center">
      <div className="text-center">
        <Loader2 className="w-8 h-8 animate-spin mx-auto mb-4 text-brand-accent" />
        <p className="text-neutral-400">Redirection vers votre espace...</p>
      </div>
    </div>
  )
}