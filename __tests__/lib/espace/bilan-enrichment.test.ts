import { bilanData, getBilanLesson, getBilanSections } from '@/lib/espace/bilan-data';
import { normalizeBilanContent, validateBilanStep } from '@/lib/espace/bilan-work';
import { formatBilanAnswer } from '@/lib/espace/bilan-display';
import { parseWorkContent } from '@/lib/espace/work-content';
import { BILAN_LEVELS } from '@/lib/espace/bilan-profiles';
import legacy from '@/lib/espace/bilan-bank.json';
import maths from '@/lib/espace/bilan-terminale-maths.json';
import nsi from '@/lib/espace/bilan-terminale-nsi.json';

it.each(BILAN_LEVELS)('enrichit %s dans les plafonds et sans rubrique vide', level => {
 const lesson=getBilanLesson(level);
 expect(lesson.steps.map(s=>s.id)).toEqual(expect.arrayContaining(['journey','habits','family','trial-reflection','review']));
 expect(lesson.steps.length).toBeLessThanOrEqual(16);
 for(const s of lesson.steps){expect(s.fields.length).toBeGreaterThan(0);expect(s.fields.length).toBeLessThanOrEqual(24);}
 expect(new Set(lesson.steps.map(s=>s.id)).size).toBe(lesson.steps.length);
});
it.each(BILAN_LEVELS)('conserve les questions historiques et leurs choix %s',level=>{
 const original=level==='tle-maths'?maths.sections:level==='tle-nsi'?nsi.sections:legacy.sections;
 for(const s of original)for(const q of s.questions){
  const enriched=getBilanSections(level).find(x=>x.id===s.id)?.questions.find(x=>x.id===q.id);
  expect(enriched?.text).toBe(q.text);expect(enriched?.type).toBe(q.type);
  for(const o of q.options??[])expect(enriched?.options).toContain(o);
 }
});
it('ajoute un positionnement difficulté sans réinterpréter start',()=>{
 expect(bilanData.mastery.start).toBe(legacy.mastery.start);
 expect(bilanData.mastery.difficulty).toMatch(/difficult/);
});
it('conserve les conditions et la confiance dans une ancienne preuve enrichie',()=>{
 const proof={answer:'trace initiale',retry:'reprise',aid:'Un indice',confidence:'Faible',conditions:'Avec une aide ou une ressource'};
 expect(()=>validateBilanStep('3e','evidence',{fields:{'3-div':JSON.stringify(proof)}})).not.toThrow();
 const rendered=formatBilanAnswer('evidence',JSON.stringify(proof));
 expect(rendered).toContain('Faible');expect(rendered).toContain('Avec une aide ou une ressource');
 expect(rendered).toContain('trace initiale');expect(rendered).toContain('reprise');
});
it.each([{confidence:'excellent'},{conditions:'inconnu'},{confidence:7}])('refuse des métadonnées non prévues %j',extra=>{
 expect(()=>validateBilanStep('3e','evidence',{fields:{'3-div':JSON.stringify({answer:'trace',...extra})}})).toThrow();
});
it.each(['3e','2nde'] as const)('conserve les compétences historiques dans mastery et ajoute une étape stable %s',level=>{
 const defs=getBilanLesson(level).steps;
 expect(defs.find(s=>s.id==='mastery')?.fields.map(f=>f.id)).toEqual(legacy.modules[level].flatMap(m=>m.skills.map(s=>s.id)));
 expect(defs.find(s=>s.id==='mastery-extra')?.fields.length).toBeGreaterThan(0);
});
it('valide les échelles et normalise seulement une priorité devenue incompatible',()=>{
 const section=getBilanSections('2nde').find(s=>s.id==='next')!;
 const multi=section.questions.find(q=>q.id==='pdf-needed-supports');
 const priority=section.questions.find(q=>q.id==='pdf-top-support');
 expect(multi).toBeDefined();expect(priority).toBeDefined();
 if(!multi||!priority) return;
 const selected=multi.options![0];const other=multi.options![1];
 const content=parseWorkContent({v:1,steps:{next:{fields:{[multi.id]:JSON.stringify([selected]),[priority.id]:other,commitment:'Une action conservée'}}}});
 const normalized=normalizeBilanContent('2nde',content);
 expect(normalized.steps.next.fields?.[priority.id]).toBe('');
 expect(normalized.steps.next.fields?.commitment).toBe('Une action conservée');
 expect(()=>validateBilanStep('2nde','next',{fields:{[priority.id]:'Option absente'}})).toThrow();
});

it.each(BILAN_LEVELS)('accepte toutes les nouvelles réponses documentées %s et refuse les options forgées',level=>{
 for(const section of getBilanSections(level))for(const q of section.questions){
  if(q.type==='text') continue;
  for(const option of q.options??[]){
   const value=q.type==='multi'?JSON.stringify([option]):option;
   expect(()=>validateBilanStep(level,section.id,{fields:{[q.id]:value}})).not.toThrow();
  }
  const value=q.type==='multi'?'["réponse forgée"]':'réponse forgée';
  expect(()=>validateBilanStep(level,section.id,{fields:{[q.id]:value}})).toThrow();
 }
});
it('écarte l’essai dont le prérequis supplémentaire est déclaré non travaillé',()=>{
 const task=bilanData.tasks.find(t=>t.id==='3-pdf-thales')!;
 const scope=Object.fromEntries(bilanData.modules['3e'].map(m=>[m.id,'yes']));
 const content={v:1 as const,steps:{scope:{fields:scope},'mastery-extra':{fields:{[task.skills[0]]:'notworked'}},evidence:{fields:{[task.id]:'{"answer":"Trace"}'}}}};
 expect(normalizeBilanContent('3e',content).steps.evidence.fields).toEqual({});
 expect(content.steps.evidence.fields[task.id]).toContain('Trace');
});
