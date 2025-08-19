'use client';

// Force dynamic rendering to prevent static generation issues
export const dynamic = 'force-dynamic';

import { Footer } from '@/components/layout/footer';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import {
  Activity,
  BarChart,
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

interface DashboardData {
  totalUsers: number;
  totalStudents: number;
  totalCoaches: number;
  totalParents: number;
  totalRevenue: number;
  revenueLast30Days: number;
  totalSubscriptions: number;
  recentActivities: any[];
  userGrowth: any[];
  revenueGrowth: any[];
  totalAssistants: number;
  thisMonthSessions: number;
  sessionGrowthPercent: number;
  totalSessions: number;
}

export default function DashboardAdmin() {
  const { data: session, status } = useSession();
  const router = useRouter();
  const [data, setData] = useState<DashboardData | null>(null);
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
        setData(data);
      } catch (err) {
        console.error('Error fetching admin dashboard data:', err);
        setError(err instanceof Error ? err.message : 'An error occurred');
      } finally {
        setLoading(false);
      }
    };

    fetchAdminData();
  }, [session, status, router]);

  if (status === "loading" || loading) {
    return (
      <div className="min-h-screen bg-gray-50 flex items-center justify-center">
        <div className="text-center">
          <Loader2 className="w-8 h-8 animate-spin mx-auto mb-4 text-blue-600" />
          <p className="text-gray-600">Chargement de l'administration...</p>
        </div>
      </div>
    );
  }

  if (error) {
    return (
      <div className="min-h-screen bg-gray-50 flex items-center justify-center">
        <div className="text-center">
          <div className="w-8 h-8 mx-auto mb-4 text-red-600">⚠️</div>
          <p className="text-red-600 mb-4">Erreur lors du chargement</p>
          <p className="text-gray-600 text-sm">{error}</p>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gray-50">
      {/* Header */}
      <header className="bg-white shadow-sm border-b border-gray-200">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="flex justify-between items-center h-16">
            <div className="flex items-center space-x-4">
              <div className="flex items-center space-x-2">
                <Shield className="w-6 h-6 md:w-8 md:h-8 text-red-600" />
                <div>
                  <h1 className="font-semibold text-gray-900 text-sm md:text-base">
                    Administration Nexus Réussite
                  </h1>
                  <p className="text-xs md:text-sm text-gray-500">Contrôle Total du Système</p>
                </div>
              </div>
            </div>
            <Button
              variant="ghost"
              onClick={() => signOut({ callbackUrl: '/' })}
              className="text-gray-600 hover:text-gray-900"
            >
              <LogOut className="w-4 h-4 mr-2" />
              Déconnexion
            </Button>
          </div>
        </div>
      </header>

      {/* Main Content */}
      <main className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-4 md:py-8">
        {/* Welcome Section */}
        <div className="mb-6 md:mb-8">
          <h2 className="text-xl md:text-2xl font-bold text-gray-900 mb-2">
            Tableau de Bord Administrateur 🛡️
          </h2>
          <p className="text-sm md:text-base text-gray-600">
            Vue d'ensemble complète et contrôle de la plateforme Nexus Réussite.
          </p>
        </div>

        {/* Stats Cards */}
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6 mb-8">
          {/* User Counts Section */}
          <Card className="lg:col-span-2">
            <CardHeader>
              <CardTitle className="flex items-center text-sm md:text-base">
                <Users className="w-4 h-4 md:w-5 md:h-5 mr-2 text-blue-600" />
                Statistiques Utilisateurs
              </CardTitle>
            </CardHeader>
            <CardContent>
              <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
                <div className="text-center">
                  <div className="text-2xl md:text-3xl font-bold text-blue-600">
                    {data?.totalParents || 0}
                  </div>
                  <p className="text-xs md:text-sm text-gray-500 mt-1">Parents</p>
                </div>
                <div className="text-center">
                  <div className="text-2xl md:text-3xl font-bold text-green-600">
                    {data?.totalStudents || 0}
                  </div>
                  <p className="text-xs md:text-sm text-gray-500 mt-1">Élèves</p>
                </div>
                <div className="text-center">
                  <div className="text-2xl md:text-3xl font-bold text-purple-600">
                    {data?.totalCoaches || 0}
                  </div>
                  <p className="text-xs md:text-sm text-gray-500 mt-1">Coachs</p>
                </div>
                <div className="text-center">
                  <div className="text-2xl md:text-3xl font-bold text-orange-600">
                    {data?.totalAssistants || 0}
                  </div>
                  <p className="text-xs md:text-sm text-gray-500 mt-1">Assistantes</p>
                </div>
              </div>
              <div className="mt-4 pt-4 border-t border-gray-200">
                <div className="text-center">
                  <div className="text-lg md:text-xl font-bold text-gray-900">
                    {data?.totalUsers || 0}
                  </div>
                  <p className="text-xs md:text-sm text-gray-500">Total Utilisateurs</p>
                </div>
              </div>
            </CardContent>
          </Card>

          <Card>
            <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
              <CardTitle className="text-xs md:text-sm font-medium">Revenus Mensuels</CardTitle>
              <CreditCard className="h-4 w-4 text-green-600" />
            </CardHeader>
            <CardContent>
              <div className="text-xl md:text-2xl font-bold text-green-600">
                {data?.totalRevenue?.toLocaleString() || 0} TND
              </div>
              <p className="text-xs text-gray-500 mt-1">
                +{data?.revenueLast30Days?.toLocaleString() || 0} TND ce mois-ci
              </p>
            </CardContent>
          </Card>

          <Card>
            <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
              <CardTitle className="text-xs md:text-sm font-medium">Abonnements Actifs</CardTitle>
              <Activity className="h-4 w-4 text-purple-600" />
            </CardHeader>
            <CardContent>
              <div className="text-xl md:text-2xl font-bold text-purple-600">
                {data?.totalSubscriptions || 0}
              </div>
              <p className="text-xs text-gray-500 mt-1">
                Taux de rétention: 94%
              </p>
            </CardContent>
          </Card>
        </div>

        {/* Additional Stats Row */}
        <div className="grid grid-cols-1 md:grid-cols-3 gap-6 mb-8">
          <Card>
            <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
              <CardTitle className="text-xs md:text-sm font-medium">Sessions ce Mois</CardTitle>
              <Activity className="h-4 w-4 text-blue-600" />
            </CardHeader>
            <CardContent>
              <div className="text-xl md:text-2xl font-bold text-blue-600">
                {data?.thisMonthSessions || 0}
              </div>
              <p className="text-xs text-gray-500 mt-1">
                {data?.sessionGrowthPercent && data.sessionGrowthPercent > 0 ? '+' : ''}{data?.sessionGrowthPercent || 0}% par rapport au mois dernier
              </p>
            </CardContent>
          </Card>

          <Card>
            <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
              <CardTitle className="text-xs md:text-sm font-medium">Total Sessions</CardTitle>
              <Database className="h-4 w-4 text-indigo-600" />
            </CardHeader>
            <CardContent>
              <div className="text-xl md:text-2xl font-bold text-indigo-600">
                {data?.totalSessions || 0}
              </div>
              <p className="text-xs text-gray-500 mt-1">
                Toutes sessions confondues
              </p>
            </CardContent>
          </Card>

          <Card>
            <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
              <CardTitle className="text-xs md:text-sm font-medium">Total Abonnements</CardTitle>
              <CreditCard className="h-4 w-4 text-orange-600" />
            </CardHeader>
            <CardContent>
              <div className="text-xl md:text-2xl font-bold text-orange-600">
                {data?.totalSubscriptions || 0}
              </div>
              <p className="text-xs text-gray-500 mt-1">
                Tous abonnements confondus
              </p>
            </CardContent>
          </Card>
        </div>

        {/* Main Dashboard Grid */}
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-6 md:gap-8">
          {/* Outils d'Administration */}
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center text-sm md:text-base">
                <Settings className="w-4 h-4 md:w-5 md:h-5 mr-2 text-blue-600" />
                Outils d'Administration
              </CardTitle>
            </CardHeader>
            <CardContent>
              <div className="grid grid-cols-1 md:grid-cols-2 gap-3 md:gap-4">
                <Button variant="outline" className="w-full justify-start h-auto p-3 md:p-4" asChild>
                  <Link href="/dashboard/admin/tests">
                    <div className="flex items-center space-x-3">
                      <TestTube className="w-4 h-4 md:w-5 md:h-5 text-red-600" />
                      <div className="text-left">
                        <p className="font-medium text-sm md:text-base">Tests Système</p>
                        <p className="text-xs md:text-sm text-gray-500">Email, Paiements, APIs</p>
                      </div>
                    </div>
                  </Link>
                </Button>

                <Button variant="outline" className="w-full justify-start h-auto p-3 md:p-4" asChild>
                  <Link href="/dashboard/admin/rag-management">
                    <div className="flex items-center space-x-3">
                      <Database className="w-4 h-4 md:w-5 md:h-5 text-indigo-600" />
                      <div className="text-left">
                        <p className="font-medium text-sm md:text-base">Ingestion Docs RAG</p>
                        <p className="text-xs md:text-sm text-gray-500">Ajouter des fichiers .md à la base</p>
                      </div>
                    </div>
                  </Link>
                </Button>

                <Button variant="outline" className="w-full justify-start h-auto p-3 md:p-4" asChild>
                  <Link href="/dashboard/admin/users">
                    <div className="flex items-center space-x-3">
                      <Users className="w-4 h-4 md:w-5 md:h-5 text-blue-600" />
                      <div className="text-left">
                        <p className="font-medium text-sm md:text-base">Gestion Utilisateurs</p>
                        <p className="text-xs md:text-sm text-gray-500">CRUD complet</p>
                      </div>
                    </div>
                  </Link>
                </Button>

                <Button variant="outline" className="w-full justify-start h-auto p-3 md:p-4" asChild>
                  <Link href="/dashboard/admin/subscriptions">
                    <div className="flex items-center space-x-3">
                      <CreditCard className="w-4 h-4 md:w-5 md:h-5 text-green-600" />
                      <div className="text-left">
                        <p className="font-medium text-sm md:text-base">Abonnements Actifs</p>
                        <p className="text-xs md:text-sm text-gray-500">Gestion des abonnements</p>
                      </div>
                    </div>
                  </Link>
                </Button>

                <Button variant="outline" className="w-full justify-start h-auto p-3 md:p-4" asChild>
                  <Link href="/dashboard/admin/analytics">
                    <div className="flex items-center space-x-3">
                      <BarChart className="w-4 h-4 md:w-5 md:h-5 text-green-600" />
                      <div className="text-left">
                        <p className="font-medium text-sm md:text-base">Analytics</p>
                        <p className="text-xs md:text-sm text-gray-500">Métriques détaillées</p>
                      </div>
                    </div>
                  </Link>
                </Button>
              </div>
            </CardContent>
          </Card>

          {/* Activité Récente */}
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center text-sm md:text-base">
                <Activity className="w-4 h-4 md:w-5 md:h-5 mr-2 text-green-600" />
                Activité Récente du Système
              </CardTitle>
            </CardHeader>
            <CardContent>
              {data?.recentActivities && data.recentActivities.length > 0 ? (
                <div className="space-y-3 md:space-y-4">
                  {data.recentActivities.slice(0, 4).map((activity: any, index: number) => (
                    <div key={activity.id || index} className="flex items-start space-x-3 p-3 bg-gray-50 rounded-lg">
                      <div className="flex-shrink-0">
                        {activity.type === 'session' && <Activity className="w-4 h-4 md:w-5 md:h-5 text-blue-600" />}
                        {activity.type === 'user' && <Users className="w-4 h-4 md:w-5 md:h-5 text-green-600" />}
                        {activity.type === 'subscription' && <CreditCard className="w-4 h-4 md:w-5 md:h-5 text-purple-600" />}
                        {activity.type === 'credit' && <CreditCard className="w-4 h-4 md:w-5 md:h-5 text-orange-600" />}
                      </div>
                      <div className="flex-1 min-w-0">
                        <p className="text-xs md:text-sm font-medium text-gray-900 truncate">
                          {activity.title}
                        </p>
                        <p className="text-xs text-gray-500 truncate">
                          {activity.description}
                        </p>
                        <p className="text-xs text-gray-400">
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

                  {data.recentActivities.length > 4 && (
                    <div className="text-center pt-4">
                      <Button variant="outline" size="sm" asChild>
                        <Link href="/dashboard/admin/activities">
                          Voir toutes les activités ({data.recentActivities.length})
                        </Link>
                      </Button>
                    </div>
                  )}
                </div>
              ) : (
                <div className="text-center py-8">
                  <Activity className="w-12 h-12 text-gray-300 mx-auto mb-4" />
                  <p className="text-gray-500 text-sm md:text-base">Aucune activité récente</p>
                </div>
              )}
            </CardContent>
          </Card>
        </div>
      </main>
      <Footer />
    </div>
  );
}
