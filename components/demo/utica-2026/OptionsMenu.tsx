'use client';

/**
 * Menu "Options" desktop du chrome candidat (hotfix branding salon §8/§9) :
 * regroupe la réinitialisation manuelle et la transparence discrète sur le
 * profil affiché, pour ne plus dominer la navigation visiteur avec un CTA
 * "Recommencer" central. Sur mobile ces deux actions restent affichées
 * directement dans le panneau (voir DemoChrome) plutôt que nichées ici.
 */
import { useState } from 'react';
import { Info, RotateCcw, Settings } from 'lucide-react';

export function OptionsMenu({ onReset, onShowInfo }: { onReset: () => void; onShowInfo: () => void }) {
  const [open, setOpen] = useState(false);

  return (
    <div className="relative">
      <button
        type="button"
        onClick={() => setOpen((v) => !v)}
        aria-expanded={open}
        aria-haspopup="menu"
        aria-label="Options"
        title="Options"
        className="inline-flex h-9 w-9 items-center justify-center rounded-lg border border-white/10 text-neutral-400 transition-colors hover:bg-white/5 hover:text-neutral-100"
      >
        <Settings className="h-4 w-4" aria-hidden="true" />
      </button>

      {open && (
        <div role="menu" className="absolute right-0 top-11 z-50 w-64 rounded-xl border border-white/10 bg-surface-card p-1.5 shadow-xl">
          <button
            type="button"
            role="menuitem"
            onClick={() => {
              setOpen(false);
              onReset();
            }}
            className="flex w-full items-center gap-2.5 rounded-lg px-3 py-2 text-left text-sm text-neutral-300 hover:bg-white/5"
          >
            <RotateCcw className="h-4 w-4 shrink-0" aria-hidden="true" />
            Réinitialiser l&apos;espace
          </button>
          <button
            type="button"
            role="menuitem"
            onClick={() => {
              setOpen(false);
              onShowInfo();
            }}
            className="flex w-full items-center gap-2.5 rounded-lg px-3 py-2 text-left text-sm text-neutral-300 hover:bg-white/5"
          >
            <Info className="h-4 w-4 shrink-0" aria-hidden="true" />
            À propos des données affichées
          </button>
        </div>
      )}
    </div>
  );
}
