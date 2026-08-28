'use client';

/**
 * Transparence discrète sur la nature du profil affiché (hotfix branding
 * salon §8) : jamais affichée automatiquement, accessible uniquement via une
 * action volontaire du visiteur (menu Options desktop, lien dédié mobile).
 * Aucune API, aucun tracking — état local uniquement.
 */
import { Info, X } from 'lucide-react';

export const DATA_DISCLOSURE_TEXT =
  "Cette présentation utilise un profil d'exemple afin de préserver les données personnelles. Aucune donnée d'un élève réel n'est affichée.";

export function InfoDisclosureDialog({ onClose }: { onClose: () => void }) {
  return (
    <div
      role="dialog"
      aria-modal="true"
      aria-label="À propos des données affichées"
      className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 p-4"
    >
      <div className="max-w-sm rounded-2xl border border-white/10 bg-surface-card p-5 shadow-2xl">
        <div className="flex items-start justify-between gap-3">
          <p className="flex items-center gap-2 text-sm font-semibold text-neutral-100">
            <Info className="h-4 w-4 text-brand-accent" aria-hidden="true" />
            À propos des données affichées
          </p>
          <button type="button" onClick={onClose} aria-label="Fermer" className="text-neutral-500 hover:text-neutral-200">
            <X className="h-4 w-4" aria-hidden="true" />
          </button>
        </div>
        <p className="mt-3 text-sm text-neutral-400">{DATA_DISCLOSURE_TEXT}</p>
      </div>
    </div>
  );
}
