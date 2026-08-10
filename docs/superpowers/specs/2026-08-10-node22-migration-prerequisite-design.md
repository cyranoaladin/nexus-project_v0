# Préalable Node 22 et migrations réseau — conception

## Date

10 août 2026.

## Contexte

La PR #116 est fusionnée mais ne doit pas être déployée avant deux preuves :
`Dockerfile.prod` doit respecter le contrat Node 22 du dépôt, et une migration
Prisma avec un rôle `nexus_admin` doit fonctionner par SCRAM sur un réseau
Docker. La production reste strictement inchangée pendant cette phase.

## Périmètre versionné

- Remplacer les trois bases `node:20-alpine` de `Dockerfile.prod` par l'image
  déjà canonique et épinglée du dépôt : Node 22.23.1 Alpine, digest immuable.
- Copier `.npmrc` avec `package.json` et `package-lock.json` dans le stage
  `deps`, afin que `engine-strict=true` soit réellement appliqué.
- Étendre `__tests__/config/deploy-contract.test.ts` pour verrouiller les trois
  stages, le digest, la copie de `.npmrc` et l'absence de base Node 20.
- Documenter les preuves dans `docs/audits/` sans consigner de credential,
  d'adresse privée ou de donnée métier.

## Qualification jetable

### PostgreSQL

Un dump production `schema-only`, complété uniquement par les lignes du
registre `_prisma_migrations`, est obtenu en lecture seule via le socket du
conteneur PostgreSQL. Aucun utilisateur, bilan, score ou document n'est copié.

Le clone utilise `pgvector/pgvector:pg15`, un `tmpfs`, un réseau Docker dédié et
un secret `nexus_admin` aléatoire de 32 octets encodé en hexadécimal. Le secret
reste dans un répertoire temporaire mode 700, dans un fichier mode 600, puis est
supprimé avec le clone.

Le migrateur Node 22 doit :

1. s'authentifier par le nom réseau du conteneur, donc par la règle SCRAM ;
2. appliquer `20260809090000_deferred_parent_email` avec `prisma migrate deploy` ;
3. obtenir `users.email` nullable, `users.phoneNormalized` et son index ;
4. produire un second `migrate deploy` sans migration ;
5. conserver à l'identique le schéma des tables Canonical append-only et de
   scoring, ainsi que leurs comptes de lignes nuls sur ce clone schema-only.

### Canary Node 22

L'image `runner` est lancée sur un port loopback isolé, avec le clone
PostgreSQL, un Redis jetable, un compte synthétique et des secrets exclusivement
temporaires. SMTP, outbox, workers Bilan/NPC et tous les chemins LLM sont
désactivés. Le canary doit prouver : santé HTTP, accès Prisma, authentification
Credentials réelle, chargement Sharp et génération PDFKit.

Le canary, Redis, PostgreSQL, le réseau, les images de qualification et tous les
fichiers temporaires sont détruits après collecte des résultats.

## Production

Cette phase n'autorise aucune rotation de `nexus_admin`, aucune modification de
HBA, du launcher PM2, de `/usr/bin/node`, de la release active ou du schéma de
production. La rotation proposée sera décrite précisément dans le rapport et
restera bloquée derrière un second feu vert explicite.

## Risques et garde-fous

- Le dump ne contient aucune donnée métier ; seul le registre technique Prisma
  accompagne le schéma pour rendre `migrate deploy` représentatif.
- Le canary ne rejoint aucun réseau de production et n'utilise aucun secret de
  production.
- Une incompatibilité Node, native, Prisma, Sharp, PDF ou authentification
  arrête la qualification ; elle n'est pas contournée.
- Les surfaces scoring, append-only, candidat libre, middleware et LLM ne sont
  pas modifiées.

## Critères de sortie

- Contrat TDD rouge puis vert.
- Targets `migrator` et `runner` construites ; Node 22.23.1 et npm 10.9.8
  observés dans les deux images.
- Migration réseau et idempotence prouvées sur clone.
- Canary complet vert, puis environnement jetable absent.
- PR ouverte vers `main`, revue demandée à `abenrhouma`.
