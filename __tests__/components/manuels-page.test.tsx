/**
 * Page publique des manuels — /manuels
 *
 * Elle est adaptée du simulateur interne de la Maison édition. La frontière
 * est testée ici : le visiteur voit des prix et un catalogue, jamais un coût
 * de fabrication, une marge, un contrat d'imprimeur ni une réserve de
 * production. En revanche ce qui lui est dû — le périmètre réel du catalogue,
 * le statut de pré-commande — doit rester affiché.
 */
import '@testing-library/jest-dom';
import { render, screen, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';

import ManuelsShop from '@/app/manuels/_components/ManuelsShop';
import ManuelsPage from '@/app/manuels/page';
import { metadata } from '@/app/manuels/layout';

jest.mock('next/link', () => {
  return function MockLink({ children, href, ...props }: any) {
    return <a href={href} {...props}>{children}</a>;
  };
});

jest.mock('sonner', () => ({
  toast: { success: jest.fn(), error: jest.fn() },
}));

function total() {
  return screen.getByTestId('manuels-total').textContent ?? '';
}

async function cocher(libelle: RegExp) {
  await userEvent.click(screen.getByRole('checkbox', { name: libelle }));
}

describe('page /manuels — cadrage', () => {
  it('est référencée, et son adresse canonique est déclarée', () => {
    expect(metadata.robots).toMatchObject({ index: true, follow: true });
    expect(metadata.alternates?.canonical).toBe('/manuels');
  });

  it('annonce un titre et le statut de pré-commande', () => {
    render(<ManuelsPage />);
    expect(screen.getByRole('heading', { level: 1 })).toBeInTheDocument();
    expect(document.body.textContent).toMatch(/pré-commande/i);
  });

  it('dit ce que le catalogue ne couvre pas', () => {
    render(<ManuelsPage />);
    const texte = document.body.textContent ?? '';
    expect(texte).toMatch(/français/i);
    expect(texte).toMatch(/Grand oral/i);
    expect(texte).toMatch(/ne constitue pas une préparation complète/i);
  });

  it('ne laisse filtrer aucune note interne', () => {
    render(<ManuelsPage />);
    const texte = (document.body.textContent ?? '').toLowerCase();
    // Vocabulaire de l'atelier et de l'audit interne : rien de tout cela ne
    // regarde l'acheteur. Les motifs sont bornés par des frontières de mot pour
    // qu'un mot courant (« combat », « débat ») ne déclenche pas une fausse alerte.
    for (const interdit of [
      /co[ûu]t/,
      /\bclics?\b/,
      /\bloyer\b/,
      /olivetti/,
      /\bmarges?\b/,
      /\bBAT\b/i,
      /fa[çc]onnage/,
      /thermocoll/,
      /prix de revient/,
      /document de travail/,
      /r[ée]serves? (ouverte|de production)/,
      /manifestes?\b/,
      /amorti/,
    ]) {
      expect(texte).not.toMatch(interdit);
    }
  });
});

describe('boutique — choix des volumes et prix', () => {
  it('ne montre aucun total tant que rien n’est choisi', () => {
    render(<ManuelsShop />);
    expect(total()).toMatch(/—|0/);
    expect(screen.getByTestId('manuels-action')).toBeDisabled();
  });

  it('un volume seul est chiffré au barème', async () => {
    render(<ManuelsShop />);
    await cocher(/Physique-chimie — Terminale/i);
    expect(total()).toContain('108');
  });

  it('le format papier change le total', async () => {
    render(<ManuelsShop />);
    await cocher(/Physique-chimie — Terminale/i);
    await userEvent.click(screen.getByRole('radio', { name: /papier noir et blanc/i }));
    expect(total()).toContain('197');
    await userEvent.click(screen.getByRole('radio', { name: /papier couleur/i }));
    expect(total()).toContain('305');
  });

  it('le lot affiche l’économie par rapport à l’achat à l’unité', async () => {
    render(<ManuelsShop />);
    await cocher(/Physique-chimie — Terminale/i);
    await cocher(/Physique-chimie — Première/i);
    const economie = screen.getByTestId('manuels-economie');
    expect(economie.textContent).toMatch(/\d+ DT/);
    expect(economie.textContent).toMatch(/%/);
  });

  it('une annexe de douze pages ou moins est annoncée offerte en PDF', async () => {
    render(<ManuelsShop />);
    // Épicure, Lettre à Ménécée : 7 pages, sous le seuil de gratuité.
    await userEvent.click(screen.getByRole('button', { name: /^Philosophie/ }));
    const ligne = screen.getByRole('checkbox', { name: /Épicure/i }).closest('label');
    expect(ligne).not.toBeNull();
    expect(ligne!.textContent).toMatch(/offert en PDF/i);
    expect(ligne!.textContent).toMatch(/7 pages/);
  });

  it('une annexe offerte ne fait pas monter le prix du PDF', async () => {
    render(<ManuelsShop />);
    await cocher(/Physique-chimie — Terminale/i);
    const avant = total();
    await userEvent.click(screen.getByRole('button', { name: /^Philosophie/ }));
    await cocher(/Épicure/i);
    expect(total()).toBe(avant);
  });
});

describe('boutique — remise et coordonnées', () => {
  it('le retrait au centre est proposé et n’appelle aucune adresse', () => {
    render(<ManuelsShop />);
    expect(screen.getByRole('radio', { name: /retrait au centre/i })).toBeChecked();
    expect(screen.queryByLabelText(/adresse postale/i)).not.toBeInTheDocument();
  });

  it('la livraison fait apparaître l’adresse, et elle est offerte', async () => {
    render(<ManuelsShop />);
    await userEvent.click(screen.getByRole('radio', { name: /livraison/i }));
    expect(screen.getByLabelText(/adresse postale/i)).toBeInTheDocument();
    expect(screen.getByLabelText(/ville/i)).toBeInTheDocument();
    expect(screen.getByRole('radio', { name: /livraison/i })).toHaveAccessibleName(/offerte/i);
  });

  it('envoie la demande au serveur et affiche la référence renvoyée', async () => {
    const fetchMock = jest.fn().mockResolvedValue({
      ok: true,
      json: async () => ({ ok: true, reference: 'lead_42', quote: { total: 108 } }),
    });
    global.fetch = fetchMock as unknown as typeof fetch;

    render(<ManuelsShop />);
    await cocher(/Physique-chimie — Terminale/i);
    await userEvent.type(screen.getByLabelText(/nom/i), 'Nour B.');
    await userEvent.type(screen.getByLabelText(/e-mail/i), 'nour@example.com');
    await userEvent.type(screen.getByLabelText(/téléphone/i), '+21620000000');
    await userEvent.click(screen.getByRole('checkbox', { name: /j’accepte/i }));
    await userEvent.click(screen.getByTestId('manuels-action'));

    expect(fetchMock).toHaveBeenCalledWith(
      '/api/manuels/commande',
      expect.objectContaining({ method: 'POST' }),
    );
    const corps = JSON.parse((fetchMock.mock.calls[0][1] as RequestInit).body as string);
    expect(corps.items).toEqual(['pc-t']);
    expect(corps.format).toBe('pdf');
    expect(corps.delivery).toEqual({ mode: 'retrait' });
    expect(await screen.findByText(/lead_42/)).toBeInTheDocument();
  });
});

describe('mobile — le devis suit le pouce', () => {
  it('le panneau de devis est épinglé en bas de l’écran sur mobile, en colonne sur grand écran', () => {
    render(<ManuelsShop />);
    const devis = screen.getByTestId('manuels-devis');
    // épinglé en bas tant que l'écran est étroit, remis dans le flux au-delà
    expect(devis.className).toMatch(/fixed/);
    expect(devis.className).toMatch(/bottom-0/);
    expect(devis.className).toMatch(/lg:sticky/);
    // la zone sûre des téléphones à encoche est respectée
    expect(devis.className).toMatch(/safe-area-inset-bottom/);
  });

  it('le total reste lisible sans dérouler la page', () => {
    render(<ManuelsShop />);
    const devis = screen.getByTestId('manuels-devis');
    expect(within(devis).getByTestId('manuels-total')).toBeInTheDocument();
    expect(within(devis).getByTestId('manuels-action')).toBeInTheDocument();
  });

  it('le formulaire réserve la place de la barre épinglée', () => {
    const { container } = render(<ManuelsShop />);
    const form = container.querySelector('form')!;
    expect(form.className).toMatch(/pb-\[/);
  });
});

describe('mobile — aucune impasse', () => {
  it('sans sélection, l’action dit quoi faire au lieu d’être muette', async () => {
    render(<ManuelsShop />);
    const action = screen.getByTestId('manuels-action');
    expect(action).toBeDisabled();
    expect(action.textContent).toMatch(/choisissez vos volumes/i);
  });

  it('avec des volumes mais sans coordonnées, l’action reste cliquable et mène à la suite', async () => {
    render(<ManuelsShop />);
    await cocher(/Physique-chimie — Terminale/i);
    const action = screen.getByTestId('manuels-action');
    expect(action).toBeEnabled();
    expect(action.textContent).toMatch(/compléter/i);
    expect(screen.getByTestId('manuels-manquants').textContent).toMatch(/nom|e-mail|téléphone/i);
  });

  it('l’action amène le curseur sur le premier champ manquant', async () => {
    render(<ManuelsShop />);
    await cocher(/Physique-chimie — Terminale/i);
    await userEvent.click(screen.getByTestId('manuels-action'));
    expect(screen.getByLabelText(/nom complet/i)).toHaveFocus();
  });

  it('une fois tout rempli, l’action envoie', async () => {
    render(<ManuelsShop />);
    await cocher(/Physique-chimie — Terminale/i);
    await userEvent.type(screen.getByLabelText(/nom complet/i), 'Nour B.');
    await userEvent.type(screen.getByLabelText(/e-mail/i), 'nour@example.com');
    await userEvent.type(screen.getByLabelText(/téléphone/i), '+21620000000');
    await userEvent.click(screen.getByRole('checkbox', { name: /j’accepte/i }));
    const action = screen.getByTestId('manuels-action');
    expect(action.textContent).toMatch(/envoyer ma demande/i);
    expect(screen.queryByTestId('manuels-manquants')).not.toBeInTheDocument();
  });
});

describe('mobile — les champs ouvrent le bon clavier', () => {
  it.each([
    [/nom complet/i, { autocomplete: 'name' }],
    [/e-mail/i, { type: 'email', inputmode: 'email', autocomplete: 'email' }],
    [/téléphone/i, { type: 'tel', inputmode: 'tel', autocomplete: 'tel' }],
  ])('%s', (libelle, attendus) => {
    render(<ManuelsShop />);
    const champ = screen.getByLabelText(libelle);
    for (const [attribut, valeur] of Object.entries(attendus)) {
      expect(champ.getAttribute(attribut)).toBe(valeur);
    }
  });

  it('l’adresse de livraison aussi', async () => {
    render(<ManuelsShop />);
    await userEvent.click(screen.getByRole('radio', { name: /livraison/i }));
    expect(screen.getByLabelText(/adresse postale/i).getAttribute('autocomplete')).toBe('street-address');
    expect(screen.getByLabelText(/ville/i).getAttribute('autocomplete')).toBe('address-level2');
  });
});

describe('les couvertures', () => {
  it('chaque manuel couvert montre sa couverture, en deux tailles et sans saut de mise en page', () => {
    render(<ManuelsShop />);
    const img = screen.getByAltText(/Couverture : Physique-chimie — Terminale/i) as HTMLImageElement;
    expect(img.getAttribute('srcset')).toMatch(/220w/);
    expect(img.getAttribute('srcset')).toMatch(/440w/);
    expect(img.getAttribute('sizes')).toBeTruthy();
    expect(img.getAttribute('width')).toBeTruthy();
    expect(img.getAttribute('height')).toBeTruthy();
    expect(img.getAttribute('loading')).toBe('lazy');
    expect(img.getAttribute('decoding')).toBe('async');
  });

  it('un volume sans couverture reçoit une vignette lisible, pas une image cassée', async () => {
    render(<ManuelsShop />);
    await userEvent.click(screen.getByRole('button', { name: /^Philosophie/ }));
    const carte = screen.getByRole('checkbox', { name: /Épicure/i }).closest('li')!;
    expect(within(carte).queryByRole('img')).toBeNull();
    expect(carte.textContent).toMatch(/Philosophie/i);
  });

  it('la couverture s’agrandit, recto et quatrième, sans perdre la sélection', async () => {
    render(<ManuelsShop />);
    await cocher(/Physique-chimie — Terminale/i);
    await userEvent.click(screen.getByRole('button', { name: /agrandir la couverture.*Physique-chimie — Terminale/i }));
    const boite = await screen.findByRole('dialog');
    expect(within(boite).getAllByRole('img').length).toBeGreaterThanOrEqual(2);
    expect(within(boite).getByAltText(/^Quatrième de couverture/i)).toBeInTheDocument();
    // le dialogue est modal : la page est masquée tant qu'il est ouvert, la
    // sélection se vérifie donc au retour.
    await userEvent.keyboard('{Escape}');
    expect(screen.getByRole('checkbox', { name: /Physique-chimie — Terminale/i })).toBeChecked();
  });
});

describe('commander un lot sans friction', () => {
  it('une discipline entière se prend d’un geste, et se retire de même', async () => {
    render(<ManuelsShop />);
    // Physique-chimie est dépliée d'entrée : la cliquer la refermerait.
    const section = screen.getByRole('button', { name: /^Physique-chimie/ }).parentElement!;
    const tout = within(section).getByRole('button', { name: /tout prendre/i });
    await userEvent.click(tout);
    expect(screen.getByRole('checkbox', { name: /Physique-chimie — Terminale/i })).toBeChecked();
    expect(screen.getByRole('checkbox', { name: /Physique-chimie — Première/i })).toBeChecked();

    const retirer = within(section).getByRole('button', { name: /tout retirer/i });
    await userEvent.click(retirer);
    expect(screen.getByRole('checkbox', { name: /Physique-chimie — Terminale/i })).not.toBeChecked();
  });

  it('un volume se retire depuis le devis lui-même', async () => {
    render(<ManuelsShop />);
    await cocher(/Physique-chimie — Terminale/i);
    const devis = screen.getByTestId('manuels-devis');
    await userEvent.click(within(devis).getByRole('button', { name: /retirer.*Physique-chimie — Terminale/i }));
    expect(screen.getByRole('checkbox', { name: /Physique-chimie — Terminale/i })).not.toBeChecked();
    expect(total()).toMatch(/—/);
  });

  it('le changement de prix est annoncé aux lecteurs d’écran', () => {
    render(<ManuelsShop />);
    const annonce = screen.getByTestId('manuels-total').closest('[aria-live]');
    expect(annonce).not.toBeNull();
    expect(annonce!.getAttribute('aria-live')).toBe('polite');
  });

  it('la carte reste pilotable au clavier : la case a un anneau de focus visible', () => {
    render(<ManuelsShop />);
    const carte = screen.getByRole('checkbox', { name: /Physique-chimie — Terminale/i }).closest('label')!;
    expect(carte.className).toMatch(/peer-focus-visible/);
  });
});

describe('quand le serveur refuse', () => {
  it('le refus est dit sur la page, pas seulement dans une bulle fugace', async () => {
    global.fetch = jest.fn().mockResolvedValue({
      ok: false,
      json: async () => ({ ok: false, error: 'unknown_volume' }),
    }) as unknown as typeof fetch;

    render(<ManuelsShop />);
    await cocher(/Physique-chimie — Terminale/i);
    await userEvent.type(screen.getByLabelText(/nom complet/i), 'Nour B.');
    await userEvent.type(screen.getByLabelText(/e-mail/i), 'nour@example.com');
    await userEvent.type(screen.getByLabelText(/téléphone/i), '+21620000000');
    await userEvent.click(screen.getByRole('checkbox', { name: /j’accepte/i }));
    await userEvent.click(screen.getByTestId('manuels-action'));

    const alerte = await screen.findByRole('alert');
    expect(alerte.textContent).toMatch(/pas pu être enregistrée|réessay/i);
  });

  it('après un envoi réussi, on peut repartir d’une demande vierge', async () => {
    global.fetch = jest.fn().mockResolvedValue({
      ok: true,
      json: async () => ({ ok: true, reference: 'lead_77', quote: { total: 108 } }),
    }) as unknown as typeof fetch;

    render(<ManuelsShop />);
    await cocher(/Physique-chimie — Terminale/i);
    await userEvent.type(screen.getByLabelText(/nom complet/i), 'Nour B.');
    await userEvent.type(screen.getByLabelText(/e-mail/i), 'nour@example.com');
    await userEvent.type(screen.getByLabelText(/téléphone/i), '+21620000000');
    await userEvent.click(screen.getByRole('checkbox', { name: /j’accepte/i }));
    await userEvent.click(screen.getByTestId('manuels-action'));

    expect(await screen.findByText(/lead_77/)).toBeInTheDocument();
    await userEvent.click(screen.getByRole('button', { name: /faire une autre demande/i }));
    expect(screen.queryByText(/lead_77/)).not.toBeInTheDocument();
    expect(screen.getByRole('checkbox', { name: /Physique-chimie — Terminale/i })).not.toBeChecked();
    expect(screen.getByLabelText(/nom complet/i)).toHaveValue('');
  });
});
