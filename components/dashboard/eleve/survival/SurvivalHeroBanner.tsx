import { CalendarDays, Target } from 'lucide-react';
import { Card, CardContent } from '@/components/ui/card';

type SurvivalHeroBannerProps = {
  examDate: Date;
  noteToday: number;
  noteTarget?: number;
};

export function SurvivalHeroBanner({ examDate, noteToday, noteTarget = 8 }: SurvivalHeroBannerProps) {
  const daysLeft = Math.max(0, Math.ceil((examDate.getTime() - Date.now()) / (24 * 60 * 60 * 1000)));

  return (
    <Card className="border-brand-accent/20 bg-surface-card">
      <CardContent className="grid gap-4 p-4 sm:grid-cols-3">
        <div className="rounded-lg border border-white/10 bg-white/5 p-4">
          <div className="flex items-center gap-2 text-sm text-neutral-300">
            <CalendarDays className="h-4 w-4 text-brand-accent" aria-hidden="true" />
            Compteur
          </div>
          <p className="mt-2 text-2xl font-semibold text-white">J-{daysLeft}</p>
        </div>
        <div className="rounded-lg border border-white/10 bg-white/5 p-4">
          <p className="text-sm text-neutral-300">Note potentielle aujourd'hui</p>
          <p className="mt-2 text-2xl font-semibold text-white">{noteToday} / 20</p>
        </div>
        <div className="rounded-lg border border-warning/30 bg-warning/10 p-4">
          <div className="flex items-center gap-2 text-sm text-warning">
            <Target className="h-4 w-4" aria-hidden="true" />
            Cible
          </div>
          <p className="mt-2 text-2xl font-semibold text-white">{noteTarget} / 20</p>
        </div>
      </CardContent>
    </Card>
  );
}
