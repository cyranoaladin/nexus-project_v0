'use client';

import { useState, useMemo, useEffect } from 'react';
import Link from 'next/link';
import { useSession } from 'next-auth/react';
import { useRouter } from 'next/navigation';
import { useNsiProgress } from '@/hooks/useNsiProgress';
import { nsiSubjects } from '@/data/nsi-pratique-2026/subjects';
import { nsiPatterns } from '@/data/nsi-pratique-2026/patterns';
import { fiveDayPlan } from '@/data/nsi-pratique-2026/five-day-plan';
import { oralQuestions, selfAssessmentItems } from '@/data/nsi-pratique-2026/oral-questions';
import { NsiHero } from '@/components/nsi-pratique-2026/NsiHero';
import { NsiProgressOverview } from '@/components/nsi-pratique-2026/NsiProgressOverview';
import { NsiFiveDayPlan } from '@/components/nsi-pratique-2026/NsiFiveDayPlan';
import { NsiSubjectGrid } from '@/components/nsi-pratique-2026/NsiSubjectGrid';
import { NsiSubjectDetail } from '@/components/nsi-pratique-2026/NsiSubjectDetail';
import { NsiPatternLibrary } from '@/components/nsi-pratique-2026/NsiPatternLibrary';
import { NsiFlashcards } from '@/components/nsi-pratique-2026/NsiFlashcards';
import { NsiMockExam } from '@/components/nsi-pratique-2026/NsiMockExam';
import { NsiOralTrainer } from '@/components/nsi-pratique-2026/NsiOralTrainer';
import { NsiSelfAssessment } from '@/components/nsi-pratique-2026/NsiSelfAssessment';
import { NsiTransversalQuestions } from '@/components/nsi-pratique-2026/NsiTransversalQuestions';

type Section = 'overview' | 'plan' | 'subjects' | 'patterns' | 'flashcards' | 'mock' | 'oral' | 'assessment' | 'questions';
type AccessStatus = 'checking' | 'allowed' | 'denied' | 'error';
type DashboardAccessPayload = {
  student?: {
    specialties?: string[];
  };
  trackContent?: {
    specialties?: Array<{ subject?: string | null }>;
  };
};

function hasNsiSpecialty(payload: DashboardAccessPayload) {
  const studentSpecialties = payload.student?.specialties ?? [];
  const trackSpecialties = payload.trackContent?.specialties?.map((item) => item.subject ?? '') ?? [];
  return [...studentSpecialties, ...trackSpecialties].some((subject) => subject.toUpperCase() === 'NSI');
}

export default function NsiPratique2026Page() {
  const { data: session, status } = useSession();
  const router = useRouter();
  const [accessStatus, setAccessStatus] = useState<AccessStatus>('checking');

  useEffect(() => {
    if (status !== 'authenticated') return;
    if ((session?.user as { role?: string } | undefined)?.role !== 'ELEVE') return;

    const controller = new AbortController();
    setAccessStatus('checking');

    fetch('/api/student/dashboard', { signal: controller.signal })
      .then(async (response) => {
        if (!response.ok) throw new Error(`Dashboard payload failed: ${response.status}`);
        return response.json() as Promise<DashboardAccessPayload>;
      })
      .then((payload) => {
        setAccessStatus(hasNsiSpecialty(payload) ? 'allowed' : 'denied');
      })
      .catch((error: unknown) => {
        if (error instanceof Error && error.name === 'AbortError') return;
        setAccessStatus('error');
      });

    return () => controller.abort();
  }, [session?.user, status]);

  // Auth guard
  if (status === 'loading') {
    return (
      <div className="flex items-center justify-center min-h-[60vh]">
        <div className="animate-pulse text-neutral-400">Chargement...</div>
      </div>
    );
  }

  if (!session || (session.user as { role?: string })?.role !== 'ELEVE') {
    router.push('/auth/signin');
    return null;
  }

  if (accessStatus === 'checking') {
    return (
      <div className="flex min-h-[60vh] items-center justify-center">
        <div className="animate-pulse text-neutral-400">Vérification du profil NSI...</div>
      </div>
    );
  }

  if (accessStatus === 'denied') {
    return (
      <div className="mx-auto flex min-h-[60vh] max-w-2xl items-center justify-center px-4">
        <div className="rounded-2xl border border-white/10 bg-surface-card p-6 text-center shadow-xl">
          <p className="text-xs font-semibold uppercase tracking-[0.2em] text-brand-primary">Module spécialisé</p>
          <h1 className="mt-3 text-2xl font-semibold text-white">NSI Pratique est réservé aux élèves ayant NSI en spécialité.</h1>
          <p className="mt-3 text-sm leading-6 text-neutral-300">
            Votre cockpit reste centré sur les modules correspondant à votre parcours. Si votre spécialité NSI n'apparaît pas alors qu'elle devrait, contactez l'équipe Nexus Réussite.
          </p>
          <Link
            href="/dashboard/eleve"
            className="mt-6 inline-flex min-h-11 items-center justify-center rounded-lg bg-brand-primary px-5 text-sm font-semibold text-white transition hover:bg-brand-primary/90"
          >
            Retour au cockpit
          </Link>
        </div>
      </div>
    );
  }

  if (accessStatus === 'error') {
    return (
      <div className="mx-auto flex min-h-[60vh] max-w-2xl items-center justify-center px-4">
        <div className="rounded-2xl border border-amber-400/20 bg-amber-500/10 p-6 text-center">
          <h1 className="text-xl font-semibold text-amber-100">Profil temporairement indisponible</h1>
          <p className="mt-3 text-sm leading-6 text-amber-50/80">
            Impossible de vérifier la spécialité NSI pour le moment. Réessayez dans quelques instants.
          </p>
        </div>
      </div>
    );
  }

  return <NsiPratiqueContent />;
}

function NsiPratiqueContent() {
  const [activeSection, setActiveSection] = useState<Section>('overview');
  const [selectedSubjectId, setSelectedSubjectId] = useState<number | null>(null);

  const {
    progress,
    stats,
    recommendation,
    syncStatus,
    lastSyncedAt: _lastSyncedAt,
    setSubjectProgress,
    setPatternProgress,
    setFlashcardProgress,
    setFiveDayTask,
    setSelfAssessment,
    addMockExam,
    setOralPhrases,
  } = useNsiProgress();

  const selectedSubject = useMemo(() => {
    if (!selectedSubjectId) return null;
    return nsiSubjects.find(s => s.id === selectedSubjectId) ?? null;
  }, [selectedSubjectId]);

  if (!progress || !stats) {
    return (
      <div className="flex items-center justify-center min-h-[60vh]">
        <div className="animate-pulse text-neutral-400">Chargement de la progression...</div>
      </div>
    );
  }

  const navItems: { key: Section; label: string }[] = [
    { key: 'overview', label: 'Vue d\'ensemble' },
    { key: 'plan', label: 'Plan 5 jours' },
    { key: 'subjects', label: 'Sujets' },
    { key: 'patterns', label: 'Patrons' },
    { key: 'flashcards', label: 'Flashcards' },
    { key: 'mock', label: 'Sujet blanc' },
    { key: 'oral', label: 'Oral' },
    { key: 'assessment', label: 'Auto-évaluation' },
    { key: 'questions', label: 'Questions' },
  ];

  // If a subject is selected, show detail view
  if (selectedSubject) {
    return (
      <div className="space-y-6">
        <NsiSubjectDetail
          subject={selectedSubject}
          patterns={nsiPatterns}
          progress={progress}
          onUpdateProgress={(update: Record<string, unknown>) => {
            if (update.type === 'oralPhrases') {
              setOralPhrases(update.subjectId as number, update.phrases as Partial<import('@/data/nsi-pratique-2026/types').OralFourPhrases>);
            } else if (update.type === 'flashcard') {
              const level = update.action === 'known' ? 4 : 0;
              setFlashcardProgress(update.cardId as string, { level });
            } else if (update.type === 'subject') {
              setSubjectProgress(update.subjectId as number, update.data as Partial<import('@/data/nsi-pratique-2026/types').SubjectProgress>);
            }
          }}
          onClose={() => setSelectedSubjectId(null)}
        />
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {/* Hero */}
      <NsiHero
        stats={stats}
        recommendation={recommendation}
        onNavigate={(section) => setActiveSection(section as Section)}
      />

      {/* Navigation */}
      <nav className="flex gap-2 overflow-x-auto pb-2 scrollbar-hide">
        {navItems.map(item => (
          <button
            key={item.key}
            onClick={() => setActiveSection(item.key)}
            aria-current={activeSection === item.key ? 'page' : undefined}
            className={`px-4 py-2.5 rounded-lg text-sm font-medium whitespace-nowrap transition-colors focus-visible:ring-2 focus-visible:ring-brand-primary focus-visible:ring-offset-2 focus-visible:ring-offset-surface-dark ${
              activeSection === item.key
                ? 'bg-brand-primary text-white'
                : 'bg-surface-card text-neutral-400 hover:text-white hover:bg-surface-elevated'
            }`}
          >
            {item.label}
          </button>
        ))}
      </nav>
      {/* Getting started hint (visible only when no progress) */}
      {stats.subjectsSeen === 0 && activeSection === 'overview' && (
        <div className="rounded-xl border border-brand-primary/20 bg-brand-primary/5 p-4 space-y-2">
          <p className="text-sm font-medium text-brand-primary">Comment utiliser cette page ?</p>
          <ol className="text-xs text-neutral-300 list-decimal list-inside space-y-1">
            <li>Suis le <button className="underline text-brand-primary" onClick={() => setActiveSection('plan')}>Plan 5 jours</button> pour organiser tes révisions.</li>
            <li>Travaille chaque <button className="underline text-brand-primary" onClick={() => setActiveSection('subjects')}>Sujet</button> en 55 minutes chrono, puis coche ce que tu maîtrises.</li>
            <li>Révise avec les <button className="underline text-brand-primary" onClick={() => setActiveSection('flashcards')}>Flashcards</button> pour ancrer les concepts.</li>
            <li>Fais un <button className="underline text-brand-primary" onClick={() => setActiveSection('mock')}>Sujet blanc</button> chronométré pour simuler l&apos;épreuve.</li>
          </ol>
        </div>
      )}

      <p className="text-xs text-neutral-500 mt-1">
        {syncStatus === 'synced' && '✅ Progression synchronisée avec le serveur.'}
        {syncStatus === 'saving' && '⏳ Synchronisation en cours...'}
        {syncStatus === 'error' && '⚠️ Erreur de synchronisation — progression sauvegardée localement.'}
        {syncStatus === 'local-only' && '💾 Progression sauvegardée sur cet appareil uniquement.'}
        {syncStatus === 'idle' && '💾 Chargement...'}
      </p>

      {/* Content */}
      {activeSection === 'overview' && (
        <NsiProgressOverview
          stats={stats}
          recommendation={recommendation}
          subjects={nsiSubjects}
        />
      )}

      {activeSection === 'plan' && (
        <NsiFiveDayPlan
          plan={fiveDayPlan}
          progress={progress}
          onToggleTask={(taskKey) => {
            const current = progress.fiveDayPlan[taskKey];
            setFiveDayTask(taskKey, { completed: !current?.completed });
          }}
        />
      )}

      {activeSection === 'subjects' && (
        <NsiSubjectGrid
          subjects={nsiSubjects}
          progress={progress}
          onSelectSubject={setSelectedSubjectId}
        />
      )}

      {activeSection === 'patterns' && (
        <NsiPatternLibrary
          patterns={nsiPatterns}
          subjects={nsiSubjects}
          progress={progress}
          onUpdatePattern={setPatternProgress}
        />
      )}

      {activeSection === 'flashcards' && (
        <NsiFlashcards
          subjects={nsiSubjects}
          patterns={nsiPatterns}
          oralQuestions={oralQuestions}
          progress={progress}
          onUpdateFlashcard={(cardId: string, level: number) => setFlashcardProgress(cardId, { level })}
        />
      )}

      {activeSection === 'mock' && (
        <NsiMockExam
          subjects={nsiSubjects}
          progress={progress}
          onComplete={addMockExam}
        />
      )}

      {activeSection === 'oral' && (
        <NsiOralTrainer
          subjects={nsiSubjects}
          progress={progress}
          onUpdateOralPhrases={setOralPhrases}
        />
      )}

      {activeSection === 'assessment' && (
        <NsiSelfAssessment
          items={selfAssessmentItems}
          progress={progress}
          onUpdateAssessment={setSelfAssessment}
        />
      )}

      {activeSection === 'questions' && (
        <NsiTransversalQuestions
          questions={oralQuestions}
          progress={progress}
          onUpdateFlashcard={(cardId: string, level: number) => setFlashcardProgress(cardId, { level })}
        />
      )}
    </div>
  );
}
