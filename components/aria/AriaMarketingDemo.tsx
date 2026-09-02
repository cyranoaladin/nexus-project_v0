import { MessageCircle, Sparkles } from 'lucide-react';

export function AriaMarketingDemo() {
  return (
    <div className="rounded-2xl border border-white/10 bg-white/5 p-4 text-left" aria-label="Exemple statique de dialogue ARIA">
      <div className="mb-3 flex items-center gap-2 text-lux-gold-wash">
        <Sparkles className="h-4 w-4" aria-hidden="true" />
        <span className="text-sm font-semibold">Exemple de dialogue</span>
      </div>
      <p className="rounded-xl bg-white/5 p-3 text-sm text-lux-on-dark">
        <strong>Élève :</strong> Comment choisir la bonne méthode pour cet exercice ?
      </p>
      <p className="mt-2 rounded-xl border border-lux-gold/20 bg-lux-gold/5 p-3 text-sm text-lux-on-dark">
        <strong>ARIA :</strong> Commençons par identifier les données, l’objectif et la notion mobilisée.
      </p>
      <p className="mt-3 flex items-center gap-2 text-xs text-lux-on-dark-muted">
        <MessageCircle className="h-3.5 w-3.5" aria-hidden="true" />
        Démonstration statique — aucune conversation ni donnée élève.
      </p>
    </div>
  );
}
