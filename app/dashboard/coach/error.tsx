"use client";

import { Button } from "@/components/ui/button";
import { AlertTriangle, RefreshCw } from "lucide-react";

export default function CoachError({
  error,
  reset,
}: {
  error: Error & { digest?: string };
  reset: () => void;
}) {
  return (
    <div className="min-h-screen bg-surface-darker flex items-center justify-center">
      <div className="text-center max-w-md px-4">
        <div className="inline-flex items-center justify-center w-16 h-16 bg-error/15 rounded-full mb-6">
          <AlertTriangle className="w-8 h-8 text-error" aria-hidden="true" />
        </div>
        <h2 className="font-display text-2xl font-bold text-white mb-3">
          Une erreur est survenue
        </h2>
        <p className="text-neutral-400 mb-6 text-sm">
          Votre espace coach n&apos;a pas pu être chargé. Veuillez réessayer.
        </p>
        <Button onClick={reset} variant="outline" className="border-white/20 text-neutral-100 hover:bg-white/10">
          <RefreshCw className="w-4 h-4 mr-2" />
          Réessayer
        </Button>
      </div>
    </div>
  );
}
