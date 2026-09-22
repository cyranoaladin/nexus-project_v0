'use client';

import { Loader2 } from 'lucide-react';
import { useCallback, useEffect, useState } from 'react';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Textarea } from '@/components/ui/textarea';
import { describeFailure, v2 } from './api';
import { isStaleConflict, useAction } from './actions';
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
  readonly providerName?: string;
  readonly attempt?: number;
  readonly reservedCostUsd?: number;
  readonly actualCostUsd?: number;
  readonly providerRequestId?: string | null;
}

interface HumanReview {
  readonly note?: string;
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

interface ProcessingStatus {
  readonly id: string;
  readonly status: 'QUEUED' | 'EXTRACTING' | 'EXTRACTED' | 'NO_EXTRACTABLE_TEXT' | 'EXTRACTION_FAILED';
}

const STATUS_BADGE: Record<BilanDraft['status'], { label: string; variant: 'default' | 'success' | 'warning' }> = {
  DRAFT: { label: 'Brouillon', variant: 'warning' },
  VALIDATED: { label: 'Validé (non publié)', variant: 'default' },
  PUBLISHED: { label: 'Publié', variant: 'success' },
};

/**
 * ADMIN review screen (mission §7): état/couverture, résultats
 * déterministes, constats IA (proposition, jamais une décision), priorités,
 * actions de remédiation, limites, et l'historique des validations —
 * jamais un bloc JSON brut. DIAGNOSTIC_BILAN_REVIEW is enforced server-side
 * on every call this component makes; the `can()` check here is UX only.
 */
export function DiagnosticBilanReview({ submissionId }: { submissionId: string }) {
  const { can, loading: actorLoading } = useStaffActor();
  const [processing, setProcessing] = useState<ProcessingStatus | null>(null);
  const [draft, setDraft] = useState<BilanDraft | null>(null);
  const [loading, setLoading] = useState(true);
  const [note, setNote] = useState('');

  const refresh = useCallback(async () => {
    const processingResult = await v2<ProcessingStatus>(`/staff/diagnostics/submissions/${submissionId}/processing`);
    if (!processingResult.ok) {
      setProcessing(null);
      setDraft(null);
      setLoading(false);
      return;
    }
    setProcessing(processingResult.data);
    const draftResult = await v2<BilanDraft>(`/staff/diagnostics/processing/${processingResult.data.id}/bilan`);
    setDraft(draftResult.ok ? draftResult.data : null);
    setNote(draftResult.ok ? draftResult.data.humanReview?.note ?? '' : '');
    setLoading(false);
  }, [submissionId]);

  useEffect(() => {
    void refresh();
  }, [refresh]);

  const generateAction = useAction(refresh);
  const correctAction = useAction(refresh, refresh);
  const validateAction = useAction(refresh, refresh);
  const publishAction = useAction(refresh, refresh);

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

  if (!processing) {
    return <StatusMessage kind="info">Aucun traitement n’a encore été lancé pour ce dépôt.</StatusMessage>;
  }

  if (processing.status !== 'EXTRACTED') {
    return (
      <StatusMessage kind="info">
        Extraction non disponible pour l’instant (statut : {processing.status}). Le bilan ne peut pas être généré avant qu’une extraction ait réussi.
      </StatusMessage>
    );
  }

  return (
    <div className="space-y-4">
      {!draft && (
        <Card>
          <CardContent className="flex items-center justify-between gap-3 p-4">
            <p className="text-sm text-neutral-300">Aucun bilan n’a encore été généré pour ce dépôt.</p>
            <Button
              type="button"
              disabled={generateAction.pending !== null}
              onClick={() =>
                void generateAction.run(
                  'generate',
                  () => v2(`/staff/diagnostics/processing/${processing.id}/bilan`, { method: 'POST' }),
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
                    () => v2(`/staff/diagnostics/processing/${processing.id}/bilan`, { method: 'POST' }),
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
              {draft.status !== 'DRAFT' && draft.validatedAt && (
                <p>Validé le {new Date(draft.validatedAt).toLocaleString('fr-FR')}.</p>
              )}
              {draft.status === 'PUBLISHED' && draft.publishedAt && (
                <p>
                  Publié le {new Date(draft.publishedAt).toLocaleString('fr-FR')} pour l’audience « {draft.publishedAudienceScope} ».
                </p>
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
                <ul className="space-y-2 text-sm">
                  {draft.aiProposal.items.map((item) => (
                    <li key={item.itemId} className="rounded border border-white/10 p-2">
                      <p className="font-medium text-neutral-100">
                        {item.itemId} {item.incertitude && <span className="text-amber-400">(incertain)</span>}
                      </p>
                      <p className="text-neutral-300">{item.constat}</p>
                      <p className="text-xs text-neutral-500">Preuve : « {item.preuve} »</p>
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

          {draft.aiProposal && (
            <Card>
              <CardHeader>
                <CardTitle className="text-sm">Priorités et pistes de remédiation</CardTitle>
              </CardHeader>
              <CardContent className="space-y-2 text-sm text-neutral-300">
                <ListBlock title="Points d’appui" items={draft.aiProposal.pointsAppui} />
                <ListBlock title="Difficultés observées" items={draft.aiProposal.difficultesObservees} />
                <ListBlock title="Priorités de travail" items={draft.aiProposal.prioritesTravail} />
                <ListBlock title="Propositions de remédiation" items={draft.aiProposal.propositionsRemediation} />
              </CardContent>
            </Card>
          )}

          {draft.status === 'DRAFT' && (
            <Card>
              <CardHeader>
                <CardTitle className="text-sm">Correction pédagogique</CardTitle>
              </CardHeader>
              <CardContent className="space-y-3">
                <Textarea
                  value={note}
                  onChange={(e) => setNote(e.target.value)}
                  placeholder="Note de correction (optionnelle)"
                  aria-label="Note de correction"
                />
                <div className="flex flex-wrap gap-2">
                  <Button
                    type="button"
                    variant="outline"
                    disabled={correctAction.pending !== null}
                    onClick={() =>
                      void correctAction.run(
                        'correct',
                        () =>
                          v2(`/staff/diagnostics/processing/${processing.id}/bilan/correct`, {
                            method: 'POST',
                            json: { editVersion: draft.editVersion, humanReview: { note: note.trim() || undefined } },
                          }),
                        'Correction enregistrée.',
                      )
                    }
                  >
                    {correctAction.pending ? 'Enregistrement…' : 'Enregistrer la correction'}
                  </Button>
                  <Button
                    type="button"
                    disabled={validateAction.pending !== null}
                    onClick={() =>
                      void validateAction.run(
                        'validate',
                        () =>
                          v2(`/staff/diagnostics/processing/${processing.id}/bilan/validate`, {
                            method: 'POST',
                            json: { editVersion: draft.editVersion },
                          }),
                        'Bilan validé.',
                      )
                    }
                  >
                    {validateAction.pending ? 'Validation…' : 'Valider le bilan'}
                  </Button>
                </div>
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
                <Button
                  type="button"
                  disabled={publishAction.pending !== null}
                  onClick={() =>
                    void publishAction.run(
                      'publish',
                      () =>
                        v2(`/staff/diagnostics/processing/${processing.id}/bilan/publish`, {
                          method: 'POST',
                          json: { editVersion: draft.editVersion, audienceScope: 'own-student' },
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

function ListBlock({ title, items }: { title: string; items: readonly string[] }) {
  if (items.length === 0) return null;
  return (
    <div>
      <p className="text-xs font-semibold uppercase tracking-wide text-neutral-500">{title}</p>
      <ul className="list-inside list-disc">
        {items.map((item, index) => (
          <li key={index}>{item}</li>
        ))}
      </ul>
    </div>
  );
}
