'use client';

import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { AnimatePresence, motion } from 'framer-motion';
import { ArrowLeft, ArrowRight, CheckCircle2, Clock3, Loader2, Save, ShieldCheck, X } from 'lucide-react';
import type { DiagnosticAnswer, DiagnosticModuleDefinition } from '@/lib/diagnostics/candidat-libre/types';
import { ConfidenceSelector, NotStudiedButton, QuestionRenderer } from './QuestionRenderer';

interface ModulePayload {
  definition: DiagnosticModuleDefinition;
  module: {
    status: string;
    answers?: Record<string, DiagnosticAnswer>;
    currentQuestionIndex: number;
    elapsedMs: number;
    submittedAt?: string | null;
    availability?: { available: boolean; availableAt?: string | null; reason?: string };
  };
}

interface Props {
  diagnosticId: string;
  moduleKey: string;
  parentMode?: boolean;
  onClose: () => void;
  onUpdated: () => void;
}

function mutationId() {
  return typeof crypto !== 'undefined' && 'randomUUID' in crypto ? crypto.randomUUID() : `${Date.now()}-${Math.random()}`;
}

function formatDuration(ms: number) {
  const totalSeconds = Math.floor(ms / 1000);
  const hours = Math.floor(totalSeconds / 3600);
  const minutes = Math.floor((totalSeconds % 3600) / 60);
  const seconds = totalSeconds % 60;
  return `${hours ? `${hours} h ` : ''}${String(minutes).padStart(2, '0')}:${String(seconds).padStart(2, '0')}`;
}

export function ModuleRunner({ diagnosticId, moduleKey, parentMode, onClose, onUpdated }: Props) {
  const endpoint = parentMode
    ? `/api/diagnostics/candidat-libre/${diagnosticId}/parent`
    : `/api/diagnostics/candidat-libre/${diagnosticId}/modules/${moduleKey}`;
  const [payload, setPayload] = useState<ModulePayload | null>(null);
  const [answers, setAnswers] = useState<Record<string, DiagnosticAnswer>>({});
  const [index, setIndex] = useState(0);
  const [elapsedMs, setElapsedMs] = useState(0);
  const [isSaving, setIsSaving] = useState(false);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [lastSavedAt, setLastSavedAt] = useState<Date | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [dirty, setDirty] = useState(false);
  const integrity = useRef({ accepted: true, focusLossCount: 0, fullscreenExitCount: 0, copyPasteCount: 0 });
  const startedAt = useRef(Date.now());

  const load = useCallback(async () => {
    const response = await fetch(endpoint, { cache: 'no-store' });
    const data = await response.json().catch(() => ({}));
    if (!response.ok) throw new Error(data.reason ?? data.message ?? data.error ?? 'Impossible de charger le module.');
    setPayload(data);
    setAnswers(data.module.answers ?? {});
    setIndex(Math.min(data.module.currentQuestionIndex ?? 0, Math.max(0, data.definition.questions.length - 1)));
    setElapsedMs(data.module.elapsedMs ?? 0);
    startedAt.current = Date.now();
  }, [endpoint]);

  useEffect(() => { void load().catch((reason) => setError(reason instanceof Error ? reason.message : 'Erreur de chargement.')); }, [load]);

  useEffect(() => {
    if (!payload || payload.module.submittedAt) return;
    const timer = window.setInterval(() => setElapsedMs((current) => current + 1000), 1000);
    const onVisibility = () => { if (document.hidden) integrity.current.focusLossCount += 1; };
    const onPaste = () => { integrity.current.copyPasteCount += 1; };
    const onFullscreen = () => { if (!document.fullscreenElement) integrity.current.fullscreenExitCount += 1; };
    document.addEventListener('visibilitychange', onVisibility);
    document.addEventListener('paste', onPaste);
    document.addEventListener('fullscreenchange', onFullscreen);
    return () => {
      window.clearInterval(timer);
      document.removeEventListener('visibilitychange', onVisibility);
      document.removeEventListener('paste', onPaste);
      document.removeEventListener('fullscreenchange', onFullscreen);
    };
  }, [payload]);

  const save = useCallback(async (action: 'draft' | 'submit') => {
    if (!payload || payload.module.submittedAt) return true;
    action === 'submit' ? setIsSubmitting(true) : setIsSaving(true);
    setError(null);
    const body = parentMode
      ? { answers, consent: action === 'submit', clientMutationId: mutationId() }
      : { answers, currentQuestionIndex: index, elapsedMs, integrity: integrity.current, clientMutationId: mutationId() };
    const response = await fetch(endpoint, {
      method: action === 'submit' ? 'POST' : 'PUT',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(body),
    });
    const data = await response.json().catch(() => ({}));
    action === 'submit' ? setIsSubmitting(false) : setIsSaving(false);
    if (!response.ok) {
      const suffix = data.missingQuestionIds?.length ? ` Questions manquantes : ${data.missingQuestionIds.join(', ')}.` : '';
      setError(`${data.reason ?? data.message ?? data.error ?? 'Enregistrement impossible.'}${suffix}`);
      return false;
    }
    setDirty(false);
    setLastSavedAt(new Date());
    if (action === 'submit') {
      onUpdated();
      onClose();
    }
    return true;
  }, [answers, elapsedMs, endpoint, index, onClose, onUpdated, parentMode, payload]);

  useEffect(() => {
    if (!dirty || !payload || payload.module.submittedAt) return;
    const timer = window.setTimeout(() => void save('draft'), 1800);
    return () => window.clearTimeout(timer);
  }, [answers, index, dirty, payload, save]);

  const handleClose = useCallback(async () => {
    if (dirty && payload && !payload.module.submittedAt) {
      const saved = await save('draft');
      if (saved === false) return;
    }
    onClose();
  }, [dirty, onClose, payload, save]);

  const definition = payload?.definition;
  const question = definition?.questions[index];
  const answer = question ? answers[question.id] : undefined;
  const progress = definition ? Math.round(((index + 1) / definition.questions.length) * 100) : 0;
  const requiredAnswered = !question || question.required === false || question.type === 'information' || question.type === 'upload' || Boolean(answer && answer.status !== 'SKIPPED' && (answer.status === 'NOT_STUDIED' || answer.value !== null && answer.value !== ''));
  const isLast = Boolean(definition && index === definition.questions.length - 1);

  const updateAnswer = (next: DiagnosticAnswer) => {
    setAnswers((current) => ({ ...current, [next.questionId]: next }));
    setDirty(true);
  };

  return (
    <AnimatePresence>
      <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }} className="fixed inset-0 z-50 overflow-y-auto bg-[#050816]/95 backdrop-blur-md">
        <div className="mx-auto min-h-screen max-w-6xl px-4 py-5 md:px-8">
          <header className="sticky top-0 z-10 rounded-2xl border border-slate-800 bg-[#081020]/95 p-4 shadow-2xl backdrop-blur md:p-5">
            <div className="flex items-start justify-between gap-4">
              <div className="min-w-0">
                <p className="text-xs font-semibold uppercase tracking-[0.2em] text-cyan-300">Diagnostic candidat individuel</p>
                <h1 className="mt-1 truncate text-lg font-bold text-white md:text-2xl">{definition?.title ?? 'Chargement…'}</h1>
              </div>
              <button type="button" onClick={() => void handleClose()} className="rounded-xl border border-slate-700 p-2 text-slate-300 hover:border-slate-500 hover:bg-slate-800" aria-label="Fermer"><X className="h-5 w-5" /></button>
            </div>
            <div className="mt-4 flex flex-wrap items-center gap-3 text-xs text-slate-400">
              <span className="inline-flex items-center gap-1.5"><Clock3 className="h-4 w-4" /> {formatDuration(elapsedMs)}</span>
              <span className="inline-flex items-center gap-1.5"><ShieldCheck className="h-4 w-4" /> Sauvegarde sécurisée</span>
              <span className="inline-flex items-center gap-1.5"><Save className="h-4 w-4" /> {isSaving ? 'Enregistrement…' : lastSavedAt ? `Enregistré à ${lastSavedAt.toLocaleTimeString('fr-FR', { hour: '2-digit', minute: '2-digit' })}` : 'Brouillon automatique'}</span>
            </div>
            <div className="mt-4 h-2 overflow-hidden rounded-full bg-slate-800"><div className="h-full rounded-full bg-gradient-to-r from-cyan-300 to-violet-400 transition-all" style={{ width: `${progress}%` }} /></div>
            <p className="mt-2 text-right text-xs text-slate-500">Question {index + 1} sur {definition?.questions.length ?? 0} · {progress} %</p>
          </header>

          <main className="py-6">
            {!payload && !error && <div className="flex min-h-[50vh] items-center justify-center"><Loader2 className="h-10 w-10 animate-spin text-cyan-300" /></div>}
            {error && !payload && <div className="mx-auto max-w-2xl rounded-2xl border border-rose-400/30 bg-rose-400/10 p-6 text-rose-100">{error}</div>}
            {payload && question && (
              <motion.section key={question.id} initial={{ opacity: 0, y: 12 }} animate={{ opacity: 1, y: 0 }} className="mx-auto max-w-4xl rounded-3xl border border-slate-800 bg-slate-900/70 p-5 shadow-2xl md:p-8">
                <div className="mb-6">
                  <div className="flex flex-wrap items-center gap-2"><span className="rounded-full border border-cyan-300/30 bg-cyan-400/10 px-3 py-1 text-xs font-semibold text-cyan-200">{definition.shortTitle}</span>{question.required !== false && <span className="text-xs text-amber-300">Réponse requise</span>}</div>
                  <h2 className="mt-4 text-xl font-bold leading-8 text-white md:text-2xl">{question.prompt}</h2>
                  {question.description && question.type !== 'information' && <p className="mt-3 whitespace-pre-line text-sm leading-6 text-slate-300">{question.description}</p>}
                  {question.instruction && <p className="mt-3 rounded-xl border border-amber-300/20 bg-amber-400/5 p-3 text-sm leading-6 text-amber-100">{question.instruction}</p>}
                </div>
                <QuestionRenderer diagnosticId={diagnosticId} question={question} answer={answer} disabled={Boolean(payload.module.submittedAt)} onChange={updateAnswer} />
                {question.maxPoints > 0 && question.type !== 'upload' && question.type !== 'information' && <ConfidenceSelector answer={answer} onChange={(confidence) => updateAnswer({ ...(answer ?? { questionId: question.id, value: null, status: 'SKIPPED' }), confidence })} />}
                <NotStudiedButton question={question} answer={answer} onChange={updateAnswer} />
                {error && <p role="alert" className="mt-5 rounded-xl border border-rose-400/30 bg-rose-400/10 p-3 text-sm text-rose-200">{error}</p>}
                <div className="mt-8 flex flex-col-reverse gap-3 border-t border-slate-800 pt-5 sm:flex-row sm:justify-between">
                  <button type="button" disabled={index === 0} onClick={() => { setIndex((current) => Math.max(0, current - 1)); setDirty(true); window.scrollTo({ top: 0, behavior: 'smooth' }); }} className="inline-flex items-center justify-center gap-2 rounded-xl border border-slate-700 px-4 py-3 text-sm font-semibold text-slate-300 disabled:opacity-30"><ArrowLeft className="h-4 w-4" /> Précédent</button>
                  {!isLast ? <button type="button" disabled={!requiredAnswered} onClick={() => { setIndex((current) => Math.min(definition.questions.length - 1, current + 1)); setDirty(true); window.scrollTo({ top: 0, behavior: 'smooth' }); }} className="inline-flex items-center justify-center gap-2 rounded-xl bg-cyan-300 px-5 py-3 text-sm font-bold text-slate-950 disabled:cursor-not-allowed disabled:opacity-40">Suivant <ArrowRight className="h-4 w-4" /></button> : <button type="button" disabled={isSubmitting || !requiredAnswered} onClick={() => void save('submit')} className="inline-flex items-center justify-center gap-2 rounded-xl bg-emerald-300 px-5 py-3 text-sm font-bold text-slate-950 disabled:opacity-50">{isSubmitting ? <Loader2 className="h-4 w-4 animate-spin" /> : <CheckCircle2 className="h-4 w-4" />} Soumettre définitivement</button>}
                </div>
              </motion.section>
            )}
          </main>
        </div>
      </motion.div>
    </AnimatePresence>
  );
}
