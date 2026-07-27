# Topologie de production

## Observation en lecture seule du 11 juillet 2026

| Élément | Fait confirmé | Niveau |
|---|---|---|
| Hôte | `korrigo` | CONFIRMED_PRODUCTION |
| Application | dépôt `<APP_DIR>`, `main`, commit `1b8219b1cfcfe63354d8cb4035645143e27e5a43`, état suivi propre | CONFIRMED_PRODUCTION |
| Next.js | PM2 `<PROCESS_NAME>`, cluster, online ; Node 20.20, npm 10.8 | CONFIRMED_PRODUCTION |
| Redémarrages | PM2 affichait 102 restarts et ~14 jours d'uptime | CONFIRMED_PRODUCTION, cause inconnue |
| PostgreSQL | conteneur `nexus-postgres-db`, healthy, bind loopback `5435` | CONFIRMED_PRODUCTION |
| RAG | Chroma 1.1.1, Ollama 0.3.13 et ingestor healthy en conteneurs ; ports loopback 8000/11434/18001 | CONFIRMED_PRODUCTION |
| Nginx | service actif, configuration syntaxiquement valide, 80/443 publics | CONFIRMED_PRODUCTION |
| Redis | service loopback 6379 et autres conteneurs Redis présents | présence confirmée, usage Nexus inconnu |
| Disque | partition racine à 80 %, environ 183 Go disponibles | CONFIRMED_PRODUCTION |
| PDF Nexus | aucun répertoire de rapports trouvé dans les emplacements Nexus examinés | CONFIRMED_PRODUCTION limité au périmètre cherché |
| Worker rapports/NPC | aucun processus PM2/conteneur correspondant observé | CONFIRMED_PRODUCTION à l'instant T |

Des volumes nommés Nexus existent pour PostgreSQL, logs et uploads. Leurs montages, sauvegardes et politiques ne sont pas prouvés. Des dossiers de backup existent sur l'hôte, sans preuve de contenu récent, chiffrement ou test de restauration.

## Divergence documentaire

`README.md` récent indique correctement PM2 standalone pour Next.js et Docker pour les services RAG/DB. `docs/DEPLOY_PRODUCTION.md`, Compose et le runbook historique décrivent encore Next.js en Docker ou `/opt/nexus`. Ils sont des variantes/vestiges, pas la topologie courante. Le déploiement des bilans doit partir du chemin et du service réellement opérés, après ADR/runbook consolidé.

## `UNKNOWN_PRODUCTION_FACT`

- commit/image/configuration exacte de l'ingestor, Chroma et Ollama ;
- noms, documents, checksums, licences et dates des collections actives ;
- modèle et dimension d'embedding actifs ;
- variables, secrets, rotation et région des fournisseurs LLM ;
- base/schéma/migrations appliquées et dérive par rapport au dépôt ;
- usage de Redis par Nexus, persistance et politique d'éviction ;
- mapping exact des volumes et stockage PDF durable/object storage ;
- planification, rétention, chiffrement et restauration testée des backups ;
- vhost/reverse proxy complet, limites uploads/timeouts et headers effectifs par route ;
- healthcheck interne DB/RAG/Redis/worker et alerting ;
- stratégie de rollback réellement exercée ;
- raison des 102 redémarrages PM2 ;
- conformité DPA/rétention des fournisseurs.

## Topologie cible

Conserver une seule application et ajouter un worker déployé/monitoré séparément, la même PostgreSQL pour états/outbox, un stockage objet privé durable et le backend RAG décidé après audit runtime. Redis/BullMQ est optionnel : si retenu, PostgreSQL reste source de vérité et l'outbox empêche la perte. Les PDF sont privés, chiffrés, versionnés et servis par URL courte signée après réautorisation.

## Exigences d'exploitation

Runbook unique : commit/artefact, backup pré-migration, migration additive, smoke RBAC, health DB/queue/RAG/LLM/storage, métriques, canary/feature flags, retour au commit et restauration testée. Ne jamais lancer `prisma migrate dev` en production. Aucun secret ou contenu élève dans artefact, Git ou logs.
