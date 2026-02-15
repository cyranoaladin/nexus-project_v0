import { Loader2 } from "lucide-react";

export default function DashboardLoading() {
  return (
    <div className="min-h-screen bg-surface-darker flex items-center justify-center">
      <div className="text-center">
        <Loader2 className="w-10 h-10 animate-spin text-brand-accent mx-auto mb-4" />
        <p className="text-neutral-400 text-sm">Chargement du tableau de bord...</p>
      </div>
    </div>
  );
}
