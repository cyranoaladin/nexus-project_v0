'use client';

import React, { useState } from 'react';
import { motion } from 'framer-motion';
import { 
  Zap, 
  Trophy, 
  Target, 
  CheckCircle2, 
  Snowflake, 
  Medal, 
  RefreshCw, 
  BookOpen 
} from 'lucide-react';
import { useMathsLabStore } from '../../store';
import { 
  programmeData, 
  dailyChallenges, 
  badgeDefinitions,
  type Categorie 
} from '../../data';
import { resolveUiIcon } from '@/lib/ui-icons';

interface DashboardViewProps {
  onSwitchTab: (tab: 'dashboard' | 'cours' | 'entrainement' | 'formulaire') => void;
}

export const DashboardView: React.FC<DashboardViewProps> = ({ onSwitchTab }) => {
  const store = useMathsLabStore();
  const niveau = store.getNiveau();
  const nextNiveau = store.getNextNiveau();
  const xpProgress = store.getXPProgress();
  
  const totalChapitres = Object.values(programmeData).reduce(
    (acc, cat) => acc + cat.chapitres.length, 
    0
  );
  const progressPct = Math.round((store.completedChapters.length / totalChapitres) * 100);
  const circumference = 52 * 2 * Math.PI;

  // Daily challenge (deterministic from date)
  const todayIndex = new Date().getDate() % dailyChallenges.length;
  const todayChallenge = dailyChallenges[todayIndex];
  const [dcAnswer, setDcAnswer] = useState('');
  const [dcSubmitted, setDcSubmitted] = useState(store.dailyChallenge.completedToday);

  const handleDailySubmit = () => {
    if (!dcAnswer.trim()) return;
    setDcSubmitted(true);
    store.completeDailyChallenge(todayChallenge.id, todayChallenge.xp);
  };

  return (
    <div className="space-y-8">
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* Progress Ring */}
        <div className="lg:col-span-1 bg-slate-800/50 backdrop-blur-xl border border-slate-700/30 rounded-3xl p-6 flex flex-col items-center justify-center">
          <div className="relative w-40 h-40 mb-4">
            <svg className="w-40 h-40" viewBox="0 0 120 120">
              <circle className="text-slate-700" strokeWidth="8" stroke="currentColor" fill="transparent" r="52" cx="60" cy="60" />
              <circle 
                className="text-cyan-400" 
                strokeWidth="8" 
                strokeLinecap="round" 
                stroke="currentColor" 
                fill="transparent" 
                r="52" 
                cx="60" 
                cy="60" 
                strokeDasharray={circumference} 
                strokeDashoffset={circumference * (1 - progressPct / 100)} 
                style={{ transition: 'stroke-dashoffset 0.8s ease-out', transform: 'rotate(-90deg)', transformOrigin: '50% 50%' }} 
              />
            </svg>
            <div className="absolute inset-0 flex items-center justify-center flex-col">
              <span className="text-3xl font-bold text-white tracking-tighter">{progressPct}%</span>
              <span className="text-[10px] text-slate-400 uppercase font-bold tracking-wider">Programme</span>
            </div>
          </div>
          <h3 className="font-bold text-white text-lg">Progression Globale</h3>
          <p className="text-xs text-slate-500 mt-1">{store.completedChapters.length}/{totalChapitres} chapitres complétés</p>
        </div>

        {/* Stats Cards */}
        <div className="lg:col-span-2 grid grid-cols-1 sm:grid-cols-2 gap-4">
          <StatCard
            icon={<Zap className="h-5 w-5" />}
            iconBg="bg-blue-500/20 text-blue-400"
            label="Série actuelle"
            value={`${store.streak}`}
            unit="jours"
            subtitle={
              store.streakFreezes > 0 ? (
                <span className="inline-flex items-center gap-1 text-blue-300">
                  <Snowflake className="h-3 w-3" />
                  {store.streakFreezes} gel(s) dispo
                </span>
              ) : 'Continue comme ça !'
            }
          />

          <StatCard
            icon={<Trophy className="h-5 w-5" />}
            iconBg="bg-amber-500/20 text-amber-400"
            label="Score Total"
            value={`${store.totalXP}`}
            unit="XP"
            subtitle={niveau.nom}
          />

          {/* XP Progress to next level */}
          <div className="bg-slate-800/40 border border-slate-700/30 rounded-2xl p-6 sm:col-span-2">
            <div className="flex justify-between items-center mb-3">
              <h4 className="font-bold text-white text-sm uppercase tracking-wider opacity-60">Vers le niveau suivant</h4>
              {nextNiveau && (
                <span className="text-xs font-bold text-cyan-400">
                  {nextNiveau.nom}
                </span>
              )}
            </div>
            <div className="w-full h-2.5 bg-slate-900 rounded-full overflow-hidden mb-2 border border-slate-700/50">
              <div 
                className="h-full bg-gradient-to-r from-cyan-500 to-blue-600 rounded-full transition-all duration-1000" 
                style={{ width: `${xpProgress.percent}%` }} 
              />
            </div>
            <div className="flex justify-between text-[10px] font-bold text-slate-500 uppercase tracking-widest">
              <span>{store.totalXP} XP</span>
              <span>Encore {xpProgress.nextThreshold - xpProgress.current} XP</span>
            </div>
          </div>
        </div>
      </div>

      {/* Daily Challenge */}
      <div className="bg-gradient-to-br from-blue-900/40 to-slate-900/40 backdrop-blur-md border border-blue-500/20 rounded-3xl p-8 relative overflow-hidden group">
        <div className="absolute top-0 right-0 w-64 h-64 bg-blue-500/5 rounded-full blur-3xl -mr-32 -mt-32 group-hover:bg-blue-500/10 transition-colors duration-500" />
        
        <div className="relative z-10">
          <div className="flex items-center gap-3 mb-4">
            <div className="p-2 bg-blue-500/20 rounded-lg">
              <Target className="h-5 w-5 text-blue-300" />
            </div>
            <h3 className="font-bold text-white text-xl">Défi du jour</h3>
            <span className="ml-auto text-xs bg-blue-500/20 text-blue-300 px-3 py-1 rounded-full font-bold border border-blue-500/30">
              +{todayChallenge.xp} XP
            </span>
          </div>
          
          <p className="text-slate-200 text-lg mb-6 leading-relaxed max-w-2xl">
            {todayChallenge.question}
          </p>

          {dcSubmitted ? (
            <div className="bg-green-500/10 border border-green-500/20 rounded-2xl p-4 flex items-center gap-3">
              <div className="w-10 h-10 rounded-full bg-green-500/20 flex items-center justify-center">
                <CheckCircle2 className="h-6 w-6 text-green-400" />
              </div>
              <div>
                <p className="text-green-400 font-bold">Défi complété !</p>
                <p className="text-slate-400 text-sm">Réponse : {todayChallenge.reponse}</p>
              </div>
            </div>
          ) : (
            <div className="flex flex-col sm:flex-row gap-3">
              <input 
                type="text" 
                value={dcAnswer} 
                onChange={(e) => setDcAnswer(e.target.value)} 
                onKeyDown={(e) => e.key === 'Enter' && handleDailySubmit()} 
                placeholder="Ta réponse..." 
                className="flex-1 bg-slate-900/80 border border-slate-700 rounded-2xl px-6 py-4 text-white font-mono focus:border-blue-500 focus:outline-none focus:ring-1 focus:ring-blue-500/50 transition-all" 
              />
              <button 
                onClick={handleDailySubmit} 
                className="bg-blue-600 text-white font-bold py-4 px-8 rounded-2xl hover:bg-blue-500 transition-all shadow-lg shadow-blue-600/20 active:scale-95"
              >
                Valider
              </button>
            </div>
          )}
        </div>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
        {/* Streak Freeze & Shop */}
        <div className="bg-slate-800/40 border border-slate-700/30 rounded-3xl p-6">
          <div className="flex items-center gap-3 mb-4">
            <div className="p-2 bg-blue-500/10 rounded-lg">
              <Snowflake className="h-5 w-5 text-blue-300" />
            </div>
            <h3 className="font-bold text-white">Boutique de Série</h3>
          </div>
          <p className="text-sm text-slate-400 mb-6">Protège ta série si tu ne peux pas te connecter un jour. Indispensable pour garder ton élan !</p>
          <div className="flex items-center justify-between">
            <div className="text-xs text-slate-500">
              Coût : <span className="font-bold text-slate-300">100 XP</span>
            </div>
            <button
              onClick={() => store.buyStreakFreeze()}
              disabled={store.totalXP < 100}
              className={`px-6 py-2.5 rounded-xl font-bold transition-all text-sm ${
                store.totalXP >= 100
                ? 'bg-blue-600 text-white hover:bg-blue-500 shadow-lg shadow-blue-600/10'
                : 'bg-slate-800 text-slate-600 border border-slate-700 cursor-not-allowed'
              }`}
            >
              Acheter un gel
            </button>
          </div>
        </div>

        {/* Badges Preview */}
        <div className="bg-slate-800/40 border border-slate-700/30 rounded-3xl p-6">
          <div className="flex items-center gap-3 mb-4">
            <div className="p-2 bg-amber-500/10 rounded-lg">
              <Medal className="h-5 w-5 text-amber-300" />
            </div>
            <h3 className="font-bold text-white">Tes Badges</h3>
            <span className="text-[10px] font-bold text-slate-500 ml-auto uppercase tracking-widest">
              {store.badges.length} / {badgeDefinitions.length}
            </span>
          </div>
          <div className="flex flex-wrap gap-3">
            {badgeDefinitions.slice(0, 10).map((b) => {
              const BadgeIcon = resolveUiIcon(b.icon);
              const isEarned = store.badges.includes(b.id);
              return (
                <div
                  key={b.id}
                  className={`flex h-12 w-12 items-center justify-center rounded-2xl transition-all duration-500 ${
                    isEarned
                    ? 'bg-amber-500/20 border border-amber-500/40 text-amber-400 shadow-lg shadow-amber-500/5'
                    : 'bg-slate-900/50 border border-slate-800 text-slate-700 grayscale'
                  }`}
                  title={`${b.nom}: ${b.description}`}
                >
                  <BadgeIcon className="h-6 w-6" />
                </div>
              );
            })}
            {badgeDefinitions.length > 10 && (
              <div className="h-12 w-12 rounded-2xl bg-slate-900/50 border border-slate-800 flex items-center justify-center text-[10px] font-bold text-slate-600">
                +{badgeDefinitions.length - 10}
              </div>
            )}
          </div>
        </div>
      </div>

      {/* SRS Due Reviews */}
      {store.getDueReviews().length > 0 && (
        <div className="bg-slate-800/40 border border-cyan-500/20 rounded-3xl p-6">
          <div className="flex items-center gap-3 mb-4">
            <div className="p-2 bg-cyan-500/10 rounded-lg">
              <RefreshCw className="h-5 w-5 text-cyan-300 animate-spin-slow" />
            </div>
            <h3 className="font-bold text-white">Révisions recommandées (SRS)</h3>
          </div>
          <div className="flex flex-wrap gap-2">
            {store.getDueReviews().map((chapId) => {
              let chapTitle = chapId;
              for (const cat of Object.values(programmeData)) {
                const found = cat.chapitres.find((c) => c.id === chapId);
                if (found) { chapTitle = found.titre; break; }
              }
              return (
                <button
                  key={chapId}
                  onClick={() => onSwitchTab('cours')}
                  className="inline-flex items-center gap-2 text-xs px-4 py-2.5 rounded-xl bg-cyan-500/10 text-cyan-300 border border-cyan-500/20 hover:bg-cyan-500/20 transition-all font-bold"
                >
                  <BookOpen className="h-4 w-4" />
                  {chapTitle}
                </button>
              );
            })}
          </div>
        </div>
      )}

      {/* Theme Overview */}
      <div className="pt-4">
        <h3 className="text-xl font-bold text-white mb-6 flex items-center gap-3">
          <div className="w-1.5 h-6 bg-cyan-500 rounded-full" />
          Thèmes du programme
        </h3>
        <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-5 gap-4">
          {Object.entries(programmeData).map(([key, cat]) => (
            <ThemeCard 
              key={key} 
              cat={cat} 
              completedCount={cat.chapitres.filter((c) => store.completedChapters.includes(c.id)).length} 
            />
          ))}
        </div>
      </div>
    </div>
  );
};

const StatCard = ({ icon, iconBg, label, value, unit, subtitle }: any) => (
  <div className="bg-slate-800/40 border border-slate-700/30 rounded-2xl p-6 transition-all hover:bg-slate-800/60 group">
    <div className="flex justify-between items-start mb-4">
      <div className={`p-2.5 rounded-xl ${iconBg} group-hover:scale-110 transition-transform`}>{icon}</div>
      <span className="text-[10px] font-bold text-slate-500 uppercase tracking-widest">{label}</span>
    </div>
    <div className="text-3xl font-bold text-white mb-1 tracking-tight">
      {value} <span className="text-sm font-medium text-slate-500 ml-1">{unit}</span>
    </div>
    <div className="text-xs font-medium text-slate-400">{subtitle}</div>
  </div>
);

const ThemeCard = ({ cat, completedCount }: { cat: Categorie; completedCount: number }) => {
  const ThemeIcon = resolveUiIcon(cat.icon);
  const progress = cat.chapitres.length > 0 ? (completedCount / cat.chapitres.length) * 100 : 0;
  
  return (
    <div className="bg-slate-800/30 border border-slate-700/20 p-5 rounded-2xl hover:border-slate-500/30 transition-all group">
      <div className="mb-4">
        <div className={`w-10 h-10 rounded-xl flex items-center justify-center transition-colors ${
          cat.couleur === 'cyan' ? 'bg-cyan-500/10 text-cyan-400' :
          cat.couleur === 'blue' ? 'bg-blue-500/10 text-blue-400' :
          cat.couleur === 'purple' ? 'bg-purple-500/10 text-purple-400' :
          cat.couleur === 'amber' ? 'bg-amber-500/10 text-amber-400' :
          'bg-green-500/10 text-green-400'
        }`}>
          <ThemeIcon className="h-6 w-6" />
        </div>
      </div>
      <div className="font-bold text-white text-sm mb-1 group-hover:text-cyan-400 transition-colors">{cat.titre}</div>
      <div className="text-[10px] text-slate-500 font-bold uppercase tracking-wider mb-3">
        {completedCount} / {cat.chapitres.length} chapitres
      </div>
      <div className="w-full h-1.5 bg-slate-900 rounded-full overflow-hidden border border-white/5">
        <div 
          className={`h-full rounded-full transition-all duration-1000 ${
            cat.couleur === 'cyan' ? 'bg-cyan-500' :
            cat.couleur === 'blue' ? 'bg-blue-500' :
            cat.couleur === 'purple' ? 'bg-purple-500' :
            cat.couleur === 'amber' ? 'bg-amber-500' :
            'bg-green-500'
          }`} 
          style={{ width: `${progress}%` }} 
        />
      </div>
    </div>
  );
};
