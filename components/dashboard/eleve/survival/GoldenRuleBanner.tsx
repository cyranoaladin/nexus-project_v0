import { Card, CardContent } from '@/components/ui/card';

type GoldenRuleBannerProps = {
  compact?: boolean;
};

export function GoldenRuleBanner({ compact = false }: GoldenRuleBannerProps) {
  return (
    <Card className="border-eaf-indigo/30 bg-eaf-indigo/10">
      <CardContent className="p-4 text-eaf-indigo">
        <p className="font-fraunces text-sm font-semibold">Règle d’or</p>
        <p className="mt-2 text-lg font-semibold text-eaf-text-primary">Le jour J, tu remplis 100 % du QCM.</p>
        <p className="mt-1 text-sm text-eaf-text-secondary">
          {compact ? 'Même au hasard. Une case vide vaut toujours zéro.' : 'Même au hasard. Une case vide rapporte toujours zéro.'}
        </p>
      </CardContent>
    </Card>
  );
}
