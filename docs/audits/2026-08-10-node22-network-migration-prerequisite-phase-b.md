# Préalable #116 — qualification réseau et canary Node 22

## Date

2026-08-10 (Africa/Tunis)

## Contexte

La branche dédiée part du merge de la PR #116. Le périmètre autorisé est
limité à un clone PostgreSQL jetable et à des images/canary locaux. La rotation
du rôle administrateur de migration, la politique d'authentification réseau, le
launcher de processus, la release active et la migration #116 en production
sont explicitement hors périmètre.

## Problèmes observés

- `Dockerfile.prod` utilisait `node:20-alpine`, alors que `package.json` exige
  Node `>=22.13.0` et que la CI est alignée sur Node 22.23.1.
- Le chemin d'administration local de la base fonctionne, mais le credential
  historique ne permet plus l'authentification par le réseau interne prévu pour
  le migrateur. La politique réseau impose déjà SCRAM et ne doit pas être
  élargie.
- La migration `20260809090000_deferred_parent_email` contient des changements
  de schéma et un backfill. Elle nécessite donc un rôle de migration autorisé à
  altérer le schéma ; une connexion locale ne prouve pas le chemin réseau du
  migrateur.

## Décisions prises

- Les stages `deps`, `builder` et `runner` utilisent tous l'image exacte
  `node:22.23.1-alpine` verrouillée par digest.
- Les trois stages vérifient au build `npm 10.9.8`. Le build échoue si la
  version fournie par l'image dérive.
- `.npmrc` est copié dans `deps` avec `package.json` et `package-lock.json`
  avant `npm ci`.
- Aucun secret de migration n'est versionné. Les credentials et secrets du
  clone ont été conservés dans un stockage temporaire protégé, puis détruits.

## Preuves du clone PostgreSQL 15

Source du clone :

- export production limité au schéma, sans propriétaires ni privilèges ;
- registre technique des migrations copié séparément ;
- aucune donnée métier copiée ;
- clone PostgreSQL 15 sans exposition réseau publique.

Authentification réseau du rôle éphémère :

- credential fort généré exclusivement pour le clone, jamais affiché ;
- verifier SCRAM confirmé ;
- connexion réussie depuis le réseau Docker interne isolé ;
- rôle et base attendus confirmés sans consigner leurs identifiants.

Migration #116 :

- avant : `users.email` non nullable, aucune colonne `phoneNormalized` et une
  seule migration en attente ;
- premier `prisma migrate deploy` : migration appliquée avec succès par le
  chemin réseau SCRAM ;
- après : `users.email` nullable, `phoneNormalized` nullable et index de
  recherche présent ;
- l'index unique existant sur l'e-mail reste présent. PostgreSQL conserve ainsi
  l'unicité des valeurs non nulles et autorise plusieurs `NULL` ;
- second `prisma migrate deploy` : aucune migration en attente ;
- une seule exécution terminée pour #116 dans le registre Prisma.

Invariants append-only et scoring :

- aucune ligne métier avant migration, après migration ou après canary ;
- les outbox Canonical restent vides ;
- le schéma Canonical normalisé est strictement identique avant et après ;
- aucun fichier de scoring, append-only ou candidat libre n'est modifié dans
  la branche.

## Preuves des images et du canary Node 22

Images construites :

- target `migrator` : Node 22.23.1, npm 10.9.8, Prisma 6.19.3 et moteur natif
  Alpine ;
- target `runner` : Node 22.23.1, npm 10.9.8, Linux x64 ;
- build Next.js 15 réussi, Prisma Client généré, typecheck de build réussi,
  traces et artefact standalone validés ;
- les contrôles npm explicites ont réussi dans les trois stages.

Canary local isolé, connecté au clone :

- endpoint de santé : HTTP 200 et requête Prisma réussie ;
- authentification réelle Chromium d'un compte ADMIN synthétique : connexion,
  session et API staff réussies, sans erreur de page ;
- Prisma natif : connexion avec le rôle et la base du clone ;
- Sharp : image PNG générée et relue ;
- PDFKit : document PDF non vide généré ;
- logs : aucun échec Prisma natif, envoi SMTP, génération LLM ou drain worker.

SMTP, les workers et les chemins LLM étaient désactivés. L'instrumentation
refuse volontairement un worker e-mail désactivé dans le mode de production.
Le canary a donc utilisé le garde de build existant pour ne pas démarrer cette
instrumentation, sans modifier le produit. Le serveur, NextAuth, Prisma, Sharp
et PDFKit ont bien tourné dans le mode de production. Cette exception de test
reste explicite : elle ne remplace pas un smoke de release avec la politique
workers de production.

## Destruction et état de production

Après les preuves :

- conteneurs du clone, du cache et du runner supprimés ;
- réseau Docker interne dédié supprimé ;
- images de qualification supprimées ;
- endpoint local isolé fermé ;
- exports, credentials et fichiers temporaires détruits.

Constat final production, en lecture seule :

- processus et release active inchangés ;
- runtime Node inchangé ;
- sonde HTTP réussie ;
- migration #116 non appliquée ;
- `users.email` reste non nullable et `phoneNormalized` reste absente ;
- politique d'authentification réseau inchangée.

## Mécanisme proposé pour la rotation production

À exécuter seulement après un second feu vert, par le responsable habilité :

1. Générer hors dépôt un secret fort depuis le gestionnaire de secrets et le
   déposer dans un emplacement staging protégé, sans valeur dans Git, les logs
   ou l'historique shell.
2. Vérifier sans changement que les règles réseau restent limitées au réseau
   interne attendu et imposent SCRAM. Ne pas élargir la plage autorisée ni
   modifier l'authentification locale pendant cette rotation.
3. Depuis une session locale interactive et contrôlée, remplacer le mot de
   passe du rôle administrateur de migration sans le placer dans une commande
   ou une requête journalisée.
4. Depuis l'image migrator approuvée attachée au réseau interne, utiliser le
   secret staging pour une requête d'identité en lecture seule et un contrôle
   d'état Prisma. Attester le rôle, la base et le succès SCRAM sans afficher de
   chaîne de connexion.
5. Si le test échoue, conserver l'accès local et resynchroniser le credential ;
   ne modifier ni la politique réseau ni les privilèges pour contourner
   l'échec.
6. Quand le chemin réseau est prouvé, promouvoir atomiquement le secret
   staging, supprimer toute copie transitoire et ne conserver que la date et
   l'empreinte de rotation dans le journal opératoire.
7. Refaire un clone/dry-run si l'image ou les migrations ont changé depuis ce
   rapport. L'application de #116 et la bascule Node 22 restent deux actions
   séparées, chacune avec son feu vert et son rollback.

## Fichiers modifiés

- `Dockerfile.prod`
- `__tests__/config/deploy-contract.test.ts`
- `docs/superpowers/specs/2026-08-10-node22-migration-prerequisite-design.md`
- `docs/superpowers/plans/2026-08-10-node22-migration-prerequisite.md`
- `docs/audits/2026-08-10-node22-network-migration-prerequisite-phase-b.md`

## Tests exécutés

- test de contrat ciblé observé rouge sous Node 20 / sans garde npm, puis vert ;
- builds Docker targets `migrator` et `runner` ;
- migrations réseau sur clone, deux passages ;
- canary HTTP, Prisma, authentification Chromium, Sharp et PDFKit ;
- quality gates complets consignés dans le rapport de PR.

## Risques restants

- La production reste volontairement sur son runtime Node actuel : modifier le
  Dockerfile n'aligne pas le launcher de processus existant.
- Le credential réseau de production reste volontairement périmé jusqu'au
  second feu vert.
- #116 reste volontairement non appliquée en production.
- Un smoke avec l'instrumentation complète et les workers configurés comme en
  production sera requis avant toute bascule réelle.

## Rollback

La branche ne change que le contrat d'image et ses tests/documentation. Le
rollback versionné consiste à revenir au Dockerfile précédent. Aucun rollback
de données n'est nécessaire : le clone et le canary ont été détruits, et la
production n'a subi aucune mutation.
