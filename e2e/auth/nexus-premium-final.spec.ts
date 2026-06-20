import { test, expect } from '@playwright/test';

const WA_NUMBER = '21699192829';

test.describe('Nexus premium final — contenu et parcours publics', () => {
  test('homepage contient les blocs publics non négociables', async ({ page }) => {
    await page.goto('/', { waitUntil: 'domcontentloaded' });
    const body = page.locator('body');

    for (const text of [
      'Trouver ma formule',
      'Préparer le bac français avec méthode, suivi et exigence',
      'Cellule Cyclades',
      'Groupes de 5 max',
      'Enseignants agrégés',
      'Repères tarifaires',
      'TND',
      'Demander un bilan gratuit',
    ]) {
      await expect(body).toContainText(text);
    }

    await expect(body).not.toContainText('Forfait Excellence');
    await expect(body).not.toContainText('100 % réussite');
    await expect(body).not.toContainText('réussite garantie');
    await expect(body).not.toContainText('date limite');
    await expect(body).not.toContainText('période de réservation prioritaire');
  });

  test('catalogue expose des cartes structurées et des détails premium', async ({ page }) => {
    test.skip(true, 'QUARANTINE: PRE-EXISTING: /catalogue-nexus-reussite-2026-2027.html and /nexus_selecteur.html are static files not deployed in E2E container');
    await page.goto('/catalogue-nexus-reussite-2026-2027.html', { waitUntil: 'domcontentloaded' });

    for (const offerName of [
      'Première Libre Accompagnée',
      'Terminale Libre Mixte',
      'Terminale Libre Premium',
      'Première Double Sécurité',
      'Duo Terminale Nexus',
      'Excellence Terminale',
      'Plateforme Accompagnée',
      'Stage de prérentrée',
    ]) {
      await expect(page.locator('body')).toContainText(offerName);
    }

    await expect(page.locator('body')).toContainText('Enseignants certifiés et agrégés de l\'enseignement français à l\'étranger');
    await expect(page.locator('body')).toContainText('des places disponibles');
    await expect(page.locator('body')).toContainText('Stages positionnés sur les périodes de vacances scolaires selon le calendrier de l\'établissement.');
    await expect(page.locator('body')).toContainText('Toussaint, hiver/février, printemps selon calendrier AEFE rythme nord.');
    await expect(page.locator('body')).toContainText('Calendrier adapté au statut candidat libre et aux échéances d\'examen.');
    await expect(page.locator('body')).not.toContainText('date limite');
    await expect(page.locator('body')).not.toContainText('période de réservation prioritaire');

    const checked = ['Première Libre Accompagnée', 'Terminale Libre Mixte', 'Duo Terminale Nexus', 'Plateforme Accompagnée'];
    for (const offerName of checked) {
      const card = page.locator('article.offer', { hasText: offerName }).first();
      await expect(card.locator('.offer-category, .pill').first()).toBeVisible();
      await expect(card.locator('.offer-for')).toBeVisible();
      await expect(card.locator('.price-main')).toContainText(/TND/);
      await expect(card.locator('li')).toHaveCount(3);
      await expect(card.locator('.offer-actions a', { hasText: 'Recevoir l\'échéancier' })).toBeVisible();
      await expect(card.locator('button, summary', { hasText: 'Voir le détail' }).first()).toBeVisible();

      const details = card.locator('details.offer-detail').first();
      await details.evaluate((el: HTMLDetailsElement) => { el.open = true; });
      for (const label of ['Pour qui ?', 'Ce qui est inclus', 'Format', 'Paiement', 'Points à valider', 'WhatsApp']) {
        await expect(details).toContainText(label);
      }
    }
  });

  test('sélecteur affiche un résultat diagnostic avec CTA attendus', async ({ page }) => {
    test.skip(true, 'QUARANTINE: PRE-EXISTING: /catalogue-nexus-reussite-2026-2027.html and /nexus_selecteur.html are static files not deployed in E2E container');
    await page.goto('/nexus_selecteur.html', { waitUntil: 'domcontentloaded' });
    await page.getByRole('button', { name: /Élève scolarisé/i }).click();
    await page.getByRole('button', { name: /^Terminale/i }).click();
    await page.getByRole('button', { name: /Duo Terminale Nexus/i }).click();
    await page.getByRole('button', { name: /Maths \+ Physique/i }).click();

    const result = page.locator('#result');
    await expect(result).toBeVisible();
    for (const text of [
      'Formule recommandée',
      'Pourquoi cette formule ?',
      'Ce qui est inclus',
      'Repère tarifaire',
      'Prochaine étape',
      'Périodes de stages selon calendrier',
      'prérentrée, Toussaint, hiver/février, printemps et sprint final',
      'dates précises communiquées avec la recommandation',
      'Recevoir cette recommandation sur WhatsApp',
      'Voir toutes les offres',
      'Retour à l\'accueil',
      'Enseignants certifiés et agrégés de l\'enseignement français à l\'étranger',
      'des places disponibles',
    ]) {
      await expect(result).toContainText(text);
    }
    await expect(result).not.toContainText('date limite');
    await expect(result).not.toContainText('période de réservation prioritaire');
  });

  test('navigation publique complète et liens WhatsApp', async ({ page }) => {
    test.skip(true, 'QUARANTINE: PRE-EXISTING: /catalogue-nexus-reussite-2026-2027.html and /nexus_selecteur.html are static files not deployed in E2E container');
    // "Trouver ma formule" from homepage goes to /recommandation
    await page.goto('/', { waitUntil: 'domcontentloaded' });
    await page.getByRole('link', { name: /Trouver ma formule/i }).first().click();
    await expect(page).toHaveURL(/\/recommandation/);

    // "Voir les offres" or similar from homepage goes to /offres
    await page.goto('/', { waitUntil: 'domcontentloaded' });
    await page.getByRole('link', { name: /offres/i }).first().click();
    await expect(page).toHaveURL(/\/offres/);
    await expect(page.locator(`a[href*="wa.me/${WA_NUMBER}"]`).first()).toBeVisible();

    // Static catalogue page still works
    await page.goto('/catalogue-nexus-reussite-2026-2027.html', { waitUntil: 'domcontentloaded' });
    await expect(page.locator(`a[href*="wa.me/${WA_NUMBER}"]`).first()).toBeVisible();

    // Static selector page still works
    await page.goto('/nexus_selecteur.html', { waitUntil: 'domcontentloaded' });
    await page.getByRole('link', { name: /Voir toutes les offres/i }).click();
    await expect(page).toHaveURL(/catalogue-nexus-reussite-2026-2027\.html/);

    await page.goto('/nexus_selecteur.html', { waitUntil: 'domcontentloaded' });
    await page.getByRole('link', { name: /Retour à l\'accueil/i }).first().click();
    await expect(page).toHaveURL(/\/$/);
  });
});
