# Système unifié de bilans Nexus Réussite

## Statut

Ce dossier trace l'audit reproductible et l'implémentation progressive du système unifié de diagnostics. Au 10 juillet 2026, la phase 0 est documentée et la première tranche pure TypeScript/Zod du registre versionné des programmes est implémentée et testée. Elle n'est pas encore branchée au runtime. Le système complet décrit dans le cahier des charges n'est pas terminé.

## Source de vérité

- Cahier des charges : `../Cahier_charges.md` depuis la racine du workspace, soit `/home/alaeddine/Projets/nexus-bilans-workspace/Cahier_charges.md`.
- Dépôt canonique et seul dépôt modifiable : `nexus-project_v0`.
- Les cinq autres dépôts du workspace sont des sources en lecture seule.
- Audit fourni : `/home/alaeddine/Projets/nexus-bilans-workspace/nexus_bilans_audit`.

## Documents

- `CAHIER_DES_CHARGES_READING_REPORT.md` : preuve et conclusions de lecture.
- `BASELINE_REPOSITORIES.md` : état Git initial des six dépôts.
- `BASELINE_TESTS.md` : référence des quality gates avant implémentation.
- `REPOSITORY_INVENTORY.md` : cartographie technique vérifiée dans le code.
- `CURRENT_STATE.md` : flux actifs, écarts et risques.
- `COMPONENT_DECISIONS.csv` : décisions de reprise traçables.
- `TARGET_ARCHITECTURE.md` : architecture cible et alternatives examinées.
- `IMPLEMENTATION_PLAN.md` : lots exécutables et critères de sortie.
- `CURRICULUM_VERSIONING.md` : contrat et cas de cohorte du premier lot.
- `IMPLEMENTATION_REPORT.md` : rapport factuel de la session.
- `KNOWN_LIMITATIONS.md` : limites explicites et dette restante.
- `adr/ADR-001-canonical-repository-and-integration-strategy.md` : décision de dépôt canonique.

## Règles de travail

1. Aucun item pédagogique généré n'est publiable sans revue humaine.
2. Le scoring déterministe reste la source de vérité.
3. Les programmes préalable, cible et futur sont des versions distinctes.
4. Les données personnelles ne sont jamais ingérées dans le corpus RAG global.
5. Toute route famille vérifie rôle et rattachement côté serveur.
6. Aucune migration destructive, publication, déploiement ou écriture en production n'est autorisée dans cette phase.
