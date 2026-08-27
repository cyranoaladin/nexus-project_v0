/**
 * "Mes documents" (P1C §5) — coffre compact, métadonnées uniquement.
 * Réutilise le pattern de catégorisation d'EleveHubRessources (P0) sans
 * connecter de stockage réel (amendement A7 : aucun DOCUMENT_STORAGE_ROOT).
 */
import { ClipboardCheck, FileBarChart, FileText, Folder, ShieldCheck } from 'lucide-react';
import type { DemoDocument, DocumentCategory } from '@/lib/demo/utica-2026/types';

const CATEGORY_META: Record<DocumentCategory, { label: string; icon: typeof FileText }> = {
  BILAN: { label: 'Bilan', icon: FileBarChart },
  COMPTE_RENDU: { label: 'Compte rendu', icon: FileText },
  PLANNING: { label: 'Planning', icon: Folder },
  CORRECTION: { label: 'Correction', icon: ClipboardCheck },
  ADMINISTRATIF: { label: 'Administratif', icon: ShieldCheck },
};

export function DocumentVaultCard({ documents }: { documents: DemoDocument[] }) {
  return (
    <div className="rounded-2xl border border-white/10 bg-surface-card p-5">
      <div className="flex items-center justify-between">
        <h2 className="text-sm font-semibold uppercase tracking-wide text-neutral-400">Mes documents</h2>
        <span className="text-[10px] text-neutral-600">Documents de démonstration</span>
      </div>
      <ul className="mt-3 space-y-2">
        {documents.map((doc) => {
          const meta = CATEGORY_META[doc.category];
          const Icon = meta.icon;
          return (
            <li key={doc.id} className="flex items-center gap-2.5 text-sm">
              <Icon className="h-4 w-4 shrink-0 text-neutral-500" aria-hidden="true" />
              <span className="text-neutral-200">{doc.title}</span>
              <span className="text-[11px] text-neutral-600">
                — {meta.label} · {doc.dateLabel}
              </span>
            </li>
          );
        })}
      </ul>
    </div>
  );
}
