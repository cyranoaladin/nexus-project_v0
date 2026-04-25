import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import type { SurvivalReflex } from '@/lib/survival/types';

type ReflexLessonProps = {
  reflex: SurvivalReflex;
};

export function ReflexLesson({ reflex }: ReflexLessonProps) {
  return (
    <Card className="border-white/10 bg-surface-card">
      <CardHeader>
        <CardTitle className="text-lg text-white">{reflex.title}</CardTitle>
      </CardHeader>
      <CardContent className="space-y-4">
        <p className="rounded-lg border border-brand-accent/20 bg-brand-accent/10 p-3 text-sm text-white">{reflex.hook}</p>
        <div>
          <h3 className="text-sm font-semibold text-neutral-200">Quand tu le vois</h3>
          <ul className="mt-2 space-y-1 text-sm text-neutral-300">
            {reflex.whenToUse.map((item) => (
              <li key={item}>- {item}</li>
            ))}
          </ul>
        </div>
        <div>
          <h3 className="text-sm font-semibold text-neutral-200">Action</h3>
          <ul className="mt-2 space-y-1 text-sm text-neutral-300">
            {reflex.method.map((item) => (
              <li key={item}>- {item}</li>
            ))}
          </ul>
        </div>
      </CardContent>
    </Card>
  );
}
