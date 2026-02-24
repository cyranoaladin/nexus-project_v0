"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { Button } from "@/components/ui/button";
import { ClipboardCheck, X } from "lucide-react";

/**
 * Banner displayed on the parent dashboard encouraging them to complete
 * the free diagnostic assessment if they haven't done so yet.
 *
 * Dismiss state is persisted in DB via /api/bilan-gratuit/status and /dismiss.
 */
export function BilanGratuitBanner() {
  const [visible, setVisible] = useState(false);

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
    setVisible(false);
    try {
      await fetch("/api/bilan-gratuit/dismiss", { method: "POST" });
    } catch {
      // Silently ignore network errors — banner is already hidden
    }
  };

  if (!visible) return null;

  return (
    <div className="mb-6 rounded-lg border border-amber-500/30 bg-amber-500/10 p-4 flex flex-col sm:flex-row items-start sm:items-center justify-between gap-3">
      <div className="flex items-start gap-3">
        <ClipboardCheck className="w-5 h-5 text-amber-400 mt-0.5 flex-shrink-0" aria-hidden="true" />
        <div>
          <h3 className="font-semibold text-amber-200 text-sm sm:text-base">
            Complétez le Bilan Diagnostic Gratuit
          </h3>
          <p className="text-xs sm:text-sm text-amber-300/80 mt-1">
            Obtenez une analyse personnalisée des besoins de votre enfant et nos recommandations pédagogiques.
          </p>
        </div>
      </div>
      <div className="flex items-center gap-2 ml-8 sm:ml-0 flex-shrink-0">
        <Button asChild size="sm" className="text-xs sm:text-sm">
          <Link href="/bilan-gratuit">
            Faire le bilan
          </Link>
        </Button>
        <Button
          variant="ghost"
          size="sm"
          onClick={handleDismiss}
          className="text-amber-400/60 hover:text-amber-300 hover:bg-amber-500/10 text-xs"
          aria-label="Fermer la bannière"
        >
          <X className="w-4 h-4" />
          <span className="hidden sm:inline ml-1">Plus tard</span>
        </Button>
      </div>
    </div>
  );
}
