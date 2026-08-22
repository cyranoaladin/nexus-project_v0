'use client';

import { useState } from 'react';
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
import type { RecommendationResult, ScenarioTier } from '@/lib/quotes/schemas';
import type { MarginComputation } from '@/lib/quotes/margin.server';

const SUBJECT_OPTIONS: { value: Subject; label: string }[] = [
  { value: 'MATHEMATIQUES', label: 'Mathématiques' },
  { value: 'NSI', label: 'NSI' },
  { value: 'PHYSIQUE_CHIMIE', label: 'Physique-Chimie' },
  { value: 'SVT', label: 'SVT' },
  { value: 'SES', label: 'SES' },
];

const SUPPORTED_SESSION = 2027;

const GATE_BADGE: Record<string, { label: string; variant: 'success' | 'destructive' | 'warning' }> = {
  GREEN: { label: 'Marge saine', variant: 'success' },
  WARNING: { label: 'Marge à surveiller', variant: 'warning' },
  BLOCKED: { label: 'Validation direction requise', variant: 'destructive' },
};

export function DevisWorkspace() {
  const [level, setLevel] = useState<'premiere' | 'terminale'>('terminale');
  const [eds1, setEds1] = useState<Subject>('MATHEMATIQUES');
  const [eds2, setEds2] = useState<Subject>('NSI');
  const [budget, setBudget] = useState(1200);
  const [strategy, setStrategy] = useState<'RESPECT_BUDGET' | 'BEST_BALANCE' | 'MOST_COMPLETE'>('BEST_BALANCE');
  const [existingContactLeadId, setExistingContactLeadId] = useState('');
  const [studentId, setStudentId] = useState('');
  const [diagnosticId, setDiagnosticId] = useState('');

  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [result, setResult] = useState<RecommendationResult | null>(null);
  const [marginByTier, setMarginByTier] = useState<Record<string, MarginComputation> | null>(null);

  const [creating, setCreating] = useState(false);
  const [createdQuote, setCreatedQuote] = useState<{ quoteId: string; token: string | null } | null>(null);
  const [createError, setCreateError] = useState<string | null>(null);
  const [sending, setSending] = useState(false);

  const situation = {
    level,
    examSession: SUPPORTED_SESSION,
    specialites: level === 'terminale' ? [eds1, eds2] : (['MATHEMATIQUES', 'FRANCAIS'] as [Subject, Subject]),
    diagnosticId: diagnosticId || undefined,
  };

  async function handleCalculate() {
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
      setResult(recJson.result as RecommendationResult);

      if (marginRes.ok) {
        const marginJson = await marginRes.json();
        setMarginByTier(marginJson.marginByTier);
      } else {
        setMarginByTier(null);
      }
    } catch {
      setError('Erreur lors du calcul. Réessayez.');
    } finally {
      setLoading(false);
    }
  }

  async function handleCreate(tier: ScenarioTier) {
    if (!existingContactLeadId.trim()) {
      setCreateError('Renseignez l’identifiant du lead (ContactLead) avant de créer le devis.');
      return;
    }
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
          existingContactLeadId: existingContactLeadId.trim(),
          studentId: studentId.trim() || undefined,
        }),
      });
      const json = await res.json();
      if (!res.ok) throw new Error(json.error ?? 'quote_creation_failed');
      setCreatedQuote({ quoteId: json.quoteId, token: json.token });
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
            <Label>Budget mensuel (TND)</Label>
            <Input type="number" value={budget} onChange={(e) => setBudget(Number(e.target.value))} min={0} />
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
            <Label>ID lead existant (ContactLead) — requis pour créer le devis</Label>
            <Input
              value={existingContactLeadId}
              onChange={(e) => setExistingContactLeadId(e.target.value)}
              placeholder="cku..."
            />
          </div>
        </CardContent>
      </Card>

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
            <div>
              <Button size="sm" onClick={handleSend} disabled={sending}>
                {sending ? 'Envoi…' : 'Envoyer le devis'}
              </Button>
            </div>
          </CardContent>
        </Card>
      )}
    </div>
  );
}
