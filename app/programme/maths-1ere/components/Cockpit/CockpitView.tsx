'use client';

import React from 'react';
import { motion } from 'framer-motion';
import { RefreshCw, BookOpen, Snowflake, Medal, Sparkles } from 'lucide-react';
import { useMathsLabStore, type MathsLabState } from '../../store';
import { programmeData, badgeDefinitions } from '../../data';
import { resolveUiIcon } from '@/lib/ui-icons';
import { HeroPedagogique } from './HeroPedagogique';
import { SyntheseEleve } from './SyntheseEleve';
import { FeuilleDeRoute } from './FeuilleDeRoute';
import { SeanceDuJour } from './SeanceDuJour';
import { STAGE_PRINTEMPS_2026, getTodaySession } from '../../config/stage';

type ActiveTab = 'cockpit' | 'cours' | 'examen' | 'enseignant' | 'bilan';

interface CockpitViewProps {
  displayName: string;
  onSwitchTab: (tab: ActiveTab) => void;
  onNavigateToChap: (catKey: string, chapId: string) => void;
}

export const CockpitView: React.FC<CockpitViewProps> = ({ displayName, onSwitchTab, onNavigateToChap }) => {
  const store = useMathsLabStore();
  const dueReviews = store.getDueReviews();

  return (
    <div className="space-y-8">
      {/* Hero pédagogique contextuel */}
      <HeroPedagogique
        displayName={displayName}
        onNavigate={(tab) => onSwitchTab(tab as ActiveTab)}
      />

      {/* Séance du jour interactive */}
      <SeanceDuJour onNavigateToChap={onNavigateToChap} />

      {/* Priorités Épreuve 2026 */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        <div className="lg:col-span-2 space-y-6">
          <SyntheseEleve onNavigateToChap={onNavigateToChap} />
          <FeuilleDeRoute onNavigate={(tab) => onSwitchTab(tab as ActiveTab)} />
        </div>

        <div className="space-y-6">
          {/* Bloc RAG — Rappel Flash */}
          <div className="rounded-3xl border border-violet-500/30 bg-violet-950/20 p-6 shadow-xl">
            <div className="flex items-center gap-3 mb-4">
              <div className="rounded-lg bg-violet-500/20 p-2">
                <Sparkles className="h-4 w-4 text-violet-300" />
              </div>
              <h3 className="font-bold text-white">Rappel Méthode IA</h3>
            </div>
            <p className="text-xs text-slate-400 mb-4 leading-relaxed">
              Basé sur tes derniers résultats, voici un point de vigilance pour l&apos;épreuve :
            </p>
            <div className="rounded-2xl bg-slate-900/60 p-4 border border-white/5">
              <div className="text-[10px] font-black text-violet-400 uppercase mb-2">Rédaction & Justification</div>
              <p className="text-xs text-slate-300 italic">
                &quot;N&apos;oublie pas de toujours vérifier les conditions d&apos;application du discriminant $\Delta$. Si $a=0$, le trinôme devient une équation du premier degré.&quot;
              </p>
            </div>
            <button 
              onClick={() => onSwitchTab('enseignant')} // Redirige vers l'onglet RAG (ici sous enseignant pour démo, à ajuster)
              className="mt-4 w-full rounded-xl bg-violet-600/20 py-2.5 text-xs font-bold text-violet-300 border border-violet-500/30 hover:bg-violet-600/30 transition-all"
            >
              Voir d&apos;autres conseils
            </button>
          </div>

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
                    const found = cat.chapitres.find((c) => c.id === chapId);
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
      <ThemesOverview onNavigate={onSwitchTab} />

      {/* Badges et boutique */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-5">
        <BadgesPreview store={store} />
        <StreakShop store={store} />
      </div>
    </div>
  );
};

// ─── Themes Overview ──────────────────────────────────────────────────────────

const ThemesOverview: React.FC<{ onNavigate: (tab: ActiveTab) => void }> = ({ onNavigate }) => {
  const store = useMathsLabStore();

  return (
    <section aria-labelledby="themes-title">
      <div className="flex items-center gap-3 mb-5">
        <div className="h-px flex-1 bg-slate-800" />
        <h2 id="themes-title" className="text-sm font-bold uppercase tracking-widest text-slate-400">Avancement par thème</h2>
        <div className="h-px flex-1 bg-slate-800" />
      </div>
      <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-5 gap-4">
        {Object.entries(programmeData).map(([key, cat]) => {
          const ThemeIcon = resolveUiIcon(cat.icon);
          const completedCount = cat.chapitres.filter((c) =>
            store.completedChapters.includes(c.id)
          ).length;
          const progress = cat.chapitres.length > 0 ? (completedCount / cat.chapitres.length) * 100 : 0;

          return (
            <motion.button
              key={key}
              whileHover={{ scale: 1.03, y: -2 }}
              onClick={() => onNavigate('cours')}
              className="rounded-2xl border border-slate-700/30 bg-slate-800/30 p-4 text-left hover:border-slate-600/40 transition-all group"
            >
              <div className="mb-3">
                <div
                  className={`w-9 h-9 rounded-xl flex items-center justify-center ${
                    cat.couleur === 'cyan' ? 'bg-cyan-500/10 text-cyan-400' :
                    cat.couleur === 'blue' ? 'bg-blue-500/10 text-blue-400' :
                    cat.couleur === 'purple' ? 'bg-purple-500/10 text-purple-400' :
                    cat.couleur === 'amber' ? 'bg-amber-500/10 text-amber-400' :
                    'bg-green-500/10 text-green-400'
                  }`}
                >
                  <ThemeIcon className="h-5 w-5" />
                </div>
              </div>
              <div className="font-bold text-white text-xs mb-0.5 group-hover:text-cyan-300 transition-colors truncate">
                {cat.titre}
              </div>
              <div className="text-[10px] text-slate-500 font-bold uppercase tracking-wider mb-2">
                {completedCount}/{cat.chapitres.length}
              </div>
              <div className="w-full h-1.5 bg-slate-900 rounded-full overflow-hidden border border-white/5">
                <div
                  className={`h-full rounded-full transition-all duration-700 ${
                    cat.couleur === 'cyan' ? 'bg-cyan-500' :
                    cat.couleur === 'blue' ? 'bg-blue-500' :
                    cat.couleur === 'purple' ? 'bg-purple-500' :
                    cat.couleur === 'amber' ? 'bg-amber-500' :
                    'bg-green-500'
                  }`}
                  style={{ width: `${progress}%` }}
                />
              </div>
            </motion.button>
          );
        })}
      </div>
    </section>
  );
};

// ─── Badges Preview ───────────────────────────────────────────────────────────

const BadgesPreview: React.FC<{ store: MathsLabState }> = ({ store }) => (
  <div className="rounded-3xl border border-slate-700/30 bg-slate-800/30 p-6">
    <div className="flex items-center gap-3 mb-4">
      <div className="rounded-lg bg-amber-500/10 p-2">
        <Medal className="h-4 w-4 text-amber-300" />
      </div>
      <h3 className="font-bold text-white">Badges</h3>
      <span className="ml-auto text-[10px] font-bold text-slate-500 uppercase tracking-widest">
        {store.badges.length}/{badgeDefinitions.length}
      </span>
    </div>
    <div className="flex flex-wrap gap-2.5">
      {badgeDefinitions.slice(0, 10).map((b) => {
        const BadgeIcon = resolveUiIcon(b.icon);
        const isEarned = store.badges.includes(b.id);
        return (
          <div
            key={b.id}
            title={`${b.nom}: ${b.description}`}
            className={`flex h-11 w-11 items-center justify-center rounded-2xl transition-all ${
              isEarned
                ? 'bg-amber-500/20 border border-amber-500/40 text-amber-400 shadow-lg shadow-amber-500/5'
                : 'bg-slate-900/50 border border-slate-800 text-slate-700 grayscale'
            }`}
          >
            <BadgeIcon className="h-5 w-5" />
          </div>
        );
      })}
      {badgeDefinitions.length > 10 && (
        <div className="h-11 w-11 rounded-2xl bg-slate-900/50 border border-slate-800 flex items-center justify-center text-[10px] font-bold text-slate-600">
          +{badgeDefinitions.length - 10}
        </div>
      )}
    </div>
  </div>
);

// ─── Streak Shop ──────────────────────────────────────────────────────────────

const StreakShop: React.FC<{ store: MathsLabState }> = ({ store }) => (
  <div className="rounded-3xl border border-slate-700/30 bg-slate-800/30 p-6">
    <div className="flex items-center gap-3 mb-4">
      <div className="rounded-lg bg-blue-500/10 p-2">
        <Snowflake className="h-4 w-4 text-blue-300" />
      </div>
      <div>
        <h3 className="font-bold text-white">Boutique Série</h3>
        <p className="text-[10px] text-slate-500">{store.streakFreezes} gel(s) disponible(s)</p>
      </div>
    </div>
    <p className="text-xs text-slate-400 mb-4">
      Protège ta série si tu ne peux pas te connecter. Indispensable pour maintenir ton rythme !
    </p>
    <div className="flex items-center justify-between">
      <div className="text-xs text-slate-500">
        Coût : <span className="font-bold text-slate-300">100 XP</span>
        <br />
        <span className="text-[10px]">Solde : {store.totalXP} XP</span>
      </div>
      <button
        onClick={() => store.buyStreakFreeze()}
        disabled={store.totalXP < 100}
        className={`rounded-xl px-5 py-2.5 font-bold text-sm transition-all ${
          store.totalXP >= 100
            ? 'bg-blue-600 text-white hover:bg-blue-500 shadow-lg shadow-blue-600/10'
            : 'bg-slate-800 text-slate-600 border border-slate-700 cursor-not-allowed'
        }`}
      >
        Acheter
      </button>
    </div>
  </div>
);
