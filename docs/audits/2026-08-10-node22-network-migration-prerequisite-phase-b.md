# Préalable #116 — réseau `nexus_admin` sur clone et canary Node 22

## Date

2026-08-10 (Africa/Tunis)

## Contexte

La branche `agent/node22-migration-prerequisite` part de `origin/main` au commit
`7e9033eff1d81b4a848bc789aeec1101575810d8` (merge de la PR #116). Le périmètre
autorisé est limité à un clone PostgreSQL jetable et à des images/canary locaux.
La rotation du rôle de production, le HBA de production, le launcher PM2, la
release active et la migration #116 en production sont explicitement hors
périmètre.

## Problèmes observés

- `Dockerfile.prod` utilisait `node:20-alpine`, alors que `package.json` exige
  Node `>=22.13.0` et que la CI est alignée sur Node 22.23.1.
- Le rôle `nexus_admin` de production fonctionne par le socket local autorisé
  par le HBA, mais le credential réseau historique n'est plus synchronisé avec
  la base réelle. Le HBA réseau impose déjà SCRAM ; il n'a pas besoin d'être
  élargi.
- La migration `20260809090000_deferred_parent_email` contient deux `ALTER
  TABLE`, un `UPDATE` de backfill et un `CREATE INDEX`. Elle nécessite donc un
  rôle de migration capable d'altérer le schéma. L'accès local peut servir de
  secours opératoire, mais ne valide pas le chemin réseau du migrateur.

## Décisions prises

- Les stages `deps`, `builder` et `runner` utilisent tous l'image exacte
  `node:22.23.1-alpine` verrouillée par digest.
- Les trois stages vérifient au build `npm 10.9.8`. Le build échoue si la version
  fournie par l'image dérive.
- `.npmrc` est copié dans `deps` avec `package.json` et `package-lock.json` avant
  `npm ci`.
- Aucun secret de migration n'est versionné. Les credentials et secrets canary
  ont été générés dans un répertoire temporaire mode 0700, avec fichiers mode
  0600, puis écrasés et supprimés.

## Preuves du clone PostgreSQL 15

Source du clone :

- dump production `--schema-only --format=custom --no-owner --no-privileges` ;
- dump `--data-only` limité à `public._prisma_migrations` ;
- zéro entrée `TABLE DATA` dans le dump de schéma ;
- clone obtenu : 85 tables publiques, 69 migrations enregistrées, zéro ligne
  métier avant migration ;
- aucune publication de port PostgreSQL sur l'hôte.

Authentification réseau du rôle éphémère :

- mot de passe aléatoire hexadécimal de 64 caractères, jamais affiché ;
- verifier du rôle : SCRAM ;
- règle HBA du bridge : `host all all all scram-sha-256` ;
- connexion depuis un second conteneur du bridge :
  `nexus_admin|client_address_present|nexus_prod` ;
- PostgreSQL clone : 15.15, même version majeure que la production PostgreSQL
  15.

Migration #116 :

- avant : `users.email` `NOT NULL`, aucune colonne `phoneNormalized`, exactement
  une migration en attente (`20260809090000_deferred_parent_email`) ;
- premier `prisma migrate deploy` : migration appliquée avec succès par le
  bridge SCRAM ;
- après : `users.email` nullable, `phoneNormalized` de type `text` nullable,
  index `users_phoneNormalized_idx` présent ;
- l'index unique existant `users_email_key` reste présent. PostgreSQL conserve
  ainsi l'unicité des valeurs non nulles et autorise plusieurs `NULL` ;
- second `prisma migrate deploy` : `No pending migrations to apply` ;
- une seule ligne terminée dans `_prisma_migrations` pour #116.

Invariants append-only et scoring :

- 12 tables `canonical_*`, zéro ligne avant migration, zéro ligne après
  migration et après canary ;
- `canonical_job_outbox` et `canonical_notification_outbox` restent à zéro ;
- le dump de schéma canonique normalisé des marqueurs aléatoires
  `\\restrict`/`\\unrestrict` est strictement identique avant/après :
  `f0f9e98d45d4e7ef8655ff7b9eb2a4d94a32ba2160904a793ad43df2515f1306` ;
- aucun fichier de scoring, append-only ou candidat libre n'est modifié dans la
  branche.

## Preuves des images et du canary Node 22

Images construites :

- target `migrator` : Node 22.23.1, npm 10.9.8, Prisma 6.19.3,
  `linux-musl-openssl-3.0.x` ;
- target `runner` : Node 22.23.1, npm 10.9.8, `linux x64` ;
- build Next.js 15.5.21 réussi, Prisma Client généré, typecheck de build réussi,
  traces et artefact standalone validés ;
- les contrôles npm explicites ont ensuite été exécutés avec succès dans les
  trois stages sur le commit technique `0efd4e8d83138558f3a9b0f86071c66b6303dc91`.

Canary local isolé sur `127.0.0.1:31022`, connecté au clone :

- `/api/health` : HTTP 200 et requête Prisma réussie ;
- authentification réelle Chromium d'un compte ADMIN synthétique : page de
  connexion 200, session NextAuth 200, rôle ADMIN, redirection
  `/dashboard/admin`, API dashboard 200, aucune erreur de page ;
- Prisma natif : connexion à `nexus_prod` avec le rôle du clone ;
- Sharp : PNG 2×2 généré et relu, 95 octets ;
- PDFKit : document `%PDF` généré, 1268 octets ;
- logs : aucun `FATAL`, `Unhandled`, envoi SMTP, génération LLM ou drain worker.

Les garde-fous canary étaient `MAIL_DISABLED=true`,
`EMAIL_OUTBOX_WORKER_ENABLED=false`, `BILAN_WORKER_ENABLED=false`,
`LLM_MODE=off` et `NPC_LLM_MODE=off`. L'instrumentation refuse volontairement
un worker e-mail désactivé lorsque `NODE_ENV=production`. Pour respecter le
contrat « workers off » sans modifier le produit, le canary a utilisé le garde
existant `NEXT_PHASE=phase-production-build`, qui évite l'instrumentation de
démarrage. Le serveur, NextAuth, Prisma, Sharp et PDFKit ont bien tourné avec
`NODE_ENV=production`. Cette exception de test doit rester explicite : elle ne
remplace pas un smoke de release avec la politique workers de production.

## Destruction et état de production

Après les preuves :

- conteneurs PostgreSQL, Redis et runner supprimés ;
- réseau bridge dédié supprimé ;
- images de test taguées supprimées ;
- port 31022 fermé ;
- dumps, mots de passe, hash synthétique et fichier env écrasés puis supprimés.

Constat final production, en lecture seule :

- PM2 `nexus-prod` : PID `706275`, inchangé ;
- release active :
  `1d0f202e0-main-bilans-rendu-20260809T201748Z` ;
- runtime launcher : `/usr/bin/node` v20.20.0, inchangé ;
- probe HTTP local `/` : 200 ;
- migration #116 terminée : 0 ligne ;
- `users.email` reste `NOT NULL` et `phoneNormalized` reste absente ;
- HBA non modifié, SHA-256 final
  `85c57882d53ed4fd928e9250e4aedad83266b84bffdadf51254ed2deca077d55`.

## Mécanisme proposé pour la rotation production

À exécuter seulement après un second feu vert, par le responsable habilité :

1. Générer hors dépôt une valeur hexadécimale aléatoire d'au moins 256 bits et
   la déposer depuis le gestionnaire de secrets dans un fichier staging
   root-only, par exemple `/etc/nexus/nexus-migrator.env.next` (0600, répertoire
   0700). Le fichier contient uniquement la `DATABASE_URL` du migrateur ; aucun
   secret ne passe dans Git, les logs ou l'historique shell.
2. Vérifier sans changement que les règles host restent limitées au réseau
   Docker attendu et en `scram-sha-256`. Ne pas ajouter de CIDR large et ne pas
   modifier l'authentification locale au cours de cette rotation.
3. Ouvrir une session locale contrôlée :
   `docker exec -it nexus-postgres-db psql -U nexus_admin -d postgres`, puis
   exécuter `\\password nexus_admin`. Cette commande demande le secret dans le
   TTY et évite de le placer dans une ligne de commande ou un SQL journalisé.
4. Depuis une image migrator approuvée attachée au bridge de production,
   utiliser le fichier staging comme `--env-file` et exécuter d'abord
   `prisma migrate status`/une requête sans écriture. Attester le rôle, la base,
   une adresse client réseau et le succès SCRAM, sans afficher l'URL.
5. Si le test échoue, conserver l'accès local, corriger immédiatement le mot de
   passe via `\\password` et recommencer ; ne modifier ni HBA ni privilèges pour
   contourner l'échec.
6. Quand le bridge est prouvé, remplacer atomiquement le fichier root-only
   actif par le staging, supprimer toute copie transitoire et conserver
   uniquement l'empreinte/date de rotation dans le journal opératoire.
7. Faire un nouveau clone/dry-run si l'image ou les migrations ont changé depuis
   ce rapport. L'application de #116 en production et la bascule Node 22/PM2
   restent deux actions séparées, chacune avec son feu vert et son rollback.

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
- canary HTTP, Prisma, auth Chromium, Sharp et PDFKit ;
- quality gates complets consignés dans le rapport de PR.

## Risques restants

- La production reste volontairement sur Node 20.20.0 : modifier le Dockerfile
  n'aligne pas le launcher PM2, qui invoque encore `/usr/bin/node`.
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
