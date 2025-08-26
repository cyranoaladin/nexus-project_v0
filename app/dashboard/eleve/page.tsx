'use client';

// Force dynamic rendering to prevent static generation issues
export const dynamic = 'force-dynamic';

import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import SessionBooking from '@/components/ui/session-booking';
import {
  AlertCircle,
  BookOpen,
  Calendar,
  CreditCard,
  Loader2,
  LogOut,
  MessageCircle,
  User,
  Video,
} from 'lucide-react';
import { signOut, useSession } from 'next-auth/react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { useEffect, useState } from 'react';

interface DashboardData {
  student: any;
  credits: { balance: number };
  nextSession: any | null;
  recentSessions: any[];
  ariaStats: { totalConversations: number };
  badges: any[];
}

export default function DashboardEleve() {
  const { data: session, status } = useSession();
  const router = useRouter();
  const [dashboardData, setDashboardData] = useState<DashboardData | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [activeTab, setActiveTab] = useState<'dashboard' | 'booking'>('dashboard');

  useEffect(() => {
    if (status === 'loading') return;

    if (!session || session.user.role !== 'ELEVE') {
      router.push('/auth/signin');
      return;
    }

    const fetchDashboardData = async () => {
      try {
        setLoading(true);
        setError(null);

        const response = await fetch('/api/student/dashboard');

        if (!response.ok) {
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

  if (status === 'loading' || loading) {
    return (
      <div className="min-h-screen bg-gray-50 flex items-center justify-center">
        <div className="text-center">
          <Loader2 className="w-8 h-8 animate-spin mx-auto mb-4 text-blue-600" />
          <p className="text-gray-600">Chargement de votre espace...</p>
        </div>
      </div>
    );
  }

  if (error) {
    return (
      <div className="min-h-screen bg-gray-50 flex items-center justify-center">
        <div className="text-center">
          <AlertCircle className="w-8 h-8 mx-auto mb-4 text-red-600" />
          <p className="text-red-600 mb-4">Erreur lors du chargement</p>
          <p className="text-gray-600 text-sm">{error}</p>
          <Button onClick={() => window.location.reload()} className="mt-4">
            Réessayer
          </Button>
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
                <User className="w-8 h-8 text-blue-600" />
                <div>
                  <h1 className="font-semibold text-gray-900">
                    {session?.user.firstName} {session?.user.lastName}
                  </h1>
                  <p className="text-sm text-gray-500">Espace Élève</p>
                </div>
              </div>

              {/* Navigation Tabs */}
              <div className="flex space-x-1 bg-gray-100 p-1 rounded-lg ml-8">
                <button
                  onClick={() => setActiveTab('dashboard')}
                  className={`px-4 py-2 rounded-md text-sm font-medium transition-all ${
                    activeTab === 'dashboard'
                      ? 'bg-white text-blue-600 shadow-sm'
                      : 'text-gray-600 hover:text-gray-900'
                  }`}
                >
                  Tableau de Bord
                </button>
                <button
                  onClick={() => setActiveTab('booking')}
                  className={`px-4 py-2 rounded-md text-sm font-medium transition-all ${
                    activeTab === 'booking'
                      ? 'bg-white text-blue-600 shadow-sm'
                      : 'text-gray-600 hover:text-gray-900'
                  }`}
                >
                  Réserver Session
                </button>
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
      <main className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
        {activeTab === 'dashboard' && (
          <>
            {/* Welcome Section */}
            <div className="mb-8">
              <h2 className="text-2xl font-bold text-gray-900 mb-2">
                Bonjour {session?.user.firstName} ! 👋
              </h2>
              <p className="text-gray-600">Bienvenue dans votre espace personnel Nexus Réussite.</p>
            </div>

            {/* Stats Cards */}
            <div className="grid grid-cols-1 md:grid-cols-3 gap-6 mb-8">
              {/* Solde de Crédits */}
              <Card>
                <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                  <CardTitle className="text-sm font-medium">Solde de Crédits</CardTitle>
                  <CreditCard className="h-4 w-4 text-blue-600" />
                </CardHeader>
                <CardContent>
                  <div className="text-2xl font-bold text-blue-600">
                    {dashboardData?.credits.balance || 0} crédits
                  </div>
                  <p className="text-xs text-gray-600 mt-1">Disponibles pour vos sessions</p>
                </CardContent>
              </Card>

              {/* Prochaine Session */}
              <Card>
                <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                  <CardTitle className="text-sm font-medium">Prochaine Session</CardTitle>
                  <Calendar className="h-4 w-4 text-green-600" />
                </CardHeader>
                <CardContent>
                  {dashboardData?.nextSession ? (
                    <>
                      <div className="text-xl font-bold text-gray-900">
                        {new Date(dashboardData.nextSession.scheduledAt).toLocaleDateString(
                          'fr-FR',
                          {
                            day: '2-digit',
                            month: 'short',
                          }
                        )}
                      </div>
                      <p className="text-xs text-gray-600 mt-1">
                        {dashboardData.nextSession.subject} • {dashboardData.nextSession.duration}
                        min
                      </p>
                    </>
                  ) : (
                    <>
                      <div className="text-xl font-bold text-gray-400">Aucune</div>
                      <p className="text-xs text-gray-600 mt-1">
                        Programmez votre prochaine session
                      </p>
                    </>
                  )}
                </CardContent>
              </Card>

              {/* Badge Progress */}
              <Card>
                <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                  <CardTitle className="text-sm font-medium">Progression</CardTitle>
                  <BookOpen className="h-4 w-4 text-purple-600" />
                </CardHeader>
                <CardContent>
                  <div className="text-xl font-bold text-purple-600">
                    {dashboardData?.ariaStats?.totalConversations || 0} conversations
                  </div>
                  <p className="text-xs text-gray-600 mt-1">Avec ARIA</p>
                </CardContent>
              </Card>
            </div>

            {/* Main Dashboard Grid */}
            <div className="grid grid-cols-1 lg:grid-cols-2 gap-8">
              {/* Sessions Récentes */}
              <Card>
                <CardHeader>
                  <CardTitle className="flex items-center">
                    <Calendar className="w-5 h-5 mr-2 text-blue-600" />
                    Sessions Récentes
                  </CardTitle>
                </CardHeader>
                <CardContent>
                  {dashboardData?.recentSessions && dashboardData.recentSessions.length > 0 ? (
                    <div className="space-y-4">
                      {dashboardData.recentSessions.map((s: any) => (
                        <div
                          key={s.id}
                          className="flex items-center justify-between p-4 bg-blue-50 rounded-lg border border-blue-200"
                        >
                          <div className="flex-1">
                            <div className="flex items-center space-x-2 mb-1">
                              <h4 className="font-medium text-gray-900">{s.title || s.subject}</h4>
                            </div>
                            <p className="text-sm text-gray-600">
                              Coach: {s.coach?.user?.firstName} {s.coach?.user?.lastName}
                            </p>
                            <p className="text-sm font-medium text-blue-600">
                              {new Date(s.scheduledAt).toLocaleDateString('fr-FR')} • {s.duration}{' '}
                              min
                            </p>
                          </div>
                        </div>
                      ))}
                    </div>
                  ) : (
                    <div className="text-center py-12">
                      <p>Aucune session récente.</p>
                    </div>
                  )}
                </CardContent>
              </Card>

              {/* Badges */}
              <Card>
                <CardHeader>
                  <CardTitle className="flex items-center">
                    <BookOpen className="w-5 h-5 mr-2 text-purple-600" />
                    Mes badges
                  </CardTitle>
                </CardHeader>
                <CardContent>
                  {dashboardData?.badges && dashboardData.badges.length > 0 ? (
                    <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                      {dashboardData.badges.map((b: any) => (
                        <div key={b.id} className="p-3 border rounded-lg flex items-center gap-3">
                          <div className="w-8 h-8 flex items-center justify-center rounded-full bg-purple-100 text-purple-700">
                            {b.icon ?? '🏅'}
                          </div>
                          <div className="flex-1">
                            <p className="text-sm font-medium text-gray-900">{b.name}</p>
                            <p className="text-xs text-gray-500">{b.description}</p>
                          </div>
                          <div className="text-xs text-gray-400 whitespace-nowrap">
                            {new Date(b.earnedAt).toLocaleDateString('fr-FR')}
                          </div>
                        </div>
                      ))}
                    </div>
                  ) : (
                    <p className="text-sm text-gray-600">Aucun badge obtenu pour l’instant.</p>
                  )}
                </CardContent>
              </Card>
            </div>

            {/* Actions Rapides */}
            <Card className="mt-8">
              <CardHeader>
                <CardTitle>Actions Rapides</CardTitle>
              </CardHeader>
              <CardContent>
                <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
                  <Button
                    variant="outline"
                    className="h-auto p-4 flex flex-col items-center space-y-2"
                    onClick={() => setActiveTab('booking')}
                  >
                    <Calendar className="w-6 h-6 text-blue-600" />
                    <span>Réserver une Session</span>
                  </Button>
                  <Link href="/dashboard/eleve/sessions">
                    <Button
                      variant="outline"
                      className="w-full h-auto p-4 flex flex-col items-center space-y-2"
                    >
                      <Video className="w-6 h-6 text-purple-600" />
                      <span>Mes Sessions</span>
                    </Button>
                  </Link>
                  <Link href="/dashboard/eleve/ressources">
                    <Button
                      variant="outline"
                      className="w-full h-auto p-4 flex flex-col items-center space-y-2"
                    >
                      <BookOpen className="w-6 h-6 text-green-600" />
                      <span>Ressources Pédagogiques</span>
                    </Button>
                  </Link>
                  <Link href="/aria">
                    <Button
                      variant="outline"
                      className="w-full h-auto p-4 flex flex-col items-center space-y-2 border-pink-500 text-pink-600 hover:bg-pink-50 hover:text-pink-700"
                    >
                      <MessageCircle className="w-6 h-6" />
                      <span>Discuter avec ARIA</span>
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
              // Refresh dashboard data
              window.location.reload();
              setActiveTab('dashboard');
            }}
          />
        )}
      </main>
    </div>
  );
}
