# Triage smoke Playwright public Lot 0-bis

Date locale : 2026-07-02 18:20 CET  
Branche : `feat/lot4-accessors-runtime`  
Commit court : `db8545a19`

## Commandes et résultats

| Statut | Objectif | Commande exacte | Résultat observé |
| --- | --- | --- | --- |
| ÉCHEC | Reproduire l'état Lot 0 | `npx playwright test e2e/pages-public-homepage.spec.ts e2e/pages-public-offres.spec.ts e2e/pages-public-bilan-gratuit.spec.ts --project=chromium` | 18 passés, 4 échoués. |
| OK | Vérifier l'hydratation réelle | Script Playwright local sur `http://127.0.0.1:3002/bilan-gratuit` | 404 sur de nombreux chunks `_next/static`, aucune erreur formulaire après clic. |
| OK | Aligner le build avec CI/Docker | `source /home/alaeddine/.nvm/nvm.sh && nvm use 20.20.0 >/dev/null && npm run build` | Build Next OK, 143 pages générées. |
| OK | Rejouer le smoke sur build propre Node 20 | `source /home/alaeddine/.nvm/nvm.sh && nvm use 20.20.0 >/dev/null && npx playwright test e2e/pages-public-homepage.spec.ts e2e/pages-public-offres.spec.ts e2e/pages-public-bilan-gratuit.spec.ts --project=chromium` | 24 passés, 0 échoué. |

Note : le serveur Playwright a loggé un warning Prisma `P2021` sur `business_configs` absent dans la base e2e locale. Le warning n'a pas fait échouer le smoke public, mais reste à traiter avec la baseline DB e2e.

## Échec Playwright public — validation vide bilan gratuit

- Spec : `e2e/pages-public-bilan-gratuit.spec.ts`
- Page : `/bilan-gratuit`
- Attendu : `Prénom requis`, `Email invalide`, `Classe requise`.
- Observé : aucun message affiché sur le serveur déjà présent en port `3002`.
- Cause probable : serveur standalone ancien réutilisé par Playwright ; HTML servi mais chunks `_next/static` 404, donc client React non hydraté.
- Test obsolète ? Non.
- Régression UX ? Non prouvée sur build propre ; régression de harness test.
- Correction retenue : `playwright.config.ts` ne réutilise plus un serveur existant par défaut et dérive `PORT`/`NEXTAUTH_URL` du `baseURL`.
- Fichiers modifiés : `playwright.config.ts`.
- Test de validation : smoke ciblé Node 20 vert, 24/24.

## Échec Playwright public — email invalide bilan gratuit

- Spec : `e2e/pages-public-bilan-gratuit.spec.ts`
- Page : `/bilan-gratuit`
- Attendu : `Email invalide`.
- Observé : aucun message affiché sur serveur stale.
- Cause probable : même défaut d'hydratation causé par chunks 404.
- Test obsolète ? Non.
- Régression UX ? Non sur build propre.
- Correction retenue : revalidation sur serveur Playwright propre ; test conservé.
- Fichiers modifiés : `playwright.config.ts`.
- Test de validation : smoke ciblé Node 20 vert, 24/24.

## Échec Playwright public — disparition erreur email

- Spec : `e2e/pages-public-bilan-gratuit.spec.ts`
- Page : `/bilan-gratuit`
- Attendu : `Email invalide` visible après soumission vide puis disparition après saisie valide.
- Observé : erreur jamais affichée sur serveur stale.
- Cause probable : même défaut d'hydratation causé par chunks 404.
- Test obsolète ? Non.
- Régression UX ? Non sur build propre.
- Correction retenue : revalidation sur serveur Playwright propre ; test conservé.
- Fichiers modifiés : `playwright.config.ts`.
- Test de validation : smoke ciblé Node 20 vert, 24/24.

## Échec Playwright public — compteur WhatsApp homepage

- Spec : `e2e/pages-public-homepage.spec.ts`
- Page : `/`
- Attendu Lot 0 : exactement 2 liens WhatsApp au chargement, puis 4 dans le DOM après scroll.
- Observé Lot 0 : 3 liens au chargement sur serveur stale ; build propre : 2 liens possibles au chargement, liens flottants rendus selon scroll/viewport.
- Cause probable : test trop couplé à un nombre exact de liens alors que l'UX officielle comporte hero/footer/contact direct et liens flottants conditionnels.
- Test obsolète ? Oui pour le comptage exact.
- Régression UX ? Non : les liens visibles ont un `href` WhatsApp canonique et un nom accessible.
- Correction retenue : remplacer le comptage exact par un contrôle snapshot DOM : au moins 2 liens au chargement, `href` `wa.me/21699192829`, nom accessible, liens visibles desktop et mobile après scroll.
- Fichiers modifiés : `e2e/pages-public-homepage.spec.ts`.
- Test de validation : smoke ciblé Node 20 vert, 24/24.

## Décisions QA associées

- Les tests `/bilan-gratuit` restent des tests produit valides.
- Le test WhatsApp a été requalifié comme obsolète dans sa forme exacte, pas comme régression UX.
- Le smoke public ciblé doit être lancé sur un serveur Playwright propre, sauf opt-in explicite `PLAYWRIGHT_REUSE_EXISTING_SERVER=true`.
- Le smoke vérifie maintenant aussi que GA n'est pas chargé dans le HTML initial sans opt-in explicite et que ClicToPay n'est pas exposé publiquement tant que l'intégration publique n'est pas activée.
