export type SubjectFamily =
  | 'MATHEMATIQUES'
  | 'FRANCAIS'
  | 'NSI_SNT'
  | 'PHYSIQUE_CHIMIE'
  | 'PHILOSOPHIE'
  | 'SVT'
  | 'SES'
  | 'EMC'
  | 'HISTOIRE_GEOGRAPHIE';

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
  SVT: {
    family: 'SVT',
    label: 'SVT (Sciences de la Vie et de la Terre)',
    marker: 'SVT',
    surfaceClass: 'bg-green-50',
    borderClass: 'border-green-300',
    textClass: 'text-green-950',
    markerClass: 'bg-green-800 text-white',
    printClass: 'print:border-slate-500 print:bg-white print:text-black',
  },
  SES: {
    family: 'SES',
    label: 'SES (Sciences Économiques et Sociales)',
    marker: 'SES',
    surfaceClass: 'bg-orange-50',
    borderClass: 'border-orange-300',
    textClass: 'text-orange-950',
    markerClass: 'bg-orange-800 text-white',
    printClass: 'print:border-slate-500 print:bg-white print:text-black',
  },
  EMC: {
    family: 'EMC',
    label: 'EMC (Enseignement Moral et Civique)',
    marker: 'EMC',
    surfaceClass: 'bg-cyan-50',
    borderClass: 'border-cyan-300',
    textClass: 'text-cyan-950',
    markerClass: 'bg-cyan-800 text-white',
    printClass: 'print:border-slate-500 print:bg-white print:text-black',
  },
  HISTOIRE_GEOGRAPHIE: {
    family: 'HISTOIRE_GEOGRAPHIE',
    label: 'Histoire-Géographie',
    marker: 'HG',
    surfaceClass: 'bg-yellow-50',
    borderClass: 'border-yellow-300',
    textClass: 'text-yellow-950',
    markerClass: 'bg-yellow-800 text-white',
    printClass: 'print:border-slate-500 print:bg-white print:text-black',
  },
};

export function getSubjectFamily(subjectId: string): SubjectFamily {
  if (subjectId === 'MATHEMATIQUES') return 'MATHEMATIQUES';
  if (subjectId === 'FRANCAIS') return 'FRANCAIS';
  if (subjectId === 'NSI') return 'NSI_SNT';
  if (subjectId === 'PHILOSOPHIE') return 'PHILOSOPHIE';
  if (subjectId === 'SVT') return 'SVT';
  if (subjectId === 'SES') return 'SES';
  if (subjectId === 'EMC') return 'EMC';
  if (subjectId === 'HISTOIRE_GEOGRAPHIE') return 'HISTOIRE_GEOGRAPHIE';
  return 'PHYSIQUE_CHIMIE';
}

export function getSubjectTheme(subjectId: string, _label?: string): SubjectTheme {
  return SUBJECT_THEMES[getSubjectFamily(subjectId)];
}
