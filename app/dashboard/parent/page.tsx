"use client";
import { useEffect, useState, useCallback } from "react";
import { useRouter } from "next/navigation";
import { signOut, useSession } from "next-auth/react";
import { Loader2, Users, CreditCard, LogOut, TrendingUp, AlertCircle } from "lucide-react";

import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";

import { ChildCard } from "@/components/dashboard/parent/ChildCard";
import { AlertsConsolidated } from "@/components/dashboard/parent/AlertsConsolidated";
import AddChildDialog from "./add-child-dialog";

interface ParentDashboardData {
  children: any[];
}

export default function DashboardParent() {
  const { data: session, status } = useSession()
  const router = useRouter()
  const [dashboardData, setDashboardData] = useState<ParentDashboardData | null>(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [activeTab, setActiveTab] = useState<'dashboard' | 'booking'>('dashboard')

  const refreshDashboardData = useCallback(async () => {
    try {
      setLoading(true)
      setError(null)

      const response = await fetch('/api/parent/dashboard')

      if (!response.ok) {
        throw new Error('Failed to fetch dashboard data')
      }

      const data = await response.json()
      setDashboardData(data)
    } catch (err) {
      setError(err instanceof Error ? err.message : 'An error occurred')
    } finally {
      setLoading(false)
    }
  }, [])

  useEffect(() => {
    if (status === "loading") return

    if (!session || session.user.role !== 'PARENT') {
      router.push("/auth/signin")
      return
    }

    refreshDashboardData()
  }, [session, status, router, refreshDashboardData])

  if (status === "loading" || loading) {
    return (
      <div className="min-h-screen bg-surface-darker flex items-center justify-center">
        <Loader2 className="w-8 h-8 animate-spin text-brand-accent" />
      </div>
    )
  }

  if (error) {
    return (
      <div className="min-h-screen bg-surface-darker flex items-center justify-center">
        <div className="text-center">
          <AlertCircle className="w-8 h-8 mx-auto mb-4 text-rose-300" />
          <p className="text-rose-200 mb-4">{error}</p>
          <Button onClick={refreshDashboardData} className="btn-primary">Réessayer</Button>
        </div>
      </div>
    )
  }

  // Consolidate alerts from all children
  const allAlerts = (dashboardData?.children || []).flatMap(child => 
    (child.alerts || []).map((msg: string, i: number) => ({
      id: `${child.id}-${i}`,
      type: 'WARNING' as const,
      message: msg,
      studentName: child.firstName,
      date: new Date().toISOString()
    }))
  )

  return (
    <div className="min-h-screen bg-surface-darker text-neutral-100">
      {/* Header */}
      <header className="bg-surface-card shadow-sm border-b border-white/10">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 h-16 flex items-center justify-between">
          <div className="flex items-center gap-4">
            <Users className="w-8 h-8 text-brand-accent" />
            <div>
              <h1 className="font-semibold text-white">Espace Famille</h1>
              <p className="text-xs text-neutral-400">{session?.user.firstName} {session?.user.lastName}</p>
            </div>
          </div>
          <Button variant="ghost" onClick={() => signOut({ callbackUrl: '/' })} className="text-neutral-400">
            <LogOut className="w-4 h-4 mr-2" />
            Déconnexion
          </Button>
        </div>
      </header>

      {/* Main Content */}
      <main className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
        <div className="grid grid-cols-1 lg:grid-cols-4 gap-8">
          {/* Left Column: Children Grid */}
          <div className="lg:col-span-3 space-y-8">
            <div className="flex items-center justify-between">
              <h2 className="text-xl font-bold text-white flex items-center gap-2">
                Mes Enfants
                <Badge variant="outline" className="ml-2 border-white/10 text-neutral-400">
                  {dashboardData?.children.length || 0}
                </Badge>
              </h2>
              <AddChildDialog onChildAdded={refreshDashboardData} />
            </div>

            <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
              {dashboardData?.children.map((child) => (
                <ChildCard key={child.id} child={child as any} />
              ))}
            </div>

            {/* Facturation summary */}
            <Card className="bg-surface-card border border-white/10 shadow-premium">
              <CardHeader>
                <CardTitle className="text-white text-base flex items-center gap-2">
                  <CreditCard className="w-4 h-4 text-emerald-400" />
                  Facturation Groupée
                </CardTitle>
              </CardHeader>
              <CardContent>
                <div className="flex items-center justify-between p-4 bg-white/5 rounded-lg border border-white/10">
                  <div>
                    <p className="text-xs text-neutral-400">Total Mensuel</p>
                    <p className="text-2xl font-bold text-white">
                      {(dashboardData?.children || []).reduce((sum, c) => sum + (c.subscriptionDetails?.monthlyPrice || 0), 0)} TND
                    </p>
                  </div>
                  <Button variant="outline" className="border-white/10">Gérer mes abonnements</Button>
                </div>
              </CardContent>
            </Card>
          </div>

          {/* Right Column: Alerts & Side info */}
          <div className="space-y-8">
            <AlertsConsolidated alerts={allAlerts} />
            
            <Card className="bg-gradient-to-br from-brand-accent/20 to-surface-card border border-brand-accent/20">
              <CardContent className="p-6">
                <TrendingUp className="w-8 h-8 text-brand-accent mb-4" />
                <h3 className="text-lg font-bold text-white mb-2">Nexus Performance</h3>
                <p className="text-sm text-neutral-400 mb-4">
                  Les trajectoires de vos enfants sont optimisées par l'IA pour garantir les meilleurs résultats au Bac.
                </p>
                <Button className="w-full bg-brand-accent">Voir le rapport annuel</Button>
              </CardContent>
            </Card>
          </div>
        </div>
      </main>
    </div>
  )
}
