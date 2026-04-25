import type { ReactNode } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';

type LivretStmgSection = {
  id: string;
  title: string;
  children: ReactNode;
};

type LivretStmgProps = {
  sections: LivretStmgSection[];
};

export function LivretStmg({ sections }: LivretStmgProps) {
  return (
    <div className="grid grid-cols-1 gap-4 md:grid-cols-2">
      {sections.map((section) => (
        <Card key={section.id} className="border-white/10 bg-surface-card">
          <CardHeader>
            <CardTitle className="text-base text-white">{section.title}</CardTitle>
          </CardHeader>
          <CardContent className="text-sm text-neutral-300">{section.children}</CardContent>
        </Card>
      ))}
    </div>
  );
}
