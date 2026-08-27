/**
 * "Cette semaine" (brief §5) — zone la plus lisible du dashboard : ce qui est
 * prévu, sans jauge anxiogène. Tous les chiffres viennent de
 * getWeeklySnapshot() (dérivés des séances/tâches réelles du scénario).
 */
import { Calendar, CheckCircle2, FileText, ShieldCheck, Sparkles } from 'lucide-react';
import type { WeeklySnapshot } from '@/lib/demo/utica-2026/selectors';

function pluralize(count: number, singular: string, plural: string): string {
  return count <= 1 ? singular : plural;
}

export function WeeklySnapshotCard({ snapshot }: { snapshot: WeeklySnapshot }) {
  const items = [
    {
      icon: Calendar,
      text: `${snapshot.nexusSessionsCount} ${pluralize(snapshot.nexusSessionsCount, 'séance Nexus programmée', 'séances Nexus programmées')}`,
    },
    snapshot.devoirsToSubmitCount > 0 && {
      icon: FileText,
      text: `${snapshot.devoirsToSubmitCount} ${pluralize(snapshot.devoirsToSubmitCount, 'devoir à rendre', 'devoirs à rendre')}`,
    },
    snapshot.qcmToDoCount > 0 && {
      icon: CheckCircle2,
      text: `${snapshot.qcmToDoCount} ${pluralize(snapshot.qcmToDoCount, 'QCM à réaliser', 'QCM à réaliser')}`,
    },
    snapshot.recommendedResource && {
      icon: Sparkles,
      text: `1 ressource ARIA recommandée — ${snapshot.recommendedResource.title}`,
    },
    {
      icon: ShieldCheck,
      text:
        snapshot.administrativeBlockingCount === 0
          ? 'Aucun document administratif bloquant'
          : `${snapshot.administrativeBlockingCount} action administrative à préparer`,
    },
  ].filter(Boolean) as { icon: typeof Calendar; text: string }[];

  return (
    <div className="rounded-2xl border border-white/10 bg-surface-card p-5">
      <h2 className="text-sm font-semibold uppercase tracking-wide text-neutral-400">Cette semaine</h2>
      <ul className="mt-3 space-y-2.5">
        {items.map((item, i) => (
          <li key={i} className="flex items-start gap-2.5 text-sm text-neutral-200">
            <item.icon className="mt-0.5 h-4 w-4 shrink-0 text-brand-accent" aria-hidden="true" />
            {item.text}
          </li>
        ))}
      </ul>
    </div>
  );
}
