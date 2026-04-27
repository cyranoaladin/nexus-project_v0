'use client';

import { useState, useEffect, useCallback } from 'react';
import {
  Target, CheckCircle, AlertTriangle, ChevronRight, ChevronLeft,
  HelpCircle, FileQuestion, Clock, Brain, ShieldAlert, EyeOff,
  Loader2, BarChart2, RotateCcw
} from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { DOMAINS, CHAPTERS, QUESTIONS_QCM, QUESTIONS_OPEN } from '@/lib/diagnostic/maths-terminale/data';
import { computeDiagnostics, generateAdvancedPath, generatePostStagePlan } from '@/lib/diagnostic/maths-terminale/scoring';
import type {
  ChapterProgress, OpenAnswer, DiagnosticResult, ChapterResult, PedagogicalStatus
} from '@/lib/diagnostic/maths-terminale/types';

// ─── Math Renderer (simple inline/block display until KaTeX is installed) ────

function MathRenderer({ content }: { content: string }) {
  if (!content) return null;
  const parts = content.split(/(\$\$[\s\S]*?\$\$|\$[\s\S]*?\$)/g);
  return (
    <span className="leading-relaxed">
      {parts.map((part, i) => {
        if (part.startsWith('$$')) {
          return (
            <div key={i} className="font-mono text-center my-2 text-sm bg-white/5 py-2 px-3 rounded border border-white/10 overflow-x-auto">
              {part.slice(2, -2)}
            </div>
          );
        }
        if (part.startsWith('$')) {
          return (
            <span key={i} className="font-mono bg-white/10 px-1.5 py-0.5 rounded mx-0.5 text-sm whitespace-nowrap">
              {part.slice(1, -1)}
            </span>
          );
        }
        return <span key={i}>{part}</span>;
      })}
    </span>
  );
}

// ─── Status Badge ─────────────────────────────────────────────────────────────

function StatusBadge({ status }: { status: PedagogicalStatus | string }) {
  const colors: Record<string, string> = {
    'Non renseigné': 'bg-neutral-700 text-neutral-300 border-neutral-600 border-dashed',
    'Non encore vu': 'bg-neutral-700 text-neutral-400 border-neutral-600',
    'Découverte prioritaire': 'bg-fuchsia-500/20 text-fuchsia-300 border-fuchsia-500/30',
    'Déclaré vu mais non évalué': 'bg-purple-500/20 text-purple-300 border-purple-500/30',
    'Non vu déclaré, réussite observée': 'bg-indigo-500/20 text-indigo-300 border-indigo-500/30',
    'Lacune critique': 'bg-red-500/20 text-red-300 border-red-500/30',
    'Très fragile': 'bg-orange-500/20 text-orange-300 border-orange-500/30',
    'Fragile': 'bg-yellow-500/20 text-yellow-300 border-yellow-500/30',
    'À consolider': 'bg-blue-500/20 text-blue-300 border-blue-500/30',
    'Maîtrisé': 'bg-emerald-500/20 text-emerald-300 border-emerald-500/30',
    'Point fort': 'bg-teal-500/20 text-teal-300 border-teal-500/30',
  };
  const color = colors[status] ?? 'bg-neutral-700 text-neutral-300';
  return (
    <span className={`px-2 py-0.5 rounded-full text-xs font-medium border ${color} whitespace-nowrap`}>
      {status}
    </span>
  );
}

// ─── Intro Step ───────────────────────────────────────────────────────────────

function IntroStep({ onStart }: { onStart: () => void }) {
  return (
    <div className="max-w-2xl mx-auto text-center space-y-6 py-8">
      <div className="mx-auto w-16 h-16 bg-blue-500/20 text-blue-400 rounded-full flex items-center justify-center">
        <Target size={32} />
      </div>
      <div>
        <h2 className="text-2xl font-bold text-white mb-2">Bilan Diagnostic Maths Terminale</h2>
        <p className="text-neutral-400">Spécialité Mathématiques — Terminale EDS</p>
      </div>
      <Card className="bg-surface-card border-white/10 text-left">
        <CardContent className="p-5 space-y-3">
          <div className="flex items-start gap-3">
            <CheckCircle className="w-5 h-5 text-emerald-400 mt-0.5 shrink-0" />
            <div>
              <p className="text-sm font-medium text-white">Objectif pédagogique</p>
              <p className="text-sm text-neutral-400">Ce diagnostic identifie précisément ce que tu maîtrises, ce qui est fragile et ce qui n'a pas encore été vu, pour générer un parcours intensif de 16h adapté.</p>
            </div>
          </div>
          <div className="flex items-start gap-3">
            <Clock className="w-5 h-5 text-blue-400 mt-0.5 shrink-0" />
            <div>
              <p className="text-sm font-medium text-white">Durée estimée</p>
              <p className="text-sm text-neutral-400">Environ 45–60 min pour compléter l'étape QCM + exercices ouverts. Tu peux sauvegarder et reprendre à tout moment.</p>
            </div>
          </div>
          <div className="flex items-start gap-3">
            <Brain className="w-5 h-5 text-purple-400 mt-0.5 shrink-0" />
            <div>
              <p className="text-sm font-medium text-white">3 étapes</p>
              <p className="text-sm text-neutral-400">1. Avancement par chapitre — 2. QCM interactifs (48 questions) — 3. Exercices de rédaction (8 exercices)</p>
            </div>
          </div>
        </CardContent>
      </Card>
      <Button onClick={onStart} className="bg-blue-600 hover:bg-blue-500 text-white font-bold px-8">
        Démarrer le diagnostic <ChevronRight className="ml-2 w-4 h-4" />
      </Button>
    </div>
  );
}

// ─── Progress Step ────────────────────────────────────────────────────────────

function ProgressStep({
  progress,
  setProgress,
  onNext,
}: {
  progress: Record<string, ChapterProgress>;
  setProgress: (p: Record<string, ChapterProgress>) => void;
  onNext: () => void;
}) {
  const [currentDomainIdx, setCurrentDomainIdx] = useState(0);
  const [showAlert, setShowAlert] = useState(false);

  const domain = DOMAINS[currentDomainIdx];
  const domainChapters = CHAPTERS.filter(c => c.domainId === domain.id);

  const updateProg = (cId: string, field: 'declared' | 'confidence', val: number) => {
    setProgress({
      ...progress,
      [cId]: { ...(progress[cId] || { declared: null, confidence: 3 }), [field]: val },
    });
    setShowAlert(false);
  };

  const handleNext = () => {
    const allFilled = domainChapters.every(
      c => progress[c.id] && progress[c.id].declared !== null && progress[c.id].declared !== undefined
    );
    if (!allFilled && !showAlert) {
      setShowAlert(true);
      return;
    }
    if (currentDomainIdx < DOMAINS.length - 1) {
      setCurrentDomainIdx(currentDomainIdx + 1);
      setShowAlert(false);
    } else {
      onNext();
    }
  };

  return (
    <div className="max-w-3xl mx-auto space-y-4">
      <div className="flex justify-between items-center">
        <h2 className="text-xl font-bold text-white">Étape 1 — Avancement par chapitre</h2>
        <span className="bg-blue-500/20 text-blue-300 text-xs font-bold px-3 py-1 rounded-full border border-blue-500/30">
          Domaine {currentDomainIdx + 1}/{DOMAINS.length}
        </span>
      </div>

      {showAlert && (
        <div className="bg-yellow-500/10 border border-yellow-500/30 p-3 rounded-lg flex gap-2">
          <AlertTriangle className="text-yellow-400 shrink-0 w-4 h-4 mt-0.5" />
          <p className="text-sm text-yellow-300">Certains chapitres ne sont pas renseignés. Clique à nouveau sur "Suivant" pour continuer quand même.</p>
        </div>
      )}

      <Card className="bg-surface-card border-white/10">
        <CardHeader className="pb-3 border-b border-white/10">
          <CardTitle className="text-blue-300 text-lg">{domain.title}</CardTitle>
        </CardHeader>
        <CardContent className="p-4 space-y-4">
          {domainChapters.map(chap => {
            const p = progress[chap.id] || {};
            const isMissing = p.declared === null || p.declared === undefined;
            return (
              <div
                key={chap.id}
                className={`p-3 rounded-lg border transition-colors ${
                  isMissing && showAlert
                    ? 'border-red-500/40 bg-red-500/5'
                    : 'border-white/10 bg-white/5'
                }`}
              >
                <div className="flex justify-between items-center mb-2">
                  <span className="text-sm font-medium text-neutral-100">{chap.title}</span>
                  {chap.bacPriority >= 5 && (
                    <span className="text-[10px] font-bold uppercase text-yellow-400 border border-yellow-500/30 px-1.5 py-0.5 rounded">BAC ★</span>
                  )}
                </div>
                <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                  <div>
                    <label className="block text-[10px] font-bold text-neutral-500 uppercase mb-1">Statut en classe</label>
                    <select
                      className="w-full text-sm p-1.5 border border-white/10 rounded bg-surface-darker text-neutral-100"
                      value={isMissing ? '' : String(p.declared)}
                      onChange={e => updateProg(chap.id, 'declared', parseInt(e.target.value, 10))}
                    >
                      <option value="" disabled>Choisir...</option>
                      <option value="0">Pas encore vu</option>
                      <option value="1">Vu rapidement</option>
                      <option value="2">Vu mais peu exercé</option>
                      <option value="3">Vu et exercé</option>
                      <option value="4">Vu, exercé, évalué</option>
                      <option value="5">Je pense maîtriser</option>
                    </select>
                  </div>
                  {!isMissing && (p.declared ?? 0) > 0 && (
                    <div>
                      <label className="block text-[10px] font-bold text-neutral-500 uppercase mb-1">
                        Confiance : {p.confidence ?? 3}/5
                      </label>
                      <input
                        type="range" min="1" max="5" step="1"
                        className="w-full accent-blue-500"
                        value={p.confidence ?? 3}
                        onChange={e => updateProg(chap.id, 'confidence', parseInt(e.target.value, 10))}
                      />
                    </div>
                  )}
                </div>
              </div>
            );
          })}
        </CardContent>
      </Card>

      <div className="flex justify-between">
        <Button
          variant="outline"
          disabled={currentDomainIdx === 0}
          onClick={() => { setCurrentDomainIdx(currentDomainIdx - 1); setShowAlert(false); }}
          className="border-white/10 text-neutral-300"
        >
          <ChevronLeft className="mr-2 w-4 h-4" /> Précédent
        </Button>
        <Button onClick={handleNext} className="bg-blue-600 hover:bg-blue-500 text-white">
          {showAlert ? 'Continuer quand même' : currentDomainIdx < DOMAINS.length - 1 ? 'Domaine suivant' : 'Passer aux QCM'}
          <ChevronRight className="ml-2 w-4 h-4" />
        </Button>
      </div>
    </div>
  );
}

// ─── QCM Step ─────────────────────────────────────────────────────────────────

function QcmStep({
  qcmAnswers,
  setQcmAnswers,
  onNext,
}: {
  qcmAnswers: Record<string, number>;
  setQcmAnswers: (a: Record<string, number>) => void;
  onNext: () => void;
}) {
  const [currentBlock, setCurrentBlock] = useState(0);
  const [showValidation, setShowValidation] = useState(false);
  const questionsPerBlock = 6;
  const totalBlocks = Math.ceil(QUESTIONS_QCM.length / questionsPerBlock);
  const blockQuestions = QUESTIONS_QCM.slice(
    currentBlock * questionsPerBlock,
    (currentBlock + 1) * questionsPerBlock
  );

  if (showValidation) {
    const answered = QUESTIONS_QCM.filter(q => qcmAnswers[q.id] >= 0).length;
    const dontKnow = QUESTIONS_QCM.filter(q => qcmAnswers[q.id] === -1).length;
    const unanswered = QUESTIONS_QCM.length - answered - dontKnow;

    return (
      <div className="max-w-xl mx-auto text-center py-8 space-y-6">
        <HelpCircle className="w-12 h-12 text-blue-400 mx-auto" />
        <h2 className="text-xl font-bold text-white">Bilan du QCM</h2>
        <div className="grid grid-cols-3 gap-3">
          <Card className="bg-surface-card border-white/10">
            <CardContent className="p-4 text-center">
              <div className="text-3xl font-bold text-white">{answered}</div>
              <div className="text-xs text-neutral-400 mt-1">Répondues</div>
            </CardContent>
          </Card>
          <Card className="bg-surface-card border-white/10">
            <CardContent className="p-4 text-center">
              <div className="text-3xl font-bold text-white">{dontKnow}</div>
              <div className="text-xs text-neutral-400 mt-1">Je ne sais pas</div>
            </CardContent>
          </Card>
          <Card className={`border ${unanswered > 0 ? 'bg-orange-500/10 border-orange-500/30' : 'bg-surface-card border-white/10'}`}>
            <CardContent className="p-4 text-center">
              <div className={`text-3xl font-bold ${unanswered > 0 ? 'text-orange-300' : 'text-white'}`}>{unanswered}</div>
              <div className="text-xs text-neutral-400 mt-1">Non répondues</div>
            </CardContent>
          </Card>
        </div>
        <div className="flex justify-center gap-3">
          <Button variant="outline" onClick={() => setShowValidation(false)} className="border-white/10 text-neutral-300">
            Revenir aux QCM
          </Button>
          <Button onClick={onNext} className="bg-blue-600 hover:bg-blue-500 text-white">
            Passer aux exercices <ChevronRight className="ml-2 w-4 h-4" />
          </Button>
        </div>
      </div>
    );
  }

  return (
    <div className="max-w-3xl mx-auto space-y-4">
      <div className="flex justify-between items-center">
        <h2 className="text-xl font-bold text-white">Étape 2 — QCM Interactifs</h2>
        <span className="bg-blue-500/20 text-blue-300 text-xs font-bold px-3 py-1 rounded-full border border-blue-500/30">
          Bloc {currentBlock + 1}/{totalBlocks}
        </span>
      </div>

      <div className="space-y-4">
        {blockQuestions.map(q => {
          const cAns = qcmAnswers[q.id];
          const chap = CHAPTERS.find(c => c.id === q.chapterId);
          return (
            <Card
              key={q.id}
              className={`border transition-colors ${
                cAns === undefined ? 'bg-surface-card border-white/10'
                : cAns === -1 ? 'bg-surface-card border-white/5'
                : 'bg-blue-500/5 border-blue-500/20'
              }`}
            >
              <CardContent className="p-4 space-y-3">
                <div className="flex items-center gap-2 flex-wrap">
                  <span className="text-[10px] font-bold bg-white/10 px-2 py-0.5 rounded text-neutral-400">{chap?.title}</span>
                  <span className="text-[10px] font-bold text-blue-400 border border-blue-500/30 px-2 py-0.5 rounded-full uppercase">{q.skillType}</span>
                  <span className="text-[10px] text-neutral-500 border border-white/10 px-2 py-0.5 rounded-full">Niv. {q.difficulty}</span>
                </div>
                <div className="text-sm font-medium text-neutral-100">
                  <MathRenderer content={q.statement} />
                </div>
                <div className="grid grid-cols-1 md:grid-cols-2 gap-2">
                  {q.choices.map((choice, idx) => (
                    <button
                      key={idx}
                      onClick={() => setQcmAnswers({ ...qcmAnswers, [q.id]: idx })}
                      className={`p-2.5 text-left text-sm border rounded-lg transition-colors ${
                        cAns === idx
                          ? 'border-blue-500 bg-blue-500/20 text-blue-200 font-medium'
                          : 'border-white/10 hover:bg-white/5 text-neutral-300'
                      }`}
                    >
                      <MathRenderer content={choice} />
                    </button>
                  ))}
                </div>
                <div className="flex justify-end">
                  <button
                    onClick={() => setQcmAnswers({ ...qcmAnswers, [q.id]: -1 })}
                    className={`text-xs px-3 py-1.5 rounded border transition-colors ${
                      cAns === -1
                        ? 'bg-white/10 border-white/20 text-neutral-200 font-bold'
                        : 'bg-transparent text-neutral-500 border-white/10 hover:bg-white/5'
                    }`}
                  >
                    Je ne sais pas
                  </button>
                </div>
              </CardContent>
            </Card>
          );
        })}
      </div>

      <div className="flex justify-between">
        <Button
          variant="outline"
          disabled={currentBlock === 0}
          onClick={() => setCurrentBlock(currentBlock - 1)}
          className="border-white/10 text-neutral-300"
        >
          <ChevronLeft className="mr-2 w-4 h-4" /> Précédent
        </Button>
        <Button
          onClick={() => {
            if (currentBlock < totalBlocks - 1) setCurrentBlock(currentBlock + 1);
            else setShowValidation(true);
          }}
          className="bg-blue-600 hover:bg-blue-500 text-white"
        >
          {currentBlock < totalBlocks - 1 ? 'Bloc suivant' : 'Terminer QCM'} <ChevronRight className="ml-2 w-4 h-4" />
        </Button>
      </div>
    </div>
  );
}

// ─── Open Step ────────────────────────────────────────────────────────────────

function OpenStep({
  openAnswers,
  setOpenAnswers,
  onFinish,
}: {
  openAnswers: Record<string, OpenAnswer>;
  setOpenAnswers: (a: Record<string, OpenAnswer>) => void;
  onFinish: () => void;
}) {
  const [currentEx, setCurrentEx] = useState(0);
  const [showValidation, setShowValidation] = useState(false);
  const q = QUESTIONS_OPEN[currentEx];
  const ans = openAnswers[q?.id] || { text: '', status: '' };

  const updateAns = (field: keyof OpenAnswer, val: string) => {
    setOpenAnswers({
      ...openAnswers,
      [q.id]: { ...(openAnswers[q.id] || { text: '', status: '' }), [field]: val },
    });
  };

  if (showValidation) {
    const withDraft = Object.values(openAnswers).filter(a => a.text && a.text.trim().length > 5).length;
    return (
      <div className="max-w-xl mx-auto text-center py-8 space-y-6">
        <FileQuestion className="w-12 h-12 text-blue-400 mx-auto" />
        <h2 className="text-xl font-bold text-white">Validation Finale</h2>
        <Card className="bg-surface-card border-white/10">
          <CardContent className="p-4 text-center">
            <div className="text-3xl font-bold text-white">{withDraft}/{QUESTIONS_OPEN.length}</div>
            <div className="text-xs text-neutral-400 mt-1">Exercices avec brouillon</div>
          </CardContent>
        </Card>
        <div className="flex justify-center gap-3">
          <Button variant="outline" onClick={() => setShowValidation(false)} className="border-white/10 text-neutral-300">
            Revenir aux exercices
          </Button>
          <Button onClick={onFinish} className="bg-emerald-600 hover:bg-emerald-500 text-white">
            Générer mon bilan <CheckCircle className="ml-2 w-4 h-4" />
          </Button>
        </div>
      </div>
    );
  }

  return (
    <div className="max-w-4xl mx-auto space-y-4">
      <div className="flex justify-between items-center">
        <h2 className="text-xl font-bold text-white">Étape 3 — Exercices de rédaction</h2>
        <span className="bg-blue-500/20 text-blue-300 text-xs font-bold px-3 py-1 rounded-full border border-blue-500/30">
          Exercice {currentEx + 1}/{QUESTIONS_OPEN.length}
        </span>
      </div>

      <Card className="bg-surface-card border-white/10">
        <CardContent className="p-5">
          <div className="flex flex-col md:flex-row gap-6">
            <div className="flex-1 space-y-3">
              <h3 className="font-bold text-white border-b border-white/10 pb-2">{q.title}</h3>
              <div className="bg-white/5 p-4 rounded-lg border border-white/10 text-sm text-neutral-300 whitespace-pre-wrap">
                <MathRenderer content={q.statement} />
              </div>
              <div className="text-xs text-neutral-500">
                Total : {q.maxPoints} points • {q.rubrics.length} critères d'évaluation
              </div>
            </div>
            <div className="flex-1 space-y-4">
              <div>
                <label className="block text-xs font-bold text-neutral-400 uppercase mb-2">Ton ressenti avant de commencer :</label>
                <div className="flex flex-col gap-2">
                  {["Je sais faire", "Je sais commencer mais je bloque", "Je ne sais pas démarrer"].map(status => (
                    <button
                      key={status}
                      onClick={() => updateAns('status', status)}
                      className={`px-3 py-2 text-sm rounded-lg border font-medium text-left transition-colors ${
                        ans.status === status
                          ? 'bg-blue-600 text-white border-blue-600'
                          : 'bg-white/5 hover:bg-white/10 border-white/10 text-neutral-400'
                      }`}
                    >
                      {status}
                    </button>
                  ))}
                </div>
              </div>
              <div className="flex-grow flex flex-col">
                <label className="block text-xs font-bold text-neutral-400 uppercase mb-2">Brouillon / Grandes étapes :</label>
                <textarea
                  className="w-full min-h-[120px] p-3 border border-white/10 rounded-lg text-sm resize-none bg-white/5 text-neutral-100 placeholder-neutral-600 focus:ring-1 focus:ring-blue-500 focus:border-blue-500"
                  placeholder="Tes premières idées, formules ou étapes clés..."
                  value={ans.text}
                  onChange={e => updateAns('text', e.target.value)}
                />
              </div>
            </div>
          </div>
        </CardContent>
      </Card>

      <div className="flex justify-between">
        <Button
          variant="outline"
          disabled={currentEx === 0}
          onClick={() => setCurrentEx(currentEx - 1)}
          className="border-white/10 text-neutral-300"
        >
          <ChevronLeft className="mr-2 w-4 h-4" /> Précédent
        </Button>
        <Button
          onClick={() => {
            if (currentEx < QUESTIONS_OPEN.length - 1) setCurrentEx(currentEx + 1);
            else setShowValidation(true);
          }}
          className="bg-blue-600 hover:bg-blue-500 text-white"
        >
          {currentEx < QUESTIONS_OPEN.length - 1 ? 'Exercice suivant' : 'Terminer'} <ChevronRight className="ml-2 w-4 h-4" />
        </Button>
      </div>
    </div>
  );
}

// ─── Results Step ─────────────────────────────────────────────────────────────

function ResultsStep({ evaluatedData }: { evaluatedData: DiagnosticResult }) {
  const {
    globalRawScore, globalMaxScore, globalPercentage,
    qcmRawScore, qcmMaxScore, qcmPercentage,
    qcmDontKnowCount, qcmUnansweredCount,
    isProvisional, calculatedProfile, chapterResults, domainScores
  } = evaluatedData;

  const path = generateAdvancedPath(chapterResults);
  const priorites = chapterResults.filter(c =>
    c.pedagogicalStatus === 'Lacune critique' || c.pedagogicalStatus === 'Très fragile'
  );
  const illusions = chapterResults.filter(c => c.isIllusion);
  const nonVus = chapterResults.filter(c =>
    c.pedagogicalStatus === 'Non encore vu' || c.pedagogicalStatus === 'Découverte prioritaire'
  );

  return (
    <div className="max-w-4xl mx-auto space-y-6">
      <h2 className="text-2xl font-bold text-white">Ton Bilan Diagnostic</h2>

      {isProvisional && (
        <div className="bg-yellow-500/10 border border-yellow-500/30 p-4 rounded-xl flex gap-3">
          <AlertTriangle className="text-yellow-400 shrink-0 mt-0.5 w-5 h-5" />
          <div>
            <p className="font-bold text-yellow-300 text-sm">Bilan provisoire</p>
            <p className="text-yellow-400/80 text-xs mt-1">Score basé uniquement sur le QCM. Ton coach complètera la correction des exercices ouverts pour finaliser ton bilan.</p>
          </div>
        </div>
      )}

      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
        <Card className="bg-surface-card border-white/10 flex flex-col items-center justify-center p-6">
          <div className="text-xs font-bold text-neutral-500 uppercase tracking-wider mb-2">
            Score {isProvisional ? 'QCM' : 'Global'}
          </div>
          <div className="text-5xl font-black text-white">
            {isProvisional ? qcmRawScore : globalRawScore}
            <span className="text-2xl text-neutral-500">/{isProvisional ? qcmMaxScore : globalMaxScore}</span>
          </div>
          <div className="mt-2 text-xs text-neutral-500 text-center">
            {isProvisional
              ? `QCM : ${qcmPercentage}% • "Je ne sais pas" : ${qcmDontKnowCount} • Vides : ${qcmUnansweredCount}`
              : `${globalPercentage}% — QCM : ${qcmRawScore}/48`
            }
          </div>
        </Card>

        <Card className="col-span-2 bg-slate-900 border-white/10 p-6 flex flex-col justify-center">
          <div className="flex items-center gap-2 mb-2">
            <Brain className="w-5 h-5 text-blue-400" />
            <span className="text-sm font-bold text-blue-300">Profil : {calculatedProfile.label}</span>
          </div>
          <p className="text-neutral-300 text-sm leading-relaxed">{calculatedProfile.desc}</p>
        </Card>
      </div>

      {/* Domain Scores */}
      <Card className="bg-surface-card border-white/10">
        <CardHeader className="pb-2">
          <CardTitle className="text-sm text-neutral-300 flex items-center gap-2">
            <BarChart2 className="w-4 h-4 text-blue-400" /> Scores par domaine
          </CardTitle>
        </CardHeader>
        <CardContent className="p-4 space-y-3">
          {DOMAINS.map(d => (
            <div key={d.id}>
              <div className="flex justify-between items-center mb-1">
                <span className="text-xs text-neutral-400">{d.title}</span>
                <span className="text-xs font-bold text-white">{domainScores[d.id] ?? 0}%</span>
              </div>
              <div className="w-full bg-white/10 rounded-full h-1.5">
                <div
                  className="h-1.5 rounded-full bg-blue-500"
                  style={{ width: `${domainScores[d.id] ?? 0}%` }}
                />
              </div>
            </div>
          ))}
        </CardContent>
      </Card>

      {illusions.length > 0 && (
        <Card className="bg-orange-500/10 border-orange-500/30">
          <CardContent className="p-4">
            <div className="flex items-center gap-2 mb-2">
              <ShieldAlert className="w-4 h-4 text-orange-400" />
              <span className="font-bold text-orange-300 text-sm">Illusion de maîtrise détectée</span>
            </div>
            <p className="text-xs text-orange-400/80 mb-2">Tu as déclaré être très confiant sur ces chapitres, mais le QCM révèle des fragilités :</p>
            <div className="flex flex-wrap gap-1.5">
              {illusions.map(c => <StatusBadge key={c.chapterId} status={c.pedagogicalStatus} />)}
            </div>
          </CardContent>
        </Card>
      )}

      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        <Card className="bg-surface-card border-white/10">
          <CardHeader className="pb-2">
            <CardTitle className="text-sm text-red-300 flex items-center gap-2">
              <AlertTriangle className="w-4 h-4" /> Urgences de révision
            </CardTitle>
          </CardHeader>
          <CardContent className="p-0">
            {priorites.length === 0 ? (
              <p className="p-4 text-sm text-neutral-500">Aucune urgence critique détectée.</p>
            ) : (
              <div className="divide-y divide-white/5">
                {priorites.slice(0, 6).map(c => (
                  <div key={c.chapterId} className="px-4 py-2.5 flex justify-between items-center">
                    <span className="text-xs text-neutral-300">{c.title}</span>
                    <StatusBadge status={c.pedagogicalStatus} />
                  </div>
                ))}
              </div>
            )}
          </CardContent>
        </Card>

        {nonVus.length > 0 && (
          <Card className="bg-surface-card border-white/10">
            <CardHeader className="pb-2">
              <CardTitle className="text-sm text-neutral-300 flex items-center gap-2">
                <EyeOff className="w-4 h-4" /> Notions non encore vues
              </CardTitle>
            </CardHeader>
            <CardContent className="p-4">
              <div className="flex flex-wrap gap-1.5">
                {nonVus.map(c => <StatusBadge key={c.chapterId} status={c.pedagogicalStatus} />)}
              </div>
            </CardContent>
          </Card>
        )}
      </div>

      {/* Path sessions (first 3) */}
      <div>
        <h3 className="text-lg font-bold text-white mb-3 flex items-center gap-2">
          <Clock className="w-5 h-5 text-blue-400" /> Parcours Intensif généré (16h — 8 séances)
        </h3>
        <div className="space-y-3">
          {path.slice(0, 3).map(session => (
            <Card key={session.num} className="bg-surface-card border-white/10">
              <CardContent className="p-4 flex gap-4">
                <div className="w-12 h-12 bg-blue-500/20 text-blue-300 rounded-lg flex flex-col items-center justify-center font-bold text-xs shrink-0">
                  S{session.num}
                </div>
                <div className="flex-grow min-w-0">
                  <div className="flex justify-between items-start mb-1">
                    <div>
                      <div className="text-[10px] text-blue-400 font-bold uppercase tracking-wider">{session.type}</div>
                      <h4 className="font-bold text-sm text-white">{session.title}</h4>
                    </div>
                    <span className="text-[10px] font-mono bg-white/10 text-neutral-400 px-2 py-0.5 rounded">{session.duration}</span>
                  </div>
                  <p className="text-xs text-neutral-400">{session.objectives.join(' • ')}</p>
                </div>
              </CardContent>
            </Card>
          ))}
          {path.length > 3 && (
            <p className="text-xs text-neutral-500 text-center">
              + {path.length - 3} séances supplémentaires disponibles dans ton espace coach
            </p>
          )}
        </div>
      </div>
    </div>
  );
}

// ─── Saving indicator ─────────────────────────────────────────────────────────

function SavingIndicator({ saving }: { saving: boolean }) {
  if (!saving) return null;
  return (
    <div className="flex items-center gap-1.5 text-xs text-neutral-500">
      <Loader2 className="w-3 h-3 animate-spin" />
      Sauvegarde...
    </div>
  );
}

// ─── Main Component ───────────────────────────────────────────────────────────

export function BilanDiagMathsTerminale() {
  const [step, setStep] = useState<'loading' | 'intro' | 'progress' | 'qcm' | 'open' | 'results'>('loading');
  const [progress, setProgress] = useState<Record<string, ChapterProgress>>({});
  const [qcmAnswers, setQcmAnswers] = useState<Record<string, number>>({});
  const [openAnswers, setOpenAnswers] = useState<Record<string, OpenAnswer>>({});
  const [evaluatedData, setEvaluatedData] = useState<DiagnosticResult | null>(null);
  const [saving, setSaving] = useState(false);
  const [bilanId, setBilanId] = useState<string | null>(null);

  // Load existing bilan on mount
  useEffect(() => {
    async function loadBilan() {
      try {
        const res = await fetch('/api/eleve/bilan-diagnostic-maths-terminale');
        if (!res.ok) { setStep('intro'); return; }
        const data = await res.json();
        if (!data.bilan) { setStep('intro'); return; }

        const bilan = data.bilan;
        setBilanId(bilan.id);
        const src = bilan.sourceData as any;
        if (src?.progress) setProgress(src.progress);
        if (src?.qcmAnswers) setQcmAnswers(src.qcmAnswers);
        if (src?.openAnswers) setOpenAnswers(src.openAnswers);
        if (src?.evaluatedData) setEvaluatedData(src.evaluatedData);

        // Resume at the step saved, or show results if completed
        const savedStep = src?.step;
        if (bilan.status === 'COMPLETED' || savedStep === 'results') {
          setStep('results');
        } else if (savedStep && ['progress', 'qcm', 'open'].includes(savedStep)) {
          setStep(savedStep as any);
        } else {
          setStep('intro');
        }
      } catch {
        setStep('intro');
      }
    }
    void loadBilan();
  }, []);

  const saveToDb = useCallback(async (
    p: Record<string, ChapterProgress>,
    q: Record<string, number>,
    o: Record<string, OpenAnswer>,
    currentStep: string
  ) => {
    setSaving(true);
    try {
      await fetch('/api/eleve/bilan-diagnostic-maths-terminale', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ progress: p, qcmAnswers: q, openAnswers: o, step: currentStep }),
      });
    } catch { /* silent */ }
    finally { setSaving(false); }
  }, []);

  const goToStep = async (newStep: typeof step, p = progress, q = qcmAnswers, o = openAnswers) => {
    setStep(newStep);
    await saveToDb(p, q, o, newStep);
    window.scrollTo(0, 0);
  };

  const finishStudentPhase = async () => {
    const data = computeDiagnostics(progress, qcmAnswers, {}, false);
    setEvaluatedData(data);
    setStep('results');
    await saveToDb(progress, qcmAnswers, openAnswers, 'results');
    window.scrollTo(0, 0);
  };

  const steps = ['intro', 'progress', 'qcm', 'open', 'results'];
  const stepLabels = ['Intro', 'Avancement', 'QCM', 'Exercices', 'Résultats'];
  const currentStepIdx = steps.indexOf(step);

  if (step === 'loading') {
    return (
      <Card className="bg-surface-card border-white/10">
        <CardContent className="p-8 flex items-center justify-center">
          <Loader2 className="w-6 h-6 animate-spin text-brand-accent" />
        </CardContent>
      </Card>
    );
  }

  return (
    <Card className="bg-surface-card border-white/10">
      <CardHeader className="border-b border-white/10 pb-4">
        <div className="flex justify-between items-center">
          <CardTitle className="text-white flex items-center gap-2">
            <Target className="w-5 h-5 text-blue-400" />
            Bilan Diagnostic — Maths Terminale EDS
          </CardTitle>
          <div className="flex items-center gap-3">
            <SavingIndicator saving={saving} />
            {step === 'results' && (
              <button
                onClick={() => setStep('intro')}
                className="text-xs text-neutral-500 hover:text-neutral-300 flex items-center gap-1 transition-colors"
              >
                <RotateCcw className="w-3 h-3" /> Recommencer
              </button>
            )}
          </div>
        </div>

        {/* Progress bar */}
        <div className="flex items-center gap-1 mt-3">
          {steps.slice(1).map((s, i) => (
            <div key={s} className="flex items-center gap-1 flex-1">
              <div
                className={`h-1 flex-1 rounded-full transition-colors ${
                  i < currentStepIdx - 1 ? 'bg-blue-500' :
                  i === currentStepIdx - 1 ? 'bg-blue-400' :
                  'bg-white/10'
                }`}
              />
            </div>
          ))}
        </div>
      </CardHeader>

      <CardContent className="p-5">
        {step === 'intro' && (
          <IntroStep onStart={() => goToStep('progress')} />
        )}
        {step === 'progress' && (
          <ProgressStep
            progress={progress}
            setProgress={setProgress}
            onNext={() => goToStep('qcm')}
          />
        )}
        {step === 'qcm' && (
          <QcmStep
            qcmAnswers={qcmAnswers}
            setQcmAnswers={setQcmAnswers}
            onNext={() => goToStep('open')}
          />
        )}
        {step === 'open' && (
          <OpenStep
            openAnswers={openAnswers}
            setOpenAnswers={setOpenAnswers}
            onFinish={finishStudentPhase}
          />
        )}
        {step === 'results' && evaluatedData && (
          <ResultsStep evaluatedData={evaluatedData} />
        )}
      </CardContent>
    </Card>
  );
}
