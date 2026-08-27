/**
 * Badge discret "Données de démonstration — profil fictif" (brief §46).
 * Composant pur, server component — pas d'interactivité nécessaire.
 *
 * Utilise `cn()` (et non une simple concaténation) pour que les classes
 * passées en prop (ex. `hidden lg:inline-flex`) puissent réellement
 * remplacer `inline-flex` — sans fusion via tailwind-merge, les deux
 * classes de display coexistaient dans le DOM et le badge restait visible
 * sur mobile, provoquant une collision avec l'en-tête (trouvé en QA P2 §10).
 */
import { cn } from '@/lib/utils';

export function DemoBadge({ className = '' }: { className?: string }) {
  return (
    <span
      className={cn(
        'inline-flex items-center gap-1.5 rounded-full border border-white/15 bg-white/5 px-3 py-1 text-[11px] font-medium tracking-wide text-neutral-400',
        className,
      )}
    >
      <span className="h-1.5 w-1.5 rounded-full bg-brand-accent" />
      Données de démonstration — profil fictif
    </span>
  );
}
