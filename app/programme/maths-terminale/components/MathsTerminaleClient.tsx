'use client';

import { useEffect, useMemo, useState } from 'react';
import { AnimatePresence, motion } from 'framer-motion';
import dynamic from 'next/dynamic';
import {
  bacSubjectsTerminale,
  badgesTerminale,
  dailyChallengesTerminale,
  programmeDataTerminale,
  type BacQuestion,
  type BacSujet,
  type Chapter,
  type Exercice,
} from '../data';
import { useMathsTerminaleStore } from '../store';
import { useMathJax } from '../../maths-1ere/components/MathJaxProvider';
import MathInput from '../../maths-1ere/components/MathInput';

const PythonIDE = dynamic(() => import('../../maths-1ere/components/PythonIDE'), { ssr: false });
const TangenteGlissante = dynamic(() => import('../../maths-1ere/components/labs/TangenteGlissante'), { ssr: false });
const MonteCarloSim = dynamic(() => import('../../maths-1ere/components/labs/MonteCarloSim'), { ssr: false });
const VectorProjector = dynamic(() => import('../../maths-1ere/components/labs/VectorProjector'), { ssr: false });

type TabName = 'dashboard' | 'cours' | 'entrainement' | 'bac' | 'outils';
type AutoEval = 'acquis' | 'a_revoir' | 'incompris';

const pageVariants = {
  initial: { opacity: 0, y: 8 },
  animate: { opacity: 1, y: 0 },
  exit: { opacity: 0, y: -8 },
};

const bacChecklistLabels = [
  'domaine écrit',
  'théorème cité',
  'équation exacte résolue',
  'conclusion en français',
  '+2kπ',
  'valeur absolue',
  'point final donné',
  'arrondi conforme',
];

function flattenChapters() {
  return programmeDataTerminale.flatMap((cat) =>
    cat.chapters.map((ch) => ({ ...ch, categoryId: cat.id, categoryTitle: cat.title }))
  );
}

function getLevelFromXp(xp: number) {
  if (xp >= 3000) return { label: 'Légende', min: 3000, next: 5000 };
  if (xp >= 1800) return { label: 'Maître', min: 1800, next: 3000 };
  if (xp >= 900) return { label: 'Expert', min: 900, next: 1800 };
  if (xp >= 350) return { label: 'Confirmé', min: 350, next: 900 };
  return { label: 'Apprenti', min: 0, next: 350 };
}

function inferErrorTag(text: string): string {
  const t = text.toLowerCase();
  if (t.includes('signe')) return 'signe';
  if (t.includes('domaine') || t.includes('ln')) return 'domaine';
  if (t.includes('+2k') || t.includes('périod')) return 'oubli périodicité';
  if (t.includes('constante') || t.includes('+c')) return 'oubli +C';
  if (t.includes('tvi') || t.includes('continuité')) return 'TVI sans continuité';
  if (t.includes('contrapos') || t.includes('récipro')) return 'contraposée/réciproque';
  if (t.includes('distance') || t.includes('valeur absolue')) return 'valeur absolue';
  return 'raisonnement';
}

export default function MathsTerminaleClient({
  userId,
  initialDisplayName,
}: {
  userId: string;
  initialDisplayName: string;
}) {
  const store = useMathsTerminaleStore();
  const [currentTab, setCurrentTab] = useState<TabName>('dashboard');
  const [focusBacMode, setFocusBacMode] = useState(false);
  const [focusMode, setFocusMode] = useState(false);
  const [selectedChapterId, setSelectedChapterId] = useState<string | null>(null);
  const [showMathInput, setShowMathInput] = useState(false);

  const chapters = useMemo(() => flattenChapters(), []);
  const selectedChapter = chapters.find((c) => c.id === selectedChapterId) ?? null;

  useEffect(() => {
    if (!selectedChapterId && chapters.length > 0) setSelectedChapterId(chapters[0].id);
  }, [chapters, selectedChapterId]);

  useMathJax([currentTab, selectedChapterId, focusBacMode, focusMode]);

  useEffect(() => {
    const payload = {
      completed_chapters: store.completedChapters,
      mastered_chapters: store.masteredChapters,
      total_xp: store.totalXP,
      quiz_score: store.quizScore,
      combo_count: store.comboCount,
      best_combo: store.bestCombo,
      streak: store.streak,
      streak_freezes: store.streakFreezes,
      last_activity_date: store.lastActivityDate,
      daily_challenge: store.dailyChallenge as unknown as Record<string, unknown>,
      exercise_results: store.exerciseResults,
      hint_usage: store.hintUsage,
      badges: store.badges,
      srs_queue: store.srsQueue as Record<string, unknown>,
      error_tags: store.errorTags,
      hint_penalty_xp: store.hintPenaltyXp,
      bac_checklist_completions: store.bacChecklistCompletions,
    };
    const timer = setTimeout(() => {
      fetch('/api/programme/maths-terminale/progress', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        credentials: 'include',
        body: JSON.stringify(payload),
      }).catch(() => {
        // localStorage fallback from Zustand persist remains active.
      });
    }, 500);
    return () => clearTimeout(timer);
  }, [
    store.completedChapters,
    store.masteredChapters,
    store.totalXP,
    store.quizScore,
    store.comboCount,
    store.bestCombo,
    store.streak,
    store.streakFreezes,
    store.lastActivityDate,
    store.dailyChallenge,
    store.exerciseResults,
    store.hintUsage,
    store.badges,
    store.srsQueue,
    store.errorTags,
    store.hintPenaltyXp,
    store.bacChecklistCompletions,
  ]);

  const level = getLevelFromXp(store.totalXP);
  const progressPct = Math.min(100, ((store.totalXP - level.min) / (level.next - level.min)) * 100);

  const sortedChapters = useMemo(() => {
    const copy = [...chapters];
    if (focusBacMode) {
      copy.sort((a, b) => b.content.focusBacPriority - a.content.focusBacPriority || a.title.localeCompare(b.title));
    }
    return copy;
  }, [chapters, focusBacMode]);

  return (
    <div className="min-h-screen bg-gradient-to-b from-[#060b1a] via-[#0b1227] to-[#0a1020] text-white">
      <header className="sticky top-0 z-30 border-b border-white/10 bg-[#060b1a]/90 backdrop-blur px-4 py-3">
        <div className="mx-auto flex w-full max-w-7xl items-center justify-between gap-3">
          <div>
            <p className="text-xs text-cyan-300">Nexus Réussite · Programme</p>
            <h1 className="text-lg font-black md:text-2xl">EDS Maths Terminale — Prépa Bac</h1>
            <p className="text-xs text-white/60">{initialDisplayName} · ID {userId.slice(0, 8)}…</p>
          </div>
          <div className="hidden min-w-[260px] md:block">
            <div className="mb-1 flex justify-between text-xs text-white/70">
              <span>{level.label}</span>
              <span>{store.totalXP} XP</span>
            </div>
            <div className="h-2 overflow-hidden rounded-full bg-white/10">
              <div className="h-full rounded-full bg-gradient-to-r from-cyan-500 to-indigo-500" style={{ width: `${progressPct}%` }} />
            </div>
          </div>
        </div>
      </header>

      <main className="mx-auto w-full max-w-7xl px-4 py-6">
        <div className="mb-4 flex flex-wrap items-center gap-2">
          {[
            ['dashboard', '📊 Dashboard'],
            ['cours', '📚 Cours & Méthodes'],
            ['entrainement', '🏋️ Entraînement'],
            ['bac', '🎯 Prépa Bac'],
            ['outils', '🧰 Outils'],
          ].map(([id, label]) => (
            <button
              key={id}
              onClick={() => setCurrentTab(id as TabName)}
              className={`rounded-xl px-4 py-2 text-sm font-bold transition ${
                currentTab === id ? 'bg-cyan-500/20 text-cyan-300 border border-cyan-400/40' : 'bg-white/5 text-white/70 hover:text-white'
              }`}
            >
              {label}
            </button>
          ))}
          <label className="ml-auto flex cursor-pointer items-center gap-2 rounded-xl border border-indigo-400/40 bg-indigo-500/10 px-3 py-2 text-xs font-semibold text-indigo-200">
            <input type="checkbox" checked={focusBacMode} onChange={(e) => setFocusBacMode(e.target.checked)} />
            Mode Focus Bac
          </label>
          <label className="flex cursor-pointer items-center gap-2 rounded-xl border border-white/20 bg-white/5 px-3 py-2 text-xs">
            <input type="checkbox" checked={focusMode} onChange={(e) => setFocusMode(e.target.checked)} />
            Mode Focus lecture
          </label>
        </div>

        <AnimatePresence mode="wait">
          {currentTab === 'dashboard' && (
            <motion.div key="dashboard" variants={pageVariants} initial="initial" animate="animate" exit="exit" className="space-y-4">
              <DashboardView
                onLaunchBac={(duration) => setCurrentTab('bac')}
                xp={store.totalXP}
                streak={store.streak}
                combo={store.comboCount}
                dueCount={store.getDueReviews().length}
                badges={store.badges}
                errorTags={store.errorTags}
              />
            </motion.div>
          )}

          {currentTab === 'cours' && (
            <motion.div key="cours" variants={pageVariants} initial="initial" animate="animate" exit="exit" className="grid gap-4 md:grid-cols-12">
              {!focusMode && (
                <aside className="md:col-span-4">
                  <SkillTreePanel
                    chapters={sortedChapters}
                    selectedId={selectedChapterId}
                    completed={store.completedChapters}
                    due={store.getDueReviews()}
                    onSelect={setSelectedChapterId}
                  />
                </aside>
              )}
              <section className={focusMode ? 'md:col-span-12' : 'md:col-span-8'}>
                {selectedChapter ? (
                  <ChapterViewer
                    chapter={selectedChapter}
                    onMarkDone={() => store.toggleChapterComplete(selectedChapter.id)}
                    isDone={store.completedChapters.includes(selectedChapter.id)}
                    focusBacMode={focusBacMode}
                  />
                ) : null}
              </section>
            </motion.div>
          )}

          {currentTab === 'entrainement' && (
            <motion.div key="entrainement" variants={pageVariants} initial="initial" animate="animate" exit="exit" className="space-y-4">
              {selectedChapter && (
                <TrainingView
                  chapter={selectedChapter}
                  onBackToCourse={() => setCurrentTab('cours')}
                  onAddErrorTag={(tag) => store.addErrorTag(tag)}
                  onAddSRS={(key, tag) => store.addToSRS(key, tag)}
                  onRecordWithHint={(chapterId, i, hint, base) => store.recordExerciseWithHint(chapterId, i, hint, base)}
                  errorTags={store.errorTags}
                  srsQueue={store.srsQueue}
                />
              )}
            </motion.div>
          )}

          {currentTab === 'bac' && (
            <motion.div key="bac" variants={pageVariants} initial="initial" animate="animate" exit="exit" className="space-y-4">
              <BacView
                showMathInput={showMathInput}
                onToggleMathInput={() => setShowMathInput((v) => !v)}
                onFinish={(xp, errors, checklistComplete) => {
                  store.addXP(xp);
                  errors.forEach((tag) => {
                    store.addErrorTag(tag);
                    store.addToSRS(`bac:${Date.now()}:${tag}`, tag);
                  });
                  store.markBacChecklist(checklistComplete);
                  store.recordActivity();
                  store.evaluateBadges();
                }}
              />
            </motion.div>
          )}

          {currentTab === 'outils' && (
            <motion.div key="outils" variants={pageVariants} initial="initial" animate="animate" exit="exit" className="space-y-4">
              <ToolsView />
            </motion.div>
          )}
        </AnimatePresence>
      </main>
    </div>
  );
}

function DashboardView({
  onLaunchBac,
  xp,
  streak,
  combo,
  dueCount,
  badges,
  errorTags,
}: {
  onLaunchBac: (duration: 30 | 60) => void;
  xp: number;
  streak: number;
  combo: number;
  dueCount: number;
  badges: string[];
  errorTags: Record<string, number>;
}) {
  const challenge = dailyChallengesTerminale[Math.floor(new Date().getDate() % dailyChallengesTerminale.length)];
  return (
    <>
      <section className="grid gap-3 md:grid-cols-4">
        {[
          ['XP total', `${xp}`],
          ['Streak', `${streak} jours`],
          ['Combo', `${combo}`],
          ['SRS à revoir', `${dueCount}`],
        ].map(([k, v]) => (
          <div key={k} className="rounded-2xl border border-white/10 bg-white/5 p-4">
            <p className="text-xs text-white/60">{k}</p>
            <p className="text-2xl font-black">{v}</p>
          </div>
        ))}
      </section>

      <section className="grid gap-4 md:grid-cols-2">
        <div className="rounded-2xl border border-cyan-400/30 bg-cyan-500/10 p-5">
          <h2 className="mb-2 text-xl font-black">Mode Bac rapide</h2>
          <p className="mb-4 text-sm text-white/80">Lance une session chronométrée avec correction masquée puis auto-évaluation.</p>
          <div className="flex gap-2">
            <button onClick={() => onLaunchBac(30)} className="rounded-xl bg-cyan-500 px-4 py-2 text-sm font-bold text-black">Je lance 30 min</button>
            <button onClick={() => onLaunchBac(60)} className="rounded-xl bg-indigo-500 px-4 py-2 text-sm font-bold">Je lance 60 min</button>
          </div>
        </div>

        <div className="rounded-2xl border border-white/10 bg-white/5 p-5">
          <h2 className="mb-2 text-xl font-black">Défi du jour</h2>
          <p className="text-sm text-white/80">{challenge.prompt}</p>
          <p className="mt-3 text-xs text-cyan-300">+{challenge.xp} XP · {challenge.tags.join(' · ')}</p>
        </div>
      </section>

      <section className="rounded-2xl border border-white/10 bg-white/5 p-5">
        <h3 className="mb-3 text-lg font-bold">Badges</h3>
        <div className="grid gap-2 md:grid-cols-2">
          {badgesTerminale.map((b) => {
            const earned = badges.includes(b.id);
            return (
              <div key={b.id} className={`rounded-xl border p-3 ${earned ? 'border-amber-300/40 bg-amber-500/10' : 'border-white/10 bg-black/20'}`}>
                <p className="font-bold">{b.title}</p>
                <p className="text-xs text-white/70">{b.rule}</p>
              </div>
            );
          })}
        </div>
      </section>

      <section className="rounded-2xl border border-white/10 bg-white/5 p-5">
        <h3 className="mb-2 text-lg font-bold">Carnet d’erreurs</h3>
        <div className="flex flex-wrap gap-2">
          {Object.keys(errorTags).length === 0 ? <p className="text-sm text-white/60">Aucune erreur taguée pour l’instant.</p> : null}
          {Object.entries(errorTags).map(([tag, count]) => (
            <span key={tag} className="rounded-full border border-rose-300/30 bg-rose-500/10 px-3 py-1 text-xs text-rose-200">
              {tag} · {count}
            </span>
          ))}
        </div>
      </section>
    </>
  );
}

function SkillTreePanel({
  chapters,
  selectedId,
  completed,
  due,
  onSelect,
}: {
  chapters: Array<Chapter & { categoryId: string; categoryTitle: string }>;
  selectedId: string | null;
  completed: string[];
  due: string[];
  onSelect: (id: string) => void;
}) {
  return (
    <div className="rounded-2xl border border-white/10 bg-white/5 p-3">
      <h3 className="mb-2 text-sm font-bold text-cyan-300">SkillTree Terminale</h3>
      <div className="max-h-[70vh] space-y-2 overflow-y-auto pr-1">
        {chapters.map((ch) => (
          <button
            key={ch.id}
            onClick={() => onSelect(ch.id)}
            className={`w-full rounded-xl border p-3 text-left ${
              selectedId === ch.id
                ? 'border-cyan-300/50 bg-cyan-500/10'
                : completed.includes(ch.id)
                ? 'border-green-300/30 bg-green-500/10'
                : 'border-white/10 bg-black/20 hover:bg-white/5'
            }`}
          >
            <p className="text-xs text-white/50">{ch.categoryTitle}</p>
            <p className="font-semibold">{ch.title}</p>
            <p className="text-xs text-white/60">Priorité Bac: {ch.content.focusBacPriority}/5</p>
            {due.includes(ch.id) && <p className="text-xs font-bold text-orange-300">À réviser aujourd’hui</p>}
          </button>
        ))}
      </div>
    </div>
  );
}

function ChapterViewer({
  chapter,
  onMarkDone,
  isDone,
  focusBacMode,
}: {
  chapter: Chapter & { categoryId: string; categoryTitle: string };
  onMarkDone: () => void;
  isDone: boolean;
  focusBacMode: boolean;
}) {
  return (
    <div className="rounded-2xl border border-white/10 bg-white/5 p-5">
      <div className="mb-4 flex flex-wrap items-center gap-2">
        <p className="text-xs text-white/60">{chapter.categoryTitle}</p>
        {focusBacMode && chapter.content.focusBacPriority >= 4 ? (
          <span className="rounded-full border border-amber-300/40 bg-amber-500/10 px-2 py-1 text-[10px] font-bold text-amber-200">Chapitre très mobilisé au bac</span>
        ) : null}
      </div>
      <h2 className="text-2xl font-black">{chapter.title}</h2>
      <p className="mt-1 text-white/70">{chapter.description}</p>

      <div className="mt-4 grid gap-4 lg:grid-cols-2">
        <article className="rounded-xl border border-white/10 bg-black/20 p-4">
          <h3 className="mb-2 text-sm font-bold text-cyan-300">Rappel cours</h3>
          <div className="prose prose-invert max-w-none text-sm" dangerouslySetInnerHTML={{ __html: chapter.content.rappelHtml }} />
        </article>
        <article className="rounded-xl border border-white/10 bg-black/20 p-4">
          <h3 className="mb-2 text-sm font-bold text-cyan-300">Méthode bac</h3>
          <div className="prose prose-invert max-w-none text-sm" dangerouslySetInnerHTML={{ __html: chapter.content.methodesHtml }} />
        </article>
      </div>

      <article className="mt-4 rounded-xl border border-rose-300/20 bg-rose-500/10 p-4">
        <h3 className="mb-2 text-sm font-bold text-rose-200">Erreurs classiques</h3>
        <ul className="list-disc space-y-1 pl-5 text-sm text-rose-100/90">
          {chapter.content.erreursClassiques.map((e, i) => (
            <li key={i}>{e}</li>
          ))}
        </ul>
      </article>

      <article className="mt-4 rounded-xl border border-indigo-300/20 bg-indigo-500/10 p-4">
        <h3 className="mb-2 text-sm font-bold text-indigo-200">Checklist bac</h3>
        <ul className="grid list-disc gap-1 pl-5 text-sm text-indigo-100/90 md:grid-cols-2">
          {chapter.content.checklistBac.map((c, i) => (
            <li key={i}>{c}</li>
          ))}
        </ul>
      </article>

      <button onClick={onMarkDone} className={`mt-4 rounded-xl px-4 py-2 text-sm font-bold ${isDone ? 'bg-green-500/30 text-green-100' : 'bg-cyan-500 text-black'}`}>
        {isDone ? 'Chapitre marqué comme fait' : 'Marquer ce chapitre comme fait'}
      </button>
    </div>
  );
}

function TrainingView({
  chapter,
  onBackToCourse,
  onAddErrorTag,
  onAddSRS,
  onRecordWithHint,
  errorTags,
  srsQueue,
}: {
  chapter: Chapter & { categoryId: string; categoryTitle: string };
  onBackToCourse: () => void;
  onAddErrorTag: (tag: string) => void;
  onAddSRS: (key: string, tag?: string) => void;
  onRecordWithHint: (chapterId: string, exerciseIndex: number, hintLevel: 0 | 1 | 2 | 3, baseXP: number) => void;
  errorTags: Record<string, number>;
  srsQueue: Record<string, { nextReview: string; errorTag?: string }>;
}) {
  const [idx, setIdx] = useState(0);
  const [selected, setSelected] = useState<number | null>(null);
  const [answer, setAnswer] = useState('');
  const [submitted, setSubmitted] = useState(false);
  const [hintLevel, setHintLevel] = useState<0 | 1 | 2 | 3>(0);
  const [filterErrorsOnly, setFilterErrorsOnly] = useState(false);

  const baseExercises = chapter.content.exercicesInteractifs;
  const exercises = useMemo(() => {
    if (!filterErrorsOnly) return baseExercises;
    const tags = new Set(Object.keys(errorTags));
    if (tags.size === 0) return baseExercises;
    return baseExercises.filter((e) => {
      const text = `${e.question} ${e.explication}`.toLowerCase();
      return Array.from(tags).some((t) => text.includes(t.toLowerCase()));
    });
  }, [baseExercises, errorTags, filterErrorsOnly]);

  const ex = exercises[Math.min(idx, Math.max(0, exercises.length - 1))] as Exercice | undefined;

  useEffect(() => {
    setSelected(null);
    setAnswer('');
    setSubmitted(false);
    setHintLevel(0);
  }, [idx, chapter.id, filterErrorsOnly]);

  if (!ex) {
    return (
      <div className="rounded-2xl border border-white/10 bg-white/5 p-5">
        <p className="text-sm text-white/80">Aucun exercice ne correspond au filtre “mes erreurs”.</p>
        <button onClick={() => setFilterErrorsOnly(false)} className="mt-3 rounded-lg bg-cyan-500 px-3 py-2 text-sm font-bold text-black">
          Revenir à tous les exercices
        </button>
      </div>
    );
  }
  const exSafe: Exercice = ex;

  const isLast = idx >= exercises.length - 1;

  const hintBlock = chapter.content.miniExoGuide;

  function submit() {
    if (submitted) return;
    let correct = false;

    if (exSafe.type === 'qcm') {
      correct = selected === exSafe.correct;
    } else if (exSafe.type === 'numerique') {
      const expectedNum = typeof exSafe.reponse === 'number' ? exSafe.reponse : Number.NaN;
      const valNum = Number(answer.replace(',', '.'));
      if (Number.isFinite(expectedNum) && Number.isFinite(valNum)) {
        correct = Math.abs(valNum - expectedNum) <= (exSafe.tolerance ?? 1e-3);
      } else {
        correct = answer.trim() === String(exSafe.reponse);
      }
    } else {
      const proposed = answer
        .split(',')
        .map((v) => Number(v.trim()))
        .filter((n) => Number.isFinite(n));
      correct = JSON.stringify(proposed) === JSON.stringify(exSafe.ordreCorrect);
    }

    setSubmitted(true);

    if (correct) {
      onRecordWithHint(chapter.id, idx, hintLevel, 30);
    } else {
      const tag = inferErrorTag(`${exSafe.question} ${exSafe.explication}`);
      onAddErrorTag(tag);
      onAddSRS(`${chapter.id}:${idx}`, tag);
    }
  }

  return (
    <div className="rounded-2xl border border-white/10 bg-white/5 p-5">
      <div className="mb-4 flex flex-wrap items-center justify-between gap-2">
        <div>
          <h2 className="text-xl font-black">Entraînement · {chapter.title}</h2>
          <p className="text-xs text-white/60">Exercice {idx + 1}/{exercises.length}</p>
        </div>
        <div className="flex gap-2">
          <label className="flex items-center gap-2 rounded-lg border border-rose-300/30 bg-rose-500/10 px-3 py-2 text-xs">
            <input type="checkbox" checked={filterErrorsOnly} onChange={(e) => setFilterErrorsOnly(e.target.checked)} />
            mes erreurs (SRS)
          </label>
          <button onClick={onBackToCourse} className="rounded-lg bg-white/10 px-3 py-2 text-xs">Retour cours</button>
        </div>
      </div>

      <p className="mb-4 text-sm font-medium">{exSafe.question}</p>

      {exSafe.type === 'qcm' && (
        <div className="space-y-2">
          {exSafe.options.map((o, i) => (
            <button
              key={i}
              onClick={() => !submitted && setSelected(i)}
              className={`w-full rounded-xl border p-3 text-left text-sm ${
                selected === i ? 'border-cyan-300/50 bg-cyan-500/10' : 'border-white/10 bg-black/20'
              }`}
            >
              <span className="mr-2 text-white/50">{String.fromCharCode(65 + i)}.</span>
              {o}
            </button>
          ))}
        </div>
      )}

      {exSafe.type === 'numerique' && (
        <input
          value={answer}
          onChange={(e) => !submitted && setAnswer(e.target.value)}
          className="w-full rounded-xl border border-white/20 bg-black/20 px-3 py-2 text-sm"
          placeholder="Ta réponse"
        />
      )}

      {exSafe.type === 'ordonnancement' && (
        <div>
          <p className="mb-1 text-xs text-white/70">Réponds sous forme d’indices séparés par des virgules (ex: 2,1,3,0)</p>
          <input
            value={answer}
            onChange={(e) => !submitted && setAnswer(e.target.value)}
            className="w-full rounded-xl border border-white/20 bg-black/20 px-3 py-2 text-sm"
            placeholder={exSafe.etapesDesordre.map((_, i) => i).join(',')}
          />
          <ul className="mt-2 list-disc pl-5 text-xs text-white/70">
            {exSafe.etapesDesordre.map((step, i) => (
              <li key={i}>[{i}] {step}</li>
            ))}
          </ul>
        </div>
      )}

      {!submitted ? (
        <div className="mt-4 flex flex-wrap gap-2">
          <button onClick={submit} className="rounded-xl bg-cyan-500 px-4 py-2 text-sm font-bold text-black">Valider</button>
          <button onClick={() => setHintLevel((h) => (h >= 3 ? 3 : ((h + 1) as 0 | 1 | 2 | 3)))} className="rounded-xl bg-amber-500/20 px-4 py-2 text-sm font-bold text-amber-200">
            Indice niveau {hintLevel}
          </button>
        </div>
      ) : (
        <div className="mt-4 rounded-xl border border-white/10 bg-black/20 p-4">
          <p className="text-sm text-white/80">{exSafe.explication}</p>
          <div className="mt-2 rounded-lg border border-indigo-400/30 bg-indigo-500/10 p-3 text-xs">
            <p className="font-bold text-indigo-200">Coach de rédaction (non IA)</p>
            <p className="mt-1 text-indigo-100/90">Relis ta rédaction: définition, formule, calcul, conclusion. Rédige toujours une phrase finale contextualisée.</p>
          </div>
          {isLast ? (
            <button onClick={() => setIdx(0)} className="mt-3 rounded-xl bg-indigo-500 px-4 py-2 text-sm font-bold">Recommencer série</button>
          ) : (
            <button onClick={() => setIdx((v) => v + 1)} className="mt-3 rounded-xl bg-indigo-500 px-4 py-2 text-sm font-bold">Exercice suivant</button>
          )}
        </div>
      )}

      {hintLevel > 0 ? (
        <div className="mt-4 rounded-xl border border-amber-400/30 bg-amber-500/10 p-3 text-sm text-amber-100">
          {hintLevel >= 1 ? <p><b>Indice :</b> {hintBlock.attenduHtml}</p> : null}
          {hintLevel >= 2 ? <p className="mt-2"><b>Début de raisonnement :</b> Utilise la méthode du chapitre pas à pas.</p> : null}
          {hintLevel >= 3 ? <div className="mt-2"><b>Correction guidée :</b><div dangerouslySetInnerHTML={{ __html: hintBlock.correctionHtml }} /></div> : null}
          <p className="mt-2 text-xs">Malus XP actif: {hintLevel === 1 ? '-10%' : hintLevel === 2 ? '-30%' : hintLevel === 3 ? '-100%' : '0%'}</p>
        </div>
      ) : null}

      <div className="mt-4 rounded-xl border border-rose-400/30 bg-rose-500/10 p-3 text-xs text-rose-100">
        <p className="font-bold">Carnet d’erreurs (SRS)</p>
        <div className="mt-2 flex flex-wrap gap-2">
          {Object.entries(srsQueue)
            .filter(([, item]) => !!item.errorTag)
            .slice(0, 8)
            .map(([k, item]) => (
              <span key={k} className="rounded-full border border-rose-300/30 px-2 py-1">
                {item.errorTag}
              </span>
            ))}
        </div>
      </div>
    </div>
  );
}

function BacView({
  onFinish,
  showMathInput,
  onToggleMathInput,
}: {
  onFinish: (xp: number, errors: string[], checklistComplete: boolean) => void;
  showMathInput: boolean;
  onToggleMathInput: () => void;
}) {
  const [duration, setDuration] = useState<30 | 60 | 120 | 240>(60);
  const [difficulty, setDifficulty] = useState<1 | 2 | 3 | 4 | 5 | 'all'>('all');
  const [mixComplet, setMixComplet] = useState(true);
  const [theme, setTheme] = useState('all');
  const [phase, setPhase] = useState<'setup' | 'active' | 'done'>('setup');
  const [subject, setSubject] = useState<BacSujet | null>(null);
  const [questionIndex, setQuestionIndex] = useState(0);
  const [answers, setAnswers] = useState<Record<string, string>>({});
  const [autoEval, setAutoEval] = useState<Record<string, AutoEval>>({});
  const [checklist, setChecklist] = useState<Record<string, boolean>>({});
  const [timeLeft, setTimeLeft] = useState(0);

  const allThemes = useMemo(() => {
    const set = new Set<string>();
    bacSubjectsTerminale.forEach((s) => s.tags.forEach((t) => set.add(t)));
    return Array.from(set).sort();
  }, []);

  const filtered = useMemo(() => {
    return bacSubjectsTerminale.filter((s) => {
      const okDuration = s.dureeMin === duration;
      const okDiff = difficulty === 'all' ? true : s.difficulte === difficulty;
      const okTheme = theme === 'all' ? true : s.tags.includes(theme);
      const okMix = mixComplet ? true : s.tags.some((t) => ['analyse', 'espace', 'probabilités', 'mix complet'].includes(t));
      return okDuration && okDiff && okTheme && okMix;
    });
  }, [duration, difficulty, theme, mixComplet]);

  const questions = useMemo(() => {
    if (!subject) return [] as Array<{ exTitle: string; theme: string; q: BacQuestion }>;
    return subject.exercices.flatMap((ex) => ex.questions.map((q) => ({ exTitle: ex.titre, theme: ex.theme, q })));
  }, [subject]);

  useEffect(() => {
    if (phase !== 'active') return;
    if (timeLeft <= 0) {
      setPhase('done');
      return;
    }
    const timer = setInterval(() => setTimeLeft((t) => t - 1), 1000);
    return () => clearInterval(timer);
  }, [phase, timeLeft]);

  const current = questions[questionIndex];

  function startExam() {
    const chosen = filtered[0] ?? bacSubjectsTerminale.find((s) => s.dureeMin === duration) ?? bacSubjectsTerminale[0];
    setSubject(chosen);
    setPhase('active');
    setQuestionIndex(0);
    setAnswers({});
    setAutoEval({});
    setChecklist({});
    setTimeLeft(duration * 60);
  }

  function finishExam() {
    setPhase('done');
    const checklistComplete = bacChecklistLabels.every((item) => checklist[item]);
    let xp = 0;
    const errors: string[] = [];
    questions.forEach(({ q }) => {
      const state = autoEval[q.id];
      if (state === 'acquis') xp += 30;
      else if (state === 'a_revoir') xp += 10;
      else if (state === 'incompris') {
        const tag = inferErrorTag(`${q.texteHtml} ${q.erreursClassiques.join(' ')}`);
        errors.push(tag);
      }
    });
    if (!checklistComplete) xp = Math.floor(xp * 0.7);
    onFinish(xp, errors, checklistComplete);
  }

  if (phase === 'setup') {
    return (
      <div className="space-y-4 rounded-2xl border border-white/10 bg-white/5 p-5">
        <h2 className="text-2xl font-black">Prépa Bac · Mode épreuve</h2>
        <p className="text-sm text-white/70">Timer visible, correction masquée jusqu’à “Terminer”.</p>

        <div className="grid gap-3 md:grid-cols-4">
          <label className="text-sm">Durée
            <select value={duration} onChange={(e) => setDuration(Number(e.target.value) as 30 | 60 | 120 | 240)} className="mt-1 w-full rounded-lg border border-white/20 bg-black/30 px-3 py-2">
              {[30, 60, 120, 240].map((d) => <option key={d} value={d}>{d} min</option>)}
            </select>
          </label>
          <label className="text-sm">Difficulté
            <select value={difficulty} onChange={(e) => setDifficulty(e.target.value === 'all' ? 'all' : Number(e.target.value) as 1 | 2 | 3 | 4 | 5)} className="mt-1 w-full rounded-lg border border-white/20 bg-black/30 px-3 py-2">
              <option value="all">Toutes</option>
              {[1, 2, 3, 4, 5].map((d) => <option key={d} value={d}>Niveau {d}</option>)}
            </select>
          </label>
          <label className="text-sm">Thème
            <select value={theme} onChange={(e) => setTheme(e.target.value)} className="mt-1 w-full rounded-lg border border-white/20 bg-black/30 px-3 py-2">
              <option value="all">Mix complet</option>
              {allThemes.map((t) => <option key={t} value={t}>{t}</option>)}
            </select>
          </label>
          <label className="flex items-end gap-2 text-sm">
            <input type="checkbox" checked={mixComplet} onChange={(e) => setMixComplet(e.target.checked)} />
            mix complet
          </label>
        </div>

        <div className="rounded-xl border border-cyan-300/20 bg-cyan-500/10 p-3 text-sm">
          {filtered.length > 0 ? (
            <p>Sujet retenu: <b>{filtered[0].titre}</b> ({filtered[0].baremeTotal} pts)</p>
          ) : (
            <p>Aucun sujet exact. Un sujet compatible sera sélectionné au démarrage.</p>
          )}
        </div>

        <button onClick={startExam} className="rounded-xl bg-cyan-500 px-5 py-3 text-sm font-black text-black">Démarrer l’épreuve</button>
      </div>
    );
  }

  if (phase === 'active' && current) {
    const mm = String(Math.floor(Math.max(0, timeLeft) / 60)).padStart(2, '0');
    const ss = String(Math.max(0, timeLeft) % 60).padStart(2, '0');
    return (
      <div className="space-y-4 rounded-2xl border border-white/10 bg-white/5 p-5">
        <div className="flex flex-wrap items-center justify-between gap-2">
          <div>
            <p className="text-xs text-white/60">{subject?.titre}</p>
            <h3 className="text-lg font-black">Question {questionIndex + 1}/{questions.length}</h3>
          </div>
          <div role="timer" className={`rounded-xl px-4 py-2 text-lg font-black ${timeLeft <= 60 ? 'bg-rose-500/20 text-rose-200' : timeLeft <= 300 ? 'bg-amber-500/20 text-amber-100' : 'bg-indigo-500/20 text-indigo-100'}`}>
            {mm}:{ss}
          </div>
        </div>

        <div className="rounded-xl border border-white/10 bg-black/20 p-4">
          <p className="mb-2 text-xs text-white/60">{current.exTitle} · {current.theme} · {current.q.points} pts</p>
          <div className="prose prose-invert max-w-none text-sm" dangerouslySetInnerHTML={{ __html: current.q.texteHtml }} />
        </div>

        <textarea
          value={answers[current.q.id] ?? ''}
          onChange={(e) => setAnswers((prev) => ({ ...prev, [current.q.id]: e.target.value }))}
          className="min-h-[140px] w-full rounded-xl border border-white/20 bg-black/20 px-3 py-2 text-sm"
          placeholder="Rédige ta réponse ici..."
        />

        <label className="flex items-center gap-2 text-xs text-white/80">
          <input type="checkbox" checked={showMathInput} onChange={onToggleMathInput} />
          Saisie mathématique (MathInput)
        </label>
        {showMathInput ? (
          <MathInput
            onChange={(latex) => setAnswers((prev) => ({ ...prev, [current.q.id]: `${prev[current.q.id] ?? ''}\n[LaTeX] ${latex}` }))}
            placeholder="Saisis une expression mathématique"
          />
        ) : null}

        <div className="flex flex-wrap gap-2">
          <button onClick={() => setQuestionIndex((i) => Math.max(0, i - 1))} disabled={questionIndex === 0} className="rounded-lg bg-white/10 px-3 py-2 text-sm disabled:opacity-40">Précédent</button>
          <button onClick={() => setQuestionIndex((i) => Math.min(questions.length - 1, i + 1))} disabled={questionIndex === questions.length - 1} className="rounded-lg bg-white/10 px-3 py-2 text-sm disabled:opacity-40">Suivant</button>
          <button onClick={finishExam} className="ml-auto rounded-lg bg-cyan-500 px-4 py-2 text-sm font-bold text-black">Terminer l’épreuve</button>
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-4 rounded-2xl border border-white/10 bg-white/5 p-5">
      <h2 className="text-2xl font-black">Correction & auto-évaluation</h2>

      <div className="rounded-xl border border-indigo-300/20 bg-indigo-500/10 p-4">
        <h3 className="mb-2 text-sm font-bold text-indigo-200">Checklist globale “copie bac”</h3>
        <div className="grid gap-2 md:grid-cols-2">
          {bacChecklistLabels.map((item) => (
            <label key={item} className="flex items-center gap-2 text-sm">
              <input type="checkbox" checked={!!checklist[item]} onChange={(e) => setChecklist((prev) => ({ ...prev, [item]: e.target.checked }))} />
              {item}
            </label>
          ))}
        </div>
        {!bacChecklistLabels.every((i) => checklist[i]) ? (
          <p className="mt-2 text-xs text-amber-200">Checklist incomplète: XP final réduit (pédagogie de rédaction).</p>
        ) : null}
      </div>

      <div className="space-y-3">
        {questions.map(({ q, exTitle }) => (
          <div key={q.id} className="rounded-xl border border-white/10 bg-black/20 p-4">
            <p className="mb-1 text-xs text-white/60">{exTitle} · {q.points} pts</p>
            <div className="prose prose-invert max-w-none text-sm" dangerouslySetInnerHTML={{ __html: q.texteHtml }} />
            <div className="mt-3 grid gap-2 md:grid-cols-3">
              <div className="rounded-lg border border-cyan-300/20 bg-cyan-500/10 p-2 text-xs">
                <p className="font-bold text-cyan-200">Attendu</p>
                <div dangerouslySetInnerHTML={{ __html: q.attenduHtml }} />
              </div>
              <div className="rounded-lg border border-indigo-300/20 bg-indigo-500/10 p-2 text-xs">
                <p className="font-bold text-indigo-200">Méthode</p>
                <div dangerouslySetInnerHTML={{ __html: q.methodoHtml }} />
              </div>
              <div className="rounded-lg border border-green-300/20 bg-green-500/10 p-2 text-xs">
                <p className="font-bold text-green-200">Correction</p>
                <div dangerouslySetInnerHTML={{ __html: q.correctionHtml }} />
              </div>
            </div>
            <div className="mt-2 flex flex-wrap gap-2 text-xs">
              {q.erreursClassiques.map((e, i) => (
                <span key={i} className="rounded-full border border-rose-300/30 bg-rose-500/10 px-2 py-1 text-rose-200">{e}</span>
              ))}
            </div>

            <div className="mt-3 flex flex-wrap gap-2">
              {[
                ['acquis', 'Acquis'],
                ['a_revoir', 'À revoir'],
                ['incompris', 'Incompris'],
              ].map(([value, label]) => (
                <label key={value} className="flex items-center gap-1 rounded-lg border border-white/20 bg-white/5 px-3 py-1 text-xs">
                  <input
                    type="radio"
                    name={`autoeval-${q.id}`}
                    checked={autoEval[q.id] === value}
                    onChange={() => setAutoEval((prev) => ({ ...prev, [q.id]: value as AutoEval }))}
                  />
                  {label}
                </label>
              ))}
            </div>
          </div>
        ))}
      </div>

      <button onClick={finishExam} className="rounded-xl bg-cyan-500 px-5 py-3 text-sm font-black text-black">Valider l’auto-évaluation et attribuer XP</button>
    </div>
  );
}

function ToolsView() {
  return (
    <>
      <section className="rounded-2xl border border-white/10 bg-white/5 p-5">
        <h2 className="text-xl font-black">Coach de rédaction (non IA)</h2>
        <p className="mt-2 text-sm text-white/80">Structure recommandée: 1) Hypothèses 2) Théorème/outil 3) Calcul détaillé 4) Conclusion en français avec l’objet mathématique final.</p>
        <ul className="mt-3 list-disc space-y-1 pl-5 text-sm text-white/80">
          <li>Éviter les sauts logiques non justifiés.</li>
          <li>Écrire les équivalences uniquement quand elles sont valides.</li>
          <li>Soigner les notations (intervalle, appartenance, quantificateurs).</li>
          <li>Toujours relire les signes et les unités.</li>
        </ul>
      </section>

      <section className="rounded-2xl border border-white/10 bg-white/5 p-5">
        <h2 className="mb-3 text-xl font-black">Formules utiles Terminale</h2>
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b border-white/10 text-left text-white/60">
                <th className="p-2">Thème</th>
                <th className="p-2">Formule</th>
                <th className="p-2">Remarque</th>
              </tr>
            </thead>
            <tbody>
              <tr className="border-b border-white/10"><td className="p-2">Distance point-plan</td><td className="p-2">{'$d=\\dfrac{|ax_0+by_0+cz_0+d|}{\\sqrt{a^2+b^2+c^2}}$'}</td><td className="p-2">Valeur absolue obligatoire</td></tr>
              <tr className="border-b border-white/10"><td className="p-2">Binomiale</td><td className="p-2">{'$P(X=k)=\\binom{n}{k}p^k(1-p)^{n-k}$'}</td><td className="p-2">Justifier n essais indépendants</td></tr>
              <tr className="border-b border-white/10"><td className="p-2">TVI</td><td className="p-2">f continue + k entre f(a),f(b)</td><td className="p-2">Existence d’une solution</td></tr>
              <tr><td className="p-2">Tangente</td><td className="p-2">$y=f'(a)(x-a)+f(a)$</td><td className="p-2">Équation exacte</td></tr>
            </tbody>
          </table>
        </div>
      </section>

      <section className="grid gap-4 lg:grid-cols-2">
        <div className="rounded-2xl border border-white/10 bg-white/5 p-5">
          <h2 className="mb-2 text-xl font-black">Python mini-lab</h2>
          <PythonIDE initialCode={'import random\n\ndef freq(n, p):\n    s=0\n    for _ in range(n):\n        if random.random()<p:\n            s += 1\n    return s/n\n\nprint(freq(1000, 0.3))\n'} />
        </div>
        <div className="space-y-4">
          <div className="rounded-2xl border border-white/10 bg-white/5 p-4"><TangenteGlissante /></div>
          <div className="rounded-2xl border border-white/10 bg-white/5 p-4"><MonteCarloSim /></div>
          <div className="rounded-2xl border border-white/10 bg-white/5 p-4"><VectorProjector /></div>
        </div>
      </section>
    </>
  );
}
