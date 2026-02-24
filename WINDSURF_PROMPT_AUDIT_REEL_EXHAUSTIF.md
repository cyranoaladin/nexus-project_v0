# AUDIT RÉEL EXHAUSTIF TOUTES PAGES + CORRECTION SANS TRICHE

> **RÈGLE ABSOLUE N°1 — LIS CECI AVANT TOUT AUTRE CHOSE**
>
> Tu as **formellement interdiction** de :
> - Modifier un test pour qu'il passe en changeant l'assertion plutôt qu'en corrigeant le vrai problème
> - Utiliser `test.skip()`, `test.fixme()`, `xit()`, `xdescribe()`, `it.skip()` pour masquer un échec
> - Utiliser `expect.assertions(0)` ou supprimer des assertions pour éviter un échec
> - Mettre `.only()` sur les tests qui passent et ignorer les autres
> - Écrire `// TODO` ou `// FIXME` et passer à autre chose
> - Mocker une vraie dépendance (DB, API, auth) pour faire passer un test qui aurait dû tester la vraie intégration
> - Contourner une erreur en attrapant l'exception sans la traiter (`try { ... } catch {}`)
> - Renvoyer des données hardcodées depuis une API pour faire passer un test d'intégration
> - Prétendre qu'un test est vert alors que la fonctionnalité réelle est cassée
>
> Si un test échoue → TU CORRIGES LE CODE SOURCE, pas le test.
> Si tu ne sais pas comment corriger → tu le dis clairement dans ton rapport.
> Un test vert avec une fonctionnalité cassée est PIRE qu'un test rouge.

---

## PROTOCOLE D'EXÉCUTION OBLIGATOIRE

Pour chaque page et chaque test, tu appliques ce protocole sans exception :

```
ÉTAPE 1 — NAVIGATE
  → Charger la page dans un vrai navigateur (Playwright)
  → Attendre networkidle (toutes les requêtes terminées)
  → Capturer les erreurs console
  → Capturer les erreurs réseau (4xx, 5xx)

ÉTAPE 2 — INSPECT
  → Lister TOUS les éléments interactifs : boutons, liens, inputs, selects, checkboxes, radios
  → Lister TOUS les formulaires et leurs champs
  → Lister TOUS les appels API déclenchés au chargement
  → Identifier les états : loading / empty / error / success

ÉTAPE 3 — TEST
  → Cliquer chaque bouton → vérifier le résultat réel
  → Naviguer chaque lien → vérifier la destination réelle
  → Soumettre chaque formulaire (données valides ET invalides) → vérifier
  → Vérifier la cohérence avec la DB (Prisma) : ce qui est affiché = ce qui est en base

ÉTAPE 4 — DIAGNOSE
  → Si quelque chose échoue → identifier la cause racine
  → Tracer le flux : Page → Component → API Route → Service → DB
  → Trouver l'endroit exact où ça casse

ÉTAPE 5 — FIX
  → Corriger le code source à l'endroit exact où ça casse
  → Ne JAMAIS corriger le symptôme, corriger la cause

ÉTAPE 6 — VERIFY
  → Rejouer le test → vérifier que ça passe maintenant
  → Vérifier que la correction n'a pas cassé autre chose (regression check)
  → npm run build → doit passer
  → npm test → doit passer
```

---

## PHASE 0 — ÉTAT DES LIEUX INITIAL (avant de toucher quoi que ce soit)

### 0.1 — Inventaire des tests existants et leur état réel

```bash
# Lancer TOUS les tests et capturer le résultat brut
npm test -- --verbose --forceExit 2>&1 | tee /tmp/jest-results-initial.txt

# Compter les vrais résultats
grep -E "✓|✗|PASS|FAIL|×|●" /tmp/jest-results-initial.txt | head -100

# Tests E2E
npx playwright test --project=chromium --reporter=html 2>&1 | tee /tmp/playwright-results-initial.txt

# Build check
npm run build 2>&1 | tee /tmp/build-results-initial.txt

# TypeScript check
npm run typecheck 2>&1 | tee /tmp/typecheck-results-initial.txt
```

### 0.2 — Créer le rapport d'état initial

Créer un fichier `AUDIT_RAPPORT_INITIAL.md` avec :

```markdown
# Rapport d'État Initial — [DATE]

## Tests Jest
- Tests total : X
- Tests passants : X
- Tests échoués : X (LISTE EXHAUSTIVE CI-DESSOUS)

## Tests Playwright  
- Tests total : X
- Tests passants : X
- Tests échoués : X (LISTE EXHAUSTIVE)

## Build
- Status : ✅ OK / ❌ ERREUR
- Erreurs : [liste]

## TypeScript
- Erreurs : X (liste)

## Tests échoués (NE PAS IGNORER)
### Jest échoués :
1. [nom du test] — [message d'erreur exact]
2. ...

### Playwright échoués :
1. [nom du test] — [message d'erreur exact]
...
```

**RÈGLE : Ce fichier sera comparé au rapport final. Tout test échoué initialement DOIT être résolu ou explicitement justifié pourquoi il ne peut pas l'être.**

---

## PHASE 1 — AUDIT TECHNIQUE PRÉLIMINAIRE

### 1.1 — Vérification Base de Données

```bash
# Connexion DB
npx prisma db pull 2>&1  # Doit fonctionner sans erreur

# Migrations appliquées
npx prisma migrate status 2>&1  # Toutes doivent être "Applied"

# Intégrité des données seed
npx prisma studio &  # Ouvrir pour inspection visuelle
```

```typescript
// __tests__/database/real-data-integrity.test.ts
// CE TEST UTILISE LA VRAIE DB — JAMAIS MOCKÉ
import { PrismaClient } from '@prisma/client'
import bcrypt from 'bcryptjs'

const prisma = new PrismaClient()

describe('REAL DATABASE — Data Integrity', () => {
  
  afterAll(async () => await prisma.$disconnect())
  
  describe('Seed Users Integrity', () => {
    const EXPECTED_SEED_USERS = [
      { email: 'admin@nexus-reussite.com', role: 'ADMIN' },
      { email: 'helios@nexus-reussite.com', role: 'COACH' },
      { email: 'zenon@nexus-reussite.com', role: 'COACH' },
      { email: 'athena@nexus-reussite.com', role: 'COACH' },
      { email: 'hermes@nexus-reussite.com', role: 'COACH' },
      { email: 'clio@nexus-reussite.com', role: 'COACH' },
      { email: 'parent@example.com', role: 'PARENT' },
      { email: 'student@example.com', role: 'ELEVE' },
      { email: 'test@example.com', role: 'ELEVE' },
    ]
    
    EXPECTED_SEED_USERS.forEach(({ email, role }) => {
      it(`${email} existe en DB avec rôle ${role}`, async () => {
        const user = await prisma.user.findUnique({ where: { email } })
        
        // SI CE TEST ÉCHOUE → CORRIGER LE SEED, pas le test
        expect(user, `L'utilisateur ${email} n'existe pas en DB`).not.toBeNull()
        expect(user!.role, `Rôle incorrect pour ${email}`).toBe(role)
      })
      
      it(`${email} a un password hashé bcrypt valide`, async () => {
        const user = await prisma.user.findUnique({ where: { email } })
        
        // SI CE TEST ÉCHOUE → les passwords ne sont pas hashés dans le seed
        expect(user!.password, `Password null pour ${email}`).not.toBeNull()
        expect(
          user!.password!.startsWith('$2a$') || user!.password!.startsWith('$2b$'),
          `Password de ${email} n'est PAS hashé bcrypt — c'est un mot de passe en clair !`
        ).toBe(true)
        
        // Vérifier que le password 'admin123' correspond au hash
        const isValid = await bcrypt.compare('admin123', user!.password!)
        expect(isValid, `bcrypt.compare('admin123') échoue pour ${email}`).toBe(true)
      })
    })
    
    it('les élèves du seed ont activatedAt renseigné', async () => {
      const eleves = await prisma.user.findMany({ where: { role: 'ELEVE' } })
      eleves.forEach(eleve => {
        expect(
          eleve.activatedAt,
          `L'élève ${eleve.email} a activatedAt=null — il ne peut pas se connecter !`
        ).not.toBeNull()
      })
    })
    
    it('les coaches ont un CoachProfile lié', async () => {
      const coaches = await prisma.user.findMany({
        where: { role: 'COACH' },
        include: { coachProfile: true }
      })
      coaches.forEach(coach => {
        expect(
          coach.coachProfile,
          `Le coach ${coach.email} n'a pas de CoachProfile`
        ).not.toBeNull()
      })
    })
    
    it('le parent a un ParentProfile lié', async () => {
      const parent = await prisma.user.findUnique({
        where: { email: 'parent@example.com' },
        include: { parentProfile: true }
      })
      expect(parent!.parentProfile, 'Parent sans ParentProfile').not.toBeNull()
    })
  })
  
  describe('Schema Constraints', () => {
    it('impossible de créer 2 users avec le même email', async () => {
      await expect(
        prisma.user.create({
          data: {
            email: 'admin@nexus-reussite.com',
            password: '$2b$10$test',
            role: 'PARENT',
            firstName: 'Dup',
            lastName: 'Test'
          }
        })
      ).rejects.toThrow() // Doit throw (contrainte unique)
    })
    
    it('les relations FK sont correctes (pas de records orphelins)', async () => {
      // Sessions sans student valide
      const orphanSessions = await prisma.$queryRaw`
        SELECT COUNT(*) as count FROM "SessionBooking" s
        WHERE NOT EXISTS (SELECT 1 FROM "Student" st WHERE st.id = s."studentId")
      ` as any[]
      expect(Number(orphanSessions[0].count)).toBe(0)
    })
  })
})
```

### 1.2 — Vérification des Variables d'Environnement Réelles

```typescript
// __tests__/config/env-real.test.ts
describe('Variables d\'Environnement — Vérification Réelle', () => {
  
  it('DATABASE_URL est défini et non vide', () => {
    expect(process.env.DATABASE_URL, 'DATABASE_URL manquant').toBeTruthy()
    expect(process.env.DATABASE_URL).toMatch(/postgresql:\/\//)
  })
  
  it('NEXTAUTH_SECRET est défini et assez long (32+ chars)', () => {
    expect(process.env.NEXTAUTH_SECRET, 'NEXTAUTH_SECRET manquant').toBeTruthy()
    expect((process.env.NEXTAUTH_SECRET || '').length).toBeGreaterThanOrEqual(32)
  })
  
  it('NEXTAUTH_URL est défini et est une URL valide', () => {
    expect(process.env.NEXTAUTH_URL).toBeTruthy()
    expect(() => new URL(process.env.NEXTAUTH_URL!)).not.toThrow()
  })
  
  it('SMTP est configuré si MAIL_DISABLED n\'est pas true', () => {
    if (process.env.MAIL_DISABLED !== 'true') {
      expect(process.env.SMTP_HOST, 'SMTP_HOST manquant').toBeTruthy()
      expect(process.env.SMTP_USER, 'SMTP_USER manquant').toBeTruthy()
      expect(process.env.SMTP_PASS, 'SMTP_PASS manquant').toBeTruthy()
    }
  })
  
  it('Ollama URL est configuré', () => {
    const ollamaUrl = process.env.OLLAMA_URL || process.env.OPENAI_BASE_URL
    expect(ollamaUrl, 'OLLAMA_URL / OPENAI_BASE_URL manquant').toBeTruthy()
  })
})
```

---

## PHASE 2 — NAVIGATION ET TESTS RÉELS PAGE PAR PAGE

### RÈGLE DE TEST POUR CHAQUE PAGE :

Pour chaque page ci-dessous, créer un fichier spec Playwright dédié qui :
1. **Charge vraiment la page** (pas de mock de route)
2. **Vérifie le status HTTP** (200, pas 404/500)
3. **Teste chaque élément interactif** réellement
4. **Vérifie que les actions déclenchent les bons appels API**
5. **Vérifie que les données affichées correspondent à la DB**

---

### PAGE 1 : Homepage `/`

```typescript
// e2e/real/pages/01-homepage.spec.ts
import { test, expect, Page } from '@playwright/test'

test.describe('REAL — Homepage (/)', () => {
  
  let consoleErrors: string[] = []
  let networkErrors: string[] = []
  
  test.beforeEach(async ({ page }) => {
    consoleErrors = []
    networkErrors = []
    
    page.on('console', msg => {
      if (msg.type() === 'error') consoleErrors.push(`[Console Error] ${msg.text()}`)
    })
    page.on('response', resp => {
      if (resp.status() >= 400) networkErrors.push(`[${resp.status()}] ${resp.url()}`)
    })
    
    await page.goto('/', { waitUntil: 'networkidle' })
  })
  
  test('🔴 HTTP 200 — La page charge sans erreur serveur', async ({ page }) => {
    const response = await page.request.get('/')
    expect(response.status(), 'La homepage retourne une erreur serveur !').toBe(200)
  })
  
  test('🔴 Zéro erreur console JavaScript', async ({ page }) => {
    // Donner du temps aux animations GSAP de se charger
    await page.waitForTimeout(2000)
    const realErrors = consoleErrors.filter(e =>
      !e.includes('favicon') &&
      !e.includes('ResizeObserver') &&
      !e.includes('Non-Error promise rejection')
    )
    expect(realErrors, `Erreurs console trouvées :\n${realErrors.join('\n')}`).toHaveLength(0)
  })
  
  test('🔴 Zéro erreur réseau (pas de 404/500)', async ({ page }) => {
    await page.waitForTimeout(2000)
    const realNetworkErrors = networkErrors.filter(e =>
      !e.includes('favicon') && !e.includes('hot-reload')
    )
    expect(realNetworkErrors, `Erreurs réseau :\n${realNetworkErrors.join('\n')}`).toHaveLength(0)
  })
  
  test('🔴 H1 titre principal visible', async ({ page }) => {
    await expect(page.locator('h1').first()).toBeVisible()
    const h1Text = await page.locator('h1').first().textContent()
    expect(h1Text?.trim().length, 'H1 est vide').toBeGreaterThan(0)
  })
  
  // NAVBAR — TOUS LES LIENS
  test('🔴 Navbar logo cliquable → /', async ({ page }) => {
    await page.locator('header a[href="/"], header a[href]').first().click()
    await expect(page).toHaveURL('/')
  })
  
  test('🔴 Navbar Offres → /offres (200)', async ({ page }) => {
    await page.getByRole('link', { name: /^offres$/i }).first().click()
    await expect(page).toHaveURL('/offres')
    const resp = await page.request.get('/offres')
    expect(resp.status()).toBe(200)
  })
  
  test('🔴 Navbar Bilan Gratuit → /bilan-gratuit (200)', async ({ page }) => {
    const bilanLink = page.getByRole('link', { name: /bilan.*gratuit/i }).first()
    await bilanLink.click()
    await expect(page).toHaveURL('/bilan-gratuit')
  })
  
  test('🔴 Navbar Contact → /contact (200)', async ({ page }) => {
    const contactLink = page.getByRole('link', { name: /contact/i }).first()
    await contactLink.click()
    await expect(page).toHaveURL('/contact')
  })
  
  test('🔴 Navbar Connexion → /auth/signin (200)', async ({ page }) => {
    const signinLink = page.getByRole('link', { name: /connexion|se connecter/i }).first()
    await signinLink.click()
    await expect(page).toHaveURL('/auth/signin')
  })
  
  // HERO — CTA BOUTONS
  test('🔴 CTA Hero "Bilan Gratuit" → /bilan-gratuit', async ({ page }) => {
    // Chercher le premier CTA proéminent de la section Hero
    const heroCTA = page.locator('section').first().getByRole('link').first()
    const href = await heroCTA.getAttribute('href')
    expect(href, 'CTA Hero n\'a pas de href').toBeTruthy()
    await heroCTA.click()
    await expect(page).not.toHaveURL('/') // Doit naviguer quelque part
  })
  
  // FORMULAIRE DE CONTACT (section footer)
  test('🔴 Formulaire contact — champs présents', async ({ page }) => {
    // Scroller jusqu'au formulaire de contact
    await page.evaluate(() => window.scrollTo(0, document.body.scrollHeight))
    await page.waitForTimeout(500)
    
    const nameField = page.getByLabel(/nom|name/i).last()
    const emailField = page.getByLabel(/email/i).last()
    const messageField = page.getByLabel(/message/i)
    
    // Au moins certains champs doivent être présents
    const hasForm = await nameField.isVisible() || await emailField.isVisible()
    expect(hasForm, 'Formulaire contact introuvable').toBe(true)
  })
  
  test('🔴 Formulaire contact — soumission réelle (API /api/contact doit répondre)', async ({ page }) => {
    await page.evaluate(() => window.scrollTo(0, document.body.scrollHeight))
    await page.waitForTimeout(500)
    
    const emailField = page.getByLabel(/email/i).last()
    const messageField = page.getByLabel(/message/i).last()
    const submitBtn = page.getByRole('button', { name: /envoyer|submit/i }).last()
    
    if (await emailField.isVisible() && await submitBtn.isVisible()) {
      // Intercepter l'appel API réel
      const apiCall = page.waitForRequest(req => req.url().includes('/api/contact'))
      
      if (await page.getByLabel(/nom|name/i).last().isVisible()) {
        await page.getByLabel(/nom|name/i).last().fill('Test Utilisateur')
      }
      await emailField.fill('test.contact@nexus.com')
      await messageField.fill('Message de test automatisé')
      await submitBtn.click()
      
      const request = await apiCall
      expect(request.method()).toBe('POST')
      
      const response = await request.response()
      expect(
        response?.status(),
        `L'API /api/contact a retourné ${response?.status()} au lieu de 200`
      ).toBeLessThan(400)
    }
  })
  
  // FOOTER — TOUS LES LIENS
  test('🔴 Tous les liens footer retournent HTTP 200', async ({ page }) => {
    const footerLinks = await page.locator('footer a[href^="/"]').all()
    expect(footerLinks.length, 'Footer sans liens').toBeGreaterThan(3)
    
    for (const link of footerLinks) {
      const href = await link.getAttribute('href')
      if (href && href.startsWith('/')) {
        const response = await page.request.get(href)
        expect(
          response.status(),
          `Lien footer ${href} → HTTP ${response.status()}`
        ).toBe(200)
      }
    }
  })
  
  test('🔴 Lien /mentions-legales → 200', async ({ page }) => {
    const resp = await page.request.get('/mentions-legales')
    expect(resp.status()).toBe(200)
  })
  
  test('🔴 Lien /conditions → 200', async ({ page }) => {
    const resp = await page.request.get('/conditions')
    expect(resp.status()).toBe(200)
  })
})
```

---

### PAGE 2 : Auth `/auth/signin`

```typescript
// e2e/real/pages/02-signin.spec.ts
test.describe('REAL — Sign In (/auth/signin)', () => {
  
  test('🔴 Page charge HTTP 200', async ({ page }) => {
    const resp = await page.request.get('/auth/signin')
    expect(resp.status()).toBe(200)
  })
  
  test('🔴 Champs email et password présents', async ({ page }) => {
    await page.goto('/auth/signin')
    await expect(page.getByLabel(/email/i)).toBeVisible()
    await expect(page.getByLabel(/mot de passe|password/i)).toBeVisible()
    await expect(page.getByRole('button', { name: /connexion|se connecter/i })).toBeVisible()
  })
  
  // TEST RÉEL — connexion avec les vrais utilisateurs seed
  const SEED_LOGINS = [
    { email: 'admin@nexus-reussite.com', password: 'admin123', role: 'ADMIN', dashboard: '/dashboard/admin' },
    { email: 'helios@nexus-reussite.com', password: 'admin123', role: 'COACH', dashboard: '/dashboard/coach' },
    { email: 'parent@example.com', password: 'admin123', role: 'PARENT', dashboard: '/dashboard/parent' },
    { email: 'student@example.com', password: 'admin123', role: 'ELEVE', dashboard: '/dashboard/eleve' },
  ]
  
  SEED_LOGINS.forEach(({ email, password, role, dashboard }) => {
    test(`🔴 CONNEXION RÉELLE — ${role} (${email}) → ${dashboard}`, async ({ page }) => {
      await page.goto('/auth/signin')
      await page.getByLabel(/email/i).fill(email)
      await page.getByLabel(/mot de passe|password/i).fill(password)
      await page.getByRole('button', { name: /connexion|se connecter/i }).click()
      
      // Attendre la redirection
      await page.waitForURL(`**${dashboard}**`, { timeout: 10000 })
      
      // Vérifier qu'on est bien sur le bon dashboard
      expect(
        page.url(),
        `${email} devrait être redirigé vers ${dashboard}, mais est sur ${page.url()}`
      ).toContain(dashboard)
      
      // Dashboard doit se charger sans erreur
      await expect(page.getByRole('navigation')).toBeVisible()
    })
  })
  
  test('🔴 Mauvais password → message d\'erreur visible (pas de redirect)', async ({ page }) => {
    await page.goto('/auth/signin')
    await page.getByLabel(/email/i).fill('admin@nexus-reussite.com')
    await page.getByLabel(/mot de passe|password/i).fill('WRONG_PASSWORD_123')
    await page.getByRole('button', { name: /connexion/i }).click()
    
    // Doit rester sur signin
    await page.waitForTimeout(2000)
    expect(page.url()).toContain('/auth/signin')
    
    // Message d'erreur visible
    const errorMsg = page.getByText(/incorrect|invalide|erreur|error/i)
    await expect(errorMsg, 'Aucun message d\'erreur pour mauvais password').toBeVisible()
  })
  
  test('🔴 Email inexistant → message d\'erreur (anti-enumeration OK)', async ({ page }) => {
    await page.goto('/auth/signin')
    await page.getByLabel(/email/i).fill('inexistant@jamais-vu.com')
    await page.getByLabel(/mot de passe|password/i).fill('test1234')
    await page.getByRole('button', { name: /connexion/i }).click()
    
    await page.waitForTimeout(2000)
    expect(page.url()).toContain('/auth/signin')
    // Doit afficher un message d'erreur générique (pas "email inexistant")
    await expect(page.getByText(/incorrect|invalide|erreur/i)).toBeVisible()
  })
  
  test('🔴 Élève non activé → connexion bloquée', async ({ page }) => {
    // Chercher un élève avec activatedAt=null (si existant)
    // Si aucun → créer un via l'API seed de test
    // Tenter de le connecter → doit être bloqué
  })
  
  test('🔴 Séparation Parent/Élève : parent ne peut pas accéder à /dashboard/eleve', async ({ page }) => {
    // Connexion parent
    await page.goto('/auth/signin')
    await page.getByLabel(/email/i).fill('parent@example.com')
    await page.getByLabel(/mot de passe|password/i).fill('admin123')
    await page.getByRole('button', { name: /connexion/i }).click()
    await page.waitForURL('**/dashboard/parent**')
    
    // Tentative d'accès dashboard élève
    await page.goto('/dashboard/eleve')
    await page.waitForTimeout(1000)
    
    // Doit être redirigé (pas sur /dashboard/eleve)
    expect(page.url()).not.toContain('/dashboard/eleve')
  })
  
  test('🔴 Page signin distingue visuellement parent et élève', async ({ page }) => {
    await page.goto('/auth/signin')
    const pageText = await page.textContent('body')
    const mentionsParent = pageText?.toLowerCase().includes('parent')
    const mentionsEleve = pageText?.toLowerCase().includes('élève') || pageText?.toLowerCase().includes('eleve')
    expect(
      mentionsParent || mentionsEleve,
      'La page signin ne distingue pas les types d\'utilisateurs'
    ).toBe(true)
  })
  
  test('🔴 Lien "Mot de passe oublié" existe et fonctionne', async ({ page }) => {
    await page.goto('/auth/signin')
    const forgotLink = page.getByRole('link', { name: /mot de passe oublié|forgot/i })
    await expect(forgotLink).toBeVisible()
    await forgotLink.click()
    await expect(page).toHaveURL(/mot-de-passe-oublie/)
  })
})
```

---

### PAGE 3 : `/auth/mot-de-passe-oublie`

```typescript
// e2e/real/pages/03-forgot-password.spec.ts
test.describe('REAL — Mot de passe oublié', () => {
  
  test('🔴 Formulaire de reset fonctionne (anti-enumeration)', async ({ page }) => {
    await page.goto('/auth/mot-de-passe-oublie')
    await page.getByLabel(/email/i).fill('admin@nexus-reussite.com')
    
    // Intercepter l'appel API
    const apiPromise = page.waitForRequest(req => req.url().includes('/api/auth/reset-password') || req.url().includes('forgot'))
    await page.getByRole('button', { name: /envoyer|réinitialiser/i }).click()
    
    // Doit toujours afficher "succès" (anti-enumeration)
    await expect(page.getByText(/envoyé|lien|email/i)).toBeVisible({ timeout: 5000 })
  })
  
  test('🔴 Email inexistant → même réponse (anti-enumeration)', async ({ page }) => {
    await page.goto('/auth/mot-de-passe-oublie')
    await page.getByLabel(/email/i).fill('inexistant.total@jamais.com')
    await page.getByRole('button', { name: /envoyer/i }).click()
    // Même message que pour email existant
    await expect(page.getByText(/envoyé|lien|email/i)).toBeVisible({ timeout: 5000 })
    // PAS de message "email introuvable" (enumeration attack)
    await expect(page.getByText(/introuvable|inexistant|not found/i)).not.toBeVisible()
  })
})
```

---

### PAGE 4 : `/bilan-gratuit`

```typescript
// e2e/real/pages/04-bilan-gratuit.spec.ts
test.describe('REAL — Bilan Gratuit (/bilan-gratuit)', () => {
  
  test('🔴 HTTP 200', async ({ page }) => {
    const resp = await page.request.get('/bilan-gratuit')
    expect(resp.status()).toBe(200)
  })
  
  test('🔴 Formulaire a des vrais champs (pas une page vide)', async ({ page }) => {
    await page.goto('/bilan-gratuit', { waitUntil: 'networkidle' })
    const inputs = await page.getByRole('textbox').count()
    expect(inputs, 'Le formulaire bilan gratuit n\'a aucun champ !').toBeGreaterThan(0)
  })
  
  test('🔴 API /api/bilan-gratuit répond vraiment (POST)', async ({ page }) => {
    // Test direct de l'API
    const response = await page.request.post('/api/bilan-gratuit', {
      data: {
        parentPrenom: 'Marie',
        parentEmail: `marie.test.${Date.now()}@test.com`,
        parentTelephone: '+33600000000',
        elevePrenom: 'Ahmed',
        eleveNiveau: 'premiere',
        eleveMatieres: ['MATHEMATIQUES'],
        objectif: 'Préparer le bac',
        disponibilite: 'weekend'
      }
    })
    
    // Doit retourner 200 ou 201, PAS 404 ou 500
    expect(
      response.status(),
      `API bilan-gratuit retourne ${response.status()} — elle n\'est pas implémentée ou crashe !`
    ).toBeLessThan(400)
  })
  
  test('🔴 Soumission complète → redirect /confirmation (test bout-en-bout)', async ({ page }) => {
    await page.goto('/bilan-gratuit')
    
    // Remplir le formulaire étape par étape
    // Étape 1 : infos parent
    if (await page.getByLabel(/prénom.*parent|votre prénom/i).isVisible()) {
      await page.getByLabel(/prénom.*parent|votre prénom/i).fill('Marie')
    } else {
      await page.getByLabel(/prénom/i).first().fill('Marie')
    }
    
    await page.getByLabel(/email/i).first().fill(`marie.${Date.now()}@test.com`)
    
    // Cliquer Suivant ou Soumettre selon la structure
    const nextOrSubmit = page.getByRole('button', { name: /suivant|continuer|envoyer|soumettre/i })
    await nextOrSubmit.first().click()
    
    // Attendre et vérifier la suite
    await page.waitForTimeout(1000)
    
    // Si formulaire multi-étapes : continuer les étapes
    // Si une seule étape : vérifier la confirmation
    
    // À terme, on doit arriver sur /confirmation
    // Si pas de redirect → le formulaire est cassé → corriger
  })
  
  test('🔴 Validation email invalide bloque la soumission', async ({ page }) => {
    await page.goto('/bilan-gratuit')
    await page.getByLabel(/email/i).first().fill('pas-un-email-valide')
    await page.getByRole('button', { name: /suivant|envoyer/i }).first().click()
    
    // Soit message d'erreur visible, soit on reste sur la page
    await page.waitForTimeout(500)
    const hasError = await page.getByText(/email invalide|format.*email|email.*invalide/i).isVisible()
    const staysOnPage = page.url().includes('/bilan-gratuit')
    expect(hasError || staysOnPage, 'La validation email ne fonctionne pas').toBe(true)
  })
  
  // Test: les fichiers JSON de questionnaire existent vraiment
  test('🔴 Les définitions de questionnaire (JSON) existent et sont valides', async ({ page }) => {
    const response = await page.request.get('/api/diagnostics/definitions')
    
    expect(
      response.status(),
      'API /api/diagnostics/definitions → ' + response.status() + ' — les JSON sont manquants !'
    ).toBe(200)
    
    const data = await response.json()
    expect(Array.isArray(data) || typeof data === 'object', 'Réponse JSON invalide').toBe(true)
    
    // Doit contenir de vraies questions
    const definitions = Array.isArray(data) ? data : Object.values(data)
    expect(definitions.length, 'Aucune définition de questionnaire trouvée').toBeGreaterThan(0)
  })
})
```

---

### PAGES 5-74 : Template Universel

**Pour CHAQUE page restante, appliquer ce template :**

```typescript
// e2e/real/pages/[N]-[page-name].spec.ts

import { test, expect } from '@playwright/test'

test.describe('REAL — [NOM PAGE] ([URL])', () => {
  
  const PAGE_URL = '[URL]'
  const REQUIRES_AUTH = [true/false]
  const AUTH_FIXTURE = '[e2e/fixtures/xxx-auth.json]' // si auth requise
  
  // Si auth requise
  // test.use({ storageState: AUTH_FIXTURE })
  
  // ==========================================
  // TESTS DE BASE (tous les pages)
  // ==========================================
  
  test('🔴 HTTP 200 — La page existe', async ({ page }) => {
    const resp = await page.request.get(PAGE_URL)
    expect(resp.status(), `${PAGE_URL} → ${resp.status()}`).toBe(200)
  })
  
  test('🔴 Zéro erreur console critique', async ({ page }) => {
    const errors: string[] = []
    page.on('console', msg => {
      if (msg.type() === 'error') errors.push(msg.text())
    })
    await page.goto(PAGE_URL, { waitUntil: 'networkidle' })
    await page.waitForTimeout(1000)
    const realErrors = errors.filter(e => !e.includes('favicon') && !e.includes('hot-update'))
    expect(realErrors, `Erreurs JS sur ${PAGE_URL}:\n${realErrors.join('\n')}`).toHaveLength(0)
  })
  
  test('🔴 Zéro erreur réseau 4xx/5xx', async ({ page }) => {
    const netErrors: string[] = []
    page.on('response', r => { if (r.status() >= 400 && !r.url().includes('favicon')) netErrors.push(`${r.status()} ${r.url()}`) })
    await page.goto(PAGE_URL, { waitUntil: 'networkidle' })
    expect(netErrors, `Erreurs réseau sur ${PAGE_URL}:\n${netErrors.join('\n')}`).toHaveLength(0)
  })
  
  test('🔴 H1 ou titre principal présent et non vide', async ({ page }) => {
    await page.goto(PAGE_URL)
    const h1 = page.locator('h1').first()
    const heading = page.getByRole('heading', { level: 1 }).first()
    const isVisible = await h1.isVisible().catch(() => false) || await heading.isVisible().catch(() => false)
    expect(isVisible, `Aucun H1 sur ${PAGE_URL}`).toBe(true)
  })
  
  // ==========================================
  // BOUTONS ET LIENS SPÉCIFIQUES À LA PAGE
  // ==========================================
  
  // [LISTE EXHAUSTIVE SPÉCIFIQUE À CHAQUE PAGE]
  
  // ==========================================
  // FORMULAIRES
  // ==========================================
  
  // [TESTS FORMULAIRES SPÉCIFIQUES]
  
  // ==========================================
  // COHÉRENCE BACKEND / DB
  // ==========================================
  
  // [VÉRIFIER QUE LES DONNÉES AFFICHÉES = DB]
})
```

---

### TOUTES LES PAGES — LISTE EXHAUSTIVE À TESTER

Créer un fichier spec pour **chacune** de ces pages :

```
PAGES PUBLIQUES (HTTP 200 + éléments interactifs) :
✅ 01 — /
✅ 02 — /auth/signin
✅ 03 — /auth/mot-de-passe-oublie
✅ 04 — /bilan-gratuit
□ 05 — /bilan-gratuit/confirmation
□ 06 — /offres
□ 07 — /stages
□ 08 — /stages/fevrier-2026
□ 09 — /stages/fevrier-2026/diagnostic
□ 10 — /bilan-pallier2-maths
□ 11 — /bilan-pallier2-maths/confirmation
□ 12 — /bilan-pallier2-maths/dashboard
□ 13 — /programme/maths-1ere
□ 14 — /programme/maths-terminale
□ 15 — /accompagnement-scolaire
□ 16 — /plateforme-aria
□ 17 — /equipe
□ 18 — /notre-centre
□ 19 — /contact
□ 20 — /conditions
□ 21 — /mentions-legales
□ 22 — /academy
□ 23 — /consulting
□ 24 — /famille

PAGES AUTH :
□ 25 — /auth/activate (avec token valide)
□ 26 — /auth/reset-password (avec token valide)

PAGES DASHBOARD ADMIN :
□ 27 — /dashboard/admin
□ 28 — /dashboard/admin/users
□ 29 — /dashboard/admin/analytics
□ 30 — /dashboard/admin/subscriptions
□ 31 — /dashboard/admin/activities
□ 32 — /dashboard/admin/tests
□ 33 — /dashboard/admin/documents
□ 34 — /dashboard/admin/facturation

PAGES DASHBOARD ASSISTANTE :
□ 35 — /dashboard/assistante
□ 36 — /dashboard/assistante/students
□ 37 — /dashboard/assistante/coaches
□ 38 — /dashboard/assistante/subscriptions
□ 39 — /dashboard/assistante/credit-requests
□ 40 — /dashboard/assistante/subscription-requests
□ 41 — /dashboard/assistante/credits
□ 42 — /dashboard/assistante/paiements
□ 43 — /dashboard/assistante/docs

PAGES DASHBOARD COACH :
□ 44 — /dashboard/coach
□ 45 — /dashboard/coach/sessions
□ 46 — /dashboard/coach/students
□ 47 — /dashboard/coach/availability

PAGES DASHBOARD PARENT :
□ 48 — /dashboard/parent
□ 49 — /dashboard/parent/children
□ 50 — /dashboard/parent/abonnements
□ 51 — /dashboard/parent/paiement
□ 52 — /dashboard/parent/paiement/confirmation
□ 53 — /dashboard/parent/ressources

PAGES DASHBOARD ÉLÈVE :
□ 54 — /dashboard/eleve
□ 55 — /dashboard/eleve/mes-sessions
□ 56 — /dashboard/eleve/sessions
□ 57 — /dashboard/eleve/ressources

PAGES COMMUNES :
□ 58 — /dashboard/trajectoire
□ 59 — /session/video
□ 60 — /access-required

PAGES ADMIN SPÉCIALES :
□ 61 — /admin/directeur
□ 62 — /admin/stages/fevrier-2026

PAGES RÉSULTATS DYNAMIQUES :
□ 63 — /stages/fevrier-2026/bilan/[id]
□ 64 — /bilan-pallier2-maths/resultat/[id]
□ 65 — /assessments/[id]/processing
□ 66 — /assessments/[id]/result
```

---

## PHASE 3 — TESTS D'INTÉGRATION RÉELS (BACKEND ↔ FRONTEND ↔ DB)

### 3.1 — Tests API Réels (sans mock)

```typescript
// e2e/real/api/api-real-integration.spec.ts
// CES TESTS APPELLENT LES VRAIES API AVEC DE VRAIS TOKENS D'AUTH

test.describe('REAL API Integration Tests', () => {
  
  let adminToken: string
  let parentToken: string
  let eleveToken: string
  
  test.beforeAll(async ({ request }) => {
    // Obtenir de vrais tokens via signin
    const adminResp = await request.post('/api/auth/signin', {
      data: { email: 'admin@nexus-reussite.com', password: 'admin123' }
    })
    // Extraire le cookie de session
  })
  
  // ADMIN DASHBOARD — vraies données
  test('🔴 GET /api/admin/dashboard → données réelles de la DB', async ({ request }) => {
    const resp = await request.get('/api/admin/dashboard', {
      headers: { Cookie: `authjs.session-token=${adminToken}` }
    })
    expect(resp.status()).toBe(200)
    const data = await resp.json()
    
    // Les données doivent correspondre à la vraie DB
    expect(typeof data.totalUsers).toBe('number')
    expect(data.totalUsers).toBeGreaterThan(0) // On a 9 users en seed
    
    // Vérifier cohérence avec la DB
    // (requérir Prisma pour vérifier le count réel)
  })
  
  // CREATE USER → vérifier en DB
  test('🔴 POST /api/admin/users → créé réellement en DB', async ({ request }) => {
    const testEmail = `test.real.${Date.now()}@nexus-test.com`
    
    const resp = await request.post('/api/admin/users', {
      data: {
        email: testEmail,
        firstName: 'Test',
        lastName: 'Real',
        role: 'PARENT',
        password: 'TestReal1234!'
      }
    })
    
    expect(resp.status(), `Création user → ${resp.status()}`).toBeLessThan(400)
    
    // Vérifier en DB réelle
    const prisma = new PrismaClient()
    const createdUser = await prisma.user.findUnique({ where: { email: testEmail } })
    expect(createdUser, 'User créé via API n\'existe pas en DB !').not.toBeNull()
    
    // Cleanup
    await prisma.user.delete({ where: { email: testEmail } })
    await prisma.$disconnect()
  })
  
  // BOOK SESSION → vérifier crédits débités en DB
  test('🔴 POST /api/sessions/book → crédits débités en DB', async ({ request }) => {
    // Setup: s'assurer que l'élève seed a des crédits
    // Réserver une session
    // Vérifier que les crédits ont bien été débités en DB
    // Pas juste vérifier la réponse API — vérifier la DB réelle
  })
  
  // PAYMENT VALIDATE → vérifier transaction atomique en DB
  test('🔴 POST /api/payments/validate → transaction atomique réelle', async ({ request }) => {
    // Ce test nécessite un paiement PENDING en DB
    // Valider → vérifier TOUS les effets en DB :
    // - payment.status === COMPLETED
    // - subscription.status === ACTIVE
    // - CreditTransaction créée
    // - Invoice créée avec status PAID
    // - UserDocument créé
    // Si l'un manque → CORRIGER le code, pas le test
  })
})
```

### 3.2 — Vérification Connexion Ollama/RAG Réelle

```typescript
// e2e/real/infrastructure/llm-rag-real.spec.ts
test.describe('REAL — Infrastructure LLM + RAG', () => {
  
  test('🔴 Ollama est accessible (health check réel)', async ({ request }) => {
    const ollamaUrl = process.env.OLLAMA_URL || 'http://localhost:11434'
    
    try {
      const resp = await request.get(`${ollamaUrl}/api/tags`, { timeout: 5000 })
      const isOk = resp.status() === 200
      
      if (!isOk) {
        console.error(`⚠️ Ollama n\'est PAS accessible sur ${ollamaUrl}`)
        console.error('→ CORRIGER : démarrer Ollama ou corriger OLLAMA_URL dans .env')
        // Ne pas skipper — signaler clairement
      }
      
      // Si Ollama est indisponible → vérifier que l'app gère le fallback
      // et ne crashe pas
    } catch (error) {
      console.error('⚠️ Ollama UNREACHABLE — les fonctionnalités IA ne fonctionneront pas')
      // Vérifier le fallback
    }
  })
  
  test('🔴 Modèle llama3.2 est chargé dans Ollama', async ({ request }) => {
    const ollamaUrl = process.env.OLLAMA_URL || 'http://localhost:11434'
    try {
      const resp = await request.get(`${ollamaUrl}/api/tags`)
      if (resp.status() === 200) {
        const data = await resp.json()
        const models = data.models?.map((m: any) => m.name) || []
        const hasLlama = models.some((m: string) => m.includes('llama3.2') || m.includes('llama'))
        expect(hasLlama, `Modèle llama3.2 absent — modèles disponibles: ${models.join(', ')}`).toBe(true)
      }
    } catch {}
  })
  
  test('🔴 RAG Ingestor est accessible (health check réel)', async ({ request }) => {
    const ragUrl = process.env.RAG_INGESTOR_URL || 'http://localhost:8001'
    try {
      const resp = await request.get(`${ragUrl}/health`, { timeout: 5000 })
      const isOk = resp.status() === 200
      if (!isOk) console.error(`⚠️ RAG Ingestor n\'est PAS accessible sur ${ragUrl}`)
    } catch (error) {
      console.error('⚠️ RAG Ingestor UNREACHABLE — le RAG ne fonctionnera pas')
    }
  })
  
  test('🔴 API /api/aria/chat fonctionne réellement (avec fallback si LLM down)', async ({ page }) => {
    // Login comme élève avec entitlement ARIA
    await page.goto('/auth/signin')
    await page.getByLabel(/email/i).fill('student@example.com')
    await page.getByLabel(/mot de passe|password/i).fill('admin123')
    await page.getByRole('button', { name: /connexion/i }).click()
    await page.waitForURL('**/dashboard/eleve**')
    
    // Appeler l'API ARIA directement
    const resp = await page.request.post('/api/aria/chat', {
      data: { message: 'Bonjour, qu\'est-ce que la dérivée ?' }
    })
    
    // Si 403 → élève n'a pas l'entitlement → signaler et corriger
    // Si 200 → OK
    // Si 500 → l'API crashe → corriger
    if (resp.status() === 403) {
      console.error('⚠️ Élève seed n\'a pas l\'entitlement ARIA — à corriger dans le seed')
    }
    expect(resp.status(), `API ARIA retourne ${resp.status()}`).toBeLessThan(500)
  })
})
```

---

## PHASE 4 — VÉRIFICATION FINALE : TOUS LES TESTS PRÉCÉDEMMENT ÉCHOUÉS

### 4.1 — Script de Comparaison

```bash
#!/bin/bash
# scripts/compare-test-results.sh
# Lance les tests et compare avec l'état initial

echo "=== RAPPORT FINAL ==="
echo ""

# Jest
echo "--- Tests Jest ---"
npm test -- --verbose --forceExit 2>&1 | tee /tmp/jest-final.txt

INITIAL_FAILURES=$(grep -c "FAIL\|✗\|×" /tmp/jest-results-initial.txt 2>/dev/null || echo "0")
FINAL_FAILURES=$(grep -c "FAIL\|✗\|×" /tmp/jest-final.txt 2>/dev/null || echo "0")

echo ""
echo "Échecs initiaux : $INITIAL_FAILURES"
echo "Échecs finals : $FINAL_FAILURES"

if [ "$FINAL_FAILURES" -gt "$INITIAL_FAILURES" ]; then
  echo "❌ RÉGRESSION DÉTECTÉE : plus d'échecs qu'au départ !"
  exit 1
elif [ "$FINAL_FAILURES" -eq 0 ]; then
  echo "✅ Tous les tests passent !"
else
  echo "⚠️ $FINAL_FAILURES tests encore en échec (cf. rapport ci-dessous)"
  grep -A 3 "FAIL\|●" /tmp/jest-final.txt
fi

# Playwright
echo ""
echo "--- Tests Playwright ---"
npx playwright test --project=chromium --reporter=line 2>&1 | tee /tmp/playwright-final.txt
```

### 4.2 — Rapport de Résolution Obligatoire

À la fin de chaque session de travail, Windsurf DOIT produire ce rapport :

```markdown
# RAPPORT DE RÉSOLUTION — [DATE/HEURE]

## Tests initialement en échec : X

### ✅ Résolus (X tests)
| Test | Cause racine | Correction apportée |
|------|-------------|---------------------|
| nom du test | description du bug | description du fix |
| ...  | ...         | ...                 |

### ❌ Toujours en échec (X tests)
| Test | Message d'erreur exact | Tentatives de fix | Blocage |
|------|----------------------|-------------------|---------|
| nom du test | error message | ce que j'ai essayé | pourquoi bloqué |

### ⚠️ Nouveaux échecs introduits (RÉGRESSIONS — à corriger immédiatement)
| Test | Commit qui l'a cassé | Correction |
|------|---------------------|-----------|

## État du Build
- `npm run build` : ✅ / ❌
- `npm run typecheck` : ✅ / ❌
- `npm run lint` : ✅ / ❌

## Fonctionnalités Vérifiées Réellement
- [ ] Connexion admin fonctionne (testé manuellement)
- [ ] Connexion parent fonctionne (testé manuellement)
- [ ] Connexion élève fonctionne (testé manuellement)
- [ ] Formulaire bilan-gratuit soumis → données en DB (vérifié Prisma Studio)
- [ ] Ollama accessible et répond
- [ ] RAG accessible et répond
- [ ] Upload document → fichier en storage (vérifié filesystem)
- [ ] Validation paiement → transaction atomique (vérifié DB)

## Ce que je n'ai PAS fait (honnêteté absolue)
- [liste de ce qui reste à faire]

## Prochaines actions nécessaires
- [liste priorisée]
```

---

## PHASE 5 — TESTS MOBILE RÉELS

```typescript
// e2e/real/responsive/mobile-real.spec.ts

const VIEWPORTS = [
  { name: 'iPhone SE', width: 375, height: 667 },
  { name: 'iPhone 13', width: 390, height: 844 },
  { name: 'Samsung Galaxy S21', width: 360, height: 800 },
  { name: 'iPad Mini', width: 768, height: 1024 },
]

const ALL_PUBLIC_PAGES = [
  '/', '/offres', '/bilan-gratuit', '/contact',
  '/stages/fevrier-2026', '/accompagnement-scolaire',
  '/plateforme-aria', '/equipe', '/conditions', '/mentions-legales'
]

VIEWPORTS.forEach(viewport => {
  test.describe(`Mobile Real — ${viewport.name} (${viewport.width}×${viewport.height})`, () => {
    test.use({ viewport })
    
    ALL_PUBLIC_PAGES.forEach(url => {
      test(`🔴 ${url} — Pas de scroll horizontal`, async ({ page }) => {
        await page.goto(url, { waitUntil: 'networkidle' })
        
        // Mesure réelle du débordement
        const { scrollWidth, clientWidth, overflowingElements } = await page.evaluate(() => {
          const scrollWidth = document.documentElement.scrollWidth
          const clientWidth = document.documentElement.clientWidth
          
          // Trouver les éléments qui dépassent
          const all = document.querySelectorAll('*')
          const overflowing: string[] = []
          all.forEach(el => {
            const rect = el.getBoundingClientRect()
            if (rect.right > clientWidth + 2) {
              const id = el.id ? `#${el.id}` : ''
              const cls = Array.from(el.classList).slice(0, 2).join('.')
              overflowing.push(`${el.tagName}${id}.${cls} (right: ${Math.round(rect.right)})`)
            }
          })
          return { scrollWidth, clientWidth, overflowingElements: overflowing.slice(0, 5) }
        })
        
        expect(
          scrollWidth <= clientWidth + 5,
          `SCROLL HORIZONTAL sur ${url} (${viewport.name}) !\n` +
          `scrollWidth=${scrollWidth}, clientWidth=${clientWidth}\n` +
          `Éléments débordants :\n${overflowingElements.join('\n')}\n` +
          `→ CORRIGER le CSS de ces éléments`
        ).toBe(true)
      })
      
      test(`🔴 ${url} — Menu hamburger fonctionnel`, async ({ page }) => {
        if (viewport.width >= 768) return // iPad : menu desktop OK
        
        await page.goto(url)
        
        // Sur mobile, le menu desktop ne doit PAS être visible
        const desktopMenu = page.locator('nav [class*="hidden md:"] a, nav [class*="md:flex"] a').first()
        // Il peut y avoir différentes classes selon l'implémentation
        
        // Le bouton hamburger DOIT être visible
        const hamburgerSelectors = [
          'button[aria-label*="menu" i]',
          'button[aria-label*="hamburger" i]',
          '[data-testid="mobile-menu-button"]',
          'button:has(svg)',
          '.hamburger',
          '#mobile-menu-button'
        ]
        
        let hamburgerFound = false
        for (const selector of hamburgerSelectors) {
          const el = page.locator(selector).first()
          if (await el.isVisible().catch(() => false)) {
            hamburgerFound = true
            
            // Cliquer le hamburger
            await el.click()
            await page.waitForTimeout(300)
            
            // Le menu doit s'ouvrir
            const menuLinks = page.getByRole('link', { name: /offres|bilan|contact/i })
            const menuVisible = await menuLinks.first().isVisible().catch(() => false)
            
            if (!menuVisible) {
              console.error(`⚠️ Menu hamburger trouvé mais ne s'ouvre pas sur ${url} (${viewport.name})`)
              console.error('→ CORRIGER le toggle du menu mobile')
            }
            
            break
          }
        }
        
        if (!hamburgerFound) {
          console.error(`⚠️ Aucun bouton hamburger trouvé sur ${url} (${viewport.name})`)
          console.error('→ AJOUTER un menu hamburger pour mobile')
        }
      })
      
      test(`🔴 ${url} — Touch targets ≥ 44px`, async ({ page }) => {
        await page.goto(url)
        
        const smallTargets = await page.evaluate(() => {
          const interactives = document.querySelectorAll('button, a, input, select, textarea, [role="button"]')
          const small: string[] = []
          interactives.forEach(el => {
            const rect = el.getBoundingClientRect()
            if (rect.width > 0 && rect.height > 0 && rect.height < 44) {
              const text = (el.textContent || '').trim().substring(0, 30)
              small.push(`${el.tagName}[${text}] height=${Math.round(rect.height)}px`)
            }
          })
          return small.slice(0, 10)
        })
        
        if (smallTargets.length > 0) {
          console.warn(`⚠️ Touch targets trop petits sur ${url} (${viewport.name}):\n${smallTargets.join('\n')}`)
          // Warning, pas échec bloquant (certains éléments décoratifs peuvent être petits)
        }
      })
    })
    
    // Dashboard mobile
    test(`🔴 Dashboard parent navigable sur ${viewport.name}`, async ({ page }) => {
      // Login
      await page.goto('/auth/signin')
      await page.getByLabel(/email/i).fill('parent@example.com')
      await page.getByLabel(/mot de passe|password/i).fill('admin123')
      await page.getByRole('button', { name: /connexion/i }).click()
      await page.waitForURL('**/dashboard/parent**')
      
      // Vérifier sidebar mobile (hamburger dans dashboard)
      if (viewport.width < 768) {
        const dashboardErrors: string[] = []
        
        const scrollWidth = await page.evaluate(() => document.documentElement.scrollWidth)
        const clientWidth = await page.evaluate(() => document.documentElement.clientWidth)
        
        expect(
          scrollWidth <= clientWidth + 5,
          `Scroll horizontal dans le dashboard parent (${viewport.name}) !`
        ).toBe(true)
      }
    })
  })
})
```

---

## PHASE 6 — ANTI-TRICHE : VÉRIFICATIONS CROSS-LAYER

Ces tests vérifient que les corrections sont réelles et pas cosmétiques :

```typescript
// e2e/real/anti-cheat/cross-layer-verification.spec.ts

test.describe('ANTI-TRICHE — Vérifications Cross-Layer', () => {
  
  test('🔴 Un user créé via l\'API existe VRAIMENT en base de données', async ({ page }) => {
    const testEmail = `antitriche.${Date.now()}@test.com`
    
    // Créer via API
    const resp = await page.request.post('/api/admin/users', {
      data: { email: testEmail, firstName: 'Anti', lastName: 'Triche', role: 'PARENT', password: 'Test1234!' }
    })
    expect(resp.status()).toBeLessThan(400)
    
    // Vérifier en DB (Prisma direct — pas l'API)
    const { PrismaClient } = require('@prisma/client')
    const prisma = new PrismaClient()
    const user = await prisma.user.findUnique({ where: { email: testEmail } })
    await prisma.$disconnect()
    
    expect(user, 'User créé via API absent de la vraie DB').not.toBeNull()
    expect(user?.role).toBe('PARENT')
    
    // Cleanup
    const prisma2 = new PrismaClient()
    await prisma2.user.delete({ where: { email: testEmail } })
    await prisma2.$disconnect()
  })
  
  test('🔴 Un document uploadé est vraiment stocké sur le filesystem', async ({ page }) => {
    const fs = require('fs')
    const path = require('path')
    
    // Upload via l'interface admin
    // Vérifier que le fichier existe physiquement dans storage/documents/
    const storageDir = path.join(process.cwd(), 'storage', 'documents')
    
    if (!fs.existsSync(storageDir)) {
      console.error('⚠️ Répertoire storage/documents/ inexistant — CRÉER et vérifier l\'upload')
    }
  })
  
  test('🔴 Un virement validé : les crédits sont RÉELLEMENT en DB', async ({ page }) => {
    // Test bout-en-bout complet avec vérification DB
    // Parent déclare virement
    // Assistante valide
    // Vérifier en DB : CreditTransaction créée avec le bon montant
    const { PrismaClient } = require('@prisma/client')
    const prisma = new PrismaClient()
    
    // Compter les transactions AVANT
    const countBefore = await prisma.creditTransaction.count()
    
    // Effectuer la validation (via API)
    // ...
    
    // Compter APRÈS
    const countAfter = await prisma.creditTransaction.count()
    
    expect(countAfter, 'Aucune CreditTransaction créée après validation paiement !').toBeGreaterThan(countBefore)
    await prisma.$disconnect()
  })
  
  test('🔴 Les tests qui passaient avant passent ENCORE (anti-régression)', async () => {
    // Ce test compare le rapport initial et final
    const fs = require('fs')
    
    const initialResults = fs.existsSync('/tmp/jest-results-initial.txt')
      ? fs.readFileSync('/tmp/jest-results-initial.txt', 'utf8')
      : null
    
    if (!initialResults) {
      console.warn('Rapport initial non trouvé — lancer Phase 0 d\'abord')
      return
    }
    
    const initialPassing = (initialResults.match(/✓/g) || []).length
    const currentResults = require('child_process')
      .execSync('npm test -- --verbose --forceExit 2>&1').toString()
    const currentPassing = (currentResults.match(/✓/g) || []).length
    
    expect(
      currentPassing,
      `RÉGRESSION : ${initialPassing - currentPassing} tests qui passaient avant ne passent plus !`
    ).toBeGreaterThanOrEqual(initialPassing)
  })
})
```

---

## PHASE 7 — INSTRUCTIONS DE CORRECTION (COMMENT CORRIGER VRAIMENT)

### Règles de correction que Windsurf DOIT suivre :

```
RÈGLE 1 — IDENTIFIER LA VRAIE CAUSE
  Pour chaque test qui échoue :
  1. Lire le message d'erreur exact
  2. Tracer : Test → Page → Component → Handler → API → Service → DB
  3. Identifier QUI appelle QUOI et OÙ ça échoue
  4. NE PAS corriger à l'aveugle

RÈGLE 2 — CORRIGER À LA SOURCE
  Si le test dit "API retourne 500" :
  → Lire les logs serveur (`npm run dev` → voir les erreurs dans la console)
  → Trouver l'erreur dans le handler de route
  → Corriger le handler
  NE PAS : changer l'assertion pour accepter le 500

RÈGLE 3 — VÉRIFIER LA CORRECTION
  Après chaque correction :
  1. Relancer UNIQUEMENT le test qui échouait → doit passer
  2. Relancer TOUS les tests → aucun nouveau échec
  3. npm run build → doit passer
  4. Tester manuellement dans le navigateur

RÈGLE 4 — DOCUMENTER CHAQUE FIX
  Dans AUDIT_RAPPORT_FINAL.md :
  - Test qui échouait
  - Cause racine trouvée
  - Ligne de code corrigée (avec git diff)
  - Test qui passe maintenant

RÈGLE 5 — SIGNALER LES IMPOSSIBLES
  Si un test ne peut pas être corrigé (ex: Ollama non disponible en local) :
  - Le documenter clairement
  - Expliquer pourquoi
  - Proposer une solution alternative
  NE PAS : skipper silencieusement
```

---

## COMMANDES D'EXÉCUTION DANS L'ORDRE

```bash
# ============================
# ÉTAPE 0 — État initial
# ============================
npm test -- --verbose --forceExit 2>&1 | tee /tmp/jest-results-initial.txt
npx playwright test --reporter=html 2>&1 | tee /tmp/playwright-results-initial.txt
# → Créer AUDIT_RAPPORT_INITIAL.md

# ============================
# ÉTAPE 1 — DB et seed
# ============================
npx prisma migrate status          # Vérifier migrations
npx prisma db seed                 # Re-seeder si nécessaire
npm test -- --testPathPattern="database/real-data-integrity" --runInBand

# ============================
# ÉTAPE 2 — Tests page par page
# ============================
npx playwright test e2e/real/pages/ --project=chromium --reporter=list
# → Corriger chaque échec dans l'ordre

# ============================
# ÉTAPE 3 — Tests d'intégration API
# ============================
npx playwright test e2e/real/api/ --project=chromium --reporter=list
# → Corriger chaque échec

# ============================
# ÉTAPE 4 — Tests mobile
# ============================
npx playwright test e2e/real/responsive/ --project=chromium --reporter=list
# → Corriger le CSS pour chaque échec

# ============================
# ÉTAPE 5 — Tests anti-triche
# ============================
npx playwright test e2e/real/anti-cheat/ --project=chromium --reporter=list

# ============================
# ÉTAPE 6 — Validation finale
# ============================
npm run build                      # Doit passer
npm run typecheck                  # 0 erreurs TypeScript
npm run lint                       # 0 erreurs ESLint
npm test -- --forceExit           # Tous les tests Jest
npx playwright test --project=chromium  # Tous les tests E2E
bash scripts/compare-test-results.sh  # Comparaison état initial vs final

# ============================
# ÉTAPE 7 — Rapport final
# ============================
# Créer AUDIT_RAPPORT_FINAL.md avec :
# - Tous les tests qui étaient en échec et sont maintenant résolus
# - Tous les tests qui restent en échec avec justification honnête
# - Toute la liste des corrections apportées avec fichiers modifiés
```

---

## DÉFINITION DE "MISSION ACCOMPLIE"

La mission est accomplie UNIQUEMENT quand :

```
✅ npm run build → exit code 0 (0 erreur)
✅ npm run typecheck → "Found 0 errors"  
✅ npm run lint → "No ESLint warnings or errors"
✅ npm test → tous les tests passent (ou échecs documentés + justifiés)
✅ npx playwright test → tous les tests passent (ou échecs documentés + justifiés)
✅ Connexion réelle fonctionne pour : admin, parent, élève, coach, assistante
✅ Formulaire bilan-gratuit soumis → données visibles dans Prisma Studio
✅ Formulaire contact soumis → réponse 200 de l'API
✅ Upload document admin → fichier dans storage/
✅ Aucun scroll horizontal sur mobile (390px)
✅ Menu hamburger fonctionnel sur mobile
✅ AUDIT_RAPPORT_FINAL.md créé et honnête
```

**Si un seul de ces critères n'est pas rempli → la mission n'est PAS accomplie.**
