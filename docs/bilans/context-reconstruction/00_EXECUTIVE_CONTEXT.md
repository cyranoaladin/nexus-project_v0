# Contexte exécutif — reconstruction du système de bilans

Date de reconstruction : 11 juillet 2026. Dépôt cible unique : `nexus-project_v0`, branche `fix/bilans-p0-curriculum`, HEAD initial `db04d23f3e645a2052e41e5a679a8b9443cf8dc9`.

## Conclusion

Le système de bilans n'est pas une chaîne unifiée. Six familles coexistent : Assessment public, Diagnostic Pallier 2, Bilan générique, StageBilan, rapports de stages EAF/Maths et NPC. Elles dupliquent identité, scores, contenus et publication. `Bilan` est présenté comme canonique dans des commentaires, mais le code ne lui confère ni tentative normalisée, ni preuve itemisée, ni score versionné, ni rapport versionné, ni publication par audience.

Le statut est **NO-GO pour une généralisation des diagnostics**. Les scores déterministes existants restent utiles, mais les P0 suivants interdisent de brancher de nouveaux diagnostics :

1. création/génération de `Bilan` sans vérification systématique de l'affectation coach–élève ;
2. traitements `fire-and-forget`, sans claim atomique, lease, retry durable ou DLQ ;
3. curriculum acceptant une année future non vérifiée (`2035-2036` reproduit localement) ;
4. frontières d'audience non étanches : certaines réponses exposent ensemble contenus élève et parent ;
5. questions et indicateurs de correction chargés dans un composant client Assessment ;
6. « Je ne sais pas » sérialisé `__NSP__` mais traité comme réponse incorrecte par la soumission actuelle ;
7. validation de contrat de scoring en échec seulement journalisée, sans arrêt de la persistance.

## Cible

Une seule application conserve les dashboards existants et adopte une chaîne additive :

```text
DiagnosticDefinition → AssessmentAttempt → AssessmentResponse → SkillEvidence
→ ScoringRun → ScoreSnapshot → ReportJob → ReportVersion
→ HumanReview → ReportPublication
```

Le score est déterministe, immutable et disponible dès `SCORED`. RAG, LLM et PDF enrichissent le rapport sans bloquer ce résultat. Chaque audience (`STUDENT`, `PARENT`, `NEXUS_INTERNAL`) reçoit une version et une publication distinctes. La revue humaine précède initialement toute publication parent.

## État de l'art appliqué à Nexus

Un bilan défendable n'est ni une moyenne brute ni un texte LLM. Il sépare maîtrise, couverture, prérequis, automatismes, raisonnement, méthode, métacognition, qualité des données et confiance. Tout agrégat doit remonter à une réponse, une question versionnée, une compétence, une règle et une source. « Non étudié », « inconnu », « non répondu », erreur conceptuelle, technique, de lecture ou de temps sont des états distincts.

Les modèles psychométriques avancés ne doivent pas être revendiqués sans banque calibrée, échantillons suffisants et étude de validité. La première cible est une évaluation critériée, explicable, versionnée et revue pédagogiquement.

## Production prouvée en lecture seule

Le 11 juillet 2026, la production observée sur `korrigo` utilisait le commit `1b8219b1cfcfe63354d8cb4035645143e27e5a43` de `main`. Next.js fonctionnait sous PM2 (`nexus-prod`, cluster, port applicatif documenté 3001), tandis que PostgreSQL, ChromaDB, Ollama et l'ingestor fonctionnaient en conteneurs. Aucun worker canonique de rapports, aucun répertoire de rapports Nexus durable et aucun service NPC actif n'ont été observés. Redis existe sur l'hôte, sans preuve qu'il soit consommé par cette chaîne.

Backups restaurables, stockage objet Nexus, configuration de secrets, commit exact des services RAG, dimensions d'embedding actives, corpus réellement indexé, scheduler et rollback testé restent `UNKNOWN_PRODUCTION_FACT`.

## Décision immédiate

Le premier lot d'implémentation ne doit pas être Prisma. Il doit fermer les P0 de sécurité existants et arrêter les décisions structurantes : frontières d'audience, rattachement légal multi-responsables, rôle enseignant/responsable pédagogique, backend RAG réellement retenu, file durable et horizon curriculum. L'ordre complet est dans `17_IMPLEMENTATION_SEQUENCE.md`.

## Échelle de preuve

- **CONFIRMED_CODE** : constat direct dans le code local.
- **CONFIRMED_TEST** : commande exécutée pendant cette reconstruction.
- **CONFIRMED_PRODUCTION** : lecture seule datée de la production.
- **DOCUMENTED_ONLY** : documentation ou audit non revalidé au runtime.
- **UNKNOWN_PRODUCTION_FACT** : donnée de production non prouvée.
