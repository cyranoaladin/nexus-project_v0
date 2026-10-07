import bank from './bilan-bank.json';
import maths from './bilan-terminale-maths.json';
import nsi from './bilan-terminale-nsi.json';
import thirdExtra from './bilan-enrichment-3e.json';
import secondExtra from './bilan-enrichment-2nde.json';
import mathsExtra from './bilan-enrichment-tle-maths.json';
import nsiExtra from './bilan-enrichment-tle-nsi.json';
import { BILAN_LEVELS, getBilanProfile, type BilanLevel } from './bilan-profiles';
export { getBilanProfile, getBilanLevel, type BilanLevel } from './bilan-profiles';
import type { LessonContent, LessonStep } from './lesson-types';

export interface BilanQuestion { id: string; text: string; type: string; options?: string[] | null; hint?: string | null; max?: number; exclusiveOptions?: string[]; priorityOf?: string }
export interface BilanModule { id: string; label: string; description: string; source: string; pages: string; skills: {id: string; text: string}[] }
export interface BilanTask { id: string; module: string; title: string; prompt: string; source: string; pages: string; skills: string[] }
export interface BilanSection { id: string; title: string; intro: string; questions: BilanQuestion[] }
interface Enrichment { sources: Record<string,string>; appendModules: BilanModule[]; appendSkills: Record<string,BilanModule['skills']>; appendTasks:BilanTask[]; newSections:BilanSection[]; appendQuestions:Record<string,BilanQuestion[]>; appendOptions:Record<string,string[]> }
const additions = { '3e':thirdExtra, '2nde':secondExtra, 'tle-maths':mathsExtra, 'tle-nsi':nsiExtra } as Record<BilanLevel,Enrichment>;
const originalModules: Record<BilanLevel,BilanModule[]> = {...bank.modules, 'tle-maths':maths.modules,'tle-nsi':nsi.modules};
const modules = Object.fromEntries(BILAN_LEVELS.map(level=>[level,[...originalModules[level].map(m=>({...m,skills:[...m.skills,...(additions[level].appendSkills[m.id]??[])]})),...additions[level].appendModules]])) as Record<BilanLevel,BilanModule[]>;
export const bilanData = {
 ...bank,
 sections: bank.sections as BilanSection[],
 sources: {...bank.sources,...maths.sources,...nsi.sources,...Object.assign({},...BILAN_LEVELS.map(l=>additions[l].sources))} as Record<string,string>,
 modules,
 tasks:[...bank.tasks,...maths.tasks,...nsi.tasks,...BILAN_LEVELS.flatMap(l=>additions[l].appendTasks)] as BilanTask[],
 mastery:{...bank.mastery,difficulty:'Je rencontre encore des difficultés'} as Record<string,string>,
};
export const BILAN_CONTENT_VERSION = '2026-09.2';
export function getBilanSections(level:BilanLevel):BilanSection[] {
 const base:BilanSection[]=level==='tle-maths'?maths.sections:level==='tle-nsi'?nsi.sections:bank.sections;
 const extra=additions[level];
 return [
  ...base.map(section => ({
   ...section,
   questions: [
    ...section.questions.map(question => {
     const options = extra.appendOptions[`${section.id}.${question.id}`];
     return options ? { ...question, options: [...(question.options ?? []), ...options] } : question;
    }),
    ...(extra.appendQuestions[section.id] ?? []),
   ],
  })),
  ...extra.newSections,
 ];
}
export function isBilanMasteryStep(id:string):boolean {return id==='mastery'||id==='mastery-extra';}
/** Association stable : les réponses historiques ne changent jamais d’étape. */
export function getBilanSkillStep(level:BilanLevel,skillId:string):'mastery'|'mastery-extra' {
 return originalModules[level].some(m=>m.skills.some(s=>s.id===skillId))?'mastery':'mastery-extra';
}
export function getBilanMastery(steps:Record<string,unknown>):Record<string,string> {
 const fields=(id:string)=>(steps[id] as {fields?:Record<string,string>}|undefined)?.fields??{};
 return {...fields('mastery'),...fields('mastery-extra')};
}
function step(id:string,title:string,fields:{id:string;label:string}[]):LessonStep {
 return {id,short:title,title,minutes:3,level:'Bilan personnel',concepts:[],intro:'',lesson:'',task:'',starter:null,questions:[],fields,hints:[],takeaway:'',tests:[]};
}
export function getBilanLesson(level:BilanLevel):LessonContent {
 const ms=bilanData.modules[level];
 const skills=ms.flatMap(m=>m.skills);
 const definitions=[
  step('scope','Ce que nous avons travaillé',[...ms.map(m=>({id:m.id,label:m.label})),{id:'other',label:'Un autre contenu effectivement travaillé'}]),
  step('mastery','Où j’en suis',skills.filter(s=>getBilanSkillStep(level,s.id)==='mastery').map(s=>({id:s.id,label:s.text}))),
  ...(skills.some(s=>getBilanSkillStep(level,s.id)==='mastery-extra')?[step('mastery-extra','Mes autres repères en mathématiques',skills.filter(s=>getBilanSkillStep(level,s.id)==='mastery-extra').map(s=>({id:s.id,label:s.text})))]:[]),
  step('evidence','Mes essais',bilanData.tasks.filter(t=>ms.some(m=>m.id===t.module)).map(t=>({id:t.id,label:t.title}))),
  ...getBilanSections(level).map(s=>step(s.id,s.title,s.questions.map(q=>({id:q.id,label:q.text})))),
  step('review','Relire et transmettre',[{id:'confirmed',label:'Je confirme avoir relu mes réponses'}]),
 ];
 const order=['scope','journey','mastery','mastery-extra','habits','methods','experience','growth','next','family','trial-reflection','evidence','review'];
 return {version:getBilanProfile(level).contentVersion,title:`Mon bilan de septembre — ${getBilanProfile(level).label}`,session:'Septembre 2026',duration:50,steps:definitions.sort((a,b)=>order.indexOf(a.id)-order.indexOf(b.id))};
}
export function getEligibleBilanTasks(level:BilanLevel,scope:Record<string,string>,mastery:Record<string,string>):BilanTask[] {
 const ms=new Set(bilanData.modules[level].map(m=>m.id));
 const skillModules=new Map(bilanData.modules[level].flatMap(m=>m.skills.map(s=>[s.id,m.id] as const)));
 return bilanData.tasks.filter(t=>ms.has(t.module)&&scope[t.module]==='yes'&&t.skills.every(id=>mastery[id]!=='notworked'&&scope[skillModules.get(id)??'']==='yes'));
}
export function getExclusiveBilanChoices(q:BilanQuestion):string[] {
 return ['Je ne souhaite pas répondre','Aucune difficulté précise','Je ne sais pas encore',...(q.exclusiveOptions??[])];
}
