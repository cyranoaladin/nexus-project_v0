/**
 * "Dossier candidat" (P1B §2) — répond à "est-ce qu'il manque quelque
 * chose ?" avec des métriques factuelles (jamais un pourcentage sans
 * définition métier) et une origine explicite par item : un contrôle Nexus
 * n'est jamais présenté comme une obligation réglementaire.
 */
import { FileCheck2 } from 'lucide-react';
import { Badge } from '@/components/ui/badge';
import type { AdministrativeSummary } from '@/lib/demo/utica-2026/selectors';
import type { AdministrativeStatus, Provenance } from '@/lib/demo/utica-2026/types';

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

const PROVENANCE_LABEL: Record<Provenance, string> = {
  REGLEMENTAIRE_CANONIQUE: 'Officiel',
  ETAPE_NEXUS: 'Nexus',
  DEMONSTRATION: 'Démo',
};

function Metric({ value, label }: { value: number; label: string }) {
  return (
    <div className="text-center">
      <p className="text-xl font-semibold text-neutral-50">{value}</p>
      <p className="text-[11px] text-neutral-500">{label}</p>
    </div>
  );
}

export function AdministrativeCockpitCard({ summary }: { summary: AdministrativeSummary }) {
  const total = summary.items.length;
  const validated = summary.countByStatus.VALIDE;
  const toCheck = summary.countByStatus.A_VERIFIER + summary.countByStatus.A_REMPLACER;
  const blocking = summary.administrativeBlockingCount;

  return (
    <div className="rounded-2xl border border-white/10 bg-surface-card p-5">
      <h2 className="flex items-center gap-2 text-sm font-semibold uppercase tracking-wide text-neutral-400">
        <FileCheck2 className="h-4 w-4" aria-hidden="true" />
        Dossier candidat
      </h2>
      <p className="mt-1 text-xs text-neutral-500">
        Nous savons ce qui est fait, ce qui reste à faire et ce qui doit être vérifié.
      </p>

      <div className="mt-4 grid grid-cols-4 gap-2 rounded-xl border border-white/5 bg-surface-darker/40 p-3">
        <Metric value={total} label="suivis" />
        <Metric value={validated} label="validés" />
        <Metric value={toCheck} label="à vérifier" />
        <Metric value={blocking} label="bloquant(s)" />
      </div>

      <ul className="mt-4 space-y-2.5">
        {summary.items.map((item) => (
          <li key={item.id} className="flex items-start justify-between gap-3">
            <div className="min-w-0">
              <p className="text-sm text-neutral-200">
                <span className="text-neutral-500">{item.category} — </span>
                {item.label}
              </p>
              {item.note && <p className="mt-0.5 text-[11px] text-neutral-600">{item.note}</p>}
            </div>
            <div className="flex shrink-0 items-center gap-1.5">
              <Badge variant="outline" className="text-[10px]">
                {PROVENANCE_LABEL[item.provenance]}
              </Badge>
              <Badge variant={STATUS_VARIANT[item.status]}>{STATUS_LABEL[item.status]}</Badge>
            </div>
          </li>
        ))}
      </ul>
    </div>
  );
}
