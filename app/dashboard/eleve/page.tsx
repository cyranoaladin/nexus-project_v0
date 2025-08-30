'use client';

// Force dynamic rendering to prevent static generation issues
export const dynamic = 'force-dynamic';

import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import SessionBooking from '@/components/ui/session-booking';
import { BadgeWidget } from '@/components/ui/badge-widget';
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
  CheckCircle,
} from 'lucide-react';
import { signOut, useSession } from 'next-auth/react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { toast } from 'sonner';

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
  const [activeTab, setActiveTab] = useState<'dashboard' | 'booking' | 'documents'>('dashboard');
  const [documents, setDocuments] = useState<
    Array<{ id: string; title: string; url: string; subject: string; createdAt: string }>
  >([]);
  const [badgeFilter, setBadgeFilter] = useState<string>('ALL');
  // Local fallback when badges are not provided by dashboard API (e.g., E2E mode)
  const [fallbackBadges, setFallbackBadges] = useState<any[] | null>(null);
  const [badgeCountsLoading, setBadgeCountsLoading] = useState<boolean>(false);
  const [documentsLoading, setDocumentsLoading] = useState<boolean>(false);
  const [dashboardUpdatedAt, setDashboardUpdatedAt] = useState<Date | null>(null);
  const [badgesCountsUpdatedAt, setBadgesCountsUpdatedAt] = useState<Date | null>(null);
  const [documentsUpdatedAt, setDocumentsUpdatedAt] = useState<Date | null>(null);
  const [refreshingSections, setRefreshingSections] = useState<Set<string>>(new Set());
  const lastClickRef = useRef<Record<string, number>>({});
  const canTrigger = useCallback((key: string, ms: number = 600) => {
    const now = Date.now();
    const last = lastClickRef.current[key] || 0;
    if (now - last < ms) return false;
    lastClickRef.current[key] = now;
    return true;
  }, []);

  const canonicalBadgeCategory = (c: string) => {
    const up = String(c || '').toUpperCase();
    if (up === 'CURIOSITE') return 'ARIA';
    return up;
  };

  const badgeCounts = useMemo(() => {
    const acc = { ALL: 0, ASSIDUITE: 0, PROGRESSION: 0, ARIA: 0 } as any;
    const source = (dashboardData?.badges !== undefined)
      ? ((dashboardData?.badges || []) as any[])
      : ((fallbackBadges || []) as any[]);
    for (const b of source) {
      acc.ALL += 1;
      acc[canonicalBadgeCategory(b.category || b?.badge?.category || 'ASSIDUITE')] += 1;
    }
    return acc as { ALL: number; ASSIDUITE: number; PROGRESSION: number; ARIA: number };
  }, [dashboardData?.badges, fallbackBadges]);

  const badgeLabels = useMemo(() => ({
    ALL: badgeCountsLoading ? `Toutes les catégories (\u2026)` : `Toutes les catégories (${badgeCounts.ALL})`,
    ASSIDUITE: badgeCountsLoading ? `Assiduité (\u2026)` : `Assiduité (${badgeCounts.ASSIDUITE})`,
    PROGRESSION: badgeCountsLoading ? `Progression (\u2026)` : `Progression (${badgeCounts.PROGRESSION})`,
    ARIA: badgeCountsLoading ? `Curiosité (\u2026)` : `Curiosité (${badgeCounts.ARIA})`,
  }), [badgeCounts, badgeCountsLoading]);

  useEffect(() => {
    if (status === 'loading') return;

    // E2E: ne pas rediriger, afficher le tableau et raccourcir les appels
    const E2E = process.env.NEXT_PUBLIC_E2E === '1' || process.env.E2E === '1' || process.env.E2E_RUN === '1';
    if (E2E) {
      setLoading(false);
      return;
    }

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
        const now = new Date();
        setDashboardUpdatedAt(now);
        // Badges are included in dashboard payload; counts reflect same freshness
        setBadgesCountsUpdatedAt(now);
      } catch (err) {
        console.error('Error fetching dashboard data:', err);
        setError(err instanceof Error ? err.message : 'An error occurred');
      } finally {
        setLoading(false);
      }
    };

    fetchDashboardData();

    // Charger documents générés
    const fetchDocs = async () => {
      try {
        setDocumentsLoading(true);
        const res = await fetch('/api/student/documents');
        if (res.ok) {
          const data = await res.json();
          setDocuments(data.documents || []);
          setDocumentsUpdatedAt(new Date());
        }
      } catch {}
      finally {
        setDocumentsLoading(false);
      }
    };
    fetchDocs();
  }, [session, status, router]);

  const refreshDashboard = useCallback(async (sectionKeys: string[]) => {
    setRefreshingSections((prev) => {
      const next = new Set(prev);
      sectionKeys.forEach((k) => next.add(k));
      return next;
    });
    try {
      const response = await fetch('/api/student/dashboard');
      if (!response.ok) return;
      const data = await response.json();
      setDashboardData(data);
      const now = new Date();
      setDashboardUpdatedAt(now);
      setBadgesCountsUpdatedAt(now);
      const labels: Record<string, string> = {
        credits: 'Crédits mis à jour',
        nextSession: 'Prochaine session mise à jour',
        progression: 'Progression mise à jour',
        recentSessions: 'Sessions récentes mises à jour',
      };
      const opts = { duration: 1200, icon: <CheckCircle className="w-4 h-4 text-green-600" /> } as any;
      if (sectionKeys.length === 1) {
        toast.success(labels[sectionKeys[0]] || 'Tableau de bord mis à jour', opts);
      } else {
        toast.success('Tableau de bord mis à jour', opts);
      }
    } catch (e) {
      toast.error('Échec de l’actualisation', { description: 'Réessayez dans un instant.', duration: 2500, icon: <AlertCircle className="w-4 h-4 text-red-600" /> });
    }
    finally {
      setRefreshingSections((prev) => {
        const next = new Set(prev);
        sectionKeys.forEach((k) => next.delete(k));
        return next;
      });
    }
  }, []);

  const refreshDocuments = useCallback(async () => {
    setDocumentsLoading(true);
    try {
      const res = await fetch('/api/student/documents');
      if (!res.ok) return;
      const data = await res.json();
      setDocuments(data.documents || []);
      setDocumentsUpdatedAt(new Date());
      toast.success('Documents mis à jour', { duration: 1200, icon: <CheckCircle className="w-4 h-4 text-green-600" /> });
    } catch (e) {
      toast.error('Échec de l’actualisation des documents', { description: 'Réessayez dans un instant.', duration: 2500, icon: <AlertCircle className="w-4 h-4 text-red-600" /> });
    }
    finally {
      setDocumentsLoading(false);
    }
  }, []);

  const refreshBadgesCounts = useCallback(async () => {
    setRefreshingSections((prev) => {
      const next = new Set(prev);
      next.add('badgesCounts');
      return next;
    });
    setBadgeCountsLoading(true);
    try {
      const res = await fetch(`/api/students/${session!.user.id}/badges`);
      if (!res.ok) return;
      const data = await res.json();
      const arr = Array.isArray(data) ? data : data?.badges || [];
      setFallbackBadges(arr);
      setBadgesCountsUpdatedAt(new Date());
      toast.success('Badges mis à jour', { duration: 1200, icon: <CheckCircle className="w-4 h-4 text-green-600" /> });
    } catch (e) {
      toast.error('Échec de l’actualisation des badges', { description: 'Réessayez dans un instant.', duration: 2500, icon: <AlertCircle className="w-4 h-4 text-red-600" /> });
    }
    finally {
      setBadgeCountsLoading(false);
      setRefreshingSections((prev) => {
        const next = new Set(prev);
        next.delete('badgesCounts');
        return next;
      });
    }
  }, [session?.user?.id]);

  const isRefreshing = useCallback((key: string) => refreshingSections.has(key), [refreshingSections]);

  // Fallback fetch for badges when dashboard API is bypassed (e.g., E2E) or does not include badges
  useEffect(() => {
    // If we already have badges from dashboardData, no need to fallback
    const badgesProvided = dashboardData?.badges !== undefined;
    const canFetch = !loading && !!session?.user?.id;

    if (!canFetch || badgesProvided) return;

    let cancelled = false;
    setBadgeCountsLoading(true);
    (async () => {
      try {
        const res = await fetch(`/api/students/${session!.user.id}/badges`);
        if (!res.ok) return;
        const data = await res.json();
        const arr = Array.isArray(data) ? data : data?.badges || [];
        if (!cancelled) {
          setFallbackBadges(arr);
          setBadgesCountsUpdatedAt(new Date());
        }
      } catch {
        // ignore
      } finally {
        if (!cancelled) setBadgeCountsLoading(false);
      }
    })();

    return () => {
      cancelled = true;
    };
  }, [dashboardData?.badges, loading, session?.user?.id]);

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

  const softLoading = !dashboardData && status !== 'loading' && !loading;

  const updatedLabel = (d: Date | null) =>
    d ? `Dernière mise à jour le ${d.toLocaleDateString('fr-FR')} à ${d.toLocaleTimeString('fr-FR', { hour: '2-digit', minute: '2-digit' })}` : '';

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
                <button
                  onClick={() => setActiveTab('documents')}
                  className={`px-4 py-2 rounded-md text-sm font-medium transition-all ${
                    activeTab === 'documents'
                      ? 'bg-white text-blue-600 shadow-sm'
                      : 'text-gray-600 hover:text-gray-900'
                  }`}
                >
                  Mes documents
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
                  <div className="flex items-center gap-2">
                    <CreditCard className="h-4 w-4 text-blue-600" />
                    {(softLoading || isRefreshing('credits')) && <Loader2 aria-hidden className="w-4 h-4 animate-spin text-gray-400" />}
                    {!softLoading && dashboardUpdatedAt && (
                      <span
                        className="text-[10px] md:text-xs text-gray-400"
                        title={updatedLabel(dashboardUpdatedAt)}
                      >
                        MAJ {dashboardUpdatedAt.toLocaleTimeString('fr-FR', { hour: '2-digit', minute: '2-digit' })}
                      </span>
                    )}
                    <Button
                      variant="ghost"
                      size="sm"
                      disabled={isRefreshing('credits')}
                      onClick={() => { if (!canTrigger('credits')) return; refreshDashboard(['credits']); }}
                      className="text-[10px] md:text-xs"
                    >
                      Actualiser
                    </Button>
                  </div>
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
                  <div className="flex items-center gap-2">
                    <Calendar className="h-4 w-4 text-green-600" />
                    {(softLoading || isRefreshing('nextSession')) && <Loader2 aria-hidden className="w-4 h-4 animate-spin text-gray-400" />}
                    {!softLoading && dashboardUpdatedAt && (
                      <span
                        className="text-[10px] md:text-xs text-gray-400"
                        title={updatedLabel(dashboardUpdatedAt)}
                      >
                        MAJ {dashboardUpdatedAt.toLocaleTimeString('fr-FR', { hour: '2-digit', minute: '2-digit' })}
                      </span>
                    )}
                    <Button
                      variant="ghost"
                      size="sm"
                      disabled={isRefreshing('nextSession')}
                      onClick={() => { if (!canTrigger('nextSession')) return; refreshDashboard(['nextSession']); }}
                      className="text-[10px] md:text-xs"
                    >
                      Actualiser
                    </Button>
                  </div>
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
                  <div className="flex items-center gap-2">
                    <BookOpen className="h-4 w-4 text-purple-600" />
                    {(softLoading || isRefreshing('progression')) && <Loader2 aria-hidden className="w-4 h-4 animate-spin text-gray-400" />}
                    {!softLoading && dashboardUpdatedAt && (
                      <span
                        className="text-[10px] md:text-xs text-gray-400"
                        title={updatedLabel(dashboardUpdatedAt)}
                      >
                        MAJ {dashboardUpdatedAt.toLocaleTimeString('fr-FR', { hour: '2-digit', minute: '2-digit' })}
                      </span>
                    )}
                    <Button
                      variant="ghost"
                      size="sm"
                      disabled={isRefreshing('progression')}
                      onClick={() => { if (!canTrigger('progression')) return; refreshDashboard(['progression']); }}
                      className="text-[10px] md:text-xs"
                    >
                      Actualiser
                    </Button>
                  </div>
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
                    {(softLoading || isRefreshing('recentSessions')) && <Loader2 aria-hidden className="ml-2 w-4 h-4 animate-spin text-gray-400" />}
                    {!softLoading && dashboardUpdatedAt && (
                      <span
                        className="ml-2 text-[10px] md:text-xs text-gray-400"
                        title={updatedLabel(dashboardUpdatedAt)}
                      >
                        MAJ {dashboardUpdatedAt.toLocaleTimeString('fr-FR', { hour: '2-digit', minute: '2-digit' })}
                      </span>
                    )}
                    <Button
                      variant="ghost"
                      size="sm"
                      disabled={isRefreshing('recentSessions')}
                      onClick={() => { if (!canTrigger('recentSessions')) return; refreshDashboard(['recentSessions']); }}
                      className="ml-2 text-[10px] md:text-xs"
                    >
                      Actualiser
                    </Button>
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

              {/* Badges with small filter */}
              <div>
                <div className="flex items-center justify-end mb-2">
                  <label className="sr-only" htmlFor="dashboard-badge-filter">Filtrer les badges</label>
                  <select
                    id="dashboard-badge-filter"
                    value={badgeFilter}
                    onChange={(e) => setBadgeFilter(e.target.value)}
                    disabled={badgeCountsLoading}
                    className={`border border-gray-300 rounded-md px-2 py-1 text-xs focus:outline-none focus:ring-2 focus:ring-blue-500 ${badgeCountsLoading ? 'opacity-60 cursor-not-allowed' : ''}`}
                  >
                    <option value="ALL">{badgeLabels.ALL}</option>
                    <option value="ASSIDUITE">{badgeLabels.ASSIDUITE}</option>
                    <option value="PROGRESSION">{badgeLabels.PROGRESSION}</option>
                    <option value="ARIA">{badgeLabels.ARIA}</option>
                  </select>
                  {(badgeCountsLoading || isRefreshing('badgesCounts')) && (
                    <Loader2
                      aria-hidden
                      className="ml-2 w-4 h-4 animate-spin text-gray-400"
                    />
                  )}
                  {!badgeCountsLoading && !isRefreshing('badgesCounts') && badgesCountsUpdatedAt && (
                    <span
                      className="ml-2 text-[10px] md:text-xs text-gray-400"
                      title={updatedLabel(badgesCountsUpdatedAt)}
                    >
                      MAJ {badgesCountsUpdatedAt.toLocaleTimeString('fr-FR', { hour: '2-digit', minute: '2-digit' })}
                    </span>
                  )}
                  <Button
                    variant="ghost"
                    size="sm"
                    disabled={badgeCountsLoading || isRefreshing('badgesCounts')}
                    onClick={() => { if (!canTrigger('badgesCounts')) return; refreshBadgesCounts(); }}
                    className="ml-2 text-[10px] md:text-xs"
                  >
                    Actualiser
                  </Button>
                </div>
                <BadgeWidget studentId={session!.user.id} filterCategory={badgeFilter} initialBadges={dashboardData?.badges || []} />
              </div>
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
                  <Link href="/dashboard/eleve/bilan/start">
                    <Button
                      variant="outline"
                      className="w-full h-auto p-4 flex flex-col items-center space-y-2 border-sky-500 text-sky-700 hover:bg-sky-50 hover:text-sky-800"
                    >
                      <MessageCircle className="w-6 h-6" />
                      <span>Bilan gratuit</span>
                    </Button>
                  </Link>
                </div>
              </CardContent>
            </Card>
          </>
        )}

        {activeTab === 'documents' && (
          <div>
            <h2 className="text-xl font-semibold mb-4 flex items-center">
              Mes documents
              {documentsLoading && <Loader2 aria-hidden className="ml-2 w-4 h-4 animate-spin text-gray-400" />}
              {!documentsLoading && documentsUpdatedAt && (
                <span
                  className="ml-2 text-sm text-gray-400"
                  title={updatedLabel(documentsUpdatedAt)}
                >
                  MAJ {documentsUpdatedAt.toLocaleTimeString('fr-FR', { hour: '2-digit', minute: '2-digit' })}
                </span>
              )}
              <Button
                variant="ghost"
                size="sm"
                disabled={documentsLoading}
                onClick={refreshDocuments}
                className="ml-2 text-[10px] md:text-xs"
              >
                Actualiser
              </Button>
            </h2>
            {documents.length === 0 ? (
              <p className="text-gray-600">Aucun document généré pour le moment.</p>
            ) : (
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                {documents.map((d) => (
                  <div key={d.id} className="border rounded-md p-3 bg-white">
                    <div className="text-sm text-gray-500">
                      {new Date(d.createdAt).toLocaleString('fr-FR')}
                    </div>
                    <h3 className="font-medium mt-1">{d.title}</h3>
                    {/* @ts-ignore */}
                    {/** d.description peut ne pas être présent si ancien enregistrement **/}
{/* eslint-disable-next-line */}
                    {/* @ts-ignore */}
                    {d.description ? (
                      <p className="text-sm text-gray-600 mt-1">{(d as any).description}</p>
                    ) : null}
                    <div className="text-xs text-gray-500 mt-1">{d.subject}</div>
                    <div className="mt-2">
                      <a
                        href={d.url}
                        target="_blank"
                        rel="noreferrer"
                        className="text-blue-600 underline"
                        download
                      >
                        Télécharger
                      </a>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>
        )}

        {activeTab === 'booking' && (
          <SessionBooking
            studentId={session!.user.id}
            userCredits={dashboardData?.credits?.balance ?? 0}
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
