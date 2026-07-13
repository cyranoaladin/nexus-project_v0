export type SubjectFamily =
  | 'MATHEMATIQUES'
  | 'FRANCAIS'
  | 'NSI_SNT'
  | 'PHYSIQUE_CHIMIE';

export interface SubjectTheme {
  family: SubjectFamily;
  label: string;
  marker: string;
  surfaceClass: string;
  borderClass: string;
  textClass: string;
  markerClass: string;
  printClass: string;
}

export const SUBJECT_THEMES: Readonly<Record<SubjectFamily, SubjectTheme>> = {
  MATHEMATIQUES: {
    family: 'MATHEMATIQUES',
    label: 'Mathématiques',
    marker: 'M',
    surfaceClass: 'bg-blue-50',
    borderClass: 'border-blue-300',
    textClass: 'text-blue-950',
    markerClass: 'bg-blue-800 text-white',
    printClass: 'print:border-slate-500 print:bg-white print:text-black',
  },
  FRANCAIS: {
    family: 'FRANCAIS',
    label: 'Français / Expression',
    marker: 'F',
    surfaceClass: 'bg-rose-50',
    borderClass: 'border-rose-300',
    textClass: 'text-rose-950',
    markerClass: 'bg-rose-800 text-white',
    printClass: 'print:border-slate-500 print:bg-white print:text-black',
  },
  NSI_SNT: {
    family: 'NSI_SNT',
    label: 'NSI / SNT',
    marker: '</>',
    surfaceClass: 'bg-violet-50',
    borderClass: 'border-violet-300',
    textClass: 'text-violet-950',
    markerClass: 'bg-violet-800 text-white',
    printClass: 'print:border-slate-500 print:bg-white print:text-black',
  },
  PHYSIQUE_CHIMIE: {
    family: 'PHYSIQUE_CHIMIE',
    label: 'Physique-Chimie',
    marker: 'PC',
    surfaceClass: 'bg-teal-50',
    borderClass: 'border-teal-300',
    textClass: 'text-teal-950',
    markerClass: 'bg-teal-800 text-white',
    printClass: 'print:border-slate-500 print:bg-white print:text-black',
  },
};

export function getSubjectFamily(subjectId: string): SubjectFamily {
  if (subjectId === 'MATHEMATIQUES') return 'MATHEMATIQUES';
  if (subjectId === 'FRANCAIS') return 'FRANCAIS';
  if (subjectId === 'NSI') return 'NSI_SNT';
  return 'PHYSIQUE_CHIMIE';
}

export function getSubjectTheme(subjectId: string, _label?: string): SubjectTheme {
  return SUBJECT_THEMES[getSubjectFamily(subjectId)];
}
