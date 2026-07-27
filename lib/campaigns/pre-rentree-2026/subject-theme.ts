// Référentiel SPÉCIFIQUE aux stages de pré-rentrée (n'est importé que par
// components/pre-rentree-2026/* — jamais par l'accompagnement annuel). Les familles
// couvrent exactement les matières réellement programmées dans la grille de stage
// (data/campaigns/pre-rentree-2026.json) : Maths, Français, NSI, Physique-Chimie,
// SVT, Maths expertes (Terminale uniquement). Philosophie n'existe dans AUCUN stage
// pré-rentrée et n'a donc pas sa place ici (cf. SEPARATION_STAGES_ANNUEL.md).
export type SubjectFamily =
  | 'MATHEMATIQUES'
  | 'FRANCAIS'
  | 'NSI'
  | 'PHYSIQUE_CHIMIE'
  | 'SVT'
  | 'MATHS_EXPERTES';

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
  MATHS_EXPERTES: {
    family: 'MATHS_EXPERTES',
    label: 'Mathématiques expertes',
    marker: 'M+',
    surfaceClass: 'bg-indigo-50',
    borderClass: 'border-indigo-300',
    textClass: 'text-indigo-950',
    markerClass: 'bg-indigo-800 text-white',
    printClass: 'print:border-slate-500 print:bg-white print:text-black',
  },
};

export function getSubjectFamily(subjectId: string): SubjectFamily {
  if (subjectId === 'MATHEMATIQUES') return 'MATHEMATIQUES';
  if (subjectId === 'FRANCAIS') return 'FRANCAIS';
  if (subjectId === 'NSI') return 'NSI';
  if (subjectId === 'SVT') return 'SVT';
  if (subjectId === 'MATHS_EXPERTES') return 'MATHS_EXPERTES';
  return 'PHYSIQUE_CHIMIE';
}

export function getSubjectTheme(subjectId: string, _label?: string): SubjectTheme {
  return SUBJECT_THEMES[getSubjectFamily(subjectId)];
}
