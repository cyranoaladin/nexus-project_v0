import { fireEvent, render, screen, within } from '@testing-library/react';

import { CallTrace } from '@/components/espace/student/figures/CallTrace';
import type { CallTraceSpec } from '@/lib/espace/lesson-types';

const somme: CallTraceSpec = { type: 'call-trace', id: 't-somme', fn: 'somme', args: [4] };
const next = () => fireEvent.click(screen.getByRole('button', { name: 'Étape suivante' }));
const events = () => Array.from(screen.getByTestId('trace-events').querySelectorAll('li[data-event]')).map((li) => li.textContent ?? '');
const stack = () => within(screen.getByTestId('trace-stack')).queryAllByRole('listitem').map((li) => li.textContent ?? '');

describe('CallTrace', () => {
  it('démarre vide : aucun événement, pile vide, bouton précédent désactivé', () => {
    render(<CallTrace spec={somme} />);
    expect(screen.getByText('Aucun événement pour l’instant.')).toBeInTheDocument();
    expect(screen.getByText('La pile est vide.')).toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'Étape précédente' })).toBeDisabled();
    expect(screen.getByTestId('trace-phase')).toHaveTextContent('Rien n’a encore été appelé');
  });

  it('la descente empile les appels, le sommet est en premier', () => {
    render(<CallTrace spec={somme} />);
    for (let i = 0; i < 5; i++) next();
    expect(events().map((e) => e.split(' ').slice(0, 2).join(' '))).toEqual(['APPEL somme(4)', 'APPEL somme(3)', 'APPEL somme(2)', 'APPEL somme(1)', 'APPEL somme(0)']);
    expect(stack()[0]).toContain('somme(0)');
    expect(stack()[0]).toContain('sommet');
    expect(stack()).toHaveLength(5);
    expect(screen.getByTestId('trace-phase')).toHaveTextContent('Descente');
  });

  it('la remontée rend les valeurs dans l’ordre inverse et rappelle LIFO', () => {
    render(<CallTrace spec={somme} />);
    for (let i = 0; i < 6; i++) next();
    expect(events()[5]).toContain('RETOUR 0');
    expect(screen.getByTestId('trace-phase')).toHaveTextContent('Remontée');
    expect(screen.getByTestId('trace-message')).toHaveTextContent('Le dernier appel créé est le premier terminé');
    for (let i = 0; i < 4; i++) next();
    expect(events().filter((e) => e.startsWith('RETOUR')).map((e) => e.split(' ')[1])).toEqual(['0', '1', '3', '6', '10']);
    expect(screen.getByText('La pile est vide.')).toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'Étape suivante' })).toBeDisabled();
    expect(screen.getByTestId('trace-phase')).toHaveTextContent('Terminé');
  });

  it('recommencer et précédent remettent l’état en arrière', () => {
    render(<CallTrace spec={somme} />);
    next(); next();
    fireEvent.click(screen.getByRole('button', { name: 'Étape précédente' }));
    expect(events()).toHaveLength(1);
    fireEvent.click(screen.getByRole('button', { name: 'Recommencer' }));
    expect(events()).toHaveLength(0);
  });

  it('changer la valeur de n recalcule la trace et reborne les valeurs absurdes', () => {
    render(<CallTrace spec={somme} />);
    const n = screen.getByRole('spinbutton', { name: /Valeur de n/ });
    fireEvent.change(n, { target: { value: '2' } });
    expect(screen.getByTestId('trace-phase')).toHaveTextContent('3 appels au total');
    fireEvent.change(n, { target: { value: '500' } });
    expect((n as HTMLInputElement).value).toBe('8');
    expect(screen.getByTestId('trace-phase')).toHaveTextContent('9 appels au total');
  });

  it('puissance expose a et n, et affiche le calcul de chaque retour', () => {
    render(<CallTrace spec={{ type: 'call-trace', id: 't-p', fn: 'puissance', args: [2, 4] }} />);
    expect(screen.getAllByRole('spinbutton')).toHaveLength(2);
    for (let i = 0; i < 10; i++) next();
    expect(events().at(-1)).toContain('RETOUR 16');
    expect(events().at(-1)).toContain('2 × 8 = 16');
  });

  it('fibonacci signale les calculs répétés', () => {
    render(<CallTrace spec={{ type: 'call-trace', id: 't-f', fn: 'fibonacci', args: [5] }} />);
    expect(screen.getByTestId('trace-repeated')).toHaveTextContent('fibonacci(2) ×3');
  });

  it('annonce chaque étape dans une zone aria-live', () => {
    render(<CallTrace spec={somme} />);
    next();
    expect(screen.getByTestId('trace-message')).toHaveAttribute('aria-live', 'polite');
    expect(screen.getByTestId('trace-message')).toHaveTextContent('On appelle somme(4)');
  });
});
