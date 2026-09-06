'use client';
import { useState } from 'react';
import Link from 'next/link';
import { SPECIALITY_CODES } from '@/lib/exams/specialities';

type ProfileFacts = {
  id: string; level: string; examSession: number; modalite: string;
  specialite1: string; specialite2: string; estRedoublant: boolean;
  estTitulaireBacDejaObtenu: boolean; changementSpecialite: boolean; intentionCycleComplet: boolean;
};
const FIELDS = [
  ['level', 'Niveau'], ['examSession', 'Session du bac'], ['modalite', 'Modalité déclarée'],
  ['specialite1', 'Spécialité 1'], ['specialite2', 'Spécialité 2'],
  ['estRedoublant', 'Redoublant'], ['estTitulaireBacDejaObtenu', 'Bac déjà obtenu'],
  ['changementSpecialite', 'Changement de spécialité'], ['intentionCycleComplet', 'Objectif'],
] as const;
type Field = typeof FIELDS[number][0];
export function CandidateProfileForm({ studentId, sessions, initialProfile }: { studentId: string; sessions: number[]; initialProfile?: ProfileFacts }) {
  const [values, setValues] = useState<Record<Field, string>>(() => Object.fromEntries(FIELDS.map(([key]) => [key, initialProfile ? String(initialProfile[key]) : ''])) as Record<Field, string>);
  const [state, setState] = useState<'idle'|'saving'|'saved'|'error'|'uncertain'>('idle');
  const complete = FIELDS.every(([key]) => values[key] !== '') && values.specialite1 !== values.specialite2 && !(values.level === 'TERMINALE' && values.intentionCycleComplet === 'false');
  const locked = state === 'saving' || state === 'saved' || state === 'uncertain';
  function options(key: Field): [string, string][] {
    if (key === 'level') return [['PREMIERE', 'Première'], ['TERMINALE', 'Terminale']];
    if (key === 'examSession') return sessions.map(session => [String(session), String(session)]);
    if (key === 'modalite') return [['A', 'Modalité A'], ['B', 'Modalité B']];
    if (key === 'specialite1' || key === 'specialite2') return SPECIALITY_CODES.map(code => [code, code.replaceAll('_', ' ')]);
    if (key === 'intentionCycleComplet') return values.level === 'PREMIERE' ? [['true', 'Cycle complet du bac'], ['false', 'Épreuves anticipées uniquement']] : [['true', 'Cycle complet du bac']];
    return [['true', 'Oui'], ['false', 'Non']];
  }
  async function save(event: React.FormEvent) {
    event.preventDefault();
    if (!complete || locked) return;
    setState('saving');
    const facts = { ...values, examSession: Number(values.examSession),
      estRedoublant: values.estRedoublant === 'true', estTitulaireBacDejaObtenu: values.estTitulaireBacDejaObtenu === 'true',
      changementSpecialite: values.changementSpecialite === 'true', intentionCycleComplet: values.intentionCycleComplet === 'true' };
    try {
      const response = await fetch(initialProfile ? `/api/assistante/candidate-profiles/${encodeURIComponent(initialProfile.id)}` : '/api/assistante/candidate-profiles', {
        method: initialProfile ? 'PATCH' : 'POST', headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(initialProfile ? facts : { studentId, ...facts }),
      });
      setState(response.ok ? 'saved' : response.status >= 500 ? 'uncertain' : 'error');
    } catch { setState('uncertain'); }
  }
  return <form onSubmit={save} className="space-y-5">
    <p className="text-sm text-slate-300">Renseignez les faits confirmés avec la famille. Une réponse inconnue reste à confirmer et empêche l’enregistrement. Ce profil ne constitue ni une inscription aux examens ni une décision d’éligibilité.</p>
    <div className="grid gap-4 sm:grid-cols-2">{FIELDS.map(([key, label]) => <label key={key} className="text-sm text-slate-200">{label}
      <select disabled={locked} required value={values[key]} onChange={event => setValues(current => ({ ...current, [key]: event.target.value, ...(key === 'level' && event.target.value !== current.level ? { intentionCycleComplet: '' } : {}) }))} className="mt-1 w-full rounded-xl border border-white/15 bg-slate-950 px-3 py-2 text-white">
        <option value="">À confirmer</option>{options(key).map(([value, text]) => <option key={value} value={value}>{text}</option>)}
      </select>
    </label>)}</div>
    {state === 'saved' && <p role="status" className="text-emerald-200">Profil enregistré. Les autres éléments réglementaires et pédagogiques restent à vérifier.</p>}
    {state === 'error' && <p role="alert" className="text-amber-200">Enregistrement refusé. Vérifiez les informations et la disponibilité du service avant de réessayer.</p>}
    {state === 'uncertain' && <p role="alert" className="text-amber-200">Résultat de l’enregistrement incertain. Vérifiez le dossier en rechargeant cette page avant toute nouvelle saisie.</p>}
    <button type="submit" disabled={!complete || locked} className="rounded-xl bg-amber-400 px-4 py-2 font-semibold text-slate-950 disabled:opacity-40">{initialProfile ? 'Enregistrer une révision' : 'Enregistrer le profil'}</button>
    <Link href={`/dashboard/assistante/students/${encodeURIComponent(studentId)}`} className="block text-amber-200 underline">Retour au dossier élève</Link>
  </form>;
}
