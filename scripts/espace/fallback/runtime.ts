/**
 * Runtime navigateur du plan de secours (bundlé par esbuild dans `index.html`, IIFE).
 *
 * Même sémantique que `components/espace/student/LessonWorkbench.tsx` : navigation par étapes, cours entrecoupé
 * de questions / champs / figures / éditeur (jetons déjà résolus à la construction par `parseLesson`/`unplaced`),
 * QCM avec retour ciblé, vérification des réponses (`evaluateAnswer`, le MÊME code que la plateforme),
 * indices, « À retenir », étiquettes de phase, fiche imprimable. Les réponses restent dans le localStorage de CET
 * ordinateur ; rien n'est envoyé (seul Pyodide, servi depuis ./pyodide/, est chargé).
 */
import { evaluateAnswer, parseAffine, type AnswerVerdict } from '../../../lib/espace/answer-check';
import { PythonRunner, type PythonRunResult, type RunnerPhase } from '../../../lib/espace/client/python-runner';
import { buildFunctionSvg } from '../../../lib/espace/figures/function-svg';
import type { CallTraceSpec, FunctionFigureSpec, StaticSvgSpec, StructureSimSpec } from '../../../lib/espace/lesson-types';

import { addItem, initialState, peekItem, readAt, removeItem, simMarkup, type SimState } from './sim';
import { initialTrace, traceMarkup, traceReduce, type TraceState } from './trace';
import type { FbData, FbField, FbQuestion, FbStep } from './types';

interface StepState {
  code?: string;
  fields?: Record<string, string>;
  choices?: Record<string, number>;
  hints?: number;
  tries?: Record<string, number>;
  solved?: Record<string, boolean>;
  tests?: { ranAt: string; passed: number; total: number };
}
interface Saved {
  v: 1;
  current: number;
  savedAt: string | null;
  steps: Record<string, StepState>;
}

const data = JSON.parse(document.getElementById('lesson-data')!.textContent!) as FbData;
const runnerSource: string | null = data.python ? (JSON.parse(document.getElementById('runner-data')!.textContent!) as string) : null;
const $ = <T extends HTMLElement>(id: string) => document.getElementById(id) as T;
const esc = (s: string) => s.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;');
/** Retour dynamique : formules rendues à la construction si le texte est connu, sinon texte échappé. */
const rich = (text: string) => data.richFeedback[text] ?? esc(text);

// ─── Persistance (localStorage, par leçon) ───────────────────────────────────

const KEY = `nexus-fallback:${data.slug}:${data.version}`;
let storageOk = true;
let saved: Saved = { v: 1, current: 0, savedAt: null, steps: {} };
try {
  const raw = localStorage.getItem(KEY);
  if (raw) {
    const parsed = JSON.parse(raw) as Saved;
    if (parsed && parsed.v === 1 && typeof parsed.steps === 'object') saved = { ...saved, ...parsed };
  }
} catch {
  storageOk = false;
}

function setIndicator() {
  const el = $('save-indicator');
  if (!storageOk) {
    el.textContent = 'Non enregistré : le navigateur bloque le stockage local.';
    el.dataset.state = 'error';
    return;
  }
  const when = saved.savedAt ? new Date(saved.savedAt).toLocaleTimeString('fr-FR', { hour: '2-digit', minute: '2-digit', second: '2-digit' }) : null;
  el.textContent = when ? `Enregistré sur cet ordinateur · ${when}` : 'Enregistré sur cet ordinateur';
  el.dataset.state = 'saved';
}

function flush() {
  saved.savedAt = new Date().toISOString();
  try {
    localStorage.setItem(KEY, JSON.stringify(saved));
    storageOk = true;
  } catch {
    storageOk = false;
  }
  setIndicator();
}

const stepState = (id: string): StepState => (saved.steps[id] ??= {});
function patch(id: string, change: Partial<StepState>) {
  Object.assign(stepState(id), change);
  flush();
}

// ─── État d'affichage (non persistant, comme dans la plateforme) ─────────────

let index = Math.min(Math.max(Number.isInteger(saved.current) ? saved.current : 0, 0), data.steps.length - 1);
const verdicts = new Map<string, AnswerVerdict>();
const results = new Map<string, PythonRunResult>();
const sims = new Map<string, SimState>();
const traces = new Map<string, TraceState>();
let phase: RunnerPhase = 'idle';

const pyAvailable = runnerSource !== null && location.protocol !== 'file:';
const runner = pyAvailable
  ? new PythonRunner({
      runnerSource: runnerSource!,
      runtimeBase: new URL('./pyodide/', location.href).href,
      onPhase: (p) => {
        phase = p;
        renderResults();
      },
    })
  : null;

// ─── Rendu ───────────────────────────────────────────────────────────────────

const stepOf = () => data.steps[index]!;
const phaseTag = (label: string) => (data.phases ? `<p data-testid="phase" class="phase">${label}</p>` : '');

function figureHtml(step: FbStep, id: string): string {
  const spec = step.figures.find((f) => f.id === id);
  if (!spec) return '';
  if (spec.type === 'function') return `<figure data-testid="figure-${esc(spec.id)}" class="fig"><div class="fig-svg" data-fig="${esc(spec.id)}">${functionSvg(spec, step)}</div>${spec.caption ? `<figcaption>${esc(spec.caption)}</figcaption>` : ''}</figure>`;
  if (spec.type === 'svg') {
    const s = spec as StaticSvgSpec;
    return `<figure class="fig"><div role="img" aria-label="${esc(s.alt)}" class="fig-static">${s.svg}</div>${s.caption ? `<figcaption>${esc(s.caption)}</figcaption>` : ''}</figure>`;
  }
  if (spec.type === 'call-trace') {
    const trace = spec as CallTraceSpec;
    if (!traces.has(trace.id)) traces.set(trace.id, initialTrace(trace));
    return `<figure class="sim trace" data-testid="trace-${esc(trace.id)}" data-traceid="${esc(trace.id)}">${traceMarkup(trace, traces.get(trace.id)!)}</figure>`;
  }
  const sim = spec as StructureSimSpec;
  if (!sims.has(sim.id)) sims.set(sim.id, initialState(sim));
  return `<figure class="sim" data-testid="sim-${esc(sim.id)}" data-simid="${esc(sim.id)}">${simMarkup(sim, sims.get(sim.id)!)}</figure>`;
}

/** Équation saisie par l'élève (« y = −3x − 1 » ou « −3x − 1 ») → deux nombres, jamais du texte tracé tel quel. */
function overlayOf(spec: FunctionFigureSpec, step: FbStep): { a: number; b: number } | null {
  if (!spec.overlayFieldId) return null;
  const raw = stepState(step.id).fields?.[spec.overlayFieldId];
  if (!raw || !raw.trim()) return null;
  const rhs = raw.replace(/^\s*y\s*=/i, '');
  return rhs.includes('=') ? null : parseAffine(rhs);
}
const functionSvg = (spec: FunctionFigureSpec, step: FbStep) => buildFunctionSvg(spec, { overlay: overlayOf(spec, step) });

function questionHtml(step: FbStep, q: FbQuestion): string {
  const picked = stepState(step.id).choices?.[q.id];
  const choices = q.choicesHtml
    .map(
      (c, ci) =>
        `<label class="choice"><input type="radio" name="q-${esc(step.id)}-${esc(q.id)}" data-q="${esc(q.id)}" value="${ci}"${picked === ci ? ' checked' : ''}><span>${c}</span></label>`,
    )
    .join('');
  return `<fieldset class="question"><legend>${q.textHtml}</legend>${choices}<div data-qfb="${esc(q.id)}">${qcmFeedback(q, picked)}</div></fieldset>`;
}

function qcmFeedback(q: FbQuestion, picked: number | undefined): string {
  if (typeof picked !== 'number') return '';
  const ok = picked === q.correct;
  return `<p role="status" class="fb ${ok ? 'ok' : 'warn'}" data-testid="qcm-feedback"><strong>${ok ? 'Bonne réponse. ' : 'Pas tout à fait. '}</strong>${ok ? q.feedbackOk : q.feedbackByChoice[picked] ?? q.feedbackOk}</p>`;
}

function fieldHtml(step: FbStep, f: FbField): string {
  const value = stepState(step.id).fields?.[f.id] ?? '';
  const id = `f-${step.id}-${f.id}`;
  const control =
    f.input === 'line'
      ? `<input id="${esc(id)}" type="text" data-f="${esc(f.id)}" value="${esc(value)}" autocomplete="off" autocapitalize="none" spellcheck="false" placeholder="${esc(f.placeholder ?? '')}">`
      : `<textarea id="${esc(id)}" data-f="${esc(f.id)}" rows="4" placeholder="${esc(f.placeholder ?? '')}">${esc(value)}</textarea>`;
  const check = f.check
    ? `<div class="check"><button type="button" data-action="verify" data-f="${esc(f.id)}">${data.phases ? 'Je vérifie' : 'Vérifier ma réponse'}</button><div role="status" aria-live="polite" data-testid="check-feedback" data-fb="${esc(f.id)}">${verdictHtml(step, f)}</div></div>`
    : '';
  return `<div class="field"><label for="${esc(id)}">${f.labelHtml}</label>${control}${check}</div>`;
}

function verdictHtml(step: FbStep, f: FbField): string {
  const verdict = verdicts.get(`${step.id}:${f.id}`);
  if (verdict) {
    return `<p class="fb ${verdict.ok ? 'ok' : 'warn'}"><strong>${verdict.ok ? 'Correct. ' : verdict.empty ? '' : 'Pas encore. '}</strong>${rich(verdict.feedback)}</p>`;
  }
  const st = stepState(step.id);
  if (st.solved?.[f.id]) {
    const n = st.tries?.[f.id] ?? 1;
    return `<p class="muted">Réponse déjà validée (${n} essai${n > 1 ? 's' : ''}).</p>`;
  }
  return '';
}

function codeHtml(step: FbStep): string {
  const code = stepState(step.id).code ?? step.starter ?? '';
  const rows = Math.min(18, Math.max(8, code.split('\n').length + 2));
  const note = !runnerSource
    ? ''
    : location.protocol === 'file:'
      ? `<p class="fb warn" data-testid="py-file-note">Python ne peut pas s’exécuter quand la page est ouverte directement depuis le disque (adresse « file »). Lance le petit serveur local décrit dans LIRE_DABORD.md, ou utilise python/verifier.py.</p>`
      : '';
  const buttons = runnerSource
    ? `<div class="actions"><button type="button" data-action="run" data-testid="btn-run"${pyAvailable ? '' : ' disabled'}>Exécuter</button><button type="button" data-action="test" data-testid="btn-test"${pyAvailable ? '' : ' disabled'}>Vérifier mon code</button></div>`
    : '';
  return `<div class="code"><label for="editeur-code">Ton code Python</label><textarea id="editeur-code" data-testid="code-editor" rows="${rows}" spellcheck="false" autocapitalize="none" autocorrect="off">${esc(code)}</textarea><p class="muted small">Tab insère des espaces. Pour quitter l’éditeur au clavier : Échap, puis Tab.</p>${note}${buttons}<div role="status" aria-live="polite" class="results" data-testid="run-results" id="run-results"></div></div>`;
}

function hintsHtml(step: FbStep): string {
  if (step.hintsHtml.length === 0) return '';
  const shown = stepState(step.id).hints ?? 0;
  const list = step.hintsHtml.slice(0, shown).map((h, i) => `<p class="hint"><strong>Indice ${i + 1} sur ${step.hintsHtml.length} — </strong>${h}</p>`).join('');
  const more = shown < step.hintsHtml.length ? `<button type="button" class="linkish" data-action="hint">${shown === 0 ? 'Un indice ?' : 'Un indice de plus ?'}</button>` : '';
  return list + more;
}

function renderNav() {
  const label = (s: FbStep) => s.label;
  $('step-select').innerHTML = data.steps.map((s, i) => `<option value="${i}"${i === index ? ' selected' : ''}>${esc(label(s))}</option>`).join('');
  $('step-list').innerHTML = data.steps
    .map((s, i) => `<li><button type="button" data-goto="${i}"${i === index ? ' aria-current="step"' : ''}>${esc(label(s))}</button></li>`)
    .join('');
  $('step-count').textContent = `Étape ${index + 1} sur ${data.steps.length}`;
}

function renderStep() {
  const step = stepOf();
  const q = (id: string) => step.questions.find((x) => x.id === id);
  const f = (id: string) => step.fields.find((x) => x.id === id);

  const body = step.segments
    .map((seg) => {
      if (seg.kind === 'html') return `<div class="lesson">${seg.html}</div>`;
      if (seg.kind === 'q') return q(seg.id) ? questionHtml(step, q(seg.id)!) : '';
      if (seg.kind === 'f') return f(seg.id) ? fieldHtml(step, f(seg.id)!) : '';
      if (seg.kind === 'fig') return figureHtml(step, seg.id);
      return step.starter !== null ? codeHtml(step) : '';
    })
    .join('');

  const rest = step.rest;
  const observe = rest.figures.length ? `<div class="block">${phaseTag('J’observe')}${rest.figures.map((id) => figureHtml(step, id)).join('')}</div>` : '';
  const doIt = `<div class="block"><p class="task">${data.phases ? '<span class="phase-inline">J’essaie</span>' : ''}<strong>À faire : </strong>${step.taskHtml}</p>${rest.questions.map((id) => (q(id) ? questionHtml(step, q(id)!) : '')).join('')}${rest.code ? codeHtml(step) : ''}${rest.fields.map((id) => (f(id) ? fieldHtml(step, f(id)!) : '')).join('')}</div>`;
  const takeaway = step.takeawayHtml ? `<div>${phaseTag('Je retiens')}<p class="takeaway"><strong>À retenir : </strong>${step.takeawayHtml}</p></div>` : '';
  const printBtn = step.printable ? `<button type="button" class="noprint" data-action="print-sheet">Imprimer la fiche</button>` : '';

  $('article').innerHTML = `<div><p class="muted">${esc(step.level)} · ${step.minutes > 0 ? `${step.minutes} min` : `hors des ${data.duration} min`}</p><h2 id="etape-titre" tabindex="-1">${esc(step.title)}</h2><p class="intro">${step.introHtml}</p></div>
<div${step.printable ? ' id="print-sheet"' : ''} class="block sheet">${phaseTag('Je comprends')}${body}${printBtn}</div>
${observe}${doIt}<div id="hints" class="hints">${hintsHtml(step)}</div>${takeaway}
<div class="stepnav noprint"><div><button type="button" data-goto="${index - 1}"${index === 0 ? ' disabled' : ''}>Étape précédente</button> <button type="button" data-goto="${index + 1}"${index === data.steps.length - 1 ? ' disabled' : ''}>Étape suivante</button></div></div>`;
  renderNav();
  renderResults();
}

function renderResults() {
  const el = document.getElementById('run-results');
  if (!el) return;
  const buttons = document.querySelectorAll<HTMLButtonElement>('[data-action="run"],[data-action="test"]');
  buttons.forEach((b) => (b.disabled = !pyAvailable || phase !== 'idle'));
  if (phase === 'loading') return void (el.innerHTML = '<p class="muted">Chargement du moteur Python…</p>');
  if (phase === 'running') return void (el.innerHTML = '<p class="muted">Exécution en cours…</p>');
  const result = results.get(stepOf().id);
  if (!result) return void (el.innerHTML = '');
  const tests = result.tests
    .map((t) => `<li class="${t.pass ? 'ok' : 'warn'}"><strong>${t.pass ? 'Réussi' : 'À revoir'} — </strong>${esc(t.label)}${!t.pass && t.message ? esc(` : ${t.message}`) : ''}</li>`)
    .join('');
  el.innerHTML = `<div class="result">${result.error ? `<p class="warn">Erreur : ${esc(result.error)}</p>` : ''}${result.output ? `<pre aria-label="Affichage du programme">${esc(result.output)}</pre>` : ''}${tests ? `<ul>${tests}</ul>` : ''}${!result.error && !tests && !result.output ? '<p class="muted">Programme exécuté, rien à afficher.</p>' : ''}</div>`;
}

// ─── Actions ─────────────────────────────────────────────────────────────────

function goTo(next: number) {
  const target = Math.min(Math.max(next, 0), data.steps.length - 1);
  if (target === index) return;
  index = target;
  saved.current = target;
  flush();
  renderStep();
  $('etape-titre').focus({ preventScroll: true });
  window.scrollTo({ top: 0 });
}

function verify(fieldId: string) {
  const step = stepOf();
  const f = step.fields.find((x) => x.id === fieldId);
  if (!f?.check) return;
  const verdict = evaluateAnswer(f.check, stepState(step.id).fields?.[f.id] ?? '');
  verdicts.set(`${step.id}:${f.id}`, verdict);
  if (!verdict.empty) {
    const st = stepState(step.id);
    patch(step.id, { tries: { ...st.tries, [f.id]: (st.tries?.[f.id] ?? 0) + 1 }, solved: { ...st.solved, [f.id]: verdict.ok || st.solved?.[f.id] === true } });
  }
  const box = document.querySelector(`[data-fb="${CSS.escape(f.id)}"]`);
  if (box) box.innerHTML = verdictHtml(step, f);
}

async function execute(mode: 'run' | 'test') {
  if (!runner || phase !== 'idle') return;
  const step = stepOf();
  const code = (document.getElementById('editeur-code') as HTMLTextAreaElement | null)?.value ?? stepState(step.id).code ?? step.starter ?? '';
  const result = await runner.run(code, step.id, mode);
  results.set(step.id, result);
  if (mode === 'test' && result.tests.length > 0) {
    patch(step.id, { tests: { ranAt: new Date().toISOString(), passed: result.tests.filter((t) => t.pass).length, total: result.tests.length } });
  }
  renderResults();
}

function printSheet() {
  document.body.classList.add('print-sheet-only');
  const done = () => document.body.classList.remove('print-sheet-only');
  window.addEventListener('afterprint', done, { once: true });
  setTimeout(done, 60_000);
  window.print();
}

function traceAction(el: HTMLElement, action: { type: 'prev' | 'next' | 'reset' } | { type: 'arg'; index: number; value: number }) {
  const fig = el.closest<HTMLElement>('[data-traceid]')!;
  const spec = stepOf().figures.find((x) => x.id === fig.dataset.traceid) as CallTraceSpec;
  const next = traceReduce(spec, traces.get(spec.id) ?? initialTrace(spec), action);
  traces.set(spec.id, next);
  fig.innerHTML = traceMarkup(spec, next);
  const focus = action.type === 'arg' ? `[data-trace-arg="${action.index}"]` : `[data-trace="${action.type}"]`;
  const target = fig.querySelector<HTMLElement>(`${focus}:not([disabled])`) ?? fig.querySelector<HTMLElement>('[data-trace="next"]:not([disabled]),[data-trace="prev"]:not([disabled])');
  target?.focus();
}

function simAction(button: HTMLElement) {
  const fig = button.closest<HTMLElement>('[data-simid]')!;
  const spec = stepOf().figures.find((x) => x.id === fig.dataset.simid) as StructureSimSpec;
  const state = sims.get(spec.id) ?? initialState(spec);
  const valueEl = fig.querySelector<HTMLInputElement>('[data-sim-value]')!;
  const indexEl = fig.querySelector<HTMLInputElement>('[data-sim-index]');
  const mode = spec.mode;
  let next = state;
  switch (button.dataset.sim) {
    case 'add': {
      next = addItem(mode, state, valueEl.value);
      break;
    }
    case 'remove':
      next = removeItem(mode as 'pile' | 'file', state);
      break;
    case 'peek':
      next = peekItem(mode as 'pile' | 'file', state);
      break;
    case 'read':
      next = readAt(state, Number(indexEl?.value));
      break;
    case 'clear':
      next = initialState(spec);
      break;
  }
  const typed = valueEl.value;
  const idx = indexEl?.value;
  sims.set(spec.id, next);
  fig.innerHTML = simMarkup(spec, next);
  const newValue = fig.querySelector<HTMLInputElement>('[data-sim-value]')!;
  newValue.value = button.dataset.sim === 'add' && next.items.length !== state.items.length ? '' : button.dataset.sim === 'clear' ? '' : typed;
  const newIndex = fig.querySelector<HTMLInputElement>('[data-sim-index]');
  if (newIndex && idx !== undefined) newIndex.value = idx;
  fig.querySelector<HTMLElement>(`[data-sim="${button.dataset.sim}"]`)?.focus();
}

const article = $('article');

article.addEventListener('input', (e) => {
  const t = e.target as HTMLInputElement | HTMLTextAreaElement;
  const step = stepOf();
  if (t.id === 'editeur-code') return void patch(step.id, { code: t.value });
  const fieldId = t.dataset.f;
  if (!fieldId || t.dataset.sim !== undefined) return;
  const st = stepState(step.id);
  patch(step.id, { fields: { ...st.fields, [fieldId]: t.value } });
  if (verdicts.delete(`${step.id}:${fieldId}`)) {
    const f = step.fields.find((x) => x.id === fieldId);
    const box = document.querySelector(`[data-fb="${CSS.escape(fieldId)}"]`);
    if (f && box) box.innerHTML = verdictHtml(step, f);
  }
  for (const fig of step.figures) {
    if (fig.type === 'function' && fig.overlayFieldId === fieldId) {
      const holder = document.querySelector(`[data-fig="${CSS.escape(fig.id)}"]`);
      if (holder) holder.innerHTML = functionSvg(fig, step);
    }
  }
});

article.addEventListener('change', (e) => {
  const t = e.target as HTMLInputElement;
  if (t.dataset.traceArg !== undefined) return traceAction(t, { type: 'arg', index: Number(t.dataset.traceArg), value: Number(t.value) });
  if (t.type !== 'radio' || !t.dataset.q) return;
  const step = stepOf();
  const q = step.questions.find((x) => x.id === t.dataset.q);
  if (!q) return;
  const picked = Number(t.value);
  patch(step.id, { choices: { ...stepState(step.id).choices, [q.id]: picked } });
  const box = document.querySelector(`[data-qfb="${CSS.escape(q.id)}"]`);
  if (box) box.innerHTML = qcmFeedback(q, picked);
});

let escapeTab = false;
article.addEventListener('keydown', (e) => {
  const t = e.target as HTMLInputElement | HTMLTextAreaElement;
  if (t.id === 'editeur-code') {
    if (e.key === 'Escape') return void (escapeTab = true);
    if (e.key !== 'Tab' || e.shiftKey) return void (escapeTab = false);
    if (escapeTab) return void (escapeTab = false);
    e.preventDefault();
    const ta = t as HTMLTextAreaElement;
    const { selectionStart: a, selectionEnd: b } = ta;
    ta.value = `${ta.value.slice(0, a)}    ${ta.value.slice(b)}`;
    ta.setSelectionRange(a + 4, a + 4);
    patch(stepOf().id, { code: ta.value });
    return;
  }
  if (e.key === 'Enter' && t.dataset.f && t.tagName === 'INPUT' && stepOf().fields.find((x) => x.id === t.dataset.f)?.check) {
    e.preventDefault();
    verify(t.dataset.f);
  }
  if (e.key === 'Enter' && t.dataset.simValue !== undefined) {
    e.preventDefault();
    t.closest('figure')?.querySelector<HTMLElement>('[data-sim="add"]')?.click();
  }
});

document.addEventListener('click', (e) => {
  const el = (e.target as HTMLElement).closest<HTMLElement>('[data-goto],[data-action],[data-sim],[data-trace]');
  if (!el) return;
  if (el.dataset.goto !== undefined) return goTo(Number(el.dataset.goto));
  if (el.dataset.sim) return simAction(el);
  if (el.dataset.trace) return traceAction(el, { type: el.dataset.trace as 'prev' | 'next' | 'reset' });
  switch (el.dataset.action) {
    case 'verify':
      return verify(el.dataset.f!);
    case 'hint': {
      const step = stepOf();
      patch(step.id, { hints: (stepState(step.id).hints ?? 0) + 1 });
      $('hints').innerHTML = hintsHtml(step);
      return;
    }
    case 'run':
      return void execute('run');
    case 'test':
      return void execute('test');
    case 'print-sheet':
      return printSheet();
    case 'print':
      return window.print();
  }
});

$('step-select').addEventListener('change', (e) => goTo(Number((e.target as HTMLSelectElement).value)));
window.addEventListener('pagehide', () => {
  if (saved.savedAt) flush();
});

setIndicator();
renderStep();
