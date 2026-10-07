import { fireEvent, render, screen } from '@testing-library/react';

import { addItem, initialState, peekItem, readAt, removeItem, StructureSim } from '@/components/espace/student/figures/StructureSim';
import type { StructureSimSpec } from '@/lib/espace/lesson-types';

const spec = (mode: StructureSimSpec['mode'], initial: string[] = []): StructureSimSpec => ({ type: 'structure-sim', id: `s-${mode}`, mode, initial });
const items = () => screen.queryAllByRole('listitem').map((li) => li.textContent ?? '');
const type = (v: string) => fireEvent.change(screen.getByRole('textbox'), { target: { value: v } });
const click = (name: RegExp | string) => fireEvent.click(screen.getByRole('button', { name }));

describe('modèle (sans React)', () => {
  it('pile : dernier posé, premier retiré (LIFO)', () => {
    let s = initialState(spec('pile'));
    for (const v of ['A', 'B', 'C']) s = addItem('pile', s, v);
    expect(s.items).toEqual(['C', 'B', 'A']);
    s = removeItem('pile', s);
    expect(s.message).toContain('« C »');
    expect(s.items).toEqual(['B', 'A']);
  });

  it('file : premier arrivé, premier sorti (FIFO)', () => {
    let s = initialState(spec('file'));
    for (const v of ['A', 'B', 'C']) s = addItem('file', s, v);
    expect(s.items).toEqual(['A', 'B', 'C']);
    s = removeItem('file', s);
    expect(s.message).toContain('« A »');
    expect(s.items).toEqual(['B', 'C']);
  });

  it('consulter ne retire rien et le dit', () => {
    const s = peekItem('pile', { items: ['B', 'A'], message: '', highlight: null });
    expect(s.items).toEqual(['B', 'A']);
    expect(s.message).toMatch(/ne retire rien/);
  });

  it('structure vide : erreur annoncée (IndexError), état inchangé', () => {
    expect(removeItem('pile', initialState(spec('pile'))).message).toMatch(/IndexError/);
    expect(peekItem('file', initialState(spec('file'))).message).toMatch(/IndexError/);
  });

  it('liste : indice négatif ou hors bornes invalide, lecture valide sinon', () => {
    const base = { items: ['Ada', 'Alan'], message: '', highlight: null };
    expect(readAt(base, 1).message).toContain('« Alan »');
    expect(readAt(base, -1).message).toMatch(/invalide.*négatif|négatif.*invalide/);
    expect(readAt(base, 2).message).toMatch(/IndexError/);
    expect(readAt(base, 1.5).message).toMatch(/IndexError/);
  });

  it('refuse la valeur vide et borne la taille', () => {
    expect(addItem('pile', initialState(spec('pile')), '   ').items).toEqual([]);
    let s = initialState(spec('file'));
    for (let i = 0; i < 12; i++) s = addItem('file', s, String(i));
    expect(s.items).toHaveLength(8);
    expect(s.message).toMatch(/limité/);
  });

  it('tronque une valeur trop longue', () => {
    expect(addItem('liste', initialState(spec('liste')), 'abcdefghijkl').items[0]).toBe('abcdefgh');
  });
});

describe('composant', () => {
  it('pile : empiler, dépiler, annonce, vider', () => {
    render(<StructureSim spec={spec('pile')} />);
    expect(screen.getByText('La pile est vide.')).toBeInTheDocument();
    type('A'); click('Empiler');
    type('B'); click('Empiler');
    expect(items()[0]).toContain('B');
    expect(items()[0]).toContain('sommet');
    expect((screen.getByRole('textbox') as HTMLInputElement).value).toBe('');
    click('Dépiler');
    expect(screen.getByRole('status')).toHaveTextContent('« B »');
    expect(items()).toHaveLength(1);
    click('Vider');
    expect(screen.getByText('La pile est vide.')).toBeInTheDocument();
  });

  it('file : la touche Entrée enfile, et la sortie est marquée', () => {
    render(<StructureSim spec={spec('file', ['X'])} />);
    type('Y');
    fireEvent.keyDown(screen.getByRole('textbox'), { key: 'Enter' });
    expect(items()).toHaveLength(2);
    expect(items()[0]).toContain('sortie');
    click('Défiler');
    expect(screen.getByRole('status')).toHaveTextContent('« X »');
  });

  it('liste : lit un indice et refuse un indice invalide sans planter', () => {
    render(<StructureSim spec={spec('liste', ['Ada', 'Alan'])} />);
    fireEvent.change(screen.getByLabelText('Indice à lire'), { target: { value: '1' } });
    click('Lire cet indice');
    expect(screen.getByRole('status')).toHaveTextContent('« Alan »');
    fireEvent.change(screen.getByLabelText('Indice à lire'), { target: { value: '-1' } });
    click('Lire cet indice');
    expect(screen.getByRole('status')).toHaveTextContent(/invalide/);
  });

  it('est accessible : champs étiquetés, liste nommée, région de statut', () => {
    render(<StructureSim spec={spec('pile')} />);
    expect(screen.getByLabelText('Valeur à ajouter à la pile')).toBeInTheDocument();
    expect(screen.getByRole('list', { name: /pile.*sommet en premier/i })).toBeInTheDocument();
    expect(screen.getByRole('status')).toHaveAttribute('aria-live', 'polite');
  });
});
