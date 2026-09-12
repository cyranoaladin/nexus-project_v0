"use client";

import { useEffect, useState } from "react";
import { Button } from "@/components/ui/button";
import { ClipboardCheck, X } from "lucide-react";

type BilanGratuitBannerProps = {
  hasChildren?: boolean;
  /**
   * The banner only ever renders for an authenticated parent (it reads
   * /api/bilan-gratuit/status, which requires a session) -- so its CTA must
   * send them to their own children flow, never to
   * the public /bilan-gratuit registration form, which assumes an
   * anonymous visitor and silently no-ops on an already-registered email.
   */
  onGoToChildren: () => void;
};

/**
 * Banner displayed on the parent dashboard encouraging them to complete
 * the free diagnostic assessment if they haven't done so yet.
 *
 * Dismiss state is persisted in DB via /api/bilan-gratuit/status and /dismiss.
 */
export function BilanGratuitBanner({ hasChildren = false, onGoToChildren }: BilanGratuitBannerProps) {
  const [visible, setVisible] = useState(false);
  const [dismissing, setDismissing] = useState(false);
  const [dismissError, setDismissError] = useState(false);

  useEffect(() => {
    fetch("/api/bilan-gratuit/status")
      .then((r) => r.json())
      .then((d) => {
        if (!d.completed && !d.dismissed) {
          setVisible(true);
        }
      })
      .catch(() => {
        // API unavailable — hide banner to avoid broken UX
      });
  }, []);

  const handleDismiss = async () => {
    setDismissing(true);
    setDismissError(false);
    const controller = new AbortController();
    const deadline = window.setTimeout(() => controller.abort(), 10_000);
    try {
      const response = await fetch("/api/bilan-gratuit/dismiss", { method: "POST", signal: controller.signal });
      // Complete the response lifecycle and confirm persistence, not merely
      // receipt of headers. An unread streamed response can remain unfinished
      // in Chromium, and a failed write must leave a usable retry action.
      const acknowledgement = await response.json();
      if (!response.ok || acknowledgement?.dismissed !== true) throw new Error('DISMISS_UNCONFIRMED');
      setVisible(false);
    } catch {
      setDismissError(true);
    } finally {
      window.clearTimeout(deadline);
      setDismissing(false);
    }
  };

  if (!visible) return null;

  return (
    <div className="mb-6 rounded-lg border border-amber-500/30 bg-amber-500/10 p-4 flex flex-col sm:flex-row items-start sm:items-center justify-between gap-3">
      <div className="flex items-start gap-3">
        <ClipboardCheck className="w-5 h-5 text-amber-400 mt-0.5 flex-shrink-0" aria-hidden="true" />
        <div>
          <h2 className="font-semibold text-amber-200 text-sm sm:text-base">
            Complétez le Bilan Diagnostic Gratuit
          </h2>
          <p className="text-xs sm:text-sm text-amber-300/80 mt-1">
            Obtenez une analyse personnalisée des besoins de votre enfant et nos recommandations pédagogiques.
          </p>
          {dismissError && <p role="alert" className="text-xs sm:text-sm text-amber-200 mt-1">Impossible de fermer la bannière. Réessayez.</p>}
        </div>
      </div>
      <div className="flex items-center gap-2 ml-8 sm:ml-0 flex-shrink-0">
        <Button size="sm" className="text-xs sm:text-sm" onClick={onGoToChildren}>
          {hasChildren ? 'Voir le lien de votre enfant' : 'Demander l’ajout de votre enfant'}
        </Button>
        <Button
          variant="ghost"
          size="sm"
          onClick={handleDismiss}
          disabled={dismissing}
          className="text-amber-200 hover:text-amber-100 hover:bg-amber-500/10 text-xs"
          aria-label="Fermer la bannière"
        >
          <X className="w-4 h-4" />
          <span className="hidden sm:inline ml-1">Plus tard</span>
        </Button>
      </div>
    </div>
  );
}
