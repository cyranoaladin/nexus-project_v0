'use client';

import { useEffect, useState, useMemo } from 'react';
import { useSession } from 'next-auth/react';
import { useRouter } from 'next/navigation';
import Link from 'next/link';
import {
  Users, Loader2, Code2, CheckCircle2, AlertCircle, Clock, BookOpen,
  TrendingUp, Target, BarChart3, Puzzle, FileText, ArrowRight,
} from 'lucide-react';
import type { CoachStudentSummary } from '@/lib/nsi-pratique-2026/coach-summary';

type FilterType = 'all' | 'ready' | 'almost' | 'consolidate' | 'none' | 'review';

interface ApiResponse {
  students: CoachStudentSummary[];
  count: number;
}

const READINESS_STYLES: Record<string, { bg: string; text: string; border: string }> = {
  ready: { bg: 'bg-emerald-500/15', text: 'text-emerald-400', border: 'border-emerald-500/30' },
  almost: { bg: 'bg-amber-500/15', text: 'text-amber-400', border: 'border-amber-500/30' },
  consolidate: { bg: 'bg-red-500/15', text: 'text-red-400', border: 'border-red-500/30' },
  none: { bg: 'bg-neutral-500/15', text: 'text-neutral-400', border: 'border-neutral-500/30' },
};

function ProgressBar({ value, max, className = '' }: { value: number; max: number; className?: string }) {
  const pct = max > 0 ? Math.round((value / max) * 100) : 0;
  return (
    <div className={`h-1.5 rounded-full bg-neutral-700 overflow-hidden ${className}`}>
      <div
        className="h-full rounded-full bg-brand-primary transition-all duration-300"
        style={{ width: `${pct}%` }}
      />
    </div>
  );
}

export default function CoachNsiPratique2026Page() {
  const { data: session, status: authStatus } = useSession();
  const router = useRouter();
  const role = (session?.user as { role?: string } | undefined)?.role;
  const [students, setStudents] = useState<CoachStudentSummary[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [filter, setFilter] = useState<FilterType>('all');

  useEffect(() => {
    if (authStatus === 'unauthenticated' || (authStatus === 'authenticated' && role !== 'COACH' && role !== 'ADMIN')) {
      router.push('/auth/signin');
    }
  }, [authStatus, role, router]);

  useEffect(() => {
    if (authStatus !== 'authenticated' || (role !== 'COACH' && role !== 'ADMIN')) return;

    setLoading(true);
    fetch('/api/coach/nsi-pratique-2026/students')
      .then((res) => {
        if (!res.ok) throw new Error(`Erreur ${res.status}`);
        return res.json() as Promise<ApiResponse>;
      })
      .then((data) => {
        setStudents(data.students);
        setLoading(false);
      })
      .catch((err) => {
        setError(err.message);
        setLoading(false);
      });
  }, [authStatus, role]);

  // Computed stats
  const stats = useMemo(() => {
    const ready = students.filter(s => s.readiness === 'ready').length;
    const almost = students.filter(s => s.readiness === 'almost').length;
    const consolidate = students.filter(s => s.readiness === 'consolidate').length;
    const noProgress = students.filter(s => s.readiness === 'none').length;
    const withReview = students.filter(s => s.subjectsToReview > 0).length;
    const avgProgress = students.length > 0
      ? Math.round(students.reduce((s, st) => s + st.progressPercent, 0) / students.length)
      : 0;
    return { ready, almost, consolidate, noProgress, withReview, avgProgress };
  }, [students]);

  // Filtered students
  const filtered = useMemo(() => {
    switch (filter) {
      case 'ready': return students.filter(s => s.readiness === 'ready');
      case 'almost': return students.filter(s => s.readiness === 'almost');
      case 'consolidate': return students.filter(s => s.readiness === 'consolidate');
      case 'none': return students.filter(s => s.readiness === 'none');
      case 'review': return students.filter(s => s.subjectsToReview > 0);
      default: return students;
    }
  }, [students, filter]);

  if (authStatus === 'loading' || (authStatus === 'authenticated' && (role === 'COACH' || role === 'ADMIN') && loading)) {
    return (
      <div className="flex items-center justify-center min-h-[60vh]">
        <Loader2 className="h-6 w-6 animate-spin text-neutral-400" />
      </div>
    );
  }

  if (!session || (role !== 'COACH' && role !== 'ADMIN')) return null;

  return (
    <div className="space-y-6 p-4 md:p-6 max-w-6xl mx-auto">
      {/* Header */}
      <div className="flex items-center gap-3">
        <div className="p-2.5 rounded-xl bg-brand-primary/10">
          <Code2 className="h-6 w-6 text-brand-primary" />
        </div>
        <div>
          <h1 className="text-xl font-semibold text-neutral-100">Suivi NSI Pratique 2026</h1>
          <p className="text-sm text-neutral-400">
            {students.length} élève{students.length !== 1 ? 's' : ''} NSI suivi{students.length !== 1 ? 's' : ''}
            {students.length > 0 && ` · Progression moyenne : ${stats.avgProgress}%`}
          </p>
        </div>
      </div>

      {/* Error */}
      {error && (
        <div className="rounded-lg border border-red-500/30 bg-red-500/10 p-4 flex items-center gap-2">
          <AlertCircle className="h-4 w-4 text-red-400 shrink-0" />
          <p className="text-sm text-red-300">{error}</p>
        </div>
      )}

      {/* Empty state */}
      {!error && students.length === 0 && !loading && (
        <div className="rounded-xl border border-neutral-700 bg-surface-secondary p-8 text-center">
          <Users className="h-8 w-8 text-neutral-500 mx-auto mb-3" />
          <p className="text-neutral-300 font-medium">Aucun élève NSI assigné</p>
          <p className="text-sm text-neutral-500 mt-1">
            Vos élèves avec la spécialité NSI apparaîtront ici une fois assignés.
          </p>
        </div>
      )}

      {students.length > 0 && (
        <>
          {/* Stats cards */}
          <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-6 gap-3">
            <StatCard
              label="Élèves"
              value={students.length}
              icon={<Users className="h-4 w-4" />}
              active={filter === 'all'}
              onClick={() => setFilter('all')}
            />
            <StatCard
              label="Prêts"
              value={stats.ready}
              icon={<CheckCircle2 className="h-4 w-4" />}
              color="emerald"
              active={filter === 'ready'}
              onClick={() => setFilter(filter === 'ready' ? 'all' : 'ready')}
            />
            <StatCard
              label="Presque"
              value={stats.almost}
              icon={<TrendingUp className="h-4 w-4" />}
              color="amber"
              active={filter === 'almost'}
              onClick={() => setFilter(filter === 'almost' ? 'all' : 'almost')}
            />
            <StatCard
              label="À consolider"
              value={stats.consolidate}
              icon={<Target className="h-4 w-4" />}
              color="red"
              active={filter === 'consolidate'}
              onClick={() => setFilter(filter === 'consolidate' ? 'all' : 'consolidate')}
            />
            <StatCard
              label="Sans progression"
              value={stats.noProgress}
              icon={<Clock className="h-4 w-4" />}
              color="neutral"
              active={filter === 'none'}
              onClick={() => setFilter(filter === 'none' ? 'all' : 'none')}
            />
            <StatCard
              label="À revoir"
              value={stats.withReview}
              icon={<AlertCircle className="h-4 w-4" />}
              color="orange"
              active={filter === 'review'}
              onClick={() => setFilter(filter === 'review' ? 'all' : 'review')}
            />
          </div>

          {/* Student cards */}
          <div className="space-y-3">
            {filtered.length === 0 && (
              <div className="rounded-xl border border-neutral-700 bg-surface-secondary p-6 text-center">
                <p className="text-sm text-neutral-400">Aucun élève dans cette catégorie.</p>
              </div>
            )}

            {filtered.map((student) => {
              const style = READINESS_STYLES[student.readiness] ?? READINESS_STYLES.none;
              return (
                <Link
                  key={student.studentId}
                  href={`/dashboard/coach/nsi-pratique-2026/${student.studentId}`}
                  className="block rounded-xl border border-neutral-700 bg-surface-secondary p-4 hover:border-brand-primary/40 transition-colors group"
                >
                  <div className="flex flex-col sm:flex-row sm:items-center gap-3">
                    {/* Avatar + Name */}
                    <div className="flex items-center gap-3 min-w-0 sm:w-48">
                      <div className="h-10 w-10 rounded-full bg-brand-primary/20 flex items-center justify-center text-sm font-medium text-brand-primary shrink-0">
                        {student.firstName?.[0]}{student.lastName?.[0]}
                      </div>
                      <div className="min-w-0">
                        <p className="font-medium text-neutral-100 truncate">
                          {student.firstName} {student.lastName}
                        </p>
                        {student.lastUpdated && (
                          <p className="text-xs text-neutral-500 truncate">
                            {new Date(student.lastUpdated).toLocaleDateString('fr-FR', {
                              day: 'numeric', month: 'short', hour: '2-digit', minute: '2-digit'
                            })}
                          </p>
                        )}
                        {!student.lastUpdated && (
                          <p className="text-xs text-neutral-600 italic">Pas encore synchronisé</p>
                        )}
                      </div>
                    </div>

                    {/* Metrics */}
                    <div className="flex-1 grid grid-cols-2 sm:grid-cols-5 gap-2 sm:gap-3 text-center">
                      {/* Readiness badge */}
                      <div className="flex items-center justify-center">
                        <span className={`text-xs px-2.5 py-1 rounded-full border ${style.bg} ${style.text} ${style.border} font-medium`}>
                          {student.readinessLabel}
                        </span>
                      </div>

                      {/* Subjects */}
                      <MetricCell
                        icon={<BookOpen className="h-3.5 w-3.5" />}
                        value={`${student.subjectsMastered}/${student.subjectsTotal}`}
                        label="Sujets"
                        alert={student.subjectsToReview > 0}
                        alertText={`${student.subjectsToReview} à revoir`}
                      />

                      {/* Patterns */}
                      <MetricCell
                        icon={<Puzzle className="h-3.5 w-3.5" />}
                        value={`${student.patternsMastered}/${student.patternsTotal}`}
                        label="Patrons"
                      />

                      {/* Mock exams */}
                      <MetricCell
                        icon={<FileText className="h-3.5 w-3.5" />}
                        value={String(student.mockExamsCount)}
                        label="Sujets blancs"
                      />

                      {/* Plan */}
                      <MetricCell
                        icon={<BarChart3 className="h-3.5 w-3.5" />}
                        value={student.planTotal > 0 ? `${Math.round((student.planCompleted / student.planTotal) * 100)}%` : '—'}
                        label="Plan 5j"
                      />
                    </div>

                    {/* Progress bar + arrow */}
                    <div className="flex items-center gap-3 sm:w-32">
                      <div className="flex-1">
                        <ProgressBar value={student.subjectsMastered} max={student.subjectsTotal} />
                        <p className="text-xs text-neutral-500 mt-1 text-right">{student.progressPercent}%</p>
                      </div>
                      <ArrowRight className="h-4 w-4 text-neutral-600 group-hover:text-brand-primary transition-colors shrink-0" />
                    </div>
                  </div>

                  {/* Recommendation */}
                  {student.recommendation && (
                    <p className="text-xs text-neutral-500 mt-2 pl-13 sm:pl-[208px] italic">
                      {student.recommendation}
                    </p>
                  )}
                </Link>
              );
            })}
          </div>

          {/* Disclaimer */}
          <p className="text-xs text-neutral-500 italic">
            Les données proviennent de la progression synchronisée des élèves.
            Si un élève travaille hors ligne, la progression peut être temporairement incomplète.
          </p>
        </>
      )}
    </div>
  );
}

function StatCard({
  label, value, icon, color = 'brand', active, onClick,
}: {
  label: string; value: number; icon: React.ReactNode;
  color?: string; active?: boolean; onClick?: () => void;
}) {
  const colorMap: Record<string, string> = {
    brand: 'text-brand-primary',
    emerald: 'text-emerald-400',
    amber: 'text-amber-400',
    red: 'text-red-400',
    neutral: 'text-neutral-400',
    orange: 'text-orange-400',
  };

  return (
    <button
      onClick={onClick}
      className={`rounded-lg border p-3 text-left transition-colors ${
        active
          ? 'border-brand-primary/50 bg-brand-primary/10'
          : 'border-neutral-700 bg-surface-secondary hover:border-neutral-600'
      }`}
    >
      <div className={`flex items-center gap-1.5 ${colorMap[color] ?? colorMap.brand}`}>
        {icon}
        <span className="text-lg font-semibold">{value}</span>
      </div>
      <p className="text-xs text-neutral-400 mt-0.5">{label}</p>
    </button>
  );
}

function MetricCell({
  icon, value, label, alert, alertText,
}: {
  icon: React.ReactNode; value: string; label: string;
  alert?: boolean; alertText?: string;
}) {
  return (
    <div className="flex flex-col items-center gap-0.5">
      <div className="flex items-center gap-1 text-neutral-300">
        <span className="text-neutral-500">{icon}</span>
        <span className="text-sm font-medium">{value}</span>
      </div>
      {alert && alertText ? (
        <p className="text-[10px] text-orange-400">{alertText}</p>
      ) : (
        <p className="text-[10px] text-neutral-500">{label}</p>
      )}
    </div>
  );
}
