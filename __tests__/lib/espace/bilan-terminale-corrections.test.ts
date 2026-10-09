import { readFileSync } from 'node:fs';
import { bilanData } from '@/lib/espace/bilan-data';
import { bilanCorrections } from '@/lib/espace/bilan-corrections';
import { BILAN_LEVELS } from '@/lib/espace/bilan-profiles';

it('fournit une correction pédagogique réservée au serveur pour chaque essai', () => {
  for (const task of bilanData.tasks) {
    expect(bilanCorrections[task.id]?.expected.length).toBeGreaterThan(15);
    expect(bilanCorrections[task.id]?.focus.length).toBeGreaterThan(15);
  }
  expect(readFileSync('lib/espace/bilan-corrections.ts','utf8')).toContain("import 'server-only'");
  expect(readFileSync('lib/espace/bilan-data.ts','utf8')).not.toContain('corrections');
});
it('ne mélange pas les identifiants des thèmes, compétences et essais des quatre parcours', () => {
  const ids = BILAN_LEVELS.flatMap(level => bilanData.modules[level].flatMap(m=>[m.id,...m.skills.map(s=>s.id)]));
  expect(new Set(ids).size).toBe(ids.length);
  expect(new Set(bilanData.tasks.map(t=>t.id)).size).toBe(bilanData.tasks.length);
});
