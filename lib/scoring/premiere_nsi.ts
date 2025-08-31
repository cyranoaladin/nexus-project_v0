import { QcmQuestion } from "./qcmData";
import qcmJson from "@/data/qcm_snt_for_nsi_premiere.json";

function idxToKey(idx: number): string { return ["A","B","C","D"][idx] ?? "A"; }

function domainLabel(d: string): string {
  switch (d) {
    case 'TypesBase': return 'Types de base';
    case 'TypesConstruits': return 'Types construits';
    case 'Algo': return 'Algorithmique';
    case 'LangagePython': return 'Langage Python';
    case 'TablesDonnees': return 'Tables de données';
    case 'IHMWeb': return 'IHM Web';
    case 'Reseaux': return 'Réseaux';
    case 'ArchOS': return 'Architecture & OS';
    case 'HistoireEthique': return 'Histoire & Éthique';
    default: return d;
  }
}

export const NSI_ORDER = [
  'TypesBase','TypesConstruits','Algo','LangagePython','TablesDonnees','IHMWeb','Reseaux','ArchOS','HistoireEthique'
] as const;

export const QCM_NSI_PREMIERE_QUESTIONS: QcmQuestion[] = (qcmJson as any).questions.map((q: any) => ({
  id: q.id,
  domain: q.domain, // garder la clé technique pour scoreQCM; affichage friendly via adapter
  weight: q.weight,
  prompt: q.statement,
  type: 'single',
  options: (q.options || []).map((label: string, i: number) => ({ key: idxToKey(i), label })),
  correct: idxToKey(q.answer),
}));

export function nsiDomainToLabel(key: string): string { return domainLabel(key); }

