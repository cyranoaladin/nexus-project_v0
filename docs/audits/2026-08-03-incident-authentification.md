# Incident d'authentification du 3 août 2026

## Date

3 août 2026.

## Contexte

La release `b06f93e85a17b1b3a145c19bf953c25ccbff7bf2` a été activée en production à 20:08:01 (UTC+2). Elle provenait d'un build local Node 22 exécuté par l'UID 1000, puis copié sur le serveur. La release précédente `11e0dce93e9f1d4c79824f9cccd0a467dde4f11b` provenait d'un build Node 20 exécuté par l'UID 0 sur l'environnement serveur.

## Chronologie

- 20:08:01 : bascule vers `b06f93e85`.
- Après la bascule : trois tentatives de connexion, trois `CallbackRouteError`, aucune session établie.
- 21:20:38 : retour arrière vers `11e0dce9`.
- Après le retour arrière : connexion réelle réussie dans Chromium avec un compte synthétique, session `PARENT` établie, routes publiques en 200.
- Durée de l'incident : 1 h 12 min 37 s.

## Problème observé

NextAuth utilise le provider Credentials et interroge Prisma avant de comparer le mot de passe. Le serveur de production exécute OpenSSL 3 et Prisma y attend `debian-openssl-3.0.x`. L'artefact fautif ne contenait que :

```text
node_modules/.prisma/client/libquery_engine-debian-openssl-1.1.x.so.node
```

L'appel Prisma échouait donc avant la vérification des identifiants. Le build, les traces Next.js et l'audit de secrets étaient verts alors que l'artefact était inexploitable.

## Déclaré contre observé

L'hypothèse initiale attribuait les déconnexions à la rotation de `NEXTAUTH_SECRET` du 1er août. Cette rotation invalide effectivement les sessions JWT existantes, mais aucune erreur de déchiffrement JWT n'a été observée. Elle n'explique pas l'impossibilité d'établir une nouvelle session.

Les deux releases utilisaient Prisma `6.19.3` et ne déclaraient aucun `binaryTargets`. La release précédente avait bénéficié de la détection native du serveur et embarquait le moteur OpenSSL 3. La release fautive avait bénéficié de la détection native du poste de build et embarquait le moteur OpenSSL 1.1.

## Cause racine

La cible Prisma dépendait implicitement du lieu de génération. Le pipeline autorisait la construction d'un artefact sur un système différent de la production sans vérifier que le Query Engine requis par le serveur était physiquement embarqué.

## Décisions et correctif

- Le générateur Prisma déclare `binaryTargets = ["native", "debian-openssl-3.0.x"]`.
- L'audit de l'artefact standalone lit les cibles déclarées et vérifie la présence de chaque moteur requis.
- `debian-openssl-3.0.x` demeure une exigence de production explicite, même si la déclaration Prisma était modifiée ultérieurement.
- Un artefact privé du moteur requis échoue désormais avant déploiement.
- Le garde est exécuté par `npm run build`, par `npm run artifact:audit` et par le job CI de build avant l'upload de l'artefact.

## Dépendances natives connexes

- Prisma Query Engine : concerné par l'incident et couvert par le nouveau garde.
- `sharp` : distribue des modules natifs glibc et musl. Les deux variantes sont actuellement présentes dans l'artefact ; un contrôle de compatibilité runtime dédié reste à évaluer.
- `bcryptjs` : implémentation JavaScript, non concernée par une incompatibilité binaire native.

## Vérifications

- Test positif : un artefact contenant les moteurs déclarés passe l'audit.
- Test négatif : un artefact privé de `debian-openssl-3.0.x` échoue.
- Le client Prisma généré localement contient le moteur natif et le moteur de production.
- Le déploiement ne peut reprendre qu'après build complet, audit standalone et preuve de connexion réelle.

## Risques restants

- Une bibliothèque native autre que Prisma pourrait nécessiter un contrôle analogue si sa sélection dépend du lieu de build.
- La release `b06f93e85` est conservée comme preuve de l'incident et doit être marquée comme non réactivable.

## Rollback

Rebasculer `<APP_DIR>` vers la release précédente validée, redémarrer uniquement `<APP_PROCESS>`, attendre la disponibilité puis prouver une connexion réelle. La procédure détaillée est conservée dans le runbook de rollback du pilote Seconde.
