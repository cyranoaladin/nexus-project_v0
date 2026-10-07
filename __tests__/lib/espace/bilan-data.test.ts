import { bilanData, getBilanLesson, getEligibleBilanTasks } from '@/lib/espace/bilan-data';

describe('banque du bilan de septembre', () => {
  it.each(['3e', '2nde'] as const)('respecte stockage et niveau %s', level => {
    const lesson = getBilanLesson(level);
    expect(lesson.steps).toHaveLength(8);
    expect(new Set(lesson.steps.map(s => s.id)).size).toBe(8);
    for (const step of lesson.steps) {
      expect(step.fields.length).toBeLessThanOrEqual(24);
      expect(new Set(step.fields.map(f => f.id)).size).toBe(step.fields.length);
    }
    expect(bilanData.modules[level].flatMap(m => m.skills)).toHaveLength(16);
  });
  it('ne déduit jamais le travail réalisé de la présence du livret', () => {
    expect(getEligibleBilanTasks('3e', {}, {})).toEqual([]);
    expect(getEligibleBilanTasks('2nde', {'2-calc':'unsure'}, {})).toEqual([]);
    expect(getEligibleBilanTasks('2nde', {'3-arith':'yes'}, {})).toEqual([]);
  });
  it('exclut un essai si un prérequis n’a pas été travaillé, même dans un autre module', () => {
    const tasks = getEligibleBilanTasks('3e', {'3-reduce':'yes'}, {'3-factors':'notworked'});
    expect(tasks.map(t => t.id)).not.toContain('3-reduce-task');
    expect(getEligibleBilanTasks('3e', {'3-reduce':'yes', '3-arith':'no'}, {}).map(t=>t.id)).not.toContain('3-reduce-task');
    expect(getEligibleBilanTasks('3e', {'3-reduce':'yes', '3-arith':'yes'}, {}).map(t=>t.id)).toContain('3-reduce-task');
  });
  it('référence chaque question mathématique sans exposer son corrigé', () => {
    for (const t of bilanData.tasks) {
      expect(bilanData.sources[t.source]).toMatch(/\.pdf$/);
      expect(t.pages.length).toBeGreaterThan(0);
      expect(t.skills.length).toBeGreaterThan(0);
      expect(t).not.toHaveProperty('expected');
      expect(t).not.toHaveProperty('focus');
    }
  });
  it('couvre méthodes, fonctionnement, progrès et attentes avec au plus deux priorités', () => {
    expect(bilanData.sections.flatMap(s=>s.questions)).toHaveLength(33);
    expect(bilanData.sections.find(s=>s.id==='next')?.questions.find(q=>q.id==='priorities')?.max).toBe(2);
  });
});
