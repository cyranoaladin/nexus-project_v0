/** File de correction : ordre d'affichage et choix du « élève suivant ». Pur. */
export interface QueueRow {
  workId: string | null;
  status: string;
  name: string;
}

/** Travaux remis d'abord (ceux à corriger), puis les autres ; les élèves sans travail sont écartés. */
export function orderQueue<T extends QueueRow>(rows: readonly T[]): T[] {
  const withWork = rows.filter((r) => r.workId !== null);
  return [...withWork.filter((r) => r.status === 'SUBMITTED'), ...withWork.filter((r) => r.status !== 'SUBMITTED')];
}

/** Prochain travail remis après le courant dans l'ordre d'affichage, en bouclant ; jamais le courant. */
export function nextInQueue<T extends QueueRow>(rows: readonly T[], currentWorkId: string): T | null {
  const list = rows.filter((r) => r.workId !== null);
  const at = list.findIndex((r) => r.workId === currentWorkId);
  const ordered = at === -1 ? list : [...list.slice(at + 1), ...list.slice(0, at)];
  return ordered.find((r) => r.status === 'SUBMITTED' && r.workId !== currentWorkId) ?? null;
}
