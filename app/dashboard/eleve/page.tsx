"use client";

// Force dynamic rendering to prevent static generation issues
export const dynamic = 'force-dynamic';

import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import SessionBooking from "@/components/ui/session-booking";
import { AlertCircle, BookOpen, Calendar, CreditCard, FileText, Loader2, LogOut, MessageCircle, User, Video } from "lucide-react";
import { signOut, useSession } from "next-auth/react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { useEffect, useMemo, useState } from "react";

interface DashboardData {
  student: any;
  credits: { balance: number; };
  nextSession: any | null;
  recentSessions: any[];
  ariaStats: { totalConversations: number; };
}

export default function DashboardEleve() {
  const { data: session, status } = useSession();
  const router = useRouter();
  const [dashboardData, setDashboardData] = useState<DashboardData | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [activeTab, setActiveTab] = useState<'dashboard' | 'booking'>('dashboard');
  const [bilans, setBilans] = useState<{ id: string; createdAt: string; niveau?: string | null; }[]>([]);
  const [matiereFilter, setMatiereFilter] = useState<'Toutes' | 'Mathématiques' | 'NSI'>('Toutes');

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

  useEffect(() => {
    if (!session?.user?.studentId) return;
    (async () => {
      try {
        const res = await fetch(`/api/students/${session.user.studentId}/bilans`, { cache: 'no-store' });
        if (res.ok) setBilans(await res.json());
      } catch {}
    })();
  }, [session?.user?.studentId]);

  if (status === "loading" || loading) {
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
          <Button
            onClick={() => window.location.reload()}
            className="mt-4"
          >
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
                  <h1 className="font-semibold text-gray-900" data-testid="student-courses-title">
                    {session?.user.firstName} {session?.user.lastName}
                  </h1>
                  <p className="text-sm text-gray-500">Espace Élève</p>
                </div>
              </div>

              {/* Navigation Tabs */}
              <div className="flex space-x-1 bg-gray-100 p-1 rounded-lg ml-8">
                <button
                  onClick={() => setActiveTab('dashboard')}
                  className={`px-4 py-2 rounded-md text-sm font-medium transition-all ${activeTab === 'dashboard'
                    ? 'bg-white text-blue-600 shadow-sm'
                    : 'text-gray-600 hover:text-gray-900'
                    }`}
                >
                  Tableau de Bord
                </button>
                <button
                  onClick={() => setActiveTab('booking')}
                  className={`px-4 py-2 rounded-md text-sm font-medium transition-all ${activeTab === 'booking'
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
              data-testid="logout-button"
            >
              <LogOut className="w-4 h-4 mr-2" />
              Déconnexion
            </Button>
          </div>
        </div>
      </header>

      {/* Main Content */}
      <main role="main" className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
        {activeTab === 'dashboard' && (
          <>
            {/* Welcome Section */}
            <div className="mb-8">
              <h2 className="text-2xl font-bold text-gray-900 mb-2">
                Bonjour {session?.user.firstName} ! 👋
              </h2>
              <p className="text-gray-600">
                Bienvenue dans votre espace personnel Nexus Réussite.
              </p>
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
                  <p className="text-xs text-gray-600 mt-1">
                    Disponibles pour vos sessions
                  </p>
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
                        {new Date(dashboardData.nextSession.scheduledAt).toLocaleDateString('fr-FR', {
                          day: '2-digit',
                          month: 'short'
                        })}
                      </div>
                      <p className="text-xs text-gray-600 mt-1">
                        {dashboardData.nextSession.subject} • {dashboardData.nextSession.duration}min
                      </p>
                    </>
                  ) : (
                    <>
                      <div className="text-xl font-bold text-gray-400">
                        Aucune
                      </div>
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
                  <p className="text-xs text-gray-600 mt-1">
                    Avec ARIA
                  </p>
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
                      {dashboardData.recentSessions.map((session) => (
                        <div key={session.id}>{/* Affichage session */}</div>
                      ))}
                    </div>
                  ) : (
                    <div className="text-center py-12">
                      <p>Aucune session récente.</p>
                    </div>
                  )}
                </CardContent>
              </Card>

              {/* Mes Bilans */}
              <Card className="mb-8">
                <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                  <CardTitle className="text-sm font-medium">Mes Bilans</CardTitle>
                  <FileText className="h-4 w-4 text-blue-600" />
                </CardHeader>
                <CardContent>
                  {/* Filtres */}
                  <div className="flex items-center justify-between mb-3">
                    <div className="text-xs text-gray-500">Filtrer par matière</div>
                    <div className="w-44">
                      <Select value={matiereFilter} onValueChange={(v: any) => setMatiereFilter(v)}>
                        <SelectTrigger className="h-8 text-sm">
                          <SelectValue placeholder="Matière" />
                        </SelectTrigger>
                        <SelectContent>
                          <SelectItem value="Toutes">Toutes</SelectItem>
                          <SelectItem value="Mathématiques">Mathématiques</SelectItem>
                          <SelectItem value="NSI">NSI</SelectItem>
                        </SelectContent>
                      </Select>
                    </div>
                  </div>
                  {bilans.length === 0 ? (
                    <div className="space-y-3">
                      <p className="text-sm text-gray-600" data-testid="no-bilans-fallback">Aucun bilan pour le moment.</p>
                      <Link href="/bilan-gratuit/wizard">
                        <Button size="sm" className="mt-1">Commencer mon Bilan</Button>
                      </Link>
                    </div>
                  ) : (
                    <BilanList bilans={bilans} matiereFilter={matiereFilter} />
                  )}
                </CardContent>
              </Card>

              {/* Badges et Achievements */}
              <Card>
                <CardHeader>
                  <CardTitle className="flex items-center">
                    <BookOpen className="w-5 h-5 mr-2 text-purple-600" />
                    Mes Badges
                  </CardTitle>
                </CardHeader>
                <CardContent>
                  <p className="text-sm text-muted-foreground">La section des badges est en cours de développement.</p>
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
                    <Button variant="outline" className="w-full h-auto p-4 flex flex-col items-center space-y-2">
                      <Video className="w-6 h-6 text-purple-600" />
                      <span>Mes Sessions</span>
                    </Button>
                  </Link>
                  <Link href="/dashboard/eleve/ressources">
                    <Button variant="outline" className="w-full h-auto p-4 flex flex-col items-center space-y-2">
                      <BookOpen className="w-6 h-6 text-green-600" />
                      <span>Ressources Pédagogiques</span>
                    </Button>
                  </Link>
                  <Link href="/aria">
                    <Button variant="outline" className="w-full h-auto p-4 flex flex-col items-center space-y-2 border-pink-500 text-pink-600 hover:bg-pink-50 hover:text-pink-700">
                      <MessageCircle className="w-6 h-6" />
                      <span>Discuter avec ARIA</span>
                    </Button>
                  </Link>
                  <Link href="/bilan-gratuit/wizard">
                    <Button className="w-full h-auto p-4 flex flex-col items-center space-y-2">
                      <FileText className="w-6 h-6 text-blue-600" />
                      <span>Commencer un Bilan</span>
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

// Helpers and small components in the same file for simplicity
function normalizeNiveau(n?: string | null): 'Première' | 'Terminale' | '—' {
  if (!n) return '—';
  const s = n.toLowerCase();
  if (s.includes('premiere') || s.includes('première')) return 'Première';
  if (s.includes('terminale')) return 'Terminale';
  return (n as any) as 'Première' | 'Terminale' | '—';
}

function BilanList({ bilans, matiereFilter }: { bilans: { id: string; createdAt: string; niveau?: string | null; subject?: string | null; percent?: number | null; }[]; matiereFilter: 'Toutes' | 'Mathématiques' | 'NSI'; }) {
  const latestTerminale = useMemo(() => bilans.find(b => normalizeNiveau(b.niveau) === 'Terminale'), [bilans]);
  const filtered = useMemo(() => bilans.filter(b => {
    if (matiereFilter === 'Toutes') return true;
    const subj = (b.subject || '').toUpperCase();
    if (matiereFilter === 'Mathématiques') return subj === 'MATHEMATIQUES';
    if (matiereFilter === 'NSI') return subj === 'NSI';
    return true;
  }), [bilans, matiereFilter]);

  const byDateDesc = (arr: typeof bilans) => [...arr].sort((a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime());

  if (filtered.length === 0) {
    return <p className="text-sm text-gray-600">Aucun bilan pour ce filtre.</p>;
  }

  if (matiereFilter === 'Toutes') {
    const terminale = byDateDesc(filtered.filter(b => normalizeNiveau(b.niveau) === 'Terminale'));
    const premiere = byDateDesc(filtered.filter(b => normalizeNiveau(b.niveau) === 'Première'));
    const autres = byDateDesc(filtered.filter(b => ['Première', 'Terminale'].indexOf(normalizeNiveau(b.niveau)) === -1));

    const renderList = (list: typeof bilans) => (
      <ul className="text-sm space-y-2">
        {list.map((b) => {
          const niv = normalizeNiveau(b.niveau);
          const isLatestTerm = latestTerminale && latestTerminale.id === b.id;
          const pct = (b as any).percent as number | null | undefined;
          return (
            <li key={b.id} className="flex items-center justify-between border-b last:border-b-0 py-2">
              <span className="flex items-center gap-2">
                <span>{new Date(b.createdAt).toLocaleDateString('fr-FR')}</span>
                {niv !== '—' && (
                  <Badge variant="outline" className={niv === 'Terminale' ? 'border-emerald-300 text-emerald-700' : 'border-blue-300 text-blue-700'}>
                    {niv}
                  </Badge>
                )}
                {typeof pct === 'number' && (
                  <Badge variant="outline" className="border-gray-300 text-gray-700">{pct}%</Badge>
                )}
                {isLatestTerm && (
                  <Badge className="bg-emerald-100 text-emerald-800 border border-emerald-200">Nouveau Terminale</Badge>
                )}
              </span>
              <span className="flex items-center gap-2">
                <a data-testid="bilan-pdf-link" className="text-blue-600 hover:underline" href={`/api/bilan/pdf/${b.id}`} target="_blank" rel="noreferrer">PDF Standard</a>
                <a data-testid="bilan-pdf-link" className="text-blue-600 hover:underline" href={`/api/bilan/pdf/${b.id}?variant=eleve`} target="_blank" rel="noreferrer">PDF Élève</a>
                <a data-testid="bilan-pdf-link" className="text-blue-600 hover:underline" href={`/api/bilan/pdf/${b.id}?variant=parent`} target="_blank" rel="noreferrer">PDF Parent</a>
              </span>
            </li>
          );
        })}
      </ul>
    );

    return (
      <div className="space-y-4">
        {terminale.length > 0 && (
          <div>
            <div className="text-xs font-semibold text-gray-500 mb-1">Terminale</div>
            {renderList(terminale as any)}
          </div>
        )}
        {premiere.length > 0 && (
          <div>
            <div className="text-xs font-semibold text-gray-500 mb-1">Première</div>
            {renderList(premiere as any)}
          </div>
        )}
        {autres.length > 0 && (
          <div>
            <div className="text-xs font-semibold text-gray-500 mb-1">Autres</div>
            {renderList(autres as any)}
          </div>
        )}
      </div>
    );
  }

  const sorted = byDateDesc(filtered);

  return (
    <ul className="text-sm space-y-2">
      {sorted.map((b) => {
        const niv = normalizeNiveau(b.niveau);
        const isLatestTerm = latestTerminale && latestTerminale.id === b.id;
        const pct = (b as any).percent as number | null | undefined;
        return (
          <li key={b.id} className="flex items-center justify-between border-b last:border-b-0 py-2">
            <span className="flex items-center gap-2">
              <span>{new Date(b.createdAt).toLocaleDateString('fr-FR')}</span>
              {niv !== '—' && (
                <Badge variant="outline" className={niv === 'Terminale' ? 'border-emerald-300 text-emerald-700' : 'border-blue-300 text-blue-700'}>
                  {niv}
                </Badge>
              )}
              {typeof pct === 'number' && (
                <Badge variant="outline" className="border-gray-300 text-gray-700">{pct}%</Badge>
              )}
              {isLatestTerm && (
                <Badge className="bg-emerald-100 text-emerald-800 border border-emerald-200">Nouveau Terminale</Badge>
              )}
            </span>
            <span className="flex items-center gap-2">
              <a className="text-blue-600 hover:underline" href={`/api/bilan/pdf/${b.id}`} target="_blank" rel="noreferrer">PDF Standard</a>
              <a className="text-blue-600 hover:underline" href={`/api/bilan/pdf/${b.id}?variant=eleve`} target="_blank" rel="noreferrer">PDF Élève</a>
              <a className="text-blue-600 hover:underline" href={`/api/bilan/pdf/${b.id}?variant=parent`} target="_blank" rel="noreferrer">PDF Parent</a>
            </span>
          </li>
        );
      })}
    </ul>
  );
}
