import { Card, CardContent } from '@/components/ui/card';

export function GoldenRuleBanner() {
  return (
    <Card className="border-warning/30 bg-warning/10">
      <CardContent className="p-4">
        <p className="text-sm font-semibold text-warning">Regle d'or</p>
        <p className="mt-2 text-lg font-semibold text-white">Le jour J, tu remplis 100 % du QCM.</p>
        <p className="mt-1 text-sm text-neutral-200">Meme au hasard. Une case vide rapporte toujours zero.</p>
      </CardContent>
    </Card>
  );
}
