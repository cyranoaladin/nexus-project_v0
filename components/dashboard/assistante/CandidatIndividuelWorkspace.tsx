'use client';

/**
 * Internal workspace surface for the new carte-aware candidat-individuel
 * pipeline (mission recâblage §5). Deliberately a working tool, not a
 * polished public wizard: JSON textareas stand in for the staff-extension
 * arrays (notesConservees/dispensesDeclarees/p3EligibiliteAudit) and the
 * diagnostic input rather than a fully bespoke dynamic form — these are
 * genuinely nested, staff-authored structures, and this surface is never
 * seen by a family.
 *
 * A simulation is ALWAYS a non-contractual estimation. A READY simulation
 * can be turned into a DRAFT Quote (mission "vers un produit complet" §4,
 * POST .../profils/:id/quote) — but that draft is never a "devis
 * définitif": it's created with the same fail-closed regulatoryMaturity
 * default every other Quote gets, so the existing send/accept emission
 * guard (lib/quotes/emission-guard.ts, unchanged) keeps blocking it until
 * a separate staff review promotes it — not built by this workspace, and
 * sending/accepting a quote stays the existing /api/quotes flow, reused
 * rather than duplicated here. The result banner makes the distinction
 * explicit for every pipeline status: estimation / revue réglementaire /
 * blocage réglementaire / blocage commercial / devis brouillon.
 */
import { useEffect, useRef, useState } from 'react';
import type { ProfilCandidat, Subject } from '@prisma/client';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Label } from '@/components/ui/label';
import { Input } from '@/components/ui/input';
import { Textarea } from '@/components/ui/textarea';
import { Checkbox } from '@/components/ui/checkbox';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Loader2 } from 'lucide-react';
import type { ContactLeadSearchResult } from '@/lib/quotes/persistence.server';
import type { ProfilCandidatIdentity } from '@/lib/quotes/profil-candidat.server';
import { SPECIALITE_ABANDONNEE_WARNING } from '@/lib/quotes/pricing';

/**
 * T5R5 §FINDING_11 — the student-search primitive already backing
 * app/api/assistante/students?search= (built for the students-management
 * page, not quote-specific, but directly reusable here — "ne crée pas une
 * deuxième base de leads/élèves"). Only the fields this workspace needs.
 */
interface StudentSearchResult {
  id: string;
  user: { firstName: string | null; lastName: string | null; email: string | null };
}

function studentDisplayName(user: { firstName: string | null; lastName: string | null }): string {
  return [user.firstName, user.lastName].filter(Boolean).join(' ') || 'Élève sans nom';
}

const SUBJECT_OPTIONS: { value: Subject; label: string }[] = [
  { value: 'MATHEMATIQUES', label: 'Mathématiques' },
  { value: 'MATHS_EXPERTES', label: 'Maths expertes' },
  { value: 'NSI', label: 'NSI' },
  { value: 'FRANCAIS', label: 'Français' },
  { value: 'PHILOSOPHIE', label: 'Philosophie' },
  { value: 'HISTOIRE_GEO', label: 'Histoire-Géographie' },
  { value: 'ANGLAIS', label: 'Anglais' },
  { value: 'ESPAGNOL', label: 'Espagnol' },
  { value: 'PHYSIQUE_CHIMIE', label: 'Physique-Chimie' },
  { value: 'SVT', label: 'SVT' },
  { value: 'SES', label: 'SES' },
];

const RESULT_BADGE: Record<string, { label: string; variant: 'success' | 'destructive' | 'warning' | 'outline'; distinction: string }> = {
  INVALID: { label: 'Entrée invalide', variant: 'destructive', distinction: "Saisie incomplète ou incohérente — pas encore une décision réglementaire." },
  NOT_ELIGIBLE: { label: 'Non éligible', variant: 'destructive', distinction: 'Blocage réglementaire — carte réglementaire refusée.' },
  HUMAN_REVIEW_REQUIRED: { label: 'Revue réglementaire requise', variant: 'warning', distinction: 'Blocage réglementaire — une vérification humaine est nécessaire avant toute émission.' },
  DIRECTION_APPROVAL_REQUIRED: { label: 'Arbitrage direction requis', variant: 'warning', distinction: 'Blocage commercial — module(s) en attente de décision direction (mission §7/§8).' },
  UNPRICED: { label: 'Non tarifable', variant: 'warning', distinction: 'Blocage commercial — sélection non chiffrable en l’état.' },
  PROVISIONAL: { label: 'Provisoire', variant: 'warning', distinction: 'État réservé, non atteint aujourd’hui par le moteur.' },
  READY: { label: 'Estimation (simulation)', variant: 'success', distinction: "Estimation non contractuelle. Un brouillon de devis peut être créé ci-dessous — il reste provisoire (envoi/acceptation bloqués par le garde-fou existant) jusqu'à une revue explicite, jamais un devis définitif automatique." },
};

interface FormState {
  level: string;
  examSession: string;
  modalite: string;
  specialite1: string;
  specialite2: string;
  specialiteAbandonnee: string;
  langueA: string;
  langueB: string;
  optionsTerminale: string;
  estRedoublant: boolean;
  estTitulaireBacDejaObtenu: boolean;
  changementSpecialite: boolean;
  intentionAmelioration: boolean;
  intentionCycleComplet: boolean;
  moyenneRattrapage: string;
  etalementPlurisessionsDeclare: boolean;
  brancheBascule: string;
}

const EMPTY_FORM: FormState = {
  level: 'TERMINALE',
  examSession: '2027',
  modalite: 'A',
  specialite1: '',
  specialite2: '',
  specialiteAbandonnee: '',
  langueA: '',
  langueB: '',
  optionsTerminale: '',
  estRedoublant: false,
  estTitulaireBacDejaObtenu: false,
  changementSpecialite: false,
  intentionAmelioration: false,
  intentionCycleComplet: true,
  moyenneRattrapage: '',
  etalementPlurisessionsDeclare: false,
  brancheBascule: '',
};

function formToPublicInput(f: FormState) {
  return {
    level: f.level || null,
    examSession: f.examSession ? Number(f.examSession) : null,
    modalite: f.modalite || null,
    specialite1: f.specialite1 || null,
    specialite2: f.specialite2 || null,
    specialiteAbandonnee: f.specialiteAbandonnee || null,
    langueA: f.langueA || null,
    langueB: f.langueB || null,
    optionsTerminale: f.optionsTerminale
      .split(',')
      .map((s) => s.trim())
      .filter(Boolean),
    estRedoublant: f.estRedoublant,
    estTitulaireBacDejaObtenu: f.estTitulaireBacDejaObtenu,
    changementSpecialite: f.changementSpecialite,
    intentionAmelioration: f.intentionAmelioration,
    intentionCycleComplet: f.intentionCycleComplet,
    moyenneRattrapage: f.moyenneRattrapage ? Number(f.moyenneRattrapage) : null,
    etalementPlurisessionsDeclare: f.etalementPlurisessionsDeclare,
    brancheBascule: f.brancheBascule || null,
  };
}

function profilToForm(p: ProfilCandidat): FormState {
  return {
    level: p.level,
    examSession: String(p.examSession),
    modalite: p.modalite,
    specialite1: p.specialite1,
    specialite2: p.specialite2,
    specialiteAbandonnee: p.specialiteAbandonnee ?? '',
    langueA: p.langueA ?? '',
    langueB: p.langueB ?? '',
    optionsTerminale: (p.optionsTerminale ?? []).join(', '),
    estRedoublant: p.estRedoublant,
    estTitulaireBacDejaObtenu: p.estTitulaireBacDejaObtenu,
    changementSpecialite: p.changementSpecialite,
    intentionAmelioration: p.intentionAmelioration,
    intentionCycleComplet: p.intentionCycleComplet,
    moyenneRattrapage: p.moyenneRattrapage != null ? String(p.moyenneRattrapage) : '',
    etalementPlurisessionsDeclare: p.etalementPlurisessionsDeclare,
    brancheBascule: p.brancheBascule ?? '',
  };
}

// eslint-disable-next-line @typescript-eslint/no-explicit-any
type PipelineResult = any;

/** T3A — the subset of a RecommendedLine (lib/quotes/schemas.ts) this workspace needs for the headcount UI. */
interface ScenarioLineView {
  subject: string;
  label: string;
  modality: string;
  unitPriceMonthly: number;
  reason: string;
}

interface HeadcountFieldState {
  subject: string;
  label: string;
  raw: string;
  /** null while missing or invalid — never a fabricated default. */
  parsed: number | null;
  missing: boolean;
  invalid: boolean;
}

/**
 * T3A §4 — mirrors lib/quotes/pricing-engine.ts's own validation
 * (InvalidConfirmedHeadcountError: positive integer only) so the staff UI
 * rejects the same inputs the API would reject, before ever calling it —
 * never a second, looser notion of "valid".
 */
function parseConfirmedHeadcount(raw: string): number | null {
  const n = Number(raw);
  if (!Number.isFinite(n) || !Number.isInteger(n) || n <= 0) return null;
  return n;
}

/**
 * T3A discovery (real browser E2E, not this lot's own concern otherwise):
 * `crypto.randomUUID()` is only defined in a secure context (HTTPS, or the
 * literal hostname "localhost") — throwing a real, silent TypeError on any
 * plain-HTTP origin (an internal-only staff tool is exactly the kind of
 * surface that can be reached that way). idempotencyKey only needs to be
 * an opaque, sufficiently unique string (createQuoteFromProfilBodySchema:
 * min 8, max 200 chars) — never parsed as an actual UUID anywhere — so a
 * non-cryptographic fallback is a correct, narrowly-scoped substitute, not
 * a second identity scheme.
 */
function generateIdempotencyKey(): string {
  if (typeof crypto !== 'undefined' && typeof crypto.randomUUID === 'function') return crypto.randomUUID();
  return `${Date.now().toString(36)}-${Math.random().toString(36).slice(2)}`;
}

export function CandidatIndividuelWorkspace() {
  const [drafts, setDrafts] = useState<ProfilCandidat[]>([]);
  const [profilId, setProfilId] = useState<string | null>(null);
  const [form, setForm] = useState<FormState>(EMPTY_FORM);
  const [notesConserveesText, setNotesConserveesText] = useState('[]');
  const [dispensesDeclareesText, setDispensesDeclareesText] = useState('[]');
  const [p3AuditText, setP3AuditText] = useState('[]');
  const [budgetTnd, setBudgetTnd] = useState('2000');
  const [strategy, setStrategy] = useState('MOST_COMPLETE');
  const [diagnosticText, setDiagnosticText] = useState('');

  // T5R5 §FINDING_11 — Responsable (ContactLead) search, mirrors
  // DevisWorkspace.tsx's existing typeahead exactly (same backend route,
  // same debounce). "NE crée pas une deuxième base de leads/élèves."
  const [leadQuery, setLeadQuery] = useState('');
  const [leadResults, setLeadResults] = useState<ContactLeadSearchResult[]>([]);
  const [leadSearching, setLeadSearching] = useState(false);
  const [selectedLead, setSelectedLead] = useState<ContactLeadSearchResult | null>(null);
  const [manualLeadId, setManualLeadId] = useState('');
  const [useManualLeadId, setUseManualLeadId] = useState(false);
  const leadDebounceRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  // Élève (Student) search — new widget, but backed by the EXISTING
  // GET /api/assistante/students?search= route (built for the students-
  // management page), never a new lead/student table.
  const [studentQuery, setStudentQuery] = useState('');
  const [studentResults, setStudentResults] = useState<StudentSearchResult[]>([]);
  const [studentSearching, setStudentSearching] = useState(false);
  const [selectedStudent, setSelectedStudent] = useState<StudentSearchResult | null>(null);
  const [manualStudentId, setManualStudentId] = useState('');
  const [useManualStudentId, setUseManualStudentId] = useState(false);
  const studentDebounceRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  const [result, setResult] = useState<PipelineResult | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState<'save' | 'simulate' | 'review' | 'revision' | 'quote' | 'publish' | 'family-link' | null>(null);
  const [scenarioTier, setScenarioTier] = useState('RECOMMANDE');
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const [createdQuote, setCreatedQuote] = useState<any>(null);
  // T5R2 — the family link is a session-only staff artifact: the raw
  // token is never persisted server-side (only its hash is), so it
  // cannot be reloaded after a refresh. copied resets whenever a new
  // link is (re)generated.
  const [familyLink, setFamilyLink] = useState<{ url: string; action: 'LINK_ISSUED' | 'LINK_ROTATED' } | null>(null);
  const [familyLinkCopied, setFamilyLinkCopied] = useState(false);
  // T3A — raw per-subject headcount text, keyed by RecommendedLine.subject
  // (the same stable key T2's confirmedHeadcountBySubject expects). Raw
  // text (not number) so an empty field is distinguishable from "0" —
  // never defaulted, never presumed to be 3.
  const [groupHeadcountBySubject, setGroupHeadcountBySubject] = useState<Record<string, string>>({});

  const contactLeadId = useManualLeadId ? manualLeadId.trim() : (selectedLead?.id ?? '');
  const studentId = useManualStudentId ? manualStudentId.trim() : (selectedStudent?.id ?? '');
  // T5R5 §FINDING_11 invariant: family-visible Quote ⇒ student identity
  // present AND responsible/contact identity present. The server (T5R
  // guards, lib/quotes/emission-guard.ts) is the actual enforcement point
  // — this is only the staff-facing signal so the gap is visible before
  // attempting to create a Quote, not a second, looser notion of "valid".
  const identityComplete = contactLeadId.length > 0 && studentId.length > 0;

  const loadDrafts = () => {
    fetch('/api/assistante/candidat-individuel/profils')
      .then((r) => r.json())
      .then((data) => setDrafts(data.profils ?? []))
      .catch(() => setDrafts([]));
  };

  // Debounced Responsable (ContactLead) search — identical to
  // DevisWorkspace.tsx's own (300ms, 2+ chars, same route).
  useEffect(() => {
    if (leadDebounceRef.current) clearTimeout(leadDebounceRef.current);
    if (useManualLeadId || leadQuery.trim().length < 2) {
      setLeadResults([]);
      return;
    }
    leadDebounceRef.current = setTimeout(async () => {
      setLeadSearching(true);
      try {
        const res = await fetch(`/api/quotes/leads/search?q=${encodeURIComponent(leadQuery.trim())}`);
        if (res.ok) {
          const json = await res.json();
          setLeadResults(json.leads as ContactLeadSearchResult[]);
        } else {
          setLeadResults([]);
        }
      } catch {
        setLeadResults([]);
      } finally {
        setLeadSearching(false);
      }
    }, 300);
    return () => {
      if (leadDebounceRef.current) clearTimeout(leadDebounceRef.current);
    };
  }, [leadQuery, useManualLeadId]);

  // Debounced Élève (Student) search — same shape, backed by the existing
  // GET /api/assistante/students?search= route.
  useEffect(() => {
    if (studentDebounceRef.current) clearTimeout(studentDebounceRef.current);
    if (useManualStudentId || studentQuery.trim().length < 2) {
      setStudentResults([]);
      return;
    }
    studentDebounceRef.current = setTimeout(async () => {
      setStudentSearching(true);
      try {
        const res = await fetch(`/api/assistante/students?search=${encodeURIComponent(studentQuery.trim())}&limit=10`);
        if (res.ok) {
          const json = await res.json();
          setStudentResults((json.students ?? []) as StudentSearchResult[]);
        } else {
          setStudentResults([]);
        }
      } catch {
        setStudentResults([]);
      } finally {
        setStudentSearching(false);
      }
    }, 300);
    return () => {
      if (studentDebounceRef.current) clearTimeout(studentDebounceRef.current);
    };
  }, [studentQuery, useManualStudentId]);

  function handleSelectLead(lead: ContactLeadSearchResult) {
    setSelectedLead(lead);
    setLeadQuery('');
    setLeadResults([]);
  }

  function handleClearLead() {
    setSelectedLead(null);
    setManualLeadId('');
  }

  function handleSelectStudent(student: StudentSearchResult) {
    setSelectedStudent(student);
    setStudentQuery('');
    setStudentResults([]);
  }

  function handleClearStudent() {
    setSelectedStudent(null);
    setManualStudentId('');
  }

  useEffect(() => {
    loadDrafts();
  }, []);

  function parseJsonField(text: string, label: string): { ok: true; value: unknown[] } | { ok: false; error: string } {
    if (!text.trim()) return { ok: true, value: [] };
    try {
      const parsed = JSON.parse(text);
      if (!Array.isArray(parsed)) return { ok: false, error: `${label} doit être un tableau JSON.` };
      return { ok: true, value: parsed };
    } catch {
      return { ok: false, error: `${label} : JSON invalide.` };
    }
  }

  function buildStaffExtension(): { ok: true; value: Record<string, unknown> } | { ok: false; error: string } {
    const notes = parseJsonField(notesConserveesText, 'notesConservees');
    if (!notes.ok) return notes;
    const dispenses = parseJsonField(dispensesDeclareesText, 'dispensesDeclarees');
    if (!dispenses.ok) return dispenses;
    const p3 = parseJsonField(p3AuditText, 'p3EligibiliteAudit');
    if (!p3.ok) return p3;
    return { ok: true, value: { notesConservees: notes.value, dispensesDeclarees: dispenses.value, p3EligibiliteAudit: p3.value } };
  }

  async function loadDraft(id: string) {
    setError(null);
    const res = await fetch(`/api/assistante/candidat-individuel/profils/${id}`);
    if (!res.ok) {
      setError('Impossible de charger ce brouillon.');
      return;
    }
    const data = await res.json();
    const p: ProfilCandidat & ProfilCandidatIdentity = data.profil;
    setProfilId(p.id);
    setForm(profilToForm(p));
    setNotesConserveesText(JSON.stringify(p.notesConservees ?? [], null, 2));
    setDispensesDeclareesText(JSON.stringify(p.dispensesDeclarees ?? [], null, 2));
    setP3AuditText(JSON.stringify(p.p3EligibiliteAudit ?? [], null, 2));
    setResult(null);
    setCreatedQuote(null);
    setGroupHeadcountBySubject({});
    // T5R5 §FINDING_11 — resuming a draft restores its already-attached
    // identity (if any) so "Élève"/"Responsable" stay visible, never blank
    // just because the page was reloaded.
    setUseManualLeadId(false);
    setUseManualStudentId(false);
    setLeadQuery('');
    setStudentQuery('');
    setSelectedLead(p.contactLead ? { id: p.contactLead.id, name: p.contactLead.name, email: p.contactLead.email, phone: p.contactLead.phone, status: p.contactLead.status } : null);
    setSelectedStudent(p.student ? { id: p.student.id, user: p.student.user } : null);
  }

  function newDraft() {
    setProfilId(null);
    setForm(EMPTY_FORM);
    setNotesConserveesText('[]');
    setDispensesDeclareesText('[]');
    setP3AuditText('[]');
    setResult(null);
    setCreatedQuote(null);
    setError(null);
    setGroupHeadcountBySubject({});
    setUseManualLeadId(false);
    setUseManualStudentId(false);
    setLeadQuery('');
    setStudentQuery('');
    handleClearLead();
    handleClearStudent();
  }

  async function saveDraft() {
    setError(null);
    const staffExtension = buildStaffExtension();
    if (!staffExtension.ok) {
      setError(staffExtension.error);
      return;
    }
    setBusy('save');
    try {
      const body = JSON.stringify({
        publicInput: formToPublicInput(form),
        staffExtension: staffExtension.value,
        // T5R5 §FINDING_11 — attach the identity the staff selected/
        // searched for; an empty string means "unchanged/none", never a
        // fabricated placeholder.
        contactLeadId: contactLeadId || null,
        studentId: studentId || null,
      });
      const res = profilId
        ? await fetch(`/api/assistante/candidat-individuel/profils/${profilId}`, { method: 'PATCH', headers: { 'Content-Type': 'application/json' }, body })
        : await fetch('/api/assistante/candidat-individuel/profils', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body });
      const data = await res.json();
      if (!res.ok) {
        setError(
          data.missingRequiredFields?.length
            ? `Champs requis manquants : ${data.missingRequiredFields.join(', ')}`
            : data.unresolvedFields?.length
              ? `Valeurs non reconnues : ${data.unresolvedFields.join(', ')}`
              : data.message || 'Échec de l’enregistrement.',
        );
        return;
      }
      setProfilId(data.profil.id);
      loadDrafts();
    } finally {
      setBusy(null);
    }
  }

  async function runSimulation() {
    setError(null);
    const staffExtension = buildStaffExtension();
    if (!staffExtension.ok) {
      setError(staffExtension.error);
      return;
    }
    let diagnostic: unknown = null;
    if (diagnosticText.trim()) {
      try {
        diagnostic = { raw: JSON.parse(diagnosticText) };
      } catch {
        setError('Diagnostic : JSON invalide.');
        return;
      }
    }
    setBusy('simulate');
    // A fresh simulation may reshape the GROUPE lines entirely (different
    // subjects, different scenarios) — never carry a previous headcount
    // entry forward onto a line it wasn't confirmed for.
    setGroupHeadcountBySubject({});
    try {
      const res = await fetch('/api/assistante/candidat-individuel/simulate', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          publicInput: formToPublicInput(form),
          staffExtension: staffExtension.value,
          budget: { monthlyBudgetTnd: Number(budgetTnd), strategy },
          diagnostic,
        }),
      });
      const data = await res.json();
      if (!res.ok) {
        setError(data.message || data.error || 'Échec de la simulation.');
        return;
      }
      setResult(data.result);
    } finally {
      setBusy(null);
    }
  }

  async function requestReview() {
    if (!profilId) {
      setError('Enregistrez d’abord un brouillon avant de demander une revue.');
      return;
    }
    setBusy('review');
    try {
      const note = window.prompt('Note pour la revue (optionnel) :') ?? '';
      const res = await fetch(`/api/assistante/candidat-individuel/profils/${profilId}/review`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ note: note || null }),
      });
      if (!res.ok) {
        setError('Échec de la demande de revue.');
        return;
      }
      loadDrafts();
    } finally {
      setBusy(null);
    }
  }

  async function createRevision() {
    if (!profilId) {
      setError('Enregistrez d’abord un brouillon avant de créer une révision.');
      return;
    }
    setBusy('revision');
    try {
      const res = await fetch(`/api/assistante/candidat-individuel/profils/${profilId}/revision`, { method: 'POST' });
      const data = await res.json();
      if (!res.ok) {
        setError('Échec de la création de révision.');
        return;
      }
      setProfilId(data.profil.id);
      setForm(profilToForm(data.profil));
      setResult(null);
    setCreatedQuote(null);
      loadDrafts();
    } finally {
      setBusy(null);
    }
  }

  // T3A — the scenario currently selected to be frozen into a draft Quote,
  // and its GROUPE-modality lines (the only ones a confirmed headcount is
  // ever relevant to; a NOT_APPLICABLE/no-GROUPE-line scenario renders
  // nothing extra below and needs no headcount at all).
  const selectedScenario: { tier: string; lines: ScenarioLineView[] } | undefined =
    result?.status === 'READY' ? result.scenarios.find((s: { tier: string }) => s.tier === scenarioTier) : undefined;
  const groupeLines: ScenarioLineView[] = selectedScenario ? selectedScenario.lines.filter((l: ScenarioLineView) => l.modality === 'GROUPE') : [];
  const headcountFields: HeadcountFieldState[] = groupeLines.map((l) => {
    const raw = groupHeadcountBySubject[l.subject] ?? '';
    const trimmed = raw.trim();
    const missing = trimmed === '';
    const parsed = missing ? null : parseConfirmedHeadcount(raw);
    return { subject: l.subject, label: l.label, raw, parsed, missing, invalid: !missing && parsed === null };
  });
  const missingHeadcountFields = headcountFields.filter((f) => f.missing);
  const invalidHeadcountFields = headcountFields.filter((f) => f.invalid);
  const groupHeadcountBlocking = missingHeadcountFields.length > 0 || invalidHeadcountFields.length > 0;

  function setHeadcountRaw(subject: string, raw: string) {
    setGroupHeadcountBySubject((prev) => ({ ...prev, [subject]: raw }));
  }

  async function createDraftQuote() {
    if (!profilId) {
      setError('Enregistrez d’abord un brouillon (le devis doit être lié à un profil persisté).');
      return;
    }
    if (result?.status !== 'READY') {
      setError('La simulation doit être à l’état READY pour créer un brouillon de devis.');
      return;
    }
    if (groupHeadcountBlocking) {
      setError('Effectif de groupe manquant ou invalide pour au moins une matière — voir le détail ci-dessus.');
      return;
    }
    // T3A closeout Phase F discovery: the server re-runs the pipeline from
    // the persisted profil, never trusting the client's own simulate
    // result (route.ts's own doc comment) — so the diagnostic must be
    // resent here too, exactly like runSimulation() already does, or a
    // non-foundational GROUPE subject (LVA/LVB/spécialité abandonnée —
    // never included by default without a diagnosed weakness) would
    // silently vanish from the persisted Quote even though the staff just
    // saw it in the simulation preview.
    let diagnostic: unknown = null;
    if (diagnosticText.trim()) {
      try {
        diagnostic = { raw: JSON.parse(diagnosticText) };
      } catch {
        setError('Diagnostic : JSON invalide.');
        return;
      }
    }
    const confirmedHeadcountBySubject =
      headcountFields.length > 0 ? Object.fromEntries(headcountFields.map((f) => [f.subject, f.parsed as number])) : undefined;
    setBusy('quote');
    try {
      const res = await fetch(`/api/assistante/candidat-individuel/profils/${profilId}/quote`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          idempotencyKey: generateIdempotencyKey(),
          budget: { monthlyBudgetTnd: Number(budgetTnd), strategy },
          scenarioTier,
          diagnostic,
          ...(confirmedHeadcountBySubject ? { confirmedHeadcountBySubject } : {}),
        }),
      });
      const data = await res.json();
      if (!res.ok) {
        if (data.gate === 'BLOCKED') {
          setError(`Marge insuffisante (${data.marginPct?.toFixed?.(1)}%). Un override staff serait nécessaire — non proposé automatiquement ici.`);
        } else {
          setError(data.message || data.error || 'Échec de la création du brouillon de devis.');
        }
        return;
      }
      setCreatedQuote(data.quote);
      setFamilyLink(null);
      setFamilyLinkCopied(false);
    } finally {
      setBusy(null);
    }
  }

  // T5R — RECETTE_FINDING_3: the staff action that makes a draft Quote
  // visible to the family. Server re-validates everything authoritatively
  // (lib/quotes/persistence.server.ts::promoteQuoteToFamilyVisible) — this
  // button only triggers the call, never assumes success client-side.
  async function publishQuote() {
    if (!createdQuote?.id) return;
    setBusy('publish');
    setError(null);
    try {
      const res = await fetch(`/api/assistante/candidat-individuel/quotes/${createdQuote.id}/publish`, { method: 'POST' });
      const data = await res.json();
      if (!res.ok) {
        setError(data.error ? `${data.error}${data.reasons ? ` : ${data.reasons.join(', ')}` : ''}` : 'Échec de la publication famille.');
        return;
      }
      setCreatedQuote((prev: typeof createdQuote) => (prev ? { ...prev, ...data.quote } : data.quote));
    } finally {
      setBusy(null);
    }
  }

  // T5R2 — FAMILY_LINK_DISTRIBUTION: issues (first call) or rotates
  // (subsequent calls) the family link for an already-published Quote.
  // Server re-validates everything authoritatively
  // (lib/quotes/emission-guard.ts::collectFamilyLinkIssuanceBlockers) —
  // this button only triggers the call. The raw token is only ever held
  // in this component's state, inside the full URL — never requested or
  // displayed separately.
  async function issueFamilyLink() {
    if (!createdQuote?.id) return;
    setBusy('family-link');
    setError(null);
    setFamilyLinkCopied(false);
    try {
      const res = await fetch(`/api/assistante/candidat-individuel/quotes/${createdQuote.id}/family-link`, { method: 'POST' });
      const data = await res.json();
      if (!res.ok) {
        setError(data.error ? `${data.error}${data.reasons ? ` : ${data.reasons.join(', ')}` : ''}` : "Échec de l'émission du lien famille.");
        return;
      }
      setFamilyLink({ url: data.familyUrl, action: data.action });
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
      setError('Copie impossible — sélectionnez et copiez le lien manuellement.');
    }
  }

  const badge = result?.status ? RESULT_BADGE[result.status] : null;

  return (
    <div className="grid gap-4 lg:grid-cols-[1.1fr_1fr]">
      <h2 className="sr-only">Fiche candidat individuel</h2>
      <div className="space-y-4">
        <Card className="border-white/10 bg-surface-card">
          <CardHeader className="flex flex-row items-center justify-between">
            <CardTitle className="text-base text-white">Brouillons (reprendre)</CardTitle>
            <Button size="sm" variant="outline" className="text-brand-accent hover:text-white" onClick={newDraft}>
              Nouveau profil
            </Button>
          </CardHeader>
          <CardContent className="space-y-2">
            {drafts.length === 0 && <p className="text-sm text-neutral-300">Aucun brouillon enregistré.</p>}
            {drafts.map((d) => (
              <button
                key={d.id}
                onClick={() => loadDraft(d.id)}
                className={`block w-full rounded-lg border px-3 py-2 text-left text-sm transition-colors ${
                  d.id === profilId ? 'border-brand-primary bg-brand-primary/10 text-white' : 'border-white/10 text-neutral-300 hover:border-white/25'
                }`}
              >
                {d.level} · session {d.examSession} · {d.specialite1}/{d.specialite2}
                {d.reviewRequestedAt && <Badge variant="warning" className="ml-2">Revue demandée</Badge>}
                {d.revisionNumber > 1 && <Badge variant="outline" className="ml-2">Révision {d.revisionNumber}</Badge>}
              </button>
            ))}
          </CardContent>
        </Card>

        <Card className="border-white/10 bg-surface-card">
          <CardHeader>
            <CardTitle className="text-base text-white">Faits publics</CardTitle>
          </CardHeader>
          <CardContent className="grid grid-cols-2 gap-3">
            <div>
              <Label htmlFor="field-level">Niveau</Label>
              <Select value={form.level} onValueChange={(v) => setForm({ ...form, level: v })}>
                <SelectTrigger id="field-level"><SelectValue /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="PREMIERE">Première</SelectItem>
                  <SelectItem value="TERMINALE">Terminale</SelectItem>
                </SelectContent>
              </Select>
            </div>
            <div>
              <Label htmlFor="field-examSession">Session d'examen</Label>
              <Input id="field-examSession" type="number" value={form.examSession} onChange={(e) => setForm({ ...form, examSession: e.target.value })} />
            </div>
            <div>
              <Label htmlFor="field-modalite">Modalité</Label>
              <Select value={form.modalite} onValueChange={(v) => setForm({ ...form, modalite: v })}>
                <SelectTrigger id="field-modalite"><SelectValue /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="A">A</SelectItem>
                  <SelectItem value="B">B</SelectItem>
                </SelectContent>
              </Select>
            </div>
            <div>
              <Label htmlFor="field-brancheBascule">Branche bascule</Label>
              <Select value={form.brancheBascule || '__none__'} onValueChange={(v) => setForm({ ...form, brancheBascule: v === '__none__' ? '' : v })}>
                <SelectTrigger id="field-brancheBascule"><SelectValue placeholder="Aucune" /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="__none__">Aucune</SelectItem>
                  <SelectItem value="CONSERVATION_MOYENNES_PREMIERE">Conservation moyennes 1ère</SelectItem>
                  <SelectItem value="RENONCIATION_MOYENNES_PREMIERE">Renonciation moyennes 1ère</SelectItem>
                </SelectContent>
              </Select>
            </div>
            {(['specialite1', 'specialite2', 'specialiteAbandonnee', 'langueA', 'langueB'] as const).map((field) => (
              <div key={field}>
                <Label htmlFor={`field-${field}`}>{field}</Label>
                <Select value={form[field] || '__none__'} onValueChange={(v) => setForm({ ...form, [field]: v === '__none__' ? '' : v })}>
                  <SelectTrigger id={`field-${field}`}><SelectValue placeholder="—" /></SelectTrigger>
                  <SelectContent>
                    <SelectItem value="__none__">—</SelectItem>
                    {SUBJECT_OPTIONS.map((s) => (
                      <SelectItem key={s.value} value={s.value}>{s.label}</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
            ))}
            <div>
              <Label htmlFor="field-optionsTerminale">Options terminale (séparées par virgule)</Label>
              <Input id="field-optionsTerminale" value={form.optionsTerminale} onChange={(e) => setForm({ ...form, optionsTerminale: e.target.value })} placeholder="MATHS_EXPERTES, DGEMC" />
            </div>
            <div>
              <Label htmlFor="field-moyenneRattrapage">Moyenne rattrapage (P11)</Label>
              <Input id="field-moyenneRattrapage" type="number" value={form.moyenneRattrapage} onChange={(e) => setForm({ ...form, moyenneRattrapage: e.target.value })} placeholder="8-10" />
            </div>
            <div className="col-span-2 grid grid-cols-2 gap-2">
              {([
                ['estRedoublant', 'Redoublant'],
                ['estTitulaireBacDejaObtenu', 'Déjà titulaire du bac'],
                ['changementSpecialite', 'Changement spécialité (P9)'],
                ['intentionAmelioration', 'Intention amélioration'],
                ['intentionCycleComplet', 'Cycle complet (2 ans)'],
                ['etalementPlurisessionsDeclare', 'Étalement plurisessions'],
              ] as const).map(([key, label]) => (
                <label key={key} className="flex items-center gap-2 text-sm text-neutral-300">
                  <Checkbox checked={form[key]} onCheckedChange={(v) => setForm({ ...form, [key]: v === true })} />
                  {label}
                </label>
              ))}
            </div>
          </CardContent>
        </Card>

        <Card className="border-white/10 bg-surface-card" data-testid="identity-card">
          <CardHeader>
            <CardTitle className="text-base text-white">Identité — Élève &amp; Responsable</CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            <p className="text-xs text-neutral-300">
              Rattachez un élève et un responsable existants avant de créer un devis destiné à la famille — un devis
              ne peut être rendu disponible à la famille sans les deux (voir le devis brouillon ci-dessous).
            </p>

            <div className="space-y-2">
              <div className="flex items-center justify-between">
                <Label>Responsable (ContactLead)</Label>
                <button
                  type="button"
                  className="text-xs text-muted-foreground underline"
                  onClick={() => {
                    setUseManualLeadId((v) => !v);
                    setSelectedLead(null);
                    setLeadQuery('');
                    setLeadResults([]);
                  }}
                >
                  {useManualLeadId ? 'Revenir à la recherche' : 'Saisir un identifiant manuellement'}
                </button>
              </div>
              {useManualLeadId ? (
                <Input value={manualLeadId} onChange={(e) => setManualLeadId(e.target.value)} placeholder="cku..." />
              ) : selectedLead ? (
                <div className="flex items-center justify-between rounded border border-white/10 p-2 text-sm text-neutral-200" data-testid="selected-lead">
                  <span>
                    {selectedLead.name} — {selectedLead.email}
                    {selectedLead.phone ? ` — ${selectedLead.phone}` : ''}
                  </span>
                  <Button size="sm" variant="ghost" onClick={handleClearLead}>Changer</Button>
                </div>
              ) : (
                <div className="relative">
                  <Input
                    value={leadQuery}
                    onChange={(e) => setLeadQuery(e.target.value)}
                    placeholder="Rechercher par nom, email ou téléphone…"
                  />
                  {leadSearching && <p className="mt-1 text-xs text-muted-foreground">Recherche…</p>}
                  {leadResults.length > 0 && (
                    <ul className="absolute z-10 mt-1 w-full space-y-1 rounded border bg-white p-1 shadow">
                      {leadResults.map((lead) => (
                        <li key={lead.id}>
                          <button
                            type="button"
                            className="w-full rounded px-2 py-1 text-left text-sm text-neutral-900 hover:bg-muted"
                            onClick={() => handleSelectLead(lead)}
                          >
                            {lead.name} — {lead.email}
                          </button>
                        </li>
                      ))}
                    </ul>
                  )}
                </div>
              )}
            </div>

            <div className="space-y-2">
              <div className="flex items-center justify-between">
                <Label>Élève (Student)</Label>
                <button
                  type="button"
                  className="text-xs text-muted-foreground underline"
                  onClick={() => {
                    setUseManualStudentId((v) => !v);
                    setSelectedStudent(null);
                    setStudentQuery('');
                    setStudentResults([]);
                  }}
                >
                  {useManualStudentId ? 'Revenir à la recherche' : 'Saisir un identifiant manuellement'}
                </button>
              </div>
              {useManualStudentId ? (
                <Input value={manualStudentId} onChange={(e) => setManualStudentId(e.target.value)} placeholder="cku..." />
              ) : selectedStudent ? (
                <div className="flex items-center justify-between rounded border border-white/10 p-2 text-sm text-neutral-200" data-testid="selected-student">
                  <span>
                    {studentDisplayName(selectedStudent.user)}
                    {selectedStudent.user.email ? ` — ${selectedStudent.user.email}` : ''}
                  </span>
                  <Button size="sm" variant="ghost" onClick={handleClearStudent}>Changer</Button>
                </div>
              ) : (
                <div className="relative">
                  <Input
                    value={studentQuery}
                    onChange={(e) => setStudentQuery(e.target.value)}
                    placeholder="Rechercher par nom ou email…"
                  />
                  {studentSearching && <p className="mt-1 text-xs text-muted-foreground">Recherche…</p>}
                  {studentResults.length > 0 && (
                    <ul className="absolute z-10 mt-1 w-full space-y-1 rounded border bg-white p-1 shadow">
                      {studentResults.map((student) => (
                        <li key={student.id}>
                          <button
                            type="button"
                            className="w-full rounded px-2 py-1 text-left text-sm text-neutral-900 hover:bg-muted"
                            onClick={() => handleSelectStudent(student)}
                          >
                            {studentDisplayName(student.user)}
                            {student.user.email ? ` — ${student.user.email}` : ''}
                          </button>
                        </li>
                      ))}
                    </ul>
                  )}
                </div>
              )}
            </div>

            {!identityComplete && (
              <div className="rounded-micro border border-warning/30 bg-warning/10 p-2 text-xs text-amber-100" role="note" data-testid="identity-missing-warning">
                Élève et/ou Responsable non rattachés — un devis créé ainsi ne pourra pas être rendu disponible à la
                famille tant que les deux ne sont pas renseignés.
              </div>
            )}
          </CardContent>
        </Card>

        <Card className="border-white/10 bg-surface-card">
          <CardHeader>
            <CardTitle className="text-base text-white">Extension staff (JSON — staff uniquement, jamais côté famille)</CardTitle>
          </CardHeader>
          <CardContent className="space-y-3">
            <div>
              <Label htmlFor="notesConserveesText">notesConservees</Label>
              <Textarea id="notesConserveesText" value={notesConserveesText} onChange={(e) => setNotesConserveesText(e.target.value)} className="font-mono text-xs" />
            </div>
            <div>
              <Label htmlFor="dispensesDeclareesText">dispensesDeclarees</Label>
              <Textarea id="dispensesDeclareesText" value={dispensesDeclareesText} onChange={(e) => setDispensesDeclareesText(e.target.value)} className="font-mono text-xs" />
            </div>
            <div>
              <Label htmlFor="p3AuditText">p3EligibiliteAudit</Label>
              <Textarea id="p3AuditText" value={p3AuditText} onChange={(e) => setP3AuditText(e.target.value)} className="font-mono text-xs" />
            </div>
          </CardContent>
        </Card>

        <Card className="border-white/10 bg-surface-card">
          <CardHeader>
            <CardTitle className="text-base text-white">Budget &amp; diagnostic (simulation uniquement)</CardTitle>
          </CardHeader>
          <CardContent className="space-y-3">
            <div className="grid grid-cols-2 gap-3">
              <div>
                <Label htmlFor="field-budgetTnd">Budget mensuel (TND)</Label>
                <Input id="field-budgetTnd" type="number" value={budgetTnd} onChange={(e) => setBudgetTnd(e.target.value)} />
              </div>
              <div>
                <Label htmlFor="field-strategy">Stratégie</Label>
                <Select value={strategy} onValueChange={setStrategy}>
                  <SelectTrigger id="field-strategy"><SelectValue /></SelectTrigger>
                  <SelectContent>
                    <SelectItem value="RESPECT_BUDGET">Respect budget</SelectItem>
                    <SelectItem value="BEST_BALANCE">Meilleur équilibre</SelectItem>
                    <SelectItem value="MOST_COMPLETE">Le plus complet</SelectItem>
                  </SelectContent>
                </Select>
              </div>
            </div>
            <div>
              <Label htmlFor="diagnosticText">Diagnostic — scores bruts par domaine (JSON, optionnel — absent = diagnostic absent)</Label>
              <Textarea
                id="diagnosticText"
                value={diagnosticText}
                onChange={(e) => setDiagnosticText(e.target.value)}
                placeholder='{"mathematiques": {"points": 12, "maxPoints": 20, "percentage": 60}}'
                className="font-mono text-xs"
              />
            </div>
          </CardContent>
        </Card>

        {error && <div className="rounded-micro border border-error/30 bg-error/10 p-3 text-sm text-red-200">{error}</div>}

        <div className="flex flex-wrap gap-2">
          <Button onClick={saveDraft} disabled={busy !== null}>
            {busy === 'save' && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
            Enregistrer le brouillon
          </Button>
          <Button onClick={runSimulation} disabled={busy !== null} variant="outline" className="text-brand-accent hover:text-white">
            {busy === 'simulate' && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
            Lancer la simulation
          </Button>
          <Button onClick={requestReview} disabled={busy !== null || !profilId} variant="outline" className="text-brand-accent hover:text-white">
            Demander une revue
          </Button>
          <Button onClick={createRevision} disabled={busy !== null || !profilId} variant="outline" className="text-brand-accent hover:text-white">
            Créer une révision
          </Button>
        </div>

        <Card className="border-white/10 bg-surface-card">
          <CardHeader>
            <CardTitle className="text-base text-white">Brouillon de devis (mission §4)</CardTitle>
          </CardHeader>
          <CardContent className="space-y-3">
            <div>
              <Label htmlFor="field-scenarioTier">Scénario à figer</Label>
              <Select value={scenarioTier} onValueChange={setScenarioTier}>
                <SelectTrigger id="field-scenarioTier"><SelectValue /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="ESSENTIEL">ESSENTIEL</SelectItem>
                  <SelectItem value="RECOMMANDE">RECOMMANDE</SelectItem>
                  <SelectItem value="COMPLET">COMPLET</SelectItem>
                </SelectContent>
              </Select>
            </div>
            {groupeLines.length > 0 && (
              <div className="space-y-2 rounded-lg border border-white/10 p-3" data-testid="group-headcount-panel">
                <p className="text-sm font-medium text-white">Effectifs de groupe à confirmer</p>
                <p className="text-xs text-neutral-400">
                  Pour chaque matière proposée en petit groupe, indiquez l&apos;effectif réellement confirmé — jamais présupposé.
                  1 élève → tarif individuel, 2 → tarif duo, 3 ou plus → tarif groupe (barèmes catalogue existants, inchangés).
                </p>
                {headcountFields.map((f) => {
                  const line = groupeLines.find((l) => l.subject === f.subject);
                  const errorId = `headcount-error-${f.subject}`;
                  const isSpecialiteAbandonnee = f.subject === 'specialite-abandonnee';
                  return (
                    <div key={f.subject}>
                      <Label htmlFor={`headcount-${f.subject}`}>{f.label} — effectif confirmé</Label>
                      <Input
                        id={`headcount-${f.subject}`}
                        type="number"
                        min={1}
                        step={1}
                        inputMode="numeric"
                        value={f.raw}
                        onChange={(e) => setHeadcountRaw(f.subject, e.target.value)}
                        placeholder="Non confirmé"
                        aria-invalid={f.invalid}
                        aria-describedby={f.invalid ? errorId : undefined}
                      />
                      {f.invalid && (
                        <p id={errorId} role="alert" className="mt-1 text-xs text-red-300">
                          Effectif invalide pour {f.label} — un entier positif est requis (jamais 0, négatif ou décimal).
                        </p>
                      )}
                      {isSpecialiteAbandonnee && line?.reason.includes(SPECIALITE_ABANDONNEE_WARNING) && (
                        <p className="mt-1 text-xs text-amber-300">{SPECIALITE_ABANDONNEE_WARNING}</p>
                      )}
                    </div>
                  );
                })}
                {missingHeadcountFields.length > 0 && (
                  <div className="rounded-micro border border-warning/30 bg-warning/10 p-2 text-xs text-amber-100" role="status">
                    Effectif non confirmé pour : {missingHeadcountFields.map((f) => f.label).join(', ')}. Le devis restera bloqué
                    (effectif de groupe en attente de confirmation) tant que ces effectifs ne sont pas renseignés — jamais présupposé à 3.
                  </div>
                )}
              </div>
            )}

            <p className="text-xs text-neutral-300" data-testid="identity-summary">
              Élève : {selectedStudent ? studentDisplayName(selectedStudent.user) : (manualStudentId.trim() || 'non renseigné')}
              {' · '}
              Responsable : {selectedLead ? selectedLead.name : (manualLeadId.trim() || 'non renseigné')}
            </p>

            <Button onClick={createDraftQuote} disabled={busy !== null || !profilId || result?.status !== 'READY' || groupHeadcountBlocking}>
              {busy === 'quote' && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
              Créer un brouillon de devis
            </Button>
            {createdQuote && (
              <div className="rounded-lg border border-emerald-300/30 bg-emerald-300/10 p-3 text-xs text-emerald-100">
                <p className="font-medium">Devis brouillon créé — id {createdQuote.id}</p>
                <p className="mt-1 text-emerald-200/80">
                  État : <code>{createdQuote.status}</code> · maturité réglementaire : <code>{createdQuote.regulatoryMaturity}</code>
                  {createdQuote.regulatoryMaturity !== 'CARTE_VALIDATED_DEFINITIVE'
                    ? ' — envoi et acceptation restent bloqués tant que ce devis n\'est pas validé et rendu disponible à la famille (ci-dessous).'
                    : ' — devis validé, disponible à la famille via son lien signé.'}
                </p>
                <div className="mt-2 flex flex-wrap gap-2">
                  <a
                    href={`/api/assistante/candidat-individuel/quotes/${createdQuote.id}/pdf`}
                    className="inline-flex min-h-[44px] items-center gap-2 rounded-lg border border-emerald-300/40 px-3 py-1.5 text-xs font-semibold text-emerald-100 hover:bg-emerald-300/10"
                  >
                    Télécharger le PDF (brouillon interne — ne pas envoyer)
                  </a>
                  {createdQuote.regulatoryMaturity !== 'CARTE_VALIDATED_DEFINITIVE' && (
                    <Button size="sm" onClick={publishQuote} disabled={busy !== null}>
                      {busy === 'publish' && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
                      Valider et rendre disponible à la famille
                    </Button>
                  )}
                  {createdQuote.regulatoryMaturity === 'CARTE_VALIDATED_DEFINITIVE' && (
                    <Button size="sm" onClick={issueFamilyLink} disabled={busy !== null}>
                      {busy === 'family-link' && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
                      {familyLink ? 'Renouveler le lien famille' : 'Générer le lien famille'}
                    </Button>
                  )}
                </div>
                {createdQuote.regulatoryMaturity === 'CARTE_VALIDATED_DEFINITIVE' && !familyLink && (
                  <p className="mt-2 text-[11px] text-emerald-200/70">
                    Aucun lien famille n&apos;est disponible dans cette session — générez-en un pour l&apos;obtenir.
                  </p>
                )}
                {familyLink && (
                  <div className="mt-2 rounded-micro border border-emerald-300/40 bg-surface-card p-2">
                    <p className="text-[11px] font-medium text-emerald-100">
                      {familyLink.action === 'LINK_ROTATED' ? 'Lien famille renouvelé' : 'Lien famille généré'}
                    </p>
                    <div className="mt-1 flex flex-wrap items-center gap-2">
                      <Input
                        id="family-link-url"
                        readOnly
                        value={familyLink.url}
                        onFocus={(e) => e.currentTarget.select()}
                        className="min-w-0 flex-1 text-xs"
                      />
                      <Button size="sm" variant="outline" onClick={copyFamilyLink} className="text-brand-accent hover:text-white">
                        {familyLinkCopied ? 'Copié !' : 'Copier le lien'}
                      </Button>
                    </div>
                    <p className="mt-1 text-[11px] text-amber-200/80">
                      Renouveler ce lien invalidera immédiatement le lien précédent — le lien précédent ne fonctionnera plus.
                    </p>
                  </div>
                )}
              </div>
            )}
          </CardContent>
        </Card>
      </div>

      <div className="space-y-4">
        <Card className="border-white/10 bg-surface-card">
          <CardHeader className="flex flex-row items-center justify-between">
            <CardTitle className="text-base text-white">Résultat de simulation</CardTitle>
            {badge && <Badge variant={badge.variant}>{badge.label}</Badge>}
          </CardHeader>
          <CardContent className="space-y-3 text-sm text-neutral-200">
            {!result && <p className="text-neutral-300">Lancez une simulation pour voir la carte, la validation, les modules sélectionnés et les scénarios.</p>}
            {result && (
              <>
                <p className="text-xs text-neutral-400">{badge?.distinction}</p>

                {'reasons' in result && Array.isArray(result.reasons) && result.reasons.length > 0 && (
                  <div>
                    <p className="font-medium text-white">Motifs</p>
                    <ul className="list-disc pl-5">{result.reasons.map((r: string, i: number) => <li key={i}>{r}</li>)}</ul>
                  </div>
                )}
                {'avertissements' in result && Array.isArray(result.avertissements) && result.avertissements.length > 0 && (
                  <div>
                    <p className="font-medium text-white">Avertissements (guardrails)</p>
                    <ul className="list-disc pl-5">{result.avertissements.map((a: string, i: number) => <li key={i}>{a}</li>)}</ul>
                  </div>
                )}
                {'pendingModuleIds' in result && Array.isArray(result.pendingModuleIds) && (
                  <div>
                    <p className="font-medium text-white">Modules non chiffrables (attente direction)</p>
                    <ul className="list-disc pl-5">{result.pendingModuleIds.map((m: string, i: number) => <li key={i}>{m}</li>)}</ul>
                  </div>
                )}
                {'reason' in result && typeof result.reason === 'string' && (
                  <p><span className="font-medium text-white">Motif : </span>{result.reason}</p>
                )}
                {'validation' in result && result.validation && (
                  <details>
                    <summary className="cursor-pointer font-medium text-white">Validation</summary>
                    <pre className="mt-2 overflow-auto rounded bg-black/30 p-2 text-xs">{JSON.stringify(result.validation, null, 2)}</pre>
                  </details>
                )}
                {'carte' in result && result.carte && (
                  <details>
                    <summary className="cursor-pointer font-medium text-white">Carte d'examen (avec sources)</summary>
                    <pre className="mt-2 overflow-auto rounded bg-black/30 p-2 text-xs">{JSON.stringify(result.carte, null, 2)}</pre>
                  </details>
                )}
                {'selection' in result && result.selection && (
                  <details>
                    <summary className="cursor-pointer font-medium text-white">Sélection catalogue (modules retenus)</summary>
                    <pre className="mt-2 overflow-auto rounded bg-black/30 p-2 text-xs">{JSON.stringify(result.selection, null, 2)}</pre>
                  </details>
                )}
                {result.status === 'READY' && (
                  <>
                    <div className="flex flex-wrap gap-2">
                      <Badge variant="outline">Diagnostic : {result.diagnosticStatus}</Badge>
                      {result.budgetInsuffisantPourSocle && <Badge variant="destructive">Budget insuffisant pour le socle</Badge>}
                      {result.modulesNonRepresentables?.length > 0 && <Badge variant="warning">{result.modulesNonRepresentables.length} module(s) non représentable(s)</Badge>}
                    </div>
                    <div className="space-y-2">
                      {result.scenarios.map((s: { tier: string; grandTotal: number; monthlyTotal: number; deposit: number; matchedOfferId: string | null; lines: { label: string; unitPriceMonthly: number }[] }) => (
                        <div key={s.tier} className="rounded-lg border border-white/10 p-3">
                          <div className="flex items-center justify-between">
                            <p className="font-medium text-white">{s.tier}</p>
                            <p className="text-xs text-neutral-400">{s.matchedOfferId ? `pack : ${s.matchedOfferId}` : 'sur-mesure'}</p>
                          </div>
                          <p className="text-xs text-neutral-400">
                            Total annuel {s.grandTotal} TND · mensualité {s.monthlyTotal} TND · acompte {s.deposit} TND
                          </p>
                          <ul className="mt-1 list-disc pl-5 text-xs text-neutral-300">
                            {s.lines.map((l, i) => <li key={i}>{l.label} — {l.unitPriceMonthly} TND/mois</li>)}
                          </ul>
                        </div>
                      ))}
                    </div>
                  </>
                )}
              </>
            )}
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
