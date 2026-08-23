# Clôture production — Candidat Individuel

## Date

23 août 2026

## Contexte

La refonte Candidat Individuel a été clôturée après les PR #160 à #167. La
release auditée et déployée correspond exactement au commit :

```text
4bc6f4ebf165edc88c8f3ac7da405a569e028850
```

Ce document complète la note de clôture structurelle en consignant la recette
finale et le résultat du déploiement, sans inclure de procédure, de chemin ou de
configuration privée de production.

## Problèmes observés

### ANOM-2 — estimation sans bilan

Le moteur respectait les invariants budgétaires, mais pouvait produire des
scénarios identiques en l'absence de diagnostic. Leur affichage simultané sur le
wizard public donnait alors une impression de personnalisation excessive.

### ANOM-5 — composant public mort

`ForWhoSection` n'était importé par aucun runtime actif et conservait une
nomenclature commerciale obsolète via le barrel des composants premium.

## Décisions prises

- Le moteur conserve trois scénarios pour les consommateurs internes.
- Sans bilan, le wizard public présente uniquement la stratégie choisie sous le
  titre « Estimation provisoire » et explique explicitement la limite de cette
  estimation.
- Un budget inférieur au coût incompressible du Pilotage est signalé comme tel.
- `ForWhoSection` et son export ont été supprimés, sans recréer de composant
  équivalent.
- Les anciennes offres et nomenclatures sont couvertes par un garde qui exclut
  explicitement les archives et preuves historiques.
- La source tarifaire reste `data/pricing.canonical.json`, consommée par les
  loaders canoniques.

## Pull Requests intégrées

- #160 — refonte Candidat Individuel : pricing, moteur, UI publique et staff.
- #161 — positionnement Terminale Mathématiques complémentaires.
- #162 — alignement de la FAQ homepage.
- #163 — retrait des affirmations universelles sur les capacités de groupe.
- #164 — suppression du composant Candidat Individuel mort.
- #165 — estimation provisoire sans diagnostic.
- #166 — fermeture des derniers écarts runtime.
- #167 — alignement final des surfaces et snapshots devis.

## Audit final

Les contrôles du SHA de release ont établi :

- aucun conflit ou fichier non fusionné ;
- aucune ancienne offre active dans le runtime ;
- aucun moteur, catalogue, renderer PDF ou calcul tarifaire actif dupliqué ;
- aucune route zombie Candidat Individuel ;
- aucun composant orphelin ou code mort confirmé dans le périmètre ;
- aucun tarif runtime autonome en dehors de la source canonique ;
- aucune donnée de coût enseignant ou de marge sur une surface publique ;
- aucune divergence entre catalogue, moteur, API, UI, dashboard et PDF.

## Tests exécutés

- installation reproductible des dépendances ;
- génération et validation Prisma ;
- TypeScript et lint ;
- suites unitaires et d'intégration ;
- tests PostgreSQL jetable et runtime réel ;
- tests du moteur de recommandation et de sa matrice sans diagnostic ;
- contrôles de sécurité, d'intégrité des dépendances et d'anti-fuite ;
- build Next.js de production ;
- E2E publics et authentifiés requis par la CI ;
- parcours réels desktop et mobile sur `/devis-bac` ;
- vérification des six offres, des règles Grand Oral, des échéanciers et des
  anciennes routes ;
- contrôles HTTP, TLS, assets, logs applicatifs et état des migrations après
  déploiement.

Tous les checks GitHub requis du SHA final ont terminé avec le statut
`SUCCESS`.

## Résultat du déploiement

- Une sauvegarde de la base et de l'état applicatif a été vérifiée avant toute
  migration ou bascule.
- La migration Quote appliquée est additive et ne requiert aucun downgrade
  destructif pour un rollback applicatif.
- La release a été construite de manière reproductible puis activée par le
  mécanisme atomique documenté de production.
- Le SHA du processus réellement lancé, le manifeste et les pointeurs de
  release correspondent tous au SHA audité.
- La homepage, le health check et `/devis-bac` répondent en HTTP 200.
- Les contrôles post-déploiement n'ont détecté aucun 5xx, aucune fuite publique,
  aucune ancienne offre active et aucune erreur applicative critique nouvelle.

Verdict :

```text
GO-LIVE RÉUSSI — REFONTE CANDIDAT INDIVIDUEL VALIDÉE EN PRODUCTION
```

## Risques restants

- Ajouter un nom accessible explicite à la barre de progression du wizard.
- Traiter séparément un avertissement historique de base de données observé
  avant et après la release, sans impact constaté sur les parcours devis.
- La génération PDF authentifiée reste couverte par les tests exacts du SHA ;
  aucun compte ou donnée de famille n'a été créé pour une recette destructive
  en production.
- Le PDF famille reste absent et non bloquant.
- La refonte éditoriale globale reste un chantier distinct.

## Rollback

La release applicative précédente et la sauvegarde pré-déploiement sont
conservées. Le rollback n'a pas été exécuté, aucun critère critique n'ayant été
rencontré.
