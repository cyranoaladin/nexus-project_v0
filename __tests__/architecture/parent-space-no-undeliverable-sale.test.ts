import fs from 'node:fs';
import path from 'node:path';

/**
 * Garde-fous de l'espace parent authentifié.
 *
 * Les bilans sont diffusés aux familles : l'espace parent est la surface que
 * les parents ouvrent au moment de décider. Trois règles y sont non
 * négociables et vérifiées ici par lecture des sources :
 *
 *  1. on ne vend pas ce qu'on ne livre pas (ARIA) ;
 *  2. on n'affiche aucune donnée inventée sur l'enfant d'un parent ;
 *  3. aucun appel à l'action ne mène à une impasse.
 */

const read = (relativePath: string): string =>
  fs.readFileSync(path.join(process.cwd(), relativePath), 'utf8');

const ABONNEMENTS = 'app/dashboard/parent/abonnements/page.tsx';
const PARENT_HOME = 'app/dashboard/parent/page.tsx';
const CHILD_SHEET = 'app/dashboard/parent/enfant/[studentId]/page.tsx';
const PAIEMENT = 'app/dashboard/parent/paiement/page.tsx';

const SUBSCRIPTION_REQUEST_ROUTE = 'app/api/parent/subscription-requests/route.ts';
const CANON = 'data/pricing.canonical.json';

describe('espace parent — on ne vend pas ce qui n’est pas livrable', () => {
  it('aucun bouton de souscription à un abonnement mensuel n’est rendu', () => {
    const source = read(ABONNEMENTS);
    expect(source).not.toContain('Changer pour {plan.name}');
  });

  it('aucun bouton d’ajout d’add-on ARIA n’est rendu', () => {
    const source = read(ABONNEMENTS);
    expect(source).not.toContain('Ajouter cet Add-on');
  });

  it('la porte est aussi fermée côté serveur : retirer le bouton ne suffit pas', () => {
    const source = read(SUBSCRIPTION_REQUEST_ROUTE);
    expect(source).toContain('@/lib/commerce/sale-suspension');
    expect(source).toContain('isSaleSuspended');
    expect(source).toContain('SALE_SUSPENDED');
  });

  it('aucune donnée n’est supprimée : les catalogues restent dans le canon', () => {
    const canon = JSON.parse(read(CANON)) as Record<string, unknown>;
    expect(canon.operational_subscription_plans).toBeDefined();
    expect(canon.operational_aria_addons).toBeDefined();
  });

  it('la page propose le vrai chemin d’inscription à la place', () => {
    const source = read(ABONNEMENTS);
    expect(source).toContain('AnnualParcoursCard');
  });

  it('le remplacement ne redessine pas un second catalogue, il renvoie au seul existant', () => {
    const source = read('components/dashboard/parent/AnnualParcoursCard.tsx');
    expect(source).toContain('/offres');
    expect(source).toContain('buildWhatsAppUrl');
    // Un composant client ne doit jamais tirer le canon complet dans le bundle.
    expect(source).not.toContain('@/lib/pricing');
  });
});

describe('espace parent — aucune donnée inventée sur l’enfant', () => {
  const source = read(CHILD_SHEET);

  it('n’affiche plus de position de cohorte fabriquée', () => {
    expect(source).not.toContain('Top 15');
  });

  it('n’affiche plus de comparaison de cohorte aux valeurs codées en dur', () => {
    expect(source).not.toContain('isStudent: true');
    expect(source).not.toContain('CohortComparison');
  });

  it('n’affiche plus d’étapes de progression fictives', () => {
    expect(source).not.toContain('Finaliser le module');
    expect(source).not.toContain('session de groupe du 12 Mai');
  });
});

describe('espace parent — aucun appel à l’action en impasse', () => {
  it('« Gérer mes abonnements » mène à la page abonnements', () => {
    const source = read(PARENT_HOME);
    if (source.includes('Gérer mes abonnements')) {
      expect(source).toContain('/dashboard/parent/abonnements');
    }
  });

  it('le rapport annuel inexistant n’est plus proposé', () => {
    expect(read(PARENT_HOME)).not.toContain('Voir le rapport annuel');
  });

  it('la fiche enfant ne propose plus de réservation sans destination', () => {
    const source = read(CHILD_SHEET);
    expect(source).not.toContain('Réserver une séance');
  });

  it('« Gérer l’abonnement » de la fiche enfant mène quelque part', () => {
    const source = read(CHILD_SHEET);
    if (source.includes("Gérer l'abonnement")) {
      expect(source).toContain('/dashboard/parent/abonnements');
    }
  });
});

describe('espace parent — cohérence des moyens de paiement', () => {
  it('ne présente pas ClicToPay comme actif alors qu’il est désactivé', () => {
    const source = read(PAIEMENT);
    const claimsCardIsAvailable = /Paiement par \{?\s*CGV_POLICY\.payment\.provider/.test(source);
    expect(claimsCardIsAvailable).toBe(false);
  });

  it('offre un recours WhatsApp quand le virement bloque', () => {
    const source = read(PAIEMENT);
    expect(source).toContain('buildWhatsAppUrl');
  });
});
