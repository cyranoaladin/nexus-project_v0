import { bilanData, getBilanProfile, getBilanSections, getEligibleBilanTasks, type BilanLevel } from '@/lib/espace/bilan-data';
import { bilanViewerSteps, formatBilanAnswer } from '@/lib/espace/bilan-display';
import type { Steps } from '@/lib/espace/client/sync-engine';
import type { WorkStatus } from '@/lib/espace/work-state';

interface Props {
  studentName: string;
  level: BilanLevel;
  status: WorkStatus;
  steps: Steps;
  annotations: { id: string; body: string; authorName: string; stepId: string | null; createdAt: string }[];
}

/** Rapport fidèle aux traces enregistrées. Pas de corrigé, score ou texte de progrès généré. */
export function BilanFamilyReport({ studentName, level, status, steps, annotations }: Props) {
  const defs = bilanViewerSteps(level);
  const profile = getBilanProfile(level);
  const fields = (id: string) => (steps[id]?.fields ?? {}) as Record<string, string>;
  const scope = fields('scope');
  const mastery = fields('mastery');
  const modules = bilanData.modules[level].filter(m => scope[m.id] === 'yes');
  const eligible = getEligibleBilanTasks(level, scope, mastery);
  const reviewed = status === 'CORRECTED' || status === 'DONE';
  return <article id="bilan-family-report" className="mx-auto max-w-3xl space-y-7 rounded-xl bg-white p-5 text-slate-900 sm:p-9 print:max-w-none print:p-0">
    <header className="space-y-3 border-b-2 border-slate-800 pb-5"><p className="text-sm font-semibold tracking-wide">NEXUS RÉUSSITE · {profile.subjectLabel.toLocaleUpperCase('fr-FR')}</p><h1 className="text-slate-900 text-2xl font-semibold">Bilan individuel du premier mois</h1><p className="text-lg font-medium">{studentName}</p><p>{profile.levelLabel} · Septembre 2026</p><p className="rounded-md bg-slate-100 p-3 text-sm">{reviewed ? 'Retour pédagogique enregistré. À expliquer avec l’élève avant transmission à la famille.' : 'Projet de bilan : relecture pédagogique à finaliser avant transmission à la famille.'}</p></header>
    <section className="space-y-3"><h2 className="text-slate-900 text-lg font-semibold">Le parcours déclaré par l’élève</h2><p className="text-sm">Les supports contiennent plusieurs parcours possibles. Les contenus indiqués ci-dessous restent à rapprocher des cahiers et des exercices réellement faits ; une notion non travaillée ou non évaluée ne constitue pas une lacune.</p><ul className="space-y-1 text-sm">{bilanData.modules[level].map(m => <li key={m.id}><strong>{m.label}</strong> : {formatBilanAnswer('scope', scope[m.id] ?? '') || 'à confirmer'}</li>)}</ul>{scope.other && <p className="whitespace-pre-wrap text-sm">Autre contenu ou trace déclaré : {scope.other}</p>}</section>
    <section className="space-y-3"><h2 className="text-slate-900 text-lg font-semibold">Comment l’élève se situe</h2><p className="text-sm">Cet auto-positionnement exprime un ressenti. Il ne constitue pas, seul, une preuve de maîtrise.</p>{modules.map(m => <div key={m.id} className="space-y-2"><h3 className="text-slate-900 font-medium">{m.label}</h3><dl className="space-y-2 text-sm">{m.skills.map(s => <div key={s.id} className="break-inside-avoid border-l-2 border-slate-200 pl-3"><dt>{s.text}</dt><dd className="font-medium">{formatBilanAnswer('mastery', mastery[s.id] ?? '') || 'Non renseigné'}</dd></div>)}</dl></div>)}{modules.length === 0 && <p className="text-sm">Aucun contenu déclaré travaillé : aucun niveau de maîtrise n’est déduit.</p>}</section>
    <section className="space-y-3"><h2 className="text-slate-900 text-lg font-semibold">Les démarches conservées</h2><p className="text-sm">Premier essai, aide et reprise sont distingués. Une réussite ponctuelle ne suffit pas à établir un acquis durable.</p>{eligible.filter(t => fields('evidence')[t.id]).map(t => <div key={t.id} className="break-inside-avoid space-y-2 rounded-md border border-slate-200 p-3 text-sm"><h3 className="text-slate-900 font-semibold">{t.title}</h3><p className="whitespace-pre-wrap">{t.prompt}</p><p className="whitespace-pre-wrap break-words">{formatBilanAnswer('evidence', fields('evidence')[t.id])}</p></div>)}{!eligible.some(t => fields('evidence')[t.id]) && <p className="text-sm">Aucun essai retenu : les réponses au questionnaire ne permettent pas, seules, de vérifier une maîtrise.</p>}</section>
    <section className="space-y-4"><h2 className="text-slate-900 text-lg font-semibold">Observations et priorités du professeur</h2><p className="text-sm">Les constats ci-dessous sont les commentaires enregistrés par l’enseignant. Un progrès demande deux traces comparables datées ; en leur absence, le bilan constitue un état des lieux. Retenir deux priorités au maximum, chacune avec une action, une aide éventuelle, une échéance et une vérification.</p>{annotations.length ? annotations.map(a => <div key={a.id} className="space-y-2 border-l-2 border-slate-700 pl-3 text-sm"><p className="font-medium">{a.authorName} · {new Date(a.createdAt).toLocaleDateString('fr-FR', { timeZone: 'Africa/Tunis' })}{a.stepId ? ` · ${defs.find(s => s.id === a.stepId)?.title ?? 'Observation ciblée'}` : ' · Retour général'}</p><p className="whitespace-pre-wrap break-words">{a.body}</p></div>) : <p className="rounded-md bg-slate-100 p-3 text-sm">À compléter avec le professeur : observations étayées, deux priorités au maximum et date du prochain point.</p>}</section>
    {defs.filter(s => getBilanSections(level).some(section => section.id === s.id)).map(def => <section key={def.id} className="space-y-3"><h2 className="text-slate-900 text-lg font-semibold">{def.title} — parole de l’élève</h2><dl className="space-y-3 text-sm">{def.fields.filter(f => fields(def.id)[f.id]?.trim()).map(f => <div key={f.id} className="break-inside-avoid"><dt className="font-medium">{f.label}</dt><dd className="mt-1 whitespace-pre-wrap break-words">{formatBilanAnswer(f.format, fields(def.id)[f.id])}</dd></div>)}</dl>{!Object.values(fields(def.id)).some(v => v.trim()) && <p className="text-sm">Non renseigné ; à aborder si l’élève le souhaite.</p>}</section>)}
    <footer className="border-t border-slate-300 pt-4 text-xs leading-relaxed">Ce document porte uniquement sur les déclarations et tâches décrites. Il ne délivre aucune note automatique. Le bilan reste à expliquer à l’élève et à sa famille, en précisant les conditions d’observation et le prochain accompagnement.</footer>
  </article>;
}
