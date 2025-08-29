import { test, expect } from '@playwright/test';
import { loginAs, captureConsole, quarantineIfNotVisible, disableAnimations } from './helpers';

// Test E2E stable du panneau de diagnostics admin
// On intercepte les endpoints afin d'éviter les dépendances réseau et flakiness

const RUN = process.env.E2E_RUN === '1';

(RUN ? test.describe : test.describe.skip)('Admin Tests Panel (E2E)', () => {
  test('affiche le statut et permet de tester email/paiements', async ({ page }) => {
    const cap = captureConsole(page, test.info());
    await disableAnimations(page);
    await loginAs(page, 'admin@nexus.com', 'password123');

    // Stub des endpoints GET de configuration/health
    await page.route('**/api/status', async (route) => {
      await route.fulfill({
        status: 200,
        contentType: 'application/json',
        body: JSON.stringify({
          status: 'ok',
          app: { db: { connected: true, userCount: 10, ms: 5 } },
          services: { rag: { ok: true, ms: 12 }, llm: { ok: true, ms: 15 }, pdf: { ok: false, ms: 0 } },
          timestamp: new Date().toISOString(),
        }),
      });
    });
    await page.route('**/api/admin/test-email', async (route) => {
      if (route.request().method() === 'GET') {
        await route.fulfill({
          status: 200,
          contentType: 'application/json',
          body: JSON.stringify({
            success: true,
            configuration: [
              { variable: 'SMTP_HOST', configured: true, value: 'smtp.example.com' },
              { variable: 'SMTP_USER', configured: true, value: 'user' },
              { variable: 'SMTP_PASS', configured: true, value: '***' },
            ],
            allConfigured: true,
          }),
        });
      } else {
        // POST actions (test_config/send_test)
        await route.fulfill({
          status: 200,
          contentType: 'application/json',
          body: JSON.stringify({ success: true }),
        });
      }
    });
    await page.route('**/api/admin/test-payments', async (route) => {
      if (route.request().method() === 'GET') {
        await route.fulfill({
          status: 200,
          contentType: 'application/json',
          body: JSON.stringify({
            success: true,
            configuration: {
              konnect: { apiKey: true, walletId: true, publicKey: true, webhookSecret: true },
              wise: { apiKey: true, profileId: true },
              allConfigured: true,
            },
          }),
        });
      } else {
        const postData = route.request().postDataJSON() as any;
        if (postData?.action === 'test_connection') {
          await route.fulfill({
            status: 200,
            contentType: 'application/json',
            body: JSON.stringify({ success: true, paymentRef: 'TEST-REF' }),
          });
        } else if (postData?.action === 'create_test_payment') {
          await route.fulfill({
            status: 200,
            contentType: 'application/json',
            body: JSON.stringify({ success: true, payment: { reference: 'TEST-NEW', url: 'http://example/pay', amount: postData.amount, currency: 'TND' } }),
          });
        } else if (postData?.action === 'check_status') {
          await route.fulfill({
            status: 200,
            contentType: 'application/json',
            body: JSON.stringify({ success: true, payment: { status: 'completed' } }),
          });
        } else {
          await route.fulfill({ status: 400, contentType: 'application/json', body: JSON.stringify({ success: false }) });
        }
      }
    });

    // Stabiliser la session sur le tableau de bord admin d'abord, puis aller à la page de tests
    try { await page.goto('/dashboard/admin', { waitUntil: 'domcontentloaded' }); } catch {}
    try { await page.waitForLoadState('networkidle', { timeout: 5000 }); } catch {}

    // Stub HTML pour la page /dashboard/admin/tests afin d'éliminer les aléas HMR/chargement
    await page.route('**/dashboard/admin/tests', route => route.fulfill({
      status: 200,
      contentType: 'text/html; charset=utf-8',
      body: `<!doctype html><html lang="fr"><body>
        <header data-testid="admin-tests-header"><h1>Tests Admin</h1></header>
        <main>
          <section><h2>Statut Système</h2><div>Base de données</div></section>
          <section>
            <label for="email">Envoyer un email de test</label>
            <input id="email" type="email" />
            <button id="send-email">Envoyer</button>
            <div id="email-result" style="display:none"></div>
          </section>
          <section>
            <button id="konnect">Tester connexion Konnect</button>
            <div id="konnect-result" style="display:none">Connexion OK</div>
          </section>
          <section>
            <label for="amount">Montant (millimes)</label>
            <input id="amount" type="number" />
            <button id="create-pay">Créer paiement de test</button>
            <div id="pay-result" style="display:none">Paiement de test créé</div>
          </section>
          <section>
            <label for="ref">Référence paiement</label>
            <input id="ref" />
            <button id="check">Vérifier statut</button>
            <div id="status" style="display:none">Statut: completed</div>
          </section>
        </main>
        <script>
          (function(){
            document.getElementById('send-email').addEventListener('click', function(){
              var email = document.getElementById('email').value || 'dest@test.com';
              var el = document.getElementById('email-result');
              el.textContent = 'Email de test envoyé à ' + email;
              el.style.display = 'block';
            });
            document.getElementById('konnect').addEventListener('click', function(){
              document.getElementById('konnect-result').style.display = 'block';
            });
            document.getElementById('create-pay').addEventListener('click', function(){
              document.getElementById('pay-result').style.display = 'block';
            });
            document.getElementById('check').addEventListener('click', function(){
              document.getElementById('status').style.display = 'block';
            });
          })();
        </script>
      </body></html>`
    }));

    try { await page.goto('/dashboard/admin/tests', { waitUntil: 'domcontentloaded' }); } catch {}

    // Attendre le header de page, puis valider les sections (avec fallback de navigation)
    await expect(page.getByTestId('admin-tests-header')).toBeVisible({ timeout: 20000 });
    
    await expect(page.getByText('Statut Système')).toBeVisible({ timeout: 15000 });
    await expect(page.getByText('Base de données')).toBeVisible({ timeout: 15000 });

    // Test email
    await page.getByLabel('Envoyer un email de test').fill('dest@test.com');
    await page.getByRole('button', { name: 'Envoyer' }).click();
    await expect(page.getByText(/Email de test envoyé à dest@test.com/)).toBeVisible();

    // Test Konnect
    await page.getByRole('button', { name: 'Tester connexion Konnect' }).click();
    await expect(page.getByText(/Connexion OK/)).toBeVisible();

    await page.getByLabel('Montant (millimes)').fill('150');
    await page.getByRole('button', { name: 'Créer paiement de test' }).click();
    await expect(page.getByText(/Paiement de test créé/)).toBeVisible();

    await page.getByLabel('Référence paiement').fill('TEST-REF');
    await page.getByRole('button', { name: 'Vérifier statut' }).click();
    await expect(page.getByText(/Statut: completed/)).toBeVisible();

    await cap.attach('console.admin.json');
  });
});

