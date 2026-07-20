# Limites connues

## Fonctionnel

- Aucun parcours diagnostic complet du nouveau cahier n'est livré.
- Aucun des quinze diagnostics ni banque de questions n'est créé.
- Le registre curriculum n'est pas branché aux définitions, tentatives ou dashboards.
- Seule une tranche de Mathématiques est enregistrée ; les variantes et matières restantes sont absentes.

## Données et migrations

- Aucune persistance `CurriculumVersion`, `SkillEvidence`, `ScoreSnapshot`, `ReportJob` ou `StudentParentLink`.
- Les modèles legacy de rapports restent redondants.
- Aucun backfill ni dry-run de migration n'a été exécuté.

## Pédagogie

- Les contenus des mappings existants ne sont pas déclarés conformes aux cohortes 2026-2027.
- Aucun seuil/poids n'est étalonné ou validé par un enseignant.
- Aucun item généré n'est publiable.

## Infrastructure

- Les traitements Assessment `fire-and-forget` restent actifs dans le code existant.
- Aucun worker BullMQ canonique ni DLQ n'est ajouté.
- Aucun stockage objet de rapport unifié n'est configuré.
- L'ingestion ChromaDB gouvernée reste hors dépôt.

## Sécurité et RGPD

- La relation actuelle ne couvre pas plusieurs responsables légaux par lien révocable.
- Les risques IDOR du futur système unifié ne sont pas encore testés.
- Rétention, purge, export et consentement détaillé nécessitent validation juridique.
- Les JSON historiques potentiellement personnels restent dans les dépôts sources mais n'ont été ni copiés ni ingérés.

## Qualité

- Tests d'intégration DB non exécutables sans `DATABASE_URL` : 4 suites/16 tests échouent dans l'environnement courant.
- 296 warnings lint globaux.
- 24 vulnérabilités npm signalées, dont 12 élevées.
- Les suites unitaires émettent encore de nombreux logs, même avec `--silent`, via des loggers hors console Jest.

## Sources officielles

- Les URLs et dates sont enregistrées, mais les PDF ne sont pas encore archivés dans un corpus canonique et aucun checksum n'est renseigné.
- `PUBLISHED` désigne la publication officielle du programme ; cela ne vaut pas validation pédagogique Nexus du contenu détaillé.
