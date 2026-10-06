'use client';

import { useId, useState } from 'react';

import type { StructureSimSpec } from '@/lib/espace/lesson-types';

const MAX_ITEMS = 8;
const MAX_LEN = 8;

type Mode = StructureSimSpec['mode'];
export interface SimState {
  items: string[];
  /** Dernier message pédagogique (aria-live). */
  message: string;
  /** Élément mis en évidence (sommet, premier, lu…). */
  highlight: number | null;
}

/**
 * Modèle de simulation, sans React : `items` est toujours dans l'ordre d'AFFICHAGE
 * (pile : sommet en premier ; file : prochain à sortir en premier ; liste : indice 0 en premier).
 * Convention du TP : lire/retirer dans une structure vide est une erreur (IndexError), jamais un silence.
 */
export function initialState(spec: Pick<StructureSimSpec, 'initial'>): SimState {
  return { items: [...(spec.initial ?? [])], message: '', highlight: null };
}

export function addItem(mode: Mode, s: SimState, raw: string): SimState {
  const value = raw.trim().slice(0, MAX_LEN);
  if (!value) return { ...s, message: 'Saisis d’abord une valeur à ajouter.', highlight: null };
  if (s.items.length >= MAX_ITEMS) return { ...s, message: `Le simulateur est limité à ${MAX_ITEMS} éléments.`, highlight: null };
  if (mode === 'pile') return { items: [value, ...s.items], message: `« ${value} » est posé au sommet.`, highlight: 0 };
  return { items: [...s.items, value], message: mode === 'file' ? `« ${value} » rejoint l’arrière de la file.` : `« ${value} » est ajouté à la fin (indice ${s.items.length}).`, highlight: s.items.length };
}

export function removeItem(mode: Exclude<Mode, 'liste'>, s: SimState): SimState {
  if (s.items.length === 0) {
    return { ...s, message: mode === 'pile' ? 'Pile vide : rien à dépiler. Dans notre contrat, c’est une erreur (IndexError).' : 'File vide : rien à défiler. Dans notre contrat, c’est une erreur (IndexError).', highlight: null };
  }
  const [out, ...rest] = s.items;
  return { items: rest, message: mode === 'pile' ? `Dépiler renvoie « ${out} » et le retire de la pile.` : `Défiler renvoie « ${out} » et le retire de la file.`, highlight: null };
}

export function peekItem(mode: Exclude<Mode, 'liste'>, s: SimState): SimState {
  if (s.items.length === 0) {
    return { ...s, message: mode === 'pile' ? 'Pile vide : pas de sommet. Dans notre contrat, c’est une erreur (IndexError).' : 'File vide : pas de premier élément. Dans notre contrat, c’est une erreur (IndexError).', highlight: null };
  }
  const label = mode === 'pile' ? 'sommet' : 'premier';
  return { ...s, message: `${mode === 'pile' ? 'Sommet' : 'Premier'} : « ${s.items[0]} ». Consulter ne retire rien (la ${mode} garde ${s.items.length} élément${s.items.length > 1 ? 's' : ''}) — ${label}() ≠ ${mode === 'pile' ? 'depiler' : 'defiler'}().`, highlight: 0 };
}

export function readAt(s: SimState, index: number): SimState {
  if (!Number.isInteger(index) || index < 0 || index >= s.items.length) {
    return { ...s, message: `Indice ${Number.isFinite(index) ? index : '?'} invalide pour une liste de ${s.items.length} élément${s.items.length > 1 ? 's' : ''} (IndexError). Les indices vont de 0 à ${Math.max(s.items.length - 1, 0)} ; un indice négatif est invalide dans notre contrat.`, highlight: null };
  }
  return { ...s, message: `element(${index}) renvoie « ${s.items[index]} ».`, highlight: index };
}

const NAMES: Record<Mode, string> = { liste: 'liste', pile: 'pile', file: 'file' };
const BTN =
  'inline-flex h-10 items-center rounded-lg border border-white/20 px-4 text-sm text-neutral-100 hover:bg-white/5 focus-visible:outline focus-visible:outline-2 focus-visible:outline-brand-accent';
const INPUT =
  'h-10 w-28 rounded-lg border border-white/15 bg-white/5 px-3 text-neutral-50 placeholder:text-neutral-400 focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-brand-accent';

export function StructureSim({ spec }: { spec: StructureSimSpec }) {
  const uid = useId();
  const [state, setState] = useState<SimState>(() => initialState(spec));
  const [value, setValue] = useState('');
  const [index, setIndex] = useState('0');
  const mode = spec.mode;
  const name = NAMES[mode];

  const add = () => {
    const next = addItem(mode, state, value);
    setState(next);
    if (next.items.length !== state.items.length) setValue('');
  };

  return (
    <figure className="my-4 rounded-xl border border-white/10 bg-white/5 p-4" data-testid={`sim-${spec.id}`}>
      <figcaption className="mb-3 text-sm font-medium text-neutral-100">{spec.caption ?? `Simulateur de ${name}`}</figcaption>

      <div className="mb-3 flex flex-wrap items-end gap-2">
        <label htmlFor={`${uid}-v`} className="sr-only">
          Valeur à ajouter à la {name}
        </label>
        <input
          id={`${uid}-v`}
          className={INPUT}
          value={value}
          maxLength={MAX_LEN}
          placeholder="ex. : A"
          autoComplete="off"
          onChange={(e) => setValue(e.target.value)}
          onKeyDown={(e) => {
            if (e.key === 'Enter') {
              e.preventDefault();
              add();
            }
          }}
        />
        <button type="button" className={BTN} onClick={add}>
          {mode === 'pile' ? 'Empiler' : mode === 'file' ? 'Enfiler' : 'Ajouter'}
        </button>
        {mode === 'liste' ? (
          <>
            <label htmlFor={`${uid}-i`} className="sr-only">
              Indice à lire
            </label>
            <input id={`${uid}-i`} className={`${INPUT} w-20`} type="number" value={index} onChange={(e) => setIndex(e.target.value)} />
            <button type="button" className={BTN} onClick={() => setState((s) => readAt(s, Number(index)))}>
              Lire cet indice
            </button>
          </>
        ) : (
          <>
            <button type="button" className={BTN} onClick={() => setState((s) => removeItem(mode, s))}>
              {mode === 'pile' ? 'Dépiler' : 'Défiler'}
            </button>
            <button type="button" className={BTN} onClick={() => setState((s) => peekItem(mode, s))}>
              {mode === 'pile' ? 'Voir le sommet' : 'Voir le premier'}
            </button>
          </>
        )}
        <button type="button" className={BTN} onClick={() => { setState(initialState(spec)); setValue(''); }}>
          Vider
        </button>
      </div>

      <ol
        aria-label={`Contenu de la ${name}${mode === 'pile' ? ' (sommet en premier)' : mode === 'file' ? ' (prochain à sortir en premier)' : ''}`}
        className={`flex min-h-16 gap-2 ${mode === 'pile' ? 'flex-col items-start' : 'flex-row flex-wrap items-center'}`}
        data-testid="sim-items"
      >
        {state.items.length === 0 && <li className="list-none text-sm italic text-neutral-300">La {name} est vide.</li>}
        {state.items.map((it, i) => (
          <li
            key={`${i}-${it}`}
            className={`list-none rounded-md border px-3 py-1.5 font-mono text-neutral-50 ${state.highlight === i ? 'border-brand-accent bg-brand-accent/15' : 'border-white/25 bg-white/5'}`}
          >
            {it}
            {mode === 'liste' && <span className="ml-2 text-xs text-neutral-300">indice {i}</span>}
            {mode === 'pile' && i === 0 && <span className="ml-2 text-xs text-neutral-300">← sommet</span>}
            {mode === 'file' && i === 0 && <span className="ml-2 text-xs text-neutral-300">← sortie</span>}
            {mode === 'file' && i === state.items.length - 1 && state.items.length > 1 && <span className="ml-2 text-xs text-neutral-300">entrée →</span>}
          </li>
        ))}
      </ol>

      <p role="status" aria-live="polite" className="mt-3 min-h-6 text-sm text-neutral-100" data-testid="sim-message">
        {state.message}
      </p>
    </figure>
  );
}
