# ADR-001 — Dépôt canonique et stratégie d'intégration

- Statut : accepté
- Date : 2026-07-10

## Contexte

Six dépôts contiennent des implémentations, données ou spécifications liées aux bilans. Le cahier des charges, l'audit fourni et les règles du dépôt désignent tous `nexus-project_v0` comme application de production. Les autres dépôts présentent des piles concurrentes, des modèles de données redondants, des dépendances vendoriées et, pour certains, des données historiques potentiellement personnelles.

## Options examinées

1. Fusionner les cinq dépôts sources dans le dépôt principal. Cette option maximise la reprise brute mais introduit plusieurs applications, moteurs RAG, schémas et chaînes PDF incompatibles.
2. Maintenir un microservice séparé pour les bilans. Cette option isole le risque mais crée une septième application et duplique l'authentification, le RBAC et les modèles utilisateurs.
3. Conserver `nexus-project_v0` et porter sélectivement des composants derrière des contrats canoniques. Cette option demande des adaptateurs et migrations, mais garde une seule source de vérité et permet des reprises testées.

## Décision

L'option 3 est retenue.

- `nexus-project_v0` reste le seul dépôt de production et le seul périmètre d'écriture.
- Chaque reprise possède une ligne dans `COMPONENT_DECISIONS.csv`, un chemin cible, des tests et une justification.
- Les sources restent inchangées ; le code est réimplémenté ou copié puis adapté dans le dépôt canonique.
- Les migrations de données sont additives, idempotentes, exécutables en dry-run et accompagnées d'un rollback logique.
- Les contrats canoniques précèdent les migrations Prisma destructives ou les routes nouvelles.

## Conséquences

Positives : une seule authentification, un seul RBAC, un moteur de scoring convergent, un RAG ChromaDB canonique et une exploitation simplifiée.

Négatives : travail d'adaptation, coexistence temporaire des moteurs legacy et besoin de scripts de migration explicites.

## Garde-fous

- Aucun commit, push, déploiement ou migration de production dans cette mission.
- Aucun changement dans les cinq dépôts sources.
- Feature flags et adaptateurs pour les migrations progressives.
- Validation pédagogique et sécurité avant publication.

## Retour arrière

Chaque lot doit pouvoir être désactivé sans supprimer les tables ou flux legacy. Les migrations initiales seront additives ; les anciens lecteurs restent disponibles jusqu'à validation de la parité et migration des données.
