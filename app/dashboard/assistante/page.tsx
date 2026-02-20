"use client";

import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { AlertCircle, Calendar, CreditCard, Loader2, LogOut, Mail, Phone, Users, Settings, UserPlus, Menu, X } from "lucide-react";
import { signOut, useSession } from "next-auth/react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { useEffect, useState } from "react";
import NotificationBell from "@/components/ui/notification-bell";
import SessionManagement from "@/components/ui/session-management";
import { DashboardPilotage } from "@/components/dashboard/DashboardPilotage";

interface AssistantDashboardData {
  stats: {
    totalStudents: number;
    totalCoaches: number;
    totalSessions: number;
    totalRevenue: number;
    pendingBilans: number;
    pendingPayments: number;
    pendingCreditRequests: number;
    pendingSubscriptionRequests: number;
  };
  todaySessions: Array<{
    id: string;
    studentName: string;
    coachName: string;
    subject: string;
    time: string;
    status: string;
    type: string;
  }>;
  recentActivities: Array<{
    id: string;
    type: string;
    title: string;
    description: string;
    time: string;
    status: string;
  }>;
}

export default function DashboardAssistante() {
  const { data: session, status } = useSession();
  const router = useRouter();
  const [dashboardData, setDashboardData] = useState<AssistantDashboardData | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [isMobileMenuOpen, setIsMobileMenuOpen] = useState(false);
  const [activeView, setActiveView] = useState<'dashboard' | 'sessions'>('dashboard');

  useEffect(() => {
    if (status === "loading") return;

    if (!session || session.user.role !== 'ASSISTANTE') {
      router.push("/auth/signin");
      return;
    }

    const fetchDashboardData = async () => {
      try {
        setLoading(true);
        setError(null);
        
        const response = await fetch('/api/assistant/dashboard');
        
        if (!response.ok) {
          throw new Error('Failed to fetch dashboard data');
        }
        
        const data = await response.json();
        setDashboardData(data);
      } catch (err) {
        setError(err instanceof Error ? err.message : 'An error occurred');
      } finally {
        setLoading(false);
      }
    };

    fetchDashboardData();
  }, [session, status, router]);

  if (status === "loading" || loading) {
    return (
      <div className="min-h-screen bg-surface-darker flex items-center justify-center">
        <div className="text-center">
          <Loader2 className="w-8 h-8 animate-spin mx-auto mb-4 text-brand-accent" />
          <p className="text-neutral-400">Chargement de votre espace...</p>
        </div>
      </div>
    );
  }

  if (error) {
    return (
      <div className="min-h-screen bg-surface-darker flex items-center justify-center">
        <div className="text-center">
          <AlertCircle className="w-8 h-8 mx-auto mb-4 text-rose-300" />
          <p className="text-rose-200 mb-4">Erreur lors du chargement</p>
          <p className="text-neutral-400 text-sm">{error}</p>
          <Button 
            onClick={() => window.location.reload()} 
            className="btn-primary mt-4"
          >
            Réessayer
          </Button>
        </div>
      </div>
    );
  }

  if (activeView === 'sessions') {
    return (
      <div className="min-h-screen bg-surface-darker text-neutral-100">
        {/* Header */}
        <header className="bg-surface-card shadow-sm border-b border-white/10">
          <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
            <div className="flex flex-col md:flex-row justify-between items-start md:items-center py-3 md:py-0 md:h-16 gap-3 md:gap-0">
              <div className="flex items-center space-x-4">
                <div className="flex items-center space-x-2">
                  <Phone className="w-6 h-6 md:w-8 md:h-8 text-brand-accent" />
                  <div>
                    <h1 className="font-semibold text-white text-sm md:text-base">
                      Gestion des Sessions
                    </h1>
                    <p className="text-xs md:text-sm text-neutral-400">Supervision des sessions</p>
                  </div>
                </div>
                
                <Button
                  variant="outline"
                  size="sm"
                  onClick={() => setActiveView('dashboard')}
                  className="ml-4 border-white/10 text-neutral-200 hover:text-white hover:border-brand-accent/40"
                >
                  ← Retour au tableau de bord
                </Button>
              </div>
              
              <Button
                variant="ghost"
                onClick={() => signOut({ callbackUrl: '/' })}
                className="text-neutral-300 hover:text-white text-xs md:text-sm"
              >
                <LogOut className="w-3 h-3 md:w-4 md:h-4 mr-1 md:mr-2" />
                <span className="hidden sm:inline">Déconnexion</span>
                <span className="sm:hidden">Déco</span>
              </Button>
            </div>
          </div>
        </header>

        {session?.user?.id && (
          <SessionManagement assistantId={session.user.id} />
        )}
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-surface-darker text-neutral-100">
      {/* Header */}
      <header className="bg-surface-card shadow-sm border-b border-white/10">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="flex justify-between items-center h-16">
            <div className="flex items-center space-x-4">
              <div className="flex items-center space-x-2">
                <Phone className="w-6 h-6 md:w-8 md:h-8 text-brand-accent" />
                <div>
                  <h1 className="font-semibold text-white text-sm md:text-base">
                    Cléa - Assistante Pédagogique
                  </h1>
                  <p className="text-xs md:text-sm text-neutral-400 hidden sm:block">Centre de Coordination</p>
                </div>
              </div>
            </div>
            
            {/* Desktop Navigation */}
            <div className="hidden md:flex items-center space-x-4">
              <NotificationBell />
              <Link href="/dashboard/assistante/subscription-requests">
                <Button variant="ghost" className="text-neutral-300 hover:text-white relative">
                  <CreditCard className="w-4 h-4 mr-2" />
                  Demandes d'Abonnement
                  {(dashboardData?.stats?.pendingSubscriptionRequests ?? 0) > 0 && (
                    <Badge 
                      variant="destructive" 
                      className="absolute -top-1 -right-1 h-5 w-5 rounded-full p-0 flex items-center justify-center text-xs"
                    >
                      {(dashboardData?.stats?.pendingSubscriptionRequests ?? 0) > 9
                        ? '9+'
                        : dashboardData?.stats?.pendingSubscriptionRequests ?? 0}
                    </Badge>
                  )}
                </Button>
              </Link>
              <Link href="/dashboard/assistante/credit-requests">
                <Button variant="ghost" className="text-neutral-300 hover:text-white relative">
                  <CreditCard className="w-4 h-4 mr-2" />
                  Demandes de Crédits
                  {(dashboardData?.stats?.pendingCreditRequests ?? 0) > 0 && (
                    <Badge 
                      variant="destructive" 
                      className="absolute -top-1 -right-1 h-5 w-5 rounded-full p-0 flex items-center justify-center text-xs"
                    >
                      {(dashboardData?.stats?.pendingCreditRequests ?? 0) > 9
                        ? '9+'
                        : dashboardData?.stats?.pendingCreditRequests ?? 0}
                    </Badge>
                  )}
                </Button>
              </Link>
              <Link href="/dashboard/assistante/docs">
                <Button variant="ghost" className="text-neutral-300 hover:text-white">
                  <Settings className="w-4 h-4 mr-2" />
                  Docs internes
                </Button>
              </Link>
              <Button
                variant="ghost"
                onClick={() => signOut({ callbackUrl: '/' })}
                className="text-neutral-300 hover:text-white"
              >
                <LogOut className="w-4 h-4 mr-2" />
                Déconnexion
              </Button>
            </div>

            {/* Mobile menu button */}
            <div className="md:hidden flex items-center space-x-2">
              <NotificationBell />
              <Button
                variant="ghost"
                onClick={() => setIsMobileMenuOpen(!isMobileMenuOpen)}
                className="p-2"
              >
                {isMobileMenuOpen ? (
                  <X className="w-5 h-5" />
                ) : (
                  <Menu className="w-5 h-5" />
                )}
              </Button>
            </div>
          </div>

          {/* Mobile Navigation */}
          {isMobileMenuOpen && (
            <div className="md:hidden border-t border-white/10 py-4 space-y-2">
              <Link href="/dashboard/assistante/subscription-requests">
                <Button variant="ghost" className="w-full justify-start text-neutral-300 hover:text-white relative">
                  <CreditCard className="w-4 h-4 mr-2" />
                  Demandes d'Abonnement
                  {(dashboardData?.stats?.pendingSubscriptionRequests ?? 0) > 0 && (
                    <Badge 
                      variant="destructive" 
                      className="ml-auto h-5 w-5 rounded-full p-0 flex items-center justify-center text-xs"
                    >
                      {(dashboardData?.stats?.pendingSubscriptionRequests ?? 0) > 9
                        ? '9+'
                        : dashboardData?.stats?.pendingSubscriptionRequests ?? 0}
                    </Badge>
                  )}
                </Button>
              </Link>
              <Link href="/dashboard/assistante/credit-requests">
                <Button variant="ghost" className="w-full justify-start text-neutral-300 hover:text-white relative">
                  <CreditCard className="w-4 h-4 mr-2" />
                  Demandes de Crédits
                  {(dashboardData?.stats?.pendingCreditRequests ?? 0) > 0 && (
                    <Badge 
                      variant="destructive" 
                      className="ml-auto h-5 w-5 rounded-full p-0 flex items-center justify-center text-xs"
                    >
                      {(dashboardData?.stats?.pendingCreditRequests ?? 0) > 9
                        ? '9+'
                        : dashboardData?.stats?.pendingCreditRequests ?? 0}
                    </Badge>
                  )}
                </Button>
              </Link>
              <Link href="/dashboard/assistante/docs">
                <Button variant="ghost" className="w-full justify-start text-neutral-300 hover:text-white">
                  <Settings className="w-4 h-4 mr-2" />
                  Docs internes
                </Button>
              </Link>
              <Button
                variant="ghost"
                onClick={() => signOut({ callbackUrl: '/' })}
                className="w-full justify-start text-neutral-300 hover:text-white"
              >
                <LogOut className="w-4 h-4 mr-2" />
                Déconnexion
              </Button>
            </div>
          )}
        </div>
      </header>

      {/* Main Content */}
      <main className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-4 md:py-8">
        <DashboardPilotage role="ASSISTANTE">
        {/* Alertes et Tâches Urgentes */}
        {(dashboardData?.stats?.pendingBilans || 0) > 0 || (dashboardData?.stats?.pendingPayments || 0) > 0 || (dashboardData?.stats?.pendingCreditRequests || 0) > 0 || (dashboardData?.stats?.pendingSubscriptionRequests || 0) > 0 ? (
          <div className="mb-6 md:mb-8">
            <Card className="border-amber-500/20 bg-amber-500/10">
              <CardHeader>
                <CardTitle className="flex items-center text-amber-200 text-sm md:text-base">
                  <AlertCircle className="w-4 h-4 md:w-5 md:h-5 mr-2 text-amber-200" />
                  Tâches Urgentes
                </CardTitle>
              </CardHeader>
              <CardContent>
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 md:gap-4">
                  {(dashboardData?.stats?.pendingBilans || 0) > 0 && (
                    <div className="flex items-center justify-between p-3 bg-surface-card rounded-lg border border-white/10">
                      <div>
                        <p className="font-medium text-white text-sm md:text-base">Nouveaux bilans gratuits</p>
                        <p className="text-xs md:text-sm text-neutral-400">À traiter sous 24h</p>
                      </div>
                      <Badge variant="destructive">
                        {dashboardData?.stats?.pendingBilans || 0}
                      </Badge>
                    </div>
                  )}
                  {(dashboardData?.stats?.pendingPayments || 0) > 0 && (
                    <div className="flex items-center justify-between p-3 bg-surface-card rounded-lg border border-white/10">
                      <div>
                        <p className="font-medium text-white text-sm md:text-base">Paiements à valider</p>
                        <p className="text-xs md:text-sm text-neutral-400">Virements bancaires</p>
                      </div>
                      <Badge variant="destructive">
                        {dashboardData?.stats?.pendingPayments || 0}
                      </Badge>
                    </div>
                  )}
                  {(dashboardData?.stats?.pendingCreditRequests || 0) > 0 && (
                    <div className="flex items-center justify-between p-3 bg-surface-card rounded-lg border border-white/10">
                      <div>
                        <p className="font-medium text-white text-sm md:text-base">Demandes de crédits</p>
                        <p className="text-xs md:text-sm text-neutral-400">À approuver</p>
                      </div>
                      <div className="flex items-center space-x-2">
                        <Badge variant="destructive">
                          {dashboardData?.stats?.pendingCreditRequests || 0}
                        </Badge>
                        <Link href="/dashboard/assistante/credit-requests">
                          <Button variant="outline" size="sm" className="text-xs border-white/10 text-neutral-200 hover:text-white">
                            Voir
                          </Button>
                        </Link>
                      </div>
                    </div>
                  )}
                  {(dashboardData?.stats?.pendingSubscriptionRequests || 0) > 0 && (
                    <div className="flex items-center justify-between p-3 bg-surface-card rounded-lg border border-white/10">
                      <div>
                        <p className="font-medium text-white text-sm md:text-base">Demandes d'abonnement</p>
                        <p className="text-xs md:text-sm text-neutral-400">À approuver</p>
                      </div>
                      <div className="flex items-center space-x-2">
                        <Badge variant="destructive">
                          {dashboardData?.stats?.pendingSubscriptionRequests || 0}
                        </Badge>
                        <Link href="/dashboard/assistante/subscription-requests">
                          <Button variant="outline" size="sm" className="text-xs border-white/10 text-neutral-200 hover:text-white">
                            Voir
                          </Button>
                        </Link>
                      </div>
                    </div>
                  )}
                </div>
              </CardContent>
            </Card>
          </div>
        ) : null}

        {/* Administrative Actions */}
        <div className="mb-6 md:mb-8">
          <Card className="bg-surface-card border border-white/10 shadow-premium">
            <CardHeader>
              <CardTitle className="flex items-center text-sm md:text-base text-white">
                <Settings className="w-4 h-4 md:w-5 md:h-5 mr-2 text-brand-accent" />
                Actions Administratives
              </CardTitle>
            </CardHeader>
            <CardContent>
              <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3 md:gap-4">
                <Link href="/dashboard/assistante/coaches">
                  <Button variant="outline" className="h-auto p-3 md:p-4 flex flex-col items-center space-y-2 w-full border-white/10 text-neutral-200 hover:text-white hover:border-brand-accent/40">
                    <UserPlus className="w-5 h-5 md:w-6 md:h-6 text-brand-accent" />
                    <span className="text-xs md:text-sm font-medium">Gérer les Coachs</span>
                    <span className="text-xs text-neutral-400 text-center">Créer et gérer les coachs</span>
                  </Button>
                </Link>
                
                <Link href="/dashboard/assistante/credits">
                  <Button variant="outline" className="h-auto p-3 md:p-4 flex flex-col items-center space-y-2 w-full border-white/10 text-neutral-200 hover:text-white hover:border-brand-accent/40">
                    <CreditCard className="w-5 h-5 md:w-6 md:h-6 text-emerald-300" />
                    <span className="text-xs md:text-sm font-medium">Gérer les Crédits</span>
                    <span className="text-xs text-neutral-400 text-center">Ajouter/Retirer des crédits</span>
                  </Button>
                </Link>
                
                <Link href="/dashboard/assistante/students">
                  <Button variant="outline" className="h-auto p-3 md:p-4 flex flex-col items-center space-y-2 w-full border-white/10 text-neutral-200 hover:text-white hover:border-brand-accent/40">
                    <Users className="w-5 h-5 md:w-6 md:h-6 text-purple-300" />
                    <span className="text-xs md:text-sm font-medium">Gérer les Élèves</span>
                    <span className="text-xs text-neutral-400 text-center">Voir tous les élèves</span>
                  </Button>
                </Link>

                <Button variant="outline" className="h-auto p-3 md:p-4 flex flex-col items-center space-y-2 w-full border-white/10 text-neutral-200 hover:text-white hover:border-brand-accent/40"
                  onClick={() => setActiveView('sessions')}>
                  <Calendar className="w-5 h-5 md:w-6 md:h-6 text-brand-accent" />
                  <span className="text-xs md:text-sm font-medium">Gérer les Sessions</span>
                  <span className="text-xs text-neutral-400 text-center">Superviser les sessions</span>
                </Button>
              </div>
            </CardContent>
          </Card>
        </div>

        {/* Main Dashboard Grid */}
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-6 md:gap-8">
          {/* Sessions d'Aujourd'hui */}
          <Card className="bg-surface-card border border-white/10 shadow-premium">
            <CardHeader>
              <CardTitle className="flex items-center text-sm md:text-base text-white">
                <Calendar className="w-4 h-4 md:w-5 md:h-5 mr-2 text-brand-accent" />
                Sessions d'Aujourd'hui
              </CardTitle>
            </CardHeader>
            <CardContent>
              {dashboardData?.todaySessions && dashboardData.todaySessions.length > 0 ? (
                <div className="space-y-3">
                  {dashboardData.todaySessions.map((session) => (
                    <div
                      key={session.id}
                      className="flex items-center justify-between p-3 bg-white/5 rounded-lg border border-white/10"
                    >
                      <div className="flex-1 min-w-0">
                        <p className="font-medium text-white text-sm md:text-base truncate">{session.studentName}</p>
                        <p className="text-xs md:text-sm text-neutral-300 truncate">
                          {session.subject} - {session.coachName}
                        </p>
                        <p className="text-xs text-brand-accent">{session.time}</p>
                      </div>
                      <Badge
                        variant={
                          session.status === 'SCHEDULED' ? 'default' :
                          session.status === 'COMPLETED' ? 'outline' : 'destructive'
                        }
                        className="ml-2 text-xs"
                      >
                        {session.status}
                      </Badge>
                    </div>
                  ))}
                </div>
              ) : (
                <div className="text-center py-8">
                  <Calendar className="w-12 h-12 text-neutral-500 mx-auto mb-4" />
                  <p className="text-neutral-400 text-sm md:text-base">Aucune session aujourd'hui</p>
                </div>
              )}
            </CardContent>
          </Card>

          {/* Outils de Gestion */}
          <Card className="bg-surface-card border border-white/10 shadow-premium">
            <CardHeader>
              <CardTitle className="flex items-center text-sm md:text-base text-white">
                <CreditCard className="w-4 h-4 md:w-5 md:h-5 mr-2 text-emerald-300" />
                Outils de Gestion
              </CardTitle>
            </CardHeader>
            <CardContent>
              <div className="space-y-3 md:space-y-4">
                <Button variant="outline" className="w-full justify-start h-auto p-3 md:p-4 border-white/10 text-neutral-200 hover:text-white hover:border-brand-accent/40">
                  <div className="flex items-center space-x-3">
                    <Users className="w-4 h-4 md:w-5 md:h-5 text-brand-accent" />
                    <div className="text-left">
                      <p className="font-medium text-sm md:text-base">Gestion des Utilisateurs</p>
                      <p className="text-xs md:text-sm text-neutral-400">Créer, modifier, désactiver</p>
                    </div>
                  </div>
                </Button>

                <Button variant="outline" className="w-full justify-start h-auto p-3 md:p-4 border-white/10 text-neutral-200 hover:text-white hover:border-brand-accent/40">
                  <div className="flex items-center space-x-3">
                    <CreditCard className="w-4 h-4 md:w-5 md:h-5 text-emerald-300" />
                    <div className="text-left">
                      <Link href="/dashboard/assistante/paiements" className="font-medium text-sm md:text-base text-neutral-100">
                        Validation Paiements
                      </Link>
                      <p className="text-xs md:text-sm text-neutral-400">Virements bancaires</p>
                    </div>
                  </div>
                </Button>

                <Button variant="outline" className="w-full justify-start h-auto p-3 md:p-4 border-white/10 text-neutral-200 hover:text-white hover:border-brand-accent/40">
                  <div className="flex items-center space-x-3">
                    <Mail className="w-4 h-4 md:w-5 md:h-5 text-purple-300" />
                    <div className="text-left">
                      <p className="font-medium text-sm md:text-base">Support Client</p>
                      <p className="text-xs md:text-sm text-neutral-400">Messages et demandes</p>
                    </div>
                  </div>
                </Button>
              </div>

              <div className="mt-6 p-3 md:p-4 bg-amber-500/10 border border-amber-500/20 rounded-lg">
                <p className="text-xs md:text-sm text-amber-200">
                  <strong>Note :</strong> Les outils de gestion avancés seront disponibles
                  dans les prochaines phases de développement.
                </p>
              </div>
            </CardContent>
          </Card>
        </div>
        </DashboardPilotage>
      </main>
    </div>
  );
}
