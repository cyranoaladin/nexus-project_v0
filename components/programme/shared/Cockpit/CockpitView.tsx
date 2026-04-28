'use client';

import React from 'react';
import { RefreshCw, BookOpen } from 'lucide-react';
import { HeroPedagogique } from './HeroPedagogique';
import { SyntheseEleve } from './SyntheseEleve';
import { FeuilleDeRoute } from './FeuilleDeRoute';
import { SeanceDuJour } from './SeanceDuJour';
import { RAGFlashCard } from '@/components/programme/shared/RAG/RAGFlashCard';
import { ThemesOverview } from './ThemesOverview';
import { BadgesPreview } from './BadgesPreview';
import { StreakShop } from './StreakShop';

type ActiveTab = 'cockpit' | 'cours' | 'examen' | 'enseignant' | 'bilan';

interface CockpitViewProps {
  displayName: string;
  onSwitchTab: (tab: ActiveTab) => void;
  onNavigateToChap: (catKey: string, chapId: string) => void;
  store: {
    getNiveau: () => any;
    completedChapters: string[];
    getDueReviews: () => string[];
    diagnosticResults: Record<string, { score: number; total: number }>;
    totalXP: number;
    streak: number;
    badges: string[];
    streakFreezes: number;
    buyStreakFreeze: () => void;
  };
  programmeData: Record<string, any>;
  badgeDefinitions: Record<string, any>;
  stageConfig: {
    STAGE_PRINTEMPS_2026: any;
    getStagePhase: () => 'avant' | 'pendant' | 'apres';
    formatDateFr: (date: string) => string;
    getTodaySession: () => any;
    getDaysUntilStage: () => number;
    getDaysUntilExam: () => number;
    getNextSession: () => any;
  };
}

export const CockpitView: React.FC<CockpitViewProps> = ({ displayName, onSwitchTab, onNavigateToChap, store, programmeData, badgeDefinitions, stageConfig }) => {
  const dueReviews = store.getDueReviews();

  return (
    <div className="space-y-8">
      {/* Hero pédagogique contextuel */}
      <HeroPedagogique
        displayName={displayName}
        onNavigate={(tab) => onSwitchTab(tab as ActiveTab)}
        store={{
          getNiveau: () => store.getNiveau(),
          completedChapters: store.completedChapters,
          getDueReviews: () => store.getDueReviews(),
          totalXP: store.totalXP,
        }}
        stageConfig={{
          getStagePhase: stageConfig.getStagePhase,
          getDaysUntilStage: stageConfig.getDaysUntilStage,
          getDaysUntilExam: stageConfig.getDaysUntilExam,
          getTodaySession: stageConfig.getTodaySession,
          getNextSession: stageConfig.getNextSession,
          formatDateFr: stageConfig.formatDateFr,
        }}
      />

      {/* Séance du jour interactive */}
      <SeanceDuJour
        onNavigateToChap={onNavigateToChap}
        stageConfig={{ getTodaySession: stageConfig.getTodaySession, formatDateFr: stageConfig.formatDateFr }}
        programmeData={programmeData}
      />

      {/* Priorités Épreuve 2026 */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        <div className="lg:col-span-2 space-y-6">
          <SyntheseEleve
            onNavigateToChap={onNavigateToChap}
            store={{
              completedChapters: store.completedChapters,
              diagnosticResults: store.diagnosticResults,
              getDueReviews: () => store.getDueReviews(),
              totalXP: store.totalXP,
              streak: store.streak,
            }}
            programmeData={programmeData}
          />
          <FeuilleDeRoute
            onNavigate={(tab) => onSwitchTab(tab as ActiveTab)}
            stageConfig={{ STAGE_PRINTEMPS_2026: stageConfig.STAGE_PRINTEMPS_2026, getStagePhase: stageConfig.getStagePhase, formatDateFr: stageConfig.formatDateFr }}
          />
        </div>

        <div className="space-y-6">
          {/* Bloc RAG — Rappel Flash dynamique */}
          <RAGFlashCard
            onShowMore={() => onSwitchTab('cours')}
            store={{ getDueReviews: () => store.getDueReviews(), diagnosticResults: store.diagnosticResults }}
            programmeData={programmeData}
          />

          {/* SRS — Révisions en retard */}
          {dueReviews.length > 0 && (
            <div className="rounded-3xl border border-cyan-500/20 bg-cyan-500/5 p-6">
              <div className="flex items-center gap-3 mb-4">
                <div className="rounded-lg bg-cyan-500/20 p-2">
                  <RefreshCw className="h-4 w-4 text-cyan-300" />
                </div>
                <h3 className="font-bold text-white">
                  Révisions ({dueReviews.length})
                </h3>
              </div>
              <div className="flex flex-wrap gap-2">
                {dueReviews.slice(0, 3).map((chapId) => {
                  let chapTitle = chapId;
                  let catKey = '';
                  for (const [key, cat] of Object.entries(programmeData)) {
                    const found = cat.chapitres.find((c: any) => c.id === chapId);
                    if (found) {
                      chapTitle = found.titre;
                      catKey = key;
                      break;
                    }
                  }
                  return (
                    <button
                      key={chapId}
                      onClick={() => {
                        if (catKey) onNavigateToChap(catKey, chapId);
                        else onSwitchTab('cours');
                      }}
                      className="inline-flex items-center gap-2 rounded-xl bg-cyan-500/10 px-3 py-2 text-[10px] font-bold text-cyan-300 border border-cyan-500/20 hover:bg-cyan-500/20 transition-all truncate max-w-full"
                    >
                      <BookOpen className="h-3 w-3" />
                      {chapTitle}
                    </button>
                  );
                })}
              </div>
            </div>
          )}
        </div>
      </div>

      {/* Progression par thème */}
      <ThemesOverview onNavigate={onSwitchTab} store={store} programmeData={programmeData} />

      {/* Badges et boutique */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-5">
        <BadgesPreview store={store} badgeDefinitions={badgeDefinitions} />
        <StreakShop store={store} />
      </div>
    </div>
  );
};
