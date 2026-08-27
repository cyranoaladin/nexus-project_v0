/**
 * "Ma carte du Bac" (P1B §1, candidate-spécifique depuis P1C §0) — pas une
 * liste de matières : une carte pédagogique structurée par moment de
 * passage, résolue par le moteur canonique `genererCarteExamen()` (voir
 * lib/demo/utica-2026/regulatory.ts::getDemoBacMap). Chaque item affiche un
 * badge OFFICIEL — jamais fusionné avec un état Nexus (§1.3). Le
 * coefficient reste `AVerifiable` : si le moteur renvoyait un jour
 * "À_VERIFIER" pour ce profil, il s'affiche tel quel, jamais une valeur
 * inventée.
 */
import { BadgeCheck, ShieldCheck } from 'lucide-react';
import type { BacMapSection } from '@/lib/demo/utica-2026/regulatory';

export function BacMapCard({
  sections,
  sourceLabel,
}: {
  sections: BacMapSection[];
  sourceLabel: string;
}) {
  return (
    <div className="rounded-2xl border border-white/10 bg-surface-card p-5">
      <div className="flex items-center justify-between">
        <h2 className="text-sm font-semibold uppercase tracking-wide text-neutral-400">Ma carte du Bac 2027</h2>
        <span className="inline-flex items-center gap-1.5 rounded-full border border-white/10 bg-white/5 px-2.5 py-1 text-[10px] font-medium text-neutral-400">
          <ShieldCheck className="h-3 w-3" aria-hidden="true" />
          Officiel — session 2027
        </span>
      </div>

      <div className="mt-4 grid gap-4 md:grid-cols-3">
        {sections.map((section) => (
          <div key={section.id} className="rounded-xl border border-white/5 bg-surface-darker/40 p-4">
            <p className="text-xs font-semibold text-brand-accent">{section.label}</p>
            {section.subtitle && <p className="mt-0.5 text-[11px] text-neutral-500">{section.subtitle}</p>}
            <ul className="mt-3 space-y-2">
              {section.items.map((item) => (
                <li key={item.id} className="text-xs">
                  <div className="flex items-start justify-between gap-2">
                    <span className="text-neutral-300">
                      {item.label}
                      {item.trackedByNexus && (
                        <span className="ml-1.5 inline-flex items-center gap-1 text-[10px] font-medium text-emerald-400">
                          <BadgeCheck className="h-3 w-3" aria-hidden="true" />
                          Suivi Nexus
                        </span>
                      )}
                    </span>
                    <span className="shrink-0 whitespace-nowrap text-neutral-500">
                      {item.coefficient === 'À_VERIFIER' ? 'coef. à vérifier' : `coef. ${item.coefficient}`}
                    </span>
                  </div>
                  {item.notes.length > 0 && (
                    <p className="mt-0.5 text-[10px] text-neutral-600">{item.notes.join(' ')}</p>
                  )}
                </li>
              ))}
            </ul>
          </div>
        ))}
      </div>

      <p className="mt-3 text-[11px] text-neutral-600">Source : {sourceLabel}</p>
    </div>
  );
}
