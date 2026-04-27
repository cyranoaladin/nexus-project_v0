'use client';

import { useState, useEffect } from 'react';
import {
  Brain, Target, AlertTriangle, CheckCircle, ShieldAlert, Zap,
  BarChart2, Edit3, EyeOff, Loader2, Save, Check
} from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { DOMAINS, QUESTIONS_OPEN, ERROR_TYPES } from '@/lib/diagnostic/maths-terminale/data';
import {
  computeDiagnostics, aggregateTeacherErrors, generateAdvancedPath, generateRecommendations, generatePostStagePlan
} from '@/lib/diagnostic/maths-terminale/scoring';
import { DiagnosticRoadmap } from '../shared/DiagnosticRoadmap';
import type {
  DiagnosticResult, ChapterResult, TeacherGrade, OpenAnswer, PedagogicalStatus, SessionPlan, WeekPlan
} from '@/lib/diagnostic/maths-terminale/types';


// ─── Status Badge ─────────────────────────────────────────────────────────────

function StatusBadge({ status }: { status: PedagogicalStatus | string }) {
  const colors: Record<string, string> = {
    'Non renseigné': 'bg-neutral-700 text-neutral-300 border-neutral-600',
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

// ─── Quick Synthesis (coach briefing) ────────────────────────────────────────

function QuickSynthesis({
  evaluatedData,
  teacherGrades,
}: {
  evaluatedData: DiagnosticResult;
  teacherGrades: Record<string, TeacherGrade>;
}) {
  const { isProvisional, calculatedProfile, chapterResults } = evaluatedData;
  const urgencies = chapterResults
    .filter(c => c.pedagogicalStatus === 'Lacune critique' || c.pedagogicalStatus === 'Très fragile')
    .sort((a, b) => b.priorityScore - a.priorityScore)
    .slice(0, 3);
  const topErrors = aggregateTeacherErrors(teacherGrades).slice(0, 2);
  const toClarify = chapterResults.filter(c => c.pedagogicalStatus === 'Non renseigné');
  const unlookedButSucceeded = chapterResults.filter(c => c.declaredNotSeenButSucceeded);

  return (
    <Card className="bg-slate-900 border-blue-500/20">
      <CardContent className="p-5">
        <div className="flex items-center gap-2 mb-4">
          <Zap className="w-4 h-4 text-yellow-400" />
          <span className="font-bold text-white text-sm">À lire avant la première séance</span>
        </div>
        <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
          <div>
            <div className="text-blue-300 text-[10px] font-bold uppercase mb-1">1. Profil Général</div>
            <div className="font-bold text-white text-sm">
              {calculatedProfile.label}
              {isProvisional && <span className="text-[10px] bg-yellow-500 text-yellow-900 px-1.5 py-0.5 rounded ml-2">Provisoire</span>}
            </div>
            <div className="text-xs text-blue-200/70 mt-1">{calculatedProfile.desc}</div>
          </div>
          <div>
            <div className="text-blue-300 text-[10px] font-bold uppercase mb-1">2. Top 3 Urgences</div>
            <ul className="text-xs text-blue-100 space-y-0.5">
              {urgencies.length > 0
                ? urgencies.map(u => <li key={u.chapterId} className="flex items-start gap-1"><span className="text-red-400">•</span>{u.title}</li>)
                : <li className="text-neutral-500">Aucune urgence majeure</li>
              }
            </ul>
          </div>
          <div>
            <div className="text-blue-300 text-[10px] font-bold uppercase mb-1">3. Points d'attention</div>
            {topErrors.length > 0 ? (
              <ul className="text-xs text-blue-100 space-y-0.5 mb-2">
                {topErrors.map(e => <li key={e[0]} className="flex items-start gap-1"><span className="text-orange-400">•</span>{e[0]}</li>)}
              </ul>
            ) : (
              <p className="text-xs text-neutral-500 mb-2">Aucune erreur type corrigée</p>
            )}
            {toClarify.length > 0 && (
              <div className="text-[10px] bg-blue-800/50 p-1.5 rounded border border-blue-700/50 mb-1">
                ⚠️ {toClarify.length} chapitre(s) non renseigné(s)
              </div>
            )}
            {unlookedButSucceeded.length > 0 && (
              <div className="text-[10px] bg-indigo-800/50 p-1.5 rounded border border-indigo-700/50">
                ✨ {unlookedButSucceeded.length} réussite(s) inattendue(s)
              </div>
            )}
          </div>
        </div>
        <div className="mt-4 pt-4 border-t border-blue-800/50">
          <div className="text-blue-300 text-[10px] font-bold uppercase mb-1">Action recommandée — Séance 1</div>
          <div className="text-xs text-white font-medium">
            {toClarify.length > 0
              ? "Commencer par clarifier le déclaratif des chapitres non renseignés, puis attaquer d'urgence "
              : "Commencer par une correction guidée des QCM échoués, puis attaquer d'urgence "
            }
            {urgencies[0]?.title ?? 'des exercices transversaux'}.
          </div>
        </div>
      </CardContent>
    </Card>
  );
}

// ─── Grading Panel ────────────────────────────────────────────────────────────

function GradingPanel({
  teacherGrades,
  setTeacherGrades,
  openAnswers,
  onSubmit,
  submitting,
}: {
  teacherGrades: Record<string, TeacherGrade>;
  setTeacherGrades: React.Dispatch<React.SetStateAction<Record<string, TeacherGrade>>>;
  openAnswers: Record<string, OpenAnswer>;
  onSubmit: () => void;
  submitting: boolean;
}) {
  const gradedCount = QUESTIONS_OPEN.filter(q => {
    const g = teacherGrades[q.id];
    return g && g.score !== '' && g.score !== undefined;
  }).length;

  const handleGlobalGrade = (qId: string, val: string) => {
    const q = QUESTIONS_OPEN.find(q => q.id === qId)!;
    const num = parseFloat(val);
    const safe = isNaN(num) ? '' : Math.min(Math.max(0, num), q.maxPoints);
    setTeacherGrades(prev => ({
      ...prev,
      [qId]: { ...(prev[qId] || { comment: '', errors: [], mode: 'global' as const, criteria: {} }), score: safe },
    }));
  };

  const handleErrorToggle = (qId: string, err: string) => {
    setTeacherGrades(prev => {
      const current = prev[qId] || { score: '', comment: '', mode: 'global' as const, errors: [], criteria: {} };
      const currentErrors = current.errors || [];
      const newErrors = currentErrors.includes(err)
        ? currentErrors.filter(e => e !== err)
        : [...currentErrors, err];
      return { ...prev, [qId]: { ...current, errors: newErrors } };
    });
  };

  return (
    <div className="space-y-4">
      <div className="flex justify-between items-center">
        <h3 className="font-bold text-white flex items-center gap-2">
          <Edit3 className="w-4 h-4 text-blue-400" />
          Correction des exercices ouverts ({gradedCount}/{QUESTIONS_OPEN.length})
        </h3>
        <Button
          onClick={onSubmit}
          disabled={submitting}
          className="bg-emerald-600 hover:bg-emerald-500 text-white text-xs"
        >
          {submitting ? (
            <><Loader2 className="w-3 h-3 mr-1 animate-spin" /> Calcul...</>
          ) : (
            <><Check className="w-3 h-3 mr-1" /> Valider et recalculer</>
          )}
        </Button>
      </div>

      {QUESTIONS_OPEN.map(q => {
        const ans = openAnswers[q.id] || { text: '', status: '' };
        const grade = teacherGrades[q.id] || { score: '', comment: '', errors: [], mode: 'global' as const, criteria: {} };
        const isGraded = grade.score !== '' && grade.score !== undefined;

        return (
          <Card key={q.id} className={`border transition-colors ${isGraded ? 'bg-surface-card border-emerald-500/20' : 'bg-surface-card border-white/10'}`}>
            <CardContent className="p-4">
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                {/* Student response */}
                <div className="space-y-2">
                  <div className="flex justify-between items-center">
                    <h4 className="text-sm font-bold text-white">{q.id} — {q.title}</h4>
                    <span className="text-xs bg-white/10 text-neutral-400 px-2 py-0.5 rounded">Max : {q.maxPoints} pts</span>
                  </div>
                  <div className="text-[10px] font-bold bg-white/5 border border-white/10 inline-block rounded px-2 py-0.5 text-neutral-400">
                    Ressenti : {ans.status || 'Non renseigné'}
                  </div>
                  <div className="p-3 bg-white/5 border border-white/10 rounded text-xs text-neutral-300 min-h-[80px] whitespace-pre-wrap font-mono">
                    {ans.text || <span className="italic text-neutral-600">Aucun brouillon saisi</span>}
                  </div>
                  {/* Rubric reference */}
                  <div className="text-[10px] text-neutral-600 space-y-0.5">
                    {q.rubrics.map((r, i) => (
                      <div key={i} className="flex justify-between">
                        <span>{r.label}</span>
                        <span>/{r.points} pts</span>
                      </div>
                    ))}
                  </div>
                </div>

                {/* Grading */}
                <div className="space-y-3 bg-white/5 rounded-lg p-3 border border-white/10">
                  <div className="flex items-center gap-3">
                    <label className="text-xs font-bold text-neutral-400">Note :</label>
                    <input
                      type="number"
                      min="0"
                      max={q.maxPoints}
                      step="0.5"
                      className="w-20 p-1.5 border border-white/10 rounded font-bold text-center text-sm bg-surface-darker text-white focus:ring-1 focus:ring-blue-500"
                      placeholder="0"
                      value={grade.score}
                      onChange={e => handleGlobalGrade(q.id, e.target.value)}
                    />
                    <span className="text-xs text-neutral-500">/ {q.maxPoints}</span>
                    {isGraded && <CheckCircle className="w-4 h-4 text-emerald-400 ml-auto" />}
                  </div>

                  <div>
                    <label className="text-[10px] font-bold text-neutral-500 uppercase block mb-1.5">Erreurs diagnostiquées :</label>
                    <div className="flex flex-wrap gap-1">
                      {ERROR_TYPES.map(err => {
                        const isChecked = (grade.errors || []).includes(err);
                        return (
                          <button
                            key={err}
                            onClick={() => handleErrorToggle(q.id, err)}
                            className={`text-[10px] uppercase font-bold px-2 py-0.5 rounded border transition-colors ${
                              isChecked
                                ? 'bg-red-500/20 text-red-300 border-red-500/30'
                                : 'bg-white/5 text-neutral-600 border-white/10 hover:bg-white/10'
                            }`}
                          >
                            {err}
                          </button>
                        );
                      })}
                    </div>
                  </div>

                  <textarea
                    className="w-full text-xs p-2 border border-white/10 rounded resize-none bg-surface-darker text-neutral-300 placeholder-neutral-600 focus:ring-1 focus:ring-blue-500"
                    placeholder="Commentaire professeur (optionnel)..."
                    rows={2}
                    value={grade.comment || ''}
                    onChange={e => setTeacherGrades(prev => ({
                      ...prev,
                      [q.id]: { ...(prev[q.id] || { score: '', errors: [], mode: 'global' as const, criteria: {} }), comment: e.target.value }
                    }))}
                  />
                </div>
              </div>
            </CardContent>
          </Card>
        );
      })}
    </div>
  );
}

// ─── Chapter Results Table ────────────────────────────────────────────────────

function ChapterResultsTable({ chapterResults }: { chapterResults: ChapterResult[] }) {
  const [filter, setFilter] = useState<'all' | 'urgent' | 'evaluated'>('urgent');

  let filtered = chapterResults;
  if (filter === 'urgent') {
    filtered = chapterResults.filter(c =>
      ['Lacune critique', 'Très fragile', 'Fragile', 'Découverte prioritaire'].includes(c.pedagogicalStatus)
    );
  } else if (filter === 'evaluated') {
    filtered = chapterResults.filter(c => c.isEvaluated);
  }

  return (
    <Card className="bg-surface-card border-white/10">
      <CardHeader className="pb-3 border-b border-white/10">
        <div className="flex justify-between items-center">
          <CardTitle className="text-sm text-neutral-300">Analyse par chapitre</CardTitle>
          <div className="flex gap-1">
            {(['all', 'urgent', 'evaluated'] as const).map(f => (
              <button
                key={f}
                onClick={() => setFilter(f)}
                className={`text-[10px] font-bold px-2 py-1 rounded border transition-colors ${
                  filter === f ? 'bg-blue-500/20 text-blue-300 border-blue-500/30' : 'text-neutral-500 border-white/10 hover:bg-white/5'
                }`}
              >
                {f === 'all' ? 'Tous' : f === 'urgent' ? 'Prioritaires' : 'Évalués'}
              </button>
            ))}
          </div>
        </div>
      </CardHeader>
      <CardContent className="p-0">
        <div className="divide-y divide-white/5 max-h-64 overflow-y-auto">
          {filtered.length === 0 ? (
            <p className="p-4 text-xs text-neutral-500 text-center">Aucun chapitre dans cette catégorie.</p>
          ) : (
            filtered.map(c => (
              <div key={c.chapterId} className="px-4 py-2.5 flex items-center justify-between gap-3">
                <div className="flex-1 min-w-0">
                  <div className="text-xs text-neutral-300 truncate">{c.title}</div>
                  <div className="text-[10px] text-neutral-600">{c.domainTitle}</div>
                </div>
                <div className="flex items-center gap-2 shrink-0">
                  {c.percentage !== null && (
                    <span className="text-[10px] font-mono text-neutral-500">{Math.round(c.percentage)}%</span>
                  )}
                  <StatusBadge status={c.pedagogicalStatus} />
                  {c.isIllusion && <ShieldAlert className="w-3 h-3 text-orange-400" aria-label="Illusion de maîtrise" />}
                </div>
              </div>
            ))
          )}
        </div>
      </CardContent>
    </Card>
  );
}

// ─── Main Coach Component ─────────────────────────────────────────────────────

interface BilanDiagMathsTerminaleCoachProps {
  studentId: string;
  studentName: string;
}

export function BilanDiagMathsTerminaleCoach({ studentId, studentName }: BilanDiagMathsTerminaleCoachProps) {

  const [loading, setLoading] = useState(true);
  const [bilan, setBilan] = useState<any | null>(null);
  const [teacherGrades, setTeacherGrades] = useState<Record<string, TeacherGrade>>({});
  const [evaluatedData, setEvaluatedData] = useState<DiagnosticResult | null>(null);
  const [openAnswers, setOpenAnswers] = useState<Record<string, OpenAnswer>>({});
  const [submitting, setSubmitting] = useState(false);
  const [view, setView] = useState<'summary' | 'grade' | 'roadmap'>('summary');

  useEffect(() => {
    async function load() {
      try {
        const res = await fetch(`/api/coach/students/${studentId}/bilan-diagnostic-maths-terminale`);
        if (!res.ok) { setLoading(false); return; }
        const data = await res.json();
        if (!data.bilan) { setLoading(false); return; }

        const b = data.bilan;
        setBilan(b);
        const src = b.sourceData as any;
        if (src?.teacherGrades) setTeacherGrades(src.teacherGrades);
        if (src?.openAnswers) setOpenAnswers(src.openAnswers);
        if (src?.evaluatedData) setEvaluatedData(src.evaluatedData);
      } catch { /* silent */ }
      finally { setLoading(false); }
    }
    void load();
  }, [studentId]);

  const handleSubmitGrades = async () => {
    setSubmitting(true);
    try {
      const res = await fetch(`/api/coach/students/${studentId}/bilan-diagnostic-maths-terminale`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ teacherGrades }),
      });
      if (res.ok) {
        const data = await res.json();
        const src = data.bilan?.sourceData as any;
        if (src?.evaluatedData) setEvaluatedData(src.evaluatedData);
        setBilan(data.bilan);
        setView('summary');
      }
    } catch { /* silent */ }
    finally { setSubmitting(false); }
  };

  if (loading) {
    return (
      <Card className="bg-surface-card border-white/10">
        <CardContent className="p-6 flex items-center gap-2 text-neutral-500">
          <Loader2 className="w-4 h-4 animate-spin" />
          <span className="text-sm">Chargement du bilan diagnostic...</span>
        </CardContent>
      </Card>
    );
  }

  if (!bilan || !evaluatedData) {
    return (
      <Card className="bg-surface-card border-white/10">
        <CardContent className="p-6 text-center">
          <Target className="w-10 h-10 text-neutral-600 mx-auto mb-3" />
          <p className="text-sm text-neutral-500">L'élève n'a pas encore complété son bilan diagnostic Maths Terminale.</p>
        </CardContent>
      </Card>
    );
  }

  const {
    globalRawScore, globalMaxScore, qcmRawScore, qcmMaxScore, qcmPercentage,
    openRawScore, openMaxScore, isProvisional, calculatedProfile, chapterResults, domainScores
  } = evaluatedData;

  const recs = generateRecommendations(chapterResults, teacherGrades);

  return (
    <div className="space-y-4">
      {/* Header */}
      <div className="flex items-center justify-between">
        <h3 className="font-bold text-white flex items-center gap-2">
          <Target className="w-4 h-4 text-blue-400" />
          Bilan Diagnostic — Maths Terminale EDS
        </h3>
        <div className="flex gap-2">
          <button
            onClick={() => setView('summary')}
            className={`text-xs px-3 py-1.5 rounded border transition-colors ${
              view === 'summary' ? 'bg-blue-500/20 text-blue-300 border-blue-500/30' : 'text-neutral-500 border-white/10 hover:bg-white/5'
            }`}
          >
            Synthèse
          </button>
          <button
            onClick={() => setView('roadmap')}
            className={`text-xs px-3 py-1.5 rounded border transition-colors ${
              view === 'roadmap' ? 'bg-brand-accent/20 text-brand-accent border-brand-accent/30' : 'text-neutral-500 border-white/10 hover:bg-white/5'
            }`}
          >
            Parcours
          </button>
          <button
            onClick={() => setView('grade')}
            className={`text-xs px-3 py-1.5 rounded border transition-colors ${
              view === 'grade' ? 'bg-blue-500/20 text-blue-300 border-blue-500/30' : 'text-neutral-500 border-white/10 hover:bg-white/5'
            }`}
          >
            Corriger
          </button>
        </div>
      </div>

      {view === 'summary' && (
        <>
          <QuickSynthesis evaluatedData={evaluatedData} teacherGrades={teacherGrades} />

          {/* Score metrics */}
          <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
            <Card className="bg-surface-card border-white/10">
              <CardContent className="p-3">
                <div className="text-[10px] font-bold text-neutral-500 uppercase">Score Global</div>
                <div className="text-2xl font-black text-white mt-1">
                  {isProvisional ? '—' : globalRawScore}
                  <span className="text-sm text-neutral-500">/{globalMaxScore}</span>
                </div>
              </CardContent>
            </Card>
            <Card className="bg-surface-card border-white/10">
              <CardContent className="p-3">
                <div className="text-[10px] font-bold text-neutral-500 uppercase flex items-center gap-1">QCM <BarChart2 className="w-3 h-3 text-blue-400" /></div>
                <div className="text-2xl font-black text-white mt-1">{qcmRawScore}<span className="text-sm text-neutral-500">/{qcmMaxScore}</span></div>
                <div className="text-[10px] text-neutral-600">{qcmPercentage}%</div>
              </CardContent>
            </Card>
            <Card className="bg-surface-card border-white/10">
              <CardContent className="p-3">
                <div className="text-[10px] font-bold text-neutral-500 uppercase flex items-center gap-1">Ouvert <Edit3 className="w-3 h-3 text-purple-400" /></div>
                <div className="text-2xl font-black text-white mt-1">
                  {isProvisional ? '?' : openRawScore}
                  <span className="text-sm text-neutral-500">/{openMaxScore}</span>
                </div>
                {isProvisional && <div className="text-[10px] text-yellow-500">En attente de correction</div>}
              </CardContent>
            </Card>
            <Card className="bg-surface-card border-white/10">
              <CardContent className="p-3">
                <div className="text-[10px] font-bold text-neutral-500 uppercase">Non renseignés</div>
                <div className="text-2xl font-black text-orange-400 mt-1">
                  {chapterResults.filter(c => c.pedagogicalStatus === 'Non renseigné').length}
                </div>
              </CardContent>
            </Card>
          </div>

          {/* Domain scores */}
          <Card className="bg-surface-card border-white/10">
            <CardHeader className="pb-2">
              <CardTitle className="text-xs text-neutral-400">Scores par domaine</CardTitle>
            </CardHeader>
            <CardContent className="p-4 space-y-2.5">
              {DOMAINS.map(d => (
                <div key={d.id}>
                  <div className="flex justify-between mb-1">
                    <span className="text-xs text-neutral-400">{d.title}</span>
                    <span className="text-xs font-bold text-white">{domainScores[d.id] ?? 0}%</span>
                  </div>
                  <div className="w-full bg-white/10 rounded-full h-1.5">
                    <div className="h-1.5 rounded-full bg-blue-500" style={{ width: `${domainScores[d.id] ?? 0}%` }} />
                  </div>
                </div>
              ))}
            </CardContent>
          </Card>

          {/* Recommendations */}
          {recs.length > 0 && (
            <Card className="bg-surface-card border-white/10">
              <CardHeader className="pb-2">
                <CardTitle className="text-xs text-neutral-400">Décision Pédagogique Assistée</CardTitle>
              </CardHeader>
              <CardContent className="p-4 space-y-3">
                {recs.map((r, i) => (
                  <div key={i} className="flex items-start gap-2">
                    {r.type === 'alerte' && <ShieldAlert className="w-3.5 h-3.5 text-orange-400 shrink-0 mt-0.5" />}
                    {r.type === 'urgence' && <AlertTriangle className="w-3.5 h-3.5 text-red-400 shrink-0 mt-0.5" />}
                    {r.type === 'info' && <EyeOff className="w-3.5 h-3.5 text-blue-400 shrink-0 mt-0.5" />}
                    {r.type === 'succes' && <CheckCircle className="w-3.5 h-3.5 text-emerald-400 shrink-0 mt-0.5" />}
                    <div>
                      <span className="text-xs font-bold text-white block">{r.title}</span>
                      <span className="text-xs text-neutral-400">{r.text}</span>
                    </div>
                  </div>
                ))}
              </CardContent>
            </Card>
          )}

          <ChapterResultsTable chapterResults={chapterResults} />

          {isProvisional && (
            <div className="bg-yellow-500/10 border border-yellow-500/30 p-3 rounded-lg flex items-start gap-2">
              <AlertTriangle className="w-4 h-4 text-yellow-400 shrink-0 mt-0.5" />
              <div>
                <p className="text-xs font-bold text-yellow-300">Bilan provisoire — Correction requise</p>
                <p className="text-xs text-yellow-400/70 mt-0.5">
                  Le score final sera calculé après correction des exercices ouverts.
                  <button onClick={() => setView('grade')} className="underline ml-1 hover:text-yellow-300">
                    Corriger maintenant
                  </button>
                </p>
              </div>
            </div>
          )}
        </>
      )}

      {view === 'grade' && (
        <GradingPanel
          teacherGrades={teacherGrades}
          setTeacherGrades={setTeacherGrades}
          openAnswers={openAnswers}
          onSubmit={handleSubmitGrades}
          submitting={submitting}
        />
      )}

      {view === 'roadmap' && (
        <DiagnosticRoadmap
          evaluatedData={evaluatedData}
          sessions={generateAdvancedPath(chapterResults)}
          postStagePlan={generatePostStagePlan(evaluatedData, teacherGrades)}
          studentName={studentName}
        />
      )}

    </div>
  );
}
