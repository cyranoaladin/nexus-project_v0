/**
 * Simulateur liste / pile / file du plan de secours : version vanilla (sans React) de
 * `components/espace/student/figures/StructureSim.tsx`. Les messages sont IDENTIQUES ; un test
 * (`__tests__/scripts/espace-fallback.test.ts`) compare les deux implémentations.
 */
export type SimMode = 'liste' | 'pile' | 'file';

export interface SimState {
  /** Toujours dans l'ordre d'AFFICHAGE (pile : sommet en premier ; file : prochain à sortir en premier). */
  items: string[];
  message: string;
  highlight: number | null;
}

const MAX_ITEMS = 8;
const MAX_LEN = 8;

export function initialState(spec: { initial?: string[] }): SimState {
  return { items: [...(spec.initial ?? [])], message: '', highlight: null };
}

export function addItem(mode: SimMode, s: SimState, raw: string): SimState {
  const value = raw.trim().slice(0, MAX_LEN);
  if (!value) return { ...s, message: 'Saisis d’abord une valeur à ajouter.', highlight: null };
  if (s.items.length >= MAX_ITEMS) return { ...s, message: `Le simulateur est limité à ${MAX_ITEMS} éléments.`, highlight: null };
  if (mode === 'pile') return { items: [value, ...s.items], message: `« ${value} » est posé au sommet.`, highlight: 0 };
  return {
    items: [...s.items, value],
    message: mode === 'file' ? `« ${value} » rejoint l’arrière de la file.` : `« ${value} » est ajouté à la fin (indice ${s.items.length}).`,
    highlight: s.items.length,
  };
}

export function removeItem(mode: Exclude<SimMode, 'liste'>, s: SimState): SimState {
  if (s.items.length === 0) {
    return {
      ...s,
      message: mode === 'pile' ? 'Pile vide : rien à dépiler. Dans notre contrat, c’est une erreur (IndexError).' : 'File vide : rien à défiler. Dans notre contrat, c’est une erreur (IndexError).',
      highlight: null,
    };
  }
  const [out, ...rest] = s.items;
  return { items: rest, message: mode === 'pile' ? `Dépiler renvoie « ${out} » et le retire de la pile.` : `Défiler renvoie « ${out} » et le retire de la file.`, highlight: null };
}

export function peekItem(mode: Exclude<SimMode, 'liste'>, s: SimState): SimState {
  if (s.items.length === 0) {
    return {
      ...s,
      message: mode === 'pile' ? 'Pile vide : pas de sommet. Dans notre contrat, c’est une erreur (IndexError).' : 'File vide : pas de premier élément. Dans notre contrat, c’est une erreur (IndexError).',
      highlight: null,
    };
  }
  const label = mode === 'pile' ? 'sommet' : 'premier';
  return {
    ...s,
    message: `${mode === 'pile' ? 'Sommet' : 'Premier'} : « ${s.items[0]} ». Consulter ne retire rien (la ${mode} garde ${s.items.length} élément${s.items.length > 1 ? 's' : ''}) — ${label}() ≠ ${mode === 'pile' ? 'depiler' : 'defiler'}().`,
    highlight: 0,
  };
}

export function readAt(s: SimState, index: number): SimState {
  if (!Number.isInteger(index) || index < 0 || index >= s.items.length) {
    return {
      ...s,
      message: `Indice ${Number.isFinite(index) ? index : '?'} invalide pour une liste de ${s.items.length} élément${s.items.length > 1 ? 's' : ''} (IndexError). Les indices vont de 0 à ${Math.max(s.items.length - 1, 0)} ; un indice négatif est invalide dans notre contrat.`,
      highlight: null,
    };
  }
  return { ...s, message: `element(${index}) renvoie « ${s.items[index]} ».`, highlight: index };
}

const esc = (s: string) => s.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;');

/** HTML statique d'un simulateur (les boutons sont gérés par délégation d'événements dans runtime.ts). */
export function simMarkup(spec: { id: string; mode: SimMode; caption?: string }, state: SimState): string {
  const { mode } = spec;
  const controls =
    mode === 'liste'
      ? `<input type="number" data-sim-index value="0" aria-label="Indice à lire" class="sim-index"><button type="button" data-sim="read">Lire cet indice</button>`
      : `<button type="button" data-sim="remove">${mode === 'pile' ? 'Dépiler' : 'Défiler'}</button><button type="button" data-sim="peek">${mode === 'pile' ? 'Voir le sommet' : 'Voir le premier'}</button>`;
  const items = state.items.length
    ? state.items
        .map((it, i) => {
          const tag =
            mode === 'liste'
              ? `<span class="sim-tag">indice ${i}</span>`
              : mode === 'pile'
                ? i === 0 ? '<span class="sim-tag">← sommet</span>' : ''
                : (i === 0 ? '<span class="sim-tag">← sortie</span>' : '') + (i === state.items.length - 1 && state.items.length > 1 ? '<span class="sim-tag">entrée →</span>' : '');
          return `<li class="${state.highlight === i ? 'hl' : ''}">${esc(it)}${tag}</li>`;
        })
        .join('')
    : `<li class="sim-empty">La ${mode} est vide.</li>`;
  const aria = `Contenu de la ${mode}${mode === 'pile' ? ' (sommet en premier)' : mode === 'file' ? ' (prochain à sortir en premier)' : ''}`;
  return `<figcaption>${esc(spec.caption ?? `Simulateur de ${mode}`)}</figcaption>
<div class="sim-controls"><input type="text" data-sim-value maxlength="${MAX_LEN}" placeholder="ex. : A" autocomplete="off" aria-label="Valeur à ajouter à la ${mode}"><button type="button" data-sim="add">${mode === 'pile' ? 'Empiler' : mode === 'file' ? 'Enfiler' : 'Ajouter'}</button>${controls}<button type="button" data-sim="clear">Vider</button></div>
<ol class="sim-items ${mode}" aria-label="${aria}" data-testid="sim-items">${items}</ol>
<p role="status" aria-live="polite" class="sim-message" data-testid="sim-message">${esc(state.message)}</p>`;
}
