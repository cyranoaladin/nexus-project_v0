'use client';

import { CorporateFooter } from '@/components/layout/CorporateFooter';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import {
  Activity,
  BarChart3,
  CreditCard,
  Database,
  Loader2,
  LogOut,
  Settings,
  Shield,
  TestTube,
  Users
} from 'lucide-react';
import { signOut, useSession } from 'next-auth/react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { useEffect, useState } from 'react';
import { DashboardPilotage } from '@/components/dashboard/DashboardPilotage';

interface AdminDashboardData {
  stats: {
    totalUsers: number;
    totalStudents: number;
    totalCoaches: number;
    totalAssistants: number;
    totalParents: number;
    currentMonthRevenue: number;
    lastMonthRevenue: number;
    revenueGrowthPercent: number;
    totalSubscriptions: number;
    activeSubscriptions: number;
    totalSessions: number;
    thisMonthSessions: number;
    lastMonthSessions: number;
    sessionGrowthPercent: number;
  };
  systemHealth: {
    database: string;
    sessions: string;
    payments: string;
    subscriptions: string;
  };
  recentActivities: Array<{
    id: string;
    type: string;
    title: string;
    description: string;
    time: string;
    status: string;
    studentName: string;
    coachName: string;
    subject: string;
    action: string;
  }>;
  userGrowth: Array<{
    month: string;
    count: number;
  }>;
  revenueGrowth: Array<{
    month: string;
    amount: number;
  }>;
}

export default function DashboardAdmin() {
  const { data: session, status } = useSession();
  const router = useRouter();
  const [adminData, setAdminData] = useState<AdminDashboardData | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (status === "loading") return;

    if (!session || session.user.role !== 'ADMIN') {
      router.push("/auth/signin");
      return;
    }

    const fetchAdminData = async () => {
      try {
        setLoading(true);
        setError(null);

        const response = await fetch('/api/admin/dashboard');

        if (!response.ok) {
          throw new Error('Failed to fetch admin dashboard data');
        }

        const data = await response.json();
        setAdminData(data);
      } catch (err) {
        setError(err instanceof Error ? err.message : 'An error occurred');
      } finally {
        setLoading(false);
      }
    };

    fetchAdminData();
  }, [session, status, router]);

  if (status === "loading" || loading) {
    return (
      <div className="min-h-screen bg-surface-darker flex items-center justify-center">
        <div className="text-center">
          <Loader2 className="w-8 h-8 animate-spin mx-auto mb-4 text-brand-accent" aria-label="Chargement" />
          <p className="text-neutral-400">Chargement de l'administration...</p>
        </div>
      </div>
    );
  }

  if (error) {
    return (
      <div className="min-h-screen bg-surface-darker flex items-center justify-center">
        <div className="text-center">
          <div className="w-8 h-8 mx-auto mb-4 text-rose-300">⚠️</div>
          <p className="text-rose-200 mb-4">Erreur lors du chargement</p>
          <p className="text-neutral-400 text-sm">{error}</p>
        </div>
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
                <Shield className="w-6 h-6 md:w-8 md:h-8 text-rose-300" aria-hidden="true" />
                <div>
                  <h1 className="font-semibold text-white text-sm md:text-base">
                    Administration Nexus Réussite
                  </h1>
                  <p className="text-xs md:text-sm text-neutral-400">Contrôle Total du Système</p>
                </div>
              </div>
            </div>
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
      </header>

      {/* Main Content */}
      <main className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-4 md:py-8">
        <DashboardPilotage role="ADMIN">
        {/* Stats Cards */}
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6 mb-8">
          {/* User Counts Section */}
          <Card className="lg:col-span-2 bg-surface-card border border-white/10 shadow-premium">
            <CardHeader>
              <CardTitle className="flex items-center text-sm md:text-base text-white">
                <Users className="w-4 h-4 md:w-5 md:h-5 mr-2 text-brand-accent" aria-hidden="true" />
                Statistiques Utilisateurs
              </CardTitle>
            </CardHeader>
            <CardContent>
              <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
                <div className="text-center">
                  <div className="text-2xl md:text-3xl font-bold text-brand-accent">
                    {adminData?.stats?.totalParents || 0}
                  </div>
                  <p className="text-xs md:text-sm text-neutral-400 mt-1">Parents</p>
                </div>
                <div className="text-center">
                  <div className="text-2xl md:text-3xl font-bold text-emerald-300">
                    {adminData?.stats?.totalStudents || 0}
                  </div>
                  <p className="text-xs md:text-sm text-neutral-400 mt-1">Élèves</p>
                </div>
                <div className="text-center">
                  <div className="text-2xl md:text-3xl font-bold text-purple-300">
                    {adminData?.stats?.totalCoaches || 0}
                  </div>
                  <p className="text-xs md:text-sm text-neutral-400 mt-1">Coachs</p>
                </div>
                <div className="text-center">
                  <div className="text-2xl md:text-3xl font-bold text-amber-300">
                    {adminData?.stats?.totalAssistants || 0}
                  </div>
                  <p className="text-xs md:text-sm text-neutral-400 mt-1">Assistantes</p>
                </div>
              </div>
              <div className="mt-4 pt-4 border-t border-white/10">
                <div className="text-center">
                  <div className="text-lg md:text-xl font-bold text-white">
                    {adminData?.stats?.totalUsers || 0}
                  </div>
                  <p className="text-xs md:text-sm text-neutral-400">Total Utilisateurs</p>
                </div>
              </div>
            </CardContent>
          </Card>

          <Card className="bg-surface-card border border-white/10 shadow-premium">
            <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
              <CardTitle className="text-xs md:text-sm font-medium text-neutral-200">Revenus Mensuels</CardTitle>
              <CreditCard className="h-4 w-4 text-emerald-300" aria-hidden="true" />
            </CardHeader>
            <CardContent>
              <div className="text-xl md:text-2xl font-bold text-emerald-300">
                {adminData?.stats?.currentMonthRevenue?.toLocaleString() || 0} TND
              </div>
              <p className="text-xs text-neutral-400 mt-1">
                {adminData?.stats?.revenueGrowthPercent && adminData.stats.revenueGrowthPercent > 0 ? '+' : ''}{adminData?.stats?.revenueGrowthPercent || 0}% par rapport au mois dernier
              </p>
            </CardContent>
          </Card>

          <Card className="bg-surface-card border border-white/10 shadow-premium">
            <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
              <CardTitle className="text-xs md:text-sm font-medium text-neutral-200">Abonnements Actifs</CardTitle>
              <Activity className="h-4 w-4 text-purple-300" aria-hidden="true" />
            </CardHeader>
            <CardContent>
              <div className="text-xl md:text-2xl font-bold text-purple-200">
                {adminData?.stats?.activeSubscriptions || 0}
              </div>
              <p className="text-xs text-neutral-400 mt-1">
                Taux de rétention: 94%
              </p>
            </CardContent>
          </Card>
        </div>

        {/* Additional Stats Row */}
        <div className="grid grid-cols-1 md:grid-cols-3 gap-6 mb-8">
          <Card className="bg-surface-card border border-white/10 shadow-premium">
            <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
              <CardTitle className="text-xs md:text-sm font-medium text-neutral-200">Sessions ce Mois</CardTitle>
              <Activity className="h-4 w-4 text-brand-accent" aria-hidden="true" />
            </CardHeader>
            <CardContent>
              <div className="text-xl md:text-2xl font-bold text-brand-accent">
                {adminData?.stats?.thisMonthSessions || 0}
              </div>
              <p className="text-xs text-neutral-400 mt-1">
                {adminData?.stats?.sessionGrowthPercent && adminData.stats.sessionGrowthPercent > 0 ? '+' : ''}{adminData?.stats?.sessionGrowthPercent || 0}% par rapport au mois dernier
              </p>
            </CardContent>
          </Card>

          <Card className="bg-surface-card border border-white/10 shadow-premium">
            <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
              <CardTitle className="text-xs md:text-sm font-medium text-neutral-200">Total Sessions</CardTitle>
              <Database className="h-4 w-4 text-indigo-300" aria-hidden="true" />
            </CardHeader>
            <CardContent>
              <div className="text-xl md:text-2xl font-bold text-indigo-300">
                {adminData?.stats?.totalSessions || 0}
              </div>
              <p className="text-xs text-neutral-400 mt-1">
                Toutes sessions confondues
              </p>
            </CardContent>
          </Card>

          <Card className="bg-surface-card border border-white/10 shadow-premium">
            <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
              <CardTitle className="text-xs md:text-sm font-medium text-neutral-200">Total Abonnements</CardTitle>
              <CreditCard className="h-4 w-4 text-amber-300" aria-hidden="true" />
            </CardHeader>
            <CardContent>
              <div className="text-xl md:text-2xl font-bold text-amber-300">
                {adminData?.stats?.totalSubscriptions || 0}
              </div>
              <p className="text-xs text-neutral-400 mt-1">
                Tous abonnements confondus
              </p>
            </CardContent>
          </Card>
        </div>

        {/* Main Dashboard Grid */}
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-6 md:gap-8">
          {/* Outils d'Administration */}
          <Card className="bg-surface-card border border-white/10 shadow-premium">
            <CardHeader>
              <CardTitle className="flex items-center text-sm md:text-base text-white">
                <Settings className="w-4 h-4 md:w-5 md:h-5 mr-2 text-brand-accent" aria-hidden="true" />
                Outils d'Administration
              </CardTitle>
            </CardHeader>
            <CardContent>
              <div className="grid grid-cols-1 md:grid-cols-2 gap-3 md:gap-4">
                <Button variant="outline" className="w-full justify-start h-auto p-3 md:p-4 border-white/10 text-neutral-200 hover:text-white" asChild>
                  <Link href="/dashboard/admin/tests">
                    <div className="flex items-center space-x-3">
                      <TestTube className="w-4 h-4 md:w-5 md:h-5 text-rose-300" aria-hidden="true" />
                      <div className="text-left">
                        <p className="font-medium text-sm md:text-base">Tests Système</p>
                        <p className="text-xs md:text-sm text-neutral-400">Email, Paiements, APIs</p>
                      </div>
                    </div>
                  </Link>
                </Button>

                <Button variant="outline" className="w-full justify-start h-auto p-3 md:p-4 border-white/10 text-neutral-200 hover:text-white" asChild>
                  <Link href="/dashboard/admin/users">
                    <div className="flex items-center space-x-3">
                      <Users className="w-4 h-4 md:w-5 md:h-5 text-brand-accent" aria-hidden="true" />
                      <div className="text-left">
                        <p className="font-medium text-sm md:text-base">Gestion Utilisateurs</p>
                        <p className="text-xs md:text-sm text-neutral-400">CRUD complet</p>
                      </div>
                    </div>
                  </Link>
                </Button>

                <Button variant="outline" className="w-full justify-start h-auto p-3 md:p-4 border-white/10 text-neutral-200 hover:text-white" asChild>
                  <Link href="/dashboard/admin/subscriptions">
                    <div className="flex items-center space-x-3">
                      <CreditCard className="w-4 h-4 md:w-5 md:h-5 text-emerald-300" aria-hidden="true" />
                      <div className="text-left">
                        <p className="font-medium text-sm md:text-base">Abonnements Actifs</p>
                        <p className="text-xs md:text-sm text-neutral-400">Gestion des abonnements</p>
                      </div>
                    </div>
                  </Link>
                </Button>

                <Button variant="outline" className="w-full justify-start h-auto p-3 md:p-4 border-white/10 text-neutral-200 hover:text-white" asChild>
                  <Link href="/dashboard/admin/analytics">
                    <div className="flex items-center space-x-3">
                      <BarChart3 className="w-4 h-4 md:w-5 md:h-5 text-emerald-300" aria-hidden="true" />
                      <div className="text-left">
                        <p className="font-medium text-sm md:text-base">Analytics</p>
                        <p className="text-xs md:text-sm text-neutral-400">Métriques détaillées</p>
                      </div>
                    </div>
                  </Link>
                </Button>

                <Button variant="outline" className="w-full justify-start h-auto p-3 md:p-4 border-white/10 text-neutral-200 hover:text-white" asChild>
                  <Link href="/bilan-pallier2-maths/dashboard">
                    <div className="flex items-center space-x-3">
                      <Activity className="w-4 h-4 md:w-5 md:h-5 text-brand-accent" aria-hidden="true" />
                      <div className="text-left">
                        <p className="font-medium text-sm md:text-base">Diagnostics Pré-Stage</p>
                        <p className="text-xs md:text-sm text-neutral-400">Suivi des bilans</p>
                      </div>
                    </div>
                  </Link>
                </Button>
              </div>
            </CardContent>
          </Card>

          {/* Activité Récente */}
          <Card className="bg-surface-card border border-white/10 shadow-premium">
            <CardHeader>
              <CardTitle className="flex items-center text-sm md:text-base text-white">
                <Activity className="w-4 h-4 md:w-5 md:h-5 mr-2 text-emerald-300" aria-hidden="true" />
                Activité Récente du Système
              </CardTitle>
            </CardHeader>
            <CardContent>
              {adminData?.recentActivities && adminData.recentActivities.length > 0 ? (
                <div className="space-y-3 md:space-y-4">
                  {adminData.recentActivities.slice(0, 4).map((activity, index: number) => (
                    <div key={activity.id || index} className="flex items-start space-x-3 p-3 bg-white/5 border border-white/10 rounded-lg">
                      <div className="flex-shrink-0">
                        {activity.type === 'session' && <Activity className="w-4 h-4 md:w-5 md:h-5 text-brand-accent" aria-hidden="true" />}
                        {activity.type === 'user' && <Users className="w-4 h-4 md:w-5 md:h-5 text-emerald-300" aria-hidden="true" />}
                        {activity.type === 'subscription' && <CreditCard className="w-4 h-4 md:w-5 md:h-5 text-purple-300" aria-hidden="true" />}
                        {activity.type === 'credit' && <CreditCard className="w-4 h-4 md:w-5 md:h-5 text-amber-300" aria-hidden="true" />}
                      </div>
                      <div className="flex-1 min-w-0">
                        <p className="text-xs md:text-sm font-medium text-white truncate">
                          {activity.title}
                        </p>
                        <p className="text-xs text-neutral-400 truncate">
                          {activity.description}
                        </p>
                        <p className="text-xs text-neutral-500">
                          {activity.action} - {new Date(activity.time).toLocaleDateString('fr-FR')}
                        </p>
                      </div>
                      <Badge
                        variant={
                          activity.status === 'COMPLETED'
                            ? 'default'
                            : activity.status === 'SUCCESS'
                              ? 'success'
                              : activity.status === 'WARNING'
                                ? 'warning'
                                : activity.status === 'DESTRUCTIVE'
                                  ? 'destructive'
                                  : 'outline'
                        }
                        className="ml-2 text-xs"
                      >
                        {activity.status}
                      </Badge>
                    </div>
                  ))}

                  {adminData.recentActivities.length > 4 && (
                    <div className="text-center pt-4">
                      <Button variant="outline" size="sm" className="border-white/10 text-neutral-200 hover:text-white" asChild>
                        <Link href="/dashboard/admin/activities">
                          Voir toutes les activités ({adminData.recentActivities.length})
                        </Link>
                      </Button>
                    </div>
                  )}
                </div>
              ) : (
                <div className="text-center py-8">
                  <Activity className="w-12 h-12 text-neutral-500 mx-auto mb-4" aria-hidden="true" />
                  <p className="text-neutral-400 text-sm md:text-base">Aucune activité récente</p>
                </div>
              )}
            </CardContent>
          </Card>
        </div>
        </DashboardPilotage>
      </main>
      <CorporateFooter />
    </div>
  );
}
