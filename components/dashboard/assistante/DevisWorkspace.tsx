'use client';

import { useEffect, useRef, useState } from 'react';
import { useSession } from 'next-auth/react';
import type { Subject } from '@prisma/client';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Label } from '@/components/ui/label';
import { Input } from '@/components/ui/input';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { Loader2 } from 'lucide-react';
import type { RecommendationResult, ScenarioTier, QuoteScenario, SituationInput } from '@/lib/quotes/schemas';
import type { MarginComputation } from '@/lib/quotes/margin.server';
import type { ContactLeadSearchResult, QuoteHistoryEntry } from '@/lib/quotes/persistence.server';
import { buildQuotePdfData } from '@/lib/quotes/pdf-adapter';
import { STAFF_LEAD_SEARCH_DEFAULT_LIMIT } from '@/lib/quotes/staff-directory-search-contracts';

const SUBJECT_OPTIONS: { value: Subject; label: string }[] = [
  { value: 'MATHEMATIQUES', label: 'Mathématiques' },
  { value: 'NSI', label: 'NSI' },
  { value: 'PHYSIQUE_CHIMIE', label: 'Physique-Chimie' },
  { value: 'SVT', label: 'SVT' },
  { value: 'SES', label: 'SES' },
];

const SUPPORTED_SESSION = 2027;
type DevisLeadSearchResult = Pick<ContactLeadSearchResult, 'id' | 'name' | 'email' | 'phone'>;

const GATE_BADGE: Record<string, { label: string; variant: 'success' | 'destructive' | 'warning' }> = {
  GREEN: { label: 'Marge saine', variant: 'success' },
  WARNING: { label: 'Marge à surveiller', variant: 'warning' },
  BLOCKED: { label: 'Validation direction requise', variant: 'destructive' },
};

const QUOTE_STATUS_LABELS: Record<string, string> = {
  ESTIMATION: 'Estimation',
  BILAN_A_FAIRE: 'Bilan à faire',
  BILAN_TERMINE: 'Bilan terminé',
  DEVIS_ENVOYE: 'Devis envoyé',
  DEVIS_CONSULTE: 'Devis consulté',
  A_RAPPELER: 'À rappeler',
  ACCEPTE: 'Accepté',
  REFUSE: 'Refusé',
  INSCRIT: 'Inscrit',
  EXPIRE: 'Expiré',
};

function formatDateShort(value: string): string {
  return new Date(value).toLocaleDateString('fr-FR', { day: '2-digit', month: '2-digit', year: 'numeric' });
}

export function DevisWorkspace() {
  const { data: session } = useSession();
  const [level, setLevel] = useState<'premiere' | 'terminale'>('terminale');
  const [eds1, setEds1] = useState<Subject>('MATHEMATIQUES');
  const [eds2, setEds2] = useState<Subject>('NSI');
  const [budget, setBudget] = useState(1200);
  const [strategy, setStrategy] = useState<'RESPECT_BUDGET' | 'BEST_BALANCE' | 'MOST_COMPLETE'>('BEST_BALANCE');

  // Lead search (typeahead) replaces pasting a raw ContactLead id by hand.
  const [leadQuery, setLeadQuery] = useState('');
  const [leadResults, setLeadResults] = useState<DevisLeadSearchResult[]>([]);
  const [leadSearching, setLeadSearching] = useState(false);
  const [selectedLead, setSelectedLead] = useState<DevisLeadSearchResult | null>(null);
  const [manualLeadId, setManualLeadId] = useState('');
  const [useManualLeadId, setUseManualLeadId] = useState(false);
  const debounceRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  const [studentId, setStudentId] = useState('');
  const [diagnosticId, setDiagnosticId] = useState('');

  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [result, setResult] = useState<RecommendationResult | null>(null);
  const [marginByTier, setMarginByTier] = useState<Record<string, MarginComputation> | null>(null);
  const calculationEpochRef = useRef(0);

  const [creating, setCreating] = useState(false);
  const [createdQuote, setCreatedQuote] = useState<{
    quoteId: string;
    token: string | null;
    scenario: QuoteScenario;
    situation: SituationInput;
    validUntil: Date;
    lead: Pick<ContactLeadSearchResult, 'name' | 'email' | 'phone'> | null;
  } | null>(null);
  const [createError, setCreateError] = useState<string | null>(null);
  const [sending, setSending] = useState(false);
  const [pdfDownloading, setPdfDownloading] = useState(false);
  const [pdfError, setPdfError] = useState<string | null>(null);

  const [history, setHistory] = useState<QuoteHistoryEntry[] | null>(null);
  const [historyLoading, setHistoryLoading] = useState(false);

  const existingContactLeadId = useManualLeadId ? manualLeadId.trim() : (selectedLead?.id ?? '');

  const specialites: [Subject, Subject] =
    level === 'terminale' ? [eds1, eds2] : ['MATHEMATIQUES', 'FRANCAIS'];

  const situation = {
    level,
    examSession: SUPPORTED_SESSION,
    specialites,
    diagnosticId: diagnosticId || undefined,
  };

  useEffect(() => {
    calculationEpochRef.current += 1;
    setResult(null);
    setMarginByTier(null);
    setLoading(false);
    setError(null);
  }, [level, eds1, eds2, budget, strategy, diagnosticId]);

  // Debounced lead search — fires 300ms after the user stops typing, only
  // once there's enough signal (2+ chars) to avoid a full-table scan on
  // every keystroke (ContactLead.name has no index).
  useEffect(() => {
    if (debounceRef.current) clearTimeout(debounceRef.current);
    if (useManualLeadId || leadQuery.trim().length < 2) {
      setLeadResults([]);
      return;
    }
    debounceRef.current = setTimeout(async () => {
      setLeadSearching(true);
      try {
        const res = await fetch('/api/quotes/leads/search', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ query: leadQuery.trim(), limit: STAFF_LEAD_SEARCH_DEFAULT_LIMIT }),
        });
        if (res.ok) {
          const json = await res.json();
          setLeadResults(json.items as DevisLeadSearchResult[]);
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
      if (debounceRef.current) clearTimeout(debounceRef.current);
    };
  }, [leadQuery, useManualLeadId]);

  function handleSelectLead(lead: DevisLeadSearchResult) {
    setSelectedLead(lead);
    setLeadQuery('');
    setLeadResults([]);
    setHistory(null);
  }

  function handleClearLead() {
    setSelectedLead(null);
    setManualLeadId('');
    setHistory(null);
  }

  async function handleLoadHistory() {
    if (!existingContactLeadId && !studentId.trim()) return;
    setHistoryLoading(true);
    try {
      const params = new URLSearchParams();
      if (existingContactLeadId) params.set('contactLeadId', existingContactLeadId);
      if (studentId.trim()) params.set('studentId', studentId.trim());
      const res = await fetch(`/api/quotes?${params.toString()}`);
      if (res.ok) {
        const json = await res.json();
        setHistory(json.quotes as QuoteHistoryEntry[]);
      } else {
        setHistory([]);
      }
    } catch {
      setHistory([]);
    } finally {
      setHistoryLoading(false);
    }
  }

  async function handleCalculate() {
    const calculationEpoch = calculationEpochRef.current;
    setLoading(true);
    setError(null);
    setCreatedQuote(null);
    try {
      const [recRes, marginRes] = await Promise.all([
        fetch('/api/quotes/recommend', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            situation: { level, examSession: SUPPORTED_SESSION, specialites: situation.specialites },
            diagnosticId: diagnosticId || undefined,
            budget: { monthlyBudgetTnd: budget, strategy },
          }),
        }),
        fetch('/api/quotes/margin', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            situation: { level, examSession: SUPPORTED_SESSION, specialites: situation.specialites },
            budget: { monthlyBudgetTnd: budget, strategy },
          }),
        }),
      ]);
      if (!recRes.ok) throw new Error('recommend_failed');
      const recJson = await recRes.json();
      if (calculationEpoch !== calculationEpochRef.current) return;
      setResult(recJson.result as RecommendationResult);

      if (marginRes.ok) {
        const marginJson = await marginRes.json();
        setMarginByTier(marginJson.marginByTier);
      } else {
        setMarginByTier(null);
      }
    } catch {
      if (calculationEpoch !== calculationEpochRef.current) return;
      setError('Erreur lors du calcul. Réessayez.');
    } finally {
      if (calculationEpoch === calculationEpochRef.current) setLoading(false);
    }
  }

  async function handleCreate(tier: ScenarioTier) {
    if (!existingContactLeadId) {
      setCreateError('Sélectionnez un lead (recherche ou identifiant manuel) avant de créer le devis.');
      return;
    }
    const scenario = result?.scenarios.find((s) => s.tier === tier);
    if (!scenario) return;

    setCreating(true);
    setCreateError(null);
    try {
      const res = await fetch('/api/quotes', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          idempotencyKey: `staff-${Date.now()}-${Math.random().toString(36).slice(2)}`,
          situation: { level, examSession: SUPPORTED_SESSION, specialites: situation.specialites },
          diagnosticId: diagnosticId || undefined,
          budget: { monthlyBudgetTnd: budget, strategy },
          scenarioTier: tier,
          existingContactLeadId,
          studentId: studentId.trim() || undefined,
        }),
      });
      const json = await res.json();
      if (!res.ok) throw new Error(json.error ?? 'quote_creation_failed');
      setCreatedQuote({
        quoteId: json.quoteId,
        token: json.token,
        scenario: json.scenario as QuoteScenario,
        situation: json.situation as SituationInput,
        validUntil: new Date(json.validUntil as string),
        lead: selectedLead
          ? { name: selectedLead.name, email: selectedLead.email, phone: selectedLead.phone }
          : null,
      });
    } catch {
      setCreateError('Impossible de créer le devis. Vérifiez les identifiants saisis.');
    } finally {
      setCreating(false);
    }
  }

  async function handleSend() {
    if (!createdQuote) return;
    setSending(true);
    try {
      const res = await fetch(`/api/quotes/${createdQuote.quoteId}/send`, { method: 'POST' });
      if (!res.ok) throw new Error('send_failed');
    } catch {
      setCreateError("Erreur lors de l'envoi du devis.");
    } finally {
      setSending(false);
    }
  }

  async function handleDownloadPdf() {
    if (!createdQuote) return;
    setPdfDownloading(true);
    setPdfError(null);
    try {
      const payload = buildQuotePdfData({
        situation: createdQuote.situation,
        scenario: createdQuote.scenario,
        quoteId: createdQuote.quoteId,
        validUntil: createdQuote.validUntil,
        advisorName:
          [session?.user?.firstName, session?.user?.lastName].filter(Boolean).join(' ') || 'Nexus Réussite',
        leadName: createdQuote.lead?.name ?? 'Non renseigné',
        leadEmail: createdQuote.lead?.email ?? '',
        leadPhone: createdQuote.lead?.phone ?? '',
      });
      const res = await fetch('/api/assistante/quotes/pdf', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload),
      });
      if (!res.ok) throw new Error('pdf_failed');
      const blob = await res.blob();
      const url = URL.createObjectURL(blob);
      const link = document.createElement('a');
      link.href = url;
      link.download = `Devis-Nexus-${createdQuote.quoteId}.pdf`;
      link.style.visibility = 'hidden';
      document.body.appendChild(link);
      link.click();
      document.body.removeChild(link);
      URL.revokeObjectURL(url);
    } catch {
      setPdfError('Impossible de générer le PDF.');
    } finally {
      setPdfDownloading(false);
    }
  }

  return (
    <div className="space-y-6">
      <Card>
        <CardHeader>
          <CardTitle>Profil candidat</CardTitle>
        </CardHeader>
        <CardContent className="grid gap-4 md:grid-cols-2">
          <div className="space-y-2">
            <Label>Niveau</Label>
            <Select value={level} onValueChange={(v) => setLevel(v as 'premiere' | 'terminale')}>
              <SelectTrigger>
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="premiere">Première</SelectItem>
                <SelectItem value="terminale">Terminale</SelectItem>
              </SelectContent>
            </Select>
          </div>
          {level === 'terminale' && (
            <>
              <div className="space-y-2">
                <Label>Spécialité 1</Label>
                <Select value={eds1} onValueChange={(v) => setEds1(v as Subject)}>
                  <SelectTrigger>
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    {SUBJECT_OPTIONS.map((s) => (
                      <SelectItem key={s.value} value={s.value}>
                        {s.label}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
              <div className="space-y-2">
                <Label>Spécialité 2</Label>
                <Select value={eds2} onValueChange={(v) => setEds2(v as Subject)}>
                  <SelectTrigger>
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    {SUBJECT_OPTIONS.filter((s) => s.value !== eds1).map((s) => (
                      <SelectItem key={s.value} value={s.value}>
                        {s.label}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
            </>
          )}
          <div className="space-y-2">
            <Label htmlFor="quote-monthly-budget">Budget mensuel (TND)</Label>
            <Input id="quote-monthly-budget" type="number" value={budget} onChange={(e) => setBudget(Number(e.target.value))} min={0} />
          </div>
          <div className="space-y-2">
            <Label>Stratégie</Label>
            <Select value={strategy} onValueChange={(v) => setStrategy(v as typeof strategy)}>
              <SelectTrigger>
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="RESPECT_BUDGET">Respecter strictement le budget</SelectItem>
                <SelectItem value="BEST_BALANCE">Meilleur équilibre</SelectItem>
                <SelectItem value="MOST_COMPLETE">Préparation la plus complète utile</SelectItem>
              </SelectContent>
            </Select>
          </div>
          <div className="space-y-2">
            <Label>ID diagnostic (optionnel)</Label>
            <Input value={diagnosticId} onChange={(e) => setDiagnosticId(e.target.value)} placeholder="cku..." />
          </div>
          <div className="space-y-2">
            <Label>ID élève (optionnel)</Label>
            <Input value={studentId} onChange={(e) => setStudentId(e.target.value)} placeholder="cku..." />
          </div>

          <div className="space-y-2 md:col-span-2">
            <div className="flex items-center justify-between">
              <Label>Lead (ContactLead) — requis pour créer le devis</Label>
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
              <Input
                value={manualLeadId}
                onChange={(e) => setManualLeadId(e.target.value)}
                placeholder="cku..."
              />
            ) : selectedLead ? (
              <div className="flex items-center justify-between rounded border p-2 text-sm">
                <span>
                  {selectedLead.name} — {selectedLead.email}
                  {selectedLead.phone ? ` — ${selectedLead.phone}` : ''}
                </span>
                <Button size="sm" variant="ghost" onClick={handleClearLead}>
                  Changer
                </Button>
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
                          className="w-full rounded px-2 py-1 text-left text-sm hover:bg-muted"
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
        </CardContent>
      </Card>

      <Button
        variant="outline"
        size="sm"
        onClick={handleLoadHistory}
        disabled={historyLoading || (!existingContactLeadId && !studentId.trim())}
      >
        {historyLoading ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : null}
        Voir l’historique des devis
      </Button>

      {history && (
        <Card>
          <CardHeader>
            <CardTitle>Historique des devis</CardTitle>
          </CardHeader>
          <CardContent>
            {history.length === 0 ? (
              <p className="text-sm text-muted-foreground">Aucun devis existant pour ce lead/élève.</p>
            ) : (
              <ul className="space-y-2 text-sm">
                {history.map((quote) => (
                  <li key={quote.id} className="flex items-center justify-between rounded border p-2">
                    <span>
                      {formatDateShort(String(quote.createdAt))} — {QUOTE_STATUS_LABELS[quote.status] ?? quote.status}
                    </span>
                    <span className="font-medium">
                      {quote.monthlyTotal} TND/mois — {quote.grandTotal} TND/an
                    </span>
                  </li>
                ))}
              </ul>
            )}
          </CardContent>
        </Card>
      )}

      <Button onClick={handleCalculate} disabled={loading}>
        {loading ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : null}
        Calculer la recommandation
      </Button>
      {error && <p className="text-sm text-red-500">{error}</p>}

      {result && (
        <div className="grid gap-4 md:grid-cols-3">
          {result.scenarios.map((scenario) => {
            const margin = marginByTier?.[scenario.tier];
            const gateInfo = margin ? GATE_BADGE[margin.gate] : null;
            return (
              <Card key={scenario.tier}>
                <CardHeader>
                  <CardTitle className="flex items-center justify-between text-base">
                    {scenario.tier}
                    {gateInfo && <Badge variant={gateInfo.variant}>{gateInfo.label}</Badge>}
                  </CardTitle>
                </CardHeader>
                <CardContent className="space-y-3 text-sm">
                  <p className="text-xl font-bold">{scenario.monthlyTotal} TND / mois</p>
                  <p className="text-muted-foreground">Total annuel {scenario.grandTotal} TND</p>
                  {margin && (
                    <div className="rounded border p-2 text-xs">
                      <p>CA mensuel : {margin.monthlyRevenueTnd} TND</p>
                      <p>Coût enseignant : {margin.monthlyTeacherCostTnd.toFixed(0)} TND</p>
                      <p>Contribution : {margin.monthlyContributionTnd.toFixed(0)} TND</p>
                      <p className="font-semibold">Marge : {margin.marginPct.toFixed(1)} %</p>
                    </div>
                  )}
                  <ul className="space-y-1">
                    {scenario.lines.map((line, i) => (
                      <li key={i}>
                        {line.label}
                        {line.hoursPerMonth != null && line.hoursPerMonth > 0 ? ` — ${line.hoursPerMonth}h/mois` : ''}
                      </li>
                    ))}
                  </ul>
                  <Button
                    size="sm"
                    variant="outline"
                    disabled={creating}
                    onClick={() => handleCreate(scenario.tier)}
                  >
                    Créer ce devis
                  </Button>
                </CardContent>
              </Card>
            );
          })}
        </div>
      )}

      {createError && <p className="text-sm text-red-500">{createError}</p>}

      {createdQuote && (
        <Card>
          <CardHeader>
            <CardTitle>Devis créé</CardTitle>
          </CardHeader>
          <CardContent className="space-y-3 text-sm">
            <p>ID : {createdQuote.quoteId}</p>
            {createdQuote.token && (
              <a
                href={`/devis/${createdQuote.token}`}
                target="_blank"
                rel="noopener noreferrer"
                className="text-blue-500 underline"
              >
                Voir la page famille
              </a>
            )}
            <div className="flex flex-wrap gap-2">
              <Button size="sm" onClick={handleSend} disabled={sending}>
                {sending ? 'Envoi…' : 'Envoyer le devis'}
              </Button>
              <Button size="sm" variant="outline" onClick={handleDownloadPdf} disabled={pdfDownloading}>
                {pdfDownloading ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : null}
                Télécharger le PDF
              </Button>
            </div>
            {pdfError && <p className="text-sm text-red-500">{pdfError}</p>}
          </CardContent>
        </Card>
      )}
    </div>
  );
}
