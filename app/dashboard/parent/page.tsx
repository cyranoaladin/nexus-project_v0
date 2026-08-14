"use client";
import { AlertCircle,CreditCard,Loader2,LogOut,MessageCircle,Users } from "lucide-react";
import { signOut,useSession } from "next-auth/react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { buildWhatsAppUrl } from "@/lib/whatsapp";
import { useCallback,useEffect,useState } from "react";

import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card,CardContent,CardHeader,CardTitle } from "@/components/ui/card";

import { AlertsConsolidated } from "@/components/dashboard/parent/AlertsConsolidated";
import { ChildCard,type ParentDashboardChild } from "@/components/dashboard/parent/ChildCard";
import { ParentChildrenEmptyState } from "@/components/dashboard/parent/ParentChildrenEmptyState";
import { BilanGratuitBanner } from "@/components/dashboard/BilanGratuitBanner";
import AddChildDialog from "./add-child-dialog";

interface ParentDashboardData {
  children: ParentDashboardChild[];
}

export default function DashboardParent() {
  const { data: session, status } = useSession()
  const router = useRouter()
  const [dashboardData, setDashboardData] = useState<ParentDashboardData | null>(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [activeRubrique, setActiveRubrique] = useState<'enfants' | 'facturation' | 'alertes'>('enfants');
  const [addChildOpen, setAddChildOpen] = useState(false);

  const refreshDashboardData = useCallback(async (options: { silent?: boolean } = {}) => {
    const silent = options.silent === true;
    try {
      if (!silent) {
        setLoading(true)
        setError(null)
      }

      const response = await fetch('/api/parent/dashboard')

      if (!response.ok) {
        throw new Error('Failed to fetch dashboard data')
      }

      const data = await response.json()
      setDashboardData(data)
    } catch (err) {
      if (!silent) setError(err instanceof Error ? err.message : 'An error occurred')
    } finally {
      if (!silent) setLoading(false)
    }
  }, [])

  useEffect(() => {
    if (status === "loading") return

    if (!session || session.user.role !== 'PARENT') {
      router.push("/auth/signin")
      return
    }

    void refreshDashboardData()
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
          <Button onClick={() => { void refreshDashboardData(); }} className="btn-primary">Réessayer</Button>
        </div>
      </div>
    )
  }

  // Consolidate alerts from all children
  const allAlerts = (dashboardData?.children || []).flatMap((child) =>
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
              <p className="text-xs text-neutral-300">{session?.user.firstName} {session?.user.lastName}</p>
            </div>
          </div>
          <Button variant="ghost" onClick={() => signOut({ callbackUrl: '/' })} className="text-neutral-300">
            <LogOut className="w-4 h-4 mr-2" />
            Déconnexion
          </Button>
        </div>
      </header>

      {/* Main Content */}
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
        <div className="space-y-6">
          <BilanGratuitBanner
            hasChildren={(dashboardData?.children.length ?? 0) > 0}
            onGoToChildren={() => {
              setActiveRubrique('enfants');
              if ((dashboardData?.children.length ?? 0) === 0) setAddChildOpen(true);
            }}
          />

          {/* Rubriques Switcher */}
          <div className="flex flex-wrap gap-2 p-1 bg-white/5 border border-white/10 rounded-xl">
            {([
              { id: 'enfants', label: 'Mes Enfants' },
              { id: 'facturation', label: 'Facturation' },
              { id: 'alertes', label: 'Alertes' },
            ] satisfies Array<{ id: typeof activeRubrique; label: string }>).map((tab) => (
              <Button
                key={tab.id}
                onClick={() => setActiveRubrique(tab.id)}
                variant={activeRubrique === tab.id ? 'default' : 'ghost'}
                className={`flex-1 min-w-[120px] rounded-lg transition-all ${
                  activeRubrique === tab.id
                    ? 'bg-brand-accent text-surface-darker shadow-premium font-bold'
                    : 'text-neutral-300 hover:text-white hover:bg-white/5'
                }`}
                size="sm"
              >
                {tab.label}
              </Button>
            ))}
          </div>

          {activeRubrique === 'enfants' && (
            <div className="space-y-8 animate-fadeIn">
              <div className="flex items-center justify-between">
                <h2 className="text-xl font-bold text-white flex items-center gap-2">
                  Mes Enfants
                  <Badge variant="outline" className="ml-2 border-white/10 text-neutral-300">
                    {dashboardData?.children.length || 0}
                  </Badge>
                </h2>
                <AddChildDialog
                  onChildAdded={() => { void refreshDashboardData({ silent: true }); }}
                  open={addChildOpen}
                  onOpenChange={setAddChildOpen}
                />
              </div>

              {(dashboardData?.children.length ?? 0) === 0 ? (
                <ParentChildrenEmptyState onAddChild={() => setAddChildOpen(true)} />
              ) : (
                <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                  {dashboardData?.children.map((child) => (
                    <ChildCard key={child.id} child={child} />
                  ))}
                </div>
              )}
            </div>
          )}

          {activeRubrique === 'facturation' && (
            <div className="space-y-8 animate-fadeIn">
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
                      <p className="text-xs text-neutral-300">Total Mensuel</p>
                      <p className="text-2xl font-bold text-white">
                        {(dashboardData?.children || []).reduce((sum, c) => sum + (c.subscriptionDetails?.monthlyPrice || 0), 0)} TND
                      </p>
                    </div>
                    <Button asChild variant="outline" className="border-white/10">
                      <Link href="/dashboard/parent/abonnements">Voir les formules</Link>
                    </Button>
                  </div>
                </CardContent>
              </Card>
            </div>
          )}

          {activeRubrique === 'alertes' && (
            <div className="space-y-8 animate-fadeIn">
              <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
                <div className="lg:col-span-2">
                  <AlertsConsolidated alerts={allAlerts} />
                </div>
                <div>
                  <Card className="bg-gradient-to-br from-brand-accent/20 to-surface-card border border-brand-accent/20">
                    <CardContent className="p-6">
                      <MessageCircle className="w-8 h-8 text-brand-accent mb-4" />
                      <h3 className="text-lg font-bold text-white mb-2">Une question sur le suivi ?</h3>
                      <p className="text-sm text-neutral-300 mb-4">
                        Un conseiller vous répond directement, ou vous pouvez passer au centre à
                        Mutuelleville.
                      </p>
                      <Button asChild className="w-full bg-brand-accent text-surface-darker">
                        <a
                          href={buildWhatsAppUrl("le suivi de mon enfant")}
                          target="_blank"
                          rel="noopener noreferrer"
                        >
                          Écrire sur WhatsApp
                        </a>
                      </Button>
                    </CardContent>
                  </Card>
                </div>
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  )
}
