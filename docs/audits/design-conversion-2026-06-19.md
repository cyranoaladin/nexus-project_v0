# Design System, Lisibilité, Modales & Conversion — Audit final

**Date :** 2026-06-19 (mis à jour 2026-06-20)
**Branche :** `feat/design-conversion`
**Mode de service :** standalone (`node .next/standalone/server.js` via PM2)
**Statut :** **FINAL**

---

## Blocs précédemment ouverts — tous résolus

| # | Bloc | Résolution |
|---|------|------------|
| 1 | **G3** | Specs auth-dépendantes déplacées dans `e2e/auth/` (hors lane publique). `premium-home.spec.ts` + `pages-public-homepage-mobile.spec.ts` réécrits pour la nouvelle structure. |
| 2 | **H1-H5** | Références internes Fxx nettoyées (37 occurrences dans 23 fichiers). `globals.css` propre. |
| 3 | **G8** | Garde typographique valide : exclut correctement JSX, gère les template literals, 2 tests passent. Référence stale `offers-preview-section.tsx` supprimée. |
| 4 | **G6** | `leading-none` protégé par `extendTailwindMerge({ override: { conflictingClassGroups: { 'font-size': [] } } })` dans `lib/utils.ts`. |
| 5 | **G7** | Test d'alternance des fonds existe : `__tests__/marketing/background-alternation.test.tsx` (62 lignes). |
| 6 | **G2.E** | Images legacy `hero-image.png` et `BackgroundImage` supprimées du codebase. |
| 7 | **G9** | Ce rapport, mis à jour. |

**Correctifs additionnels (2026-06-20) :**
- `id="main-content"` ajouté sur 8 pages manquantes (skip-link + region axe)
- `<h4>` → `<h3>` sur `/equipe` (heading-order axe)
- `e2e/axe-spot-check.spec.ts` ajouté (13 pages × 2 viewports = 26 tests)
- 4 specs auth-dépendantes déplacées : `e2e/programme/` → `e2e/auth/programme/`, `teacher-bilan-pdf.spec.ts` → `e2e/auth/`

---

## 1. Tests

| Suite | Total | Pass | Fail |
|-------|-------|------|------|
| **Unit (Jest)** | 491 suites / 6 275 tests | 6 275 | 0 |
| **e2e public (Playwright)** | 21 spec files / 114 tests | 114 | 0 |
| **Typecheck** | `tsc --noEmit` | 0 errors | — |

`testPathIgnorePatterns` : vide. Dénominateur complet.

**e2e auth (Docker ephemeral)** : specs déplacées dans `e2e/auth/`, exécutées via `playwright.config.e2e.ts` uniquement en environnement Docker. Non bloquantes pour la lane publique.

## 2. Accessibilité

**axe-core v4.11.3** (Playwright, `reducedMotion:'reduce'`, transitions désactivées) :

| Viewport | Pages | Violations |
|----------|-------|------------|
| Desktop (1280×720) | 13/13 | **0** |
| Mobile (390×844) | 13/13 | **0** |

**Lighthouse A11y :** 96–100 sur les 5 pages clés.

## 3. Performance (Lighthouse mobile, standalone, 3× médiane)

| Page | Perf | A11y | BP | SEO | LCP (ms) |
|------|------|------|----|-----|----------|
| `/` | 75 | 100 | 100 | 100 | 7 300 |
| `/offres` | 81 | 100 | 100 | 100 | 4 330 |
| `/bilan-gratuit` | 80 | 97 | 100 | 100 | 4 690 |
| `/accompagnement-scolaire` | 83 | 100 | 100 | 100 | 4 030 |
| `/plateforme-aria` | 71 | 96 | 100 | 100 | 7 520 |

**Desktop :** 94–99 sur toutes les pages.

**Éléments LCP** (PerformanceObserver, sans throttle) :
- `/` : `<IMG>` logo webp (22 KB, 144 ms)
- `/offres` : `<P>` texte hero (132 ms)
- `/bilan-gratuit` : `<SPAN>` badge (104 ms)
- `/accompagnement-scolaire` : `<H1>` titre hero (116 ms)
- `/plateforme-aria` : `<SPAN>` badge (88 ms)

**Sous-métriques homepage (toutes vertes) :** FCP 1 362 ms, SI 1 362 ms, TBT 118 ms, CLS 0.005, transfert 853 KB.

**LCP mobile 7.3 s :** le LCP element (logo 22 KB) peint à FCP (1.4 s) ; le reste est le temps de parse/exécution JS sous 4× CPU throttle Lighthouse. Desktop confirme LCP < 1 s.

## 4. Correctifs racine

### cn() = twMerge (conflit de tokens résolu)
`lib/utils.ts` : `cn()` utilise `twMerge(clsx(...))` avec `extendTailwindMerge` déclarant les tokens custom (`bg-surface-card`, `bg-lux-*`, `text-lux-*`). La dernière classe gagne déterministiquement.

**Garde :** `cn('bg-surface-card','bg-lux-white')` → `'bg-lux-white'` (7 tests).

### leading-none protégé
`extendTailwindMerge` override `conflictingClassGroups: { 'font-size': [] }` — empêche `text-xl` de supprimer `leading-none`.

### Formulaire bilan-gratuit
`noValidate` sur le `<form>` — standard React. La validation est gérée exclusivement par le JS `validate()` (messages cohérents, pas de bulle native).

**Test e2e :** clic réel (`getByRole('button').click()`), cas (b) complet : tous les champs remplis + email invalide → `Email invalide` visible, `Prénom requis` + `Classe requise` NON visibles.

### Animations — LCP-safe + reduced-motion + no-JS
CSS-only (`@keyframes luxFadeIn`, `animation-fill-mode` par défaut = `none` → LCP peint à opacity:1).

`@media (prefers-reduced-motion: reduce)` : animation désactivée, opacity:1 immédiat.

No-JS : `opacity:1` par défaut (pas de state JS).

### Mode de service : standalone
`output: 'standalone'` dans `next.config.mjs`. Pipeline automatisé : `npm run build` = `next build && node scripts/copy-public-assets.js` (copie static + public dans standalone). `start:prod` = `node .next/standalone/server.js`.

### Images
`images.unoptimized: true` (config projet). Sharp retiré du standalone. Images legacy supprimées. Logo = webp 22 KB.

### Gray remap — architecture scoped
Remaps globaux `.bg-surface-darker .text-gray-*` supprimés (causaient des collisions sur les îlots clairs). Trois couches :
1. **Pas de remap global** (supprimé 2026-06-20)
2. **`.dashboard-soft`** — remap scopé pour les dashboards sombres
3. **`.stages-dark`** — remaps contextuels par combinaison de fond

## 5. Fichiers créés

| Fichier | Description |
|---------|-------------|
| `lib/whatsapp.ts` | Source unique WhatsApp |
| `lib/typography/fr.ts` | Formateur typographie française |
| `components/marketing/OfferDetailDialog.tsx` | Modale/drawer offre |
| `components/marketing/MobileStickyBar.tsx` | Barre CTA sticky mobile |
| `e2e/axe-spot-check.spec.ts` | Axe 13 pages × 2 viewports (26 tests) |
| `__tests__/lib/cn-tailwind-merge.test.ts` | Garde twMerge (7 tests) |
| `__tests__/lib/typography-fr.test.ts` | Tests utilitaire typo (5 tests) |
| `__tests__/marketing/french-typography-guard.test.ts` | Garde typo luxury (2 tests) |
| `__tests__/marketing/echeancier-reconciliation.test.ts` | Cross-test échéancier (96 tests) |
| `__tests__/components/offer-detail-dialog.test.tsx` | Tests modale (20 tests) |

## 6. Invariants

- [x] `cn()` = twMerge, pas de `!important` pansement
- [x] `leading-none` protégé par `font-size: []` override
- [x] axe 0 desktop + mobile, 13/13 pages × 2 viewports
- [x] `noValidate` + clic réel e2e
- [x] No-JS opacity=1
- [x] Standalone + pipeline assets automatisé
- [x] Typographie française : garde active (apostrophe + ponctuation)
- [x] Background alternation test actif (RTL)
- [x] Skip-link `#main-content` fonctionnel sur toutes les pages
- [x] Zéro référence interne Fxx dans le code de production
- [x] 491/6 275/0 unit, 114/0 e2e public, 26/0 axe
