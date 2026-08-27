/**
 * Dossier administratif (brief §9). Statuts explicites, jamais une règle
 * réglementaire inventée — chaque ligne porte sa provenance (amendement A5)
 * et une note quand la démarche reste du ressort de la famille.
 */
import { Badge } from '@/components/ui/badge';
import type { AdministrativeStatus, DemoAdministrativeItem } from '@/lib/demo/utica-2026/types';

const STATUS_LABEL: Record<AdministrativeStatus, string> = {
  A_PREPARER: 'À préparer',
  EN_COURS: 'En cours',
  A_VERIFIER: 'À vérifier',
  VALIDE: 'Validé',
  A_REMPLACER: 'À remplacer',
  NON_CONCERNE: 'Non concerné',
};

const STATUS_VARIANT: Record<AdministrativeStatus, 'default' | 'success' | 'warning' | 'destructive' | 'outline'> = {
  A_PREPARER: 'warning',
  EN_COURS: 'default',
  A_VERIFIER: 'warning',
  VALIDE: 'success',
  A_REMPLACER: 'destructive',
  NON_CONCERNE: 'outline',
};

export function AdministrativeSummaryCard({
  items,
  blockingCount,
}: {
  items: DemoAdministrativeItem[];
  blockingCount: number;
}) {
  return (
    <div className="rounded-2xl border border-white/10 bg-surface-card p-5">
      <div className="flex items-center justify-between">
        <h2 className="text-sm font-semibold uppercase tracking-wide text-neutral-400">Dossier administratif</h2>
        <span className="text-xs font-medium text-neutral-500">
          {blockingCount === 0 ? 'Aucun élément bloquant' : `${blockingCount} à préparer`}
        </span>
      </div>
      <ul className="mt-3 space-y-2.5">
        {items.map((item) => (
          <li key={item.id} className="flex items-start justify-between gap-3">
            <div>
              <p className="text-sm text-neutral-200">
                <span className="text-neutral-500">{item.category} — </span>
                {item.label}
              </p>
              {item.note && <p className="mt-0.5 text-[11px] text-neutral-600">{item.note}</p>}
            </div>
            <Badge variant={STATUS_VARIANT[item.status]} className="shrink-0">
              {STATUS_LABEL[item.status]}
            </Badge>
          </li>
        ))}
      </ul>
    </div>
  );
}
