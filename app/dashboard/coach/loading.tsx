import { Loader2 } from "lucide-react";

export default function CoachLoading() {
  return (
    <div className="min-h-screen bg-surface-darker flex items-center justify-center">
      <div className="text-center">
        <Loader2 className="w-10 h-10 animate-spin text-brand-accent mx-auto mb-4" />
        <p className="text-neutral-400 text-sm">Chargement de votre espace coach...</p>
      </div>
    </div>
  );
}
