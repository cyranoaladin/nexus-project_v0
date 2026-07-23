export type SubjectFamily =
  | 'MATHEMATIQUES'
  | 'FRANCAIS'
  | 'NSI'
  | 'PHYSIQUE_CHIMIE'
  | 'PHILOSOPHIE'
  | 'SVT';

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
  NSI: {
    family: 'NSI',
    label: 'NSI',
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
  SVT: {
    family: 'SVT',
    label: 'SVT',
    marker: 'SVT',
    surfaceClass: 'bg-emerald-50',
    borderClass: 'border-emerald-300',
    textClass: 'text-emerald-950',
    markerClass: 'bg-emerald-800 text-white',
    printClass: 'print:border-slate-500 print:bg-white print:text-black',
  },
  PHILOSOPHIE: {
    family: 'PHILOSOPHIE',
    label: 'Philosophie',
    marker: 'Φ',
    surfaceClass: 'bg-amber-50',
    borderClass: 'border-amber-300',
    textClass: 'text-amber-950',
    markerClass: 'bg-amber-800 text-white',
    printClass: 'print:border-slate-500 print:bg-white print:text-black',
  },
};

export function getSubjectFamily(subjectId: string): SubjectFamily {
  if (subjectId === 'MATHEMATIQUES') return 'MATHEMATIQUES';
  if (subjectId === 'FRANCAIS') return 'FRANCAIS';
  if (subjectId === 'NSI') return 'NSI';
  if (subjectId === 'PHILOSOPHIE') return 'PHILOSOPHIE';
  if (subjectId === 'SVT') return 'SVT';
  return 'PHYSIQUE_CHIMIE';
}

export function getSubjectTheme(subjectId: string, _label?: string): SubjectTheme {
  return SUBJECT_THEMES[getSubjectFamily(subjectId)];
}
