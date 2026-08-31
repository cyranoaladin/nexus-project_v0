'use client';

import Link from 'next/link';
import { useCallback, useEffect, useRef, useState } from 'react';
import type { Subject } from '@prisma/client';
import {
  AlertTriangle,
  Check,
  ChevronRight,
  ClipboardCheck,
  Download,
  FileText,
  Link2,
  Loader2,
  RefreshCw,
  Search,
  ShieldCheck,
  UserRound,
} from 'lucide-react';

import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { SPECIALITE_ABANDONNEE_WARNING } from '@/lib/quotes/warnings';
import { DUPLICATE_LANGUAGE_MESSAGE, LANGUAGE_CODES, LANGUAGE_LABELS } from '@/lib/exams/languages';
import {
  evaluateCandidateIdentity,
  normalizeStaffStudentSearchResult,
  type StaffStudentSearchResult,
} from '@/lib/quotes/candidat-individuel-identity';
import {
  CandidateIdentityRequestError,
  requestCandidateIdentity,
} from '@/lib/quotes/candidat-individuel-identity.client';
import {
  consumeCandidateStudentHandoff,
  getContextualStudentsPath,
  tryCandidateStudentHandoffStorage,
  type CandidateStaffRole,
} from '@/lib/quotes/candidat-individuel-navigation';
import {
  candidatIndividuelLeadSearchSuccessSchema,
  candidatIndividuelStudentSearchSuccessSchema,
  type CandidatIndividuelLeadSearchItem,
  type CandidatIndividuelStudentSearchItem,
} from '@/lib/quotes/candidat-individuel-search-contracts';

type CandidateLeadIdentity = {
  id: string;
  name: string;
  email: string;
  phone: string | null;
};

interface CandidateIdentity {
  contactLead?: CandidateLeadIdentity | null;
  student?: StaffStudentSearchResult | null;
}

interface ProfileDraft extends CandidateIdentity {
  id: string;
  level: string;
  examSession: number;
  modalite: string;
  specialite1: Subject;
  specialite2: Subject;
  specialiteAbandonnee: Subject | null;
  langueA: Subject | null;
  langueB: Subject | null;
  optionsTerminale: string[];
  estRedoublant: boolean;
  estTitulaireBacDejaObtenu: boolean;
  changementSpecialite: boolean;
  intentionAmelioration: boolean;
  intentionCycleComplet: boolean;
  moyenneRattrapage: number | null;
  etalementPlurisessionsDeclare: boolean;
  brancheBascule: string | null;
  notesConservees?: unknown[];
  dispensesDeclarees?: unknown[];
  p3EligibiliteAudit?: unknown[];
  reviewRequestedAt?: string | null;
  revisionNumber?: number;
  lastQuote?: StaffQuoteView | null;
}

interface FormState {
  level: string;
  examSession: string;
  modalite: string;
  specialite1: string;
  specialite2: string;
  specialiteAbandonnee: string;
  langueA: string;
  langueB: string;
  optionsTerminale: string[];
  estRedoublant: boolean;
  estTitulaireBacDejaObtenu: boolean;
  changementSpecialite: boolean;
  intentionAmelioration: boolean;
  intentionCycleComplet: boolean;
  moyenneRattrapage: string;
  etalementPlurisessionsDeclare: boolean;
  brancheBascule: string;
}

interface ScenarioLine {
  subject: string;
  label: string;
  modality: string;
  hoursPerMonth: number | null;
  unitPriceMonthly: number;
  reason: string;
  offerId?: string;
}

interface GroupRequirement {
  subject: string;
  hoursPerMonth: number | null;
  unitPriceMonthly: number;
}

interface Scenario {
  tier: 'ESSENTIEL' | 'RECOMMANDE' | 'COMPLET';
  lines: ScenarioLine[];
  grandTotal: number;
  monthlyTotal: number;
  deposit: number;
  months: number;
  lastInstallmentAmount?: number;
  groupHeadcountRequirements?: GroupRequirement[];
}

interface PipelineResult {
  status: string;
  scenarios?: Scenario[];
  reasons?: string[];
  avertissements?: string[];
  pendingModuleIds?: string[];
  pendingServiceIds?: string[];
  reason?: string;
  validation?: unknown;
  carte?: unknown;
  selection?: unknown;
  diagnosticStatus?: string;
  budgetInsuffisantPourSocle?: boolean;
}

interface StaffQuoteView {
  id: string;
  statusLabel: string;
  updatedAt: string;
  totals: { annualTnd: number; depositTnd: number; installmentTnd: number; installmentCount: number };
  lines: Array<{ subject: string; modality: string; hoursPerMonth: number | null; monthlyAmountTnd: number }>;
  margin: { percentage: number; statusLabel: string } | null;
  actions: {
    canPublish: boolean;
    canIssueFamilyLink: boolean;
    canRotateFamilyLink: boolean;
    canDownloadPdf: boolean;
    canCreateRevision: boolean;
    hasFamilyLink: boolean;
  };
}

interface MarginReview {
  percentage: number;
  statusLabel: string;
  canOverride: boolean;
}

type BusyAction = 'save' | 'simulate' | 'review' | 'revision' | 'quote' | 'publish' | 'family-link' | null;

interface QuoteRequestAttempt {
  profileId: string;
  fingerprint: string;
  key: string;
  payload: Record<string, unknown>;
  status: 'PENDING' | 'AMBIGUOUS' | 'RESOLVED';
}

const STEPS = [
  { number: 1, short: 'Identité', label: 'Élève et responsable' },
  { number: 2, short: 'Profil', label: 'Profil du candidat' },
  { number: 3, short: 'Besoins', label: 'Besoins et accompagnements' },
  { number: 4, short: 'Financement', label: 'Proposition financière' },
  { number: 5, short: 'Devis', label: 'Synthèse du devis' },
] as const;

const LANGUAGE_OPTIONS: Array<{ value: Subject; label: string }> = LANGUAGE_CODES.map((value) => ({
  value,
  label: LANGUAGE_LABELS[value],
}));

const SUBJECT_OPTIONS: Array<{ value: Subject; label: string }> = [
  { value: 'MATHEMATIQUES', label: 'Mathématiques' },
  { value: 'NSI', label: 'Numérique et sciences informatiques (NSI)' },
  { value: 'FRANCAIS', label: 'Français' },
  { value: 'PHILOSOPHIE', label: 'Philosophie' },
  { value: 'HISTOIRE_GEO', label: 'Histoire-géographie' },
  ...LANGUAGE_OPTIONS,
  { value: 'PHYSIQUE_CHIMIE', label: 'Physique-chimie' },
  { value: 'SVT', label: 'Sciences de la vie et de la Terre' },
  { value: 'SES', label: 'Sciences économiques et sociales' },
];

const SPECIALTY_OPTIONS = SUBJECT_OPTIONS.filter((option) =>
  ['MATHEMATIQUES', 'NSI', 'PHYSIQUE_CHIMIE', 'SVT', 'SES'].includes(option.value),
);

const DISPENSE_OPTIONS = [
  { id: 'eaf-ecrit', label: 'Français écrit' },
  { id: 'eaf-oral', label: 'Français oral' },
  { id: 'eam', label: 'Mathématiques anticipées' },
  { id: 'eds1', label: 'Première spécialité' },
  { id: 'eds2', label: 'Deuxième spécialité' },
  { id: 'philosophie', label: 'Philosophie' },
  { id: 'grand-oral', label: 'Grand oral' },
  { id: 'histoire-geographie', label: 'Histoire-géographie' },
  { id: 'lva', label: 'Langue vivante A' },
  { id: 'lvb', label: 'Langue vivante B' },
  { id: 'enseignement-scientifique', label: 'Enseignement scientifique' },
  { id: 'eps', label: 'Éducation physique et sportive' },
  { id: 'emc', label: 'Enseignement moral et civique' },
  { id: 'specialite-abandonnee', label: 'Spécialité de Première non poursuivie' },
] as const;

type DispenseEntry = {
  epreuveId: string;
  statut: 'DECLAREE' | 'CONFIRMEE' | 'REFUSEE';
  justificatifRef?: string;
};

const EMPTY_FORM: FormState = {
  level: 'TERMINALE',
  examSession: '2027',
  modalite: 'A',
  specialite1: 'MATHEMATIQUES',
  specialite2: 'NSI',
  specialiteAbandonnee: '',
  langueA: 'ANGLAIS',
  langueB: 'ESPAGNOL',
  optionsTerminale: [],
  estRedoublant: false,
  estTitulaireBacDejaObtenu: false,
  changementSpecialite: false,
  intentionAmelioration: false,
  intentionCycleComplet: true,
  moyenneRattrapage: '',
  etalementPlurisessionsDeclare: false,
  brancheBascule: '',
};

const DEFERRED_IDENTIFIERS = new Set([
  'MOD_HG_ARIA',
  'MOD_ES_ARIA',
  'MOD_EMC_ARIA',
  'MOD_EAF_DESCRIPTIF',
  'MOD_MATHS_EXPERTES',
  'MOD_MATHS_COMPLEMENTAIRES',
  'MOD_DGEMC',
  'MOD_LCA',
  'SVC_BACS_BLANCS',
  'SVC_SECOND_GROUPE',
]);

const selectClassName =
  'flex h-10 w-full rounded-micro border border-neutral-700 bg-surface-card px-3 py-2 text-sm text-neutral-100 outline-none focus-visible:ring-2 focus-visible:ring-brand-primary disabled:cursor-not-allowed disabled:opacity-50';

function studentDisplayName(user: StaffStudentSearchResult['user']): string {
  return [user.firstName, user.lastName].filter(Boolean).join(' ') || 'Élève sans nom';
}

function subjectLabel(subject: string): string {
  const labels: Record<string, string> = {
    eds1: 'Spécialité 1',
    eds2: 'Spécialité 2',
    francais: 'Français',
    philosophie: 'Philosophie',
    'grand-oral': 'Grand oral',
    lva: 'Langue vivante A',
    lvb: 'Langue vivante B',
    'specialite-abandonnee': 'Spécialité de Première non poursuivie',
    pilotage: 'Pilotage Nexus',
    pack: 'Parcours Nexus',
  };
  return labels[subject] ?? SUBJECT_OPTIONS.find((option) => option.value === subject)?.label ?? 'Matière accompagnée';
}

function modalityLabel(modality: string): string {
  const labels: Record<string, string> = {
    INDIVIDUEL: 'Individuel',
    DUO: 'Duo',
    GROUPE: 'Petit groupe',
    PILOTAGE: 'Pilotage Nexus',
    PACK: 'Parcours combiné',
  };
  return labels[modality] ?? 'Accompagnement Nexus';
}

function formatTnd(value: number): string {
  return `${new Intl.NumberFormat('fr-FR', { maximumFractionDigits: 0 }).format(value).replace(/\u202f/g, ' ')} TND`;
}

function profileToForm(profile: ProfileDraft): FormState {
  return {
    level: profile.level,
    examSession: String(profile.examSession),
    modalite: profile.modalite,
    specialite1: profile.specialite1,
    specialite2: profile.specialite2,
    specialiteAbandonnee: profile.specialiteAbandonnee ?? '',
    langueA: profile.langueA ?? '',
    langueB: profile.langueB ?? '',
    optionsTerminale: profile.optionsTerminale ?? [],
    estRedoublant: profile.estRedoublant,
    estTitulaireBacDejaObtenu: profile.estTitulaireBacDejaObtenu,
    changementSpecialite: profile.changementSpecialite,
    intentionAmelioration: profile.intentionAmelioration,
    intentionCycleComplet: profile.intentionCycleComplet,
    moyenneRattrapage: profile.moyenneRattrapage == null ? '' : String(profile.moyenneRattrapage),
    etalementPlurisessionsDeclare: profile.etalementPlurisessionsDeclare,
    brancheBascule: profile.brancheBascule ?? '',
  };
}

function formToPublicInput(form: FormState) {
  return {
    level: form.level || null,
    examSession: form.examSession ? Number(form.examSession) : null,
    modalite: form.modalite || null,
    specialite1: form.specialite1 || null,
    specialite2: form.specialite2 || null,
    specialiteAbandonnee: form.specialiteAbandonnee || null,
    langueA: form.langueA || null,
    langueB: form.langueB || null,
    optionsTerminale: form.optionsTerminale,
    estRedoublant: form.estRedoublant,
    estTitulaireBacDejaObtenu: form.estTitulaireBacDejaObtenu,
    changementSpecialite: form.changementSpecialite,
    intentionAmelioration: form.intentionAmelioration,
    intentionCycleComplet: form.intentionCycleComplet,
    moyenneRattrapage: form.moyenneRattrapage ? Number(form.moyenneRattrapage) : null,
    etalementPlurisessionsDeclare: form.etalementPlurisessionsDeclare,
    brancheBascule: form.brancheBascule || null,
  };
}

function generateIdempotencyKey(): string {
  if (typeof crypto !== 'undefined' && typeof crypto.randomUUID === 'function') return crypto.randomUUID();
  return `${Date.now().toString(36)}-${Math.random().toString(36).slice(2)}`;
}

function isFiniteNonNegative(value: unknown): value is number {
  return typeof value === 'number' && Number.isFinite(value) && value >= 0;
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return value != null && typeof value === 'object' && !Array.isArray(value);
}

async function readJson(response: Response): Promise<Record<string, unknown>> {
  const value: unknown = await response.json().catch(() => null);
  return isRecord(value) ? value : {};
}

function isStaffQuoteView(value: unknown, expectedProfileId: string): value is StaffQuoteView {
  if (!isRecord(value)) return false;
  if (typeof value.id !== 'string' || value.id.trim().length === 0) return false;
  if ('profilId' in value && value.profilId !== expectedProfileId) return false;
  if (typeof value.statusLabel !== 'string' || value.statusLabel.trim().length === 0) return false;
  if (typeof value.updatedAt !== 'string' || !Number.isFinite(Date.parse(value.updatedAt))) return false;

  const totals = value.totals;
  if (!isRecord(totals)
    || !isFiniteNonNegative(totals.annualTnd)
    || !isFiniteNonNegative(totals.depositTnd)
    || !isFiniteNonNegative(totals.installmentTnd)
    || !Number.isInteger(totals.installmentCount)
    || (totals.installmentCount as number) < 0) return false;

  if (!Array.isArray(value.lines) || value.lines.length === 0 || value.lines.some((line) => {
    if (!isRecord(line)) return true;
    return typeof line.subject !== 'string'
      || line.subject.trim().length === 0
      || typeof line.modality !== 'string'
      || line.modality.trim().length === 0
      || (line.hoursPerMonth !== null && !isFiniteNonNegative(line.hoursPerMonth))
      || !isFiniteNonNegative(line.monthlyAmountTnd);
  })) return false;

  if (value.margin !== null) {
    if (!isRecord(value.margin)
      || !isFiniteNonNegative(value.margin.percentage)
      || typeof value.margin.statusLabel !== 'string'
      || value.margin.statusLabel.trim().length === 0) return false;
  }

  const actions = value.actions;
  if (!isRecord(actions)) return false;
  return [
    'canPublish',
    'canIssueFamilyLink',
    'canRotateFamilyLink',
    'canDownloadPdf',
    'canCreateRevision',
    'hasFamilyLink',
  ].every((key) => typeof actions[key] === 'boolean');
}

function isDeferredLine(line: ScenarioLine): boolean {
  return (
    line.subject === 'second-groupe' ||
    (line.offerId != null && DEFERRED_IDENTIFIERS.has(line.offerId)) ||
    DEFERRED_IDENTIFIERS.has(line.subject)
  );
}

function humanizeServerMessage(message: unknown): string {
  const raw = typeof message === 'string' ? message : '';
  if (/GROUP_PENDING|effectif du groupe|confirmedHeadcount/i.test(raw)) {
    return "Le groupe concerné n'est pas encore confirmé.";
  }
  if (/MARGIN|marge insuffisante|validation staff/i.test(raw)) {
    return 'La marge de cette proposition nécessite une validation.';
  }
  if (/REGULATORY|maturité|réglementaire|carte/i.test(raw)) {
    return 'La situation réglementaire doit être vérifiée avant la publication.';
  }
  if (/deferred|non tarifable|DIRECTION|MOD_|SVC_/i.test(raw)) {
    return "Cette option n'est pas disponible dans l'offre V1.";
  }
  if (/profil a changé|changed since|conflict/i.test(raw)) {
    return 'Le profil a changé. Mettez à jour la simulation avant de générer le devis.';
  }
  return raw || 'Une erreur est survenue. Réessayez ou contactez le support Nexus.';
}

function resultMessage(result: PipelineResult | null): string | null {
  if (!result || result.status === 'READY') return null;
  const messages: Record<string, string> = {
    INVALID: 'Certaines informations du profil sont incomplètes ou incohérentes.',
    NOT_ELIGIBLE: "Ce profil ne permet pas d'établir une proposition dans le cadre actuel.",
    HUMAN_REVIEW_REQUIRED: 'Une validation réglementaire humaine est nécessaire avant de poursuivre.',
    DIRECTION_APPROVAL_REQUIRED: "Cette option n'est pas disponible dans l'offre V1.",
    UNPRICED: "Cette option n'est pas disponible dans l'offre V1.",
    PROVISIONAL: 'Cette proposition reste provisoire et ne peut pas être publiée.',
  };
  return messages[result.status] ?? humanizeServerMessage(result.reason ?? result.reasons?.[0]);
}

export function CandidatIndividuelWorkspace({ staffRole = 'ASSISTANTE' }: { staffRole?: 'ADMIN' | 'ASSISTANTE' }) {
  const [step, setStep] = useState(1);
  const [drafts, setDrafts] = useState<ProfileDraft[]>([]);
  const [profileId, setProfileId] = useState<string | null>(null);
  const [form, setForm] = useState<FormState>(EMPTY_FORM);
  const [selectedLead, setSelectedLead] = useState<CandidateLeadIdentity | null>(null);
  const [selectedStudent, setSelectedStudent] = useState<StaffStudentSearchResult | null>(null);
  const [leadQuery, setLeadQuery] = useState('');
  const [studentQuery, setStudentQuery] = useState('');
  const [leadResults, setLeadResults] = useState<CandidatIndividuelLeadSearchItem[]>([]);
  const [studentResults, setStudentResults] = useState<CandidatIndividuelStudentSearchItem[]>([]);
  const [leadSearching, setLeadSearching] = useState(false);
  const [studentSearching, setStudentSearching] = useState(false);
  const [identityResolving, setIdentityResolving] = useState(false);
  const [leadSearchError, setLeadSearchError] = useState(false);
  const [studentSearchError, setStudentSearchError] = useState(false);
  const [identityResolutionError, setIdentityResolutionError] = useState<string | null>(null);
  const [identityResolutionRetry, setIdentityResolutionRetry] = useState<{
    studentId: string;
    candidate: CandidatIndividuelStudentSearchItem | null;
  } | null>(null);
  const [leadSearchAttempt, setLeadSearchAttempt] = useState(0);
  const [studentSearchAttempt, setStudentSearchAttempt] = useState(0);
  const [leadSearchCompletedFor, setLeadSearchCompletedFor] = useState('');
  const [studentSearchCompletedFor, setStudentSearchCompletedFor] = useState('');
  const [notesText, setNotesText] = useState('[]');
  const [dispensesText, setDispensesText] = useState('[]');
  const [p3AuditText, setP3AuditText] = useState('[]');
  const [diagnosticText, setDiagnosticText] = useState('');
  const [budgetTnd, setBudgetTnd] = useState('2000');
  const [strategy, setStrategy] = useState('MOST_COMPLETE');
  const [result, setResult] = useState<PipelineResult | null>(null);
  const [simulationFingerprint, setSimulationFingerprint] = useState<string | null>(null);
  const [scenarioTier, setScenarioTier] = useState<'ESSENTIEL' | 'RECOMMANDE' | 'COMPLET'>('RECOMMANDE');
  const [headcountBySubject, setHeadcountBySubject] = useState<Record<string, number | null>>({});
  const [groupChoiceBySubject, setGroupChoiceBySubject] = useState<Record<string, boolean>>({});
  const [createdQuote, setCreatedQuote] = useState<StaffQuoteView | null>(null);
  const [createdQuoteFingerprint, setCreatedQuoteFingerprint] = useState<string | null>(null);
  const [marginReview, setMarginReview] = useState<MarginReview | null>(null);
  const [marginOverrideReason, setMarginOverrideReason] = useState('');
  const [familyLink, setFamilyLink] = useState<{ url: string; action: 'LINK_ISSUED' | 'LINK_ROTATED' } | null>(null);
  const [familyLinkCopied, setFamilyLinkCopied] = useState(false);
  const [busy, setBusy] = useState<BusyAction>(null);
  const [error, setError] = useState<string | null>(null);
  const [notice, setNotice] = useState<string | null>(null);
  const duplicateLanguages = form.langueA !== '' && form.langueA === form.langueB;
  const leadTimer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const studentTimer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const leadRequestGeneration = useRef(0);
  const studentRequestGeneration = useRef(0);
  const latestLeadQuery = useRef('');
  const latestStudentQuery = useRef('');
  const latestFingerprint = useRef('');
  const latestQuoteFingerprint = useRef('');
  const quoteAttempts = useRef<Map<string, QuoteRequestAttempt>>(new Map());
  const currentProfileRef = useRef<string | null>(null);
  const quoteOperationGeneration = useRef(0);
  const identityResolutionGeneration = useRef(0);
  const identityResolutionController = useRef<AbortController | null>(null);
  const contextualHandoff = useRef<{ role: CandidateStaffRole; studentId: string } | null>(null);
  const [, setQuoteAttemptVersion] = useState(0);
  latestLeadQuery.current = leadQuery.trim();
  latestStudentQuery.current = studentQuery.trim();

  const identityState = evaluateCandidateIdentity({
    selectedLead,
    selectedStudent,
    validating: identityResolving || (selectedStudent != null && (leadSearching || studentSearching)),
    validationError: selectedStudent != null && (leadSearchError || studentSearchError),
  });
  const identityComplete = identityState.complete;
  const inputFingerprint = JSON.stringify({
    form,
    contactLeadId: selectedLead?.id ?? null,
    studentId: selectedStudent?.studentId ?? null,
    notesText,
    dispensesText,
    p3AuditText,
    diagnosticText,
    budgetTnd,
    strategy,
  });
  latestFingerprint.current = inputFingerprint;
  const quoteCommercialFingerprint = JSON.stringify({
    profileId,
    inputFingerprint,
    scenarioTier,
    headcountBySubject,
    groupChoiceBySubject,
    marginOverride: {
      enabled: marginOverrideReason.trim().length > 0,
      reason: marginOverrideReason.trim(),
    },
  });
  latestQuoteFingerprint.current = quoteCommercialFingerprint;
  const hasCurrentCreatedQuote = createdQuote != null && createdQuoteFingerprint === quoteCommercialFingerprint;
  const currentQuoteAttempt = profileId ? quoteAttempts.current.get(profileId) ?? null : null;
  const currentAmbiguousAttempt = currentQuoteAttempt?.status === 'AMBIGUOUS' ? currentQuoteAttempt : null;
  const commercialControlsLocked = currentAmbiguousAttempt != null;
  const simulationCurrent = result != null && simulationFingerprint === inputFingerprint;

  const readyScenarios = simulationCurrent && result?.status === 'READY' ? result.scenarios ?? [] : [];
  const selectedScenario = readyScenarios.find((scenario) => scenario.tier === scenarioTier) ?? readyScenarios[0];
  const scenarioLines = selectedScenario?.lines ?? [];
  const visibleLines = scenarioLines.filter((line) => !isDeferredLine(line));
  const hasDeferredLine = scenarioLines.some(isDeferredLine);
  const groupRequirements = selectedScenario?.groupHeadcountRequirements?.length
    ? selectedScenario.groupHeadcountRequirements
    : scenarioLines
        .filter((line) => line.modality === 'GROUPE')
        .map((line) => ({ subject: line.subject, hoursPerMonth: line.hoursPerMonth, unitPriceMonthly: line.unitPriceMonthly }));
  const missingGroupRequirements = groupRequirements.filter((requirement) => headcountBySubject[requirement.subject] == null);
  const groupHeadcountBlocking = missingGroupRequirements.length > 0;
  const needsAuthoritativeReprice = groupRequirements.some((requirement) => {
    const value = headcountBySubject[requirement.subject];
    return value === 1 || value === 2;
  });
  const staffMargin = createdQuote?.margin ?? marginReview;
  const parsedDispenses = (() => {
    try {
      const value: unknown = JSON.parse(dispensesText || '[]');
      return Array.isArray(value) ? (value as DispenseEntry[]) : [];
    } catch {
      return [];
    }
  })();
  const supportedDispenseIds = new Set(DISPENSE_OPTIONS.map((option) => option.id));
  const unsupportedDispenses = parsedDispenses.filter((entry) => !supportedDispenseIds.has(entry.epreuveId as (typeof DISPENSE_OPTIONS)[number]['id']));

  const requirementDisplayLabel = (subject: string) =>
    scenarioLines.find((line) => line.subject === subject)?.label ?? subjectLabel(subject);

  function clearCommercialState() {
    setResult(null);
    setSimulationFingerprint(null);
    setHeadcountBySubject({});
    setGroupChoiceBySubject({});
    setCreatedQuote(null);
    setCreatedQuoteFingerprint(null);
    setMarginReview(null);
    setMarginOverrideReason('');
    setFamilyLink(null);
    setFamilyLinkCopied(false);
    setNotice(null);
  }

  function invalidateCreatedQuote(targetStep = 3) {
    setCreatedQuote(null);
    setCreatedQuoteFingerprint(null);
    setMarginReview(null);
    setMarginOverrideReason('');
    setFamilyLink(null);
    setFamilyLinkCopied(false);
    setNotice(null);
    setStep((current) => (current === 5 ? targetStep : current));
  }

  function updateForm<K extends keyof FormState>(key: K, value: FormState[K]) {
    setForm((current) => ({ ...current, [key]: value }));
    clearCommercialState();
  }

  function parseArrayJson(text: string, label: string): unknown[] {
    if (!text.trim()) return [];
    const parsed: unknown = JSON.parse(text);
    if (!Array.isArray(parsed)) throw new Error(`${label} doit être une liste.`);
    return parsed;
  }

  function buildStaffExtension() {
    const dispenses = parseArrayJson(dispensesText, 'Dispenses déclarées') as DispenseEntry[];
    const supportedIds = new Set(DISPENSE_OPTIONS.map((option) => option.id));
    if (dispenses.some((entry) => !supportedIds.has(entry.epreuveId as (typeof DISPENSE_OPTIONS)[number]['id']))) {
      throw new Error("Une dispense inconnue a été détectée. L'enregistrement est bloqué.");
    }
    return {
      notesConservees: parseArrayJson(notesText, 'Notes conservées'),
      dispensesDeclarees: dispenses,
      p3EligibiliteAudit: parseArrayJson(p3AuditText, 'Vérifications du parcours accéléré'),
    };
  }

  function assertSupportedProfileScope() {
    if (!SPECIALTY_OPTIONS.some((option) => option.value === form.specialite1) || !SPECIALTY_OPTIONS.some((option) => option.value === form.specialite2)) {
      throw new Error("Une spécialité inconnue ou hors périmètre a été détectée. L'enregistrement est bloqué.");
    }
    if ((form.langueA && !LANGUAGE_OPTIONS.some((option) => option.value === form.langueA)) || (form.langueB && !LANGUAGE_OPTIONS.some((option) => option.value === form.langueB))) {
      throw new Error("Une langue inconnue a été détectée. L'enregistrement est bloqué.");
    }
    if (duplicateLanguages) {
      throw new Error(DUPLICATE_LANGUAGE_MESSAGE);
    }
    if (form.specialiteAbandonnee && !SPECIALTY_OPTIONS.some((option) => option.value === form.specialiteAbandonnee)) {
      throw new Error("La spécialité non poursuivie est hors périmètre. L'enregistrement est bloqué.");
    }
    if (form.optionsTerminale.length > 0) {
      throw new Error("Les options de Terminale de ce dossier restent hors de l'offre V1.");
    }
  }

  function updateDispense(epreuveId: string, patch: Partial<DispenseEntry> | null) {
    const current = parsedDispenses.filter((entry) => entry.epreuveId !== epreuveId);
    const previous = parsedDispenses.find((entry) => entry.epreuveId === epreuveId);
    const next = patch == null
      ? current
      : [...current, { epreuveId, statut: previous?.statut ?? 'DECLAREE', ...previous, ...patch }];
    setDispensesText(JSON.stringify(next, null, 2));
    clearCommercialState();
  }

  function parseDiagnostic(): unknown {
    if (!diagnosticText.trim()) return null;
    const raw = JSON.parse(diagnosticText) as unknown;
    return { raw };
  }

  const loadDrafts = useCallback(async () => {
    try {
      const response = await fetch('/api/assistante/candidat-individuel/profils');
      if (!response.ok) return;
      const data = await readJson(response);
      setDrafts((data.profils ?? []) as ProfileDraft[]);
    } catch {
      setDrafts([]);
    }
  }, []);

  useEffect(() => {
    void loadDrafts();
  }, [loadDrafts]);

  useEffect(() => {
    if (leadTimer.current) clearTimeout(leadTimer.current);
    const query = leadQuery.trim();
    const generation = ++leadRequestGeneration.current;
    const controller = new AbortController();
    if (query.length < 2 || selectedLead) {
      setLeadResults([]);
      setLeadSearching(false);
      controller.abort();
      return;
    }
    leadTimer.current = setTimeout(async () => {
      setLeadSearching(true);
      setLeadSearchError(false);
      try {
        const response = await fetch('/api/assistante/candidat-individuel/leads/search', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ query, limit: 10 }),
          signal: controller.signal,
        });
        if (!response.ok) throw new Error('lead_search_failed');
        const data = candidatIndividuelLeadSearchSuccessSchema.safeParse(await response.json().catch(() => null));
        if (!data.success) throw new Error('invalid_lead_contract');
        if (generation !== leadRequestGeneration.current || latestLeadQuery.current !== query) return;
        setLeadResults(data.data.items);
      } catch {
        if (controller.signal.aborted || generation !== leadRequestGeneration.current || latestLeadQuery.current !== query) return;
        setLeadResults([]);
        setLeadSearchError(true);
      } finally {
        if (generation !== leadRequestGeneration.current || latestLeadQuery.current !== query) return;
        setLeadSearchCompletedFor(query);
        setLeadSearching(false);
      }
    }, 250);
    return () => {
      if (leadTimer.current) clearTimeout(leadTimer.current);
      controller.abort();
    };
  }, [leadQuery, selectedLead, leadSearchAttempt]);

  useEffect(() => {
    if (studentTimer.current) clearTimeout(studentTimer.current);
    const query = studentQuery.trim();
    const generation = ++studentRequestGeneration.current;
    const controller = new AbortController();
    if (query.length < 2 || selectedStudent) {
      setStudentResults([]);
      setStudentSearching(false);
      controller.abort();
      return;
    }
    studentTimer.current = setTimeout(async () => {
      setStudentSearching(true);
      setStudentSearchError(false);
      try {
        const response = await fetch('/api/assistante/candidat-individuel/students/search', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ query, page: 1, limit: 10 }),
          signal: controller.signal,
        });
        if (!response.ok) throw new Error('student_search_failed');
        const data = candidatIndividuelStudentSearchSuccessSchema.safeParse(await response.json().catch(() => null));
        if (!data.success) throw new Error('invalid_student_contract');
        if (generation !== studentRequestGeneration.current || latestStudentQuery.current !== query) return;
        setStudentResults(data.data.items);
      } catch {
        if (controller.signal.aborted || generation !== studentRequestGeneration.current || latestStudentQuery.current !== query) return;
        setStudentResults([]);
        setStudentSearchError(true);
      } finally {
        if (generation !== studentRequestGeneration.current || latestStudentQuery.current !== query) return;
        setStudentSearchCompletedFor(query);
        setStudentSearching(false);
      }
    }, 250);
    return () => {
      if (studentTimer.current) clearTimeout(studentTimer.current);
      controller.abort();
    };
  }, [studentQuery, selectedStudent, studentSearchAttempt]);

  function selectLead(lead: CandidatIndividuelLeadSearchItem) {
    cancelIdentityResolution();
    if (selectedLead?.id !== lead.contactLeadId) setSelectedStudent(null);
    setSelectedLead({
      id: lead.contactLeadId,
      name: lead.displayName,
      email: lead.email,
      phone: null,
    });
    setLeadQuery('');
    setLeadResults([]);
    setLeadSearchError(false);
    setStudentQuery('');
    setStudentResults([]);
    setStudentSearchError(false);
    setIdentityResolutionError(null);
    clearCommercialState();
  }

  async function resolveCandidateStudent(
    studentId: string,
    candidate: CandidatIndividuelStudentSearchItem | null = null,
  ) {
    identityResolutionController.current?.abort();
    const controller = new AbortController();
    identityResolutionController.current = controller;
    const generation = ++identityResolutionGeneration.current;
    setIdentityResolving(true);
    setIdentityResolutionError(null);
    setIdentityResolutionRetry(null);
    setStudentSearchError(false);
    try {
      const result = await requestCandidateIdentity(studentId, { signal: controller.signal });
      const payload = result.payload as {
        success?: unknown;
        contactLead?: unknown;
        student?: unknown;
        message?: string;
      } | null;
      if (generation !== identityResolutionGeneration.current) return;
      const resolvedStudent = normalizeStaffStudentSearchResult(payload?.student);
      const contactLead = payload?.contactLead;
      const validContactLead = contactLead != null
        && typeof contactLead === 'object'
        && typeof (contactLead as { id?: unknown }).id === 'string'
        && (contactLead as { id: string }).id.trim().length > 0
        && typeof (contactLead as { name?: unknown }).name === 'string'
        && (contactLead as { name: string }).name.trim().length > 0
        && typeof (contactLead as { email?: unknown }).email === 'string'
        && (contactLead as { email: string }).email.trim().length > 0
        && ((contactLead as { phone?: unknown }).phone === null || typeof (contactLead as { phone?: unknown }).phone === 'string')
        && typeof (contactLead as { status?: unknown }).status === 'string';
      if (!result.ok || payload?.success !== true || !resolvedStudent || resolvedStudent.studentId !== studentId || !validContactLead) {
        throw new Error(payload?.message || 'Impossible de rattacher cet élève à son responsable.');
      }

      setSelectedLead(selectedLead ?? {
        id: (contactLead as { id: string }).id,
        name: (contactLead as { name: string }).name,
        email: (contactLead as { email: string }).email,
        phone: (contactLead as { phone: string | null }).phone,
      });
      setSelectedStudent(resolvedStudent);
      setLeadQuery('');
      setLeadResults([]);
      setLeadSearchError(false);
      setStudentQuery('');
      setStudentResults([]);
      clearCommercialState();
    } catch (cause) {
      if (generation !== identityResolutionGeneration.current) return;
      if (cause instanceof CandidateIdentityRequestError && cause.code === 'ABORTED') return;
      setSelectedStudent(null);
      setIdentityResolutionRetry({ studentId, candidate });
      setIdentityResolutionError(
        cause instanceof CandidateIdentityRequestError && cause.code === 'TIMEOUT'
          ? 'Le rattachement prend trop de temps. Réessayez.'
          : cause instanceof CandidateIdentityRequestError && cause.code === 'NETWORK'
            ? 'La connexion au service de rattachement a échoué. Vérifiez le réseau puis réessayez.'
          : cause instanceof Error ? cause.message : 'Impossible de rattacher cet élève à son responsable.',
      );
    } finally {
      if (generation === identityResolutionGeneration.current) {
        if (identityResolutionController.current === controller) identityResolutionController.current = null;
        setIdentityResolving(false);
      }
    }
  }

  function selectStudent(student: CandidatIndividuelStudentSearchItem) {
    if (!student.selectable) return;
    void resolveCandidateStudent(student.studentId, student);
  }

  function cancelIdentityResolution() {
    identityResolutionGeneration.current += 1;
    identityResolutionController.current?.abort();
    identityResolutionController.current = null;
    setIdentityResolving(false);
    setIdentityResolutionError(null);
    setIdentityResolutionRetry(null);
  }

  useEffect(() => {
    if (contextualHandoff.current && contextualHandoff.current.role !== staffRole) {
      cancelIdentityResolution();
      contextualHandoff.current = null;
    }
    let studentId = contextualHandoff.current?.role === staffRole
      ? contextualHandoff.current.studentId
      : null;
    if (!studentId) {
      const consumedHandoff = tryCandidateStudentHandoffStorage(
        () => window.sessionStorage,
        (storage) => consumeCandidateStudentHandoff(storage, staffRole),
      );
      if (!consumedHandoff.ok) {
        setIdentityResolutionError('La sélection de l’élève est invalide. Recherchez à nouveau cet élève.');
        return;
      }
      studentId = consumedHandoff.value;
      if (studentId) contextualHandoff.current = { role: staffRole, studentId };
    }
    if (!studentId) return;
    void resolveCandidateStudent(studentId, null);
  }, [staffRole]);

  useEffect(() => () => {
    identityResolutionGeneration.current += 1;
    identityResolutionController.current?.abort();
    identityResolutionController.current = null;
  }, []);

  async function persistProfile(): Promise<string | null> {
    if (!identityComplete || !selectedLead || !selectedStudent) {
      setError("Sélectionnez d'abord un responsable et un élève.");
      return null;
    }
    let staffExtension;
    try {
      assertSupportedProfileScope();
      staffExtension = buildStaffExtension();
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : 'Les options avancées sont invalides.');
      return null;
    }
    const body = JSON.stringify({
      publicInput: formToPublicInput(form),
      staffExtension,
      contactLeadId: selectedLead.id,
      studentId: selectedStudent.studentId,
    });
    try {
      const response = profileId
        ? await fetch(`/api/assistante/candidat-individuel/profils/${profileId}`, {
            method: 'PATCH',
            headers: { 'Content-Type': 'application/json' },
            body,
          })
        : await fetch('/api/assistante/candidat-individuel/profils', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body,
          });
      const data = await readJson(response);
      if (!response.ok) {
        setError(
          Array.isArray(data.missingRequiredFields) && data.missingRequiredFields.length > 0
            ? 'Complétez les informations obligatoires du profil avant de poursuivre.'
            : humanizeServerMessage(data.message ?? data.error),
        );
        return null;
      }
      if (!isRecord(data.profil) || typeof data.profil.id !== 'string' || data.profil.id.trim().length === 0) {
        setError("Le serveur n'a pas retourné de profil valide.");
        return null;
      }
      const id = data.profil.id;
      selectCurrentProfile(id);
      void loadDrafts();
      return id;
    } catch {
      setError("L'enregistrement est momentanément indisponible.");
      return null;
    }
  }

  async function saveDraft() {
    setBusy('save');
    setError(null);
    setNotice(null);
    const id = await persistProfile();
    if (id) setNotice('Brouillon enregistré.');
    setBusy(null);
  }

  async function saveAndSimulate() {
    setBusy('simulate');
    setError(null);
    setNotice(null);
    const fingerprintAtRequest = inputFingerprint;
    const id = await persistProfile();
    if (!id) {
      setBusy(null);
      return;
    }
    let staffExtension;
    let diagnostic;
    try {
      staffExtension = buildStaffExtension();
      diagnostic = parseDiagnostic();
    } catch {
      setError('Le diagnostic ou les options avancées contiennent un format invalide.');
      setBusy(null);
      return;
    }
    try {
      const response = await fetch('/api/assistante/candidat-individuel/simulate', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          publicInput: formToPublicInput(form),
          staffExtension,
          budget: { monthlyBudgetTnd: Number(budgetTnd), strategy },
          diagnostic,
        }),
      });
      const data = await readJson(response);
      if (!response.ok) {
        setError(humanizeServerMessage(data.message ?? data.error));
        return;
      }
      if (latestFingerprint.current !== fingerprintAtRequest) return;
      const nextResult = data.result as PipelineResult;
      setResult(nextResult);
      setSimulationFingerprint(fingerprintAtRequest);
      setCreatedQuote(null);
      setCreatedQuoteFingerprint(null);
      setMarginReview(null);
      setFamilyLink(null);
      setHeadcountBySubject({});
      setGroupChoiceBySubject({});
      if (nextResult.status === 'READY') {
        const recommended = nextResult.scenarios?.find((scenario) => scenario.tier === 'RECOMMANDE');
        setScenarioTier(recommended?.tier ?? nextResult.scenarios?.[0]?.tier ?? 'RECOMMANDE');
        setStep(3);
      }
    } catch {
      setError('La simulation est momentanément indisponible.');
    } finally {
      setBusy(null);
    }
  }

  function chooseHeadcount(subject: string, choice: 'INDIVIDUEL' | 'DUO' | 'GROUPE') {
    if (choice === 'INDIVIDUEL' || choice === 'DUO') {
      setHeadcountBySubject((current) => ({ ...current, [subject]: choice === 'INDIVIDUEL' ? 1 : 2 }));
      setGroupChoiceBySubject((current) => ({ ...current, [subject]: false }));
    } else {
      setHeadcountBySubject((current) => ({ ...current, [subject]: null }));
      setGroupChoiceBySubject((current) => ({ ...current, [subject]: true }));
    }
    invalidateCreatedQuote();
  }

  function setGroupSize(subject: string, raw: string) {
    const value = Number(raw);
    const valid = Number.isInteger(value) && value >= 3 ? value : null;
    setHeadcountBySubject((current) => ({ ...current, [subject]: valid }));
    invalidateCreatedQuote();
  }

  function storeQuoteAttempt(attempt: QuoteRequestAttempt) {
    quoteAttempts.current.set(attempt.profileId, attempt);
    setQuoteAttemptVersion((version) => version + 1);
  }

  function clearQuoteAttempt(targetProfileId: string) {
    quoteAttempts.current.delete(targetProfileId);
    setQuoteAttemptVersion((version) => version + 1);
  }

  function selectCurrentProfile(targetProfileId: string | null) {
    currentProfileRef.current = targetProfileId;
    quoteOperationGeneration.current += 1;
    setProfileId(targetProfileId);
  }

  async function submitQuoteAttempt(attempt: QuoteRequestAttempt, quoteFingerprint: string) {
    const operationGeneration = ++quoteOperationGeneration.current;
    const operationIsCurrent = () => currentProfileRef.current === attempt.profileId
      && quoteOperationGeneration.current === operationGeneration;
    setBusy('quote');
    setError(null);
    try {
      const response = await fetch(`/api/assistante/candidat-individuel/profils/${attempt.profileId}/quote`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(attempt.payload),
      });
      const data = await readJson(response);
      if (!operationIsCurrent()) return;
      if (!response.ok) {
        if (response.status >= 400 && response.status < 500) {
          clearQuoteAttempt(attempt.profileId);
          if (data.marginReview && typeof data.marginReview === 'object') {
            const review = data.marginReview as MarginReview;
            setMarginReview(review);
            setError(review.canOverride ? null : humanizeServerMessage(data.error));
          } else {
            setError(humanizeServerMessage(data.error ?? data.message));
          }
        } else {
          storeQuoteAttempt({ ...attempt, status: 'AMBIGUOUS' });
          setError(null);
        }
        return;
      }
      if (!isStaffQuoteView(data.quote, attempt.profileId)) {
        storeQuoteAttempt({ ...attempt, status: 'AMBIGUOUS' });
        setError(null);
        return;
      }
      if (!operationIsCurrent()) return;
      storeQuoteAttempt({ ...attempt, status: 'RESOLVED' });
      setCreatedQuote(data.quote);
      setCreatedQuoteFingerprint(quoteFingerprint);
      setMarginReview(null);
      setFamilyLink(null);
      setFamilyLinkCopied(false);
      setNotice('Le brouillon de devis a été généré par le serveur.');
      setStep(5);
    } catch {
      if (operationIsCurrent()) {
        storeQuoteAttempt({ ...attempt, status: 'AMBIGUOUS' });
        setError(null);
      }
    } finally {
      if (quoteOperationGeneration.current === operationGeneration) setBusy(null);
    }
  }

  async function createDraftQuote(overrideReason?: string) {
    if (!profileId || !selectedScenario || groupHeadcountBlocking || hasDeferredLine || !simulationCurrent) return;
    if (quoteAttempts.current.get(profileId)?.status === 'AMBIGUOUS') return;
    let diagnostic;
    try {
      diagnostic = parseDiagnostic();
    } catch {
      setError('Le diagnostic avancé contient un format invalide.');
      return;
    }
    const confirmedHeadcountBySubject = groupRequirements.length
      ? Object.fromEntries(groupRequirements.map((requirement) => [requirement.subject, headcountBySubject[requirement.subject]]))
      : undefined;
    const quoteFingerprint = latestQuoteFingerprint.current;
    const createPayload = {
      budget: { monthlyBudgetTnd: Number(budgetTnd), strategy },
      scenarioTier: selectedScenario.tier,
      diagnostic,
      ...(overrideReason ? { marginOverride: { reason: overrideReason } } : {}),
      ...(confirmedHeadcountBySubject ? { confirmedHeadcountBySubject } : {}),
    };
    const requestFingerprint = JSON.stringify({ quoteCommercialFingerprint: quoteFingerprint, payload: createPayload });
    let attempt = quoteAttempts.current.get(profileId);
    if (attempt?.fingerprint !== requestFingerprint || attempt.status === 'RESOLVED') {
      const key = generateIdempotencyKey();
      attempt = {
        profileId,
        fingerprint: requestFingerprint,
        key,
        payload: { idempotencyKey: key, ...createPayload },
        status: 'PENDING',
      };
      storeQuoteAttempt(attempt);
    }
    await submitQuoteAttempt(attempt, quoteFingerprint);
  }

  async function retryAmbiguousQuote() {
    if (!profileId) return;
    const attempt = quoteAttempts.current.get(profileId);
    if (!attempt || attempt.status !== 'AMBIGUOUS') return;
    await submitQuoteAttempt(attempt, latestQuoteFingerprint.current);
  }

  async function reconcileAmbiguousQuote() {
    if (!profileId) return;
    const attempt = quoteAttempts.current.get(profileId);
    if (!attempt || attempt.status !== 'AMBIGUOUS') return;
    const operationGeneration = ++quoteOperationGeneration.current;
    const operationIsCurrent = () => currentProfileRef.current === attempt.profileId
      && quoteOperationGeneration.current === operationGeneration;
    setBusy('quote');
    setError(null);
    try {
      const response = await fetch(`/api/assistante/candidat-individuel/profils/${profileId}/quote/reconcile`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ idempotencyKey: attempt.key }),
      });
      const data = await readJson(response);
      if (!operationIsCurrent()) return;
      if (response.status === 404) {
        setError('Aucun devis trouvé pour l’instant; réessayer exactement ou relancer la vérification.');
        return;
      }
      if (!response.ok || !isStaffQuoteView(data.quote, profileId)) {
        setError('Le serveur ne peut pas confirmer cette tentative. La création reste verrouillée.');
        return;
      }
      storeQuoteAttempt({ ...attempt, status: 'RESOLVED' });
      if (!operationIsCurrent()) return;
      setCreatedQuote(data.quote);
      setCreatedQuoteFingerprint(latestQuoteFingerprint.current);
      setMarginReview(null);
      setFamilyLink(null);
      setFamilyLinkCopied(false);
      setNotice('Le devis enregistré avec cette tentative a été retrouvé.');
      setStep(5);
    } catch {
      if (operationIsCurrent()) setError('Le dossier ne peut pas être rechargé. La création reste verrouillée.');
    } finally {
      if (quoteOperationGeneration.current === operationGeneration) setBusy(null);
    }
  }

  async function publishQuote() {
    if (!createdQuote || !identityComplete) return;
    setBusy('publish');
    setError(null);
    try {
      const response = await fetch(`/api/assistante/candidat-individuel/quotes/${createdQuote.id}/publish`, { method: 'POST' });
      const data = await readJson(response);
      if (!response.ok) {
        setError(humanizeServerMessage((Array.isArray(data.reasons) ? data.reasons[0] : undefined) ?? data.error));
        return;
      }
      setCreatedQuote(data.quote as StaffQuoteView);
      setNotice('Le devis est validé et prêt pour la création du lien famille.');
    } catch {
      setError('La publication est momentanément indisponible.');
    } finally {
      setBusy(null);
    }
  }

  async function issueFamilyLink() {
    if (!createdQuote) return;
    setBusy('family-link');
    setError(null);
    setFamilyLinkCopied(false);
    try {
      const response = await fetch(`/api/assistante/candidat-individuel/quotes/${createdQuote.id}/family-link`, { method: 'POST' });
      const data = await readJson(response);
      if (!response.ok) {
        setError(humanizeServerMessage((Array.isArray(data.reasons) ? data.reasons[0] : undefined) ?? data.error));
        return;
      }
      setFamilyLink({ url: String(data.familyUrl), action: data.action as 'LINK_ISSUED' | 'LINK_ROTATED' });
      setNotice(data.action === 'LINK_ROTATED' ? 'Le lien famille précédent a été remplacé.' : 'Le lien famille sécurisé est prêt.');
    } catch {
      setError("La création du lien famille est momentanément indisponible.");
    } finally {
      setBusy(null);
    }
  }

  async function copyFamilyLink() {
    if (!familyLink) return;
    try {
      await navigator.clipboard.writeText(familyLink.url);
      setFamilyLinkCopied(true);
    } catch {
      setError('Copie impossible. Sélectionnez le lien et copiez-le manuellement.');
    }
  }

  async function requestReview() {
    if (!profileId) return;
    setBusy('review');
    setError(null);
    try {
      const response = await fetch(`/api/assistante/candidat-individuel/profils/${profileId}/review`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ note: null }),
      });
      if (!response.ok) {
        setError("La demande de revue n'a pas pu être enregistrée.");
        return;
      }
      setNotice('La revue réglementaire a été demandée.');
      void loadDrafts();
    } finally {
      setBusy(null);
    }
  }

  async function createRevision() {
    if (!profileId) return;
    setBusy('revision');
    setError(null);
    try {
      const response = await fetch(`/api/assistante/candidat-individuel/profils/${profileId}/revision`, { method: 'POST' });
      const data = await readJson(response);
      if (!response.ok) {
        setError("La révision n'a pas pu être créée.");
        return;
      }
      loadProfile(data.profil as ProfileDraft);
      setNotice('Une nouvelle révision modifiable a été créée.');
      setStep(2);
      void loadDrafts();
    } finally {
      setBusy(null);
    }
  }

  function loadProfile(profile: ProfileDraft) {
    cancelIdentityResolution();
    selectCurrentProfile(profile.id);
    setBusy(null);
    setForm(profileToForm(profile));
    setSelectedLead(profile.contactLead ?? null);
    setSelectedStudent(profile.student ? normalizeStaffStudentSearchResult(profile.student) : null);
    setNotesText(JSON.stringify(profile.notesConservees ?? [], null, 2));
    setDispensesText(JSON.stringify(profile.dispensesDeclarees ?? [], null, 2));
    setP3AuditText(JSON.stringify(profile.p3EligibiliteAudit ?? [], null, 2));
    setLeadQuery('');
    setStudentQuery('');
    clearCommercialState();
    if (profile.lastQuote && profile.contactLead && profile.student) {
      setCreatedQuote(profile.lastQuote);
      setCreatedQuoteFingerprint(null);
      setStep(5);
    } else {
      setStep(profile.contactLead && profile.student ? 2 : 1);
    }
  }

  async function loadDraft(id: string) {
    setError(null);
    try {
      const response = await fetch(`/api/assistante/candidat-individuel/profils/${id}`);
      const data = await readJson(response);
      if (!response.ok) {
        setError('Impossible de reprendre ce dossier.');
        return;
      }
      loadProfile(data.profil as ProfileDraft);
    } catch {
      setError('Impossible de reprendre ce dossier.');
    }
  }

  function newProfile() {
    cancelIdentityResolution();
    selectCurrentProfile(null);
    setBusy(null);
    setForm(EMPTY_FORM);
    setSelectedLead(null);
    setSelectedStudent(null);
    setLeadQuery('');
    setStudentQuery('');
    setNotesText('[]');
    setDispensesText('[]');
    setP3AuditText('[]');
    setDiagnosticText('');
    clearCommercialState();
    setError(null);
    setStep(1);
  }

  const accessibleStep = (number: number) => {
    if (commercialControlsLocked && number < 3) return false;
    if (number === 1) return true;
    if (number === 2) return identityComplete;
    if (number === 3) return simulationCurrent && result?.status === 'READY';
    if (number === 4) return simulationCurrent && result?.status === 'READY' && !groupHeadcountBlocking && !hasDeferredLine;
    return createdQuote != null;
  };

  const currentResultMessage = resultMessage(simulationCurrent ? result : null);

  if (busy === 'quote') {
    return (
      <div className="mx-auto max-w-2xl">
        <Card className="border-sky-300/30 bg-surface-card" aria-labelledby="quote-in-flight-title">
          <CardContent className="flex flex-col items-center px-6 py-12 text-center" role="status" aria-live="polite">
            <span className="rounded-full bg-sky-300/10 p-4 text-sky-100">
              <Loader2 className="h-7 w-7 animate-spin" aria-hidden="true" />
            </span>
            <h2 id="quote-in-flight-title" className="mt-5 text-xl font-semibold text-white">Création du devis en cours</h2>
            <p className="mt-2 max-w-lg text-sm leading-6 text-neutral-300">
              Le dossier et les paramètres commerciaux sont temporairement verrouillés. Cette étape évite toute modification ou création en double pendant la réponse du serveur.
            </p>
          </CardContent>
        </Card>
      </div>
    );
  }

  if (currentAmbiguousAttempt) {
    return (
      <div className="mx-auto max-w-3xl space-y-5">
        <Card className="border-amber-300/30 bg-surface-card" aria-labelledby="ambiguous-quote-title">
          <CardHeader className="border-b border-white/10">
            <p className="text-xs font-semibold uppercase tracking-[0.16em] text-amber-200">Création à confirmer</p>
            <CardTitle id="ambiguous-quote-title" className="text-xl text-white">Résoudre la tentative de devis</CardTitle>
          </CardHeader>
          <CardContent className="space-y-4 pt-6">
            <div id="ambiguous-quote-explanation" role="alert" className="rounded-micro border border-amber-300/30 bg-amber-300/10 p-4 text-sm text-amber-100">
              <p className="font-medium">Le résultat de la création est inconnu.</p>
              <p className="mt-1 text-xs leading-5">Aucune donnée du profil ou de la proposition ne peut être modifiée avant la résolution. Rejouez exactement la même requête ou vérifiez uniquement cette tentative auprès du serveur.</p>
            </div>
            {error && <div role="status" className="rounded-micro border border-red-400/30 bg-red-400/10 p-4 text-sm text-red-100">{error}</div>}
            <div className="flex flex-wrap gap-2">
              <Button type="button" onClick={() => void retryAmbiguousQuote()} disabled={busy != null}>Réessayer exactement</Button>
              <Button type="button" variant="outline" onClick={() => void reconcileAmbiguousQuote()} disabled={busy != null}>Recharger le dossier</Button>
              <Button type="button" variant="ghost" onClick={newProfile} disabled={busy != null}>Nouveau</Button>
            </div>
          </CardContent>
        </Card>

        <details className="rounded-micro border border-white/10 bg-surface-card">
          <summary className="min-h-11 cursor-pointer px-4 py-3 text-sm font-medium text-neutral-200 outline-none focus-visible:ring-2 focus-visible:ring-brand-primary">Dossiers récents</summary>
          <div className="space-y-2 border-t border-white/10 p-3">
            {drafts.length === 0 && <p className="text-xs text-neutral-400">Aucun dossier enregistré.</p>}
            {drafts.map((draft) => (
              <button key={draft.id} type="button" onClick={() => void loadDraft(draft.id)} className="min-h-11 w-full rounded-micro border border-white/10 px-3 py-2 text-left text-xs text-neutral-300 outline-none hover:bg-surface-hover focus-visible:ring-2 focus-visible:ring-brand-primary">
                <span className="block font-medium text-white">{draft.student ? studentDisplayName(draft.student.user) : 'Candidat à rattacher'}</span>
                <span>{draft.level === 'PREMIERE' ? 'Première' : 'Terminale'} · session {draft.examSession}</span>
              </button>
            ))}
          </div>
        </details>
      </div>
    );
  }

  return (
    <div className="space-y-5">
      <nav aria-label="Étapes du simulateur" className="overflow-x-auto rounded-micro border border-white/10 bg-surface-card p-2">
        <ol className="flex min-w-[700px] items-center gap-1">
          {STEPS.map((item, index) => {
            const active = step === item.number;
            const complete = step > item.number;
            return (
              <li key={item.number} className="flex min-w-0 flex-1 items-center">
                <button
                  type="button"
                  onClick={() => accessibleStep(item.number) && setStep(item.number)}
                  disabled={!accessibleStep(item.number)}
                  aria-current={active ? 'step' : undefined}
                  className={`flex min-h-11 w-full items-center gap-2 rounded-micro px-3 py-2 text-left text-sm outline-none transition focus-visible:ring-2 focus-visible:ring-brand-primary ${
                    active
                      ? 'bg-brand-primary text-white'
                      : complete
                        ? 'bg-emerald-400/10 text-emerald-100'
                        : 'text-neutral-400 hover:bg-surface-hover disabled:cursor-not-allowed disabled:opacity-50'
                  }`}
                >
                  <span className="flex h-6 w-6 shrink-0 items-center justify-center rounded-full border border-current text-xs font-semibold">
                    {complete ? <Check className="h-3.5 w-3.5" aria-hidden="true" /> : item.number}
                  </span>
                  <span className="truncate">{item.short}</span>
                </button>
                {index < STEPS.length - 1 && <ChevronRight className="h-4 w-4 shrink-0 text-neutral-600" aria-hidden="true" />}
              </li>
            );
          })}
        </ol>
      </nav>

      <div className="grid items-start gap-5 xl:grid-cols-[minmax(0,1fr)_320px]">
        <main className="min-w-0 space-y-4">
          {step === 1 && (
            <Card className="border-white/10 bg-surface-card">
              <CardHeader className="border-b border-white/10">
                <div className="flex items-center gap-3">
                  <span className="rounded-full bg-brand-primary/15 p-2 text-brand-accent"><UserRound className="h-5 w-5" aria-hidden="true" /></span>
                  <div>
                    <p className="text-xs font-semibold uppercase tracking-[0.16em] text-brand-accent">Étape 1 sur 5</p>
                    <CardTitle className="mt-1 text-xl text-white">Élève et responsable</CardTitle>
                  </div>
                </div>
              </CardHeader>
              <CardContent className="space-y-6 pt-6">
                <p className="max-w-2xl text-sm leading-6 text-neutral-300">
                  Retrouvez la famille et l&apos;élève dans les dossiers Nexus. Les deux rattachements sont nécessaires avant toute publication.
                </p>

                <div className="grid gap-5 md:grid-cols-2">
                  <div className="space-y-2">
                    <Label htmlFor="lead-search">Rechercher un responsable</Label>
                    {selectedLead ? (
                      <div className="rounded-micro border border-emerald-400/25 bg-emerald-400/10 p-3" data-testid="selected-lead">
                        <div className="flex flex-col gap-2">
                          <div className="min-w-0">
                            <p className="font-medium text-white">{selectedLead.name}</p>
                            <p className="truncate text-sm text-neutral-300">{selectedLead.email}</p>
                            {selectedLead.phone && <p className="text-sm text-neutral-400">{selectedLead.phone}</p>}
                          </div>
                          <Button type="button" size="sm" variant="ghost" className="h-auto self-start px-0 py-1 text-left" onClick={() => { cancelIdentityResolution(); setSelectedLead(null); setSelectedStudent(null); setStudentQuery(''); clearCommercialState(); }}>Changer de responsable</Button>
                        </div>
                      </div>
                    ) : (
                      <div className="relative">
                        <Search className="pointer-events-none absolute left-3 top-3 h-4 w-4 text-neutral-500" aria-hidden="true" />
                        <Input
                          id="lead-search"
                          value={leadQuery}
                          onChange={(event) => setLeadQuery(event.target.value)}
                          placeholder="Nom, email ou téléphone"
                          className="pl-9"
                          role="combobox"
                          aria-autocomplete="list"
                          aria-expanded={leadResults.length > 0}
                          aria-controls="lead-results"
                        />
                        {leadSearching && <p className="mt-2 text-xs text-neutral-400" role="status">Recherche en cours...</p>}
                        {leadSearchError && (
                          <div className="mt-2 flex items-center gap-2" role="alert">
                            <span className="text-xs text-red-200">La recherche des responsables a échoué.</span>
                            <Button type="button" size="sm" variant="ghost" onClick={() => setLeadSearchAttempt((value) => value + 1)}>Réessayer la recherche des responsables</Button>
                          </div>
                        )}
                        {!leadSearching && !leadSearchError && leadQuery.trim().length >= 2 && leadSearchCompletedFor === leadQuery.trim() && leadResults.length === 0 && (
                          <p className="mt-2 text-xs text-neutral-400" role="status">Aucun responsable trouvé.</p>
                        )}
                        {leadResults.length > 0 && (
                          <ul id="lead-results" role="listbox" aria-label="Responsables trouvés" className="absolute z-20 mt-1 max-h-60 w-full overflow-y-auto rounded-micro border border-neutral-700 bg-neutral-950 p-1 shadow-xl">
                            {leadResults.map((lead) => (
                              <li key={lead.contactLeadId}>
                                <button type="button" role="option" aria-selected="false" onClick={() => selectLead(lead)} className="min-h-11 w-full rounded px-3 py-2 text-left text-sm text-neutral-100 outline-none hover:bg-surface-hover focus-visible:ring-2 focus-visible:ring-brand-primary">
                                  <span className="block font-medium">{lead.displayName}</span>
                                  <span className="block text-xs text-neutral-400">{lead.email}</span>
                                </button>
                              </li>
                            ))}
                          </ul>
                        )}
                      </div>
                    )}
                  </div>

                  <div className="space-y-2">
                    <Label htmlFor="student-search">Rechercher un élève</Label>
                    {selectedStudent ? (
                      <div className="rounded-micro border border-emerald-400/25 bg-emerald-400/10 p-3" data-testid="selected-student">
                        <div className="flex flex-col gap-2">
                          <div className="min-w-0">
                            <p className="font-medium text-white">{studentDisplayName(selectedStudent.user)}</p>
                            {selectedStudent.user.email && <p className="truncate text-sm text-neutral-300">{selectedStudent.user.email}</p>}
                          </div>
                          <Button type="button" size="sm" variant="ghost" className="h-auto self-start px-0 py-1 text-left" onClick={() => { cancelIdentityResolution(); setSelectedStudent(null); clearCommercialState(); }}>Changer d&apos;élève</Button>
                        </div>
                      </div>
                    ) : (
                      <div className="relative">
                        <Search className="pointer-events-none absolute left-3 top-3 h-4 w-4 text-neutral-500" aria-hidden="true" />
                        <Input
                          id="student-search"
                          value={studentQuery}
                          onChange={(event) => {
                            setStudentQuery(event.target.value);
                            setIdentityResolutionError(null);
                          }}
                          placeholder="Nom ou email"
                          className="pl-9"
                          role="combobox"
                          aria-autocomplete="list"
                          aria-expanded={studentResults.length > 0}
                          aria-controls="student-results"
                          disabled={identityResolving}
                        />
                        {identityResolving && <p className="mt-2 text-xs text-neutral-400" role="status">Rattachement du responsable en cours...</p>}
                        {identityResolutionError && (
                          <div className="mt-3 rounded-micro border border-red-300/30 bg-red-300/10 p-3" role="alert">
                            <p className="text-sm font-semibold text-red-100">Rattachement impossible</p>
                            <p className="mt-1 text-sm text-red-100/90">{identityResolutionError}</p>
                            {identityResolutionRetry && (
                              <Button
                                type="button"
                                size="sm"
                                variant="outline"
                                className="mt-3 border-red-200/30 text-red-50 hover:bg-red-200/10"
                                onClick={() => void resolveCandidateStudent(
                                  identityResolutionRetry.studentId,
                                  identityResolutionRetry.candidate,
                                )}
                              >
                                Réessayer
                              </Button>
                            )}
                          </div>
                        )}
                        {studentSearching && <p className="mt-2 text-xs text-neutral-400" role="status">Recherche en cours...</p>}
                        {studentSearchError && (
                          <div className="mt-2 flex items-center gap-2" role="alert">
                            <span className="text-xs text-red-200">La recherche des élèves a échoué. Réessayez.</span>
                            <Button type="button" size="sm" variant="ghost" onClick={() => setStudentSearchAttempt((value) => value + 1)}>Réessayer la recherche des élèves</Button>
                          </div>
                        )}
                        {!studentSearching && !studentSearchError && studentQuery.trim().length >= 2 && studentSearchCompletedFor === studentQuery.trim() && studentResults.length === 0 && (
                          <p className="mt-2 text-xs text-neutral-400" role="status">Aucun élève trouvé.</p>
                        )}
                        {studentResults.length > 0 && (
                          <ul id="student-results" role="listbox" aria-label="Élèves trouvés" className="absolute z-20 mt-1 max-h-60 w-full overflow-y-auto rounded-micro border border-neutral-700 bg-neutral-950 p-1 shadow-xl">
                            {studentResults.map((student) => (
                              <li key={student.studentId}>
                                <button
                                  type="button"
                                  role="option"
                                  aria-selected="false"
                                  disabled={identityResolving}
                                  aria-disabled={identityResolving || !student.selectable}
                                  aria-describedby={student.unavailableReason ? `candidate-inline-student-unavailable-${student.studentId}` : undefined}
                                  onMouseDown={(event) => {
                                    if (event.button !== 0 || identityResolving || !student.selectable) return;
                                    event.preventDefault();
                                    void selectStudent(student);
                                  }}
                                  onClick={() => {
                                    if (identityResolving || !student.selectable) return;
                                    void selectStudent(student);
                                  }}
                                  className="min-h-11 w-full rounded px-3 py-2 text-left text-sm text-neutral-100 outline-none hover:bg-surface-hover focus-visible:ring-2 focus-visible:ring-brand-primary disabled:cursor-not-allowed disabled:opacity-60 aria-[disabled=true]:cursor-not-allowed aria-[disabled=true]:opacity-60"
                                >
                                  <span className="block font-medium">{student.displayName}</span>
                                  {student.email && <span className="block text-xs text-neutral-400">{student.email}</span>}
                                  {student.unavailableReason && <span id={`candidate-inline-student-unavailable-${student.studentId}`} className="mt-1 block text-xs text-amber-200">{student.unavailableReason}</span>}
                                </button>
                              </li>
                            ))}
                          </ul>
                        )}
                      </div>
                    )}
                  </div>
                </div>

                <div className="flex flex-col gap-3 rounded-micro border border-white/10 bg-black/10 p-4 sm:flex-row sm:items-center sm:justify-between">
                  <p className="text-sm text-neutral-300">Élève absent ou dossier à compléter ?</p>
                  <Link href={getContextualStudentsPath(staffRole)} className="inline-flex min-h-11 shrink-0 items-center justify-center rounded-micro border border-white/15 px-4 text-sm font-medium text-white outline-none hover:bg-surface-hover focus-visible:ring-2 focus-visible:ring-brand-primary">
                    Créer ou sélectionner un élève
                  </Link>
                </div>

                {!identityComplete && (
                  <p className="flex items-center gap-2 text-sm text-amber-100" role={['RESPONSIBLE_MISMATCH', 'RESPONSIBLE_UNAVAILABLE', 'STUDENT_UNAVAILABLE'].includes(identityState.code) ? 'alert' : 'status'}>
                    <AlertTriangle className="h-4 w-4 shrink-0" aria-hidden="true" /> {identityState.message}
                  </p>
                )}
                <div className="flex justify-end">
                  <Button type="button" onClick={() => setStep(2)} disabled={!identityComplete}>
                    Continuer vers le profil <ChevronRight className="ml-2 h-4 w-4" aria-hidden="true" />
                  </Button>
                </div>
              </CardContent>
            </Card>
          )}

          {step === 2 && (
            <Card className="border-white/10 bg-surface-card">
              <CardHeader className="border-b border-white/10">
                <p className="text-xs font-semibold uppercase tracking-[0.16em] text-brand-accent">Étape 2 sur 5</p>
                <CardTitle className="text-xl text-white">Profil du candidat</CardTitle>
                <p className="text-sm text-neutral-300">Décrivez la situation réelle. Le moteur réglementaire reste seul décisionnaire.</p>
              </CardHeader>
              <CardContent className="space-y-6 pt-6">
                <fieldset className="space-y-4">
                  <legend className="text-sm font-semibold text-white">Scolarité et session</legend>
                  <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
                    <div className="space-y-2">
                      <Label htmlFor="candidate-level">Niveau</Label>
                      <select id="candidate-level" className={selectClassName} value={form.level} onChange={(event) => updateForm('level', event.target.value)}>
                        <option value="PREMIERE">Première</option>
                        <option value="TERMINALE">Terminale</option>
                      </select>
                    </div>
                    <div className="space-y-2">
                      <Label htmlFor="exam-session">Session du baccalauréat</Label>
                      <Input id="exam-session" type="number" min="2026" max="2032" value={form.examSession} onChange={(event) => updateForm('examSession', event.target.value)} />
                    </div>
                    <div className="space-y-2">
                      <Label htmlFor="candidate-modality">Modalité réglementaire du dossier</Label>
                      <select id="candidate-modality" className={selectClassName} value={form.modalite} onChange={(event) => updateForm('modalite', event.target.value)}>
                        <option value="A">Modalité A</option>
                        <option value="B">Modalité B</option>
                      </select>
                    </div>
                  </div>
                </fieldset>

                <fieldset className="space-y-4">
                  <legend className="text-sm font-semibold text-white">Spécialités et langues</legend>
                  <div className="grid gap-4 sm:grid-cols-2">
                    {([
                      ['specialite1', 'Première spécialité poursuivie'],
                      ['specialite2', 'Deuxième spécialité poursuivie'],
                      ['specialiteAbandonnee', 'Spécialité de Première non poursuivie'],
                      ['langueA', 'Langue vivante A'],
                      ['langueB', 'Langue vivante B'],
                    ] as const).map(([key, label]) => {
                      const options = key === 'langueA' || key === 'langueB' ? LANGUAGE_OPTIONS : SPECIALTY_OPTIONS;
                      return (
                        <div className="space-y-2" key={key}>
                          <Label htmlFor={`candidate-${key}`}>{label}</Label>
                          <select
                            id={`candidate-${key}`}
                            className={selectClassName}
                            value={form[key]}
                            onChange={(event) => updateForm(key, event.target.value)}
                            aria-invalid={key === 'langueB' && duplicateLanguages ? true : undefined}
                            aria-describedby={key === 'langueB' && duplicateLanguages ? 'candidate-langueB-error' : undefined}
                          >
                            {(key === 'specialiteAbandonnee' || key === 'langueA' || key === 'langueB') && <option value="">Non renseigné</option>}
                            {options.map((option) => <option key={option.value} value={option.value}>{option.label}</option>)}
                          </select>
                          {key === 'langueB' && duplicateLanguages && (
                            <p id="candidate-langueB-error" role="alert" className="text-sm text-red-200">
                              {DUPLICATE_LANGUAGE_MESSAGE}
                            </p>
                          )}
                        </div>
                      );
                    })}
                  </div>
                  {form.specialiteAbandonnee && <p className="rounded-micro border border-amber-300/20 bg-amber-300/5 p-3 text-xs leading-5 text-amber-100">{SPECIALITE_ABANDONNEE_WARNING}</p>}
                </fieldset>

                <fieldset className="space-y-4">
                  <legend className="text-sm font-semibold text-white">Dispenses déclarées</legend>
                  {unsupportedDispenses.length > 0 && (
                    <p role="alert" className="rounded-micro border border-red-400/30 bg-red-400/10 p-3 text-sm text-red-100">
                      Une dispense inconnue est enregistrée dans ce dossier. Corrigez les options avancées avant l&apos;enregistrement.
                    </p>
                  )}
                    <div className="grid gap-3 md:grid-cols-2">
                      {DISPENSE_OPTIONS.map((option) => {
                        const entry = parsedDispenses.find((item) => item.epreuveId === option.id);
                        return (
                          <div key={option.id} className="rounded-micro border border-white/10 p-3">
                            <label className="flex min-h-11 cursor-pointer items-center gap-3 text-sm text-neutral-200">
                              <input
                                type="checkbox"
                                className="h-4 w-4 accent-brand-primary"
                                checked={entry != null}
                                onChange={(event) => updateDispense(option.id, event.target.checked ? { statut: 'DECLAREE' } : null)}
                                aria-label={`Dispense - ${option.label}`}
                              />
                              <span>{option.label}</span>
                            </label>
                            {entry && (
                              <div className="mt-3 space-y-3 border-t border-white/10 pt-3">
                                <div className="space-y-2">
                                  <Label htmlFor={`dispense-status-${option.id}`}>Statut de la dispense - {option.label}</Label>
                                  <select
                                    id={`dispense-status-${option.id}`}
                                    className={selectClassName}
                                    value={entry.statut}
                                    onChange={(event) => updateDispense(option.id, { statut: event.target.value as DispenseEntry['statut'] })}
                                  >
                                    <option value="DECLAREE">Déclarée par la famille</option>
                                    <option value="CONFIRMEE">Confirmée par Nexus</option>
                                    <option value="REFUSEE">Refusée après vérification</option>
                                  </select>
                                </div>
                                {entry.statut === 'CONFIRMEE' && (
                                  <div className="space-y-2">
                                    <Label htmlFor={`dispense-proof-${option.id}`}>Référence du justificatif - {option.label}</Label>
                                    <Input
                                      id={`dispense-proof-${option.id}`}
                                      value={entry.justificatifRef ?? ''}
                                      onChange={(event) => updateDispense(option.id, { justificatifRef: event.target.value })}
                                      placeholder="Référence interne du document vérifié"
                                    />
                                  </div>
                                )}
                              </div>
                            )}
                          </div>
                        );
                      })}
                    </div>
                </fieldset>

                <fieldset className="space-y-4">
                  <legend className="text-sm font-semibold text-white">Situation réglementaire déclarée</legend>
                  <div className="grid gap-3 sm:grid-cols-2">
                    {([
                      ['estRedoublant', 'L’élève redouble sa session'],
                      ['estTitulaireBacDejaObtenu', 'L’élève possède déjà un baccalauréat'],
                      ['changementSpecialite', 'Un changement de spécialité est déclaré'],
                      ['intentionAmelioration', 'La demande porte sur une amélioration de résultats'],
                      ['intentionCycleComplet', 'Le parcours suit le cycle complet'],
                      ['etalementPlurisessionsDeclare', 'Un étalement sur plusieurs sessions est déclaré'],
                    ] as const).map(([key, label]) => (
                      <label key={key} className="flex min-h-11 cursor-pointer items-start gap-3 rounded-micro border border-white/10 p-3 text-sm text-neutral-200 outline-none focus-within:ring-2 focus-within:ring-brand-primary">
                        <input type="checkbox" className="mt-0.5 h-4 w-4 accent-brand-primary" checked={form[key]} onChange={(event) => updateForm(key, event.target.checked)} />
                        <span>{label}</span>
                      </label>
                    ))}
                  </div>
                  <div className="grid gap-4 sm:grid-cols-2">
                    <div className="space-y-2">
                      <Label htmlFor="transition-choice">Situation lors du passage depuis un établissement</Label>
                      <select id="transition-choice" className={selectClassName} value={form.brancheBascule} onChange={(event) => updateForm('brancheBascule', event.target.value)}>
                        <option value="">Non concerné</option>
                        <option value="CONSERVATION_MOYENNES_PREMIERE">Conservation des moyennes de Première déclarée</option>
                        <option value="RENONCIATION_MOYENNES_PREMIERE">Renonciation aux moyennes de Première déclarée</option>
                      </select>
                    </div>
                    <div className="space-y-2">
                      <Label htmlFor="retake-average">Moyenne déclarée avant second groupe</Label>
                      <Input id="retake-average" type="number" min="0" max="20" step="0.01" value={form.moyenneRattrapage} onChange={(event) => updateForm('moyenneRattrapage', event.target.value)} placeholder="Non concerné" />
                      <p className="text-xs text-neutral-500">Le second groupe reste hors de l&apos;offre commerciale V1.</p>
                    </div>
                  </div>
                </fieldset>

                <div className="grid gap-4 rounded-micro border border-white/10 bg-black/10 p-4 sm:grid-cols-2">
                  <div className="space-y-2">
                    <Label htmlFor="monthly-budget">Budget mensuel indicatif</Label>
                    <Input id="monthly-budget" type="number" min="1" value={budgetTnd} onChange={(event) => { setBudgetTnd(event.target.value); clearCommercialState(); }} />
                  </div>
                  <div className="space-y-2">
                    <Label htmlFor="recommendation-strategy">Priorité de la proposition</Label>
                    <select id="recommendation-strategy" className={selectClassName} value={strategy} onChange={(event) => { setStrategy(event.target.value); clearCommercialState(); }}>
                      <option value="RESPECT_BUDGET">Respecter le budget</option>
                      <option value="BEST_BALANCE">Rechercher le meilleur équilibre</option>
                      <option value="MOST_COMPLETE">Construire la proposition la plus complète</option>
                    </select>
                  </div>
                </div>

                <div className="flex flex-wrap justify-between gap-3">
                  <Button type="button" variant="outline" onClick={() => setStep(1)}>Retour</Button>
                  <div className="flex flex-wrap gap-2">
                    <Button type="button" variant="outline" onClick={saveDraft} disabled={busy != null || duplicateLanguages}>
                      {busy === 'save' && <Loader2 className="mr-2 h-4 w-4 animate-spin" aria-hidden="true" />} Enregistrer le brouillon
                    </Button>
                    <Button type="button" onClick={saveAndSimulate} disabled={busy != null || !identityComplete || duplicateLanguages}>
                      {busy === 'simulate' && <Loader2 className="mr-2 h-4 w-4 animate-spin" aria-hidden="true" />} Enregistrer et simuler
                    </Button>
                  </div>
                </div>
              </CardContent>
            </Card>
          )}

          {step === 3 && selectedScenario && (
            <Card className="border-white/10 bg-surface-card">
              <CardHeader className="border-b border-white/10">
                <p className="text-xs font-semibold uppercase tracking-[0.16em] text-brand-accent">Étape 3 sur 5</p>
                <CardTitle className="text-xl text-white">Besoins et accompagnements</CardTitle>
                <p className="text-sm text-neutral-300">La sélection et les prix de référence proviennent du moteur Nexus. Confirmez uniquement les effectifs réels.</p>
              </CardHeader>
              <CardContent className="space-y-5 pt-6">
                {readyScenarios.length > 1 && (
                  <div className="flex flex-wrap gap-2" role="group" aria-label="Niveau de proposition">
                    {readyScenarios.map((scenario) => (
                      <button key={scenario.tier} type="button" disabled={commercialControlsLocked} aria-describedby={commercialControlsLocked ? 'ambiguous-quote-explanation' : undefined} aria-pressed={selectedScenario.tier === scenario.tier} onClick={() => { setScenarioTier(scenario.tier); setHeadcountBySubject({}); setGroupChoiceBySubject({}); invalidateCreatedQuote(); }} className={`min-h-11 rounded-micro border px-4 text-sm font-medium outline-none focus-visible:ring-2 focus-visible:ring-brand-primary disabled:cursor-not-allowed disabled:opacity-50 ${selectedScenario.tier === scenario.tier ? 'border-brand-primary bg-brand-primary text-white' : 'border-white/15 text-neutral-300 hover:bg-surface-hover'}`}>
                        {scenario.tier === 'ESSENTIEL' ? 'Essentiel' : scenario.tier === 'RECOMMANDE' ? 'Recommandé' : 'Complet'}
                      </button>
                    ))}
                  </div>
                )}

                {hasDeferredLine && (
                  <div role="alert" className="rounded-micro border border-red-400/30 bg-red-400/10 p-4 text-sm text-red-100">
                    Cette option n&apos;est pas disponible dans l&apos;offre V1. La génération du devis reste bloquée.
                  </div>
                )}

                <div className="grid gap-4 md:grid-cols-2">
                  {visibleLines.map((line) => {
                    const requirement = groupRequirements.find((item) => item.subject === line.subject);
                    const headcount = headcountBySubject[line.subject];
                    const groupChosen = groupChoiceBySubject[line.subject] === true || (headcount != null && headcount >= 3);
                    return (
                      <article key={`${line.subject}-${line.label}`} aria-label={line.label} className="min-w-0 rounded-micro border border-white/10 bg-black/10 p-4">
                        <div className="flex items-start justify-between gap-3">
                          <div className="min-w-0">
                            <h3 className="text-base font-semibold text-white">{line.label}</h3>
                            <p className="mt-1 text-sm text-neutral-400">{line.reason}</p>
                          </div>
                          <Badge variant="outline" className="shrink-0">Recommandé</Badge>
                        </div>
                        <dl className="mt-4 grid grid-cols-2 gap-3 text-sm">
                          <div><dt className="text-xs text-neutral-500">Volume</dt><dd className="mt-1 text-neutral-100">{line.hoursPerMonth == null ? 'Suivi mensuel' : `${line.hoursPerMonth} h / mois`}</dd></div>
                          <div><dt className="text-xs text-neutral-500">Modalité prévue</dt><dd className="mt-1 text-neutral-100">{modalityLabel(line.modality)}</dd></div>
                          <div className="col-span-2"><dt className="text-xs text-neutral-500">Prix de référence</dt><dd className="mt-1 font-medium text-brand-accent">{formatTnd(line.unitPriceMonthly)} / mois</dd></div>
                        </dl>
                        {requirement && (
                          <div className="mt-4 border-t border-white/10 pt-4">
                            <p className="text-xs font-semibold uppercase tracking-wide text-neutral-400">Effectif confirmé</p>
                            <div className="mt-2 grid grid-cols-3 gap-2" role="group" aria-label={`Effectif confirmé - ${line.label}`}>
                              {([
                                ['INDIVIDUEL', 'Individuel'],
                                ['DUO', 'Duo'],
                                ['GROUPE', 'Petit groupe'],
                              ] as const).map(([choice, label]) => {
                                const pressed = choice === 'INDIVIDUEL' ? headcount === 1 : choice === 'DUO' ? headcount === 2 : groupChosen;
                                return <button key={choice} type="button" disabled={commercialControlsLocked} aria-describedby={commercialControlsLocked ? 'ambiguous-quote-explanation' : undefined} aria-pressed={pressed} onClick={() => chooseHeadcount(line.subject, choice)} className={`min-h-11 rounded-micro border px-2 text-xs font-medium outline-none focus-visible:ring-2 focus-visible:ring-brand-primary disabled:cursor-not-allowed disabled:opacity-50 ${pressed ? 'border-brand-primary bg-brand-primary text-white' : 'border-white/15 text-neutral-300 hover:bg-surface-hover'}`}>{label}</button>;
                              })}
                            </div>
                            {groupChosen && (
                              <div className="mt-3 space-y-2">
                                <Label htmlFor={`group-size-${line.subject}`}>Nombre exact d&apos;élèves confirmés</Label>
                                <Input id={`group-size-${line.subject}`} disabled={commercialControlsLocked} aria-describedby={commercialControlsLocked ? 'ambiguous-quote-explanation' : undefined} type="number" min="3" step="1" inputMode="numeric" value={headcount != null && headcount >= 3 ? headcount : ''} onChange={(event) => setGroupSize(line.subject, event.target.value)} placeholder="3 ou plus" />
                              </div>
                            )}
                          </div>
                        )}
                      </article>
                    );
                  })}
                </div>

                {groupRequirements.map((requirement) => {
                  const represented = visibleLines.some((line) => line.subject === requirement.subject);
                  if (represented) return null;
                  const label = requirementDisplayLabel(requirement.subject);
                  const headcount = headcountBySubject[requirement.subject];
                  const groupChosen = groupChoiceBySubject[requirement.subject] === true || (headcount != null && headcount >= 3);
                  return (
                    <article key={requirement.subject} aria-label={label} className="rounded-micro border border-white/10 bg-black/10 p-4">
                      <h3 className="font-semibold text-white">{label}</h3>
                      <p className="mt-1 text-sm text-neutral-400">Effectif requis pour le parcours combiné.</p>
                      <div className="mt-3 grid grid-cols-3 gap-2" role="group" aria-label={`Effectif confirmé - ${label}`}>
                        <button type="button" disabled={commercialControlsLocked} aria-describedby={commercialControlsLocked ? 'ambiguous-quote-explanation' : undefined} aria-pressed={headcount === 1} onClick={() => chooseHeadcount(requirement.subject, 'INDIVIDUEL')} className="min-h-11 rounded-micro border border-white/15 px-2 text-xs text-neutral-200 focus-visible:ring-2 focus-visible:ring-brand-primary disabled:cursor-not-allowed disabled:opacity-50">Individuel</button>
                        <button type="button" disabled={commercialControlsLocked} aria-describedby={commercialControlsLocked ? 'ambiguous-quote-explanation' : undefined} aria-pressed={headcount === 2} onClick={() => chooseHeadcount(requirement.subject, 'DUO')} className="min-h-11 rounded-micro border border-white/15 px-2 text-xs text-neutral-200 focus-visible:ring-2 focus-visible:ring-brand-primary disabled:cursor-not-allowed disabled:opacity-50">Duo</button>
                        <button type="button" disabled={commercialControlsLocked} aria-describedby={commercialControlsLocked ? 'ambiguous-quote-explanation' : undefined} aria-pressed={groupChosen} onClick={() => chooseHeadcount(requirement.subject, 'GROUPE')} className="min-h-11 rounded-micro border border-white/15 px-2 text-xs text-neutral-200 focus-visible:ring-2 focus-visible:ring-brand-primary disabled:cursor-not-allowed disabled:opacity-50">Petit groupe</button>
                      </div>
                      {groupChosen && <Input aria-label={`Nombre exact d'élèves - ${label}`} disabled={commercialControlsLocked} aria-describedby={commercialControlsLocked ? 'ambiguous-quote-explanation' : undefined} className="mt-3" type="number" min="3" step="1" value={headcount != null && headcount >= 3 ? headcount : ''} onChange={(event) => setGroupSize(requirement.subject, event.target.value)} />}
                    </article>
                  );
                })}

                {missingGroupRequirements.length > 0 && (
                  <div role="status" className="rounded-micro border border-amber-300/30 bg-amber-300/10 p-4 text-sm text-amber-100">
                    {missingGroupRequirements.map((requirement) => (
                      <p key={requirement.subject}>Le groupe de {requirementDisplayLabel(requirement.subject).toLowerCase()} n&apos;est pas encore confirmé.</p>
                    ))}
                  </div>
                )}

                <div className="flex flex-wrap justify-between gap-3">
                  <Button type="button" variant="outline" onClick={() => setStep(2)} disabled={commercialControlsLocked} aria-describedby={commercialControlsLocked ? 'ambiguous-quote-explanation' : undefined}>Modifier le profil</Button>
                  <Button type="button" onClick={() => setStep(4)} disabled={groupHeadcountBlocking || hasDeferredLine}>
                    Voir la proposition financière <ChevronRight className="ml-2 h-4 w-4" aria-hidden="true" />
                  </Button>
                </div>
              </CardContent>
            </Card>
          )}

          {step === 4 && selectedScenario && (
            <Card className="border-white/10 bg-surface-card">
              <CardHeader className="border-b border-white/10">
                <p className="text-xs font-semibold uppercase tracking-[0.16em] text-brand-accent">Étape 4 sur 5</p>
                <CardTitle className="text-xl text-white">Proposition financière</CardTitle>
                <p className="text-sm text-neutral-300">Les montants affichés proviennent exclusivement du serveur.</p>
              </CardHeader>
              <CardContent className="space-y-6 pt-6">
                {needsAuthoritativeReprice && !createdQuote ? (
                  <div className="rounded-micro border border-sky-300/25 bg-sky-300/10 p-5 text-center">
                    <p className="text-sm font-medium text-sky-100">À recalculer par le serveur</p>
                    <p className="mt-2 text-sm text-neutral-300">Le choix Individuel ou Duo modifie le tarif. Générez le devis pour obtenir les montants définitifs.</p>
                  </div>
                ) : (
                  <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
                    {[
                      ['Total annuel', formatTnd(createdQuote?.totals.annualTnd ?? selectedScenario.grandTotal)],
                      ['Acompte', formatTnd(createdQuote?.totals.depositTnd ?? selectedScenario.deposit)],
                      ['Mensualité', formatTnd(createdQuote?.totals.installmentTnd ?? selectedScenario.monthlyTotal)],
                      ['Nombre de mensualités', String(createdQuote?.totals.installmentCount ?? selectedScenario.months)],
                    ].map(([label, value]) => (
                      <div key={label} className="rounded-micro border border-white/10 bg-black/10 p-4">
                        <p className="text-xs uppercase tracking-wide text-neutral-500">{label}</p>
                        <p className="mt-2 text-xl font-semibold text-white">{value}</p>
                      </div>
                    ))}
                  </div>
                )}

                <div className="overflow-hidden rounded-micro border border-white/10">
                  <div className="grid grid-cols-[minmax(0,1fr)_auto] gap-3 bg-black/20 px-4 py-3 text-xs font-semibold uppercase tracking-wide text-neutral-400">
                    <span>Accompagnement</span><span>Référence serveur</span>
                  </div>
                  {visibleLines.map((line) => (
                    <div key={`${line.subject}-${line.label}`} className="grid grid-cols-[minmax(0,1fr)_auto] gap-3 border-t border-white/10 px-4 py-3 text-sm">
                      <span className="min-w-0 text-neutral-200">{line.label} <span className="text-neutral-500">· {modalityLabel(line.modality)}</span></span>
                      <span className="font-medium text-white">{formatTnd(line.unitPriceMonthly)} / mois</span>
                    </div>
                  ))}
                </div>

                {!currentAmbiguousAttempt && marginReview && (
                  <div className={`rounded-micro border p-4 ${marginReview.canOverride ? 'border-amber-300/30 bg-amber-300/10' : 'border-red-400/30 bg-red-400/10'}`}>
                    <div className="flex flex-wrap items-center justify-between gap-2">
                      <p className={`font-medium ${marginReview.canOverride ? 'text-amber-100' : 'text-red-100'}`}>{marginReview.statusLabel}</p>
                      <p className="text-lg font-semibold text-white">{marginReview.percentage} %</p>
                    </div>
                    {marginReview.canOverride ? (
                      <div className="mt-4 space-y-3">
                        <div className="space-y-2">
                          <Label htmlFor="margin-override-reason">Motif de validation de la marge</Label>
                          <Textarea id="margin-override-reason" value={marginOverrideReason} onChange={(event) => setMarginOverrideReason(event.target.value)} placeholder="Décision et justification commerciale" />
                        </div>
                        <Button type="button" onClick={() => void createDraftQuote(marginOverrideReason.trim())} disabled={busy != null || marginOverrideReason.trim().length === 0}>Valider la marge et générer</Button>
                      </div>
                    ) : (
                      <p className="mt-2 text-sm text-red-100">Cette proposition ne peut pas être validée. Ajustez les accompagnements ou le format.</p>
                    )}
                  </div>
                )}

                {!currentAmbiguousAttempt && <div className="flex flex-wrap justify-between gap-3">
                  <Button type="button" variant="outline" onClick={() => setStep(3)}>Modifier les accompagnements</Button>
                  <div className="flex flex-wrap gap-2">
                    <Button type="button" variant="outline" onClick={saveAndSimulate} disabled={busy != null}>
                      <RefreshCw className="mr-2 h-4 w-4" aria-hidden="true" /> Mettre à jour la simulation
                    </Button>
                    {!hasCurrentCreatedQuote && (
                      <Button type="button" onClick={() => void createDraftQuote()} disabled={busy != null || groupHeadcountBlocking || hasDeferredLine}>
                        <FileText className="mr-2 h-4 w-4" aria-hidden="true" /> Générer le devis
                      </Button>
                    )}
                  </div>
                </div>}
              </CardContent>
            </Card>
          )}

          {step === 5 && createdQuote && (
            <Card className="border-white/10 bg-surface-card">
              <CardHeader className="border-b border-white/10">
                <p className="text-xs font-semibold uppercase tracking-[0.16em] text-brand-accent">Étape 5 sur 5</p>
                <CardTitle className="text-xl text-white">Synthèse du devis</CardTitle>
                <p className="text-sm text-neutral-300">Relisez la proposition avant toute publication à la famille.</p>
              </CardHeader>
              <CardContent className="space-y-6 pt-6">
                <div className="grid gap-4 sm:grid-cols-2">
                  <div className="rounded-micro border border-white/10 p-4">
                    <p className="text-xs uppercase tracking-wide text-neutral-500">Responsable</p>
                    <p className="mt-2 font-medium text-white">{selectedLead?.name}</p>
                    <p className="text-sm text-neutral-400">{selectedLead?.email}</p>
                  </div>
                  <div className="rounded-micro border border-white/10 p-4">
                    <p className="text-xs uppercase tracking-wide text-neutral-500">Élève</p>
                    <p className="mt-2 font-medium text-white">{selectedStudent ? studentDisplayName(selectedStudent.user) : ''}</p>
                    <p className="text-sm text-neutral-400">{form.level === 'PREMIERE' ? 'Première' : 'Terminale'} · session {form.examSession}</p>
                  </div>
                </div>

                <div className="overflow-hidden rounded-micro border border-white/10" role="region" aria-label="Lignes du devis serveur">
                  {createdQuote.lines.map((line, index) => (
                    <div key={`${line.subject}-${index}`} className="flex flex-col gap-1 border-b border-white/10 px-4 py-3 last:border-b-0 sm:flex-row sm:items-center sm:justify-between">
                      <div>
                        <p className="font-medium text-white">{line.subject}</p>
                        <p className="flex flex-wrap gap-x-1 text-xs text-neutral-400">
                          <span>{line.modality}</span>
                          {line.hoursPerMonth != null && <span>· {line.hoursPerMonth} h / mois</span>}
                        </p>
                      </div>
                      <p className="text-sm font-medium text-brand-accent">{`${formatTnd(line.monthlyAmountTnd)} / mois`}</p>
                    </div>
                  ))}
                </div>

                <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
                  <div><p className="text-xs text-neutral-500">Total annuel</p><p className="mt-1 text-lg font-semibold text-white">{formatTnd(createdQuote.totals.annualTnd)}</p></div>
                  <div><p className="text-xs text-neutral-500">Acompte</p><p className="mt-1 text-lg font-semibold text-white">{formatTnd(createdQuote.totals.depositTnd)}</p></div>
                  <div><p className="text-xs text-neutral-500">Mensualité</p><p className="mt-1 text-lg font-semibold text-white">{formatTnd(createdQuote.totals.installmentTnd)}</p></div>
                  <div><p className="text-xs text-neutral-500">Échéancier</p><p className="mt-1 text-lg font-semibold text-white">{createdQuote.totals.installmentCount} mensualités</p></div>
                </div>

                {staffMargin && (
                  <div className="w-fit rounded-full border border-emerald-400/30 bg-emerald-400/10 px-3 py-1.5 text-xs font-medium text-emerald-100">
                    <ShieldCheck className="mr-1.5 inline h-3.5 w-3.5" aria-hidden="true" />
                    <span>{staffMargin.statusLabel}</span> · <span>{staffMargin.percentage} %</span>
                  </div>
                )}

                <div className="flex flex-wrap gap-2">
                  {createdQuote.actions.canDownloadPdf && <a href={`/api/assistante/candidat-individuel/quotes/${createdQuote.id}/pdf`} className="inline-flex min-h-11 items-center justify-center rounded-micro border border-white/15 px-4 text-sm font-medium text-white outline-none hover:bg-surface-hover focus-visible:ring-2 focus-visible:ring-brand-primary">
                    <Download className="mr-2 h-4 w-4" aria-hidden="true" /> Télécharger le PDF
                  </a>}
                  {createdQuote.actions.canPublish && identityComplete && (
                    <Button type="button" onClick={publishQuote} disabled={busy != null}>
                      {busy === 'publish' ? <Loader2 className="mr-2 h-4 w-4 animate-spin" aria-hidden="true" /> : <ClipboardCheck className="mr-2 h-4 w-4" aria-hidden="true" />} Valider et publier
                    </Button>
                  )}
                  {createdQuote.actions.canIssueFamilyLink && (
                    <Button type="button" onClick={issueFamilyLink} disabled={busy != null}>
                      {busy === 'family-link' ? <Loader2 className="mr-2 h-4 w-4 animate-spin" aria-hidden="true" /> : <Link2 className="mr-2 h-4 w-4" aria-hidden="true" />} {familyLink || createdQuote.actions.canRotateFamilyLink ? 'Renouveler le lien famille' : 'Créer le lien famille'}
                    </Button>
                  )}
                  {createdQuote.actions.canCreateRevision && <Button type="button" variant="outline" onClick={createRevision} disabled={busy != null}>Créer une révision</Button>}
                </div>

                {createdQuote.actions.hasFamilyLink && !familyLink && (
                  <p className="rounded-micro border border-amber-300/25 bg-amber-300/10 p-3 text-sm text-amber-100">
                    Le lien existant n&apos;est pas réaffichable pour des raisons de sécurité. Renouvelez-le uniquement si la famille a besoin d&apos;un nouveau lien.
                  </p>
                )}

                {familyLink && (
                  <div className="rounded-micro border border-emerald-400/25 bg-emerald-400/10 p-4">
                    <Label htmlFor="family-link">Lien famille sécurisé</Label>
                    <div className="mt-2 flex flex-col gap-2 sm:flex-row">
                      <Input id="family-link" readOnly value={familyLink.url} onFocus={(event) => event.currentTarget.select()} className="min-w-0 flex-1" />
                      <Button type="button" variant="outline" onClick={copyFamilyLink}>{familyLinkCopied ? 'Lien copié' : 'Copier le lien'}</Button>
                    </div>
                    <p className="mt-2 text-xs text-amber-100">Le renouvellement invalide immédiatement le lien précédent.</p>
                  </div>
                )}
              </CardContent>
            </Card>
          )}

          {currentResultMessage && (
            <div role="alert" className="rounded-micro border border-amber-300/30 bg-amber-300/10 p-4 text-sm text-amber-100">
              <p>{currentResultMessage}</p>
              {profileId && result?.status === 'HUMAN_REVIEW_REQUIRED' && <Button type="button" size="sm" variant="outline" className="mt-3" onClick={requestReview} disabled={busy != null}>Demander une revue</Button>}
            </div>
          )}

          {error && <div role="alert" className="rounded-micro border border-red-400/30 bg-red-400/10 p-4 text-sm text-red-100">{error}</div>}
          {notice && <div role="status" className="rounded-micro border border-emerald-400/30 bg-emerald-400/10 p-4 text-sm text-emerald-100">{notice}</div>}

          <details className="rounded-micro border border-white/10 bg-surface-card">
            <summary className="min-h-11 cursor-pointer px-4 py-3 text-sm font-medium text-neutral-200 outline-none focus-visible:ring-2 focus-visible:ring-brand-primary">Options avancées</summary>
            <div className="space-y-4 border-t border-white/10 p-4">
              <p className="text-xs leading-5 text-neutral-400">Réservé au support Nexus. Ces données ne sont jamais affichées à la famille.</p>
              <div className="space-y-2"><Label htmlFor="advanced-notes">Notes conservées</Label><Textarea id="advanced-notes" disabled={commercialControlsLocked} aria-describedby={commercialControlsLocked ? 'ambiguous-quote-explanation' : undefined} className="font-mono text-xs" value={notesText} onChange={(event) => { setNotesText(event.target.value); clearCommercialState(); }} /></div>
              <div className="space-y-2"><Label htmlFor="advanced-dispensations">Dispenses déclarées</Label><Textarea id="advanced-dispensations" disabled={commercialControlsLocked} aria-describedby={commercialControlsLocked ? 'ambiguous-quote-explanation' : undefined} className="font-mono text-xs" value={dispensesText} onChange={(event) => { setDispensesText(event.target.value); clearCommercialState(); }} /></div>
              <div className="space-y-2"><Label htmlFor="advanced-p3">Vérifications du parcours accéléré</Label><Textarea id="advanced-p3" disabled={commercialControlsLocked} aria-describedby={commercialControlsLocked ? 'ambiguous-quote-explanation' : undefined} className="font-mono text-xs" value={p3AuditText} onChange={(event) => { setP3AuditText(event.target.value); clearCommercialState(); }} /></div>
              <div className="space-y-2"><Label htmlFor="advanced-diagnostic">Diagnostic pédagogique brut</Label><Textarea id="advanced-diagnostic" disabled={commercialControlsLocked} aria-describedby={commercialControlsLocked ? 'ambiguous-quote-explanation' : undefined} className="font-mono text-xs" value={diagnosticText} onChange={(event) => { setDiagnosticText(event.target.value); clearCommercialState(); }} placeholder='{"mathematiques":{"points":12,"maxPoints":20,"percentage":60}}' /></div>
            </div>
          </details>
        </main>

        <aside className="space-y-4 xl:sticky xl:top-20" aria-label="Résumé du dossier">
          <Card className="border-white/10 bg-surface-card">
            <CardHeader className="flex flex-row items-center justify-between border-b border-white/10">
              <CardTitle className="text-base text-white">Résumé du dossier</CardTitle>
              <Button type="button" size="sm" variant="ghost" onClick={newProfile}>Nouveau</Button>
            </CardHeader>
            <CardContent className="space-y-4 pt-4 text-sm">
              <div><p className="text-xs uppercase tracking-wide text-neutral-500">Responsable</p><p className="mt-1 text-neutral-100">{selectedLead?.name ?? 'À sélectionner'}</p></div>
              <div><p className="text-xs uppercase tracking-wide text-neutral-500">Élève</p><p className="mt-1 text-neutral-100">{selectedStudent ? studentDisplayName(selectedStudent.user) : 'À sélectionner'}</p></div>
              <div><p className="text-xs uppercase tracking-wide text-neutral-500">Profil</p><p className="mt-1 text-neutral-100">{form.level === 'PREMIERE' ? 'Première' : 'Terminale'} · session {form.examSession}</p></div>
              {selectedScenario && <div><p className="text-xs uppercase tracking-wide text-neutral-500">Proposition</p><p className="mt-1 text-neutral-100">{selectedScenario.tier === 'RECOMMANDE' ? 'Recommandée' : selectedScenario.tier === 'ESSENTIEL' ? 'Essentielle' : 'Complète'} · {visibleLines.length} accompagnement(s)</p></div>}
              {createdQuote && <div className="rounded-micro border border-emerald-400/20 bg-emerald-400/10 p-3"><p className="text-xs uppercase tracking-wide text-emerald-200">Total annuel</p><p className="mt-1 text-xl font-semibold text-white">{formatTnd(createdQuote.totals.annualTnd)}</p></div>}
            </CardContent>
          </Card>

          <details className="rounded-micro border border-white/10 bg-surface-card">
            <summary className="min-h-11 cursor-pointer px-4 py-3 text-sm font-medium text-neutral-200 outline-none focus-visible:ring-2 focus-visible:ring-brand-primary">Dossiers récents</summary>
            <div className="space-y-2 border-t border-white/10 p-3">
              {drafts.length === 0 && <p className="text-xs text-neutral-400">Aucun dossier enregistré.</p>}
              {drafts.map((draft) => (
                <button key={draft.id} type="button" onClick={() => void loadDraft(draft.id)} className="min-h-11 w-full rounded-micro border border-white/10 px-3 py-2 text-left text-xs text-neutral-300 outline-none hover:bg-surface-hover focus-visible:ring-2 focus-visible:ring-brand-primary">
                  <span className="block font-medium text-white">{draft.student ? studentDisplayName(draft.student.user) : 'Candidat à rattacher'}</span>
                  <span>{draft.level === 'PREMIERE' ? 'Première' : 'Terminale'} · session {draft.examSession}{draft.revisionNumber && draft.revisionNumber > 1 ? ` · Révision ${draft.revisionNumber}` : ''}</span>
                </button>
              ))}
            </div>
          </details>
        </aside>
      </div>
    </div>
  );
}
