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
    <Card className="border-eaf-indigo/20 bg-eaf-hero-gradient">
      <CardContent className="grid gap-4 p-4 sm:grid-cols-3">
        <div className="rounded-lg border border-eaf-indigo/20 bg-eaf-indigo/10 p-4">
          <div className="flex items-center gap-2 text-sm text-eaf-text-secondary">
            <CalendarDays className="h-4 w-4 text-eaf-orange" aria-hidden="true" />
            Compteur
          </div>
          <p className="mt-2 font-fraunces text-2xl font-semibold text-eaf-text-primary">J-{daysLeft}</p>
        </div>
        <div className="rounded-lg border border-eaf-indigo/20 bg-eaf-indigo/10 p-4">
          <p className="text-sm text-eaf-text-secondary">Note potentielle aujourd’hui</p>
          <p className="mt-2 font-fraunces text-2xl font-semibold text-eaf-text-primary">{noteToday} / 20</p>
        </div>
        <div className="rounded-lg border border-eaf-amber/30 bg-eaf-amber/10 p-4">
          <div className="flex items-center gap-2 text-sm text-eaf-amber">
            <Target className="h-4 w-4" aria-hidden="true" />
            Cible
          </div>
          <p className="mt-2 font-fraunces text-2xl font-semibold text-eaf-text-primary">{noteTarget} / 20</p>
        </div>
      </CardContent>
    </Card>
  );
}
