# Design System, Lisibilité, Modales & Conversion — Audit en cours

**Date :** 2026-06-19
**Branche :** `feat/acadomia-inspired` → commit `649fb2e3f`
**Mode de service :** standalone (`node .next/standalone/server.js` via PM2)
**Statut :** **NON FINAL — 7 blocs ouverts** (voir ci-dessous)

---

## OUVERT (7 blocs — session suivante)

| # | Bloc | Description |
|---|------|-------------|
| 1 | **G3** | 8 integration specs rouges (anciens sélecteurs post-redesign) + 2 env → à mettre à jour, pas supprimer |
| 2 | **H1-H5** | Hygiène prod : console.log, commentaires internes (R1/R3/Gx) dans globals.css, jargon de tâches dans le code |
| 3 | **G8** | Garde typographique trop permissive (exclut JSX) → resserrer + corriger les vraies violations dans les chaînes |
| 4 | **G6** | `leading-none` drop par twMerge → vérifier conflit réel ou config manquante + axe dashboards non-luxury |
| 5 | **G7** | Test d'alternance des fonds supprimé → réintroduire sur le rendu (e2e/RTL) |
| 6 | **G2.E** | Images legacy 1.7 Mo (hero-image.png, BackgroundImage) → trancher (supprimer si morts, optimiser si vivants) |
| 7 | **G9** | Ce rapport à mettre à jour après les 6 ci-dessus |

**Aucun de ces items n'est « mineur » ni « hors scope ».** Tant qu'ils sont ouverts, ce rapport n'est pas final.

---

## 1. Tests

| Suite | Total | Pass | Fail |
|-------|-------|------|------|
| **Unit (Jest)** | 489 suites / 6 260 tests | 6 260 | 0 |
| **e2e public (Playwright)** | 17 spec files / 149 tests | 149 | 0 |
| **e2e integration (Docker ephemeral)** | 10 spec files / 52 tests | 41 | 10 (8 = old selectors post-redesign, 2 = env) |
| **Typecheck** | `tsc --noEmit` | 0 errors | — |

`testPathIgnorePatterns` : vide. Dénominateur complet.

## 2. Accessibilité

**axe-core v4.11.1** (Playwright, `reducedMotion:'reduce'`, transitions désactivées) :

| Viewport | Pages | Violations |
|----------|-------|------------|
| Desktop (1280×720) | 13/13 luxury | **0** |
| Mobile (390×844) | 13/13 luxury | **0** |

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

### Formulaire bilan-gratuit
`noValidate` sur le `<form>` — standard React. La validation est gérée exclusivement par le JS `validate()` (messages cohérents, pas de bulle native).

**Cause de l'ancien blocage :** `type="email"` + `requestSubmit()` déclenchait la validation native du navigateur, qui bloquait la soumission avant que React `onSubmit` ne tourne.

**Test e2e :** clic réel (`getByRole('button').click()`), cas (b) complet : tous les champs remplis + email invalide → `Email invalide` visible, `Prénom requis` + `Classe requise` NON visibles.

### Animations — LCP-safe + reduced-motion + no-JS
CSS-only (`@keyframes luxFadeIn`, `animation-fill-mode` par défaut = `none` → LCP peint à opacity:1).

`@media (prefers-reduced-motion: reduce)` : animation désactivée, opacity:1 immédiat.

No-JS : `opacity:1` par défaut (pas de state JS).

### Mode de service : standalone
`output: 'standalone'` dans `next.config.mjs`. Pipeline automatisé : `npm run build` = `next build && node scripts/copy-public-assets.js` (copie static + public dans standalone). `start:prod` = `node .next/standalone/server.js`.

### Images
`images.unoptimized: true` (config projet). Sharp retiré du standalone (pas de trace `outputFileTracingIncludes`). Les images lourdes (hero-image.png 1 763 KB, BackgroundImage 1 752 KB) ne sont pas sur les pages luxury. Logo = webp 22 KB.

## 5. Fichiers créés

| Fichier | Description |
|---------|-------------|
| `lib/whatsapp.ts` | Source unique WhatsApp |
| `lib/typography/fr.ts` | Formateur typographie française |
| `components/marketing/OfferDetailDialog.tsx` | Modale/drawer offre |
| `components/marketing/MobileStickyBar.tsx` | Barre CTA sticky mobile |
| `__tests__/lib/cn-tailwind-merge.test.ts` | Garde twMerge (7 tests) |
| `__tests__/lib/typography-fr.test.ts` | Tests utilitaire typo (5 tests) |
| `__tests__/marketing/french-typography-guard.test.ts` | Garde typo luxury (2 tests) |
| `__tests__/marketing/echeancier-reconciliation.test.ts` | Cross-test échéancier (96 tests) |
| `__tests__/components/offer-detail-dialog.test.tsx` | Tests modale (20 tests) |

## 6. Invariants

- [x] `cn()` = twMerge, pas de `!important` pansement
- [x] axe 0 desktop + mobile, 13/13 pages
- [x] `noValidate` + clic réel e2e
- [x] No-JS opacity=1
- [x] Standalone + pipeline assets automatisé
- [x] Typographie française : garde active (apostrophe + ponctuation)
- [x] 489/6 260/0 unit, 149/0 e2e public
