import fs from 'node:fs';
import path from 'node:path';

const read = (name: string) => {
  const file = path.join(process.cwd(), 'lib/espace', name);
  expect(fs.existsSync(file)).toBe(true);
  return JSON.parse(fs.readFileSync(file, 'utf8'));
};
const base = read('bilan-bank.json');
const tm = read('bilan-terminale-maths.json');

describe('Enrichissements issus des PDF : troisième et Terminale maths', () => {
  test.each(['3e', 'tle-maths'])('%s garde des ajouts structurés, complets et sans collision', level => {
    const data = read(`bilan-enrichment-${level}.json`);
    expect(Object.keys(data).sort()).toEqual(['sources','appendModules','appendSkills','appendTasks','newSections','appendQuestions','appendOptions'].sort());
    const original = level === '3e' ? base : tm;
    const oldModules = level === '3e' ? base.modules['3e'] : tm.modules;
    const modules = [...oldModules.map((m: any) => ({...m, skills:[...m.skills,...(data.appendSkills[m.id] ?? [])]})), ...data.appendModules];
    const skills = modules.flatMap((m: any) => m.skills.map((s: any) => s.id));
    expect(new Set(skills).size).toBe(skills.length);
    const sections = [...original.sections.map((s: any) => ({...s, questions:[...s.questions,...(data.appendQuestions[s.id] ?? [])]})),...data.newSections];
    expect(sections.length + 4).toBeLessThanOrEqual(16);
    for (const section of sections) {
      expect(section.questions.length).toBeGreaterThan(0);
      expect(section.questions.length).toBeLessThanOrEqual(24);
      const ids = section.questions.map((q: any) => q.id);
      expect(new Set(ids).size).toBe(ids.length);
      for (const q of section.questions) {
        expect(q.text.trim()).not.toBe('');
        if(q.priorityOf) {
          const target = section.questions.find((other: any) => other.id === q.priorityOf);
          expect(target?.type).toBe('multi');
          expect(target?.max).toBe(3);
          expect(q.options).toEqual(expect.arrayContaining(target.options));
        }
      }
    }
    const sources = {...original.sources,...data.sources};
    for (const task of data.appendTasks) {
      expect(modules.some((m:any) => m.id === task.module)).toBe(true);
      expect(task.skills.every((id:string) => skills.includes(id))).toBe(true);
      expect(sources[task.source]).toBeTruthy();
      expect(original.tasks.some((t:any) => t.id === task.id)).toBe(false);
    }
    for(const [key, options] of Object.entries(data.appendOptions)) {
      const [sectionId, questionId] = key.split('.');
      const q = original.sections.find((s:any)=>s.id===sectionId)?.questions.find((q:any)=>q.id===questionId);
      expect(q).toBeTruthy();
      expect((options as string[]).every(o=>!q.options.includes(o))).toBe(true);
    }
    const habits = data.newSections.find((s:any)=>s.id==='habits');
    expect(habits.questions.filter((q:any)=>q.type==='scale')).toHaveLength(10);
    expect(data.newSections.find((s:any)=>s.id==='trial-reflection').questions).toHaveLength(2);
  });

  test('troisième couvre les nouveaux domaines et conserve tous les essais anciens', () => {
    const data = read('bilan-enrichment-3e.json');
    expect(data.appendModules.map((m:any)=>m.id)).toEqual(['3-literal','3-thales']);
    expect(data.appendModules.flatMap((m:any)=>m.skills)).toHaveLength(8);
    expect(Object.values(data.appendSkills).flat()).toHaveLength(6);
    expect(data.appendTasks).toHaveLength(6);
    const thales = data.appendTasks.find((t:any)=>t.id==='3-pdf-thales');
    for(const measure of ['AM = 3 cm','AB = 6 cm','AN = 4 cm','BC = 10 cm']) expect(thales.prompt).toContain(measure);
    expect(thales.prompt).toContain('parallèle');
    const corrections = read('bilan-enrichment-3e-corrections.json');
    expect(Object.keys(corrections).sort()).toEqual(data.appendTasks.map((t:any)=>t.id).sort());
    expect(corrections['3-pdf-thales'].expected).toContain('AC = 8 cm');
    expect(corrections['3-pdf-thales'].expected).toContain('MN = 5 cm');
    expect(corrections['3-pdf-sharing'].expected).toContain('42');
    expect(corrections['3-pdf-literal'].expected).toContain('−25');
    expect(JSON.stringify(data)).not.toContain('"expected"');
  });

  test('Terminale transpose les méthodes sans importer les chapitres collège', () => {
    const data = read('bilan-enrichment-tle-maths.json');
    expect(data.appendModules).toEqual([]);
    expect(data.appendSkills).toEqual({});
    expect(data.appendTasks).toEqual([]);
    expect(tm.modules.flatMap((m:any)=>m.skills)).toHaveLength(24);
    expect(JSON.stringify(data)).not.toMatch(/Thalès|triangles semblables|division euclidienne/);
  });
});
