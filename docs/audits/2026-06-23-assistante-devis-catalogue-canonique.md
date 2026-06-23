# Assistant devis — catalogue canonique

## Date

2026-06-23

## Contexte

La page interne `/dashboard/assistante/devis` utilisait un catalogue dérivé `data/offres-nexus.json` et un bloc statique de descriptions/inclusions dans `src/static-pages/assistante-devis-v3/app.js`.

## Problèmes observés

- Le devis assistante ne consommait pas directement `lib/pricing.ts`, contrairement à `/offres`.
- Le texte “Mixte 8 750 vs 7 900 TND” était affiché dans l'outil.
- Les stages, ponctuels, coachings, packs, programme spécial et urgences n'étaient pas exposés selon les familles du catalogue canonique.
- Le fichier dérivé `data/offres-nexus.json` et son générateur entretenaient une source concurrente.

## Décisions prises

- Créer `lib/assistante-devis-catalog.ts` comme loader serveur unique du catalogue devis, alimenté par `lib/pricing.ts`.
- Servir `/dashboard/assistante/devis/assets/catalogue-operationnel.json` depuis ce loader, sous garde `ADMIN`/`ASSISTANTE`.
- Supprimer l'usage et le fichier `data/offres-nexus.json`.
- Retirer le bloc `OFFER_META` et laisser le catalogue serveur fournir descriptions, inclusions, prix et échéanciers.
- Remplacer le texte tarif public legacy par une mention neutre de source opérationnelle.

## Fichiers modifiés

- `lib/assistante-devis-catalog.ts`
- `app/dashboard/assistante/devis/assets/[file]/route.ts`
- `src/static-pages/assistante-devis-v3/app.js`
- `src/static-pages/assistante-devis-v3/index.html`
- `playwright.auth.config.ts`
- `scripts/gate-all.sh`
- `next.config.mjs`
- `__tests__/assistante-devis-catalog.test.ts`
- `e2e/auth/assistante-devis-catalog.spec.ts`

## Tests exécutés

- `npm run typecheck`
- `npx jest --config jest.config.js __tests__/assistante-devis-catalog.test.ts --runInBand`
- `CI=1 BASE_URL=http://localhost:3002 npx playwright test --config=playwright.auth.config.ts e2e/auth/assistante-devis-catalog.spec.ts --reporter=line --repeat-each=3`
- Lane auth seule : `42 passed`
- `./scripts/gate-all.sh` : `6447` tests au total, `EXIT=0`
- `npm run lint`

## Résultats

- Le catalogue devis expose 48 entrées visibles issues du canonique.
- La spec auth vérifie le payload serveur et les options de l'iframe assistante.
- Le plancher auth passe de 40 à 42.
- Le plancher total passe à 6447.

## Risques restants

- Des documents historiques mentionnent encore des prix publics/campagne ; ils n'alimentent plus le runtime devis.
- `lib/quote/pdf.ts` conserve un champ optionnel `publicAnnual` pour compatibilité avec d'autres flux PDF, mais le devis assistante ne l'alimente plus.

## Rollback

Revenir au commit précédent restaure l'ancien catalogue dérivé et l'ancienne route JSON. Aucun changement de schéma DB n'a été réalisé.
