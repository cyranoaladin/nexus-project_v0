'use client';

import { Loader2 } from 'lucide-react';
import { useCallback, useEffect, useMemo, useState } from 'react';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Textarea } from '@/components/ui/textarea';
import { describeFailure, v2, type ApiFail } from './api';
import { isStaleConflict, useAction } from './actions';
import { PublishedBilanContentView, type PublishedBilanContent } from './PublishedBilanContentView';
import { StatusMessage } from './StatusMessage';
import { useStaffActor } from './useStaffActor';

interface DeterministicResult {
  readonly itemId: string;
  readonly kind: string;
  readonly status: 'MATCHED' | 'NO_MATCH';
  readonly selectedOption?: string;
  readonly correct?: boolean;
}

interface AiProposalItem {
  readonly itemId: string;
  readonly constat: string;
  readonly preuve: string;
  readonly incertitude: boolean;
}

interface AiProposal {
  readonly items: readonly AiProposalItem[];
  readonly pointsAppui: readonly string[];
  readonly difficultesObservees: readonly string[];
  readonly prioritesTravail: readonly string[];
  readonly propositionsRemediation: readonly string[];
}

interface AiProvenance {
  readonly outcome?: string;
  readonly reason?: string;
  readonly model?: string;
  readonly providerName?: string | null;
  readonly attempt?: number;
  readonly reservedCostUsd?: number;
  readonly actualCostUsd?: number;
  readonly providerRequestId?: string | null;
}

interface HumanReview {
  readonly note?: string;
  readonly itemCorrections?: readonly { itemId: string; correctedConstat: string }[];
}

interface BilanDraft {
  readonly id: string;
  readonly revision: number;
  readonly status: 'DRAFT' | 'VALIDATED' | 'PUBLISHED';
  readonly editVersion: number;
  readonly extractionTruncatedSnapshot: boolean;
  readonly deterministicResults: readonly DeterministicResult[];
  readonly aiProposal: AiProposal | null;
  readonly aiProvenance: AiProvenance | null;
  readonly humanReview: HumanReview | null;
  readonly validatedById: string | null;
  readonly validatedAt: string | null;
  readonly publishedById: string | null;
  readonly publishedAt: string | null;
  readonly publishedAudienceScope: string | null;
}

type ProcessingSnapshot =
  | { readonly kind: 'none' }
  | { readonly kind: 'pending'; readonly status: string }
  | { readonly kind: 'failed'; readonly status: string }
  | { readonly kind: 'ready'; readonly id: string }
  | { readonly kind: 'forbidden' }
  | { readonly kind: 'network_error'; readonly failure: ApiFail };

const STATUS_BADGE: Record<BilanDraft['status'], { label: string; variant: 'default' | 'success' | 'warning' }> = {
  DRAFT: { label: 'Brouillon', variant: 'warning' },
  VALIDATED: { label: 'Validé (non publié)', variant: 'default' },
  PUBLISHED: { label: 'Publié', variant: 'success' },
};

function buildLocalPreview(draft: BilanDraft, itemCorrections: Record<string, string>): PublishedBilanContent {
  const items = (draft.aiProposal?.items ?? []).map((item) => {
    const corrected = itemCorrections[item.itemId]?.trim();
    return corrected
      ? { itemId: item.itemId, constat: corrected, preuve: null, incertitude: item.incertitude, source: 'HUMAN_CORRECTED' as const }
      : { itemId: item.itemId, constat: item.constat, preuve: item.preuve, incertitude: item.incertitude, source: 'AI' as const };
  });
  return {
    deterministicResults: draft.deterministicResults,
    items,
    pointsAppui: draft.aiProposal?.pointsAppui ?? [],
    difficultesObservees: draft.aiProposal?.difficultesObservees ?? [],
    prioritesTravail: draft.aiProposal?.prioritesTravail ?? [],
    propositionsRemediation: draft.aiProposal?.propositionsRemediation ?? [],
  };
}

/**
 * ADMIN review screen (mission §7): distinguishes every processing state
 * explicitly (none / pending / failed / forbidden / network error) instead
 * of collapsing all of them into "no processing" — and offers the actual
 * action available in each state (starting the treatment via the existing
 * canonical route, never a second concurrent trigger). Never a raw JSON
 * dump: state/coverage, deterministic results, AI constats with evidence,
 * priorities/remediation, correction, a candidate-facing preview (reusing
 * PublishedBilanContentView), validate, and publish.
 */
export function DiagnosticBilanReview({ submissionId }: { submissionId: string }) {
  const { can, loading: actorLoading } = useStaffActor();
  const [processing, setProcessing] = useState<ProcessingSnapshot>({ kind: 'none' });
  const [draft, setDraft] = useState<BilanDraft | null>(null);
  const [loading, setLoading] = useState(true);
  const [note, setNote] = useState('');
  const [itemCorrections, setItemCorrections] = useState<Record<string, string>>({});
  const [savedSnapshot, setSavedSnapshot] = useState<{ note: string; itemCorrections: Record<string, string> } | null>(null);
  const [showPreview, setShowPreview] = useState(false);

  const applyDraft = useCallback((next: BilanDraft | null) => {
    setDraft(next);
    const nextNote = next?.humanReview?.note ?? '';
    const nextCorrections = Object.fromEntries((next?.humanReview?.itemCorrections ?? []).map((c) => [c.itemId, c.correctedConstat]));
    setNote(nextNote);
    setItemCorrections(nextCorrections);
    setSavedSnapshot({ note: nextNote, itemCorrections: nextCorrections });
  }, []);

  const refresh = useCallback(async () => {
    const processingResult = await v2<{ id: string; status: string }>(`/staff/diagnostics/submissions/${submissionId}/processing`);
    if (!processingResult.ok) {
      if (processingResult.status === 404) setProcessing({ kind: 'none' });
      else if (processingResult.status === 403) setProcessing({ kind: 'forbidden' });
      else setProcessing({ kind: 'network_error', failure: processingResult });
      applyDraft(null);
      setLoading(false);
      return;
    }
    const status = processingResult.data.status;
    if (status === 'EXTRACTION_FAILED' || status === 'NO_EXTRACTABLE_TEXT') {
      setProcessing({ kind: 'failed', status });
      applyDraft(null);
      setLoading(false);
      return;
    }
    if (status !== 'EXTRACTED') {
      setProcessing({ kind: 'pending', status });
      applyDraft(null);
      setLoading(false);
      return;
    }
    setProcessing({ kind: 'ready', id: processingResult.data.id });
    const draftResult = await v2<BilanDraft>(`/staff/diagnostics/processing/${processingResult.data.id}/bilan`);
    applyDraft(draftResult.ok ? draftResult.data : null);
    setLoading(false);
  }, [submissionId, applyDraft]);

  useEffect(() => {
    void refresh();
  }, [refresh]);

  const startAction = useAction(refresh);
  const generateAction = useAction(refresh);
  const correctAction = useAction(refresh, refresh);
  const validateAction = useAction(refresh, refresh);
  const publishAction = useAction(refresh, refresh);

  const isDirty = useMemo(() => {
    if (!savedSnapshot) return false;
    if (note !== savedSnapshot.note) return true;
    const keys = new Set([...Object.keys(itemCorrections), ...Object.keys(savedSnapshot.itemCorrections)]);
    for (const key of keys) {
      if ((itemCorrections[key] ?? '') !== (savedSnapshot.itemCorrections[key] ?? '')) return true;
    }
    return false;
  }, [note, itemCorrections, savedSnapshot]);

  if (actorLoading || loading) {
    return (
      <p role="status" className="flex items-center gap-2 text-sm text-neutral-400">
        <Loader2 className="h-4 w-4 animate-spin" aria-hidden="true" /> Chargement du bilan…
      </p>
    );
  }

  if (!can('DIAGNOSTIC_BILAN_REVIEW')) {
    return <StatusMessage kind="error">Cet écran est réservé aux comptes habilités à la revue pédagogique.</StatusMessage>;
  }

  if (processing.kind === 'forbidden') {
    return <StatusMessage kind="error">Accès refusé à ce traitement.</StatusMessage>;
  }
  if (processing.kind === 'network_error') {
    return (
      <div className="space-y-2">
        <StatusMessage kind="error">{describeFailure(processing.failure)}</StatusMessage>
        <Button type="button" variant="outline" size="sm" onClick={() => void refresh()}>Réessayer</Button>
      </div>
    );
  }
  if (processing.kind === 'none') {
    return (
      <Card>
        <CardContent className="flex items-center justify-between gap-3 p-4">
          <p className="text-sm text-neutral-300">Aucun traitement n’a encore été lancé pour ce dépôt.</p>
          <Button
            type="button"
            data-testid="btn-start-processing"
            disabled={startAction.pending !== null}
            onClick={() =>
              void startAction.run(
                'start',
                () => v2(`/staff/diagnostics/submissions/${submissionId}/processing`, { method: 'POST' }),
                'Traitement démarré.',
              )
            }
          >
            {startAction.pending ? 'Démarrage…' : 'Démarrer le traitement'}
          </Button>
        </CardContent>
        {startAction.failure && <CardContent className="pt-0"><StatusMessage kind="error">{describeFailure(startAction.failure)}</StatusMessage></CardContent>}
      </Card>
    );
  }
  if (processing.kind === 'pending') {
    return (
      <div className="space-y-2">
        <StatusMessage kind="info">Extraction en cours ou en attente (statut : {processing.status}).</StatusMessage>
        <Button type="button" variant="outline" size="sm" onClick={() => void refresh()}>Actualiser</Button>
      </div>
    );
  }
  if (processing.kind === 'failed') {
    return <StatusMessage kind="error">L’extraction a échoué (statut : {processing.status}). Le bilan ne peut pas être généré.</StatusMessage>;
  }

  const processingId = processing.id;

  return (
    <div className="space-y-4">
      {!draft && (
        <Card>
          <CardContent className="flex items-center justify-between gap-3 p-4">
            <p className="text-sm text-neutral-300">Aucun bilan n’a encore été généré pour ce dépôt.</p>
            <Button
              type="button"
              data-testid="btn-generate-bilan"
              disabled={generateAction.pending !== null}
              onClick={() =>
                void generateAction.run(
                  'generate',
                  () => v2(`/staff/diagnostics/processing/${processingId}/bilan`, { method: 'POST' }),
                  'Bilan généré.',
                )
              }
            >
              {generateAction.pending ? 'Génération…' : 'Générer le bilan'}
            </Button>
          </CardContent>
        </Card>
      )}

      {draft && (
        <>
          <Card>
            <CardHeader className="flex flex-row flex-wrap items-center justify-between gap-2">
              <CardTitle className="text-base">
                Bilan — révision {draft.revision}
                <Badge variant={STATUS_BADGE[draft.status].variant} className="ml-2">
                  {STATUS_BADGE[draft.status].label}
                </Badge>
              </CardTitle>
              <Button
                type="button"
                size="sm"
                variant="outline"
                disabled={generateAction.pending !== null}
                onClick={() =>
                  void generateAction.run(
                    'regenerate',
                    () => v2(`/staff/diagnostics/processing/${processingId}/bilan`, { method: 'POST' }),
                    'Nouvelle révision générée.',
                  )
                }
              >
                {generateAction.pending ? 'Génération…' : 'Générer une nouvelle révision'}
              </Button>
            </CardHeader>
            <CardContent className="space-y-1 text-sm text-neutral-300">
              {draft.extractionTruncatedSnapshot && (
                <p className="text-amber-400">⚠ La copie extraite a été tronquée — cette analyse ne couvre pas l’intégralité de la réponse.</p>
              )}
              {draft.status !== 'DRAFT' && draft.validatedAt && <p>Validé le {new Date(draft.validatedAt).toLocaleString('fr-FR')}.</p>}
              {draft.status === 'PUBLISHED' && draft.publishedAt && (
                <p>Publié le {new Date(draft.publishedAt).toLocaleString('fr-FR')} pour l’audience « {draft.publishedAudienceScope} ».</p>
              )}
            </CardContent>
          </Card>

          <Card>
            <CardHeader>
              <CardTitle className="text-sm">Résultats déterministes</CardTitle>
            </CardHeader>
            <CardContent>
              <ul className="space-y-1 text-sm">
                {draft.deterministicResults.map((r) => (
                  <li key={r.itemId} className="text-neutral-300">
                    {r.itemId} — {r.status === 'MATCHED' ? (r.correct ? 'correct' : 'incorrect') : 'réponse non reconnue'}
                    {r.status === 'MATCHED' && r.selectedOption && ` (réponse : ${r.selectedOption})`}
                  </li>
                ))}
              </ul>
            </CardContent>
          </Card>

          <Card>
            <CardHeader>
              <CardTitle className="text-sm">Constats et preuves (proposition IA)</CardTitle>
            </CardHeader>
            <CardContent>
              {draft.aiProposal ? (
                <ul className="space-y-3 text-sm">
                  {draft.aiProposal.items.map((item) => (
                    <li key={item.itemId} className="rounded border border-white/10 p-2">
                      <p className="font-medium text-neutral-100">
                        {item.itemId} {item.incertitude && <span className="text-amber-400">(incertain)</span>}
                      </p>
                      <p className="text-neutral-300">{item.constat}</p>
                      <p className="text-xs text-neutral-500">Preuve : « {item.preuve} »</p>
                      {draft.status === 'DRAFT' && (
                        <div className="mt-2">
                          <label className="text-xs text-neutral-400" htmlFor={`correction-${item.itemId}`}>
                            Constat corrigé (remplace le constat IA dans le bilan publié — laisser vide pour conserver le constat IA)
                          </label>
                          <Textarea
                            id={`correction-${item.itemId}`}
                            data-testid={`item-correction-${item.itemId}`}
                            value={itemCorrections[item.itemId] ?? ''}
                            onChange={(e) => setItemCorrections((prev) => ({ ...prev, [item.itemId]: e.target.value }))}
                            className="mt-1"
                          />
                        </div>
                      )}
                    </li>
                  ))}
                </ul>
              ) : (
                <p className="text-sm text-neutral-400">
                  Aucune proposition IA disponible pour cette révision
                  {draft.aiProvenance?.outcome && ` (${draft.aiProvenance.outcome}${draft.aiProvenance.reason ? ` — ${draft.aiProvenance.reason}` : ''})`}.
                  L’absence de proposition n’est pas une erreur de l’élève.
                </p>
              )}
            </CardContent>
          </Card>

          {draft.status === 'DRAFT' && (
            <Card>
              <CardHeader>
                <CardTitle className="text-sm">Note interne de revue (jamais publiée au candidat)</CardTitle>
              </CardHeader>
              <CardContent className="space-y-3">
                <Textarea
                  value={note}
                  onChange={(e) => setNote(e.target.value)}
                  placeholder="Note interne (optionnelle)"
                  aria-label="Note interne de revue"
                />
                <div className="flex flex-wrap items-center gap-2">
                  <Button
                    type="button"
                    variant="outline"
                    data-testid="btn-save-correction"
                    disabled={correctAction.pending !== null}
                    onClick={() =>
                      void correctAction.run(
                        'correct',
                        () =>
                          v2(`/staff/diagnostics/processing/${processingId}/bilan/correct`, {
                            method: 'POST',
                            json: {
                              draftId: draft.id,
                              editVersion: draft.editVersion,
                              humanReview: {
                                note: note.trim() || undefined,
                                itemCorrections: Object.entries(itemCorrections)
                                  .filter(([, v]) => v.trim())
                                  .map(([itemId, correctedConstat]) => ({ itemId, correctedConstat })),
                              },
                            },
                          }),
                        'Correction enregistrée.',
                      )
                    }
                  >
                    {correctAction.pending ? 'Enregistrement…' : 'Enregistrer la correction'}
                  </Button>
                  <Button type="button" variant="outline" data-testid="btn-toggle-preview" onClick={() => setShowPreview((v) => !v)}>
                    {showPreview ? 'Masquer l’aperçu candidat' : 'Aperçu candidat'}
                  </Button>
                  <Button
                    type="button"
                    data-testid="btn-validate-bilan"
                    disabled={validateAction.pending !== null || isDirty}
                    title={isDirty ? 'Enregistrez la correction avant de valider — des modifications non enregistrées sont en cours.' : undefined}
                    onClick={() =>
                      void validateAction.run(
                        'validate',
                        () =>
                          v2(`/staff/diagnostics/processing/${processingId}/bilan/validate`, {
                            method: 'POST',
                            json: { draftId: draft.id, editVersion: draft.editVersion },
                          }),
                        'Bilan validé.',
                      )
                    }
                  >
                    {validateAction.pending ? 'Validation…' : 'Valider le bilan'}
                  </Button>
                </div>
                {isDirty && (
                  <StatusMessage kind="info">
                    Modifications non enregistrées : enregistrez la correction avant de valider, sinon la version validée sera l’ancienne.
                  </StatusMessage>
                )}
                {showPreview && (
                  <div className="rounded border border-white/10 p-3">
                    <p className="mb-2 text-xs uppercase tracking-wide text-neutral-500">Aperçu — ce que verrait le candidat</p>
                    <PublishedBilanContentView content={buildLocalPreview(draft, itemCorrections)} truncated={draft.extractionTruncatedSnapshot} />
                  </div>
                )}
                {correctAction.failure && (
                  <StatusMessage kind="error">
                    {isStaleConflict(correctAction.failure) ? 'Ce bilan a été modifié depuis son ouverture — la vue a été rechargée.' : describeFailure(correctAction.failure)}
                  </StatusMessage>
                )}
                {validateAction.failure && <StatusMessage kind="error">{describeFailure(validateAction.failure)}</StatusMessage>}
              </CardContent>
            </Card>
          )}

          {draft.status === 'VALIDATED' && (
            <Card>
              <CardHeader>
                <CardTitle className="text-sm">Publication</CardTitle>
              </CardHeader>
              <CardContent className="space-y-3">
                <p className="text-sm text-neutral-400">
                  La publication rend ce bilan lisible par le candidat lui-même (audience « own-student »). Elle reste une action explicite,
                  jamais automatique.
                </p>
                <Button type="button" variant="outline" data-testid="btn-toggle-preview" onClick={() => setShowPreview((v) => !v)}>
                  {showPreview ? 'Masquer l’aperçu candidat' : 'Aperçu candidat'}
                </Button>
                {showPreview && (
                  <div data-testid="bilan-preview" className="rounded border border-white/10 p-3">
                    <p className="mb-2 text-xs uppercase tracking-wide text-neutral-500">Aperçu — ce que verrait le candidat</p>
                    <PublishedBilanContentView content={buildLocalPreview(draft, itemCorrections)} truncated={draft.extractionTruncatedSnapshot} />
                  </div>
                )}
                <Button
                  type="button"
                  data-testid="btn-publish-bilan"
                  disabled={publishAction.pending !== null}
                  onClick={() =>
                    void publishAction.run(
                      'publish',
                      () =>
                        v2(`/staff/diagnostics/processing/${processingId}/bilan/publish`, {
                          method: 'POST',
                          json: { draftId: draft.id, editVersion: draft.editVersion, audienceScope: 'own-student' },
                        }),
                      'Bilan publié.',
                    )
                  }
                >
                  {publishAction.pending ? 'Publication…' : 'Publier pour le candidat'}
                </Button>
                {publishAction.failure && <StatusMessage kind="error">{describeFailure(publishAction.failure)}</StatusMessage>}
              </CardContent>
            </Card>
          )}

          {generateAction.failure && <StatusMessage kind="error">{describeFailure(generateAction.failure)}</StatusMessage>}
        </>
      )}
    </div>
  );
}
