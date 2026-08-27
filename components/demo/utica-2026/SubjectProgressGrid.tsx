/**
 * Progression par matière (brief §7 / §18) — pas de pourcentage sans
 * signification : chaque compétence porte un niveau explicite, sobre,
 * jamais gamifié.
 */
import { Badge } from '@/components/ui/badge';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import type { SubjectProgressView } from '@/lib/demo/utica-2026/selectors';
import type { CompetencyLevel } from '@/lib/demo/utica-2026/types';

const LEVEL_DOT: Record<CompetencyLevel, string> = {
  Maîtrisé: 'bg-emerald-400',
  'À consolider': 'bg-amber-400',
  Fragile: 'bg-orange-400',
  'Très fragile': 'bg-red-400',
  'Non encore vu': 'bg-neutral-600',
};

function CompetencyRow({ label, level }: { label: string; level: CompetencyLevel }) {
  return (
    <li className="flex items-center justify-between gap-3 text-xs">
      <span className="text-neutral-300">{label}</span>
      <span className="inline-flex items-center gap-1.5 whitespace-nowrap text-neutral-400">
        <span className={`h-1.5 w-1.5 rounded-full ${LEVEL_DOT[level]}`} aria-hidden="true" />
        {level}
      </span>
    </li>
  );
}

export function SubjectProgressGrid({ tracks }: { tracks: SubjectProgressView[] }) {
  return (
    <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
      {tracks.map((track) => (
        <Card key={track.subject}>
          <CardHeader className="pb-2">
            <div className="flex items-center justify-between">
              <CardTitle className="text-base">{track.label}</CardTitle>
              <Badge variant="outline">{track.lastResultLabel}</Badge>
            </div>
          </CardHeader>
          <CardContent className="space-y-3 pt-0">
            <div className="text-xs text-neutral-500">
              En cours : <span className="text-neutral-300">{track.currentChapter}</span>
            </div>
            <div className="text-xs text-neutral-500">
              Prochaine étape : <span className="text-neutral-300">{track.nextStep}</span>
            </div>
            <ul className="space-y-1.5 border-t border-white/5 pt-2.5">
              {track.competencies.map((c) => (
                <CompetencyRow key={c.label} label={c.label} level={c.level} />
              ))}
            </ul>
            <p className="text-[11px] text-neutral-600">Enseignant référent : {track.teacherFirstName}</p>
          </CardContent>
        </Card>
      ))}
    </div>
  );
}
