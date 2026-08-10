# Durcissement du gate go-live

## Date

10 août 2026

## Contexte

Le gate post-déploiement a révélé des défauts du banc de test et un défaut produit lors du rattachement tardif d’un foyer à un parent existant. Cette PR corrige ces causes sans modifier la production, le scoring, les snapshots immuables ni les fonctionnalités dark.

## Décisions validées

### Tombstone du parent source

Le rattachement à un compte parent existant conserve le compte source et son profil pour préserver les références historiques. Le compte source reçoit deux attributs additifs : `mergedIntoUserId` et `mergedAt`. Ses sessions sont invalidées et ses capacités d’activation sont neutralisées. Le compte cible reste l’unique compte actif du foyer.

La migration est additive et n’est exécutée que sur une base éphémère pendant cette PR.

### PDF Parent canonique

L’ancienne URL reste disponible comme adaptateur de compatibilité pour les bilans historiques. Elle ne possède plus de moteur PDF indépendant : les données historiques sont adaptées vers le modèle de rendu Parent canonique, puis le même moteur produit le document. Aucun backfill des anciens bilans n’est réalisé.

### Banc hermétique

Le démarrage E2E devient bloquant et ordonné : migration, seed E2E, vérification explicite des rôles et partage du manifeste de comptes, puis démarrage de l’application. Une erreur de seed interrompt le banc au lieu de lancer une application vide.

Le snapshot utilisé par pytest est produit avant la collecte des modules. Le gate interdit les quarantaines inconditionnelles et les marqueurs exclusifs. Les exclusions structurelles restantes doivent être conditionnelles, explicites et répertoriées.

### Sources de vérité

Une fonction générique unique normalise les e-mails de contact. Les anciennes fonctions spécialisées deviennent des façades de compatibilité ou sont migrées vers ce point d’entrée. Les coordonnées publiques et mentions légales proviennent exclusivement des modules canoniques existants.

## Tests attendus

- seed E2E interrompant le lancement si un rôle ou le manifeste manque ;
- collecte pytest depuis un checkout sans artefact préalable ;
- rattachement parent laissant une source tombstonée, sans profil actif orphelin, avec références historiques intactes ;
- équivalence du rendu PDF Parent via l’adaptateur historique et le moteur canonique ;
- normalisation e-mail Unicode, casse et espaces identique dans tous les flux ;
- garde statique contre les quarantaines inconditionnelles et les tests exclusifs ;
- migration additive et idempotente sur PostgreSQL éphémère ;
- suites unitaires, intégration, real-db, concurrence et E2E complètes.

## Hors périmètre

- aucune opération sur la production ;
- aucun backfill des anciens bilans PDF ;
- aucune suppression de document hors racine ;
- les quinze PDF de facture sont conservés définitivement ;
- les quatre faux PDF de test sont seulement recensés et proposés à suppression ;
- le credential bootstrap historique reste un chantier opérationnel distinct.

## Rollback

La PR peut être abandonnée sans effet externe. Après intégration future, le rollback applicatif consiste à revenir au commit précédent ; la migration additive peut rester en place sans être consommée par l’ancien code.
