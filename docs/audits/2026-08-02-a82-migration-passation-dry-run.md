# A82 - Epreuve de la migration de passation Canonical

## Date

2026-08-02

## Perimetre

Migration additive `20260802120000_add_canonical_attempt_passation_fields`.
Aucune migration n'a ete appliquee en production. La seule operation distante a
ete un `pg_dump` en lecture seule.

## Verification DEV/TEST

La cible locale dediee est `nexus-postgres-test`, image
`pgvector/pgvector:pg15`, base `nexus_test` sur le port local 5434.

Commande executee par Prisma, avec `DATABASE_URL` injectee uniquement dans le
processus et jamais affichee :

```text
./node_modules/.bin/prisma migrate deploy
```

La premiere application a detecte une divergence de branche : `startedAt`
existait deja dans TEST avec le type et le defaut attendus. Prisma a rollbacke la
transaction A82 avec `P3018 / PostgreSQL 42701`, sans application partielle. Six
migrations presentes dans TEST mais absentes de cette branche expliquent cette
divergence.

La migration a ete rendue convergente et fail-closed : les colonnes deja
presentes sont acceptees uniquement si leur type physique correspond exactement.
La tentative echouee a ete marquee rollbackee, puis rejouee :

```text
./node_modules/.bin/prisma migrate resolve --rolled-back \
  20260802120000_add_canonical_attempt_passation_fields
./node_modules/.bin/prisma migrate deploy
```

Resultat :

```text
expiresAt | NOT NULL | sans defaut SQL
seed      | NOT NULL | sans defaut SQL
startedAt | NOT NULL | CURRENT_TIMESTAMP
status    | NOT NULL | DRAFT
champs passation nuls : 0 sur 0 attempt Canonical
migration terminee : oui
```

## Copie isolee des donnees de production

Image verifiee sur le serveur : `pgvector/pgvector:pg15`.
Extensions verifiees : `btree_gist 1.7`, `plpgsql 1.0`, `vector 0.8.2`.

Dump execute :

```bash
install -d -m 700 /home/alaeddine/.local/share/nexus/a84
umask 077
ssh root@88.99.254.59 \
  'docker exec nexus-postgres-db pg_dump -U nexus_runtime -d nexus_prod \
    --format=custom --no-owner --no-privileges' \
  > /home/alaeddine/.local/share/nexus/a84/nexus_prod_a82_20260802.dump
chmod 600 /home/alaeddine/.local/share/nexus/a84/nexus_prod_a82_20260802.dump
pg_restore --list \
  /home/alaeddine/.local/share/nexus/a84/nexus_prod_a82_20260802.dump | wc -l
```

Sortie :

```text
exit : 0
duree : 1 s
taille : 674528 octets
droits : 600
entrees TOC : 608
```

Le premier demarrage sans mount explicite a revele que l'image declare un volume
anonyme. Le conteneur et le dump ont ete supprimes avant restauration, puis le
volume anonyme cree par cette seule tentative a ete identifie par son horodatage
et supprime. La reprise a utilise un `tmpfs`, sans volume nomme ni bind mount.

Commande de restauration retenue :

Le credential ephemere local est injecte dans l'environnement du processus et
n'est volontairement pas consigne dans ce document versionne.

```bash
docker run -d --name nexus-a82-dryrun \
  -e POSTGRES_PASSWORD \
  -e POSTGRES_USER=dryrun \
  -e POSTGRES_DB=nexus_a82_dryrun \
  -p 127.0.0.1:5439:5432 \
  --tmpfs /var/lib/postgresql/data:rw,noexec,nosuid,size=1g \
  pgvector/pgvector:pg15

pg_restore \
  -h 127.0.0.1 -p 5439 -U dryrun -d nexus_a82_dryrun \
  --no-owner --no-privileges \
  /home/alaeddine/.local/share/nexus/a84/nexus_prod_a82_20260802.dump
```

Sortie : `exit 0`, aucune ligne d'avertissement ou d'erreur.

Controle de fidelite, production puis copie :

```text
assessments | users | tables public | pedagogical_contents | attempts Canonical
15          | 237   | 76            | 40                   | 0
15          | 237   | 76            | 40                   | 0
```

## Application A82 sur la copie uniquement

Commande :

```bash
psql \
  -X -v ON_ERROR_STOP=1 \
  -h 127.0.0.1 -p 5439 -U dryrun -d nexus_a82_dryrun \
  -f prisma/migrations/20260802120000_add_canonical_attempt_passation_fields/migration.sql
```

Sortie :

```text
exit : 0
duree : 54 ms
ALTER TABLE
DO
UPDATE 0
ALTER TABLE
CREATE FUNCTION
expiresAt:NO:<none>,seed:NO:<none>,startedAt:NO:CURRENT_TIMESTAMP,status:NO:DRAFT
champs passation nuls : 0 sur 0 attempt Canonical
trigger d'immutabilite avant : 1
trigger d'immutabilite apres : 1
fenetre sans trigger : 0 seconde
```

La fonction du trigger est remplacee atomiquement par `CREATE OR REPLACE`; le
trigger n'est jamais retire.

## Suppression constatee

Commandes :

```bash
docker rm --force nexus-a82-dryrun
unlink /home/alaeddine/.local/share/nexus/a84/nexus_prod_a82_20260802.dump
```

Controle final :

```text
conteneur nexus-a82-dryrun : 0
dump : 0
nouveau volume : 0
listener port 5439 : 0
```

## Verdict

A82 est applicable sur le schema de production observe, sans perte de table,
colonne ou ligne legacy. La migration n'a ete appliquee qu'a TEST et a une copie
locale ephemere. La production reste inchangee.
