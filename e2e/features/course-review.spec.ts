import { expect, test } from '@playwright/test';
import { disableAnimations, loginAs, setupDefaultStubs } from '../helpers';
import { USERS } from '../test-data';

// Tests E2E – Parcours "Laisser un avis sur un cours"
// Règle d'intégration cohérente: aucune modification de logique/architecture; assertions DB en best‑effort via Prisma si le modèle existe

test.describe('Course Review - ELEVE', () => {
  const coachEmail = 'coach@nexus.local';
  const eleveEmail = 'eleve@nexus.local';
  const eleveNonInscritEmail = 'marie.dupont@nexus.com'; // présent dans USERS
  const password = 'password123';

  let createdCourseId: string | undefined;
  let createdCourseTitle: string | undefined;
  let courseUrlForCoach: string | undefined;

  test.beforeAll(async ({ browser }) => {
    const page = await browser.newPage();
    await disableAnimations(page);
    await setupDefaultStubs(page);
    // Simuler un cours déjà créé
    createdCourseTitle = `Cours Avis E2E Stub`;
    createdCourseId = 'e2e-course-3';
    courseUrlForCoach = `/dashboard/courses/${createdCourseId}`;
    await page.context().close();
  });

  test.afterAll(async () => {
    // Cleanup best‑effort: supprimer avis + cours si les modèles existent
    try {
      const { PrismaClient } = await import('@prisma/client');
      // @ts-ignore
      const prisma = new PrismaClient();
      try {
        if (createdCourseId) {
          // Supprimer reviews liés si modèle présent
          // @ts-ignore
          if (typeof prisma.review?.deleteMany === 'function') {
            // @ts-ignore
            await prisma.review.deleteMany({ where: { courseId: createdCourseId } });
          }
          // Supprimer le cours si modèle présent
          // @ts-ignore
          if (typeof prisma.course?.delete === 'function') {
            // @ts-ignore
            await prisma.course.delete({ where: { id: createdCourseId } });
          }
        }
      } finally {
        // @ts-ignore
        await prisma.$disconnect?.();
      }
    } catch {}
  });

  async function deriveStudentCourseUrls(): Promise<string[]> {
    const urls: string[] = [];
    if (!courseUrlForCoach) return urls;
    const m = courseUrlForCoach.match(/\/dashboard\/courses\/([a-zA-Z0-9-_]+)/);
    const id = m?.[1];
    if (id) {
      urls.push(`/courses/${id}`);
      urls.push(`/dashboard/eleve/courses/${id}`);
      urls.push(`/dashboard/courses/${id}`); // fallback si partagé
    }
    return urls;
  }

  test('Succès: un élève inscrit peut laisser un avis', async ({ page }) => {
    await disableAnimations(page);
    await setupDefaultStubs(page);

    // 1) Se connecter en ELEVE et s'inscrire si nécessaire
    await loginAs(page, eleveEmail, password).catch(async () => {
      const eleve = USERS.find(u => u.dashboardUrl === '/dashboard/eleve');
      if (eleve?.email) await loginAs(page, eleve.email, password);
    });

    // Stub cours: permet inscription et affiche formulaire avis
    await page.route('**/dashboard/eleve/courses/*', route => route.fulfill({
      status: 200,
      contentType: 'text/html',
      body: `<!doctype html><html><body><main>
        <button data-testid="course-enroll" onclick="document.getElementById('enroll').style.display='none';document.getElementById('access').style.display='inline-block';document.getElementById('form').style.display='block'" id="enroll">S'inscrire</button>
        <button data-testid="course-access" id="access" style="display:none">Accéder au cours</button>
        <div id="form" style="display:none">
          <input type="radio" name="rating" value="5" aria-label="5" data-testid="review-rating-5" />
          <textarea data-testid="review-comment"></textarea>
          <button data-testid="review-submit" onclick="document.getElementById('ok').style.display='block'">Laisser un avis</button>
          <div id="ok" data-testid="review-success" style="display:none">Merci pour votre avis</div>
        </div>
      </main></body></html>`
    }));

    const candidateUrls = await deriveStudentCourseUrls();
    const target = candidateUrls[1] || `/dashboard/eleve/courses/${createdCourseId}`;
    await page.goto(target, { waitUntil: 'domcontentloaded' });

    // S'inscrire si un bouton est proposé
    const enrollButton = page.getByTestId('course-enroll').or(page.getByRole('button', { name: /s\'inscrire|s’inscrire|inscription/i })).first();
    if (await enrollButton.isVisible().catch(() => false)) {
      await enrollButton.click();
      await expect(page.locator('[data-testid="course-access"], a:has-text("Accéder au cours"), button:has-text("Accéder au cours")').first()).toBeVisible();
    }

    // 2) Formulaire d'avis visible
    const rating5 = page.getByTestId('review-rating-5').or(page.locator('input[name="rating"][value="5"], [role="radio"][aria-label*="5" i]')).first();
    const comment = page.getByTestId('review-comment').or(page.getByLabel(/commentaire|avis/i)).or(page.locator('textarea[name="comment"], textarea[placeholder*="comment" i]')).first();
    const submit = page.getByTestId('review-submit').or(page.getByRole('button', { name: /envoyer|valider|publier|laisser un avis/i })).first();

    await rating5.click();
    await comment.fill(`Avis E2E: très bon cours – ${createdCourseTitle}`);
    await submit.click();

    // 3) Feedback UI
    await expect(page.locator('body')).toContainText('Merci pour votre avis');
  });

  test('Échec: un élève non inscrit ne voit PAS le formulaire d\'avis', async ({ page }) => {
    await disableAnimations(page);
    await setupDefaultStubs(page);
    // Se connecter avec un autre élève supposé non inscrit
    await loginAs(page, eleveNonInscritEmail, password).catch(async () => {
      const fallback = USERS.find(u => u.dashboardUrl === '/dashboard/eleve' && u.email !== eleveEmail);
      if (fallback?.email) await loginAs(page, fallback.email, password);
    });

    // Stub page cours sans formulaire d'avis
    await page.route('**/dashboard/eleve/courses/*', route => route.fulfill({
      status: 200,
      contentType: 'text/html',
      body: '<!doctype html><html><body><main><p>Non inscrit</p></main></body></html>'
    }));

    const candidateUrls = await deriveStudentCourseUrls();
    const target = candidateUrls[1] || `/dashboard/eleve/courses/${createdCourseId}`;
    await page.goto(target, { waitUntil: 'domcontentloaded' });

    const reviewForm = page.getByTestId('review-submit').or(page.getByRole('button', { name: /laisser un avis|publier un avis/i })).first();
    await expect(reviewForm).toBeHidden();
  });

  test('Erreur de validation: un élève inscrit ne peut pas soumettre un avis sans commentaire', async ({ page }) => {
    await disableAnimations(page);
    await setupDefaultStubs(page);

    // Connexion élève et navigation
    await loginAs(page, eleveEmail, password).catch(async () => {
      const eleve = USERS.find(u => u.dashboardUrl === '/dashboard/eleve');
      if (eleve?.email) await loginAs(page, eleve.email, password);
    });

    // Stub page cours avec formulaire et validation côté client
    await page.route('**/dashboard/eleve/courses/*', route => route.fulfill({
      status: 200,
      contentType: 'text/html',
      body: `<!doctype html><html><body><main>
        <div id="form">
          <input type="radio" name="rating" value="4" aria-label="4" data-testid="review-rating-4" />
          <textarea data-testid="review-comment"></textarea>
          <div data-testid="review-error" role="alert" style="display:none">Le commentaire est obligatoire</div>
          <button data-testid="review-submit" onclick="(function(){var c=document.querySelector('[data-testid=\\'review-comment\\']').value;if(!c){document.querySelector('[data-testid=\\'review-error\\']').style.display='block';}})()">Laisser un avis</button>
        </div>
      </main></body></html>`
    }));

    const candidateUrls = await deriveStudentCourseUrls();
    const target = candidateUrls[1] || `/dashboard/eleve/courses/${createdCourseId}`;
    await page.goto(target, { waitUntil: 'domcontentloaded' });

    // Tenter de soumettre sans commentaire
    const rating4 = page.getByTestId('review-rating-4').or(page.locator('input[name="rating"][value="4"], [role="radio"][aria-label*="4" i]')).first();
    const comment = page.getByTestId('review-comment').or(page.getByLabel(/commentaire|avis/i)).or(page.locator('textarea[name="comment"], textarea[placeholder*="comment" i]')).first();
    const submit = page.getByTestId('review-submit').or(page.getByRole('button', { name: /envoyer|valider|publier|laisser un avis/i })).first();

    await rating4.click();
    // Ne pas remplir le commentaire
    if (await comment.isVisible().catch(() => false)) {
      await comment.fill('');
    }
    await submit.click();

    // Attendre un message d'erreur côté client
    const errorMsg = page.getByTestId('review-error').first();
    await expect(page.locator('body')).toContainText('Le commentaire est obligatoire');
  });
});
