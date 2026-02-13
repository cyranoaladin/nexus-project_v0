import { getServerSession } from 'next-auth';
import { redirect } from 'next/navigation';
import { authOptions } from '@/lib/auth';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Accordion, AccordionContent, AccordionItem, AccordionTrigger } from '@/components/ui/accordion';
import { AriaEmbeddedChat } from '@/components/ui/aria-embedded-chat';
import { StudentCalendarWrapper } from '@/components/ui/student-calendar-wrapper';
import { CreditCard, Calendar, LogOut, User, TrendingUp, TrendingDown, Award, ArrowRight } from 'lucide-react';
import Link from 'next/link';

export const dynamic = 'force-dynamic';

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
  allSessions: Array<{
    id: string;
    title: string;
    subject: string;
    status: string;
    scheduledAt: string;
    coach: {
      firstName: string;
      lastName: string;
      pseudonym: string;
    } | null;
  }>;
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
    } | null;
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

async function getDashboardData(): Promise<DashboardData> {
  const baseUrl = process.env.NEXTAUTH_URL || 'http://localhost:3000';
  
  try {
    const res = await fetch(`${baseUrl}/api/student/dashboard`, {
      cache: 'no-store',
      credentials: 'include',
    });
    
    if (!res.ok) {
      const errorText = await res.text();
      throw new Error(`Failed to fetch dashboard data: ${res.status} ${errorText}`);
    }
    
    return res.json();
  } catch (error) {
    console.error('Dashboard data fetch error:', error);
    throw error;
  }
}

function LogoutButton() {
  return (
    <form action="/api/auth/signout" method="POST">
      <Button
        type="submit"
        variant="ghost"
        className="text-neutral-300 hover:text-white"
        aria-label="Se déconnecter"
      >
        <LogOut className="w-4 h-4 mr-2" aria-hidden="true" />
        Déconnexion
      </Button>
    </form>
  );
}

export default async function StudentDashboardPage() {
  const session = await getServerSession(authOptions);
  
  if (!session || session.user.role !== 'ELEVE') {
    redirect('/auth/signin');
  }
  
  const data = await getDashboardData();
  
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
                    {data.student.firstName} {data.student.lastName}
                  </h1>
                  <p className="text-sm text-neutral-400">Espace Étudiant</p>
                </div>
              </div>
            </div>
            <LogoutButton />
          </div>
        </div>
      </header>

      {/* Main Content */}
      <main className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-4 sm:py-6 lg:py-8">
        {/* Welcome Section */}
        <div className="mb-6 sm:mb-8">
          <h2 className="text-xl sm:text-2xl font-bold text-white mb-2">
            Bonjour {data.student.firstName} !
          </h2>
          <p className="text-sm sm:text-base text-neutral-300">
            Bienvenue dans votre nouvel espace Nexus Réussite.
          </p>
        </div>

        {/* Stats Cards */}
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4 sm:gap-6 mb-6 sm:mb-8">
          {/* Solde de Crédits */}
          <Card role="region" aria-label="Solde de crédits" className="bg-surface-card border border-white/10 shadow-premium">
            <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
              <CardTitle className="text-sm font-medium text-neutral-200">Solde de Crédits</CardTitle>
              <CreditCard className="h-4 w-4 text-brand-accent" aria-hidden="true" />
            </CardHeader>
            <CardContent>
              <div className="text-xl sm:text-2xl font-bold text-brand-accent" aria-label={`${data.credits.balance} crédits disponibles`}>
                {data.credits.balance} crédits
              </div>
              <p className="text-xs text-neutral-400 mt-1">
                Disponibles pour vos sessions
              </p>
              
              {/* Transaction History Accordion */}
              {data.credits.transactions.length > 0 && (
                <Accordion type="single" collapsible className="mt-4">
                  <AccordionItem value="transactions" className="border-none">
                    <AccordionTrigger className="py-2 text-xs text-brand-accent hover:no-underline">
                      Voir l&apos;historique
                    </AccordionTrigger>
                    <AccordionContent>
                      <div className="space-y-2 max-h-48 overflow-y-auto">
                        {data.credits.transactions.map((transaction) => (
                          <div
                            key={transaction.id}
                            className="flex items-center justify-between p-2 bg-white/5 border border-white/10 rounded-md text-xs"
                          >
                            <div className="flex items-center gap-2 flex-1 min-w-0">
                              {transaction.amount > 0 ? (
                                <TrendingUp className="h-3 w-3 text-emerald-300 flex-shrink-0" aria-hidden="true" />
                              ) : (
                                <TrendingDown className="h-3 w-3 text-rose-300 flex-shrink-0" aria-hidden="true" />
                              )}
                              <div className="flex-1 min-w-0">
                                <p className="font-medium text-neutral-100 truncate">
                                  {transaction.description}
                                </p>
                                <p className="text-neutral-400">
                                  {new Date(transaction.createdAt).toLocaleDateString('fr-FR', {
                                    day: '2-digit',
                                    month: 'short',
                                    year: 'numeric'
                                  })}
                                </p>
                              </div>
                            </div>
                            <span
                              className={`font-semibold whitespace-nowrap ml-2 ${
                                transaction.amount > 0
                                  ? 'text-emerald-300'
                                  : 'text-rose-300'
                              }`}
                            >
                              {transaction.amount > 0 ? '+' : ''}{transaction.amount}
                            </span>
                          </div>
                        ))}
                      </div>
                    </AccordionContent>
                  </AccordionItem>
                </Accordion>
              )}
            </CardContent>
          </Card>

          {/* Prochaine Session */}
          <Card role="region" aria-label="Prochaine session" className="bg-surface-card border border-white/10 shadow-premium">
            <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
              <CardTitle className="text-sm font-medium text-neutral-200">Prochaine Session</CardTitle>
              <Calendar className="h-4 w-4 text-emerald-300" aria-hidden="true" />
            </CardHeader>
            <CardContent>
              {data.nextSession ? (
                <>
                  <div className="text-xl font-bold text-white">
                    {new Date(data.nextSession.scheduledAt).toLocaleDateString('fr-FR', { 
                      day: '2-digit', 
                      month: 'short' 
                    })}
                  </div>
                  <p className="text-xs text-neutral-300 mt-1">
                    {data.nextSession.subject} • {data.nextSession.duration}min
                  </p>
                  <p className="text-xs text-neutral-400 mt-1">
                    Avec {data.nextSession.coach.pseudonym}
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
          <Card role="region" aria-label="Progression et badges" className="bg-surface-card border border-white/10 shadow-premium">
            <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
              <CardTitle className="text-sm font-medium text-neutral-200">Progression</CardTitle>
              <Award className="h-4 w-4 text-purple-300" aria-hidden="true" />
            </CardHeader>
            <CardContent>
              <div className="text-xl font-bold text-purple-200">
                {data.badges.length} {data.badges.length > 1 ? 'badges' : 'badge'}
              </div>
              <p className="text-xs text-neutral-400 mt-1">
                {data.badges.length > 0 ? 'Obtenus au total' : 'Commencez à gagner des badges'}
              </p>
            </CardContent>
          </Card>
        </div>

        {/* Main Dashboard Grid - 60% Left / 40% Right */}
        <div className="grid grid-cols-1 lg:grid-cols-5 gap-4 sm:gap-6 lg:gap-8">
          {/* Left Column - 60% (3/5) */}
          <div className="lg:col-span-3 space-y-4 sm:space-y-6 lg:space-y-8">
            {/* ARIA Chat Component */}
            <div className="h-[500px] sm:h-[600px]">
              <AriaEmbeddedChat studentId={data.student.id} />
            </div>
          </div>

          {/* Right Column - 40% (2/5) */}
          <div className="lg:col-span-2 space-y-4 sm:space-y-6 lg:space-y-8">
            {/* Session Calendar */}
            <StudentCalendarWrapper
              sessions={data.allSessions}
              studentId={data.student.id}
              userCredits={data.credits.balance}
            />

            {/* Recent Sessions */}
            <Card role="region" aria-label="Sessions récentes" className="bg-surface-card border border-white/10 shadow-premium">
              <CardHeader>
                <CardTitle className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-2">
                  <div className="flex items-center">
                    <Calendar className="w-5 h-5 mr-2 text-brand-accent" aria-hidden="true" />
                    Sessions Récentes
                  </div>
                  <Link 
                    href="/dashboard/eleve/mes-sessions"
                    className="text-xs text-brand-accent hover:text-brand-accent/80 font-medium flex items-center"
                    aria-label="Voir toutes les sessions"
                  >
                    Voir tout
                    <ArrowRight className="w-3 h-3 ml-1" aria-hidden="true" />
                  </Link>
                </CardTitle>
              </CardHeader>
              <CardContent>
                {data.recentSessions && data.recentSessions.length > 0 ? (
                  <div className="space-y-3">
                    {data.recentSessions.slice(0, 5).map((session) => (
                      <Link
                        key={session.id}
                        href="/dashboard/eleve/mes-sessions"
                        className="block p-3 bg-white/5 rounded-lg border border-white/10 hover:border-brand-accent/50 hover:bg-white/10 transition-colors focus:outline-none focus:ring-2 focus:ring-brand-accent focus:ring-offset-2 focus:ring-offset-surface-darker"
                        aria-label={`Session ${session.title} - ${session.subject}`}
                      >
                        <div className="flex flex-col sm:flex-row items-start justify-between gap-2">
                          <div className="flex-1 min-w-0 w-full sm:w-auto">
                            <h4 className="font-medium text-white text-sm truncate">
                              {session.title}
                            </h4>
                            <p className="text-xs text-neutral-300 mt-0.5">{session.subject}</p>
                            <div className="flex items-center gap-2 mt-1">
                              <p className="text-xs text-neutral-400">
                                {new Date(session.scheduledAt).toLocaleDateString('fr-FR', {
                                  day: '2-digit',
                                  month: 'short',
                                  year: 'numeric'
                                })}
                              </p>
                              {session.coach && (
                                <p className="text-xs text-neutral-400">
                                  • {session.coach.pseudonym}
                                </p>
                              )}
                            </div>
                          </div>
                          <span className={`px-2 py-1 text-xs rounded-full whitespace-nowrap ml-2 flex-shrink-0 ${
                            session.status === 'COMPLETED' 
                              ? 'bg-emerald-500/15 text-emerald-200 border border-emerald-500/20' 
                              : session.status === 'SCHEDULED'
                              ? 'bg-blue-500/15 text-blue-200 border border-blue-500/20'
                              : session.status === 'CANCELLED'
                              ? 'bg-rose-500/15 text-rose-200 border border-rose-500/20'
                              : session.status === 'IN_PROGRESS'
                              ? 'bg-purple-500/15 text-purple-200 border border-purple-500/20'
                              : 'bg-amber-500/15 text-amber-200 border border-amber-500/20'
                          }`}>
                            {session.status === 'COMPLETED' ? 'Terminée' :
                             session.status === 'SCHEDULED' ? 'Programmée' :
                             session.status === 'CANCELLED' ? 'Annulée' :
                             session.status === 'IN_PROGRESS' ? 'En cours' :
                             session.status}
                          </span>
                        </div>
                      </Link>
                    ))}
                  </div>
                ) : (
                  <div className="text-center py-8">
                    <Calendar className="w-12 h-12 text-neutral-500 mx-auto mb-3" aria-hidden="true" />
                    <p className="text-sm text-neutral-400 mb-3">
                      Aucune session récente
                    </p>
                    <Link href="/dashboard/eleve/sessions">
                      <Button className="btn-outline" size="sm" aria-label="Réserver une session">
                        Réserver une session
                      </Button>
                    </Link>
                  </div>
                )}
              </CardContent>
            </Card>
          </div>
        </div>
      </main>
    </div>
  );
}
