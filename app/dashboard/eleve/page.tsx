"use client";

import { BadgeWidget } from "@/components/ui/badge-widget";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Tabs, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { BookOpen, Calendar, CreditCard, Loader2, LogOut, User, Video, AlertCircle } from "lucide-react";
import { signOut, useSession } from "next-auth/react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { useEffect, useState } from "react";
import SessionBooking from "@/components/ui/session-booking";
import { AriaWidget } from "@/components/ui/aria-widget";

interface DashboardData {
  student: {
    id: string;
    firstName: string;
    lastName: string;
    email: string;
    grade: string;
    school: string;
  };
  credits: {
    balance: number;
    transactions: Array<{
      id: string;
      type: string;
      amount: number;
      description: string;
      createdAt: string;
    }>;
  };
  nextSession: {
    id: string;
    title: string;
    subject: string;
    scheduledAt: string;
    duration: number;
    coach: {
      firstName: string;
      lastName: string;
      pseudonym: string;
    };
  } | null;
  recentSessions: Array<{
    id: string;
    title: string;
    subject: string;
    status: string;
    scheduledAt: string;
    coach: {
      firstName: string;
      lastName: string;
      pseudonym: string;
    };
  }>;
  ariaStats: {
    messagesToday: number;
    totalConversations: number;
  };
  badges: Array<{
    id: string;
    name: string;
    description: string;
    icon: string;
    earnedAt: string;
  }>;
  achievements?: {
    earnedBadges: number;
    recentBadges: Array<{
      id: string;
      name: string;
      description: string;
      icon: string;
      color: string;
      earnedAt: string;
    }>;
  };
}

export default function DashboardEleve() {
  const { data: session, status } = useSession();
  const router = useRouter();
  const [dashboardData, setDashboardData] = useState<DashboardData | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [activeTab, setActiveTab] = useState<'dashboard' | 'booking'>('dashboard');
  const [isAriaOpen, setIsAriaOpen] = useState(false);

  const ariaControls = (
    <>
      <Button
        type="button"
        className="fixed bottom-6 right-6 z-40 h-12 w-12 rounded-full bg-brand-accent text-white shadow-lg hover:bg-brand-accent/90"
        onClick={() => setIsAriaOpen(true)}
        data-testid="aria-chat-trigger"
        aria-label="Ouvrir ARIA"
      >
        ARIA
      </Button>
      <AriaWidget isOpen={isAriaOpen} onClose={() => setIsAriaOpen(false)} />
    </>
  );

  useEffect(() => {
    if (status === "loading") return;

    if (!session || session.user.role !== 'ELEVE') {
      router.push("/auth/signin");
      return;
    }

    const fetchDashboardData = async () => {
      try {
        setLoading(true);
        setError(null);

        const response = await fetch('/api/student/dashboard');

        if (!response.ok) {
          console.error(`[Student Dashboard] Failed to fetch data. Status: ${response.status}`);
          throw new Error('Failed to fetch dashboard data');
        }

        const data = await response.json();
        setDashboardData(data);
      } catch (err) {
        console.error('Error fetching dashboard data:', err);
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
          <Loader2 className="w-8 h-8 animate-spin mx-auto mb-4 text-brand-accent" aria-label="Chargement" />
          <p className="text-neutral-400">Chargement de votre espace...</p>
        </div>
        {ariaControls}
      </div>
    );
  }

  if (error) {
    return (
      <div className="min-h-screen bg-surface-darker flex items-center justify-center">
        <div className="text-center">
          <AlertCircle className="w-8 h-8 mx-auto mb-4 text-rose-300" aria-label="Erreur" />
          <p className="text-rose-200 mb-4">Erreur lors du chargement</p>
          <p className="text-neutral-400 text-sm">{error}</p>
          <Button
            onClick={() => window.location.reload()}
            className="btn-primary mt-4"
          >
            Réessayer
          </Button>
        </div>
        {ariaControls}
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
                <User className="w-8 h-8 text-brand-accent" aria-hidden="true" />
                <div>
                  <h1 className="font-semibold text-white">
                    {session?.user.firstName} {session?.user.lastName}
                  </h1>
                  <p className="text-sm text-neutral-400">Espace Élève</p>
                </div>
              </div>

              {/* Navigation Tabs */}
              <Tabs value={activeTab} onValueChange={(value) => setActiveTab(value as 'dashboard' | 'booking')} className="ml-8">
                <TabsList className="bg-white/5 border border-white/10">
                  <TabsTrigger value="dashboard" className="data-[state=active]:bg-white/10 data-[state=active]:text-white">
                    Tableau de Bord
                  </TabsTrigger>
                  <TabsTrigger value="booking" className="data-[state=active]:bg-white/10 data-[state=active]:text-white">
                    Réserver Session
                  </TabsTrigger>
                </TabsList>
              </Tabs>
            </div>
            <div className="flex items-center gap-3">
              <Button
                variant="outline"
                onClick={() => setIsAriaOpen(true)}
                className="border-white/10 text-neutral-200 hover:text-white"
                aria-label="Ouvrir ARIA"
              >
                ARIA
              </Button>
              <Button
                variant="ghost"
                onClick={() => signOut({ callbackUrl: '/' })}
                className="text-neutral-300 hover:text-white"
                aria-label="Se déconnecter"
              >
                <LogOut className="w-4 h-4 mr-2" aria-hidden="true" />
                Déconnexion
              </Button>
            </div>
          </div>
        </div>
      </header>

      {/* Main Content */}
      <main className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
        {activeTab === 'dashboard' && (
          <>
            {/* Welcome Section */}
            <div className="mb-8">
              <h2 className="text-2xl font-bold text-white mb-2">
                Bonjour {session?.user.firstName} !
              </h2>
              <p className="text-neutral-300">
                Bienvenue dans votre espace personnel Nexus Réussite.
              </p>
            </div>

            {/* Stats Cards */}
            <div className="grid grid-cols-1 md:grid-cols-3 gap-6 mb-8">
              {/* Solde de Crédits */}
              <Card className="bg-surface-card border border-white/10 shadow-premium">
                <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                  <CardTitle className="text-sm font-medium text-neutral-200">Solde de Crédits</CardTitle>
                  <CreditCard className="h-4 w-4 text-brand-accent" aria-hidden="true" />
                </CardHeader>
                <CardContent>
                  <div className="text-2xl font-bold text-brand-accent">
                    {dashboardData?.credits.balance || 0} crédits
                  </div>
                  <p className="text-xs text-neutral-400 mt-1">
                    Disponibles pour vos sessions
                  </p>
                </CardContent>
              </Card>

              {/* Prochaine Session */}
              <Card className="bg-surface-card border border-white/10 shadow-premium">
                <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                  <CardTitle className="text-sm font-medium text-neutral-200">Prochaine Session</CardTitle>
                  <Calendar className="h-4 w-4 text-emerald-300" aria-hidden="true" />
                </CardHeader>
                <CardContent>
                  {dashboardData?.nextSession ? (
                    <>
                      <div className="text-xl font-bold text-white">
                        {new Date(dashboardData.nextSession.scheduledAt).toLocaleDateString('fr-FR', {
                          day: '2-digit',
                          month: 'short'
                        })}
                      </div>
                      <p className="text-xs text-neutral-300 mt-1">
                        {dashboardData.nextSession.subject} • {dashboardData.nextSession.duration}min
                      </p>
                    </>
                  ) : (
                    <>
                      <div className="text-xl font-bold text-neutral-400">
                        Aucune
                      </div>
                      <p className="text-xs text-neutral-400 mt-1">
                        Programmez votre prochaine session
                      </p>
                    </>
                  )}
                </CardContent>
              </Card>

              {/* Badge Progress */}
              <Card className="bg-surface-card border border-white/10 shadow-premium">
                <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                  <CardTitle className="text-sm font-medium text-neutral-200">Progression</CardTitle>
                  <BookOpen className="h-4 w-4 text-purple-300" />
                </CardHeader>
                <CardContent>
                  <div className="text-xl font-bold text-purple-200">
                    {dashboardData?.achievements?.earnedBadges || 0} badges
                  </div>
                  <p className="text-xs text-neutral-400 mt-1">
                    Obtenus ce mois
                  </p>
                </CardContent>
              </Card>
            </div>

            {/* Main Dashboard Grid */}
            <div className="grid grid-cols-1 lg:grid-cols-2 gap-8">
              {/* Sessions Récentes */}
              <Card className="bg-surface-card border border-white/10 shadow-premium">
                <CardHeader>
                  <CardTitle className="flex items-center">
                    <Calendar className="w-5 h-5 mr-2 text-brand-accent" />
                    Sessions Récentes
                  </CardTitle>
                </CardHeader>
                <CardContent>
                  {dashboardData?.recentSessions && dashboardData.recentSessions.length > 0 ? (
                    <div className="space-y-4">
                      {dashboardData.recentSessions.map((session) => (
                        <div
                          key={session.id}
                          className="flex items-center justify-between p-4 bg-white/5 rounded-lg border border-white/10"
                        >
                          <div className="flex-1">
                            <h4 className="font-medium text-white">{session.title}</h4>
                            <p className="text-sm text-neutral-300">{session.subject}</p>
                            <p className="text-sm font-medium text-brand-accent">
                              {new Date(session.scheduledAt).toLocaleDateString('fr-FR')}
                            </p>
                          </div>
                          <div className="flex items-center space-x-2">
                            <span className={`px-2 py-1 text-xs rounded-full ${session.status === 'completed'
                                ? 'bg-emerald-500/15 text-emerald-200 border border-emerald-500/20'
                                : 'bg-amber-500/15 text-amber-200 border border-amber-500/20'
                              }`}>
                              {session.status}
                            </span>
                          </div>
                        </div>
                      ))}
                    </div>
                  ) : (
                    <div className="text-center py-12">
                      <Calendar className="w-16 h-16 text-neutral-500 mx-auto mb-4" />
                      <h3 className="text-lg font-medium text-white mb-2">
                        Aucune session récente
                      </h3>
                      <p className="text-neutral-400">
                        Vos sessions apparaîtront ici une fois programmées.
                      </p>
                      <Button
                        onClick={() => setActiveTab('booking')}
                        className="btn-primary mt-4"
                      >
                        Réserver une session
                      </Button>
                    </div>
                  )}
                </CardContent>
              </Card>

              {/* Badges et Achievements */}
              <Card className="bg-surface-card border border-white/10 shadow-premium">
                <CardHeader>
                  <CardTitle className="flex items-center">
                    <BookOpen className="w-5 h-5 mr-2 text-purple-300" />
                    Mes Badges
                  </CardTitle>
                </CardHeader>
                <CardContent>
                  <BadgeWidget
                    studentId={dashboardData?.student.id || ""}
                    className="h-fit"
                  />
                </CardContent>
              </Card>
            </div>

            {/* Actions Rapides */}
            <Card className="mt-8 bg-surface-card border border-white/10 shadow-premium">
              <CardHeader>
                <CardTitle className="text-white">Actions Rapides</CardTitle>
              </CardHeader>
              <CardContent>
                <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                  <Button
                    variant="outline"
                    className="h-auto p-4 flex flex-col items-center space-y-2 border-white/10 text-neutral-200 hover:text-white"
                    onClick={() => setActiveTab('booking')}
                  >
                    <Calendar className="w-6 h-6 text-brand-accent" />
                    <span>Réserver une Session</span>
                  </Button>
                  <Link href="/dashboard/eleve/sessions">
                    <Button variant="outline" className="w-full h-auto p-4 flex flex-col items-center space-y-2 border-white/10 text-neutral-200 hover:text-white">
                      <Video className="w-6 h-6 text-purple-300" />
                      <span>Mes Sessions</span>
                    </Button>
                  </Link>
                  <Link href="/dashboard/eleve/ressources">
                    <Button variant="outline" className="w-full h-auto p-4 flex flex-col items-center space-y-2 border-white/10 text-neutral-200 hover:text-white">
                      <BookOpen className="w-6 h-6 text-emerald-300" />
                      <span>Ressources Pédagogiques</span>
                    </Button>
                  </Link>
                </div>
              </CardContent>
            </Card>
          </>
        )}

        {activeTab === 'booking' && dashboardData && (
          <SessionBooking
            studentId={session!.user.id}
            userCredits={dashboardData.credits.balance}
            onBookingComplete={(sessionId) => {
              console.log('Session booked:', sessionId);
              // Refresh dashboard data
              window.location.reload();
              setActiveTab('dashboard');
            }}
          />
        )}
      </main>

      {ariaControls}
    </div>
  );
}
