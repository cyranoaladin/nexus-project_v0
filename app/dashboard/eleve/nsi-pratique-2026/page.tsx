'use client';

import { useState, useMemo } from 'react';
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

export default function NsiPratique2026Page() {
  const { data: session, status } = useSession();
  const router = useRouter();
  const [activeSection, setActiveSection] = useState<Section>('overview');
  const [selectedSubjectId, setSelectedSubjectId] = useState<number | null>(null);

  const {
    progress,
    stats,
    recommendation,
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
      <p className="text-xs text-neutral-500 mt-1">
        Progression sauvegardée sur cet appareil uniquement.
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
