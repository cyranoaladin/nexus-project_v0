import { bilanData, getBilanSections, getBilanLesson, getBilanLevel, getEligibleBilanTasks, type BilanLevel } from '@/lib/espace/bilan-data';
import { isBilanActivitySlug, lessonHref } from '@/lib/espace/lesson-routes';
import { validateBilanStep, normalizeBilanContent } from '@/lib/espace/bilan-work';
import { bilanViewerSteps } from '@/lib/espace/bilan-display';
import legacy from '@/lib/espace/bilan-bank.json';

const profiles = [
  ['tle-maths', 'maths-bilan-septembre-2026-terminale', 'Mathématiques'],
  ['tle-nsi', 'nsi-bilan-septembre-2026-terminale', 'NSI'],
] as const;
describe('bilans Terminale distincts et conditionnels', () => {
  it.each(profiles)('reconnaît %s comme bilan attribuable distinct', (level, slug) => {
    expect(getBilanLevel(slug)).toBe(level);
    expect(isBilanActivitySlug(slug)).toBe(true);
    expect(lessonHref(slug, 'séance 1')).toBe(`/espace/bilan/${level}?seance=s%C3%A9ance%201`);
  });
  it.each(profiles)('propose un parcours %s complet, sourcé et compatible avec le stockage', (profile, _slug, subject) => {
    const level = profile as BilanLevel;
    const lesson = getBilanLesson(level);
    expect(lesson.title).toContain('Terminale');
    expect(lesson.title).toContain(subject);
    expect(lesson.steps.map(s => s.id)).toEqual(['scope','mastery','evidence','methods','experience','growth','next','review']);
    for (const step of lesson.steps) {
      expect(step.fields.length).toBeGreaterThan(0);
      expect(step.fields.length).toBeLessThanOrEqual(24);
      expect(new Set(step.fields.map(f=>f.id)).size).toBe(step.fields.length);
    }
    const modules = bilanData.modules[level];
    expect(modules.length).toBeGreaterThanOrEqual(4);
    const skillIds = new Set(modules.flatMap(m=>m.skills.map(s=>s.id)));
    for (const m of modules) {
      expect(bilanData.sources[m.source]).toMatch(/\.pdf$/);
      expect(m.pages).toBeTruthy();
    }
    const scope = Object.fromEntries(modules.map(m=>[m.id,'yes']));
    const tasks = getEligibleBilanTasks(level,scope,{});
    expect(tasks).toHaveLength(8);
    expect(getEligibleBilanTasks(level,{},{})).toEqual([]);
    for (const t of tasks) {
      expect(t.prompt.trim()).not.toBe('');
      expect(bilanData.sources[t.source]).toMatch(/\.pdf$/);
      expect(t.skills.every(id=>skillIds.has(id))).toBe(true);
      expect(t).not.toHaveProperty('expected');
      expect(getEligibleBilanTasks(level,scope,{[t.skills[0]]:'notworked'}).map(x=>x.id)).not.toContain(t.id);
    }
  });
  it.each(profiles)('isole les champs du profil %s et retire les essais devenus hors périmètre', profile => {
    const level = profile as BilanLevel;
    const modules = bilanData.modules[level];
    const module = modules[0];
    const scope = Object.fromEntries(modules.map(m=>[m.id,'yes']));
    const task = getEligibleBilanTasks(level,scope,{})[0];
    expect(()=>validateBilanStep(level,'scope',{fields:{[module.id]:'yes'}})).not.toThrow();
    expect(()=>validateBilanStep(level,'scope',{fields:{'3-arith':'yes'}})).toThrow();
    expect(()=>validateBilanStep('3e','scope',{fields:{[module.id]:'yes'}})).toThrow();
    expect(()=>validateBilanStep(level,'methods',{fields:{frequency:'Tous les jours'}})).toThrow();
    const normalized = normalizeBilanContent(level,{v:1,steps:{scope:{fields:{}},evidence:{fields:{[task.id]:JSON.stringify({answer:'essai'})}}}});
    expect(normalized.steps.evidence.fields).toEqual({});
    const viewer = bilanViewerSteps(level);
    expect(viewer.find(s=>s.id==='mastery')?.fields[0].scopeModule).toBe(module.id);
  });
  it('préserve intégralement les définitions historiques et leur version', () => {
    for (const level of ['3e','2nde'] as const) {
      expect(bilanData.modules[level]).toEqual(legacy.modules[level]);
      expect(getBilanLesson(level).version).toBe('2026-09.1');
      for (const section of legacy.sections) expect(getBilanLesson(level).steps.find(s=>s.id===section.id)?.fields).toEqual(section.questions.map(q=>({id:q.id,label:q.text})));
    }
    expect(bilanData.tasks.filter(t=>!t.id.startsWith('tm-')&&!t.id.startsWith('tn-'))).toEqual(legacy.tasks);
  });
});

describe('réponses transversales Terminale', () => {
  it.each(['tle-maths','tle-nsi'] as const)('valide tous les choix %s et refuse les choix de l’autre matière', level => {
    for (const section of getBilanSections(level)) for (const q of section.questions) {
      expect(q.type).toMatch(/^(radio|multi|text)$/);
      for (const option of q.options ?? []) {
        expect(()=>validateBilanStep(level,section.id,{fields:{[q.id]:q.type === 'multi' ? JSON.stringify([option]) : option}})).not.toThrow();
      }
      if(q.type === 'multi') expect(bilanViewerSteps(level).find(s=>s.id===section.id)?.fields.find(f=>f.id===q.id)?.format).toBe('multi');
      expect(()=>validateBilanStep(level==='tle-maths'?'tle-nsi':'tle-maths',section.id,{fields:{[q.id]:'injection'}})).toThrow();
    }
  });
  it('ne propose qu’une seule formulation de refus en NSI', () => {
    expect(JSON.stringify(getBilanSections('tle-nsi'))).not.toContain('Je préfère ne pas répondre');
  });
  it('ne permet pas de déclarer à la fois une aide et aucune aide', () => {
    expect(()=>validateBilanStep('tle-nsi','methods',{fields:{'tn-aides':JSON.stringify(['Mémo ou livret','Aucune de ces aides sur cette période'])}})).toThrow();
    expect(()=>validateBilanStep('tle-nsi','experience',{fields:{'tn-supports':JSON.stringify(['Reserve et Minuteur','Je ne sais plus'])}})).toThrow();
  });
});
