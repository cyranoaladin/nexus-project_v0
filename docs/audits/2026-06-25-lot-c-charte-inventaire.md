# Inventaire Lot C — Charte `lux-*` sur surfaces publiques indexées

**Date :** 2026-06-25
**Baseline :** `main` @ `7b75b74fa`
**Méthode :** `grep surface-darker|brand-accent` sur `app/` + `components/` + `lib/`, puis classification manuelle route par route.

## Périmètre : surfaces publiques indexées uniquement

Le thème sombre legacy (`surface-darker`/`brand-accent`) apparaît dans **150 fichiers** au total.
La quasi-totalité est dans des surfaces privées authentifiées (dashboards, EAM, bilans élève, sessions) — **hors Lot C**.

---

## Composants orphelins à supprimer (PR hygiène préalable)

13 fichiers orphelins confirmés (grep direct + barrel + dynamic import + test + component name) :

| Fichier | Export | Statut |
|---|---|---|
| `contact-section.tsx` | `ContactSection` | ORPHELIN |
| `cta-section.tsx` | `CTASection` | ORPHELIN |
| `detailed-services.tsx` | `DetailedServices` | ORPHELIN |
| `dna-section-gsap.tsx` | `DNASectionGSAP` | ORPHELIN |
| `how-it-works-section.tsx` | `HowItWorksSection` | ORPHELIN |
| `impact-section.tsx` | `ImpactSection` | ORPHELIN |
| `korrigo-features.tsx` | `KorrigoFeatures` | ORPHELIN |
| `korrigo-section-gsap.tsx` | `KorrigoSectionGSAP` | ORPHELIN |
| `offer-section-gsap.tsx` | `OfferSection` | ORPHELIN |
| `pillars-grid.tsx` | `PillarsGrid` | ORPHELIN |
| `pillars-section.tsx` | `PillarsSection` | ORPHELIN |
| `proof-section-gsap.tsx` | `ProofSectionGSAP` | ORPHELIN |

**Note :** `cta-section.tsx` et `pillars-section.tsx` ont des tests associés (`__tests__/components/sections/cta-section.test.tsx`, `__tests__/components/sections/pillars-section.test.tsx`) — supprimer les paires.

**Action :** supprimer les 12 fichiers sections + `components/ui/input-validated.tsx` (0 imports, pas de test, UI primitive remplacée par `components/ui/input.tsx`) + les 2 tests associés = **15 fichiers** dans une PR hygiène dédiée.

**`components/navigation/UserProfile.tsx`** : **NON orphelin** — importé par `MobileMenu.tsx` et `Sidebar.tsx`. Conservé. Le token `brand-accent` qu'il contient est dans un composant de navigation privé (sidebar dashboard) — hors périmètre Lot C.

---

## Fichiers publics indexés à migrer

### Groupe 1 — Chrome partagée (conditionne toutes les pages)

| Fichier | Occurrences | Tokens |
|---|---|---|
| `app/layout.tsx` (L132) | 2 | `bg-surface-darker`, `selection:bg-brand-accent/30` |
| `components/layout/CorporateNavbar.tsx` (L138, 274, 331) | 3 | `bg-surface-darker/88`, `bg-surface-darker/95` ×2 |
| `components/layout/CorporateFooter.tsx` (L34) | 1 | `bg-surface-darker` |
| `app/globals.css` | ~25 | Variables CSS, descendants selectors, GSAP aliases |

**Total groupe 1 :** 4 fichiers, ~31 occurrences.
**Note :** `globals.css` contient les définitions CSS des tokens — les variables restent (GSAP/dashboard privé les utilisent) mais les sélecteurs descendants liés aux surfaces publiques doivent pointer sur `lux-*`.

### Groupe 2 — Home

| Fichier | Occurrences | Tokens |
|---|---|---|
| `app/page.tsx` | 0 | Propre (server, metadata only) |
| `app/HomePageClient.tsx` | 0 | Propre (utilise déjà `lux-*`) |

**Home est déjà migrée.** Aucune action requise. (Les sections montées — HeroSection, MethodSection, etc. — sont dans `components/premium/` et utilisent `lux-*`.)

### Groupe 3 — `/famille`

| Fichier | Occurrences | Tokens |
|---|---|---|
| `app/famille/page.tsx` | ~25 | `bg-surface-darker` ×6, `text-brand-accent` ×9, `border-brand-accent/*` ×5, `bg-brand-accent/*` ×3, `hover:border-brand-accent/*` ×2 |

**Total groupe 3 :** 1 fichier, ~25 occurrences. Page entièrement en thème sombre legacy.

### Groupe 4 — `/stages/[slug]` + inscription + composants

| Fichier | Occurrences | Tokens |
|---|---|---|
| `app/stages/[stageSlug]/page.tsx` | ~20 | `bg-surface-darker` ×8, `text-brand-accent` ×5, `border-brand-accent/*` ×2, `bg-brand-accent/*` ×2, `text-surface-darker` ×1 |
| `app/stages/[stageSlug]/inscription/page.tsx` | ~4 | `bg-surface-darker` ×2, `text-brand-accent` ×1, `text-surface-darker` ×1 |
| `components/stages/StageInscriptionForm.tsx` | ~9 | `bg-surface-darker/60` ×2, `text-surface-darker` ×1, `border-brand-accent/*` ×2, `text-brand-accent` ×1, `focus:border-brand-accent/*` ×3 |
| `components/stages/PublicStageCard.tsx` | ~8 | `hover:border-brand-accent/*` ×1, `bg-brand-accent/*` ×2, `text-brand-accent` ×5 |

**Total groupe 4 :** 4 fichiers, ~41 occurrences.

### Groupe 5 — Légal

| Fichier | Occurrences | Tokens |
|---|---|---|
| `app/mentions-legales/page.tsx` | ~5 | `bg-surface-darker` ×1, `text-brand-accent` ×4 |
| `app/conditions-generales/page.tsx` | ~8 | `bg-surface-darker` ×1, `text-brand-accent` ×7 |

**Note :** `app/politique-confidentialite/page.tsx` est déjà propre (0 occurrence). Pas dans le lot.

**Total groupe 5 :** 2 fichiers, ~13 occurrences.

### Groupe 6 — Auth d'entrée

| Fichier | Occurrences | Tokens |
|---|---|---|
| `app/auth/signin/page.tsx` | 1 | `bg-surface-darker` |
| `app/auth/signin/SignInForm.tsx` | ~6 | `bg-brand-accent/*` ×1, `text-brand-accent` ×3, `text-brand-accent-dark` ×2 |
| `app/auth/activate/page.tsx` | ~12 | `bg-surface-darker` ×5, `text-brand-accent` ×4, `focus:border-brand-accent` ×2, `border-brand-accent/*` ×1 |
| `app/auth/reset-password/page.tsx` | ~9 | `bg-surface-darker` ×4, `text-brand-accent` ×2, `bg-brand-accent/*` ×1, `text-brand-accent-dark` ×1, spin ×1 |
| `app/auth/mot-de-passe-oublie/page.tsx` | ~7 | `bg-surface-darker` ×2, `text-brand-accent` ×1, `bg-brand-accent/*` ×2, `border-brand-accent/*` ×1, `text-brand-accent-dark` ×1 |
| `app/access-required/page.tsx` | ~4 | `bg-surface-darker` ×2, `text-brand-accent` ×1, `bg-brand-accent` ×1 |

**Total groupe 6 :** 6 fichiers, ~39 occurrences.

---

## Résumé chiffré

| Groupe | Fichiers | Occurrences | PR |
|---|---|---|---|
| 0. Hygiène (orphelins) | 14 (12 sections + 2 ui/nav) | N/A (suppression) | PR-0 |
| 1. Chrome partagée | 4 | ~31 | PR-1 |
| 2. Home | 0 | 0 | — (déjà migrée) |
| 3. `/famille` | 1 | ~25 | PR-3 |
| 4. `/stages` | 4 | ~41 | PR-4 |
| 5. Légal | 2 | ~13 | PR-5 |
| 6. Auth | 6 | ~39 | PR-6 |

**Total public à migrer : 17 fichiers, ~149 occurrences** (hors hygiène).
**Total orphelins à supprimer : 14 fichiers.**

---

## Fichiers publics HORS périmètre (noindex ou déjà propres)

| Route | Raison |
|---|---|
| `/offres` | Déjà `lux-*` (Lot B) |
| `/notre-centre` | A vérifier — probablement déjà `lux-*` |
| `/politique-confidentialite` | 0 occurrence legacy |
| `/bilan-gratuit/assessment` | `noindex` |
| `/bilan-gratuit/confirmation` | `noindex` |
| `/programme/maths-terminale` | `noindex` |
| `/programme/maths-1ere-stmg` | `noindex` |
| `/lamis` | `noindex` |
| Tous les `app/dashboard/**` | Privé, authentifié |
| `app/session/video` | Privé |
| `app/bilan-pallier2-maths/**` | Privé |

## Fichiers privés hors Lot C (pour mémoire)

~133 fichiers dans `app/dashboard/`, `components/dashboard/`, `components/EAMPrep/`,
`components/automatismes/`, `components/stage-eam-stmg/`, `components/nsi-pratique-2026/`,
`components/checkout/`, `components/ui/{progress,aria-widget}.tsx`.
Effort séparé post-launch.

## Configuration (`lib/utils.ts`, `app/globals.css`)

- `lib/utils.ts` L17 : `surface-darker` dans la config tailwind-merge (class groups) — **garder** tant que le privé utilise encore le token.
- `app/globals.css` : les variables CSS `--color-surface-darker`, `--color-brand-accent`, `--color-brand-accent-dark` + les aliases GSAP (`--nexus-cyan`) restent pour le privé. Les sélecteurs descendants `.bg-surface-darker h1…` et `.stages-dark` sont à évaluer : s'ils ne servent que le privé, les laisser ; s'ils affectent le public via `app/layout.tsx`, les migrer dans PR-1.

## Mapping de migration

| Token legacy | Token `lux-*` cible |
|---|---|
| `bg-surface-darker` | `bg-lux-ink` |
| `bg-surface-darker/88` | `bg-lux-ink/88` |
| `bg-surface-darker/95` | `bg-lux-ink/95` |
| `bg-surface-darker/60` | `bg-lux-ink/60` |
| `text-brand-accent` | `text-lux-gold` |
| `text-brand-accent-dark` | `text-lux-gold-wash` (ou `text-lux-gold/80`) |
| `border-brand-accent/*` | `border-lux-gold/*` |
| `bg-brand-accent/*` | `bg-lux-gold/*` |
| `hover:border-brand-accent/*` | `hover:border-lux-gold/*` |
| `focus:border-brand-accent/*` | `focus:border-lux-gold/*` |
| `selection:bg-brand-accent/30` | `selection:bg-lux-gold/30` |
| `text-surface-darker` | `text-lux-ink` |

---

## Table de couverture — toutes les routes publiques indexées

| Route | Page file | Statut | PR |
|---|---|---|---|
| `/` | `app/page.tsx` + `HomePageClient.tsx` | **LUX** (déjà migrée) | — |
| `/offres` | `app/offres/page.tsx` | **LUX** (Lot B) | — |
| `/notre-centre` | `app/notre-centre/page.tsx` | **LUX** (propre) | — |
| `/accompagnement-scolaire` | `app/accompagnement-scolaire/page.tsx` | **LUX** (propre) | — |
| `/plateforme-aria` | `app/plateforme-aria/page.tsx` | **LUX** (propre) | — |
| `/equipe` | `app/equipe/page.tsx` | **LUX** (propre) | — |
| `/contact` | `app/contact/page.tsx` | **LUX** (propre) | — |
| `/recommandation` | `app/recommandation/page.tsx` | **LUX** (propre) | — |
| `/bilan-gratuit` | `app/bilan-gratuit/page.tsx` | **LUX** (propre) | — |
| `/ressources` | `app/ressources/page.tsx` | **LUX** (propre) | — |
| `/maths-1ere` | `app/maths-1ere/page.tsx` | **LUX** (redirect) | — |
| `/preparation-bac-francais-tunis` | `app/preparation-bac-francais-tunis/page.tsx` | **LUX** (propre) | — |
| `/stages` | `app/stages/page.tsx` | **LUX** (propre) | — |
| `/politique-confidentialite` | `app/politique-confidentialite/page.tsx` | **LUX** (propre) | — |
| `/famille` | `app/famille/page.tsx` | **À MIGRER** (~25 occ.) | PR-3 |
| `/stages/[slug]` | `app/stages/[stageSlug]/page.tsx` | **À MIGRER** (~20 occ.) | PR-4 |
| `/stages/[slug]/inscription` | `app/stages/[stageSlug]/inscription/page.tsx` | **À MIGRER** (~4 occ.) | PR-4 |
| `/mentions-legales` | `app/mentions-legales/page.tsx` | **À MIGRER** (~5 occ.) | PR-5 |
| `/conditions-generales` | `app/conditions-generales/page.tsx` | **À MIGRER** (~8 occ.) | PR-5 |
| `/auth/signin` | `app/auth/signin/page.tsx` + `SignInForm.tsx` | **À MIGRER** (~7 occ.) | PR-6 |
| `/auth/activate` | `app/auth/activate/page.tsx` | **À MIGRER** (~12 occ.) | PR-6 |
| `/auth/reset-password` | `app/auth/reset-password/page.tsx` | **À MIGRER** (~9 occ.) | PR-6 |
| `/auth/mot-de-passe-oublie` | `app/auth/mot-de-passe-oublie/page.tsx` | **À MIGRER** (~7 occ.) | PR-6 |
| `/access-required` | `app/access-required/page.tsx` | **À MIGRER** (~4 occ.) | PR-6 |

**Chrome partagée (toutes pages) :**

| Composant | Statut | PR |
|---|---|---|
| `app/layout.tsx` | **À MIGRER** (2 occ.) | PR-1 |
| `CorporateNavbar.tsx` | **À MIGRER** (3 occ.) | PR-1 |
| `CorporateFooter.tsx` | **À MIGRER** (1 occ.) | PR-1 |
| `app/globals.css` | **À ÉVALUER** (vars+sélecteurs) | PR-1 |

**Composants publics :**

| Composant | Statut | PR |
|---|---|---|
| `components/stages/PublicStageCard.tsx` | **À MIGRER** (~8 occ.) | PR-4 |
| `components/stages/StageInscriptionForm.tsx` | **À MIGRER** (~9 occ.) | PR-4 |

**Résultat : 14/24 routes publiques déjà LUX, 10 routes + chrome à migrer.**
