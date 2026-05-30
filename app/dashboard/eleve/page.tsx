"use client";

// BadgeWidget reserved for gamification phase
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Tabs, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { BookOpen, Calendar, HardDrive, Loader2, LogOut, MessageSquare, Sparkles, User, Video, AlertCircle, ArrowRight, Calculator, Zap } from "lucide-react";
import { signOut, useSession } from "next-auth/react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { useEffect, useState } from "react";
import SessionBooking from "@/components/ui/session-booking";
import { AriaWidget } from "@/components/ui/aria-widget";
import { DashboardPilotage } from "@/components/dashboard/DashboardPilotage";
import {
  EleveAria,
  EleveBilans,
  EleveCockpit,
  EleveHubRessources,
  EleveResources,
  EleveSessions,
  EleveStages,
  TrackContentEDS,
  TrackContentSTMG,
  buildAriaSubjectLinks,
  shouldShowEdsParcours,
  shouldShowStmgLivret,
  type EleveDashboardData,
} from "@/components/dashboard/eleve";
import { AutomatismesDashboardCard } from "@/components/automatismes/AutomatismesDashboardCard";
import { SurvivalDashboard } from "@/components/dashboard/eleve/survival";
import { resolveSubjectIcon } from "@/lib/ui-icons";
import { BilanDiagMathsTerminale } from "@/components/dashboard/eleve/BilanDiagMathsTerminale";
import { EafStageQuestionnaireCard } from "@/components/dashboard/eleve/EafStageQuestionnaireCard";
import { EAMCockpitSummary } from "@/components/dashboard/eleve/EAMCockpitSummary";
import { AutomatismesCockpitCard } from "@/components/dashboard/eleve/AutomatismesCockpitCard";
import { NsiCockpitCard } from "@/components/dashboard/eleve/NsiCockpitCard";
import { MathsPremiereStageQuestionnaireCard } from "@/components/dashboard/eleve/MathsPremiereStageQuestionnaireCard";

export default function DashboardEleve() {
  const { data: session, status } = useSession();
  const router = useRouter();
  const [dashboardData, setDashboardData] = useState<EleveDashboardData | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [activeTab, setActiveTab] = useState<'dashboard' | 'booking'>('dashboard');
  const [activeRubrique, setActiveRubrique] = useState<'cockpit' | 'eam' | 'parcours' | 'sessions' | 'matières' | 'bilans' | 'stages'>('cockpit');
  const [isAriaOpen, setIsAriaOpen] = useState(false);
  const [ariaSubject, setAriaSubject] = useState<string | undefined>(undefined);

  const openAriaWithSubject = (subject?: string) => {
    setAriaSubject(subject);
    setIsAriaOpen(true);
  };

  const ariaControls = (
    <>
      <Button
        type="button"
        className="fixed bottom-6 right-6 z-40 h-14 w-14 rounded-full bg-brand-accent text-white shadow-lg hover:bg-brand-accent/90 flex items-center justify-center"
        onClick={() => openAriaWithSubject()}
        data-testid="aria-chat-trigger"
        aria-label="Ouvrir ARIA"
      >
        <Sparkles className="w-5 h-5" />
      </Button>
      <AriaWidget isOpen={isAriaOpen} onClose={() => setIsAriaOpen(false)} defaultSubject={ariaSubject} />
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

  useEffect(() => {
    if (!dashboardData) return;

    const scrollToHash = () => {
      const id = window.location.hash.slice(1);
      if (!id) return;

      window.requestAnimationFrame(() => {
        document.getElementById(id)?.scrollIntoView({ block: 'start' });
      });
    };

    scrollToHash();
    window.addEventListener('hashchange', scrollToHash);
    return () => window.removeEventListener('hashchange', scrollToHash);
  }, [dashboardData]);

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

  const isStmgTrack =
    dashboardData?.student.academicTrack === 'STMG' ||
    dashboardData?.student.academicTrack === 'STMG_NON_LYCEEN';
  const isSurvivalMode = isStmgTrack && dashboardData?.student.survivalMode === true;
  const edsSpecialties = dashboardData?.trackContent?.specialties ?? [];
  const stmgModules = dashboardData?.trackContent?.stmgModules ?? [];
  const studentGradeLevel = dashboardData?.student.gradeLevel;
  const isPremiereStudent = studentGradeLevel === 'PREMIERE' || dashboardData?.student.grade === 'PREMIERE';
  const showNSI = edsSpecialties.some((item) => String(item.subject ?? '').toUpperCase() === 'NSI');
  const ariaSubjectLinks = buildAriaSubjectLinks({
    isStmgTrack,
    specialties: edsSpecialties,
    stmgModules,
  });

  return (
    <div className="min-h-screen bg-surface-darker text-neutral-100">
      {/* Header */}
      <header className="bg-surface-card shadow-sm border-b border-white/10">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          {/* Row 1: user + actions */}
          <div className="flex items-center justify-between h-14 sm:h-16 gap-2">
            <div className="flex items-center gap-2 min-w-0">
              <User className="w-7 h-7 sm:w-8 sm:h-8 text-brand-accent shrink-0" aria-hidden="true" />
              <div className="min-w-0">
                <h1 className="font-semibold text-white text-sm sm:text-base truncate">
                  {session?.user.firstName} {session?.user.lastName}
                </h1>
                <p className="text-xs sm:text-sm text-neutral-400 hidden sm:block">Espace Élève</p>
              </div>
            </div>
            <div className="flex items-center gap-1.5 sm:gap-3 shrink-0">
              <Button
                variant="outline"
                size="sm"
                onClick={() => openAriaWithSubject()}
                className="border-brand-accent/30 text-brand-accent hover:text-white hover:bg-brand-accent/10 h-8 sm:h-9 px-2 sm:px-3"
                aria-label="Ouvrir ARIA"
              >
                <Sparkles className="w-4 h-4 sm:mr-1.5" />
                <span className="hidden sm:inline">ARIA</span>
              </Button>
              <Button
                variant="ghost"
                size="sm"
                onClick={() => signOut({ callbackUrl: '/' })}
                className="text-neutral-300 hover:text-white h-8 sm:h-9 px-2 sm:px-3"
                aria-label="Se déconnecter"
              >
                <LogOut className="w-4 h-4 sm:mr-1.5" aria-hidden="true" />
                <span className="hidden sm:inline">Déconnexion</span>
              </Button>
            </div>
          </div>
          {/* Row 2: navigation tabs */}
          <div className="pb-2 -mx-1 overflow-x-auto scrollbar-none">
            <Tabs value={activeTab} onValueChange={(value) => setActiveTab(value as 'dashboard' | 'booking')}>
              <TabsList className="bg-white/5 border border-white/10 w-full sm:w-auto">
                <TabsTrigger value="dashboard" className="flex-1 sm:flex-none text-xs sm:text-sm data-[state=active]:bg-white/10 data-[state=active]:text-white">
                  Tableau de Bord
                </TabsTrigger>
                <TabsTrigger value="booking" className="flex-1 sm:flex-none text-xs sm:text-sm data-[state=active]:bg-white/10 data-[state=active]:text-white">
                  Réserver Session
                </TabsTrigger>
              </TabsList>
            </Tabs>
          </div>
        </div>
      </header>

      {/* Main Content */}
      <main className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
        {activeTab === 'dashboard' && (
          <DashboardPilotage role="ELEVE" trajectoryData={dashboardData?.trajectory}>
            {dashboardData && (
              <div className="space-y-6">
                {/* Rubriques Navigation */}
                <div className="mb-6 -mx-4 sm:mx-0">
                  <div className="flex gap-1.5 sm:gap-2 p-1 bg-white/5 border-y sm:border border-white/10 sm:rounded-xl overflow-x-auto scrollbar-none px-4 sm:px-1">
                    {[
                      { id: 'cockpit', label: 'Cockpit' },
                      { id: 'eam', label: isPremiereStudent ? 'EAM Maths' : 'EAM Maths 1re' },
                      { id: 'parcours', label: 'Parcours' },
                      { id: 'sessions', label: 'Sessions' },
                      { id: 'matières', label: 'Matières' },
                      { id: 'bilans', label: 'Bilans' },
                      { id: 'stages', label: 'Stages' },
                    ].map((tab) => (
                      <Button
                        key={tab.id}
                        onClick={() => setActiveRubrique(tab.id as any)}
                        variant={activeRubrique === tab.id ? 'default' : 'ghost'}
                        className={`whitespace-nowrap rounded-lg transition-all text-xs sm:text-sm px-3 sm:px-4 shrink-0 sm:flex-1 ${
                          activeRubrique === tab.id
                            ? 'bg-brand-accent text-white shadow-premium font-bold'
                            : 'text-neutral-400 hover:text-white hover:bg-white/5'
                        }`}
                        size="sm"
                      >
                        {tab.label}
                      </Button>
                    ))}
                  </div>
                </div>

                {activeRubrique === 'cockpit' && (
                  <div className="space-y-6">
                    {isPremiereStudent && !isStmgTrack && <EAMCockpitSummary />}
                    {isPremiereStudent && !isStmgTrack && showNSI && <NsiCockpitCard />}
                    {isPremiereStudent && !isStmgTrack && <AutomatismesCockpitCard />}
                    <EleveCockpit
                      data={dashboardData}
                      onBookSession={() => setActiveTab('booking')}
                      onOpenAria={() => openAriaWithSubject()}
                    />
                    <EleveAria
                      totalConversations={dashboardData.ariaStats.totalConversations}
                      messagesToday={dashboardData.ariaStats.messagesToday}
                      onOpenAria={() => openAriaWithSubject()}
                    />
                  </div>
                )}

                {activeRubrique === 'eam' && (
                  <Card className="overflow-hidden border-brand-accent/20 bg-gradient-to-br from-brand-accent/10 via-surface-card to-surface-card shadow-premium">
                    <CardContent className="p-5 sm:p-6">
                      <div className="flex flex-col gap-5 lg:flex-row lg:items-center lg:justify-between">
                        <div className="min-w-0">
                          <p className="text-xs font-black uppercase tracking-[0.16em] text-brand-accent">
                            Préparation Première — spécialité mathématiques
                          </p>
                          <h2 className="mt-2 text-xl font-black tracking-tight text-white sm:text-2xl">
                            Épreuve Anticipée de Mathématiques
                          </h2>
                          <p className="mt-3 max-w-3xl text-sm leading-relaxed text-neutral-300">
                            Accédez au cockpit premium du sprint : plan 10h, mission du jour, livret imprimable, automatismes et stratégie d'épreuve.
                          </p>
                        </div>
                        <Link href="/dashboard/eleve/eam" className="w-full sm:w-fit">
                          <Button className="w-full bg-brand-accent text-surface-darker hover:bg-brand-accent/90 sm:w-auto">
                            Ouvrir le sprint EAM
                            <ArrowRight className="ml-2 h-4 w-4" />
                          </Button>
                        </Link>
                      </div>
                    </CardContent>
                  </Card>
                )}

                {activeRubrique === 'parcours' && (
                  <div className="space-y-6">
                    {isSurvivalMode ? (
                      <SurvivalDashboard progress={dashboardData.survivalProgress} />
                    ) : isStmgTrack ? (
                      <TrackContentSTMG modules={stmgModules} />
                    ) : (
                      <TrackContentEDS specialties={edsSpecialties} />
                    )}

                    {/* Parcours de Réussite — Accès direct au programme interactif (PRIORITY) */}
                    {shouldShowEdsParcours({
                      isStmgTrack,
                      grade: dashboardData?.student.grade,
                      gradeLevel: studentGradeLevel,
                    }) && (
                      <Card className="bg-gradient-to-br from-indigo-500/10 via-brand-accent/5 to-surface-card border border-indigo-500/20 shadow-lg overflow-hidden group">
                        <CardContent className="p-0">
                          <div className="flex flex-col md:flex-row items-stretch">
                            <div className="md:w-1/3 bg-indigo-500/10 p-6 flex flex-col items-center justify-center text-center border-b md:border-b-0 md:border-r border-indigo-500/20">
                              <div className="w-16 h-16 rounded-2xl bg-indigo-500/20 flex items-center justify-center mb-4 group-hover:scale-110 transition-transform">
                                <BookOpen className="w-8 h-8 text-indigo-300" />
                              </div>
                              <h3 className="font-bold text-white tracking-tight">Mon Parcours</h3>
                              <p className="text-[10px] uppercase tracking-widest text-indigo-300/70 font-bold mt-1">Spécialité Maths</p>
                            </div>
                            <div className="flex-1 p-6 flex flex-col justify-center">
                              <div className="flex items-center gap-2 mb-2">
                                <Sparkles className="w-4 h-4 text-brand-accent animate-pulse" />
                                <span className="text-xs font-semibold text-indigo-200">Programme Interactif Nexus</span>
                              </div>
                              <h4 className="text-lg font-bold text-white mb-2">
                                Mathématiques — {studentGradeLevel === 'PREMIERE' ? 'Première EDS' : 'Terminale EDS'}
                              </h4>
                              <p className="text-sm text-neutral-400 mb-6 line-clamp-2">
                                Accédez à vos fiches de cours, exercices interactifs et quiz de révision pour maîtriser le programme officiel.
                              </p>
                              <Link href={studentGradeLevel === 'PREMIERE' ? "/dashboard/eleve/programme/maths" : "/programme/maths-terminale"} className="w-full sm:w-fit">
                                <Button className="w-full sm:w-auto bg-indigo-600 hover:bg-indigo-500 text-white font-bold px-8 shadow-lg shadow-indigo-600/20">
                                  Continuer mon parcours
                                  <ArrowRight className="w-4 h-4 ml-2" />
                                </Button>
                              </Link>
                            </div>
                          </div>
                        </CardContent>
                      </Card>
                    )}

                    {/* Nouveau : Livret STMG Interactif (Gamifié) */}
                    {shouldShowStmgLivret({
                      isStmgTrack,
                      isSurvivalMode,
                      grade: dashboardData?.student.grade,
                      gradeLevel: studentGradeLevel,
                    }) && (
                      <Card className="bg-gradient-to-br from-orange-500/10 via-brand-accent/5 to-surface-card border border-orange-500/20 shadow-lg overflow-hidden group">
                        <CardContent className="p-0">
                          <div className="flex flex-col md:flex-row items-stretch">
                            <div className="md:w-1/3 bg-orange-500/10 p-6 flex flex-col items-center justify-center text-center border-b md:border-b-0 md:border-r border-orange-500/20">
                              <div className="w-16 h-16 rounded-2xl bg-orange-500/20 flex items-center justify-center mb-4 group-hover:scale-110 transition-transform">
                                <Calculator className="w-8 h-8 text-orange-300" />
                              </div>
                              <h3 className="font-bold text-white tracking-tight">Livret STMG</h3>
                              <p className="text-[10px] uppercase tracking-widest text-orange-300/70 font-bold mt-1">Objectif Bac 2026</p>
                            </div>
                            <div className="flex-1 p-6 flex flex-col justify-center">
                              <div className="flex items-center gap-2 mb-2">
                                <Zap className="w-4 h-4 text-orange-400 animate-pulse" />
                                <span className="text-xs font-semibold text-orange-200">Mode Gamifié — Sauve les meubles !</span>
                              </div>
                              <h4 className="text-lg font-bold text-white mb-2">
                                Révisions Mathématiques Interactives
                              </h4>
                              <p className="text-sm text-neutral-400 mb-6 line-clamp-2">
                                Entraînez-vous avec notre nouveau livret gamifié : calculs de base, pourcentages, suites et QCM Chrono.
                              </p>
                              <Link href="/dashboard/eleve/programme/maths" className="w-full sm:w-fit">
                                <Button className="w-full sm:w-auto bg-orange-600 hover:bg-orange-500 text-white font-bold px-8 shadow-lg shadow-orange-600/20">
                                  Ouvrir le Livret
                                  <ArrowRight className="w-4 h-4 ml-2" />
                                </Button>
                              </Link>
                            </div>
                          </div>
                        </CardContent>
                      </Card>
                    )}

                    {/* Automatismes — Épreuve Anticipée (EDS Première uniquement, pas STMG) */}
                    {!isSurvivalMode && !isStmgTrack && (
                      <AutomatismesDashboardCard
                        grade={dashboardData?.student.grade || ""}
                        automatismes={dashboardData?.automatismes}
                      />
                    )}
                  </div>
                )}

                {activeRubrique === 'sessions' && (
                  <div className="space-y-6">
                    <EleveSessions
                      sessions={dashboardData.recentSessions}
                      onBookSession={() => setActiveTab('booking')}
                    />

                    {/* Sessions Récentes */}
                    {!isSurvivalMode && (
                      <Card className="bg-surface-card border border-white/10 shadow-premium">
                        <CardHeader>
                          <CardTitle className="flex items-center">
                            <Calendar className="w-5 h-5 mr-2 text-brand-accent" />
                            Sessions récentes
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
                                        : 'bg-blue-500/15 text-slate-200 border border-blue-500/20'
                                      }`}>
                                      {session.status}
                                    </span>
                                  </div>
                                </div>
                              ))}
                            </div>
                          ) : (
                            <div className="text-center py-8">
                              <Calendar className="w-12 h-12 text-neutral-500 mx-auto mb-3" />
                              <p className="text-neutral-400 text-sm">
                                Vos sessions apparaîtront ici une fois programmées.
                              </p>
                              <Button
                                onClick={() => setActiveTab('booking')}
                                className="btn-primary mt-3"
                                size="sm"
                              >
                                Réserver une séance
                              </Button>
                            </div>
                          )}
                        </CardContent>
                      </Card>
                    )}
                  </div>
                )}

                {activeRubrique === 'matières' && (
                  <div className="space-y-6">
                    {!isSurvivalMode && <EleveHubRessources hub={dashboardData.hub} />}

                    {/* Mes Matières — ARIA contextuel */}
                    <Card className="bg-surface-card border border-white/10 shadow-premium">
                      <CardHeader>
                        <CardTitle className="flex items-center justify-between">
                          <span className="flex items-center">
                            <BookOpen className="w-5 h-5 mr-2 text-brand-accent" />
                            Mes Matières
                          </span>
                          <span className="text-xs font-normal text-neutral-500">
                            Clique sur une matière pour poser une question à ARIA
                          </span>
                        </CardTitle>
                      </CardHeader>
                      <CardContent>
                        <div className="grid grid-cols-2 sm:grid-cols-3 gap-3">
                          {ariaSubjectLinks.map((subject) => (
                            (() => {
                              const SubjectIcon = resolveSubjectIcon(subject.value);
                              return (
                                <button
                                  key={subject.value}
                                  onClick={() => openAriaWithSubject(subject.value)}
                                  className="flex items-center gap-3 p-3 bg-white/5 border border-white/10 rounded-xl hover:border-brand-accent/40 hover:bg-brand-accent/5 transition-all text-left group"
                                >
                                  <span className="flex h-10 w-10 items-center justify-center rounded-lg bg-white/5 text-brand-accent">
                                    <SubjectIcon className="h-4.5 w-4.5" aria-hidden="true" />
                                  </span>
                                  <div className="flex-1 min-w-0">
                                    <span className={`text-sm font-medium ${subject.color} group-hover:text-white transition-colors`}>
                                      {subject.label}
                                    </span>
                                    <div className="flex items-center gap-1 mt-0.5">
                                      <Sparkles className="w-3 h-3 text-brand-accent/50" />
                                      <span className="text-[10px] text-neutral-500">ARIA</span>
                                    </div>
                                  </div>
                                </button>
                              );
                            })()
                          ))}
                        </div>
                      </CardContent>
                    </Card>
                  </div>
                )}

                {activeRubrique === 'bilans' && (
                  <div className="space-y-6">
                    {!isSurvivalMode && (
                      <EleveBilans
                        recentBilans={dashboardData.recentBilans}
                        lastBilan={dashboardData.lastBilan}
                      />
                    )}

                    {/* Bilan Diagnostic Maths Terminale — TERMINALE EDS MATHEMATIQUES only */}
                    {!isStmgTrack &&
                      !isSurvivalMode &&
                      dashboardData?.student.gradeLevel === 'TERMINALE' &&
                      dashboardData?.student.academicTrack === 'EDS_GENERALE' &&
                      dashboardData?.student.specialties?.includes('MATHEMATIQUES') && (
                        <BilanDiagMathsTerminale />
                      )}

                    {/* Questionnaire EAF — Stage de printemps (Première uniquement) */}
                    {studentGradeLevel === 'PREMIERE' && (
                      <EafStageQuestionnaireCard />
                    )}

                    {/* Questionnaire Maths — Stage de printemps (Première EDS Maths uniquement) */}
                    {studentGradeLevel === 'PREMIERE' && (
                      <MathsPremiereStageQuestionnaireCard />
                    )}
                  </div>
                )}

                {activeRubrique === 'stages' && (
                  <div className="space-y-6">
                    {!isSurvivalMode && (
                      <EleveStages
                        upcomingStages={dashboardData.upcomingStages}
                        pastStages={dashboardData.pastStages}
                      />
                    )}
                  </div>
                )}
              </div>
            )}
          </DashboardPilotage>
        )}

        {activeTab === 'booking' && dashboardData && (
          <SessionBooking
            studentId={session!.user.id}
            onBookingComplete={(sessionId) => {
              // Refresh dashboard data after booking
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
