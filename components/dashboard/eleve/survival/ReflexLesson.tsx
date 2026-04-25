import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import type { SurvivalReflex } from '@/lib/survival/types';

type ReflexLessonProps = {
  reflex: SurvivalReflex;
};

export function ReflexLesson({ reflex }: ReflexLessonProps) {
  return (
    <Card className="border-eaf-indigo/20 bg-eaf-hero-gradient">
      <CardHeader>
        <CardTitle className="font-fraunces text-lg text-eaf-text-primary">{reflex.title}</CardTitle>
      </CardHeader>
      <CardContent className="space-y-4">
        <p className="rounded-lg border border-eaf-indigo/30 bg-eaf-indigo/10 p-3 text-sm text-eaf-text-primary">{reflex.hook}</p>
        <div>
          <h3 className="font-fraunces text-sm font-semibold text-eaf-text-primary">Quand tu le vois</h3>
          <ul className="mt-2 space-y-1 text-sm text-eaf-text-secondary">
            {reflex.whenToUse.map((item) => (
              <li key={item}>- {item}</li>
            ))}
          </ul>
        </div>
        <div>
          <h3 className="font-fraunces text-sm font-semibold text-eaf-text-primary">Action</h3>
          <ul className="mt-2 space-y-1 text-sm text-eaf-text-secondary">
            {reflex.method.map((item) => (
              <li key={item}>- {item}</li>
            ))}
          </ul>
        </div>
      </CardContent>
    </Card>
  );
}
