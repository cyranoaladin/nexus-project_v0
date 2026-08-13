# Fermeture du stage Printemps 2026 et garde d'expiration

## Date

13 août 2026

## Contexte

Le stage `printemps-2026`, terminé le 25 avril 2026, restait visible, ouvert à
l'inscription, présent dans le sitemap et accessible depuis deux pages publiques.
La correction doit conserver le stage et ses réservations, ne modifier aucun prix,
ne toucher ni à la campagne de pré-rentrée 2026 ni au chantier des bilans, et
empêcher la même situation pour toute campagne future.

## État initial en production

- Source de vérité d'exécution : ligne PostgreSQL du modèle Prisma `Stage`.
- Le seed ne sert qu'à initialiser les bases fraîches ; son `upsert` avec
  `update: {}` ne pouvait pas corriger la ligne de production existante.
- Stage ciblé : `printemps-2026`, du 21 au 25 avril 2026, 350 TND, capacité 12.
- Drapeaux avant intervention : `isVisible=true`, `isOpen=true`.
- Les pages `/stages/printemps-2026` et
  `/stages/printemps-2026/inscription` répondaient 200.
- Le sitemap dynamique publiait les deux URL.
- Le formulaire d'inscription était rendu et l'API POST n'appliquait aucun
  contrôle sur `endDate`.
- Deux réservations persistées étaient rattachées au stage, toutes deux au statut
  `COMPLETED`, créées et confirmées le 17 mai 2026. Les vérifications ont été
  conduites avec des données masquées. Leur rattachement à un compte technique
  rend leur origine commerciale non démontrée ; elles sont conservées dans tous
  les cas.
- Aucun autre stage expiré à la fois visible et ouvert n'a été trouvé dans
  l'inventaire de production. La campagne distincte de pré-rentrée 2026 n'a pas
  été modifiée.

## Cause racine

Les drapeaux manuels `isVisible` et `isOpen` constituaient les seules conditions
de publication et d'inscription. La date de fin n'était contrôlée ni dans les
lectures publiques, ni dans l'API d'inscription, ni dans le sitemap, ni lors de
la création ou de la réouverture administrative. Le seed recréait en outre le
stage historique avec les deux drapeaux à `true` sur une base fraîche.

## Décisions prises

- Un stage est expiré lorsque `endDate < now`. À l'instant exact de sa date de
  fin, il reste actif ; cette frontière est testée avec une horloge injectée.
- La fiche historique exacte `/stages/printemps-2026` renvoie un 301 vers
  `/stages`, afin d'orienter les visiteurs et les moteurs vers l'offre actuelle.
- L'URL d'inscription historique n'est pas redirigée : elle répond 404 avec des
  métadonnées `noindex, nofollow, nocache`. Un POST ne peut donc jamais être
  rejoué sur une autre route.
- Les listes, fiches et sitemap publics excluent les stages expirés, même si des
  drapeaux incohérents subsistent.
- L'API d'inscription exige atomiquement : visible, ouvert et non expiré.
- L'administration refuse la création ou la réouverture d'un stage expiré, tout
  en autorisant sa fermeture, sa conservation historique ou son prolongement
  avant réouverture. La mise à jour utilise une concurrence optimiste et renvoie
  409 si l'état lu a changé.
- Le seed conserve le stage et toutes ses données historiques, mais initialise et
  met désormais à jour ses drapeaux à `false`.

## Fermeture ciblée en production

La ligne `printemps-2026` a été mise à jour transactionnellement par son slug,
sans `DELETE` et sans mise à jour de `StageReservation`.

- Avant : `isVisible=true`, `isOpen=true`, 2 réservations `COMPLETED`.
- Après : `isVisible=false`, `isOpen=false`, 2 réservations `COMPLETED`.
- `updatedAt` observé après transaction : 13 août 2026 à 18:54:57.475 UTC.
- Après fermeture, l'API publique ne retourne plus ce stage et le sitemap ne
  contient plus son slug.
- Tant que le correctif applicatif n'est pas déployé, les deux pages répondent
  404. Après déploiement, la fiche bénéficiera du 301 prévu ; la page et l'API
  d'inscription conserveront leur refus explicite.

## Fichiers modifiés

- Règle de cycle de vie : `lib/stages/lifecycle.ts`.
- Lectures publiques et inscription : `lib/stages/public.ts`,
  `app/api/stages/[stageSlug]/inscrire/route.ts`.
- Administration : `app/api/admin/stages/route.ts`,
  `app/api/admin/stages/[stageId]/route.ts`.
- SEO et navigation : `app/sitemap.ts`, `next.config.mjs`,
  `app/stages/[stageSlug]/inscription/page.tsx`.
- Initialisation : `prisma/seed.ts`.
- Tests unitaires, contrats et E2E dédiés aux stages expirés.
- Documents de conception, plan d'implémentation et présent audit.

## Tests exécutés

- Suite unitaire complète avec environnement CI : 819 suites, 9 088 tests,
  0 échec.
- Intégration PostgreSQL jetable : 39 suites non-NPC vertes.
- Harness NPC officiel : 3 suites, 47 tests, 0 échec.
- Playwright sur pile Docker jetable : 2 scénarios, 0 échec, 0 skip.
- TypeScript : `tsc --noEmit`, succès.
- Cinq contrôles du job Lint : secrets/infrastructure, quarantaines/focus,
  valeurs codées en dur, ESLint et placement des archives, succès.
- Syntaxe E2E : succès sur 2 438 fichiers suivis.
- Audit npm des dépendances de production : 0 vulnérabilité.
- Build E2E dans un checkout temporaire propre hors du dépôt : compilation,
  validation des types et génération des 91 pages réussies ; traces sans
  référence externe ; artefact autonome sans fuite de données, avec moteurs
  Prisma et manifeste de release valides.

## Résultats

- L'offre obsolète n'est plus exposée en production.
- Les deux réservations et leur historique sont intacts.
- Un oubli de drapeau ne suffit plus à publier ou vendre un stage expiré.
- Le cas historique obtient une destination SEO permanente sans risque de rejeu
  d'un POST.
- Aucune modification ne concerne les bilans, le canon tarifaire ou la campagne
  de pré-rentrée 2026.

## Risques restants

- La redirection 301 n'entrera en vigueur qu'après revue, approbation et
  déploiement de la PR par le responsable ; la fermeture de production reste
  effective indépendamment.
- Les scans Semgrep et OSV ainsi que la suite E2E complète sont attestés par les
  jobs GitHub requis, à contrôler avant toute approbation.
- Les avertissements ESLint préexistants sont limités au chantier
  `candidat-libre`, hors périmètre de cette correction.

## Rollback

- Code : revenir sur les commits de la PR, sans toucher aux données historiques.
- Production : les drapeaux peuvent techniquement être remis à `true` par une
  transaction ciblée sur le même slug. Ce rollback ne doit pas être utilisé tant
  que la date de fin reste passée ; la garde applicative continuerait de refuser
  publication et inscription.
- Aucune restauration de réservation n'est nécessaire : aucune réservation n'a
  été supprimée ou modifiée.
