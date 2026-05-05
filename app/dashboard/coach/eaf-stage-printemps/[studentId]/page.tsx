'use client';

import { useEffect, useState, useCallback, useRef } from 'react';
import { useSession } from 'next-auth/react';
import { useRouter, useParams } from 'next/navigation';
import Link from 'next/link';
import {
  ArrowLeft, Save, CheckCircle2, AlertCircle, Loader2, ChevronDown,
  ChevronUp, Eye, EyeOff, Clock, User, FileText,
} from 'lucide-react';
import type {
  CoachEafBilanFormData,
  AttendanceAndEngagement,
  ExamExpectations,
  Commentary,
  Dissertation,
  Writing,
  AutonomyAndMethod,
  Progress,
  ParentRecommendations,
} from '@/lib/coach/eaf-stage-printemps/types';

// ─── Types ────────────────────────────────────────────────────────────────────

type StudentInfo = {
  id: string;
  firstName?: string;
  lastName?: string;
  email?: string;
  gradeLevel?: string;
  academicTrack?: string;
  school?: string;
};

type StudentSummary = {
  beforeConfidence?: string;
  afterConfidence?: string;
  beforeStress?: string;
  afterStress?: string;
  bestProgress?: string;
  priorityWork?: string;
  finalMessage?: string;
  progressFeeling?: string;
  submittedAt?: string;
};

type BilanStatus = 'NOT_STARTED' | 'DRAFT' | 'COMPLETED' | 'VALIDATED';

type PriorityAxisValue =
  | 'commentaire'
  | 'dissertation'
  | 'redaction'
  | 'grammaire'
  | 'vocabulaire'
  | 'lecture-analytique'
  | 'references-litteraires'
  | 'gestion-du-temps'
  | 'methode-de-revision'
  | 'confiance-a-lecrit';

// ─── Helpers ──────────────────────────────────────────────────────────────────

const RATING_LABELS = ['', 'Insuffisant', 'Fragile', 'En progression', 'Satisfaisant', 'Maîtrisé'];

function RatingInput({
  label,
  value,
  onChange,
  disabled,
}: {
  label: string;
  value?: number;
  onChange: (v: number) => void;
  disabled?: boolean;
}) {
  return (
    <div className="flex flex-col gap-1.5">
      <label className="text-xs text-neutral-400">{label}</label>
      <div className="flex gap-1.5">
        {[1, 2, 3, 4, 5].map(n => (
          <button
            key={n}
            type="button"
            disabled={disabled}
            onClick={() => onChange(n)}
            title={RATING_LABELS[n]}
            className={`flex h-8 w-8 items-center justify-center rounded-lg border text-xs font-semibold transition disabled:opacity-40 ${
              value === n
                ? 'border-brand-accent bg-brand-accent text-white'
                : 'border-white/10 bg-white/5 text-neutral-400 hover:border-brand-accent/40 hover:text-white'
            }`}
          >
            {n}
          </button>
        ))}
        {value !== undefined && (
          <span className="flex items-center px-2 text-xs text-neutral-500">
            {RATING_LABELS[value] ?? ''}
          </span>
        )}
      </div>
    </div>
  );
}

function SelectInput({
  label,
  value,
  options,
  onChange,
  disabled,
}: {
  label: string;
  value?: string;
  options: { value: string; label: string }[];
  onChange: (v: string) => void;
  disabled?: boolean;
}) {
  return (
    <div className="flex flex-col gap-1.5">
      <label className="text-xs text-neutral-400">{label}</label>
      <select
        value={value ?? ''}
        onChange={e => onChange(e.target.value)}
        disabled={disabled}
        className="rounded-xl border border-white/10 bg-surface-darker px-3 py-2 text-sm text-neutral-200 focus:border-brand-accent/50 focus:outline-none disabled:opacity-40"
      >
        <option value="">— Sélectionner —</option>
        {options.map(o => (
          <option key={o.value} value={o.value}>{o.label}</option>
        ))}
      </select>
    </div>
  );
}

function TextareaInput({
  label,
  value,
  onChange,
  placeholder,
  rows,
  disabled,
}: {
  label: string;
  value?: string;
  onChange: (v: string) => void;
  placeholder?: string;
  rows?: number;
  disabled?: boolean;
}) {
  return (
    <div className="flex flex-col gap-1.5">
      <label className="text-xs text-neutral-400">{label}</label>
      <textarea
        value={value ?? ''}
        onChange={e => onChange(e.target.value)}
        rows={rows ?? 3}
        placeholder={placeholder}
        disabled={disabled}
        className="resize-y rounded-2xl border border-white/10 bg-surface-darker px-4 py-3 text-sm text-neutral-200 placeholder-neutral-600 focus:border-brand-accent/50 focus:outline-none disabled:opacity-40"
      />
    </div>
  );
}

function SectionCard({
  title,
  children,
  defaultOpen,
}: {
  title: string;
  children: React.ReactNode;
  defaultOpen?: boolean;
}) {
  const [open, setOpen] = useState(defaultOpen ?? true);
  return (
    <div className="rounded-[24px] border border-white/10 bg-white/5">
      <button
        type="button"
        onClick={() => setOpen(o => !o)}
        className="flex w-full items-center justify-between px-6 py-4 text-left"
      >
        <span className="font-medium text-white">{title}</span>
        {open ? <ChevronUp className="h-4 w-4 text-neutral-500" /> : <ChevronDown className="h-4 w-4 text-neutral-500" />}
      </button>
      {open && <div className="space-y-5 border-t border-white/10 px-6 py-5">{children}</div>}
    </div>
  );
}

// ─── Options ──────────────────────────────────────────────────────────────────

const ATTENDANCE_OPTIONS = [
  { value: 'excellente', label: 'Excellente' },
  { value: 'reguliere', label: 'Régulière' },
  { value: 'irreguliere', label: 'Irrégulière' },
  { value: 'insuffisante', label: 'Insuffisante' },
];

const PUNCTUALITY_OPTIONS = [
  { value: 'tres-satisfaisante', label: 'Très satisfaisante' },
  { value: 'satisfaisante', label: 'Satisfaisante' },
  { value: 'a-ameliorer', label: 'À améliorer' },
];

const ATTITUDE_OPTIONS = [
  { value: 'perseverant', label: 'Persévérant(e)' },
  { value: 'volontaire-mais-hesitant', label: 'Volontaire mais hésitant(e)' },
  { value: 'manque-de-confiance', label: 'Manque de confiance' },
  { value: 'se-decourage-rapidement', label: 'Se décourage rapidement' },
  { value: 'besoin-detre-guide', label: "Besoin d'être davantage guidé(e)" },
];

const GLOBAL_PROGRESS_OPTIONS = [
  { value: 'tres-nette', label: 'Très nette' },
  { value: 'nette', label: 'Nette' },
  { value: 'moderee', label: 'Modérée' },
  { value: 'legere', label: 'Légère' },
  { value: 'insuffisante', label: 'Insuffisante' },
];

const SKILL_OPTIONS = [
  { value: 'comprehension-des-textes', label: 'Compréhension des textes' },
  { value: 'analyse-des-citations', label: 'Analyse des citations' },
  { value: 'construction-du-plan', label: 'Construction du plan' },
  { value: 'redaction', label: 'Rédaction' },
  { value: 'dissertation', label: 'Dissertation' },
  { value: 'commentaire', label: 'Commentaire' },
  { value: 'gestion-du-temps', label: 'Gestion du temps' },
  { value: 'confiance', label: 'Confiance' },
  { value: 'methode', label: 'Méthode' },
];

const LEVEL_OPTIONS = [
  { value: 'tres-solide', label: 'Très solide' },
  { value: 'satisfaisant', label: 'Satisfaisant' },
  { value: 'fragile-mais-en-progres', label: 'Fragile mais en progression' },
  { value: 'fragile', label: 'Fragile' },
  { value: 'preoccupant', label: 'Préoccupant' },
];

const FOLLOW_UP_OPTIONS = [
  { value: 'autonomie-suffisante', label: 'Autonomie suffisante avec travail régulier' },
  { value: 'consolidation-ponctuelle', label: 'Consolidation ponctuelle recommandée' },
  { value: 'accompagnement-regulier', label: 'Accompagnement régulier recommandé' },
  { value: 'entrainement-intensif', label: "Entraînement intensif recommandé avant l'épreuve" },
];

const PRIORITY_AXES_OPTIONS: { value: PriorityAxisValue; label: string }[] = [
  { value: 'commentaire', label: 'Commentaire' },
  { value: 'dissertation', label: 'Dissertation' },
  { value: 'redaction', label: 'Rédaction' },
  { value: 'grammaire', label: 'Grammaire' },
  { value: 'vocabulaire', label: 'Vocabulaire' },
  { value: 'lecture-analytique', label: 'Lecture analytique' },
  { value: 'references-litteraires', label: 'Références littéraires' },
  { value: 'gestion-du-temps', label: 'Gestion du temps' },
  { value: 'methode-de-revision', label: 'Méthode de révision' },
  { value: 'confiance-a-lecrit', label: "Confiance à l'écrit" },
];

// ─── Initial state ─────────────────────────────────────────────────────────────

const EMPTY_FORM: CoachEafBilanFormData = {
  action: 'draft',
  attendanceAndEngagement: {},
  examExpectations: {},
  commentary: {},
  dissertation: {},
  writing: {},
  autonomyAndMethod: {},
  progress: {},
  parentRecommendations: {},
};

// ─── Main page ────────────────────────────────────────────────────────────────

export default function CoachEafBilanPage() {
  const { data: session, status } = useSession();
  const router = useRouter();
  const params = useParams();
  const studentId = params.studentId as string;

  const [student, setStudent] = useState<StudentInfo | null>(null);
  const [studentSummary, setStudentSummary] = useState<StudentSummary | null>(null);
  const [formData, setFormData] = useState<CoachEafBilanFormData>(EMPTY_FORM);
  const [bilanStatus, setBilanStatus] = useState<BilanStatus>('NOT_STARTED');
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [validating, setValidating] = useState(false);
  const [lastSaved, setLastSaved] = useState<string | null>(null);
  const [apiError, setApiError] = useState<string | null>(null);
  const [successMessage, setSuccessMessage] = useState<string | null>(null);
  const [showPreview, setShowPreview] = useState(false);
  const [previewText, setPreviewText] = useState('');
  const [showStudentSummary, setShowStudentSummary] = useState(false);
  const [confirmComplete, setConfirmComplete] = useState(false);

  const autosaveTimer = useRef<NodeJS.Timeout | null>(null);

  useEffect(() => {
    if (status === 'loading') return;
    if (!session || session.user.role !== 'COACH') {
      router.push('/auth/signin');
    }
  }, [session, status, router]);

  // Load existing bilan
  const load = useCallback(async () => {
    setLoading(true);
    try {
      const res = await fetch(`/api/coach/eaf-stage-printemps/students/${studentId}/report`);
      if (!res.ok) {
        if (res.status === 403) {
          router.push('/dashboard/coach/eaf-stage-printemps');
          return;
        }
        throw new Error('Erreur de chargement');
      }
      const data = await res.json() as {
        student: StudentInfo;
        coachBilan: {
          id: string;
          sourceData: Record<string, unknown>;
          status: string;
          isPublished: boolean;
          updatedAt: string;
        } | null;
        studentSummary: StudentSummary | null;
      };

      setStudent(data.student);
      setStudentSummary(data.studentSummary);

      if (data.coachBilan) {
        const sd = data.coachBilan.sourceData as Record<string, unknown>;
        setFormData({
          action: 'draft',
          attendanceAndEngagement: (sd.attendanceAndEngagement as AttendanceAndEngagement) ?? {},
          examExpectations: (sd.examExpectations as ExamExpectations) ?? {},
          commentary: (sd.commentary as Commentary) ?? {},
          dissertation: (sd.dissertation as Dissertation) ?? {},
          writing: (sd.writing as Writing) ?? {},
          autonomyAndMethod: (sd.autonomyAndMethod as AutonomyAndMethod) ?? {},
          progress: (sd.progress as Progress) ?? {},
          parentRecommendations: (sd.parentRecommendations as ParentRecommendations) ?? {},
        });
        setLastSaved(data.coachBilan.updatedAt ? new Date(data.coachBilan.updatedAt).toLocaleTimeString('fr-FR') : null);
        if (data.coachBilan.status === 'COMPLETED' && data.coachBilan.isPublished) {
          setBilanStatus('VALIDATED');
        } else if (data.coachBilan.status === 'COMPLETED') {
          setBilanStatus('COMPLETED');
        } else {
          setBilanStatus('DRAFT');
        }
      }
    } catch (e) {
      setApiError(e instanceof Error ? e.message : 'Erreur');
    } finally {
      setLoading(false);
    }
  }, [studentId, router]);

  useEffect(() => {
    if (status === 'authenticated') load();
  }, [status, load]);

  // Save function
  const save = useCallback(async (action: 'draft' | 'complete') => {
    setSaving(true);
    setApiError(null);
    try {
      const payload = { ...formData, action };
      const res = await fetch(`/api/coach/eaf-stage-printemps/students/${studentId}/report`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload),
      });
      if (!res.ok) {
        const err = await res.json() as { message?: string; error?: string };
        throw new Error(err.message ?? err.error ?? 'Erreur de sauvegarde');
      }
      setLastSaved(new Date().toLocaleTimeString('fr-FR'));
      if (action === 'complete') {
        setBilanStatus('COMPLETED');
        setConfirmComplete(false);
      } else {
        setBilanStatus(prev => prev === 'NOT_STARTED' ? 'DRAFT' : prev);
      }
    } catch (e) {
      setApiError(e instanceof Error ? e.message : 'Erreur de sauvegarde');
    } finally {
      setSaving(false);
    }
  }, [formData, studentId]);

  // Autosave with debounce (skip if VALIDATED)
  useEffect(() => {
    if (bilanStatus === 'VALIDATED') return;
    if (loading) return;
    if (autosaveTimer.current) clearTimeout(autosaveTimer.current);
    autosaveTimer.current = setTimeout(() => {
      save('draft');
    }, 3000);
    return () => {
      if (autosaveTimer.current) clearTimeout(autosaveTimer.current);
    };
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [formData]);

  // Generate preview
  const generatePreview = useCallback(async () => {
    const { generateParentEafStageReport } = await import('@/lib/coach/eaf-stage-printemps/generate-parent-report');
    const text = generateParentEafStageReport(formData as Parameters<typeof generateParentEafStageReport>[0], {
      firstName: student?.firstName,
      lastName: student?.lastName,
      gradeLevel: student?.gradeLevel,
    });
    setPreviewText(text);
    setShowPreview(true);
  }, [formData, student]);

  const validateBilan = useCallback(async () => {
    setValidating(true);
    setApiError(null);
    setSuccessMessage(null);
    try {
      const res = await fetch(`/api/coach/eaf-stage-printemps/students/${studentId}/report`, {
        method: 'PATCH',
      });
      if (!res.ok) {
        const d = await res.json().catch(() => ({}));
        throw new Error(d.message || 'Validation échouée.');
      }
      setSuccessMessage('Le bilan a été validé et publié à l\'élève.');
      setBilanStatus('VALIDATED');
    } catch (e) {
      setApiError(e instanceof Error ? e.message : 'Erreur de validation.');
    } finally {
      setValidating(false);
    }
  }, [studentId]);

  const isReadOnly = bilanStatus === 'VALIDATED';

  // Helpers to update nested form sections
  function updateSection<K extends keyof CoachEafBilanFormData>(
    section: K,
    patch: Partial<CoachEafBilanFormData[K]>,
  ) {
    setFormData(prev => ({
      ...prev,
      [section]: { ...(prev[section] as object), ...(patch as object) },
    }));
  }

  const ae = formData.attendanceAndEngagement ?? {};
  const ee = formData.examExpectations ?? {};
  const com = formData.commentary ?? {};
  const dis = formData.dissertation ?? {};
  const wr = formData.writing ?? {};
  const am = formData.autonomyAndMethod ?? {};
  const pr = formData.progress ?? {};
  const pra = formData.parentRecommendations ?? {};

  if (status === 'loading' || loading) {
    return (
      <div className="flex min-h-[50vh] items-center justify-center">
        <Loader2 className="h-8 w-8 animate-spin text-brand-accent" />
      </div>
    );
  }

  const displayName = [student?.firstName, student?.lastName].filter(Boolean).join(' ') || student?.email || 'Élève';

  return (
    <div className="mx-auto max-w-4xl space-y-6 px-4 py-10">
      {/* Back link */}
      <div className="flex items-center gap-3">
        <Link
          href="/dashboard/coach/eaf-stage-printemps"
          className="flex items-center gap-2 rounded-xl border border-white/10 bg-white/5 px-3 py-2 text-sm text-neutral-300 hover:bg-white/10"
        >
          <ArrowLeft className="h-4 w-4" />
          Retour à la liste
        </Link>
      </div>

      {/* Student header */}
      <div className="rounded-[28px] border border-white/10 bg-white/5 p-6">
        <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
          <div className="flex items-center gap-4">
            <div className="flex h-12 w-12 items-center justify-center rounded-full bg-brand-accent/15 font-semibold text-brand-accent">
              {(student?.firstName?.[0] ?? '?').toUpperCase()}
            </div>
            <div>
              <h1 className="text-xl font-semibold text-white">{displayName}</h1>
              <div className="mt-1 flex flex-wrap gap-3 text-xs text-neutral-500">
                {student?.gradeLevel && <span>{student.gradeLevel}</span>}
                {student?.academicTrack && <span>· {student.academicTrack}</span>}
                {student?.school && <span>· {student.school}</span>}
              </div>
            </div>
          </div>
          <div className="flex flex-col items-end gap-2 text-right">
            <span className={`inline-flex items-center gap-1.5 rounded-full border px-3 py-1 text-xs font-medium ${
              bilanStatus === 'VALIDATED' ? 'border-emerald-500/30 bg-emerald-500/15 text-emerald-300' :
              bilanStatus === 'COMPLETED' ? 'border-blue-500/30 bg-blue-500/15 text-blue-300' :
              bilanStatus === 'DRAFT' ? 'border-amber-500/30 bg-amber-500/15 text-amber-300' :
              'border-neutral-500/30 bg-neutral-500/15 text-neutral-400'
            }`}>
              <FileText className="h-3 w-3" />
              {bilanStatus === 'VALIDATED' ? 'Validé' :
               bilanStatus === 'COMPLETED' ? 'Complété' :
               bilanStatus === 'DRAFT' ? 'Brouillon' : 'À rédiger'}
            </span>
            {lastSaved && (
              <span className="flex items-center gap-1 text-xs text-neutral-500">
                <Clock className="h-3 w-3" />
                Sauvegardé à {lastSaved}
              </span>
            )}
          </div>
        </div>
      </div>

      {/* API Error */}
      {apiError && (
        <div className="flex items-center gap-3 rounded-2xl border border-red-500/20 bg-red-500/10 p-4 text-sm text-red-300">
          <AlertCircle className="h-4 w-4 shrink-0" />
          {apiError}
        </div>
      )}

      {/* Success message */}
      {successMessage && (
        <div className="flex items-center gap-3 rounded-2xl border border-emerald-500/20 bg-emerald-500/10 p-4 text-sm text-emerald-300">
          <CheckCircle2 className="h-4 w-4 shrink-0" />
          {successMessage}
        </div>
      )}

      {/* Student questionnaire summary (read-only) */}
      {studentSummary && (
        <div className="rounded-[24px] border border-white/10 bg-white/5">
          <button
            type="button"
            onClick={() => setShowStudentSummary(o => !o)}
            className="flex w-full items-center justify-between px-6 py-4"
          >
            <span className="flex items-center gap-2 text-sm font-medium text-neutral-300">
              <User className="h-4 w-4 text-neutral-500" />
              Réponses de l&apos;élève (lecture seule)
            </span>
            {showStudentSummary
              ? <ChevronUp className="h-4 w-4 text-neutral-500" />
              : <ChevronDown className="h-4 w-4 text-neutral-500" />}
          </button>
          {showStudentSummary && (
            <div className="grid grid-cols-1 gap-3 border-t border-white/10 px-6 py-4 sm:grid-cols-2">
              {studentSummary.beforeConfidence && (
                <div>
                  <span className="text-xs text-neutral-500">Confiance avant :</span>
                  <p className="text-sm text-neutral-300">{studentSummary.beforeConfidence}</p>
                </div>
              )}
              {studentSummary.afterConfidence && (
                <div>
                  <span className="text-xs text-neutral-500">Confiance après :</span>
                  <p className="text-sm text-neutral-300">{studentSummary.afterConfidence}</p>
                </div>
              )}
              {studentSummary.beforeStress && (
                <div>
                  <span className="text-xs text-neutral-500">Stress avant :</span>
                  <p className="text-sm text-neutral-300">{studentSummary.beforeStress}</p>
                </div>
              )}
              {studentSummary.afterStress && (
                <div>
                  <span className="text-xs text-neutral-500">Stress après :</span>
                  <p className="text-sm text-neutral-300">{studentSummary.afterStress}</p>
                </div>
              )}
              {studentSummary.bestProgress && (
                <div>
                  <span className="text-xs text-neutral-500">Compétence améliorée :</span>
                  <p className="text-sm text-neutral-300">{studentSummary.bestProgress}</p>
                </div>
              )}
              {studentSummary.priorityWork && (
                <div>
                  <span className="text-xs text-neutral-500">Priorité de travail :</span>
                  <p className="text-sm text-neutral-300">{studentSummary.priorityWork}</p>
                </div>
              )}
              {studentSummary.finalMessage && (
                <div className="sm:col-span-2">
                  <span className="text-xs text-neutral-500">Message final :</span>
                  <p className="text-sm italic text-neutral-300">&ldquo;{studentSummary.finalMessage}&rdquo;</p>
                </div>
              )}
            </div>
          )}
        </div>
      )}

      {/* ── Section 1 — Présence et implication ── */}
      <SectionCard title="1. Présence et implication" defaultOpen={true}>
        <div className="grid grid-cols-1 gap-5 sm:grid-cols-2">
          <SelectInput
            label="Assiduité"
            value={ae.attendance}
            options={ATTENDANCE_OPTIONS}
            onChange={v => updateSection('attendanceAndEngagement', { attendance: v as AttendanceAndEngagement['attendance'] })}
            disabled={isReadOnly}
          />
          <SelectInput
            label="Ponctualité"
            value={ae.punctuality}
            options={PUNCTUALITY_OPTIONS}
            onChange={v => updateSection('attendanceAndEngagement', { punctuality: v as AttendanceAndEngagement['punctuality'] })}
            disabled={isReadOnly}
          />
        </div>
        <div className="grid grid-cols-1 gap-5 sm:grid-cols-3">
          <RatingInput label="Implication pendant les séances" value={ae.involvement} onChange={v => updateSection('attendanceAndEngagement', { involvement: v })} disabled={isReadOnly} />
          <RatingInput label="Concentration" value={ae.concentration} onChange={v => updateSection('attendanceAndEngagement', { concentration: v })} disabled={isReadOnly} />
          <RatingInput label="Participation orale" value={ae.oralParticipation} onChange={v => updateSection('attendanceAndEngagement', { oralParticipation: v })} disabled={isReadOnly} />
        </div>
        <SelectInput
          label="Attitude face aux difficultés"
          value={ae.attitudeToDifficulty}
          options={ATTITUDE_OPTIONS}
          onChange={v => updateSection('attendanceAndEngagement', { attitudeToDifficulty: v as AttendanceAndEngagement['attitudeToDifficulty'] })}
          disabled={isReadOnly}
        />
        <TextareaInput
          label="Commentaire sur l'attitude de travail"
          value={ae.coachComment}
          onChange={v => updateSection('attendanceAndEngagement', { coachComment: v })}
          placeholder="Observations libres sur l'attitude de l'élève pendant le stage…"
          disabled={isReadOnly}
        />
      </SectionCard>

      {/* ── Section 2 — Compréhension des attentes de l'EAF ── */}
      <SectionCard title="2. Compréhension des attentes de l'EAF" defaultOpen={false}>
        <div className="grid grid-cols-1 gap-5 sm:grid-cols-2">
          <RatingInput label="Comprend les attentes générales de l'épreuve écrite" value={ee.understandsWrittenExam} onChange={v => updateSection('examExpectations', { understandsWrittenExam: v })} disabled={isReadOnly} />
          <RatingInput label="Distingue résumé, analyse et interprétation" value={ee.distinguishesAnalysisAndSummary} onChange={v => updateSection('examExpectations', { distinguishesAnalysisAndSummary: v })} disabled={isReadOnly} />
          <RatingInput label="Comprend la différence entre citer et analyser" value={ee.quoteVsAnalysis} onChange={v => updateSection('examExpectations', { quoteVsAnalysis: v })} disabled={isReadOnly} />
          <RatingInput label="Sait identifier les exigences d'un sujet" value={ee.subjectRequirements} onChange={v => updateSection('examExpectations', { subjectRequirements: v })} disabled={isReadOnly} />
          <RatingInput label="Sait éviter le hors-sujet" value={ee.avoidsOffTopic} onChange={v => updateSection('examExpectations', { avoidsOffTopic: v })} disabled={isReadOnly} />
          <RatingInput label="Comprend les critères de réussite d'une copie" value={ee.successCriteria} onChange={v => updateSection('examExpectations', { successCriteria: v })} disabled={isReadOnly} />
        </div>
        <TextareaInput
          label="Observations sur la compréhension des attentes"
          value={ee.coachComment}
          onChange={v => updateSection('examExpectations', { coachComment: v })}
          placeholder="Observations libres…"
          disabled={isReadOnly}
        />
      </SectionCard>

      {/* ── Section 3 — Commentaire de texte ── */}
      <SectionCard title="3. Commentaire de texte" defaultOpen={false}>
        <div className="grid grid-cols-1 gap-5 sm:grid-cols-2">
          <RatingInput label="Compréhension globale d'un texte littéraire" value={com.textUnderstanding} onChange={v => updateSection('commentary', { textUnderstanding: v })} disabled={isReadOnly} />
          <RatingInput label="Repérage des enjeux du texte" value={com.textIssues} onChange={v => updateSection('commentary', { textIssues: v })} disabled={isReadOnly} />
          <RatingInput label="Formulation d'un projet de lecture" value={com.readingProject} onChange={v => updateSection('commentary', { readingProject: v })} disabled={isReadOnly} />
          <RatingInput label="Repérage de citations pertinentes" value={com.relevantQuotes} onChange={v => updateSection('commentary', { relevantQuotes: v })} disabled={isReadOnly} />
          <RatingInput label="Analyse des procédés" value={com.processAnalysis} onChange={v => updateSection('commentary', { processAnalysis: v })} disabled={isReadOnly} />
          <RatingInput label="Interprétation des citations" value={com.interpretation} onChange={v => updateSection('commentary', { interpretation: v })} disabled={isReadOnly} />
          <RatingInput label="Organisation du commentaire" value={com.organization} onChange={v => updateSection('commentary', { organization: v })} disabled={isReadOnly} />
          <RatingInput label="Construction des paragraphes" value={com.paragraphs} onChange={v => updateSection('commentary', { paragraphs: v })} disabled={isReadOnly} />
          <RatingInput label="Transitions" value={com.transitions} onChange={v => updateSection('commentary', { transitions: v })} disabled={isReadOnly} />
          <RatingInput label="Capacité à éviter la paraphrase" value={com.noParaphrase} onChange={v => updateSection('commentary', { noParaphrase: v })} disabled={isReadOnly} />
        </div>
        <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
          <TextareaInput label="Points forts observés en commentaire" value={com.strengths} onChange={v => updateSection('commentary', { strengths: v })} disabled={isReadOnly} />
          <TextareaInput label="Difficultés restantes en commentaire" value={com.difficulties} onChange={v => updateSection('commentary', { difficulties: v })} disabled={isReadOnly} />
        </div>
        <TextareaInput label="Priorité de travail pour le commentaire" value={com.priority} onChange={v => updateSection('commentary', { priority: v })} rows={2} disabled={isReadOnly} />
      </SectionCard>

      {/* ── Section 4 — Dissertation ── */}
      <SectionCard title="4. Dissertation" defaultOpen={false}>
        <div className="grid grid-cols-1 gap-5 sm:grid-cols-2">
          <RatingInput label="Compréhension du sujet" value={dis.subjectUnderstanding} onChange={v => updateSection('dissertation', { subjectUnderstanding: v })} disabled={isReadOnly} />
          <RatingInput label="Analyse des mots-clés" value={dis.keywordsAnalysis} onChange={v => updateSection('dissertation', { keywordsAnalysis: v })} disabled={isReadOnly} />
          <RatingInput label="Formulation d'une problématique" value={dis.problematique} onChange={v => updateSection('dissertation', { problematique: v })} disabled={isReadOnly} />
          <RatingInput label="Construction d'un plan progressif" value={dis.progressivePlan} onChange={v => updateSection('dissertation', { progressivePlan: v })} disabled={isReadOnly} />
          <RatingInput label="Formulation des arguments" value={dis.arguments} onChange={v => updateSection('dissertation', { arguments: v })} disabled={isReadOnly} />
          <RatingInput label="Mobilisation de l'œuvre" value={dis.workMobilization} onChange={v => updateSection('dissertation', { workMobilization: v })} disabled={isReadOnly} />
          <RatingInput label="Exploitation des exemples" value={dis.examplesUse} onChange={v => updateSection('dissertation', { examplesUse: v })} disabled={isReadOnly} />
          <RatingInput label="Capacité à répondre au sujet" value={dis.answersSubject} onChange={v => updateSection('dissertation', { answersSubject: v })} disabled={isReadOnly} />
          <RatingInput label="Qualité de l'introduction" value={dis.introduction} onChange={v => updateSection('dissertation', { introduction: v })} disabled={isReadOnly} />
          <RatingInput label="Qualité de la conclusion" value={dis.conclusion} onChange={v => updateSection('dissertation', { conclusion: v })} disabled={isReadOnly} />
        </div>
        <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
          <TextareaInput label="Points forts observés en dissertation" value={dis.strengths} onChange={v => updateSection('dissertation', { strengths: v })} disabled={isReadOnly} />
          <TextareaInput label="Difficultés restantes en dissertation" value={dis.difficulties} onChange={v => updateSection('dissertation', { difficulties: v })} disabled={isReadOnly} />
        </div>
        <TextareaInput label="Priorité de travail pour la dissertation" value={dis.priority} onChange={v => updateSection('dissertation', { priority: v })} rows={2} disabled={isReadOnly} />
      </SectionCard>

      {/* ── Section 5 — Expression écrite ── */}
      <SectionCard title="5. Expression écrite" defaultOpen={false}>
        <div className="grid grid-cols-1 gap-5 sm:grid-cols-2">
          <RatingInput label="Clarté des phrases" value={wr.sentenceClarity} onChange={v => updateSection('writing', { sentenceClarity: v })} disabled={isReadOnly} />
          <RatingInput label="Correction grammaticale" value={wr.grammar} onChange={v => updateSection('writing', { grammar: v })} disabled={isReadOnly} />
          <RatingInput label="Orthographe" value={wr.spelling} onChange={v => updateSection('writing', { spelling: v })} disabled={isReadOnly} />
          <RatingInput label="Précision du vocabulaire" value={wr.lexicalPrecision} onChange={v => updateSection('writing', { lexicalPrecision: v })} disabled={isReadOnly} />
          <RatingInput label="Vocabulaire d'analyse littéraire" value={wr.literaryVocabulary} onChange={v => updateSection('writing', { literaryVocabulary: v })} disabled={isReadOnly} />
          <RatingInput label="Fluidité du propos" value={wr.fluency} onChange={v => updateSection('writing', { fluency: v })} disabled={isReadOnly} />
          <RatingInput label="Capacité à structurer un paragraphe" value={wr.paragraphStructure} onChange={v => updateSection('writing', { paragraphStructure: v })} disabled={isReadOnly} />
          <RatingInput label="Capacité à expliquer une idée" value={wr.ideaExplanation} onChange={v => updateSection('writing', { ideaExplanation: v })} disabled={isReadOnly} />
          <RatingInput label="Capacité à rédiger dans le temps imparti" value={wr.timedWriting} onChange={v => updateSection('writing', { timedWriting: v })} disabled={isReadOnly} />
        </div>
        <TextareaInput label="Observations sur la qualité de rédaction" value={wr.observations} onChange={v => updateSection('writing', { observations: v })} disabled={isReadOnly} />
        <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
          <TextareaInput label="Erreurs fréquentes" value={wr.frequentErrors} onChange={v => updateSection('writing', { frequentErrors: v })} disabled={isReadOnly} />
          <TextareaInput label="Recommandations de rédaction" value={wr.recommendations} onChange={v => updateSection('writing', { recommendations: v })} disabled={isReadOnly} />
        </div>
      </SectionCard>

      {/* ── Section 6 — Autonomie et méthode de travail ── */}
      <SectionCard title="6. Autonomie et méthode de travail" defaultOpen={false}>
        <div className="grid grid-cols-1 gap-5 sm:grid-cols-2">
          <RatingInput label="Autonomie dans les exercices" value={am.autonomy} onChange={v => updateSection('autonomyAndMethod', { autonomy: v })} disabled={isReadOnly} />
          <RatingInput label="Capacité à appliquer une méthode" value={am.methodApplication} onChange={v => updateSection('autonomyAndMethod', { methodApplication: v })} disabled={isReadOnly} />
          <RatingInput label="Capacité à corriger ses erreurs" value={am.errorCorrection} onChange={v => updateSection('autonomyAndMethod', { errorCorrection: v })} disabled={isReadOnly} />
          <RatingInput label="Capacité à réutiliser une correction" value={am.correctionReuse} onChange={v => updateSection('autonomyAndMethod', { correctionReuse: v })} disabled={isReadOnly} />
          <RatingInput label="Gestion du temps" value={am.timeManagement} onChange={v => updateSection('autonomyAndMethod', { timeManagement: v })} disabled={isReadOnly} />
          <RatingInput label="Régularité du travail personnel" value={am.personalWorkRegularity} onChange={v => updateSection('autonomyAndMethod', { personalWorkRegularity: v })} disabled={isReadOnly} />
          <RatingInput label="Capacité à organiser ses révisions" value={am.revisionOrganization} onChange={v => updateSection('autonomyAndMethod', { revisionOrganization: v })} disabled={isReadOnly} />
        </div>
        <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
          <TextareaInput label="Méthode de travail observée" value={am.observedMethod} onChange={v => updateSection('autonomyAndMethod', { observedMethod: v })} disabled={isReadOnly} />
          <TextareaInput label="Conseils pour les prochaines semaines" value={am.advice} onChange={v => updateSection('autonomyAndMethod', { advice: v })} disabled={isReadOnly} />
        </div>
      </SectionCard>

      {/* ── Section 7 — Progression observée ── */}
      <SectionCard title="7. Progression observée pendant le stage" defaultOpen={false}>
        <div className="grid grid-cols-1 gap-5 sm:grid-cols-3">
          <SelectInput
            label="Progression globale"
            value={pr.globalProgress}
            options={GLOBAL_PROGRESS_OPTIONS}
            onChange={v => updateSection('progress', { globalProgress: v as Progress['globalProgress'] })}
            disabled={isReadOnly}
          />
          <SelectInput
            label="Compétence la plus améliorée"
            value={pr.mostImprovedSkill}
            options={SKILL_OPTIONS}
            onChange={v => updateSection('progress', { mostImprovedSkill: v as Progress['mostImprovedSkill'] })}
            disabled={isReadOnly}
          />
          <SelectInput
            label="Compétence prioritaire à travailler"
            value={pr.prioritySkill}
            options={SKILL_OPTIONS}
            onChange={v => updateSection('progress', { prioritySkill: v as Progress['prioritySkill'] })}
            disabled={isReadOnly}
          />
        </div>
        <TextareaInput
          label="Description des progrès observés pendant le stage"
          value={pr.observedProgressComment}
          onChange={v => updateSection('progress', { observedProgressComment: v })}
          placeholder="Décrivez les progrès observés…"
          rows={4}
          disabled={isReadOnly}
        />
      </SectionCard>

      {/* ── Section 8 — Recommandations aux parents ── */}
      <SectionCard title="8. Recommandations aux parents" defaultOpen={false}>
        <div className="grid grid-cols-1 gap-5 sm:grid-cols-2">
          <SelectInput
            label="Niveau actuel estimé"
            value={pra.estimatedCurrentLevel}
            options={LEVEL_OPTIONS}
            onChange={v => updateSection('parentRecommendations', { estimatedCurrentLevel: v as ParentRecommendations['estimatedCurrentLevel'] })}
            disabled={isReadOnly}
          />
          <SelectInput
            label="Recommandation de suivi"
            value={pra.recommendedFollowUp}
            options={FOLLOW_UP_OPTIONS}
            onChange={v => updateSection('parentRecommendations', { recommendedFollowUp: v as ParentRecommendations['recommendedFollowUp'] })}
            disabled={isReadOnly}
          />
        </div>
        <div className="flex flex-col gap-2">
          <label className="text-xs text-neutral-400">Axes prioritaires à travailler (choix multiples)</label>
          <div className="flex flex-wrap gap-2">
            {PRIORITY_AXES_OPTIONS.map(opt => {
              const selected = (pra.priorityAxes ?? []).includes(opt.value);
              return (
                <button
                  key={opt.value}
                  type="button"
                  disabled={isReadOnly}
                  onClick={() => {
                    const current = (pra.priorityAxes ?? []) as PriorityAxisValue[];
                    const next = selected
                      ? current.filter(v => v !== opt.value)
                      : [...current, opt.value];
                    updateSection('parentRecommendations', { priorityAxes: next });
                  }}
                  className={`rounded-xl border px-3 py-1.5 text-xs font-medium transition disabled:opacity-40 ${
                    selected
                      ? 'border-brand-accent/40 bg-brand-accent/20 text-brand-accent'
                      : 'border-white/10 bg-white/5 text-neutral-400 hover:text-neutral-200'
                  }`}
                >
                  {opt.label}
                </button>
              );
            })}
          </div>
        </div>
        <TextareaInput
          label="Message synthétique aux parents"
          value={pra.parentSummaryMessage}
          onChange={v => updateSection('parentRecommendations', { parentSummaryMessage: v })}
          placeholder="Résumez en quelques phrases le bilan pour les parents…"
          rows={5}
          disabled={isReadOnly}
        />
        <TextareaInput
          label="Recommandation finale"
          value={pra.finalRecommendation}
          onChange={v => updateSection('parentRecommendations', { finalRecommendation: v })}
          placeholder="Recommandation concrète et bienveillante pour la suite…"
          rows={4}
          disabled={isReadOnly}
        />
      </SectionCard>

      {/* ── Action bar ── */}
      {!isReadOnly && (
        <div className="sticky bottom-6 rounded-[24px] border border-white/10 bg-surface-darker/95 p-4 backdrop-blur">
          <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
            <div className="flex items-center gap-3">
              {(saving || validating) && (
                <span className="flex items-center gap-2 text-xs text-neutral-400">
                  <Loader2 className="h-3 w-3 animate-spin" />
                  {validating ? 'Publication…' : 'Sauvegarde…'}
                </span>
              )}
              {!saving && !validating && lastSaved && (
                <span className="flex items-center gap-1.5 text-xs text-neutral-500">
                  <Clock className="h-3 w-3" /> Sauvegardé à {lastSaved}
                </span>
              )}
            </div>
            <div className="flex gap-3">
              <button
                type="button"
                onClick={generatePreview}
                className="flex items-center gap-2 rounded-xl border border-white/10 bg-white/5 px-4 py-2 text-sm text-neutral-300 hover:bg-white/10"
              >
                <Eye className="h-4 w-4" />
                Prévisualiser
              </button>
              {bilanStatus !== 'COMPLETED' && (
                <>
                  <button
                    type="button"
                    onClick={() => save('draft')}
                    disabled={saving}
                    className="flex items-center gap-2 rounded-xl border border-white/10 bg-white/5 px-4 py-2 text-sm font-medium text-neutral-200 hover:bg-white/10 disabled:opacity-40"
                  >
                    <Save className="h-4 w-4" />
                    Enregistrer le brouillon
                  </button>
                  <button
                    type="button"
                    onClick={() => setConfirmComplete(true)}
                    disabled={saving}
                    className="flex items-center gap-2 rounded-xl bg-brand-accent px-4 py-2 text-sm font-semibold text-white hover:bg-brand-accent/90 disabled:opacity-40"
                  >
                    <CheckCircle2 className="h-4 w-4" />
                    Marquer comme complété
                  </button>
                </>
              )}
              {bilanStatus === 'COMPLETED' && (
                <button
                  type="button"
                  onClick={validateBilan}
                  disabled={validating}
                  className="flex items-center gap-2 rounded-xl bg-emerald-600 px-4 py-2 text-sm font-semibold text-white hover:bg-emerald-500 disabled:opacity-40"
                >
                  {validating ? <Loader2 className="h-4 w-4 animate-spin" /> : <CheckCircle2 className="h-4 w-4" />}
                  Valider et Publier
                </button>
              )}
            </div>
          </div>
        </div>
      )}

      {/* ── Confirmation dialog ── */}
      {confirmComplete && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 p-4">
          <div className="w-full max-w-sm rounded-[28px] border border-white/10 bg-[#0f1117] p-6">
            <h2 className="text-lg font-semibold text-white">Marquer comme complété ?</h2>
            <p className="mt-2 text-sm text-neutral-400">
              Le bilan sera marqué comme complété. Vous pourrez encore le modifier si nécessaire.
            </p>
            <div className="mt-6 flex gap-3">
              <button
                type="button"
                onClick={() => setConfirmComplete(false)}
                className="flex-1 rounded-xl border border-white/10 bg-white/5 py-2 text-sm text-neutral-300 hover:bg-white/10"
              >
                Annuler
              </button>
              <button
                type="button"
                onClick={() => save('complete')}
                className="flex-1 rounded-xl bg-brand-accent py-2 text-sm font-semibold text-white hover:bg-brand-accent/90"
              >
                Confirmer
              </button>
            </div>
          </div>
        </div>
      )}

      {/* ── Preview modal ── */}
      {showPreview && (
        <div className="fixed inset-0 z-50 flex items-start justify-center overflow-y-auto bg-black/60 p-4">
          <div className="my-8 w-full max-w-2xl rounded-[28px] border border-white/10 bg-[#0f1117] p-6">
            <div className="flex items-center justify-between">
              <h2 className="text-lg font-semibold text-white">Prévisualisation — Bilan parent</h2>
              <button
                type="button"
                onClick={() => setShowPreview(false)}
                className="rounded-xl border border-white/10 bg-white/5 p-2 text-neutral-400 hover:bg-white/10"
              >
                <EyeOff className="h-4 w-4" />
              </button>
            </div>
            <pre className="mt-4 whitespace-pre-wrap font-sans text-sm leading-relaxed text-neutral-300">
              {previewText}
            </pre>
          </div>
        </div>
      )}
    </div>
  );
}
