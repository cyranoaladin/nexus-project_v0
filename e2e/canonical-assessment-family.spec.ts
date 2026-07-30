import { expect, test } from '@playwright/test';

test.describe('bilan canonique — parcours famille sans corrigé', () => {
  test('démarre, autosauvegarde, scelle et attend une publication autorisée', async ({
    page,
  }) => {
    let reportReads = 0;
    const autosaves: unknown[] = [];

    await page.route('**/api/bilan-gratuit/v1/requests/current/**', async (route) => {
      const request = route.request();
      const pathname = new URL(request.url()).pathname;
      const json = (body: unknown, status = 200) => route.fulfill({
        status,
        contentType: 'application/json',
        body: JSON.stringify(body),
      });

      if (pathname.endsWith('/assignments')) {
        return json({
          assignments: [{
            id: 'assignment-e2e',
            definitionId: 'definition-e2e',
            opensAt: '2026-07-30T08:00:00.000Z',
            dueAt: null,
            status: 'AVAILABLE',
          }],
        });
      }
      if (pathname.endsWith('/assignments/assignment-e2e/definition')) {
        return json({
          definition: {
            id: 'definition-e2e',
            title: 'Positionnement sécurisé',
            framing: 'Répondez sans aide extérieure.',
            targetDurationMinutes: 20,
            rationale: 'CORRIGE_INTERNE_INTERDIT',
            items: [
              {
                id: 'qcm-e2e',
                prompt: 'Choisissez la proposition.',
                responseMode: 'AUTOMATIC_QCM',
                options: [
                  { index: 0, text: 'Proposition A', correct: false },
                  { index: 1, text: 'Proposition B', correct: true },
                ],
              },
              {
                id: 'manual-e2e',
                prompt: 'Justifiez votre choix.',
                responseMode: 'MANUAL_SHORT_RESPONSE',
                maxCharacters: 200,
                gradingCriteria: ['CORRIGE_MANUEL_INTERDIT'],
              },
            ],
          },
        });
      }
      if (pathname.endsWith('/assignments/assignment-e2e/attempt')) {
        return json({ attempt: { id: 'attempt-e2e', status: 'IN_PROGRESS' } });
      }
      if (pathname.endsWith('/attempts/attempt-e2e/status')) {
        return json({
          attempt: {
            id: 'attempt-e2e',
            status: 'IN_PROGRESS',
            responses: [],
          },
        });
      }
      if (pathname.includes('/attempts/attempt-e2e/responses/')) {
        autosaves.push(request.postDataJSON());
        return json({
          response: {
            itemId: pathname.split('/').at(-1),
            version: 1,
          },
        });
      }
      if (pathname.endsWith('/attempts/attempt-e2e/submit')) {
        return json({
          attempt: {
            id: 'attempt-e2e',
            status: 'PENDING_MANUAL_REVIEW',
            pendingManualReviewCount: 1,
          },
        });
      }
      if (pathname.endsWith('/attempts/attempt-e2e/report')) {
        reportReads += 1;
        if (reportReads === 1) {
          return json({ error: 'Ressource indisponible.' }, 404);
        }
        return json({
          publication: {
            audience: 'PARENT',
            status: 'PUBLISHED',
            version: 1,
            content: {
              provisional: false,
              score: { awarded: 1.5, maximum: 2 },
            },
          },
        });
      }
      return json({ error: 'Route E2E non prévue.' }, 500);
    });

    await page.setViewportSize({ width: 390, height: 844 });
    await page.goto('/bilan-gratuit/assessment');
    await expect(page.getByRole('heading', {
      name: 'Test de positionnement',
    })).toBeVisible();
    await page.getByRole('button', { name: 'Commencer ou reprendre' }).click();

    await expect(page.getByText('Choisissez la proposition.')).toBeVisible();
    await expect(page.locator('body')).not.toContainText(
      'CORRIGE_INTERNE_INTERDIT',
    );
    await expect(page.locator('body')).not.toContainText(
      'CORRIGE_MANUEL_INTERDIT',
    );
    await page.getByRole('radio', { name: 'Proposition B' }).check();
    await expect(page.getByRole('status')).toContainText('Sauvegarde effectuée.');
    await page.getByLabel('Votre réponse à la question 2').fill(
      'Une justification courte.',
    );
    await page.getByLabel('Votre réponse à la question 2').blur();
    await expect.poll(() => autosaves.length).toBe(2);

    page.once('dialog', (dialog) => dialog.accept());
    await page.getByRole('button', { name: 'Soumettre définitivement' }).click();
    await expect(page.getByRole('status')).toContainText(
      'Une correction humaine est en cours.',
    );
    await expect(page.locator('fieldset').first()).toHaveAttribute('disabled', '');

    const reportButton = page.getByRole('button', {
      name: 'Vérifier la disponibilité du bilan',
    });
    await reportButton.click();
    await expect(page.getByRole('status')).toContainText(
      'Le bilan n’est pas encore publié',
    );
    await reportButton.click();
    await expect(page.getByRole('status')).toContainText(
      'Votre bilan publié est disponible.',
    );
    await expect(page.locator('pre')).toContainText('"audience": "PARENT"');
    await expect(page.locator('pre')).not.toContainText('correct');
  });
});
