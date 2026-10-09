/** @jest-environment node */
import fs from 'node:fs';
import path from 'node:path';
import bank from '@/lib/espace/bilan-bank.json';
import nsi from '@/lib/espace/bilan-terminale-nsi.json';

type Question = { id: string; text: string; type: string; options?: string[]; max?: number; priorityOf?: string; exclusiveOptions?: string[] };
type Module = { id: string; skills: {id:string; text:string}[] };
type Enrichment = { sources:Record<string,string>; appendModules:Module[]; appendSkills:Record<string,Module['skills']>; appendTasks:{id:string;module:string;skills:string[];source:string;pages:string}[]; newSections:{id:string;title:string;intro:string;questions:Question[]}[];appendQuestions:Record<string,Question[]>;appendOptions:Record<string,string[]> };
function read(level:string):Enrichment {
  const filename=path.join(process.cwd(),`lib/espace/bilan-enrichment-${level}.json`);
  expect(fs.existsSync(filename)).toBe(true);
  return JSON.parse(fs.readFileSync(filename,'utf8'));
}

describe.each(['2nde','tle-nsi'])('enrichissement PDF %s',level=>{
 it('fournit les données additives, les limites de réponse et une priorité parmi les aides',()=>{
  const data=read(level);
  expect(Object.keys(data).sort()).toEqual(['sources','appendModules','appendSkills','appendTasks','newSections','appendQuestions','appendOptions'].sort());
  expect(data.sources['pdf-seconde-2026']).toBe('Nexus_Bilan_Septembre_2026_Seconde.pdf');
  expect(data.newSections.map(s=>s.id)).toEqual(['journey','habits','family','trial-reflection']);
  const original=level==='2nde'?bank.sections:nsi.sections;
  for(const section of data.newSections){expect(section.intro.trim()).not.toBe('');expect(section.questions.length).toBeGreaterThan(0);expect(section.questions.length).toBeLessThanOrEqual(24);}
  for(const [id,addition] of Object.entries(data.appendQuestions)){
   const old=original.find(s=>s.id===id)!;
   expect(old).toBeDefined();expect(old.questions.length+addition.length).toBeLessThanOrEqual(24);
   expect(new Set([...old.questions,...addition].map(q=>q.id)).size).toBe(old.questions.length+addition.length);
  }
  for(const questions of [...data.newSections.map(s=>s.questions),...Object.values(data.appendQuestions)])for(const q of questions){
   expect(['text','radio','multi','scale']).toContain(q.type);expect(q.id.length).toBeLessThanOrEqual(64);expect(q.text.trim()).not.toBe('');
   if(q.type!=='text'){expect(q.options!.length).toBeGreaterThan(1);expect(new Set(q.options).size).toBe(q.options!.length);}
   if(q.type==='multi')expect(q.max).toBeGreaterThan(0);
   if(q.priorityOf){const target=questions.find(x=>x.id===q.priorityOf)!;expect(target?.type).toBe('multi');expect(target.max).toBe(3);expect(q.options).toEqual(expect.arrayContaining(target.options!));}
  }
  const prefix=level==='2nde'?'pdf-':'tn-pdf-';
  expect(data.appendQuestions.next.find(q=>q.id===`${prefix}top-support`)?.priorityOf).toBe(`${prefix}needed-supports`);
  expect(data.newSections.find(s=>s.id==='trial-reflection')?.questions.map(q=>q.id)).toEqual([`${prefix}before-trials`,`${prefix}after-position`]);
  for(const key of Object.keys(data.appendOptions)){const [sid,qid]=key.split('.');expect(original.find(s=>s.id===sid)?.questions.some(q=>q.id===qid)).toBe(true);}
 });
 it('conserve le périmètre disciplinaire et associe chaque essai à des compétences existantes',()=>{
  const data=read(level);const base=level==='2nde'?bank.modules['2nde']:nsi.modules;
  const modules=[...base,...data.appendModules].map(m=>({...m,skills:[...m.skills,...(data.appendSkills[m.id]??[])]}));
  const skillIds=modules.flatMap(m=>m.skills.map(s=>s.id));expect(new Set(skillIds).size).toBe(skillIds.length);
  if(level==='2nde'){expect(skillIds).toHaveLength(30);expect(data.appendTasks).toHaveLength(6);expect(data.appendModules[0].id).toBe('2-literal');}
  else{expect(data.appendModules).toEqual([]);expect(data.appendSkills).toEqual({});expect(data.appendTasks).toEqual([]);expect(skillIds).toHaveLength(22);}
  for(const t of data.appendTasks){expect(modules.some(m=>m.id===t.module)).toBe(true);expect(t.skills.length).toBeGreaterThan(0);for(const s of t.skills)expect(skillIds).toContain(s);expect(data.sources[t.source]).toBeTruthy();expect(t.pages).toMatch(/^[78]$/);}
  expect(JSON.stringify(data)).not.toContain('"expected"');expect(JSON.stringify(data)).not.toContain('privateTeacherCorrections');
 });
});

it('isole les six corrigés et leurs observations didactiques hors de la banque publique',()=>{
 const data=read('2nde');const file=path.join(process.cwd(),'lib/espace/bilan-enrichment-2nde-corrections.json');expect(fs.existsSync(file)).toBe(true);
 const corrections=JSON.parse(fs.readFileSync(file,'utf8'));
 expect(Object.keys(corrections).sort()).toEqual(data.appendTasks.map(t=>t.id).sort());
 for(const correction of Object.values(corrections) as {expected:string;focus:string}[]){expect(correction.expected.length).toBeGreaterThan(30);expect(correction.focus.length).toBeGreaterThan(30);}
});

it('demande explicitement l’utilité des corrections en Seconde, distincte de la façon de les reprendre',()=>{
 const experience=read('2nde').appendQuestions.experience;
 const question=experience.find(q=>q.id==='pdf-corrections-useful');
 expect(question).toBeDefined();
 expect(question?.options).toContain('Non concerné / pas d’avis');
});
