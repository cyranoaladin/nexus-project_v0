# Homepage Mobile Candidat Libre Implementation Plan

> **For agentic workers:** REQUIRED: Use superpowers:subagent-driven-development (if subagents available) or superpowers:executing-plans to implement this plan. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Make the mobile homepage convert faster for parents of candidats libres and double-cursus students by putting the risk, proof, and WhatsApp CTA in the first mobile screen.

**Architecture:** Keep the current static-home architecture: `app/page.tsx` reads `Nexus_Reussite_Accueil.html` and injects its CSS, body, and script. Implement the mobile landing behavior primarily inside the HTML/CSS file, with Playwright tests validating mobile conversion criteria. Deploy only the changed homepage assets to the production app on `root@<PROD_HOST>`.

**Tech Stack:** Next.js 15, static HTML injection, CSS media queries, vanilla JS interactions, Playwright e2e.

---

## Chunk 1: Mobile Acceptance Tests

### Task 1: Replace stale homepage mobile expectations with candidate-libre conversion checks

**Files:**
- Modify: `e2e/pages-public-homepage-mobile.spec.ts`
- Reference: `docs/superpowers/specs/2026-06-07-homepage-mobile-candidat-libre-design.md`

- [ ] **Step 1: Write failing tests for the validated mobile hero**

Update the homepage mobile spec so the tests target the current static home rather than stale sections like `#nexus-select`.

Use selectors that match the intended implementation:

```ts
test('hero mobile cible candidat libre et double cursus', async ({ page }) => {
  await expect(page.locator('.hero-segment')).toHaveText(/CANDIDAT LIBRE\s*DOUBLE CURSUS/);
  await expect(page.getByRole('heading', { name: /bac français sans cadre/i })).toBeVisible();
});

test('CTA WhatsApp hero visible dans le premier écran mobile 390px', async ({ page }) => {
  const heroCTA = page.locator('.hero a[href*="wa.me"]').first();
  await expect(heroCTA).toBeVisible();
  const box = await heroCTA.boundingBox();
  expect(box).not.toBeNull();
  expect(box!.y + box!.height).toBeLessThanOrEqual(844);
  expect(box!.height).toBeGreaterThanOrEqual(44);
});

test('preuves rapides visibles dans le hero mobile', async ({ page }) => {
  await expect(page.locator('.hero').getByText('Cyclades')).toBeVisible();
  await expect(page.locator('.hero').getByText('Bacs blancs')).toBeVisible();
  await expect(page.locator('.hero').getByText('Parents')).toBeVisible();
});

test('sticky WhatsApp apparait apres scroll et ne s affiche pas au chargement', async ({ page }) => {
  const sticky = page.locator('a.mobile-sticky-wa[href*="wa.me"]');
  await expect(sticky).toBeHidden();
  await page.evaluate(() => window.scrollTo(0, 900));
  await page.waitForTimeout(250);
  await expect(sticky).toBeVisible();
  await expect(sticky).toHaveAttribute('href', /wa\.me\/21699192829/);
});
```

- [ ] **Step 2: Run tests to verify they fail for the current page**

Run:

```bash
BASE_URL=http://localhost:3001 npx playwright test e2e/pages-public-homepage-mobile.spec.ts --project=chromium --grep "candidat libre|CTA WhatsApp hero|preuves rapides|sticky WhatsApp"
```

Expected: FAIL because `.hero-segment`, `.mobile-sticky-wa`, and the new proof chips are not implemented yet.

- [ ] **Step 3: Update broad homepage tests that still target removed legacy sections**

Modify `e2e/pages-public-homepage.spec.ts` only where it asserts obsolete home sections:

```ts
await expect(page.locator('.hero h1').first()).toBeVisible();
await expect(page.locator('.hero a[href*="wa.me"]').first()).toBeVisible();
await expect(page.locator('#offres')).toBeAttached();
await expect(page.locator('#contact')).toBeAttached();
```

Remove or replace expectations for `#hero`, `#nexus-select`, `#offres-fin-annee`, old prices, and old forfait card counts if those sections no longer exist in `Nexus_Reussite_Accueil.html`.

- [ ] **Step 4: Commit tests after red verification**

```bash
git add e2e/pages-public-homepage-mobile.spec.ts e2e/pages-public-homepage.spec.ts
git commit -m "test: cover mobile candidate libre homepage"
```

## Chunk 2: Mobile Hero And Proof Section

### Task 2: Implement the short candidate-libre mobile hero

**Files:**
- Modify: `Nexus_Reussite_Accueil.html`

- [ ] **Step 1: Add semantic mobile-oriented hero content**

In the existing `.hero` section, replace the hero copy with the validated copy:

```html
<div class="tagpill hero-segment"><span class="a">CANDIDAT LIBRE</span><span class="b">DOUBLE CURSUS</span></div>
<h1>Ne laissez pas le bac français <em>sans cadre</em>.</h1>
<p class="lead">Carte d'examen, Cyclades, bacs blancs, bulletins et suivi parents pour avancer sans flou.</p>
```

Add proof chips inside `.hero-badges`:

```html
<span class="hbadge hbadge-priority">Cyclades</span>
<span class="hbadge hbadge-priority">Bacs blancs</span>
<span class="hbadge hbadge-priority">Parents</span>
```

Keep existing brand proof where useful, but on mobile show the three priority chips first.

- [ ] **Step 2: Update hero CTAs**

Make the primary CTA WhatsApp copy and URL explicit:

```html
<a class="btn btn-red hero-primary-cta" href="https://wa.me/21699192829?text=Bonjour%20Nexus%20R%C3%A9ussite%2C%20je%20souhaite%20r%C3%A9server%20le%20bilan%20offert%20pour%20un%20candidat%20libre%20ou%20double%20cursus." target="_blank" rel="noopener">Réserver le bilan offert</a>
<a class="btn btn-out hero-secondary-cta" href="#methode">Voir l'accompagnement</a>
```

- [ ] **Step 3: Tighten mobile CSS for the first screen**

In `@media(max-width:680px)`, add:

```css
.wrap{padding:0 18px}
.nav{height:64px}
.logo-img{width:142px}
.hero{padding:26px 0 36px}
.hero-grid{gap:18px}
.tagpill{margin-bottom:14px}
.tagpill span{font-size:10px;padding:5px 9px}
.hero h1{font-size:clamp(30px,9vw,38px);line-height:1.02}
.hero .lead{font-size:15px;margin-top:12px;line-height:1.45}
.hero-badges{gap:7px;margin-top:14px}
.hbadge{padding:7px 10px;font-size:12px}
.hero-cta{display:grid;grid-template-columns:1fr;gap:9px;margin-top:18px}
.hero-cta .btn{width:100%;justify-content:center;min-height:46px}
.hero-note{font-size:12px;margin-top:12px}
.hero-card{display:none}
```

If hiding `.hero-card` removes too much proof, convert it to a compact `.mobile-proof-panel` directly after the hero rather than leaving the large desktop card in the first mobile scroll.

- [ ] **Step 4: Run the focused mobile tests**

```bash
BASE_URL=http://localhost:3001 npx playwright test e2e/pages-public-homepage-mobile.spec.ts --project=chromium --grep "candidat libre|CTA WhatsApp hero|preuves rapides"
```

Expected: PASS for hero, CTA, and proof checks.

- [ ] **Step 5: Commit hero implementation**

```bash
git add Nexus_Reussite_Accueil.html
git commit -m "feat: optimize mobile homepage hero"
```

## Chunk 3: Sticky CTA And Mobile Navigation

### Task 3: Add low-friction mobile WhatsApp sticky CTA

**Files:**
- Modify: `Nexus_Reussite_Accueil.html`

- [ ] **Step 1: Add sticky CTA markup near the end of `<body>` before `<script>`**

```html
<a class="mobile-sticky-wa" aria-label="Contacter Nexus Réussite sur WhatsApp" href="https://wa.me/21699192829?text=Bonjour%20Nexus%20R%C3%A9ussite%2C%20je%20souhaite%20r%C3%A9server%20le%20bilan%20offert." target="_blank" rel="noopener">
  WhatsApp 99 19 28 29
</a>
```

- [ ] **Step 2: Add mobile sticky CSS**

```css
.mobile-sticky-wa{display:none}
@media(max-width:680px){
  body.has-sticky-wa{padding-bottom:78px}
  .mobile-sticky-wa{
    position:fixed;
    left:14px;
    right:14px;
    bottom:14px;
    z-index:120;
    min-height:52px;
    border-radius:14px;
    background:#25D366;
    color:#fff;
    display:flex;
    align-items:center;
    justify-content:center;
    font-weight:800;
    box-shadow:0 14px 34px rgba(37,211,102,.32);
    transform:translateY(90px);
    opacity:0;
    pointer-events:none;
    transition:transform .22s ease,opacity .22s ease;
  }
  .mobile-sticky-wa.show{
    transform:translateY(0);
    opacity:1;
    pointer-events:auto;
  }
}
```

- [ ] **Step 3: Extend existing vanilla script**

Add scroll handling without interfering with the existing menu and reveal observer:

```js
var stickyWa=document.querySelector('.mobile-sticky-wa');
function syncStickyWa(){
  if(!stickyWa)return;
  var show=innerWidth<=680 && scrollY>520;
  stickyWa.classList.toggle('show',show);
  document.body.classList.toggle('has-sticky-wa',show);
}
addEventListener('scroll',syncStickyWa,{passive:true});
addEventListener('resize',syncStickyWa);
syncStickyWa();
```

- [ ] **Step 4: Harden menu accessibility**

Set `aria-expanded` on the burger and toggle it in the click handler:

```html
<button class="burger" id="burger" aria-label="Menu" aria-expanded="false">
```

```js
burger.addEventListener('click',function(){
  var open=!mm.classList.contains('open');
  mm.classList.toggle('open',open);
  burger.setAttribute('aria-expanded',String(open));
});
mm.querySelectorAll('a').forEach(function(a){
  a.addEventListener('click',function(){
    mm.classList.remove('open');
    burger.setAttribute('aria-expanded','false');
  });
});
```

- [ ] **Step 5: Run sticky and menu tests**

```bash
BASE_URL=http://localhost:3001 npx playwright test e2e/pages-public-homepage-mobile.spec.ts --project=chromium --grep "sticky WhatsApp|menu hamburger"
```

Expected: PASS.

- [ ] **Step 6: Commit sticky/navigation implementation**

```bash
git add Nexus_Reussite_Accueil.html
git commit -m "feat: add mobile WhatsApp sticky CTA"
```

## Chunk 4: Responsive Polish And Verification

### Task 4: Verify layout quality across mobile devices

**Files:**
- Modify only if verification finds issues: `Nexus_Reussite_Accueil.html`

- [ ] **Step 1: Run full homepage mobile spec**

```bash
BASE_URL=http://localhost:3001 npx playwright test e2e/pages-public-homepage-mobile.spec.ts --project=chromium
```

Expected: PASS or only failures for tests proven obsolete and updated in Task 1.

- [ ] **Step 2: Run public mobile responsiveness spec**

```bash
BASE_URL=http://localhost:3001 npx playwright test e2e/mobile-responsiveness.spec.ts --project=chromium
```

Expected: PASS for `/` and no horizontal overflow.

- [ ] **Step 3: Capture visual proof**

Use Playwright screenshots for:

```bash
node /tmp/nexus-mobile-screenshots.js
```

Script behavior:

- Open `http://localhost:3001/`.
- Capture `/tmp/nexus-mobile-320.png` at 320x568.
- Capture `/tmp/nexus-mobile-390.png` at 390x844.
- Capture `/tmp/nexus-mobile-430.png` at 430x932.
- Log `scrollWidth`, `innerWidth`, hero CTA position, and sticky CTA state.

- [ ] **Step 4: Fix any visual issues**

If screenshots show overlap, text clipping, or CTA below the first screen on 390 px, adjust only mobile CSS in `Nexus_Reussite_Accueil.html`.

- [ ] **Step 5: Run build**

```bash
npm run build
```

Expected: Next.js build succeeds and includes `Nexus_Reussite_Accueil.html`.

- [ ] **Step 6: Commit verification fixes**

```bash
git add Nexus_Reussite_Accueil.html e2e/pages-public-homepage-mobile.spec.ts e2e/pages-public-homepage.spec.ts
git commit -m "fix: polish mobile homepage responsiveness"
```

Skip this commit if no files changed since the previous commits.

## Chunk 5: Production Deployment

### Task 5: Deploy the mobile homepage to `nexusreussite.academy`

**Files:**
- Deploy: `Nexus_Reussite_Accueil.html`
- Deploy if changed: `e2e/pages-public-homepage-mobile.spec.ts`, `e2e/pages-public-homepage.spec.ts`
- Do not deploy unrelated dirty files.

- [ ] **Step 1: Check remote state**

```bash
ssh root@<PROD_HOST> 'cd <APP_DIR> && git status --short && pm2 list | grep <PROCESS_NAME>'
```

Expected: remote has `<PROCESS_NAME>` online. Note unrelated dirty files and do not overwrite them.

- [ ] **Step 2: Backup remote homepage source**

```bash
ssh root@<PROD_HOST> 'cd <APP_DIR> && cp Nexus_Reussite_Accueil.html Nexus_Reussite_Accueil.html.bak-20260607-mobile'
```

- [ ] **Step 3: Copy only changed homepage/test files**

```bash
rsync -av Nexus_Reussite_Accueil.html root@<PROD_HOST>:<APP_DIR>/Nexus_Reussite_Accueil.html
rsync -av e2e/pages-public-homepage-mobile.spec.ts root@<PROD_HOST>:<APP_DIR>/e2e/pages-public-homepage-mobile.spec.ts
rsync -av e2e/pages-public-homepage.spec.ts root@<PROD_HOST>:<APP_DIR>/e2e/pages-public-homepage.spec.ts
```

- [ ] **Step 4: Build on remote**

```bash
ssh root@<PROD_HOST> 'cd <APP_DIR> && npm run build'
```

Expected: build succeeds.

- [ ] **Step 5: Restart production process**

```bash
ssh root@<PROD_HOST> 'pm2 restart <PROCESS_NAME> && pm2 save'
```

- [ ] **Step 6: Verify production mobile**

Run local Playwright against production:

```bash
BASE_URL=https://nexusreussite.academy npx playwright test e2e/pages-public-homepage-mobile.spec.ts --project=chromium --grep "candidat libre|CTA WhatsApp hero|preuves rapides|sticky WhatsApp"
```

Expected: PASS.

- [ ] **Step 7: Production smoke check**

```bash
curl -I -L --max-time 15 https://nexusreussite.academy
```

Expected: HTTP 200, Next.js response, no Nginx error.
