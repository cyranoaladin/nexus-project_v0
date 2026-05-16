'use client';

import { useEffect, useState } from 'react';
import { useSession } from 'next-auth/react';
import { useRouter, useParams } from 'next/navigation';
import Link from 'next/link';
import {
  ArrowLeft, Loader2, AlertCircle, Code2, BookOpen, Puzzle,
  FileText, BarChart3, CheckCircle2, XCircle, Clock, MessageSquare,
  Target, TrendingUp, Lightbulb, Eye,
} from 'lucide-react';
import type { CoachStudentSummary } from '@/lib/nsi-pratique-2026/coach-summary';
import type { SubjectStatus, OralFourPhrases, SelfAssessmentProgress } from '@/data/nsi-pratique-2026/types';
import { selfAssessmentItems } from '@/data/nsi-pratique-2026/oral-questions';

interface SubjectDetail {
  id: number;
  title: string;
  shortTitle: string;
  family: string;
  difficulty: string;
  status: SubjectStatus;
  lastWorkedAt: string | null;
  notes: string | null;
  patterns: number[];
}

interface PatternDetail {
  id: number;
  title: string;
  mastered: boolean;
  writtenByHand: boolean;
  lastPracticedAt: string | null;
  relatedSubjects: number[];
}

interface MockExam {
  subjectId: number;
  date: string;
  completedSteps?: string[];
  selfScore?: number;
  notes?: string;
}

interface StudentProgressResponse {
  student: {
    firstName: string;
    lastName: string;
    gradeLevel: string;
    academicTrack: string;
  };
  summary: CoachStudentSummary;
  details: {
    subjects: SubjectDetail[];
    patterns: PatternDetail[];
    fiveDayPlan: Record<string, { completed: boolean }>;
    selfAssessment: Record<string, SelfAssessmentProgress>;
    mockExams: MockExam[];
    oralPhrases: Record<number, OralFourPhrases>;
    flashcards: Record<string, { level: number; lastReviewedAt?: string }>;
  } | null;
  recommendations: string[];
  updatedAt: string | null;
}

const STATUS_CONFIG: Record<SubjectStatus, { label: string; color: string; icon: typeof CheckCircle2 }> = {
  not_started: { label: 'Non commencé', color: 'text-neutral-500', icon: Clock },
  read: { label: 'Lu', color: 'text-blue-400', icon: Eye },
  coded: { label: 'Codé', color: 'text-cyan-400', icon: Code2 },
  tested: { label: 'Testé', color: 'text-purple-400', icon: Target },
  explained: { label: 'Expliqué', color: 'text-amber-400', icon: MessageSquare },
  mastered: { label: 'Maîtrisé', color: 'text-emerald-400', icon: CheckCircle2 },
  needs_review: { label: 'À revoir', color: 'text-orange-400', icon: AlertCircle },
};

const READINESS_STYLES: Record<string, string> = {
  ready: 'bg-emerald-500/15 text-emerald-400 border-emerald-500/30',
  almost: 'bg-amber-500/15 text-amber-400 border-amber-500/30',
  consolidate: 'bg-red-500/15 text-red-400 border-red-500/30',
  none: 'bg-neutral-500/15 text-neutral-400 border-neutral-500/30',
};

export default function CoachNsiStudentDetailPage() {
  const { data: session, status: authStatus } = useSession();
  const router = useRouter();
  const { studentId } = useParams<{ studentId: string }>();
  const role = (session?.user as { role?: string } | undefined)?.role;
  const [data, setData] = useState<StudentProgressResponse | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (authStatus === 'unauthenticated' || (authStatus === 'authenticated' && role !== 'COACH' && role !== 'ADMIN')) {
      router.push('/auth/signin');
    }
  }, [authStatus, role, router]);

  useEffect(() => {
    if (authStatus !== 'authenticated' || (role !== 'COACH' && role !== 'ADMIN') || !studentId) return;

    setLoading(true);
    fetch(`/api/coach/nsi-pratique-2026/students/${studentId}/progress`)
      .then((res) => {
        if (res.status === 403) throw new Error("Vous n'êtes pas assigné à cet élève");
        if (res.status === 404) throw new Error('Élève introuvable');
        if (!res.ok) throw new Error(`Erreur ${res.status}`);
        return res.json() as Promise<StudentProgressResponse>;
      })
      .then(setData)
      .catch((err) => setError(err.message))
      .finally(() => setLoading(false));
  }, [authStatus, role, studentId]);

  if (authStatus === 'loading' || loading) {
    return (
      <div className="flex items-center justify-center min-h-[60vh]">
        <Loader2 className="h-6 w-6 animate-spin text-neutral-400" />
      </div>
    );
  }

  if (error) {
    return (
      <div className="p-4 md:p-6 max-w-6xl mx-auto space-y-4">
        <Link href="/dashboard/coach/nsi-pratique-2026" className="inline-flex items-center gap-1.5 text-sm text-neutral-400 hover:text-neutral-200">
          <ArrowLeft className="h-4 w-4" /> Retour
        </Link>
        <div className="rounded-lg border border-red-500/30 bg-red-500/10 p-4 flex items-center gap-2">
          <AlertCircle className="h-4 w-4 text-red-400 shrink-0" />
          <p className="text-sm text-red-300">{error}</p>
        </div>
      </div>
    );
  }

  if (!data) return null;

  const { student, summary, details, recommendations } = data;

  return (
    <div className="p-4 md:p-6 max-w-6xl mx-auto space-y-6">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center gap-3">
        <Link href="/dashboard/coach/nsi-pratique-2026" className="inline-flex items-center gap-1.5 text-sm text-neutral-400 hover:text-neutral-200 shrink-0">
          <ArrowLeft className="h-4 w-4" /> Retour
        </Link>
        <div className="flex items-center gap-3 flex-1">
          <div className="h-10 w-10 rounded-full bg-brand-primary/20 flex items-center justify-center text-sm font-medium text-brand-primary">
            {student.firstName?.[0]}{student.lastName?.[0]}
          </div>
          <div>
            <h1 className="text-lg font-semibold text-neutral-100">
              {student.firstName} {student.lastName}
            </h1>
            <p className="text-xs text-neutral-400">
              {student.gradeLevel} · {student.academicTrack}
              {data.updatedAt && ` · Dernière sync : ${new Date(data.updatedAt).toLocaleDateString('fr-FR', { day: 'numeric', month: 'short', hour: '2-digit', minute: '2-digit' })}`}
            </p>
          </div>
          <span className={`ml-auto text-xs px-2.5 py-1 rounded-full border font-medium ${READINESS_STYLES[summary.readiness] ?? READINESS_STYLES.none}`}>
            {summary.readinessLabel}
          </span>
        </div>
      </div>

      {/* Summary metrics */}
      <div className="grid grid-cols-2 sm:grid-cols-4 lg:grid-cols-7 gap-3">
        <SummaryCard label="Sujets maîtrisés" value={`${summary.subjectsMastered}/${summary.subjectsTotal}`} icon={<BookOpen className="h-4 w-4" />} />
        <SummaryCard label="À revoir" value={String(summary.subjectsToReview)} icon={<AlertCircle className="h-4 w-4" />} color={summary.subjectsToReview > 0 ? 'orange' : undefined} />
        <SummaryCard label="Patrons" value={`${summary.patternsMastered}/${summary.patternsTotal}`} icon={<Puzzle className="h-4 w-4" />} />
        <SummaryCard label="Sujets blancs" value={String(summary.mockExamsCount)} icon={<FileText className="h-4 w-4" />} />
        <SummaryCard label="Plan 5j" value={summary.planTotal > 0 ? `${summary.planCompleted}/${summary.planTotal}` : '—'} icon={<BarChart3 className="h-4 w-4" />} />
        <SummaryCard label="Auto-éval." value={summary.assessmentTotal > 0 ? `${summary.assessmentOk}/${summary.assessmentTotal}` : '—'} icon={<Target className="h-4 w-4" />} />
        <SummaryCard label="Temps restant" value={summary.estimatedMinutesRemaining > 0 ? `~${Math.round(summary.estimatedMinutesRemaining / 60)}h` : '✓'} icon={<Clock className="h-4 w-4" />} />
      </div>

      {/* Recommendations */}
      {recommendations.length > 0 && (
        <Section title="Recommandations" icon={<Lightbulb className="h-4 w-4" />}>
          <ul className="space-y-1.5">
            {recommendations.map((rec, i) => (
              <li key={i} className="flex items-start gap-2 text-sm text-neutral-300">
                <TrendingUp className="h-3.5 w-3.5 text-brand-primary mt-0.5 shrink-0" />
                {rec}
              </li>
            ))}
          </ul>
        </Section>
      )}

      {!details && (
        <div className="rounded-xl border border-neutral-700 bg-surface-secondary p-8 text-center">
          <Clock className="h-8 w-8 text-neutral-500 mx-auto mb-3" />
          <p className="text-neutral-300 font-medium">Aucune progression synchronisée</p>
          <p className="text-sm text-neutral-500 mt-1">
            L&apos;élève n&apos;a pas encore commencé ou n&apos;a pas synchronisé sa progression.
          </p>
        </div>
      )}

      {details && (
        <>
          {/* Subjects grid */}
          <Section title="23 sujets d'examen" icon={<BookOpen className="h-4 w-4" />}>
            <div className="grid gap-2">
              {details.subjects.map((subject) => {
                const cfg = STATUS_CONFIG[subject.status];
                const Icon = cfg.icon;
                return (
                  <div key={subject.id} className="flex items-center gap-3 rounded-lg border border-neutral-700/50 bg-neutral-800/30 px-3 py-2">
                    <span className="text-xs text-neutral-500 font-mono w-5 text-right">{subject.id}</span>
                    <Icon className={`h-4 w-4 shrink-0 ${cfg.color}`} />
                    <div className="flex-1 min-w-0">
                      <p className="text-sm text-neutral-200 truncate">{subject.shortTitle} — {subject.title}</p>
                      <p className="text-[10px] text-neutral-500">{subject.family} · {subject.difficulty}</p>
                    </div>
                    <span className={`text-xs px-2 py-0.5 rounded ${cfg.color} bg-neutral-800`}>{cfg.label}</span>
                    {subject.lastWorkedAt && (
                      <span className="text-[10px] text-neutral-600 hidden sm:block">
                        {new Date(subject.lastWorkedAt).toLocaleDateString('fr-FR', { day: 'numeric', month: 'short' })}
                      </span>
                    )}
                  </div>
                );
              })}
            </div>
          </Section>

          {/* Patterns */}
          <Section title="8 patrons de code" icon={<Puzzle className="h-4 w-4" />}>
            <div className="grid sm:grid-cols-2 gap-2">
              {details.patterns.map((pattern) => (
                <div key={pattern.id} className="flex items-center gap-3 rounded-lg border border-neutral-700/50 bg-neutral-800/30 px-3 py-2.5">
                  <span className="text-xs text-neutral-500 font-mono w-4">{pattern.id}</span>
                  {pattern.mastered ? (
                    <CheckCircle2 className="h-4 w-4 text-emerald-400 shrink-0" />
                  ) : (
                    <XCircle className="h-4 w-4 text-neutral-600 shrink-0" />
                  )}
                  <div className="flex-1 min-w-0">
                    <p className="text-sm text-neutral-200 truncate">{pattern.title}</p>
                    <div className="flex gap-2 text-[10px] text-neutral-500">
                      {pattern.writtenByHand && <span className="text-blue-400">Écrit main</span>}
                      <span>Sujets liés : {pattern.relatedSubjects.length}</span>
                    </div>
                  </div>
                </div>
              ))}
            </div>
          </Section>

          {/* Mock exams */}
          <Section title="Sujets blancs" icon={<FileText className="h-4 w-4" />}>
            {details.mockExams.length === 0 ? (
              <p className="text-sm text-neutral-500 italic">Aucun sujet blanc réalisé.</p>
            ) : (
              <div className="space-y-2">
                {details.mockExams.map((exam, i) => (
                  <div key={i} className="flex items-center gap-3 rounded-lg border border-neutral-700/50 bg-neutral-800/30 px-3 py-2">
                    <FileText className="h-4 w-4 text-purple-400 shrink-0" />
                    <div className="flex-1">
                      <p className="text-sm text-neutral-200">
                        Sujet {exam.subjectId} — {new Date(exam.date).toLocaleDateString('fr-FR', { day: 'numeric', month: 'long', year: 'numeric' })}
                      </p>
                      {exam.completedSteps && exam.completedSteps.length > 0 && (
                        <p className="text-xs text-neutral-500">{exam.completedSteps.length} étape(s) complétée(s)</p>
                      )}
                    </div>
                    {exam.selfScore !== undefined && (
                      <span className="text-sm font-medium text-neutral-300">{exam.selfScore}/20</span>
                    )}
                  </div>
                ))}
              </div>
            )}
          </Section>

          {/* Five-day plan */}
          <Section title="Plan 5 jours" icon={<BarChart3 className="h-4 w-4" />}>
            {Object.keys(details.fiveDayPlan).length === 0 ? (
              <p className="text-sm text-neutral-500 italic">Plan non commencé.</p>
            ) : (
              <FiveDayPlanView plan={details.fiveDayPlan} />
            )}
          </Section>

          {/* Self-assessment */}
          <Section title="Auto-évaluation" icon={<Target className="h-4 w-4" />}>
            {Object.keys(details.selfAssessment).length === 0 ? (
              <p className="text-sm text-neutral-500 italic">Auto-évaluation non commencée.</p>
            ) : (
              <div className="grid sm:grid-cols-2 gap-2">
                {selfAssessmentItems.map((item) => {
                  const progress = details.selfAssessment[item.id];
                  const status = progress?.status ?? 'not_assessed';
                  return (
                    <div key={item.id} className="flex items-start gap-2 rounded-lg border border-neutral-700/50 bg-neutral-800/30 px-3 py-2">
                      {status === 'ok' ? (
                        <CheckCircle2 className="h-4 w-4 text-emerald-400 mt-0.5 shrink-0" />
                      ) : status === 'needs_review' ? (
                        <AlertCircle className="h-4 w-4 text-orange-400 mt-0.5 shrink-0" />
                      ) : (
                        <Clock className="h-4 w-4 text-neutral-600 mt-0.5 shrink-0" />
                      )}
                      <div>
                        <p className="text-sm text-neutral-200">{item.label}</p>
                        <p className="text-[10px] text-neutral-500">{item.description}</p>
                      </div>
                    </div>
                  );
                })}
              </div>
            )}
          </Section>

          {/* Oral phrases */}
          <Section title="Oral — 4 phrases par sujet" icon={<MessageSquare className="h-4 w-4" />}>
            {Object.keys(details.oralPhrases).length === 0 ? (
              <p className="text-sm text-neutral-500 italic">Aucune préparation orale enregistrée.</p>
            ) : (
              <div className="space-y-2">
                {Object.entries(details.oralPhrases).map(([subjectIdStr, phrases]) => {
                  const subjectId = parseInt(subjectIdStr, 10);
                  const oralData = phrases as OralFourPhrases;
                  const filled = [oralData.contract, oralData.strategy, oralData.edgeCase, oralData.test].filter(Boolean).length;
                  return (
                    <div key={subjectId} className="rounded-lg border border-neutral-700/50 bg-neutral-800/30 px-3 py-2.5">
                      <div className="flex items-center gap-2 mb-1.5">
                        <span className="text-xs font-mono text-neutral-500">Sujet {subjectId}</span>
                        <span className="text-xs text-neutral-400">{filled}/4 phrases</span>
                        {oralData.markedAsExplained && (
                          <span className="text-xs text-emerald-400">Expliqué ✓</span>
                        )}
                      </div>
                      <div className="grid sm:grid-cols-2 gap-1.5 text-xs">
                        <OralField label="Contrat" value={oralData.contract} />
                        <OralField label="Stratégie" value={oralData.strategy} />
                        <OralField label="Cas limite" value={oralData.edgeCase} />
                        <OralField label="Test" value={oralData.test} />
                      </div>
                    </div>
                  );
                })}
              </div>
            )}
          </Section>

          {/* Flashcards */}
          <Section title="Flashcards oral" icon={<Eye className="h-4 w-4" />}>
            {Object.keys(details.flashcards).length === 0 ? (
              <p className="text-sm text-neutral-500 italic">Aucune flashcard travaillée.</p>
            ) : (
              <div className="flex flex-wrap gap-2">
                {Object.entries(details.flashcards).map(([id, fc]) => (
                  <div key={id} className={`text-xs px-2 py-1 rounded border ${
                    fc.level >= 3 ? 'border-emerald-500/30 text-emerald-400 bg-emerald-500/10'
                    : fc.level >= 1 ? 'border-amber-500/30 text-amber-400 bg-amber-500/10'
                    : 'border-neutral-600 text-neutral-500 bg-neutral-800'
                  }`}>
                    {id} · Niv. {fc.level}
                  </div>
                ))}
              </div>
            )}
          </Section>
        </>
      )}
    </div>
  );
}

function Section({ title, icon, children }: { title: string; icon: React.ReactNode; children: React.ReactNode }) {
  return (
    <div className="rounded-xl border border-neutral-700 bg-surface-secondary p-4">
      <div className="flex items-center gap-2 mb-3">
        <span className="text-brand-primary">{icon}</span>
        <h2 className="text-sm font-semibold text-neutral-200">{title}</h2>
      </div>
      {children}
    </div>
  );
}

function SummaryCard({
  label, value, icon, color,
}: {
  label: string; value: string; icon: React.ReactNode; color?: string;
}) {
  const colorClass = color === 'orange' ? 'text-orange-400' : 'text-neutral-300';
  return (
    <div className="rounded-lg border border-neutral-700/50 bg-neutral-800/30 p-3">
      <div className={`flex items-center gap-1.5 ${colorClass}`}>
        <span className="text-neutral-500">{icon}</span>
        <span className="text-base font-semibold">{value}</span>
      </div>
      <p className="text-[10px] text-neutral-500 mt-0.5">{label}</p>
    </div>
  );
}

function FiveDayPlanView({ plan }: { plan: Record<string, { completed: boolean }> }) {
  const entries = Object.entries(plan);
  const completed = entries.filter(([, t]) => t.completed).length;
  const total = entries.length;
  const pct = total > 0 ? Math.round((completed / total) * 100) : 0;

  return (
    <div>
      <div className="flex items-center gap-2 mb-2">
        <div className="flex-1 h-2 rounded-full bg-neutral-700 overflow-hidden">
          <div className="h-full rounded-full bg-brand-primary" style={{ width: `${pct}%` }} />
        </div>
        <span className="text-xs text-neutral-400">{completed}/{total} ({pct}%)</span>
      </div>
      <div className="flex flex-wrap gap-1.5">
        {entries.map(([key, task]) => (
          <span
            key={key}
            className={`text-[10px] px-1.5 py-0.5 rounded ${
              task.completed
                ? 'bg-emerald-500/10 text-emerald-400 border border-emerald-500/20'
                : 'bg-neutral-800 text-neutral-500 border border-neutral-700'
            }`}
          >
            {key.replace(/-/g, ' ')}
          </span>
        ))}
      </div>
    </div>
  );
}

function OralField({ label, value }: { label: string; value: string }) {
  return (
    <div className={`rounded px-2 py-1 ${value ? 'bg-neutral-700/30' : 'bg-neutral-800/20'}`}>
      <span className="text-neutral-500">{label} : </span>
      <span className={value ? 'text-neutral-300' : 'text-neutral-600 italic'}>
        {value || 'Non renseigné'}
      </span>
    </div>
  );
}
