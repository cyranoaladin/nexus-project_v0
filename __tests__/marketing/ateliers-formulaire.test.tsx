/**
 * Formulaire /ateliers : un parent qui remplit la demande part sur WhatsApp avec son message
 * déjà rédigé ; un formulaire incomplet est arrêté avec la liste de ce qui manque.
 */
import '@testing-library/jest-dom';
import { fireEvent, render, screen } from '@testing-library/react';

import { AtelierInscriptionForm } from '@/components/ateliers/AtelierInscriptionForm';

describe('Formulaire des ateliers gratuits', () => {
  beforeEach(() => { jest.useFakeTimers({ now: new Date('2026-10-19T12:00:00+01:00') }); });
  afterEach(() => { jest.useRealTimers(); });

  it('un formulaire vide n’ouvre pas WhatsApp et dit ce qui manque', () => {
    const ouvrir = jest.fn();
    render(<AtelierInscriptionForm ouvrir={ouvrir} />);
    fireEvent.click(screen.getByRole('button', { name: /Envoyer ma réservation/ }));
    expect(screen.getByRole('alert')).toHaveTextContent('À compléter : votre nom');
    expect(ouvrir).not.toHaveBeenCalled();
  });

  it('une demande complète ouvre WhatsApp avec le message rédigé', () => {
    const ouvrir = jest.fn();
    render(<AtelierInscriptionForm ouvrir={ouvrir} />);
    const saisir = (libelle: RegExp, valeur: string) => fireEvent.change(screen.getByLabelText(libelle), { target: { value: valeur } });
    saisir(/Nom et prénom du parent/, 'Parent Test');
    saisir(/Téléphone WhatsApp/, '22 123 456');
    saisir(/^E-mail/, 'parent@example.test');
    saisir(/Prénom de l’élève/, 'Sami');
    saisir(/Classe actuelle/, '2ème année');
    saisir(/Ville ou quartier/, 'Ariana');
    // 2ème année : seules les dates « 1ère partie » et mixtes sont proposées.
    expect(screen.queryByText('2ème partie du bac français')).not.toBeInTheDocument();
    fireEvent.click(screen.getAllByRole('radio')[0]);
    fireEvent.click(screen.getByRole('checkbox'));
    fireEvent.click(screen.getByRole('button', { name: /Envoyer ma réservation/ }));
    expect(ouvrir).toHaveBeenCalledTimes(1);
    const cible: string = ouvrir.mock.calls[0][0];
    expect(cible).toMatch(/^https:\/\/wa\.me\/\d+\?text=/);
    const message = decodeURIComponent(cible.split('text=')[1]);
    expect(message).toContain('INSCRIPTION ATELIER GRATUIT');
    expect(message).toContain('Mardi 20/10 · 18 h 30 — 1ère partie du bac français (A1)');
    expect(message).toContain('Élève : Sami — 2ème année');
  });
});
