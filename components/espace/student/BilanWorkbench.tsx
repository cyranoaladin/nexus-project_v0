'use client';

import { useRef, useState } from 'react';
import { SaveIndicator } from '@/components/espace/shared/SaveIndicator';
import { useWorkSync } from '@/components/espace/shared/useWorkSync';
import { bilanData, getBilanLesson, getBilanProfile, getBilanSections, getExclusiveBilanChoices, getEligibleBilanTasks, getBilanMastery, getBilanSkillStep, isBilanMasteryStep, type BilanLevel, type BilanQuestion } from '@/lib/espace/bilan-data';
import { formatBilanAnswer } from '@/lib/espace/bilan-display';
import type { AnnotationDto } from '@/lib/espace/annotations';
import type { Step, Steps } from '@/lib/espace/client/sync-engine';
import { isStudentEditable, type WorkStatus } from '@/lib/espace/work-state';
import { AlertDialog } from './AlertDialog';
import { submitBlockedMessage } from './poo-logic';

export interface BilanWorkbenchProps {
  userId: string;
  studentName: string;
  level: BilanLevel;
  work: { id: string; status: WorkStatus; revision: number; currentStep: number; lastSavedAt: string; steps: Steps };
  annotations: AnnotationDto[];
  context?: { groupName?: string; startedAt?: string };
  /** Réservé à une page serveur enseignant : aucune création, sauvegarde ou remise. */
  preview?: boolean;
}

const FIELD = 'block w-full rounded-lg border border-white/20 bg-white/5 px-3 py-3 text-neutral-50 placeholder:text-neutral-400 focus-visible:outline focus-visible:outline-2 focus-visible:outline-brand-accent disabled:opacity-70';
const BUTTON = 'min-h-11 rounded-lg border border-white/20 px-4 py-2 text-sm text-neutral-100 hover:bg-white/5 disabled:opacity-50 focus-visible:outline focus-visible:outline-2 focus-visible:outline-brand-accent';
const CARD = 'rounded-xl border border-white/10 bg-surface-card p-4 sm:p-5';
const SCOPE = { yes: 'Oui, travaillé en séance', no: 'Non travaillé', unsure: 'Je ne sais plus' };
const REFUSE = 'Je ne souhaite pas répondre';
const MAX_TEXT = 1000;

function fieldsOf(steps: Steps, id: string): Record<string, string> {
  return (steps[id]?.fields ?? {}) as Record<string, string>;
}
function multiValues(value: string): string[] {
  try { const v: unknown = JSON.parse(value); return Array.isArray(v) ? v.filter((x): x is string => typeof x === 'string') : []; } catch { return []; }
}
interface Evidence { answer: string; retry: string; aid: string; skipped: boolean; confidence?: string; conditions?: string }
function evidenceOf(value?: string): Evidence {
  const empty = { answer: '', retry: '', aid: '', skipped: false };
  try { const v = JSON.parse(value ?? '') as Partial<Evidence>; return { answer: typeof v.answer === 'string' ? v.answer : '', retry: typeof v.retry === 'string' ? v.retry : '', aid: typeof v.aid === 'string' ? v.aid : '', skipped: v.skipped === true, ...(typeof v.confidence === 'string' ? { confidence: v.confidence } : {}), ...(typeof v.conditions === 'string' ? { conditions: v.conditions } : {}) }; } catch { return empty; }
}

export function BilanWorkbench(props: BilanWorkbenchProps) {
  // Une nouvelle identité ou une réouverture serveur recrée la session locale,
  // sans conserver le verrou ou les réponses de la copie précédente.
  return <BilanSession key={`${props.userId}:${props.work.id}:${props.work.status}:${props.level}`} {...props} />;
}

function BilanSession({ userId, studentName, level, work, annotations, context, preview = false }: BilanWorkbenchProps) {
  const defs = getBilanLesson(level).steps;
  const profile = getBilanProfile(level);
  const [status, setStatus] = useState<WorkStatus>(work.status);
  const serverSync = useWorkSync({ userId, workId: work.id, initial: { revision: work.revision, steps: work.steps, lastSavedAt: work.lastSavedAt, locked: preview || !isStudentEditable(work.status) } });
  const [previewSteps, setPreviewSteps] = useState<Steps>(work.steps);
  const steps = preview ? previewSteps : serverSync.steps;
  const stepsRef = useRef(steps);
  stepsRef.current = steps;
  const [requestedIndex, setIndex] = useState(Math.max(0, Math.min(defs.length - 1, work.currentStep)));
  const [confirming, setConfirming] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [notice, setNotice] = useState<string | null>(null);
  const headingRef = useRef<HTMLHeadingElement>(null);
  const editable = !submitting && (preview || (isStudentEditable(status) && serverSync.state !== 'locked'));
  const scope = fieldsOf(steps, 'scope');
  const mastery = getBilanMastery(steps);
  const eligible = getEligibleBilanTasks(level, scope, mastery);
  const evidence = fieldsOf(steps, 'evidence');
  const selected = eligible.filter(t => Object.hasOwn(evidence, t.id));
  const modules = bilanData.modules[level].filter(m => scope[m.id] === 'yes');
  const availableIndexes = defs.flatMap((step, i) =>
    (isBilanMasteryStep(step.id) && !modules.some(m => m.skills.some(skill => getBilanSkillStep(level, skill.id) === step.id))) || (step.id === 'evidence' && eligible.length === 0) ? [] : [i]);
  // Une copie reprise ou modifiée ailleurs peut pointer vers une rubrique devenue
  // inapplicable. Afficher alors la prochaine rubrique utile, sans créer de réponse.
  const index = availableIndexes.includes(requestedIndex) ? requestedIndex : (availableIndexes.find(i => i > requestedIndex) ?? 0);
  const current = defs[index]!;


  function put(stepId: string, fields: Record<string, string>, target = index) {
    const value: Step = { fields };
    stepsRef.current = { ...stepsRef.current, [stepId]: value };
    if (preview) setPreviewSteps(stepsRef.current);
    else serverSync.edit(stepId, value, { currentStep: target });
  }
  function change(stepId: string, fieldId: string, value: string) {
    if (!editable) return;
    const fields = { ...fieldsOf(stepsRef.current, stepId), [fieldId]: value };
    const section = getBilanSections(level).find(s => s.id === stepId);
    for (const priority of section?.questions.filter(q => q.priorityOf === fieldId) ?? []) {
      if (fields[priority.id] && fields[priority.id] !== REFUSE && !multiValues(value).includes(fields[priority.id])) fields[priority.id] = '';
    }
    put(stepId, fields);
    if (stepId !== 'review' && fieldsOf(stepsRef.current, 'review').confirmed === 'yes') put('review', { ...fieldsOf(stepsRef.current, 'review'), confirmed: '' });
    if (stepId === 'scope' || isBilanMasteryStep(stepId)) {
      const allowed = new Set(getEligibleBilanTasks(level, fieldsOf(stepsRef.current, 'scope'), getBilanMastery(stepsRef.current)).map(t => t.id));
      const prev = fieldsOf(stepsRef.current, 'evidence');
      const next = Object.fromEntries(Object.entries(prev).filter(([id]) => allowed.has(id)));
      if (Object.keys(next).length !== Object.keys(prev).length) put('evidence', next);
    }
  }
  function go(stepId: string | undefined) {
    const bounded = defs.findIndex(step => step.id === stepId);
    if (bounded < 0) return;
    const target = availableIndexes.includes(bounded) ? bounded :
      ((bounded > index ? availableIndexes.find(i => i > bounded) : [...availableIndexes].reverse().find(i => i < bounded)) ?? index);
    if (editable && !preview) serverSync.edit(current.id, stepsRef.current[current.id] ?? {}, { currentStep: target, snapshot: 'STEP_CHANGE' });
    setIndex(target);
    setNotice(null);
    headingRef.current?.focus();
  }
  function chooseTask(id: string, checked: boolean) {
    if (!editable) return;
    const fields = { ...fieldsOf(stepsRef.current, 'evidence') };
    if (checked && Object.keys(fields).length >= 2) { setNotice('Choisis deux essais au maximum avec ton professeur.'); return; }
    if (checked) fields[id] = JSON.stringify(evidenceOf()); else delete fields[id];
    put('evidence', fields);
    if (fieldsOf(stepsRef.current, 'review').confirmed === 'yes') put('review', { ...fieldsOf(stepsRef.current, 'review'), confirmed: '' });
  }
  async function confirmSubmit() {
    if (preview || submitting) return;
    setSubmitting(true); setError(null);
    try {
      const result = await serverSync.submit();
      if (result.kind === 'ok') { setStatus('SUBMITTED'); setConfirming(false); }
      else setError(result.kind === 'blocked' ? submitBlockedMessage(result.reason) : (result.message || 'La transmission a échoué. Tes réponses restent disponibles : réessaie dans un instant.'));
    } catch { setError('La transmission a échoué. Vérifie ta connexion puis réessaie.'); }
    finally { setSubmitting(false); }
  }
  function textField(id: string, label: string, stepId = current.id, hint?: string) {
    return <label className="block space-y-2" key={id}><span className="text-sm font-medium text-neutral-100">{label}</span>{hint && <span className="block text-sm text-neutral-400">{hint}</span>}<textarea rows={3} className={FIELD} maxLength={MAX_TEXT} disabled={!editable} value={fieldsOf(steps, stepId)[id] ?? ''} onChange={e => change(stepId, id, e.target.value)} /></label>;
  }
  function choices(id: string, label: string, options: Record<string, string>, stepId = current.id) {
    return <fieldset className="space-y-3" key={id}><legend className="font-medium text-neutral-100">{label}</legend><div className="grid gap-2 sm:grid-cols-2">{Object.entries(options).map(([value, text]) => <label key={value} className="flex min-h-11 cursor-pointer items-start gap-3 rounded-lg border border-white/15 p-3 text-sm text-neutral-200 has-[:checked]:border-brand-accent has-[:checked]:bg-brand-accent/10"><input className="mt-0.5 h-4 w-4 shrink-0 accent-brand-accent" type="radio" name={`${stepId}-${id}`} value={value} checked={fieldsOf(steps, stepId)[id] === value} disabled={!editable} onChange={() => change(stepId, id, value)} /><span>{text}</span></label>)}</div></fieldset>;
  }
  function question(q: BilanQuestion) {
    if (q.type === 'text') return <div className={CARD} key={q.id}>{textField(q.id, q.text, current.id, q.hint ?? 'Tu peux laisser cette réponse vide ou préférer en parler avec ton professeur.')}</div>;
    const options = q.priorityOf
      ? (q.options ?? []).filter(option => multiValues(fieldsOf(steps, current.id)[q.priorityOf!] ?? '').includes(option))
      : [...(q.options ?? [])];
    if (!options.includes(REFUSE)) options.push(REFUSE);
    if (q.type === 'scale' || q.priorityOf) return <div className={CARD} key={q.id}><label className="block space-y-2"><span className="text-sm font-medium text-neutral-100">{q.text}</span><select className={FIELD} value={fieldsOf(steps, current.id)[q.id] ?? ''} disabled={!editable} onChange={e => change(current.id, q.id, e.target.value)}><option value="">Choisir une réponse (facultatif)</option>{options.map(option => <option key={option} value={option}>{option}</option>)}</select></label>{q.hint && <p className="mt-2 text-sm text-neutral-400">{q.hint}</p>}{q.priorityOf && options.length === 1 && <p className="mt-2 text-sm text-neutral-400">Choisis d’abord les aides qui te seraient utiles, ou laisse cette réponse vide.</p>}</div>;
    if (q.type !== 'multi') return <div className={CARD} key={q.id}>{choices(q.id, q.text, Object.fromEntries(options.map(x => [x, x])))}{q.hint && <p className="mt-2 text-sm text-neutral-400">{q.hint}</p>}</div>;
    const values = multiValues(fieldsOf(steps, current.id)[q.id] ?? '');
    return <fieldset className={`${CARD} space-y-3`} key={q.id}><legend className="float-left mb-3 w-full font-medium text-neutral-100">{q.text}</legend><p className="clear-both text-sm text-neutral-400">{q.hint ?? `${q.max ?? 3} choix maximum.`}</p><div className="grid gap-2 sm:grid-cols-2">{options.map(option => <label key={option} className="flex min-h-11 items-start gap-3 rounded-lg border border-white/15 p-3 text-sm text-neutral-200"><input type="checkbox" className="mt-0.5 h-4 w-4 shrink-0 accent-brand-accent" checked={values.includes(option)} disabled={!editable} onChange={e => {
      const exclusive = getExclusiveBilanChoices(q);
      let next = values.filter(x => x !== option);
      if (e.target.checked) {
        next = exclusive.includes(option) ? [option] : [...next.filter(x => !exclusive.includes(x)), option];
        if (next.length > (q.max ?? 3)) { setNotice(`Choisis ${q.max ?? 3} réponses au maximum.`); return; }
      }
      change(current.id, q.id, JSON.stringify(next)); setNotice(null);
    }} /><span>{option}</span></label>)}</div></fieldset>;
  }

  const section = getBilanSections(level).find(s => s.id === current.id);
  const notes = annotations.filter(a => current.id === 'review' || !a.stepId || a.stepId === current.id);
  return <div className="mx-auto max-w-4xl space-y-6 pb-8" data-testid="bilan-workbench">
    <header className="space-y-3 border-b border-white/10 pb-5"><p className="text-sm text-brand-accent">{profile.subjectLabel} · {profile.levelLabel} · Septembre 2026</p><h1 className="text-2xl font-semibold text-neutral-50 sm:text-3xl">Mon bilan du premier mois</h1><p className="text-neutral-200">{studentName}</p>{(context?.groupName || context?.startedAt) && <p className="text-sm text-neutral-300">{context.groupName}{context.startedAt && `${context.groupName ? ' · ' : ''}Bilan commencé le : ${new Date(context.startedAt).toLocaleDateString('fr-FR', { timeZone: 'Africa/Tunis' })}`}</p>}<p className="max-w-2xl text-sm leading-relaxed text-neutral-300">Tes apprentissages, tes façons de travailler et ton avis sur les séances : prenons le temps de préparer la suite. Ce questionnaire ne donne pas de note. Tes remarques, y compris critiques, sont les bienvenues et aideront ton professeur à préparer une synthèse individualisée pour toi et ta famille.</p><p className="text-sm leading-relaxed text-neutral-400">Prévois 45 à 60 minutes pour le questionnaire, en plusieurs temps si tu le souhaites. Tes réponses sont sauvegardées ; les essais facultatifs peuvent demander 15 à 20 minutes supplémentaires selon ceux choisis.</p>{preview ? <p role="status" className="text-sm text-amber-200">Aperçu enseignant : les réponses d’essai ne sont ni enregistrées ni transmises.</p> : <SaveIndicator state={!editable && !submitting ? 'locked' : serverSync.state} lastSavedAt={serverSync.lastSavedAt} />}</header>
    {!editable && !submitting && <p className={`${CARD} text-neutral-100`}>Ton bilan a été transmis. Tu peux relire tes réponses et les retours de ton professeur. Lui seul peut rouvrir le bilan.</p>}
    {status === 'REOPENED' && <p className="text-amber-200">Ton professeur t’invite à reprendre ce bilan.</p>}
    <div className="space-y-2"><label htmlFor="bilan-step" className="text-sm text-neutral-300">Étape {index + 1} sur {defs.length}</label><select id="bilan-step" className={FIELD} value={current.id} onChange={e => go(e.target.value)}>{defs.map((s, i) => <option key={s.id} value={s.id} disabled={!availableIndexes.includes(i)}>{i + 1}. {s.title}{!availableIndexes.includes(i) ? (isBilanMasteryStep(s.id) ? ' — choisir un thème correspondant d’abord' : ' — aucun essai applicable') : ''}</option>)}</select></div>
    {!availableIndexes.some(i => defs[i].id === 'evidence') && <aside className={`${CARD} space-y-3 text-sm text-neutral-300`} aria-label="Un parcours adapté à tes réponses"><p>{modules.length === 0 ? 'Les questions « Où j’en suis » et « Mes essais » apparaissent après avoir indiqué au moins un thème travaillé en séance. Si aucun thème ne correspond ou si tu ne sais plus, continue directement avec tes façons de travailler.' : 'Aucun essai ne correspond aux compétences déclarées travaillées. Tu peux continuer avec tes façons de travailler ou revoir tes réponses.'}</p>{current.id !== 'scope' && <button type="button" className={BUTTON} onClick={() => go('scope')}>Revoir les thèmes travaillés</button>}{modules.length > 0 && !isBilanMasteryStep(current.id) && <button type="button" className={BUTTON} onClick={() => go(defs.find(step => isBilanMasteryStep(step.id) && availableIndexes.some(i => defs[i].id === step.id))?.id)}>Revoir mon positionnement</button>}</aside>}
    <section aria-labelledby="bilan-heading" className="space-y-5"><h2 id="bilan-heading" ref={headingRef} tabIndex={-1} className="text-xl font-semibold text-neutral-50 outline-none">{current.title}</h2>
      {current.id === 'scope' && <><p className="text-sm leading-relaxed text-neutral-300">Réponds uniquement pour les séances de septembre. Recevoir un livret ne signifie pas avoir travaillé toutes ses pages. « Je ne sais plus » convient : ton professeur vérifiera avec toi.</p>{bilanData.modules[level].map(m => <div className={CARD} key={m.id}>{choices(m.id, m.label, SCOPE, 'scope')}<p className="mt-3 text-sm text-neutral-400">{m.description}</p></div>)}<div className={CARD}>{textField('other', 'Une autre notion ou une trace de ce que tu as travaillé ?', 'scope', 'Si tu peux : date, page ou exercice. Ne compte pas le stage de prérentrée.')}</div></>}
      {isBilanMasteryStep(current.id) && <><p className="text-sm text-neutral-300">C’est ton point de vue, pas une évaluation. Si une compétence de ce thème n’a pas été travaillée, indique-le : elle sera écartée des essais.</p>{modules.length ? modules.filter(m => m.skills.some(skill => getBilanSkillStep(level, skill.id) === current.id)).map(m => <section key={m.id} className="space-y-4"><h3 className="font-medium text-brand-accent">{m.label}</h3>{m.skills.filter(skill => getBilanSkillStep(level, skill.id) === current.id).map(s => <div className={CARD} key={s.id}>{choices(s.id, s.text, bilanData.mastery, current.id)}</div>)}</section>) : <p className={CARD}>Aucune notion déclarée travaillée. Tu peux revenir à la première étape ou continuer à parler des séances.</p>}</>}
      {current.id === 'evidence' && <><button type="button" className={BUTTON} onClick={() => go('trial-reflection')}>Revenir sur mes essais</button><p className="text-sm leading-relaxed text-neutral-300">Avec ton professeur, sélectionne un ou deux essais ci-dessous pour afficher leurs énoncés. Seuls les contenus déclarés travaillés sont proposés. Tu peux aussi passer cette étape. Ils servent à observer une démarche, sans note automatique.</p>{eligible.length ? <fieldset className={`${CARD} space-y-3`}><legend className="float-left mb-3 font-medium text-neutral-100">Les essais choisis ({selected.length}/2)</legend><div className="clear-both grid gap-3 sm:grid-cols-2">{eligible.map(t => <label key={t.id} className="flex min-h-11 items-center gap-3 text-sm text-neutral-200"><input type="checkbox" checked={Object.hasOwn(evidence, t.id)} disabled={!editable} onChange={e => chooseTask(t.id, e.target.checked)} className="h-4 w-4 accent-brand-accent" />{t.title}</label>)}</div></fieldset> : <p className={CARD}>Aucune notion déclarée travaillée ne permet de proposer un essai. Continue avec tes méthodes de travail.</p>}{selected.map(t => {
        const value = evidenceOf(evidence[t.id]);
        const update = (patch: Partial<Evidence>) => change('evidence', t.id, JSON.stringify({ ...value, ...patch }));
        return <article key={t.id} className={`${CARD} space-y-4`}><h3 className="font-semibold text-neutral-50">{t.title}</h3><p className="whitespace-pre-wrap leading-relaxed text-neutral-200">{t.prompt}</p><label className="flex min-h-11 items-center gap-3 text-sm text-neutral-300"><input type="checkbox" checked={value.skipped} disabled={!editable} onChange={e => update({ skipped: e.target.checked })} />Je n’ai pas fait cet essai</label>{!value.skipped && <><label className="block space-y-2 text-sm text-neutral-100"><span>Mon premier essai et mon explication</span><textarea rows={4} className={FIELD} maxLength={MAX_TEXT} disabled={!editable} value={value.answer} onChange={e => update({ answer: e.target.value })} /></label><label className="block space-y-2 text-sm text-neutral-100"><span>Aide utilisée</span><select className={FIELD} value={value.aid} disabled={!editable} onChange={e => update({ aid: e.target.value })}><option value="">À préciser</option>{['Aucune aide', 'Un indice', 'Un guidage ou un modèle', 'Je ne sais plus'].map(x => <option key={x}>{x}</option>)}</select></label><label className="block space-y-2 text-sm text-neutral-100"><span>Conditions de mon essai (facultatif)</span><select className={FIELD} value={value.conditions ?? ''} disabled={!editable} onChange={e => update({ conditions: e.target.value || undefined })}><option value="">À préciser</option>{['Sans cours ni calculatrice', 'Avec les outils autorisés par l’énoncé', 'Avec une aide ou une ressource', 'Je ne sais plus', REFUSE].map(option => <option key={option}>{option}</option>)}</select></label><label className="block space-y-2 text-sm text-neutral-100"><span>Ma confiance après cet essai (facultatif)</span><select className={FIELD} value={value.confidence ?? ''} disabled={!editable} onChange={e => update({ confidence: e.target.value || undefined })}><option value="">À préciser</option>{['Faible', 'Moyenne', 'Forte', REFUSE].map(option => <option key={option}>{option}</option>)}</select></label><label className="block space-y-2 text-sm text-neutral-100"><span>Après une aide ou une reprise (facultatif)</span><textarea className={FIELD} rows={3} maxLength={MAX_TEXT} disabled={!editable} value={value.retry} onChange={e => update({ retry: e.target.value })} /><span className="block text-neutral-400">Garde ton premier essai au-dessus : ce sont deux traces différentes.</span></label></>}</article>;
      })}</>}
      {section && <>{section.id === 'trial-reflection' && <aside className={`${CARD} space-y-3 text-sm text-neutral-300`}><p>Indique ton ressenti avant les essais, puis reviens à cette rubrique après les avoir faits pour préciser ton positionnement, sans effacer ton premier ressenti.</p>{eligible.length > 0 && <button type="button" className={BUTTON} onClick={() => go('evidence')}>Passer aux essais</button>}</aside>}<p className="text-sm text-neutral-300">{section.intro} Tu peux passer une question ou préférer en parler.</p>{section.questions.map(question)}</>}
      {current.id === 'review' && <><p className="text-sm leading-relaxed text-neutral-300">Relis tes réponses. Elles aideront ton professeur à préparer un bilan individuel avec toi puis ta famille. Un ressenti, une réussite observée et une aide reçue sont des informations différentes.</p><div className={CARD}><h3 className="font-medium text-neutral-100">Mes points de repère</h3><ul className="mt-3 space-y-2 text-sm text-neutral-300"><li>{modules.length} thème(s) déclaré(s) travaillé(s), à confirmer avec le professeur.</li><li>{selected.length} essai(s) choisi(s). Un essai non fait n’est pas un échec.</li><li>Aucune note ni conclusion de maîtrise n’est calculée.</li></ul></div><div className="space-y-3">{defs.filter((s, i) => s.id !== 'review' && availableIndexes.includes(i)).map(def => <details key={def.id} className={CARD}><summary className="cursor-pointer font-medium text-neutral-100">{def.title}</summary><dl className="mt-4 space-y-4">{def.fields.map(f => {
        if (isBilanMasteryStep(def.id) && !modules.some(m => m.skills.some(s => s.id === f.id))) return null;
        if (def.id === 'evidence' && !selected.some(t => t.id === f.id)) return null;
        const raw = fieldsOf(steps, def.id)[f.id] ?? '';
        let display = raw;
        if (def.id === 'scope' && f.id !== 'other') display = SCOPE[raw as keyof typeof SCOPE] ?? '';
        if (isBilanMasteryStep(def.id)) display = bilanData.mastery[raw] ?? '';
        if (def.id === 'evidence') display = formatBilanAnswer('evidence', raw);
        if (raw.startsWith('[')) display = multiValues(raw).join(' ; ');
        return <div key={f.id}><dt className="text-sm font-medium text-neutral-200">{f.label}</dt><dd className="mt-1 whitespace-pre-wrap break-words text-sm text-neutral-400">{display || 'Non renseigné — tu peux en parler avec ton professeur.'}</dd></div>;
      })}</dl>{def.id === 'evidence' && selected.length === 0 && <p className="mt-4 text-sm text-neutral-300">Aucun essai choisi. Cette étape est facultative ; tu peux en parler avec ton professeur.</p>}<button className={`${BUTTON} mt-4`} type="button" onClick={() => go(def.id)}>Revoir cette rubrique</button></details>)}</div><label className={`${CARD} flex items-start gap-3 text-sm text-neutral-100`}><input type="checkbox" className="mt-1 h-4 w-4 shrink-0 accent-brand-accent" checked={fieldsOf(steps, 'review').confirmed === 'yes'} disabled={!editable} onChange={e => change('review', 'confirmed', e.target.checked ? 'yes' : '')} /><span>J’ai relu mes réponses et je souhaite les transmettre à mon professeur. Je peux laisser certaines questions sans réponse.</span></label>{editable && !preview && <button type="button" disabled={fieldsOf(steps, 'review').confirmed !== 'yes'} className="min-h-12 rounded-lg bg-brand-accent px-6 py-3 font-medium text-neutral-950 disabled:opacity-50 focus-visible:outline focus-visible:outline-2 focus-visible:outline-white" onClick={() => { setError(null); setConfirming(true); }}>Transmettre mon bilan</button>}</>}
    </section>
    {notes.length > 0 && <section className={`${CARD} space-y-3`}><h2 className="font-semibold text-neutral-100">Le retour de mon professeur</h2>{notes.map(n => <div key={n.id}>{current.id === 'review' && n.stepId && <p className="text-sm font-medium text-brand-accent">{defs.find(s => s.id === n.stepId)?.title}</p>}<p className="whitespace-pre-wrap break-words text-sm text-neutral-200">{n.body}</p></div>)}</section>}
    {notice && <p role="status" className="text-sm text-amber-200">{notice}</p>}
    <nav aria-label="Parcourir le bilan" className="sticky bottom-0 z-10 flex flex-wrap justify-between gap-3 border-t border-white/10 bg-surface-darker/95 py-3 backdrop-blur sm:static"><button type="button" className={BUTTON} disabled={index === 0} onClick={() => go(defs[index - 1]?.id)}>Précédent</button><button type="button" className={BUTTON} disabled={index === defs.length - 1} onClick={() => go(defs[index + 1]?.id)}>Continuer</button></nav>
    {confirming && <AlertDialog title="Transmettre ton bilan ?" onEscape={() => !submitting && setConfirming(false)} actions={[{ label: 'Revenir à mes réponses', autoFocus: true, disabled: submitting, onClick: () => setConfirming(false) }, { label: submitting ? 'Transmission…' : 'Transmettre', variant: 'primary', disabled: submitting, onClick: () => void confirmSubmit() }]}><p>Ton professeur recevra tes réponses dans son espace. Après transmission, elles seront en lecture seule ; il pourra les rouvrir si nécessaire.</p>{error && <p role="alert" className="text-amber-200">{error}</p>}</AlertDialog>}
    {!preview && serverSync.conflict && <AlertDialog title="Ce bilan a été modifié ailleurs" actions={[{ label: 'Prendre l’autre version', autoFocus: true, onClick: () => void serverSync.resolveConflict('take-theirs') }, { label: 'Garder ma version', onClick: () => void serverSync.resolveConflict('keep-mine'), variant: 'primary' }]}><p>Choisis la version à conserver pour cette rubrique. L’autre version sera remplacée.</p><details><summary>Comparer les réponses</summary><p className="mt-3 font-medium">Ma version</p><pre className="whitespace-pre-wrap break-words text-sm">{Object.values((serverSync.conflict.mine.fields ?? {}) as Record<string,string>).join('\n') || 'Aucune réponse'}</pre><p className="mt-3 font-medium">L’autre version</p><pre className="whitespace-pre-wrap break-words text-sm">{Object.values((serverSync.conflict.theirs.fields ?? {}) as Record<string,string>).join('\n') || 'Aucune réponse'}</pre></details></AlertDialog>}
  </div>;
}
