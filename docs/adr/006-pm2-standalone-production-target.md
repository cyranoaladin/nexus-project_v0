# ADR 006 — PM2 standalone comme cible de déploiement

## Statut

Accepté — 31 juillet 2026.

## Contexte

Le dépôt contient `Dockerfile.prod` et `docker-compose.prod.yml`, alors que la
production publique `nexusreussite.academy` est servie depuis un serveur Hetzner
distant par Nginx et une application Next.js standalone gérée par PM2.

Un conteneur local historique nommé `nexus-app-prod` publie le port 3001, mais il
n'est ni résolu par le DNS public ni placé derrière un proxy local pour le
domaine. Son contenu HTML diffère en outre de la surface publique.

Cette coexistence entretenait deux descriptions contradictoires du déploiement.

## Décision

- La cible de déploiement de production de l'application Next.js est **PM2
  standalone derrière Nginx sur le serveur distant**.
- Le §16 du `README.md` est la description canonique du déploiement de
  production.
- `Dockerfile.prod` et `docker-compose.prod.yml` restent présents dans le dépôt,
  mais leur statut est **vestigial et non-production**.
- Ces fichiers ne doivent pas être utilisés pour conclure sur l'état de la
  production publique ni pour la déployer.

## Conséquences

- Toute procédure de mise en production doit viser le build Next.js standalone
  et PM2 sur le serveur distant.
- Les commandes Docker historiques sont documentées uniquement comme simulation
  ou environnement local.
- La suppression éventuelle des fichiers Docker fera l'objet d'une décision
  séparée après inventaire de leurs usages hors workflows GitHub Actions.
- Au 31 juillet 2026, aucun workflow sous `.github/workflows/` ne référence
  `Dockerfile.prod` ni `docker-compose.prod.yml`.

## Non-objectifs

- Cet ADR ne supprime aucun fichier Docker.
- Il ne modifie pas l'infrastructure distante.
- Il ne tranche pas l'avenir du conteneur local historique.

## Preuves

Le détail des observations est consigné dans
`docs/audits/2026-07-31-audit-infra-et-prod-publique.md`.

## Réexamen

La décision devra être réexaminée si une nouvelle chaîne de déploiement Docker
est explicitement validée, testée et reliée au domaine public.
