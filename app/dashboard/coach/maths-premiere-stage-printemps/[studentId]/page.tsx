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
  CoachMathsBilanFormData,
  AttendanceAndEngagement,
  Automatismes,
  Analysis,
  Sequences,
  ScalarProduct,
  Probabilities,
  FinalAssessment,
  ParentRecommendations,
} from '@/lib/coach/maths-premiere-stage-printemps/types';

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
  | 'second-degre'
  | 'derivation'
  | 'suites'
  | 'exponentielle'
  | 'produit-scalaire'
  | 'probabilites-conditionnelles'
  | 'automatismes'
  | 'redaction-justification'
  | 'gestion-du-temps';

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
                ? 'border-indigo-500 bg-indigo-600 text-white'
                : 'border-white/10 bg-white/5 text-neutral-400 hover:border-indigo-500/40 hover:text-white'
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
        className="rounded-xl border border-white/10 bg-white/5 px-3 py-2 text-sm text-neutral-200 focus:border-indigo-500/50 focus:outline-none disabled:opacity-40"
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
  max,
  disabled,
}: {
  label: string;
  value?: string;
  onChange: (v: string) => void;
  placeholder?: string;
  max?: number;
  disabled?: boolean;
}) {
  return (
    <div className="flex flex-col gap-1.5">
      <div className="flex justify-between text-xs text-neutral-400">
        <label>{label}</label>
        {max && value && value.length > 0 && (
          <span>{value.length} / {max}</span>
        )}
      </div>
      <textarea
        value={value ?? ''}
        onChange={e => onChange(e.target.value)}
        placeholder={placeholder}
        maxLength={max}
        rows={4}
        disabled={disabled}
        className="rounded-xl border border-white/10 bg-white/5 p-3 text-sm text-neutral-200 placeholder-neutral-600 focus:border-indigo-500/50 focus:outline-none disabled:opacity-40"
      />
    </div>
  );
}

function AccordionSection({
  title,
  icon,
  children,
  openDefault = false,
}: {
  title: string;
  icon: React.ReactNode;
  children: React.ReactNode;
  openDefault?: boolean;
}) {
  const [open, setOpen] = useState(openDefault);
  return (
    <div className="rounded-2xl border border-white/10 bg-white/5 overflow-hidden">
      <button
        type="button"
        onClick={() => setOpen(!open)}
        className="flex w-full items-center justify-between p-4 text-left transition hover:bg-white/5"
      >
        <div className="flex items-center gap-3">
          <div className="flex h-8 w-8 items-center justify-center rounded-xl bg-indigo-500/10 text-indigo-400">
            {icon}
          </div>
          <span className="font-semibold text-white">{title}</span>
        </div>
        {open ? <ChevronUp className="h-4 w-4 text-neutral-400" /> : <ChevronDown className="h-4 w-4 text-neutral-400" />}
      </button>
      {open && <div className="border-t border-white/10 p-5 space-y-6 bg-surface-darker/30">{children}</div>}
    </div>
  );
}

export default function CoachMathsIndividualReportPage() {
  const { data: session, status } = useSession();
  const router = useRouter();
  const params = useParams();
  const studentId = params.studentId as string;

  const [student, setStudent] = useState<StudentInfo | null>(null);
  const [studentSummary, setStudentSummary] = useState<StudentSummary | null>(null);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [validating, setValidating] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState<string | null>(null);

  // States for sections
  const [attendance, setAttendance] = useState<AttendanceAndEngagement>({});
  const [automatismes, setAutomatismes] = useState<Automatismes>({});
  const [analysis, setAnalysis] = useState<Analysis>({});
  const [sequences, setSequences] = useState<Sequences>({});
  const [scalarProduct, setScalarProduct] = useState<ScalarProduct>({});
  const [probabilities, setProbabilities] = useState<Probabilities>({});
  const [finalAssessment, setFinalAssessment] = useState<FinalAssessment>({});
  const [parentRec, setParentRec] = useState<ParentRecommendations>({});

  const [bilanStatus, setBilanStatus] = useState<BilanStatus>('NOT_STARTED');
  const [previewMarkdown, setPreviewMarkdown] = useState<string | null>(null);

  useEffect(() => {
    if (status === 'loading') return;
    if (!session || session.user.role !== 'COACH') {
      router.push('/auth/signin');
    }
  }, [session, status, router]);

  const loadReport = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const res = await fetch(`/api/coach/maths-premiere-stage-printemps/students/${studentId}/report`);
      if (!res.ok) {
        if (res.status === 403) router.push('/dashboard/coach/maths-premiere-stage-printemps');
        throw new Error('Impossible de charger le bilan de cet élève.');
      }
      const data = await res.json();
      setStudent(data.student);
      setStudentSummary(data.studentSummary);

      if (data.coachBilan) {
        const sd = data.coachBilan.sourceData as any;
        setAttendance(sd.attendanceAndEngagement ?? {});
        setAutomatismes(sd.automatismes ?? {});
        setAnalysis(sd.analysis ?? {});
        setSequences(sd.sequences ?? {});
        setScalarProduct(sd.scalarProduct ?? {});
        setProbabilities(sd.probabilities ?? {});
        setFinalAssessment(sd.finalAssessment ?? {});
        setParentRec(sd.parentRecommendations ?? {});

        if (data.coachBilan.status === 'COMPLETED' && data.coachBilan.isPublished) {
          setBilanStatus('VALIDATED');
        } else if (data.coachBilan.status === 'COMPLETED') {
          setBilanStatus('COMPLETED');
        } else {
          setBilanStatus('DRAFT');
        }
      }
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Erreur réseau.');
    } finally {
      setLoading(false);
    }
  }, [studentId, router]);

  useEffect(() => {
    if (status === 'authenticated' && studentId) loadReport();
  }, [status, studentId, loadReport]);

  const saveBilan = async (action: 'draft' | 'complete') => {
    setSaving(true);
    setError(null);
    setSuccess(null);
    try {
      const payload: CoachMathsBilanFormData = {
        action,
        attendanceAndEngagement: attendance,
        automatismes,
        analysis,
        sequences,
        scalarProduct,
        probabilities,
        finalAssessment,
        parentRecommendations: parentRec,
      };

      const res = await fetch(`/api/coach/maths-premiere-stage-printemps/students/${studentId}/report`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload),
      });

      if (!res.ok) {
        const d = await res.json().catch(() => ({}));
        throw new Error(d.message || 'Une erreur est survenue lors de la sauvegarde.');
      }

      setSuccess(action === 'draft' ? 'Brouillon sauvegardé avec succès.' : 'Bilan complété avec succès !');
      await loadReport();
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Erreur de sauvegarde.');
    } finally {
      setSaving(false);
    }
  };

  const validateBilan = async () => {
    setValidating(true);
    setError(null);
    setSuccess(null);
    try {
      const res = await fetch(`/api/coach/maths-premiere-stage-printemps/students/${studentId}/report`, {
        method: 'PATCH',
      });
      if (!res.ok) {
        const d = await res.json().catch(() => ({}));
        throw new Error(d.message || 'Validation échouée.');
      }
      setSuccess('Le bilan a été validé et publié aux parents.');
      await loadReport();
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Erreur de validation.');
    } finally {
      setValidating(false);
    }
  };

  const previewParentMessage = async () => {
    if (previewMarkdown) {
      setPreviewMarkdown(null);
      return;
    }
    const { generateParentMathsStageReport } = await import('@/lib/coach/maths-premiere-stage-printemps/generate-parent-report');
    const sourceData = {
      attendanceAndEngagement: attendance,
      automatismes,
      analysis,
      sequences,
      scalarProduct,
      probabilities,
      finalAssessment,
      parentRecommendations: parentRec,
    };
    const markdown = generateParentMathsStageReport(sourceData, {
      firstName: student?.firstName,
      lastName: student?.lastName,
    });
    setPreviewMarkdown(markdown);
  };

  if (status === 'loading' || loading) {
    return (
      <div className="flex min-h-[50vh] items-center justify-center">
        <Loader2 className="h-8 w-8 animate-spin text-indigo-400" />
      </div>
    );
  }

  const isLocked = bilanStatus === 'VALIDATED';

  return (
    <div className="mx-auto max-w-5xl space-y-8 px-4 py-10">
      {/* Back button */}
      <div className="flex items-center justify-between">
        <Link
          href="/dashboard/coach/maths-premiere-stage-printemps"
          className="flex items-center gap-2 text-sm text-neutral-400 transition hover:text-neutral-200"
        >
          <ArrowLeft className="h-4 w-4" />
          Retour à la liste des élèves
        </Link>
        {isLocked && (
          <span className="inline-flex items-center gap-1 rounded-full border border-emerald-500/30 bg-emerald-500/10 px-2.5 py-1 text-xs font-medium text-emerald-300">
            <CheckCircle2 className="h-3 w-3" />
            Ce bilan a été validé
          </span>
        )}
      </div>

      {/* Profile Header */}
      {student && (
        <div className="flex flex-col gap-4 rounded-[24px] border border-white/10 bg-white/5 p-6 sm:flex-row sm:items-center sm:justify-between">
          <div className="flex items-center gap-4">
            <div className="flex h-12 w-12 shrink-0 items-center justify-center rounded-2xl bg-indigo-500/15 text-lg font-semibold text-indigo-400">
              {(student.firstName?.[0] ?? '?').toUpperCase()}
            </div>
            <div>
              <h1 className="text-xl font-bold text-white">
                {student.firstName} {student.lastName}
              </h1>
              <div className="mt-1 flex flex-wrap gap-x-4 gap-y-1 text-xs text-neutral-400">
                {student.gradeLevel && <span>{student.gradeLevel}</span>}
                {student.academicTrack && <span>{student.academicTrack}</span>}
                {student.school && <span>{student.school}</span>}
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Student Self Bilan Summary */}
      {studentSummary && (
        <div className="rounded-[24px] border border-indigo-500/20 bg-indigo-500/5 p-5 space-y-3">
          <h3 className="text-sm font-semibold text-indigo-300 flex items-center gap-2">
            <User className="h-4 w-4" />
            Auto-bilan de l&apos;élève (Bilan complété par l&apos;élève)
          </h3>
          <div className="grid grid-cols-2 gap-4 text-xs text-neutral-300">
            {studentSummary.beforeConfidence && (
              <div>
                <span className="text-neutral-500">Confiance avant / après :</span> {studentSummary.beforeConfidence} / {studentSummary.afterConfidence || 'Non complété'}
              </div>
            )}
            {studentSummary.bestProgress && (
              <div>
                <span className="text-neutral-500">Meilleure progression :</span> {studentSummary.bestProgress}
              </div>
            )}
            {studentSummary.priorityWork && (
              <div>
                <span className="text-neutral-500">Chapitre prioritaire :</span> {studentSummary.priorityWork}
              </div>
            )}
            {studentSummary.finalMessage && (
              <div className="col-span-2 mt-1">
                <span className="text-neutral-500">Message final :</span> {studentSummary.finalMessage}
              </div>
            )}
          </div>
        </div>
      )}

      {/* Main forms */}
      <form onSubmit={e => e.preventDefault()} className="space-y-4">
        {/* Section 1 */}
        <AccordionSection title="1. Présence et implication" icon={<FileText className="h-4 w-4" />}>
          <div className="grid gap-5 sm:grid-cols-2">
            <SelectInput
              label="Assiduité"
              value={attendance.attendance}
              onChange={v => setAttendance({ ...attendance, attendance: v as any })}
              disabled={isLocked}
              options={[
                { value: 'excellente', label: 'Excellente' },
                { value: 'reguliere', label: 'Régulière' },
                { value: 'irreguliere', label: 'Irrégulière' },
                { value: 'insuffisante', label: 'Insuffisante' },
              ]}
            />
            <SelectInput
              label="Ponctualité"
              value={attendance.punctuality}
              onChange={v => setAttendance({ ...attendance, punctuality: v as any })}
              disabled={isLocked}
              options={[
                { value: 'tres-satisfaisante', label: 'Très satisfaisante' },
                { value: 'satisfaisante', label: 'Satisfaisante' },
                { value: 'a-ameliorer', label: 'À améliorer' },
              ]}
            />
            <RatingInput
              label="Implication globale"
              value={attendance.involvement}
              onChange={v => setAttendance({ ...attendance, involvement: v })}
              disabled={isLocked}
            />
            <RatingInput
              label="Concentration"
              value={attendance.concentration}
              onChange={v => setAttendance({ ...attendance, concentration: v })}
              disabled={isLocked}
            />
          </div>
          <TextareaInput
            label="Observations et commentaires du coach"
            value={attendance.coachComment}
            onChange={v => setAttendance({ ...attendance, coachComment: v })}
            disabled={isLocked}
            placeholder="Écrivez un commentaire global sur l'attitude..."
          />
        </AccordionSection>

        {/* Section 2 */}
        <AccordionSection title="2. Automatismes et calculs" icon={<FileText className="h-4 w-4" />}>
          <div className="grid gap-5 sm:grid-cols-2">
            <RatingInput
              label="Fluidité des calculs"
              value={automatismes.calculationFluency}
              onChange={v => setAutomatismes({ ...automatismes, calculationFluency: v })}
              disabled={isLocked}
            />
            <RatingInput
              label="Identités et factorisation"
              value={automatismes.identities}
              onChange={v => setAutomatismes({ ...automatismes, identities: v })}
              disabled={isLocked}
            />
            <RatingInput
              label="Résolution d'équations"
              value={automatismes.linearEquation}
              onChange={v => setAutomatismes({ ...automatismes, linearEquation: v })}
              disabled={isLocked}
            />
            <RatingInput
              label="Dérivation usuelle"
              value={automatismes.derivatives}
              onChange={v => setAutomatismes({ ...automatismes, derivatives: v })}
              disabled={isLocked}
            />
          </div>
          <TextareaInput
            label="Plus grand point fort d'automatismes"
            value={automatismes.strongestAutomation}
            onChange={v => setAutomatismes({ ...automatismes, strongestAutomation: v })}
            disabled={isLocked}
          />
          <TextareaInput
            label="Plus grand point faible"
            value={automatismes.weakestAutomation}
            onChange={v => setAutomatismes({ ...automatismes, weakestAutomation: v })}
            disabled={isLocked}
          />
        </AccordionSection>

        {/* Section 3 */}
        <AccordionSection title="3. Analyse et Dérivation" icon={<FileText className="h-4 w-4" />}>
          <div className="grid gap-5 sm:grid-cols-2">
            <RatingInput
              label="Dérivation produit"
              value={analysis.productDerivative}
              onChange={v => setAnalysis({ ...analysis, productDerivative: v })}
              disabled={isLocked}
            />
            <RatingInput
              label="Dérivation quotient"
              value={analysis.quotientDerivative}
              onChange={v => setAnalysis({ ...analysis, quotientDerivative: v })}
              disabled={isLocked}
            />
            <RatingInput
              label="Tableau de variations"
              value={analysis.variationTable}
              onChange={v => setAnalysis({ ...analysis, variationTable: v })}
              disabled={isLocked}
            />
            <RatingInput
              label="Exponentielle"
              value={analysis.exponentialPositivity}
              onChange={v => setAnalysis({ ...analysis, exponentialPositivity: v })}
              disabled={isLocked}
            />
          </div>
        </AccordionSection>

        {/* Section 4 */}
        <AccordionSection title="4. Suites numériques" icon={<FileText className="h-4 w-4" />}>
          <div className="grid gap-5 sm:grid-cols-2">
            <RatingInput
              label="Formule explicite"
              value={sequences.explicitFormula}
              onChange={v => setSequences({ ...sequences, explicitFormula: v })}
              disabled={isLocked}
            />
            <RatingInput
              label="Suites auxiliaires"
              value={sequences.auxiliarySequence}
              onChange={v => setSequences({ ...sequences, auxiliarySequence: v })}
              disabled={isLocked}
            />
            <RatingInput
              label="Calcul de sommes"
              value={sequences.sums}
              onChange={v => setSequences({ ...sequences, sums: v })}
              disabled={isLocked}
            />
          </div>
          <TextareaInput
            label="Observations sur les suites"
            value={sequences.progressReflection}
            onChange={v => setSequences({ ...sequences, progressReflection: v })}
            disabled={isLocked}
          />
        </AccordionSection>

        {/* Section 5 */}
        <AccordionSection title="5. Produit scalaire" icon={<FileText className="h-4 w-4" />}>
          <div className="grid gap-5 sm:grid-cols-2">
            <RatingInput
              label="Par coordonnées"
              value={scalarProduct.coordinates}
              onChange={v => setScalarProduct({ ...scalarProduct, coordinates: v })}
              disabled={isLocked}
            />
            <RatingInput
              label="Par Al-Kashi"
              value={scalarProduct.alKashi}
              onChange={v => setScalarProduct({ ...scalarProduct, alKashi: v })}
              disabled={isLocked}
            />
          </div>
        </AccordionSection>

        {/* Section 6 */}
        <AccordionSection title="6. Recommandations aux parents" icon={<FileText className="h-4 w-4" />}>
          <div className="grid gap-5 sm:grid-cols-2">
            <SelectInput
              label="Niveau actuel estimé"
              value={parentRec.estimatedCurrentLevel}
              onChange={v => setParentRec({ ...parentRec, estimatedCurrentLevel: v as any })}
              disabled={isLocked}
              options={[
                { value: 'tres-solide', label: 'Très solide' },
                { value: 'satisfaisant', label: 'Satisfaisant' },
                { value: 'fragile-mais-en-progres', label: 'Fragile mais en progrès' },
                { value: 'fragile', label: 'Fragile' },
                { value: 'preoccupant', label: 'Préoccupant' },
              ]}
            />
            <SelectInput
              label="Suivi recommandé"
              value={parentRec.recommendedFollowUp}
              onChange={v => setParentRec({ ...parentRec, recommendedFollowUp: v as any })}
              disabled={isLocked}
              options={[
                { value: 'autonomie-sufficient', label: 'Autonomie suffisante' },
                { value: 'consolidation-ponctuelle', label: 'Consolidation ponctuelle' },
                { value: 'accompagnement-regulier', label: 'Accompagnement régulier' },
                { value: 'entrainement-intensif', label: 'Entraînement intensif' },
              ]}
            />
          </div>
          <div className="space-y-3">
            <label className="text-xs text-neutral-400">Axes prioritaires à travailler (plusieurs choix possibles)</label>
            <div className="grid gap-2 sm:grid-cols-2">
              {(
                [
                  { value: 'second-degre', label: 'Second degré' },
                  { value: 'derivation', label: 'Dérivation' },
                  { value: 'suites', label: 'Suites numériques' },
                  { value: 'exponentielle', label: 'Fonction exponentielle' },
                  { value: 'produit-scalaire', label: 'Produit scalaire' },
                  { value: 'probabilites-conditionnelles', label: 'Probabilités conditionnelles' },
                  { value: 'automatismes', label: 'Automatismes et calculs' },
                  { value: 'redaction-justification', label: 'Rédaction et rigueur' },
                  { value: 'gestion-du-temps', label: 'Gestion du temps' },
                ] as const
              ).map(axis => {
                const checked = (parentRec.priorityAxes ?? []).includes(axis.value);
                return (
                  <label
                    key={axis.value}
                    className={`flex items-center gap-3 rounded-xl border p-3 text-xs font-medium cursor-pointer transition ${
                      checked
                        ? 'border-indigo-500 bg-indigo-500/10 text-white'
                        : 'border-white/10 bg-white/5 text-neutral-400 hover:bg-white/5'
                    }`}
                  >
                    <input
                      type="checkbox"
                      checked={checked}
                      disabled={isLocked}
                      onChange={e => {
                        const next = e.target.checked
                          ? [...(parentRec.priorityAxes ?? []), axis.value]
                          : (parentRec.priorityAxes ?? []).filter((v: string) => v !== axis.value);
                        setParentRec({ ...parentRec, priorityAxes: next });
                      }}
                      className="hidden"
                    />
                    <div className={`flex h-4 w-4 items-center justify-center rounded border ${checked ? 'bg-indigo-600 border-indigo-400' : 'border-neutral-600'}`}>
                      {checked && <CheckCircle2 className="h-3 w-3 text-white" />}
                    </div>
                    {axis.label}
                  </label>
                );
              })}
            </div>
          </div>
          <TextareaInput
            label="Synthèse et observations générales pour les parents"
            value={parentRec.parentSummaryMessage}
            onChange={v => setParentRec({ ...parentRec, parentSummaryMessage: v })}
            disabled={isLocked}
            placeholder="Quelles sont les forces et les pistes d'amélioration concrètes ?"
          />
        </AccordionSection>

        {/* Global actions */}
        <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between pt-6 border-t border-white/10">
          <div className="flex gap-2">
            {!isLocked && (
              <>
                <button
                  type="button"
                  onClick={() => saveBilan('draft')}
                  disabled={saving || validating}
                  className="flex items-center gap-2 rounded-xl bg-white/10 border border-white/10 px-4 py-2.5 text-sm font-medium text-white transition hover:bg-white/20 disabled:opacity-40"
                >
                  {saving ? <Loader2 className="h-4 w-4 animate-spin" /> : <Save className="h-4 w-4" />}
                  Sauvegarder Brouillon
                </button>
                <button
                  type="button"
                  onClick={() => saveBilan('complete')}
                  disabled={saving || validating}
                  className="flex items-center gap-2 rounded-xl bg-indigo-600 px-4 py-2.5 text-sm font-semibold text-white transition hover:bg-indigo-500 disabled:opacity-40"
                >
                  {saving ? <Loader2 className="h-4 w-4 animate-spin" /> : <CheckCircle2 className="h-4 w-4" />}
                  Compléter le bilan
                </button>
              </>
            )}
            {bilanStatus === 'COMPLETED' && !isLocked && (
              <button
                type="button"
                onClick={validateBilan}
                disabled={validating}
                className="flex items-center gap-2 rounded-xl bg-emerald-600 px-4 py-2.5 text-sm font-semibold text-white transition hover:bg-emerald-500 disabled:opacity-40"
              >
                {validating ? <Loader2 className="h-4 w-4 animate-spin" /> : <CheckCircle2 className="h-4 w-4" />}
                Valider et Publier
              </button>
            )}
          </div>

          <button
            type="button"
            onClick={previewParentMessage}
            className="flex items-center justify-center gap-2 rounded-xl border border-white/10 bg-white/5 px-4 py-2.5 text-sm font-medium text-neutral-300 transition hover:bg-white/10"
          >
            {previewMarkdown ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
            {previewMarkdown ? 'Masquer la prévisualisation' : 'Prévisualiser la synthèse parent'}
          </button>
        </div>
      </form>

      {error && (
        <div className="flex items-center gap-3 rounded-2xl border border-red-500/20 bg-red-500/10 p-4 text-sm text-red-300">
          <AlertCircle className="h-4 w-4 shrink-0" />
          {error}
        </div>
      )}

      {success && (
        <div className="flex items-center gap-3 rounded-2xl border border-emerald-500/20 bg-emerald-500/10 p-4 text-sm text-emerald-300">
          <CheckCircle2 className="h-4 w-4 shrink-0" />
          {success}
        </div>
      )}

      {/* Markdown Preview */}
      {previewMarkdown && (
        <div className="rounded-[24px] border border-white/10 bg-white/5 p-6 space-y-4">
          <h3 className="font-semibold text-white text-base">Prévisualisation de la synthèse adressée aux parents</h3>
          <div className="prose prose-invert prose-sm max-w-none border-t border-white/10 pt-4 whitespace-pre-wrap font-mono text-neutral-300">
            {previewMarkdown}
          </div>
        </div>
      )}
    </div>
  );
}
