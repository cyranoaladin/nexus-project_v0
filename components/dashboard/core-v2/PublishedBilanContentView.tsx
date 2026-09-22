'use client';

import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';

interface PublishedBilanItem {
  readonly itemId: string;
  readonly constat: string;
  readonly preuve: string | null;
  readonly incertitude: boolean;
  readonly source: 'AI' | 'HUMAN_CORRECTED';
}

interface DeterministicResult {
  readonly itemId: string;
  readonly status: 'MATCHED' | 'NO_MATCH';
  readonly selectedOption?: string;
  readonly correct?: boolean;
}

export interface PublishedBilanContent {
  readonly deterministicResults: readonly DeterministicResult[];
  readonly items: readonly PublishedBilanItem[];
  readonly pointsAppui: readonly string[];
  readonly difficultesObservees: readonly string[];
  readonly prioritesTravail: readonly string[];
  readonly propositionsRemediation: readonly string[];
}

function ListBlock({ title, items }: { title: string; items: readonly string[] }) {
  if (items.length === 0) return null;
  return (
    <div>
      <p className="text-xs font-semibold uppercase tracking-wide text-neutral-500">{title}</p>
      <ul className="list-inside list-disc text-sm text-neutral-300">
        {items.map((item, index) => (
          <li key={index}>{item}</li>
        ))}
      </ul>
    </div>
  );
}

/**
 * Renders exactly `publishedContent` — reused, unchanged, by both the
 * ADMIN pre-publish preview and the candidate's own read page (mission
 * §3/§7: "ajoute un aperçu... en réutilisant son composant de rendu").
 * Never renders a raw JSON blob, a score, or a global grade — there is no
 * such field in this shape to render.
 */
export function PublishedBilanContentView({ content, truncated }: { content: PublishedBilanContent; truncated?: boolean }) {
  return (
    <div className="space-y-4">
      {truncated && (
        <p className="text-sm text-amber-400">
          ⚠ La copie déposée a été tronquée à l’extraction — cette analyse ne couvre pas l’intégralité de la réponse.
        </p>
      )}

      {content.deterministicResults.length > 0 && (
        <Card>
          <CardHeader>
            <CardTitle className="text-sm">Résultats</CardTitle>
          </CardHeader>
          <CardContent>
            <ul className="space-y-1 text-sm text-neutral-300">
              {content.deterministicResults.map((r) => (
                <li key={r.itemId}>
                  {r.itemId} — {r.status === 'MATCHED' ? (r.correct ? 'correct' : 'incorrect') : 'réponse non reconnue'}
                </li>
              ))}
            </ul>
          </CardContent>
        </Card>
      )}

      {content.items.length > 0 ? (
        <Card>
          <CardHeader>
            <CardTitle className="text-sm">Constats</CardTitle>
          </CardHeader>
          <CardContent>
            <ul className="space-y-2 text-sm">
              {content.items.map((item) => (
                <li key={item.itemId} className="rounded border border-white/10 p-2">
                  <p className="font-medium text-neutral-100">
                    {item.itemId} {item.incertitude && <span className="text-amber-400">(incertain)</span>}
                  </p>
                  <p className="text-neutral-300">{item.constat}</p>
                  {item.preuve && <p className="text-xs text-neutral-500">Preuve : « {item.preuve} »</p>}
                </li>
              ))}
            </ul>
          </CardContent>
        </Card>
      ) : (
        <p className="text-sm text-neutral-400">Aucun constat détaillé disponible pour cette révision.</p>
      )}

      {(content.pointsAppui.length > 0 || content.difficultesObservees.length > 0 || content.prioritesTravail.length > 0 || content.propositionsRemediation.length > 0) && (
        <Card>
          <CardHeader>
            <CardTitle className="text-sm">Priorités et pistes de travail</CardTitle>
          </CardHeader>
          <CardContent className="space-y-2">
            <ListBlock title="Points d’appui" items={content.pointsAppui} />
            <ListBlock title="Difficultés observées" items={content.difficultesObservees} />
            <ListBlock title="Priorités de travail" items={content.prioritesTravail} />
            <ListBlock title="Propositions de remédiation" items={content.propositionsRemediation} />
          </CardContent>
        </Card>
      )}

      <p className="text-xs text-neutral-500">
        Ce document est un support d’accompagnement pédagogique. Il ne constitue ni une note, ni un jugement global, ni une
        prédiction de réussite.
      </p>
    </div>
  );
}
