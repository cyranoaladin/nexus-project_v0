# Câblage navbar et découvrabilité publique réelle de la campagne Pré-rentrée 2026

Date : 2026-07-28/29
Périmètre : tous les chemins publics vers `/stages/pre-rentree-2026`.

## Le câblage navbar n'était pas un oubli

`5ab7df3cd` (13/07, sur `main`) a ajouté une entrée « Pré-rentrée 2026 » dans `CorporateNavbar.tsx` — indépendamment de la branche `release/pre-rentree-2026-final-rc` (implémentation différente : tracking analytics, texte différent). `d67b3de37` (« fix(release): close campaign leaks before owner go », 23/07, confirmé ancêtre de `main` via `git merge-base --is-ancestor d67b3de37 origin/main`) l'a retirée **délibérément**, et a ajouté le test qui verrouille cette absence :

```
__tests__/components/corporate-navbar.test.tsx
  it('does not expose the gated Pré-rentrée campaign from permanent navigation', ...)
```

Ce test passe toujours aujourd'hui, inchangé. Le feu vert du 26/07 (`releaseStatus: PUBLIC_READY`) n'a pas rouvert cette question spécifique — le verrou est resté fermé par défaut, pas parce qu'il a été réévalué et confirmé.

**Câblage RC (`ea2b26eb8`/`6e54c6c9f`) testé ?** Non — les deux commits ne touchent que `components/layout/CorporateNavbar.tsx` et `app/sitemap.ts` (2 fichiers, +7 puis +32/-14 lignes), aucun fichier de test.

## Solution livrée : une seule source de vérité

Le premier essai (`SHOW_PRE_RENTREE_IN_PERMANENT_NAV` dans `lib/campaigns/pre-rentree-2026/navigation.ts`) introduisait un second mécanisme de contrôle, à côté de `getPreRentreeReleaseGate()` (déjà utilisé par `public-surface.ts`, `sitemap.ts`, et tous les autres chemins de découvrabilité listés ci-dessous). Corrigé : la fonction vit maintenant dans `lib/campaigns/pre-rentree-2026/release-gate.ts`, à côté de `canPrefillBilanGratuitFromPreRentree()` (même idiome déjà établi dans ce fichier pour une porte volontairement indépendante de `isPublicReady`) :

```ts
export function canShowPreRentreeInPermanentNav(): boolean {
  return false; // owner decision, 2026-07-23 (d67b3de37), jamais rouverte depuis le 26/07
}
```

Correction annexe : la première version hardcodait `'17–28 août · Mutuelleville'` dans le composant — capturée par `scripts/pre-rentree/final-public-release-audit.mjs` (`copied-business-fact`, regex `/\b(?:17|28|10)\s+août\b/i`), le garde-fou anti-duplication de faits commerciaux hors de la source canonique. `CorporateNavbar` n'a aucune plomberie serveur (rendu de manière autonome depuis 25+ pages, sans props) — remplacé par un texte générique (« Stage intensif de rentrée », repris de l'implémentation `5ab7df3cd` elle-même), cohérent avec les autres entrées du même menu (« Toutes les vacances », etc.), sans réinventer cette plomberie pour un bascule actuellement désactivée par défaut.

Branche : `prepared/pre-rentree-navbar-entry` (poussée, non fusionnée, non déployée, aucune PR ouverte). 49 suites / 339 tests de la campagne + les 2 fichiers de test navbar passent. Activer = changer `return false` en `return true` dans `release-gate.ts`.

## Inventaire complet — tous les chemins publics vers la campagne

| Chemin | Visible aujourd'hui | Critère qui gouverne | Source |
|---|---|---|---|
| Navbar permanente (desktop + mobile) | **NON** | `canShowPreRentreeInPermanentNav()` — codé en dur `false`, indépendant de `isPublicReady` | `release-gate.ts` (nouveau, sur `prepared/pre-rentree-navbar-entry`) |
| Calendrier générique `/stages` | **OUI** | `getPreRentreeReleaseGate().isPublicReady` (via `getPreRentreePublicSurfaceDTO()` dans `app/stages/page.tsx`) | vérifié par exécution réelle : `releaseStatus: PUBLIC_READY`, `unmetGateIds: []` → `isPublicReady: true` |
| Bannière d'accueil (`PreRentreeCampaignSpotlight`) | **OUI** | `getPreRentreeHomepageSpotlightDTO()` → même `getPreRentreePublicSurfaceDTO()`, même gate | `lib/campaigns/pre-rentree-2026/getters.ts:183-186` |
| Footer (`CorporateFooter.tsx`) | **NON** | Aucun lien, ni gardé ni codé en dur — absence structurelle, pas une décision de gate | grep vide |
| `sitemap.ts` | **OUI** | Double condition : `isPublicReady` **ET** `publication.indexable` (= `campaign.status !== 'DRAFT'`) | `campaign.status = "PUBLIC_INFORMATIONAL"` dans `data/campaigns/pre-rentree-2026.json` → `indexable: true` |
| `robots.ts` | Non bloquant | Règles génériques (`/dashboard/`, `/api/`, `/auth/`, `/session/`, `/test/`) — aucune entrée spécifique à la campagne | `app/robots.ts` |
| Page dédiée `/stages/pre-rentree-2026` | **OUI, toujours** | Route réelle, jamais gardée — c'est la destination, pas un point de découverte | `app/stages/pre-rentree-2026/page.tsx` |
| Raccourci `/pre-rentree` | **OUI, toujours** | `permanentRedirect('/stages/pre-rentree-2026')` inconditionnel (301) | `app/pre-rentree/page.tsx` |
| Pages de préparation (`PREPARATION_LINKS`) | **NON** | Aucune référence à la campagne | grep vide sur `content/marketing/preparation-links.ts` |

## La contradiction n'en était pas une

« `/stages` masque la campagne tant que `isPublicReady` est faux » (A0.7) et « `d67b3de37` filtre le calendrier générique de `/stages` » (23/07) décrivent le **même mécanisme à deux instants différents** : le filtre de `d67b3de37` excluait la campagne parce qu'`isPublicReady` était faux au moment où ce commit a été écrit. Depuis le feu vert du 26/07, `isPublicReady` est vrai (confirmé par exécution : `releaseStatus: PUBLIC_READY`, `unmetGateIds: []`) — le même code, aujourd'hui, n'exclut plus rien. Aucun changement de code entre les deux constats : un changement d'état.

**Lecture d'ensemble pour le propriétaire** : un parent peut aujourd'hui atteindre la campagne via le calendrier `/stages`, la bannière d'accueil, un lien direct ou moteur de recherche (indexée) — mais pas via le menu permanent, ni le footer. Activer la navbar est un changement d'un booléen dans `release-gate.ts`, déjà préparé et testé.
