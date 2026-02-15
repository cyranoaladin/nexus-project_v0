'use client';

import { useState, useCallback, useEffect } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import {
  programmeData,
  quizData,
  dailyChallenges,
  badgeDefinitions,
  type Categorie,
  type QuizQuestion,
} from '../data';
import { useMathsLabStore } from '../store';
import { useMathJax } from './MathJaxProvider';
import ExerciseEngine from './ExerciseEngine';
import InteractiveGraph from './InteractiveGraph';
import SkillTree from './SkillTree';
import dynamic from 'next/dynamic';

const PythonIDE = dynamic(() => import('./PythonIDE'), { ssr: false });
const InteractiveMafs = dynamic(() => import('./InteractiveMafs'), { ssr: false });
const MathInput = dynamic(() => import('./MathInput'), { ssr: false });
const ParabolaController = dynamic(() => import('./labs/ParabolaController'), { ssr: false });
const TangenteGlissante = dynamic(() => import('./labs/TangenteGlissante'), { ssr: false });
const MonteCarloSim = dynamic(() => import('./labs/MonteCarloSim'), { ssr: false });
const PythonExercises = dynamic(() => import('./labs/PythonExercises'), { ssr: false });
const ToileAraignee = dynamic(() => import('./labs/ToileAraignee'), { ssr: false });
const Enrouleur = dynamic(() => import('./labs/Enrouleur'), { ssr: false });

// ─── Framer Motion variants ─────────────────────────────────────────────────
const pageVariants = {
  initial: { opacity: 0, y: 12 },
  animate: { opacity: 1, y: 0 },
  exit: { opacity: 0, y: -12 },
};

const cardVariants = {
  initial: { opacity: 0, scale: 0.96 },
  animate: { opacity: 1, scale: 1 },
  exit: { opacity: 0, scale: 0.96 },
};

// ─── Tab types ───────────────────────────────────────────────────────────────
type TabName = 'dashboard' | 'cours' | 'entrainement';

// ─── Color helpers ──────────────────────────────────────────────────────────
function getColorClasses(couleur: string) {
  switch (couleur) {
    case 'cyan': return { text: 'text-cyan-400', bg: 'bg-cyan-500/20', border: 'border-t-cyan-500', borderAccent: 'border-cyan-500/30' };
    case 'blue': return { text: 'text-blue-400', bg: 'bg-blue-500/20', border: 'border-t-blue-500', borderAccent: 'border-blue-500/30' };
    case 'purple': return { text: 'text-purple-400', bg: 'bg-purple-500/20', border: 'border-t-purple-500', borderAccent: 'border-purple-500/30' };
    case 'amber': return { text: 'text-amber-400', bg: 'bg-amber-500/20', border: 'border-t-amber-500', borderAccent: 'border-amber-500/30' };
    case 'green': return { text: 'text-green-400', bg: 'bg-green-500/20', border: 'border-t-green-500', borderAccent: 'border-green-500/30' };
    default: return { text: 'text-cyan-400', bg: 'bg-cyan-500/20', border: 'border-t-cyan-500', borderAccent: 'border-cyan-500/30' };
  }
}

// ─── Main Component ──────────────────────────────────────────────────────────
export default function MathsRevisionClient() {
  const [currentTab, setCurrentTab] = useState<TabName>('dashboard');
  const [selectedChapter, setSelectedChapter] = useState<{
    catKey: string;
    chapId: string;
  } | null>(null);
  const [focusMode, setFocusMode] = useState(false);

  const store = useMathsLabStore();
  const typeset = useMathJax([currentTab, selectedChapter]);

  const [isMounted, setIsMounted] = useState(false);

  // Record activity + evaluate badges on mount
  useEffect(() => {
    setIsMounted(true);
    store.recordActivity();
    store.evaluateBadges();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // Re-evaluate badges after any state change
  useEffect(() => {
    const unsub = useMathsLabStore.subscribe(() => {
      // Debounce badge evaluation
      const timer = setTimeout(() => {
        useMathsLabStore.getState().evaluateBadges();
      }, 300);
      return () => clearTimeout(timer);
    });
    return unsub;
  }, []);

  const switchTab = useCallback((tab: TabName) => {
    setCurrentTab(tab);
    setSelectedChapter(null);
    setFocusMode(false);
  }, []);

  if (!isMounted) {
    return (
      <div className="min-h-screen bg-[#0f172a] flex items-center justify-center text-slate-400 font-medium">
        Chargement du Nexus...
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-[#0f172a] text-slate-200 selection:bg-cyan-500/30 overflow-x-hidden">
      {/* ─── Navbar ─────────────────────────────────────────────────────── */}
      {!focusMode && <Navbar />}

      <div className={`${focusMode ? 'pt-4' : 'pt-24'} pb-12 max-w-7xl mx-auto px-4 sm:px-6 lg:px-8`}>
        {/* ─── Header ───────────────────────────────────────────────────── */}
        {!focusMode && <Header />}

        {/* ─── Tab Bar ──────────────────────────────────────────────────── */}
        {!focusMode && <TabBar currentTab={currentTab} onSwitch={switchTab} />}

        {/* ─── Focus Mode Toggle ──────────────────────────────────────── */}
        {focusMode && (
          <button
            onClick={() => setFocusMode(false)}
            className="mb-4 text-sm text-slate-500 hover:text-white flex items-center gap-1 transition-colors"
          >
            ← Quitter le mode focus
          </button>
        )}

        {/* ─── Content ──────────────────────────────────────────────────── */}
        <main className="min-h-[600px]">
          <AnimatePresence mode="wait">
            {currentTab === 'dashboard' && (
              <motion.div
                key="dashboard"
                variants={pageVariants}
                initial="initial"
                animate="animate"
                exit="exit"
                transition={{ duration: 0.25 }}
              >
                <Dashboard onSwitchTab={switchTab} />
              </motion.div>
            )}
            {currentTab === 'cours' && (
              <motion.div
                key="cours"
                variants={pageVariants}
                initial="initial"
                animate="animate"
                exit="exit"
                transition={{ duration: 0.25 }}
              >
                <CoursView
                  selectedChapter={selectedChapter}
                  onSelectChapter={setSelectedChapter}
                  typeset={typeset}
                  focusMode={focusMode}
                  onToggleFocus={() => setFocusMode(!focusMode)}
                />
              </motion.div>
            )}
            {currentTab === 'entrainement' && (
              <motion.div
                key="entrainement"
                variants={pageVariants}
                initial="initial"
                animate="animate"
                exit="exit"
                transition={{ duration: 0.25 }}
              >
                <QuizView
                  onSwitchTab={switchTab}
                  typeset={typeset}
                />
              </motion.div>
            )}
          </AnimatePresence>
        </main>
      </div>
    </div>
  );
}

// ─── Navbar ──────────────────────────────────────────────────────────────────
function Navbar() {
  const [dateStr, setDateStr] = useState('');
  const store = useMathsLabStore();
  const niveau = store.getNiveau();
  const xpProgress = store.getXPProgress();

  useEffect(() => {
    const options: Intl.DateTimeFormatOptions = { weekday: 'long', year: 'numeric', month: 'long', day: 'numeric' };
    setDateStr(new Date().toLocaleDateString('fr-FR', options));
  }, []);

  return (
    <nav className="fixed top-0 w-full z-50 bg-slate-800/70 backdrop-blur-xl border-b border-slate-700/30">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
        <div className="flex justify-between h-16 items-center">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 bg-gradient-to-br from-cyan-400 to-blue-600 rounded-xl flex items-center justify-center font-bold text-white text-xl shadow-lg shadow-cyan-500/20">
              N
            </div>
            <div>
              <span className="font-bold text-xl tracking-tight text-white" style={{ fontFamily: 'var(--font-space), Space Grotesk, sans-serif' }}>
                NEXUS MATHS LAB
              </span>
              <div className="text-[10px] text-cyan-400 font-medium uppercase tracking-wider">
                Programme Officiel 2025-2026
              </div>
            </div>
          </div>
          <div className="hidden md:flex items-center gap-4">
            {/* XP Badge */}
            <div className="flex items-center gap-2 bg-slate-800/50 px-3 py-1.5 rounded-full border border-slate-700">
              <span className="text-lg">{niveau.badge}</span>
              <div>
                <div className="text-xs font-bold text-white">{niveau.nom}</div>
                <div className="w-20 h-1.5 bg-slate-700 rounded-full overflow-hidden">
                  <div className="h-full bg-gradient-to-r from-cyan-400 to-blue-500 rounded-full transition-all duration-500" style={{ width: `${xpProgress.percent}%` }} />
                </div>
              </div>
              <span className="text-xs text-cyan-400 font-bold">{store.totalXP} XP</span>
            </div>
            {/* Combo */}
            {store.comboCount >= 3 && (
              <div className="flex items-center gap-1 bg-purple-500/10 px-3 py-1.5 rounded-full border border-purple-500/30">
                <span className="text-sm">⚡</span>
                <span className="text-xs font-bold text-purple-400">x{store.getComboMultiplier()}</span>
              </div>
            )}
            {/* Streak */}
            {store.streak > 0 && (
              <div className="flex items-center gap-1 bg-amber-500/10 px-3 py-1.5 rounded-full border border-amber-500/30">
                <span className="text-sm">🔥</span>
                <span className="text-xs font-bold text-amber-400">{store.streak}j</span>
                {store.streakFreezes > 0 && <span className="text-[10px] text-blue-400">❄️{store.streakFreezes}</span>}
              </div>
            )}
            {/* Date */}
            <div className="flex items-center gap-2 bg-slate-800/50 px-4 py-2 rounded-full border border-slate-700">
              <div className="w-2 h-2 bg-green-400 rounded-full animate-pulse" />
              <span className="text-sm font-medium text-slate-300">{dateStr}</span>
            </div>
          </div>
        </div>
      </div>
    </nav>
  );
}

// ─── Header ──────────────────────────────────────────────────────────────────
function Header() {
  const [greeting, setGreeting] = useState('Bonjour');
  const store = useMathsLabStore();
  const niveau = store.getNiveau();

  useEffect(() => {
    const h = new Date().getHours();
    if (h < 12) setGreeting('Bonjour');
    else if (h < 18) setGreeting('Bon après-midi');
    else setGreeting('Bonsoir');
  }, []);

  return (
    <header className="mb-10">
      <div className="bg-slate-800/70 backdrop-blur-xl border border-slate-700/10 rounded-3xl p-8 relative overflow-hidden">
        <div className="absolute top-0 right-0 w-64 h-64 bg-cyan-500/10 rounded-full blur-3xl -mr-20 -mt-20" />
        <div className="relative z-10">
          <div className="flex flex-col md:flex-row justify-between items-start md:items-center gap-4">
            <div>
              <h1 className="text-4xl md:text-5xl font-bold mb-2 text-white" style={{ fontFamily: 'var(--font-space), Space Grotesk, sans-serif' }}>
                {greeting},{' '}
                <span className="bg-gradient-to-r from-cyan-400 to-indigo-400 bg-clip-text text-transparent">
                  {niveau.nom} {niveau.badge}
                </span>
              </h1>
              <p className="text-slate-400 text-lg max-w-2xl">
                Ton Learning Lab interactif pour la spécialité Mathématiques (4h/semaine).
              </p>
            </div>
            <div className="hidden md:block text-right">
              <div className="text-sm font-bold text-white">Niveau Première</div>
              <div className="text-xs text-cyan-400">EDS Mathématiques</div>
            </div>
          </div>
        </div>
      </div>
    </header>
  );
}

// ─── Tab Bar ─────────────────────────────────────────────────────────────────
const tabs: { id: TabName; label: string; icon: React.ReactNode }[] = [
  { id: 'dashboard', label: 'Tableau de bord', icon: <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 6a2 2 0 012-2h2a2 2 0 012 2v2a2 2 0 01-2 2H6a2 2 0 01-2-2V6zM14 6a2 2 0 012-2h2a2 2 0 012 2v2a2 2 0 01-2 2h-2a2 2 0 01-2-2V6zM4 16a2 2 0 012-2h2a2 2 0 012 2v2a2 2 0 01-2 2H6a2 2 0 01-2-2v-2zM14 16a2 2 0 012-2h2a2 2 0 012 2v2a2 2 0 01-2 2h-2a2 2 0 01-2-2v-2z" /></svg> },
  { id: 'cours', label: 'Fiches de Cours', icon: <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 6.253v13m0-13C10.832 5.477 9.246 5 7.5 5S4.168 5.477 3 6.253v13C4.168 18.477 5.754 18 7.5 18s3.332.477 4.5 1.253m0-13C13.168 5.477 14.754 5 16.5 5c1.747 0 3.332.477 4.5 1.253v13C19.832 18.477 18.247 18 16.5 18c-1.746 0-3.332.477-4.5 1.253" /></svg> },
  { id: 'entrainement', label: 'Quiz & Exos', icon: <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5H7a2 2 0 00-2 2v12a2 2 0 002 2h10a2 2 0 002-2V7a2 2 0 00-2-2h-2M9 5a2 2 0 002 2h2a2 2 0 002-2M9 5a2 2 0 012-2h2a2 2 0 012 2m-3 7h3m-3 4h3m-6-4h.01M9 16h.01" /></svg> },
];

function TabBar({ currentTab, onSwitch }: { currentTab: TabName; onSwitch: (tab: TabName) => void }) {
  return (
    <div className="flex overflow-x-auto gap-2 mb-8 p-1 bg-slate-800/40 rounded-2xl border border-slate-700/30 w-full md:w-fit mx-auto md:mx-0">
      {tabs.map((tab) => (
        <button key={tab.id} onClick={() => onSwitch(tab.id)} className={`px-6 py-3 rounded-xl font-medium transition-all flex items-center gap-2 whitespace-nowrap ${currentTab === tab.id ? 'bg-cyan-500/10 border border-cyan-500/30 text-cyan-400' : 'text-slate-400 hover:text-white border border-transparent'}`}>
          {tab.icon}
          {tab.label}
        </button>
      ))}
    </div>
  );
}

// ─── Dashboard ───────────────────────────────────────────────────────────────
function Dashboard({ onSwitchTab }: { onSwitchTab: (tab: TabName) => void }) {
  const store = useMathsLabStore();
  const niveau = store.getNiveau();
  const nextNiveau = store.getNextNiveau();
  const xpProgress = store.getXPProgress();
  const totalChapitres = Object.values(programmeData).reduce((acc, cat) => acc + cat.chapitres.length, 0);
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
    <>
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6 mb-8">
        {/* Progress Ring */}
        <div className="lg:col-span-1 bg-slate-800/70 backdrop-blur-xl border border-slate-700/10 rounded-3xl p-6 flex flex-col items-center justify-center">
          <div className="relative w-40 h-40 mb-4">
            <svg className="w-40 h-40" viewBox="0 0 120 120">
              <circle className="text-slate-700" strokeWidth="8" stroke="currentColor" fill="transparent" r="52" cx="60" cy="60" />
              <circle className="text-cyan-400" strokeWidth="8" strokeLinecap="round" stroke="currentColor" fill="transparent" r="52" cx="60" cy="60" strokeDasharray={circumference} strokeDashoffset={circumference * (1 - progressPct / 100)} style={{ transition: 'stroke-dashoffset 0.35s', transform: 'rotate(-90deg)', transformOrigin: '50% 50%' }} />
            </svg>
            <div className="absolute inset-0 flex items-center justify-center flex-col">
              <span className="text-3xl font-bold text-white" style={{ fontFamily: 'var(--font-space), Space Grotesk, sans-serif' }}>{progressPct}%</span>
              <span className="text-xs text-slate-400">du programme</span>
            </div>
          </div>
          <h3 className="font-bold text-white text-lg">Progression Globale</h3>
          <p className="text-xs text-slate-500 mt-1">{store.completedChapters.length}/{totalChapitres} chapitres</p>
        </div>

        {/* Stats Cards */}
        <div className="lg:col-span-2 grid grid-cols-1 sm:grid-cols-2 gap-4">
          <StatCard icon="⚡" iconBg="bg-blue-500/20 text-blue-400" label="Série" value={`${store.streak}`} unit="jours" subtitle={store.streakFreezes > 0 ? `❄️ ${store.streakFreezes} gel(s)` : 'Consécutifs'} />
          <StatCard icon="🏆" iconBg="bg-purple-500/20 text-purple-400" label="XP Total" value={`${store.totalXP}`} unit="XP" subtitle={`${niveau.badge} ${niveau.nom}`} />

          {/* XP Progress to next level */}
          <div className="bg-gradient-to-br from-slate-800 to-slate-900 border border-cyan-500/10 rounded-2xl p-6 sm:col-span-2">
            <div className="flex justify-between items-center mb-2">
              <h4 className="font-bold text-white text-sm">Progression vers le niveau suivant</h4>
              {nextNiveau && <span className="text-xs text-slate-400">{nextNiveau.badge} {nextNiveau.nom}</span>}
            </div>
            <div className="w-full h-3 bg-slate-700 rounded-full overflow-hidden mb-2">
              <div className="h-full bg-gradient-to-r from-cyan-400 to-indigo-500 rounded-full transition-all duration-700" style={{ width: `${xpProgress.percent}%` }} />
            </div>
            <p className="text-xs text-slate-500">{xpProgress.current} / {xpProgress.nextThreshold} XP</p>
          </div>
        </div>
      </div>

      {/* Daily Challenge */}
      <div className="bg-gradient-to-br from-amber-900/20 to-slate-900 border border-amber-500/20 rounded-2xl p-6 mb-8">
        <div className="flex items-center gap-2 mb-3">
          <span className="text-xl">🎯</span>
          <h3 className="font-bold text-amber-300">Défi du jour</h3>
          <span className="text-xs bg-amber-500/20 text-amber-400 px-2 py-0.5 rounded-full font-bold">+{todayChallenge.xp} XP</span>
        </div>
        <p className="text-white font-medium mb-3">{todayChallenge.question}</p>
        {dcSubmitted ? (
          <div className="bg-green-500/10 border border-green-500/30 rounded-xl p-3">
            <p className="text-green-400 font-bold text-sm">✓ Défi complété ! Réponse : {todayChallenge.reponse}</p>
          </div>
        ) : (
          <div className="flex gap-3">
            <input type="text" value={dcAnswer} onChange={(e) => setDcAnswer(e.target.value)} onKeyDown={(e) => e.key === 'Enter' && handleDailySubmit()} placeholder="Ta réponse..." className="flex-1 bg-slate-900 border border-slate-700 rounded-xl px-4 py-2 text-white font-mono focus:border-amber-500 focus:outline-none text-sm" />
            <button onClick={handleDailySubmit} className="bg-amber-600 text-white font-bold py-2 px-5 rounded-xl hover:bg-amber-500 text-sm">Valider</button>
          </div>
        )}
      </div>

      {/* Streak Freeze + Badges */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-4 mb-8">
        {/* Streak Freeze Shop */}
        <div className="bg-slate-800/70 border border-blue-500/20 rounded-2xl p-5">
          <div className="flex items-center gap-2 mb-2">
            <span className="text-xl">❄️</span>
            <h3 className="font-bold text-blue-300 text-sm">Gel de Série</h3>
          </div>
          <p className="text-xs text-slate-400 mb-3">Protège ta série si tu rates un jour. Coût : 100 XP.</p>
          <div className="flex items-center gap-3">
            <button
              onClick={() => store.buyStreakFreeze()}
              disabled={store.totalXP < 100}
              className={`text-xs font-bold px-4 py-2 rounded-lg transition-all ${store.totalXP >= 100
                ? 'bg-blue-600 text-white hover:bg-blue-500'
                : 'bg-slate-700 text-slate-500 cursor-not-allowed'
                }`}
            >
              Acheter (100 XP)
            </button>
            <span className="text-xs text-slate-500">En stock : {store.streakFreezes}</span>
          </div>
        </div>

        {/* Badges */}
        <div className="bg-slate-800/70 border border-amber-500/20 rounded-2xl p-5">
          <div className="flex items-center gap-2 mb-2">
            <span className="text-xl">🏅</span>
            <h3 className="font-bold text-amber-300 text-sm">Badges ({store.badges.length}/{badgeDefinitions.length})</h3>
          </div>
          <div className="flex flex-wrap gap-2">
            {badgeDefinitions.map((b) => (
              <div
                key={b.id}
                className={`text-lg p-1.5 rounded-lg transition-all ${store.badges.includes(b.id)
                  ? 'bg-amber-500/20 border border-amber-500/30'
                  : 'bg-slate-900/50 border border-slate-700 opacity-30 grayscale'
                  }`}
                title={`${b.nom}: ${b.description}`}
              >
                {b.icon}
              </div>
            ))}
          </div>
        </div>
      </div>

      {/* SRS Due Reviews */}
      {store.getDueReviews().length > 0 && (
        <div className="bg-gradient-to-br from-indigo-900/20 to-slate-900 border border-indigo-500/20 rounded-2xl p-5 mb-8">
          <div className="flex items-center gap-2 mb-3">
            <span className="text-xl">🔄</span>
            <h3 className="font-bold text-indigo-300 text-sm">Révisions du jour (SRS)</h3>
            <span className="text-xs bg-indigo-500/20 text-indigo-400 px-2 py-0.5 rounded-full font-bold">
              {store.getDueReviews().length} chapitre(s)
            </span>
          </div>
          <div className="flex flex-wrap gap-2">
            {store.getDueReviews().map((chapId) => {
              // Find chapter title
              let chapTitle = chapId;
              for (const cat of Object.values(programmeData)) {
                const found = cat.chapitres.find((c) => c.id === chapId);
                if (found) {
                  chapTitle = found.titre;
                  break;
                }
              }
              return (
                <motion.button
                  key={chapId}
                  whileHover={{ scale: 1.02 }}
                  whileTap={{ scale: 0.98 }}
                  onClick={() => {
                    onSwitchTab('cours');
                  }}
                  className="text-xs px-3 py-2 rounded-lg bg-indigo-500/10 text-indigo-300 border border-indigo-500/20 hover:bg-indigo-500/20 transition-all font-medium"
                >
                  📖 {chapTitle}
                </motion.button>
              );
            })}
          </div>
        </div>
      )}

      {/* Theme Overview */}
      <h3 className="text-xl font-bold text-white mb-4">Vue d&apos;ensemble des thèmes</h3>
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-5 gap-4">
        {Object.entries(programmeData).map(([key, cat]) => (
          <motion.div key={key} whileHover={{ y: -2 }} transition={{ duration: 0.15 }}>
            <ThemeCard cat={cat} completedCount={cat.chapitres.filter((c) => store.completedChapters.includes(c.id)).length} />
          </motion.div>
        ))}
      </div>
    </>
  );
}

function StatCard({ icon, iconBg, label, value, unit, subtitle }: { icon: string; iconBg: string; label: string; value: string; unit: string; subtitle: string }) {
  return (
    <div className="bg-gradient-to-br from-slate-800 to-slate-900 border border-cyan-500/10 rounded-2xl p-6 transition-all hover:border-cyan-500/30 hover:-translate-y-0.5">
      <div className="flex justify-between items-start mb-2">
        <div className={`p-2 rounded-lg ${iconBg}`}>{icon}</div>
        <span className="text-xs font-bold text-slate-500 uppercase">{label}</span>
      </div>
      <div className="text-3xl font-bold text-white mb-1" style={{ fontFamily: 'var(--font-space), Space Grotesk, sans-serif' }}>
        {value} <span className="text-lg text-slate-500">{unit}</span>
      </div>
      <div className="text-sm text-slate-400">{subtitle}</div>
    </div>
  );
}

function ThemeCard({ cat, completedCount }: { cat: Categorie; completedCount: number }) {
  const colors = getColorClasses(cat.couleur);
  return (
    <div className={`bg-slate-800/70 backdrop-blur-xl border border-slate-700/10 p-4 rounded-xl border-t-2 ${colors.border}`}>
      <div className="text-2xl mb-2">{cat.icon}</div>
      <div className="font-bold text-white text-sm">{cat.titre}</div>
      <div className="text-xs text-slate-400 mt-1">{completedCount}/{cat.chapitres.length} chapitres</div>
      <div className="w-full h-1 bg-slate-700 rounded-full mt-2 overflow-hidden">
        <div className={`h-full rounded-full transition-all ${cat.couleur === 'cyan' ? 'bg-cyan-500' : cat.couleur === 'blue' ? 'bg-blue-500' : cat.couleur === 'purple' ? 'bg-purple-500' : cat.couleur === 'amber' ? 'bg-amber-500' : 'bg-green-500'}`} style={{ width: `${cat.chapitres.length > 0 ? (completedCount / cat.chapitres.length) * 100 : 0}%` }} />
      </div>
    </div>
  );
}

// ─── Cours View ──────────────────────────────────────────────────────────────
function CoursView({ selectedChapter, onSelectChapter, typeset, focusMode, onToggleFocus }: {
  selectedChapter: { catKey: string; chapId: string } | null;
  onSelectChapter: (ch: { catKey: string; chapId: string }) => void;
  typeset: () => void;
  focusMode: boolean;
  onToggleFocus: () => void;
}) {
  return (
    <div className={`grid grid-cols-1 ${focusMode ? '' : 'lg:grid-cols-12'} gap-6 h-full`}>
      {/* Skill Tree Sidebar (35% per CdC §3.1) */}
      {!focusMode && (
        <div className="lg:col-span-4 bg-slate-800/70 backdrop-blur-xl border border-slate-700/10 rounded-2xl p-4 max-h-[80vh] overflow-y-auto">
          <SkillTree
            onSelectChapter={onSelectChapter}
            selectedChapterId={selectedChapter?.chapId}
          />
        </div>
      )}

      {/* Chapter Viewer */}
      {/* Lab Content (65% per CdC §3.1) */}
      <div className={focusMode ? 'w-full' : 'lg:col-span-8'}>
        <AnimatePresence mode="wait">
          {selectedChapter ? (
            <motion.div
              key={selectedChapter.chapId}
              variants={cardVariants}
              initial="initial"
              animate="animate"
              exit="exit"
              transition={{ duration: 0.2 }}
            >
              <ChapterViewer catKey={selectedChapter.catKey} chapId={selectedChapter.chapId} typeset={typeset} onToggleFocus={onToggleFocus} focusMode={focusMode} />
            </motion.div>
          ) : (
            <motion.div
              key="empty"
              variants={cardVariants}
              initial="initial"
              animate="animate"
              className="bg-slate-800/70 backdrop-blur-xl border border-slate-700/10 rounded-3xl p-12 text-center h-full flex flex-col items-center justify-center text-slate-500 min-h-[400px]"
            >
              <div className="text-6xl mb-4 opacity-50">📚</div>
              <h3 className="text-xl font-bold text-slate-300 mb-2">Sélectionnez une fiche</h3>
              <p>Cliquez sur un chapitre dans l&apos;arbre de compétences pour commencer.</p>
            </motion.div>
          )}
        </AnimatePresence>
      </div>
    </div>
  );
}

// ─── Chapter Viewer ──────────────────────────────────────────────────────────
function ChapterViewer({ catKey, chapId, typeset, onToggleFocus, focusMode }: {
  catKey: string; chapId: string; typeset: () => void; onToggleFocus: () => void; focusMode: boolean;
}) {
  const [hintLevel, setHintLevel] = useState(0); // 0=none, 1=indice, 2=début, 3=correction
  const [showSolution, setShowSolution] = useState(false);
  const store = useMathsLabStore();
  const cat = programmeData[catKey];
  const chap = cat?.chapitres.find((c) => c.id === chapId);
  const isCompleted = store.completedChapters.includes(chapId);

  useEffect(() => {
    setShowSolution(false);
    setHintLevel(0);
    const timer = setTimeout(typeset, 200);
    return () => clearTimeout(timer);
  }, [chapId, typeset]);

  useEffect(() => {
    if (showSolution || hintLevel > 0) {
      const timer = setTimeout(typeset, 100);
      return () => clearTimeout(timer);
    }
  }, [showSolution, hintLevel, typeset]);

  if (!cat || !chap) return null;

  const colors = getColorClasses(cat.couleur);

  return (
    <div className="bg-slate-800/70 backdrop-blur-xl border border-slate-700/10 rounded-3xl p-8 relative overflow-hidden">
      <div className="absolute top-0 right-0 p-8 opacity-10 text-9xl select-none pointer-events-none">{cat.icon}</div>

      <div className="flex justify-between items-start mb-6 relative z-10 flex-wrap gap-2">
        <div>
          <div className="flex items-center gap-2 mb-2 flex-wrap">
            <span className={`px-3 py-1 rounded-full text-xs font-bold ${colors.bg} ${colors.text}`}>{cat.titre}</span>
            <span className="px-2 py-0.5 rounded-full text-[10px] font-bold bg-slate-700 text-slate-400">Difficulté {chap.difficulte}/5</span>
            <span className="px-2 py-0.5 rounded-full text-[10px] font-bold bg-cyan-500/10 text-cyan-400">{chap.pointsXP} XP</span>
          </div>
          <h2 className="text-3xl font-bold text-white" style={{ fontFamily: 'var(--font-space), Space Grotesk, sans-serif' }}>{chap.titre}</h2>
          {/* B.O. Competences (CdC §1.2) */}
          {chap.competences && chap.competences.length > 0 && (
            <div className="flex flex-wrap gap-1.5 mt-2">
              {chap.competences.map((c) => {
                const compMap: Record<string, { label: string; color: string }> = {
                  chercher: { label: '🔍 Chercher', color: 'bg-emerald-500/10 text-emerald-400 border-emerald-500/20' },
                  modeliser: { label: '🧩 Modéliser', color: 'bg-blue-500/10 text-blue-400 border-blue-500/20' },
                  representer: { label: '📊 Représenter', color: 'bg-purple-500/10 text-purple-400 border-purple-500/20' },
                  raisonner: { label: '🧠 Raisonner', color: 'bg-amber-500/10 text-amber-400 border-amber-500/20' },
                  calculer: { label: '🔢 Calculer', color: 'bg-cyan-500/10 text-cyan-400 border-cyan-500/20' },
                  communiquer: { label: '💬 Communiquer', color: 'bg-pink-500/10 text-pink-400 border-pink-500/20' },
                };
                const info = compMap[c] ?? { label: c, color: 'bg-slate-500/10 text-slate-400 border-slate-500/20' };
                return (
                  <span key={c} className={`px-2 py-0.5 rounded-full text-[10px] font-bold border ${info.color}`}>
                    {info.label}
                  </span>
                );
              })}
            </div>
          )}
        </div>
        <div className="flex gap-2">
          <button onClick={onToggleFocus} className="px-3 py-2 rounded-xl text-xs font-bold bg-slate-700 text-slate-300 hover:bg-slate-600 transition-all">
            {focusMode ? '◧ Sidebar' : '⛶ Focus'}
          </button>
          <button onClick={() => store.toggleChapterComplete(chapId)} className={`px-4 py-2 rounded-xl font-bold transition-all text-sm ${isCompleted ? 'bg-green-500/20 text-green-400 border border-green-500/50' : 'bg-slate-700 text-slate-300 hover:bg-slate-600'}`}>
            {isCompleted ? '✓ Maîtrisé' : 'Marquer comme lu'}
          </button>
        </div>
      </div>

      <div className="space-y-6 relative z-10">
        {/* Rappel */}
        <div className="bg-slate-900/50 border border-slate-700 rounded-2xl p-6">
          <h3 className="font-bold text-white mb-2 flex items-center gap-2">📌 L&apos;essentiel du cours</h3>
          <p className="text-slate-300 leading-relaxed text-lg" dangerouslySetInnerHTML={{ __html: chap.contenu.rappel }} />
        </div>

        {/* Methode */}
        <div className="bg-indigo-900/20 border border-indigo-500/30 rounded-2xl p-6">
          <h3 className="font-bold text-indigo-300 mb-3">🛠️ Méthode & Formules</h3>
          <div className="font-mono text-sm bg-slate-900/50 p-4 rounded-xl border border-slate-700/50 overflow-x-auto text-indigo-100">
            {'$$' + chap.contenu.methode + '$$'}
          </div>
        </div>

        {/* Tableau */}
        {chap.contenu.tableau && chap.contenu.tableau.length > 0 && (
          <div className="overflow-x-auto">
            <table className="w-full text-left text-sm">
              <thead className="text-slate-400 border-b border-slate-700"><tr><th className="p-3">Fonction</th><th className="p-3">Propriété / Dérivée</th></tr></thead>
              <tbody className="divide-y divide-slate-700">
                {chap.contenu.tableau.map((row, i) => (
                  <tr key={i}><td className="p-3 text-white font-mono">{row.f}</td><td className="p-3 text-cyan-400 font-mono">{row.derivee}</td></tr>
                ))}
              </tbody>
            </table>
          </div>
        )}

        {/* Cas */}
        {chap.contenu.cas && chap.contenu.cas.length > 0 && (
          <div className="overflow-x-auto">
            <table className="w-full text-left text-sm">
              <thead className="text-slate-400 border-b border-slate-700"><tr><th className="p-3">Cas</th><th className="p-3">Résultat</th></tr></thead>
              <tbody className="divide-y divide-slate-700">
                {chap.contenu.cas.map((row, i) => (
                  <tr key={i}><td className="p-3 text-white font-mono">{'$' + row.delta + '$'}</td><td className="p-3 text-cyan-400" dangerouslySetInnerHTML={{ __html: row.solution }} /></tr>
                ))}
              </tbody>
            </table>
          </div>
        )}

        {/* Erreurs Classiques */}
        {chap.contenu.erreursClassiques && chap.contenu.erreursClassiques.length > 0 && (
          <div className="bg-red-900/10 border border-red-500/20 rounded-2xl p-5">
            <h3 className="font-bold text-red-400 mb-3 flex items-center gap-2">⚠️ Erreurs classiques</h3>
            <ul className="space-y-2">
              {chap.contenu.erreursClassiques.map((err, i) => (
                <li key={i} className="flex gap-2 text-sm text-slate-300">
                  <span className="text-red-400 font-bold shrink-0">✗</span>
                  <span dangerouslySetInnerHTML={{ __html: err }} />
                </li>
              ))}
            </ul>
          </div>
        )}

        {/* Astuce */}
        <div className="flex gap-4 items-start p-4 bg-yellow-500/10 border border-yellow-500/20 rounded-xl">
          <div className="text-2xl">💡</div>
          <div>
            <div className="font-bold text-yellow-400 text-sm mb-1">Astuce du prof</div>
            <div className="text-slate-300 text-sm" dangerouslySetInnerHTML={{ __html: chap.contenu.astuce }} />
          </div>
        </div>

        {/* Méthodologie Bac */}
        {chap.contenu.methodologieBac && (
          <div className="bg-emerald-900/10 border border-emerald-500/20 rounded-2xl p-5">
            <h3 className="font-bold text-emerald-400 mb-2 flex items-center gap-2">🎓 Méthodologie Bac</h3>
            <p className="text-slate-300 text-sm" dangerouslySetInnerHTML={{ __html: chap.contenu.methodologieBac }} />
          </div>
        )}

        {/* GeoGebra */}
        {chap.contenu.geogebraId && (
          <InteractiveGraph geogebraId={chap.contenu.geogebraId} title={`${chap.titre} — Graphique interactif`} />
        )}

        {/* Exercice with Coup de Pouce */}
        <div className="bg-slate-900 rounded-2xl p-6 border border-slate-700">
          <h3 className="font-bold text-white mb-3">📝 Exercice d&apos;application</h3>
          <p className="mb-4 text-slate-300" dangerouslySetInnerHTML={{ __html: chap.contenu.exercice.question }} />

          {/* 3-level hint system with XP malus indicator */}
          {chap.contenu.coupDePouce && (
            <div className="flex flex-wrap gap-2 mb-4">
              <button onClick={() => setHintLevel(hintLevel >= 1 ? 0 : 1)} className={`text-xs px-3 py-1.5 rounded-lg font-bold transition-all ${hintLevel >= 1 ? 'bg-amber-500/20 text-amber-400 border border-amber-500/30' : 'bg-slate-800 text-slate-400 hover:text-white'}`}>
                💡 Indice <span className="opacity-60">(-10% XP)</span>
              </button>
              <button onClick={() => setHintLevel(hintLevel >= 2 ? 1 : 2)} className={`text-xs px-3 py-1.5 rounded-lg font-bold transition-all ${hintLevel >= 2 ? 'bg-orange-500/20 text-orange-400 border border-orange-500/30' : 'bg-slate-800 text-slate-400 hover:text-white'}`}>
                🔍 Début de raisonnement <span className="opacity-60">(-30% XP)</span>
              </button>
              <button onClick={() => setHintLevel(hintLevel >= 3 ? 2 : 3)} className={`text-xs px-3 py-1.5 rounded-lg font-bold transition-all ${hintLevel >= 3 ? 'bg-red-500/20 text-red-400 border border-red-500/30' : 'bg-slate-800 text-slate-400 hover:text-white'}`}>
                📖 Correction détaillée <span className="opacity-60">(-100% XP)</span>
              </button>
            </div>
          )}

          {chap.contenu.coupDePouce && hintLevel >= 1 && (
            <div className="mb-3 p-3 bg-amber-500/5 border border-amber-500/20 rounded-xl text-sm">
              <p className="text-amber-300 font-bold text-xs mb-1">Indice :</p>
              <p className="text-slate-300" dangerouslySetInnerHTML={{ __html: chap.contenu.coupDePouce.indice }} />
            </div>
          )}
          {chap.contenu.coupDePouce && hintLevel >= 2 && (
            <div className="mb-3 p-3 bg-orange-500/5 border border-orange-500/20 rounded-xl text-sm">
              <p className="text-orange-300 font-bold text-xs mb-1">Début de raisonnement :</p>
              <p className="text-slate-300" dangerouslySetInnerHTML={{ __html: chap.contenu.coupDePouce.debutRaisonnement }} />
            </div>
          )}
          {chap.contenu.coupDePouce && hintLevel >= 3 && (
            <div className="mb-3 p-3 bg-red-500/5 border border-red-500/20 rounded-xl text-sm">
              <p className="text-red-300 font-bold text-xs mb-1">Correction détaillée :</p>
              <ul className="space-y-1 text-slate-300 list-disc pl-4">
                {chap.contenu.coupDePouce.correctionDetaillee.map((step, i) => (
                  <li key={i} dangerouslySetInnerHTML={{ __html: step }} />
                ))}
              </ul>
            </div>
          )}

          {/* Legacy full solution toggle */}
          {!chap.contenu.coupDePouce && (
            <>
              <button onClick={() => setShowSolution(!showSolution)} className="text-cyan-400 text-sm font-bold hover:underline flex items-center gap-1">
                {showSolution ? 'Masquer la correction' : 'Voir la correction'}
              </button>
              {showSolution && (
                <div className="mt-4 pt-4 border-t border-slate-800">
                  <div className="text-green-400 font-bold mb-2">Réponse : {'$' + chap.contenu.exercice.reponse + '$'}</div>
                  <ul className="space-y-1 text-sm text-slate-400 list-disc pl-4">
                    {chap.contenu.exercice.etapes.map((e, i) => (
                      <li key={i} dangerouslySetInnerHTML={{ __html: e }} />
                    ))}
                  </ul>
                </div>
              )}
            </>
          )}
        </div>

        {/* Interactive Exercises */}
        {chap.exercices && chap.exercices.length > 0 && (
          <ExerciseEngine exercices={chap.exercices} chapId={chapId} onExerciseCorrect={store.recordExerciseResult} />
        )}

        {/* ─── Chapter-specific Lab Interactifs (CdC §4) ─────────────── */}

        {/* CdC §4.1.1 — La Toile d'Araignée (Suites) */}
        {chapId === 'suites' && <ToileAraignee />}

        {/* CdC §4.1.2 — Le Contrôleur de Parabole (Second Degré) */}
        {chapId === 'second-degre' && <ParabolaController />}

        {/* CdC §4.2.1 — La Tangente Glissante (Dérivation) */}
        {(chapId === 'derivation' || chapId === 'variations-courbes') && (
          <TangenteGlissante
            fnExpr={chapId === 'derivation' ? 'x^3 - 3*x' : 'x^2'}
            title={chapId === 'derivation' ? 'La Tangente Glissante — f(x) = x³ − 3x' : 'Variations — f(x) = x²'}
          />
        )}

        {/* CdC §4.2.3 — L'Enrouleur (Trigonométrie) */}
        {chapId === 'trigonometrie' && <Enrouleur />}

        {/* CdC §4.4.2 — Simulation de Monte-Carlo (Probabilités) */}
        {(chapId === 'probabilites-cond' || chapId === 'variables-aleatoires') && (
          <MonteCarloSim />
        )}

        {/* CdC §4.5 — Python IDE + Pre-loaded exercises (Algorithmique) */}
        {catKey === 'algorithmique' && (
          <>
            <PythonExercises />
            <PythonIDE
              initialCode={`# ${chap.titre}\n# Écris ton code Python ici\n\n`}
              onSuccess={() => store.recordExerciseResult(chapId, 99)}
            />
          </>
        )}

        {/* Interactive Mafs graphs for Analyse & Géométrie */}
        {catKey === 'analyse' && chapId !== 'derivation' && chapId !== 'variations-courbes' && (
          <InteractiveMafs
            title={`${chap.titre} — Visualisation`}
            elements={
              chapId === 'exponentielle'
                ? [
                  { type: 'function', fn: 'exp(x)', color: 'blue', label: 'eˣ' },
                  { type: 'function', fn: 'x', color: 'red', label: 'y = x' },
                ]
                : chapId === 'trigonometrie'
                  ? [
                    { type: 'function', fn: 'sin(x)', color: 'blue', label: 'sin(x)' },
                    { type: 'function', fn: 'cos(x)', color: 'red', label: 'cos(x)' },
                  ]
                  : [
                    { type: 'function', fn: 'x^2', color: 'blue', label: 'f(x) = x²' },
                    { type: 'function', fn: '2*x', color: 'red', label: "f'(x) = 2x" },
                  ]
            }
          />
        )}

        {catKey === 'geometrie' && (
          <InteractiveMafs
            title={`${chap.titre} — Visualisation`}
            elements={
              chapId === 'equations-cercles'
                ? [
                  { type: 'circle', center: [2, -3] as [number, number], radius: 4, color: 'blue' },
                  { type: 'point', x: 2, y: -3, color: 'red', label: 'Centre' },
                ]
                : chapId === 'produit-scalaire'
                  ? [
                    { type: 'line', point1: [0, 0] as [number, number], point2: [3, 1] as [number, number], color: 'blue' },
                    { type: 'line', point1: [0, 0] as [number, number], point2: [1, 3] as [number, number], color: 'red' },
                    { type: 'point', x: 0, y: 0, color: 'green' },
                  ]
                  : [
                    { type: 'line', point1: [0, 0] as [number, number], point2: [3, 4] as [number, number], color: 'blue' },
                    { type: 'point', x: 0, y: 0, color: 'red' },
                    { type: 'point', x: 3, y: 4, color: 'green' },
                  ]
            }
            interactivePoint={{ initial: [1, 1], label: 'Point mobile' }}
          />
        )}

        {/* SRS Review Button */}
        <div className="bg-slate-900/50 border border-indigo-500/20 rounded-2xl p-5">
          <div className="flex items-center justify-between">
            <div>
              <h3 className="font-bold text-indigo-300 text-sm flex items-center gap-2">🔄 Révision espacée (SRS)</h3>
              <p className="text-xs text-slate-500 mt-1">
                {store.srsQueue[chapId]
                  ? `Prochaine révision : ${store.srsQueue[chapId].nextReview} (intervalle : ${store.srsQueue[chapId].interval}j)`
                  : 'Pas encore planifié'}
              </p>
            </div>
            <div className="flex gap-2">
              <button
                onClick={() => store.recordSRSReview(chapId, 2)}
                className="text-xs px-3 py-1.5 rounded-lg bg-red-500/10 text-red-400 border border-red-500/20 hover:bg-red-500/20 transition-all font-bold"
              >
                😰 Difficile
              </button>
              <button
                onClick={() => store.recordSRSReview(chapId, 3)}
                className="text-xs px-3 py-1.5 rounded-lg bg-amber-500/10 text-amber-400 border border-amber-500/20 hover:bg-amber-500/20 transition-all font-bold"
              >
                🤔 Moyen
              </button>
              <button
                onClick={() => store.recordSRSReview(chapId, 5)}
                className="text-xs px-3 py-1.5 rounded-lg bg-green-500/10 text-green-400 border border-green-500/20 hover:bg-green-500/20 transition-all font-bold"
              >
                😎 Facile
              </button>
            </div>
          </div>
        </div>

        {/* External Resources */}
        {chap.ressourcesExt && chap.ressourcesExt.length > 0 && (
          <div className="bg-slate-900/50 border border-slate-700 rounded-2xl p-5">
            <h3 className="font-bold text-white mb-3 flex items-center gap-2">🔗 Ressources externes</h3>
            <div className="space-y-2">
              {chap.ressourcesExt.map((res, i) => (
                <a key={i} href={res.url} target="_blank" rel="noopener noreferrer" className="flex items-center gap-2 text-sm text-cyan-400 hover:text-cyan-300 hover:underline">
                  <span>→</span> {res.label}
                </a>
              ))}
            </div>
          </div>
        )}
      </div>
    </div>
  );
}

// ─── Quiz View ───────────────────────────────────────────────────────────────
type QuizState =
  | { phase: 'idle' }
  | { phase: 'question'; index: number; score: number; questions: QuizQuestion[] }
  | { phase: 'feedback'; index: number; score: number; questions: QuizQuestion[]; isCorrect: boolean }
  | { phase: 'result'; score: number; total: number };

function QuizView({ onSwitchTab, typeset }: { onSwitchTab: (tab: TabName) => void; typeset: () => void }) {
  const [quiz, setQuiz] = useState<QuizState>({ phase: 'idle' });
  const store = useMathsLabStore();

  useEffect(() => {
    const timer = setTimeout(typeset, 200);
    return () => clearTimeout(timer);
  }, [quiz, typeset]);

  const startQuiz = useCallback(() => {
    const shuffled = [...quizData].sort(() => 0.5 - Math.random()).slice(0, 5);
    setQuiz({ phase: 'question', index: 0, score: 0, questions: shuffled });
  }, []);

  const checkAnswer = useCallback((choice: number) => {
    if (quiz.phase !== 'question') return;
    const q = quiz.questions[quiz.index];
    const isCorrect = choice === q.correct;
    if (isCorrect) {
      store.incrementCombo();
    } else {
      store.resetCombo();
    }
    setQuiz({ phase: 'feedback', index: quiz.index, score: isCorrect ? quiz.score + 1 : quiz.score, questions: quiz.questions, isCorrect });
  }, [quiz, store]);

  const nextQuestion = useCallback(() => {
    if (quiz.phase !== 'feedback') return;
    const nextIdx = quiz.index + 1;
    if (nextIdx >= quiz.questions.length) {
      store.addQuizScore(quiz.score * 10);
      setQuiz({ phase: 'result', score: quiz.score, total: quiz.questions.length });
    } else {
      setQuiz({ phase: 'question', index: nextIdx, score: quiz.score, questions: quiz.questions });
    }
  }, [quiz, store]);

  return (
    <div className="max-w-2xl mx-auto">
      <div className="text-center mb-8">
        <h2 className="text-3xl font-bold text-white mb-2" style={{ fontFamily: 'var(--font-space), Space Grotesk, sans-serif' }}>Quiz d&apos;Automatismes</h2>
        <p className="text-slate-400">Questions rapides sans calculatrice (type partie 1 E3C/Bac).</p>
      </div>

      <div className="bg-slate-800/70 backdrop-blur-xl border border-slate-700/10 rounded-3xl p-8 min-h-[400px] flex items-center justify-center">
        {quiz.phase === 'idle' && (
          <div className="text-center">
            <div className="text-6xl mb-6">⏱️</div>
            <button onClick={startQuiz} className="bg-gradient-to-r from-cyan-500 to-blue-600 text-white font-bold py-3 px-8 rounded-full text-lg shadow-lg hover:shadow-cyan-500/30 transition-all transform hover:-translate-y-1">
              Lancer une série (5 questions)
            </button>
          </div>
        )}

        {quiz.phase === 'question' && (
          <div className="w-full">
            <div className="flex justify-between text-sm text-slate-400 mb-4">
              <span>Question {quiz.index + 1} / {quiz.questions.length}</span>
              <div className="flex items-center gap-3">
                {store.comboCount >= 3 && (
                  <span className="text-purple-400 font-bold text-xs">⚡ Combo x{store.getComboMultiplier()}</span>
                )}
                <span>{quiz.questions[quiz.index].categorie}</span>
              </div>
            </div>
            <div className="h-2 bg-slate-800 rounded-full mb-6">
              <div className="h-full bg-cyan-500 rounded-full transition-all duration-300" style={{ width: `${(quiz.index / quiz.questions.length) * 100}%` }} />
            </div>
            <h3 className="text-xl font-bold text-white mb-6 text-center">{quiz.questions[quiz.index].question}</h3>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-3 mb-6">
              {quiz.questions[quiz.index].options.map((opt, i) => (
                <button key={i} onClick={() => checkAnswer(i)} className="p-4 rounded-xl border border-slate-700 hover:border-cyan-500 hover:bg-slate-800 transition-all text-slate-300 font-mono text-center">
                  {opt}
                </button>
              ))}
            </div>
          </div>
        )}

        {quiz.phase === 'feedback' && (
          <div className="w-full text-center">
            <div className="text-6xl mb-4">{quiz.isCorrect ? '✅' : '❌'}</div>
            <h3 className="text-2xl font-bold text-white mb-2">{quiz.isCorrect ? 'Correct !' : 'Oups...'}</h3>
            <div className="bg-slate-900/50 p-4 rounded-xl mb-6 text-left">
              <p className="text-slate-400 text-sm font-bold mb-1">Explication :</p>
              <p className="text-slate-300 text-sm">{quiz.questions[quiz.index].explication}</p>
            </div>
            <button onClick={nextQuestion} className="bg-cyan-600 text-white font-bold py-2 px-6 rounded-full hover:bg-cyan-500">Suivant</button>
          </div>
        )}

        {quiz.phase === 'result' && (
          <div className="text-center">
            <h3 className="text-3xl font-bold text-white mb-2">Résultat</h3>
            <div className="text-6xl font-bold text-cyan-400 mb-2" style={{ fontFamily: 'var(--font-space), Space Grotesk, sans-serif' }}>{quiz.score}/{quiz.total}</div>
            <p className="text-sm text-cyan-400 mb-4">+{quiz.score * 10} XP gagnés !</p>
            <p className="text-slate-400 mb-6">
              {quiz.score === quiz.total ? 'Parfait ! 🌟' : quiz.score > quiz.total / 2 ? 'Bien joué ! 👍' : 'Entraîne-toi encore 💪'}
            </p>
            <div className="flex gap-3 justify-center">
              <button onClick={startQuiz} className="bg-cyan-600 text-white font-bold py-2 px-6 rounded-full hover:bg-cyan-500">Rejouer</button>
              <button onClick={() => onSwitchTab('dashboard')} className="bg-slate-700 text-white font-bold py-2 px-6 rounded-full hover:bg-slate-600">Tableau de bord</button>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
