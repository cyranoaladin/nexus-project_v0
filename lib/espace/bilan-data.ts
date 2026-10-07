import bank from './bilan-bank.json';
import type { LessonContent, LessonStep } from './lesson-types';

export type BilanLevel = '3e' | '2nde';
export interface BilanQuestion { id: string; text: string; type: string; options?: string[] | null; hint?: string | null; max?: number }
export interface BilanModule { id: string; label: string; description: string; source: string; pages: string; skills: {id: string; text: string}[] }
export interface BilanTask { id: string; module: string; title: string; prompt: string; source: string; pages: string; skills: string[] }
export const bilanData = bank as {
  sources: Record<string, string>; modules: Record<BilanLevel, BilanModule[]>; tasks: BilanTask[];
  sections: { id: string; title: string; intro: string; questions: BilanQuestion[] }[];
  mastery: Record<string, string>; results: Record<string, string>;
};
export const BILAN_CONTENT_VERSION = '2026-09.1';
export function getBilanLevel(slug: string): BilanLevel | null {
  if (slug === 'maths-bilan-septembre-2026-3e') return '3e';
  if (slug === 'maths-bilan-septembre-2026-2nde') return '2nde';
  return null;
}
function step(id: string, title: string, fields: {id:string; label:string}[]): LessonStep {
  return {id,short:title,title,minutes:3,level:'Bilan personnel',concepts:[],intro:'',lesson:'',task:'',starter:null,questions:[],fields,hints:[],takeaway:'',tests:[]};
}
export function getBilanLesson(level: BilanLevel): LessonContent {
  const modules = bilanData.modules[level];
  return {version:BILAN_CONTENT_VERSION,title:`Mon bilan de septembre — ${level === '3e' ? 'Troisième' : 'Seconde'}`,session:'Septembre 2026',duration:30,
    steps:[
      step('scope','Ce que nous avons travaillé',[...modules.map(m=>({id:m.id,label:m.label})),{id:'other',label:'Un autre contenu effectivement travaillé'}]),
      step('mastery','Où j’en suis',modules.flatMap(m=>m.skills.map(s=>({id:s.id,label:s.text})))),
      step('evidence','Mes essais',bilanData.tasks.filter(t=>modules.some(m=>m.id===t.module)).map(t=>({id:t.id,label:t.title}))),
      ...bilanData.sections.map(s=>step(s.id,s.title,s.questions.map(q=>({id:q.id,label:q.text})))),
      step('review','Relire et transmettre',[{id:'confirmed',label:'Je confirme avoir relu mes réponses'}]),
    ]};
}
/** Seules les tâches sur un contenu déclaré travaillé sont proposées. */
export function getEligibleBilanTasks(level: BilanLevel, scope: Record<string,string>, mastery: Record<string,string>): BilanTask[] {
  const modules = new Set(bilanData.modules[level].map(m=>m.id));
  const skillModules = new Map(bilanData.modules[level].flatMap(m => m.skills.map(s => [s.id, m.id] as const)));
  return bilanData.tasks.filter(t=>modules.has(t.module) && scope[t.module] === 'yes' && t.skills.every(id=>mastery[id] !== 'notworked' && scope[skillModules.get(id) ?? ''] === 'yes'));
}
