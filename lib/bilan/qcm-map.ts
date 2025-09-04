export type Subject = 'MATHEMATIQUES' | 'NSI' | 'PHYSIQUE_CHIMIE' | string;
export type Grade = 'premiere' | 'terminale' | string;

import path from 'path';

export function resolveQcmPath(subject: Subject, grade: Grade): string {
  const s = String(subject).toUpperCase();
  const g = String(grade).toLowerCase();
  const baseDir = process.env.QCM_DATA_DIR || path.join(process.cwd(), 'data');

  // NSI
  if (s === 'NSI' && g === 'terminale') return path.join(baseDir, 'qcm_premiere_for_terminale_nsi.json');
  if (s === 'NSI' && g === 'premiere') return path.join(baseDir, 'qcm_snt_for_nsi_premiere.json');

  // Mathématiques
  if (s === 'MATHEMATIQUES' && g === 'terminale') return path.join(baseDir, 'qcm_premiere_for_terminale_maths.json');
  if (s === 'MATHEMATIQUES' && g === 'premiere') return path.join(baseDir, 'qcm_seconde_for_premiere_maths.json');

  // Physique-Chimie
  if (s === 'PHYSIQUE_CHIMIE' && g === 'premiere') return path.join(baseDir, 'qcm_seconde_for_premiere_pc.json');
  if (s === 'PHYSIQUE_CHIMIE' && g === 'terminale') return path.join(baseDir, 'qcm_premiere_for_terminale_pc.json');

  throw new Error(`QCM introuvable pour subject=${s} grade=${g}`);
}
