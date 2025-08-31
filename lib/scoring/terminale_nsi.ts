import { QcmQuestion } from "./qcmData";
import qcmJson from "@/data/qcm_premiere_for_terminale_nsi.json";

function idxToKey(idx: number): string { return ["A","B","C","D"][idx] ?? "A"; }

export const NSI_ORDER = [
  'TypesBase','TypesConstruits','Algo','LangagePython','TablesDonnees','IHMWeb','Reseaux','ArchOS','HistoireEthique'
] as const;

export const QCM_NSI_TERMINALE_QUESTIONS: QcmQuestion[] = (qcmJson as any).questions.map((q: any) => ({
  id: q.id,
  domain: q.domain,
  weight: q.weight,
  prompt: q.statement,
  type: 'single',
  options: (q.options || []).map((label: string, i: number) => ({ key: idxToKey(i), label })),
  correct: idxToKey(q.answer),
}));

