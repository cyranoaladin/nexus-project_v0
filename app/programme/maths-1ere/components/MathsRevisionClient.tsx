'use client';

import { useState, useCallback, useEffect } from 'react';
import {
  programmeData,
  quizData,
  type Categorie,
  type Chapitre,
  type QuizQuestion,
} from '../data';
import { useMathJax } from './MathJaxProvider';

// ─── Tab types ───────────────────────────────────────────────────────────────
type TabName = 'dashboard' | 'cours' | 'entrainement';

interface ProgressState {
  completed: string[];
  quizScore: number;
  streak: number;
}

// ─── Main Component ──────────────────────────────────────────────────────────
export default function MathsRevisionClient() {
  const [currentTab, setCurrentTab] = useState<TabName>('dashboard');
  const [progress, setProgress] = useState<ProgressState>({
    completed: [],
    quizScore: 0,
    streak: 3,
  });
  const [selectedChapter, setSelectedChapter] = useState<{
    catKey: string;
    chapId: string;
  } | null>(null);

  const typeset = useMathJax([currentTab, selectedChapter]);

  const switchTab = useCallback((tab: TabName) => {
    setCurrentTab(tab);
    setSelectedChapter(null);
  }, []);

  const toggleComplete = useCallback(
    (chapId: string) => {
      setProgress((prev) => ({
        ...prev,
        completed: prev.completed.includes(chapId)
          ? prev.completed.filter((id) => id !== chapId)
          : [...prev.completed, chapId],
      }));
    },
    []
  );

  const addQuizScore = useCallback((points: number) => {
    setProgress((prev) => ({
      ...prev,
      quizScore: prev.quizScore + points,
    }));
  }, []);

  return (
    <div className="min-h-screen bg-[#0f172a] text-slate-200 selection:bg-cyan-500/30 overflow-x-hidden">
      {/* ─── Navbar ─────────────────────────────────────────────────────── */}
      <Navbar />

      <div className="pt-24 pb-12 max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
        {/* ─── Header ───────────────────────────────────────────────────── */}
        <Header />

        {/* ─── Tab Bar ──────────────────────────────────────────────────── */}
        <TabBar currentTab={currentTab} onSwitch={switchTab} />

        {/* ─── Content ──────────────────────────────────────────────────── */}
        <main className="min-h-[600px]">
          {currentTab === 'dashboard' && (
            <Dashboard progress={progress} onSwitchTab={switchTab} />
          )}
          {currentTab === 'cours' && (
            <CoursView
              progress={progress}
              selectedChapter={selectedChapter}
              onSelectChapter={setSelectedChapter}
              onToggleComplete={toggleComplete}
              typeset={typeset}
            />
          )}
          {currentTab === 'entrainement' && (
            <QuizView
              onAddScore={addQuizScore}
              onSwitchTab={switchTab}
              typeset={typeset}
            />
          )}
        </main>
      </div>
    </div>
  );
}

// ─── Navbar ──────────────────────────────────────────────────────────────────
function Navbar() {
  const [dateStr, setDateStr] = useState('');

  useEffect(() => {
    const options: Intl.DateTimeFormatOptions = {
      weekday: 'long',
      year: 'numeric',
      month: 'long',
      day: 'numeric',
    };
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
                NEXUS MATHS
              </span>
              <div className="text-[10px] text-cyan-400 font-medium uppercase tracking-wider">
                Programme Officiel 2025-2026
              </div>
            </div>
          </div>
          <div className="hidden md:flex items-center gap-6">
            <div className="flex items-center gap-2 bg-slate-800/50 px-4 py-2 rounded-full border border-slate-700">
              <div className="w-2 h-2 bg-green-400 rounded-full animate-pulse" />
              <span className="text-sm font-medium text-slate-300">
                {dateStr}
              </span>
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
              <h1
                className="text-4xl md:text-5xl font-bold mb-2 text-white"
                style={{ fontFamily: 'var(--font-space), Space Grotesk, sans-serif' }}
              >
                {greeting},{' '}
                <span className="bg-gradient-to-r from-cyan-400 to-indigo-400 bg-clip-text text-transparent">
                  Expert
                </span>
              </h1>
              <p className="text-slate-400 text-lg max-w-2xl">
                Votre espace de révision optimisé pour la spécialité
                Mathématiques (4h/semaine).
              </p>
            </div>
            <div className="hidden md:block text-right">
              <div className="text-sm font-bold text-white">
                Niveau Première
              </div>
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
  {
    id: 'dashboard',
    label: 'Tableau de bord',
    icon: (
      <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 6a2 2 0 012-2h2a2 2 0 012 2v2a2 2 0 01-2 2H6a2 2 0 01-2-2V6zM14 6a2 2 0 012-2h2a2 2 0 012 2v2a2 2 0 01-2 2h-2a2 2 0 01-2-2V6zM4 16a2 2 0 012-2h2a2 2 0 012 2v2a2 2 0 01-2 2H6a2 2 0 01-2-2v-2zM14 16a2 2 0 012-2h2a2 2 0 012 2v2a2 2 0 01-2 2h-2a2 2 0 01-2-2v-2z" />
      </svg>
    ),
  },
  {
    id: 'cours',
    label: 'Fiches de Cours',
    icon: (
      <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 6.253v13m0-13C10.832 5.477 9.246 5 7.5 5S4.168 5.477 3 6.253v13C4.168 18.477 5.754 18 7.5 18s3.332.477 4.5 1.253m0-13C13.168 5.477 14.754 5 16.5 5c1.747 0 3.332.477 4.5 1.253v13C19.832 18.477 18.247 18 16.5 18c-1.746 0-3.332.477-4.5 1.253" />
      </svg>
    ),
  },
  {
    id: 'entrainement',
    label: 'Quiz & Exos',
    icon: (
      <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5H7a2 2 0 00-2 2v12a2 2 0 002 2h10a2 2 0 002-2V7a2 2 0 00-2-2h-2M9 5a2 2 0 002 2h2a2 2 0 002-2M9 5a2 2 0 012-2h2a2 2 0 012 2m-3 7h3m-3 4h3m-6-4h.01M9 16h.01" />
      </svg>
    ),
  },
];

function TabBar({
  currentTab,
  onSwitch,
}: {
  currentTab: TabName;
  onSwitch: (tab: TabName) => void;
}) {
  return (
    <div className="flex overflow-x-auto gap-2 mb-8 p-1 bg-slate-800/40 rounded-2xl border border-slate-700/30 w-full md:w-fit mx-auto md:mx-0">
      {tabs.map((tab) => (
        <button
          key={tab.id}
          onClick={() => onSwitch(tab.id)}
          className={`px-6 py-3 rounded-xl font-medium transition-all flex items-center gap-2 whitespace-nowrap ${
            currentTab === tab.id
              ? 'bg-cyan-500/10 border border-cyan-500/30 text-cyan-400'
              : 'text-slate-400 hover:text-white border border-transparent'
          }`}
        >
          {tab.icon}
          {tab.label}
        </button>
      ))}
    </div>
  );
}

// ─── Dashboard ───────────────────────────────────────────────────────────────
function Dashboard({
  progress,
  onSwitchTab,
}: {
  progress: ProgressState;
  onSwitchTab: (tab: TabName) => void;
}) {
  const totalChapitres = Object.values(programmeData).reduce(
    (acc, cat) => acc + cat.chapitres.length,
    0
  );
  const progressPct = Math.round(
    (progress.completed.length / totalChapitres) * 100
  );
  const circumference = 52 * 2 * Math.PI;

  return (
    <>
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6 mb-8">
        {/* Progress Ring */}
        <div className="lg:col-span-1 bg-slate-800/70 backdrop-blur-xl border border-slate-700/10 rounded-3xl p-6 flex flex-col items-center justify-center">
          <div className="relative w-40 h-40 mb-4">
            <svg className="w-40 h-40" viewBox="0 0 120 120">
              <circle
                className="text-slate-700"
                strokeWidth="8"
                stroke="currentColor"
                fill="transparent"
                r="52"
                cx="60"
                cy="60"
              />
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
                style={{
                  transition: 'stroke-dashoffset 0.35s',
                  transform: 'rotate(-90deg)',
                  transformOrigin: '50% 50%',
                }}
              />
            </svg>
            <div className="absolute inset-0 flex items-center justify-center flex-col">
              <span
                className="text-3xl font-bold text-white"
                style={{ fontFamily: 'var(--font-space), Space Grotesk, sans-serif' }}
              >
                {progressPct}%
              </span>
              <span className="text-xs text-slate-400">du programme</span>
            </div>
          </div>
          <h3 className="font-bold text-white text-lg">Progression Globale</h3>
        </div>

        {/* Stats Cards */}
        <div className="lg:col-span-2 grid grid-cols-1 sm:grid-cols-2 gap-4">
          <StatCard
            icon="⚡"
            iconBg="bg-blue-500/20 text-blue-400"
            label="Série"
            value={`${progress.streak}`}
            unit="jours"
            subtitle="Consécutifs"
          />
          <StatCard
            icon="🏆"
            iconBg="bg-purple-500/20 text-purple-400"
            label="Score Quiz"
            value={`${progress.quizScore}`}
            unit="pts"
            subtitle="Accumulés"
          />
          <div className="bg-gradient-to-br from-slate-800 to-slate-900 border border-cyan-500/10 rounded-2xl p-6 sm:col-span-2 border-l-4 border-l-cyan-500">
            <h4 className="font-bold text-white mb-2">
              🎯 Objectif de la semaine
            </h4>
            <p className="text-slate-400 text-sm mb-4">
              Le programme indique une priorité sur la{' '}
              <strong className="text-white">Dérivation</strong> et
              l&apos;étude des variations. C&apos;est un pilier pour
              l&apos;analyse en Terminale.
            </p>
            <button
              onClick={() => onSwitchTab('cours')}
              className="text-cyan-400 text-sm font-bold hover:underline"
            >
              Accéder au cours →
            </button>
          </div>
        </div>
      </div>

      {/* Theme Overview */}
      <h3 className="text-xl font-bold text-white mb-4">
        Vue d&apos;ensemble des thèmes
      </h3>
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
        {Object.entries(programmeData).map(([key, cat]) => (
          <ThemeCard key={key} cat={cat} />
        ))}
      </div>
    </>
  );
}

function StatCard({
  icon,
  iconBg,
  label,
  value,
  unit,
  subtitle,
}: {
  icon: string;
  iconBg: string;
  label: string;
  value: string;
  unit: string;
  subtitle: string;
}) {
  return (
    <div className="bg-gradient-to-br from-slate-800 to-slate-900 border border-cyan-500/10 rounded-2xl p-6 transition-all hover:border-cyan-500/30 hover:-translate-y-0.5">
      <div className="flex justify-between items-start mb-2">
        <div className={`p-2 rounded-lg ${iconBg}`}>{icon}</div>
        <span className="text-xs font-bold text-slate-500 uppercase">
          {label}
        </span>
      </div>
      <div
        className="text-3xl font-bold text-white mb-1"
        style={{ fontFamily: 'var(--font-space), Space Grotesk, sans-serif' }}
      >
        {value}{' '}
        <span className="text-lg text-slate-500">{unit}</span>
      </div>
      <div className="text-sm text-slate-400">{subtitle}</div>
    </div>
  );
}

function ThemeCard({ cat }: { cat: Categorie }) {
  const borderColor =
    cat.couleur === 'cyan'
      ? 'border-t-cyan-500'
      : cat.couleur === 'blue'
        ? 'border-t-blue-500'
        : 'border-t-purple-500';

  return (
    <div
      className={`bg-slate-800/70 backdrop-blur-xl border border-slate-700/10 p-4 rounded-xl border-t-2 ${borderColor}`}
    >
      <div className="text-2xl mb-2">{cat.icon}</div>
      <div className="font-bold text-white">{cat.titre}</div>
      <div className="text-xs text-slate-400 mt-1">
        {cat.chapitres.length} chapitres
      </div>
    </div>
  );
}

// ─── Cours View ──────────────────────────────────────────────────────────────
function CoursView({
  progress,
  selectedChapter,
  onSelectChapter,
  onToggleComplete,
  typeset,
}: {
  progress: ProgressState;
  selectedChapter: { catKey: string; chapId: string } | null;
  onSelectChapter: (ch: { catKey: string; chapId: string }) => void;
  onToggleComplete: (id: string) => void;
  typeset: () => void;
}) {
  return (
    <div className="grid grid-cols-1 lg:grid-cols-12 gap-6 h-full">
      {/* Sidebar */}
      <div className="lg:col-span-3 space-y-4">
        {Object.entries(programmeData).map(([key, cat]) => {
          const textColor =
            cat.couleur === 'cyan'
              ? 'text-cyan-400'
              : cat.couleur === 'blue'
                ? 'text-blue-400'
                : 'text-purple-400';

          return (
            <div
              key={key}
              className="bg-slate-800/70 backdrop-blur-xl border border-slate-700/10 rounded-2xl p-4"
            >
              <h3
                className={`font-bold ${textColor} mb-3 flex items-center gap-2`}
              >
                {cat.icon} {cat.titre}
              </h3>
              <div className="space-y-1">
                {cat.chapitres.map((chap) => (
                  <button
                    key={chap.id}
                    onClick={() =>
                      onSelectChapter({ catKey: key, chapId: chap.id })
                    }
                    className={`w-full text-left px-3 py-2 rounded-lg text-sm transition-colors flex justify-between items-center group ${
                      selectedChapter?.chapId === chap.id
                        ? 'bg-slate-700/80 text-white'
                        : 'text-slate-300 hover:bg-slate-700/50 hover:text-white'
                    }`}
                  >
                    {chap.titre}
                    {progress.completed.includes(chap.id) && (
                      <span className="text-green-400">✓</span>
                    )}
                  </button>
                ))}
              </div>
            </div>
          );
        })}
      </div>

      {/* Chapter Viewer */}
      <div className="lg:col-span-9">
        {selectedChapter ? (
          <ChapterViewer
            catKey={selectedChapter.catKey}
            chapId={selectedChapter.chapId}
            isCompleted={progress.completed.includes(selectedChapter.chapId)}
            onToggleComplete={onToggleComplete}
            typeset={typeset}
          />
        ) : (
          <div className="bg-slate-800/70 backdrop-blur-xl border border-slate-700/10 rounded-3xl p-12 text-center h-full flex flex-col items-center justify-center text-slate-500 min-h-[400px]">
            <div className="text-6xl mb-4 opacity-50">📚</div>
            <h3 className="text-xl font-bold text-slate-300 mb-2">
              Sélectionnez une fiche
            </h3>
            <p>
              Cliquez sur un chapitre à gauche pour afficher la fiche de
              révision.
            </p>
          </div>
        )}
      </div>
    </div>
  );
}

// ─── Chapter Viewer ──────────────────────────────────────────────────────────
function ChapterViewer({
  catKey,
  chapId,
  isCompleted,
  onToggleComplete,
  typeset,
}: {
  catKey: string;
  chapId: string;
  isCompleted: boolean;
  onToggleComplete: (id: string) => void;
  typeset: () => void;
}) {
  const [showSolution, setShowSolution] = useState(false);
  const cat = programmeData[catKey];
  const chap = cat?.chapitres.find((c) => c.id === chapId);

  useEffect(() => {
    setShowSolution(false);
    const timer = setTimeout(typeset, 200);
    return () => clearTimeout(timer);
  }, [chapId, typeset]);

  useEffect(() => {
    if (showSolution) {
      const timer = setTimeout(typeset, 100);
      return () => clearTimeout(timer);
    }
  }, [showSolution, typeset]);

  if (!cat || !chap) return null;

  const badgeColor =
    cat.couleur === 'cyan'
      ? 'bg-cyan-500/20 text-cyan-400'
      : cat.couleur === 'blue'
        ? 'bg-blue-500/20 text-blue-400'
        : 'bg-purple-500/20 text-purple-400';

  return (
    <div className="bg-slate-800/70 backdrop-blur-xl border border-slate-700/10 rounded-3xl p-8 relative overflow-hidden">
      <div className="absolute top-0 right-0 p-8 opacity-10 text-9xl select-none pointer-events-none">
        {cat.icon}
      </div>

      <div className="flex justify-between items-start mb-6 relative z-10">
        <div>
          <span
            className={`px-3 py-1 rounded-full text-xs font-bold ${badgeColor} mb-2 inline-block`}
          >
            {cat.titre}
          </span>
          <h2
            className="text-3xl font-bold text-white"
            style={{ fontFamily: 'var(--font-space), Space Grotesk, sans-serif' }}
          >
            {chap.titre}
          </h2>
        </div>
        <button
          onClick={() => onToggleComplete(chapId)}
          className={`px-4 py-2 rounded-xl font-bold transition-all ${
            isCompleted
              ? 'bg-green-500/20 text-green-400 border border-green-500/50'
              : 'bg-slate-700 text-slate-300 hover:bg-slate-600'
          }`}
        >
          {isCompleted ? '✓ Maîtrisé' : 'Marquer comme lu'}
        </button>
      </div>

      <div className="space-y-6 relative z-10">
        {/* Rappel */}
        <div className="bg-slate-900/50 border border-slate-700 rounded-2xl p-6">
          <h3 className="font-bold text-white mb-2 flex items-center gap-2">
            📌 L&apos;essentiel du cours
          </h3>
          <p
            className="text-slate-300 leading-relaxed text-lg"
            dangerouslySetInnerHTML={{ __html: chap.contenu.rappel }}
          />
        </div>

        {/* Methode */}
        <div className="bg-indigo-900/20 border border-indigo-500/30 rounded-2xl p-6">
          <h3 className="font-bold text-indigo-300 mb-3">
            🛠️ Méthode & Formules
          </h3>
          <div className="font-mono text-sm bg-slate-900/50 p-4 rounded-xl border border-slate-700/50 overflow-x-auto text-indigo-100">
            {'$$' + chap.contenu.methode + '$$'}
          </div>
        </div>

        {/* Tableau (derivees) */}
        {chap.contenu.tableau && chap.contenu.tableau.length > 0 && (
          <div className="overflow-x-auto">
            <table className="w-full text-left text-sm">
              <thead className="text-slate-400 border-b border-slate-700">
                <tr>
                  <th className="p-3">Fonction</th>
                  <th className="p-3">Propriété / Dérivée</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-700">
                {chap.contenu.tableau.map((row, i) => (
                  <tr key={i}>
                    <td className="p-3 text-white font-mono">{row.f}</td>
                    <td className="p-3 text-cyan-400 font-mono">
                      {row.derivee}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}

        {/* Cas (second degre, probas) */}
        {chap.contenu.cas && chap.contenu.cas.length > 0 && (
          <div className="overflow-x-auto">
            <table className="w-full text-left text-sm">
              <thead className="text-slate-400 border-b border-slate-700">
                <tr>
                  <th className="p-3">Cas</th>
                  <th className="p-3">Résultat</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-700">
                {chap.contenu.cas.map((row, i) => (
                  <tr key={i}>
                    <td className="p-3 text-white font-mono">
                      {'$' + row.delta + '$'}
                    </td>
                    <td
                      className="p-3 text-cyan-400"
                      dangerouslySetInnerHTML={{ __html: row.solution }}
                    />
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}

        {/* Astuce */}
        <div className="flex gap-4 items-start p-4 bg-yellow-500/10 border border-yellow-500/20 rounded-xl">
          <div className="text-2xl">💡</div>
          <div>
            <div className="font-bold text-yellow-400 text-sm mb-1">
              Astuce du prof
            </div>
            <div
              className="text-slate-300 text-sm"
              dangerouslySetInnerHTML={{ __html: chap.contenu.astuce }}
            />
          </div>
        </div>

        {/* Exercice */}
        <div className="bg-slate-900 rounded-2xl p-6 border border-slate-700">
          <h3 className="font-bold text-white mb-3">
            📝 Exercice d&apos;application
          </h3>
          <p
            className="mb-4 text-slate-300"
            dangerouslySetInnerHTML={{ __html: chap.contenu.exercice.question }}
          />

          <button
            onClick={() => setShowSolution(!showSolution)}
            className="text-cyan-400 text-sm font-bold hover:underline flex items-center gap-1"
          >
            {showSolution ? 'Masquer la correction' : 'Voir la correction'}
          </button>

          {showSolution && (
            <div className="mt-4 pt-4 border-t border-slate-800">
              <div className="text-green-400 font-bold mb-2">
                Réponse : {'$' + chap.contenu.exercice.reponse + '$'}
              </div>
              <ul className="space-y-1 text-sm text-slate-400 list-disc pl-4">
                {chap.contenu.exercice.etapes.map((e, i) => (
                  <li key={i} dangerouslySetInnerHTML={{ __html: e }} />
                ))}
              </ul>
            </div>
          )}
        </div>
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

function QuizView({
  onAddScore,
  onSwitchTab,
  typeset,
}: {
  onAddScore: (points: number) => void;
  onSwitchTab: (tab: TabName) => void;
  typeset: () => void;
}) {
  const [quiz, setQuiz] = useState<QuizState>({ phase: 'idle' });

  useEffect(() => {
    const timer = setTimeout(typeset, 200);
    return () => clearTimeout(timer);
  }, [quiz, typeset]);

  const startQuiz = useCallback(() => {
    const shuffled = [...quizData].sort(() => 0.5 - Math.random()).slice(0, 5);
    setQuiz({ phase: 'question', index: 0, score: 0, questions: shuffled });
  }, []);

  const checkAnswer = useCallback(
    (choice: number) => {
      if (quiz.phase !== 'question') return;
      const q = quiz.questions[quiz.index];
      const isCorrect = choice === q.correct;
      setQuiz({
        phase: 'feedback',
        index: quiz.index,
        score: isCorrect ? quiz.score + 1 : quiz.score,
        questions: quiz.questions,
        isCorrect,
      });
    },
    [quiz]
  );

  const nextQuestion = useCallback(() => {
    if (quiz.phase !== 'feedback') return;
    const nextIdx = quiz.index + 1;
    if (nextIdx >= quiz.questions.length) {
      onAddScore(quiz.score * 10);
      setQuiz({ phase: 'result', score: quiz.score, total: quiz.questions.length });
    } else {
      setQuiz({
        phase: 'question',
        index: nextIdx,
        score: quiz.score,
        questions: quiz.questions,
      });
    }
  }, [quiz, onAddScore]);

  return (
    <div className="max-w-2xl mx-auto">
      <div className="text-center mb-8">
        <h2
          className="text-3xl font-bold text-white mb-2"
          style={{ fontFamily: 'var(--font-space), Space Grotesk, sans-serif' }}
        >
          Quiz d&apos;Automatismes
        </h2>
        <p className="text-slate-400">
          Questions rapides sans calculatrice (type partie 1 E3C/Bac).
        </p>
      </div>

      <div className="bg-slate-800/70 backdrop-blur-xl border border-slate-700/10 rounded-3xl p-8 min-h-[400px] flex items-center justify-center">
        {quiz.phase === 'idle' && (
          <div className="text-center">
            <div className="text-6xl mb-6">⏱️</div>
            <button
              onClick={startQuiz}
              className="bg-gradient-to-r from-cyan-500 to-blue-600 text-white font-bold py-3 px-8 rounded-full text-lg shadow-lg hover:shadow-cyan-500/30 transition-all transform hover:-translate-y-1"
            >
              Lancer une série (5 questions)
            </button>
          </div>
        )}

        {quiz.phase === 'question' && (
          <div className="w-full">
            <div className="flex justify-between text-sm text-slate-400 mb-4">
              <span>
                Question {quiz.index + 1} / {quiz.questions.length}
              </span>
              <span>{quiz.questions[quiz.index].categorie}</span>
            </div>
            <div className="h-2 bg-slate-800 rounded-full mb-6">
              <div
                className="h-full bg-cyan-500 rounded-full transition-all duration-300"
                style={{
                  width: `${(quiz.index / quiz.questions.length) * 100}%`,
                }}
              />
            </div>

            <h3 className="text-xl font-bold text-white mb-6 text-center">
              {quiz.questions[quiz.index].question}
            </h3>

            <div className="grid grid-cols-1 md:grid-cols-2 gap-3 mb-6">
              {quiz.questions[quiz.index].options.map((opt, i) => (
                <button
                  key={i}
                  onClick={() => checkAnswer(i)}
                  className="p-4 rounded-xl border border-slate-700 hover:border-cyan-500 hover:bg-slate-800 transition-all text-slate-300 font-mono text-center"
                >
                  {opt}
                </button>
              ))}
            </div>
          </div>
        )}

        {quiz.phase === 'feedback' && (
          <div className="w-full text-center">
            <div className="text-6xl mb-4">
              {quiz.isCorrect ? '✅' : '❌'}
            </div>
            <h3 className="text-2xl font-bold text-white mb-2">
              {quiz.isCorrect ? 'Correct !' : 'Oups...'}
            </h3>
            <div className="bg-slate-900/50 p-4 rounded-xl mb-6 text-left">
              <p className="text-slate-400 text-sm font-bold mb-1">
                Explication :
              </p>
              <p className="text-slate-300 text-sm">
                {quiz.questions[quiz.index].explication}
              </p>
            </div>
            <button
              onClick={nextQuestion}
              className="bg-cyan-600 text-white font-bold py-2 px-6 rounded-full hover:bg-cyan-500"
            >
              Suivant
            </button>
          </div>
        )}

        {quiz.phase === 'result' && (
          <div className="text-center">
            <h3 className="text-3xl font-bold text-white mb-2">Résultat</h3>
            <div
              className="text-6xl font-bold text-cyan-400 mb-2"
              style={{ fontFamily: 'var(--font-space), Space Grotesk, sans-serif' }}
            >
              {quiz.score}/{quiz.total}
            </div>
            <p className="text-slate-400 mb-6">
              {quiz.score === quiz.total
                ? 'Parfait ! 🌟'
                : quiz.score > quiz.total / 2
                  ? 'Bien joué ! 👍'
                  : 'Entraîne-toi encore 💪'}
            </p>
            <div className="flex gap-3 justify-center">
              <button
                onClick={startQuiz}
                className="bg-cyan-600 text-white font-bold py-2 px-6 rounded-full hover:bg-cyan-500"
              >
                Rejouer
              </button>
              <button
                onClick={() => onSwitchTab('dashboard')}
                className="bg-slate-700 text-white font-bold py-2 px-6 rounded-full hover:bg-slate-600"
              >
                Tableau de bord
              </button>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
