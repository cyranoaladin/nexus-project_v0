# Registre de dette — moteur canonique de bilans

## État au 30 juillet 2026

| Priorité | Localisation | Reste | Responsable attendu | Dépendance | Critère d'acceptation |
|---|---|---|---|---|---|
| P0 production | `content/.../pedagogy/` | 17 modules sans validation nominative ni sources officielles structurées | enseignants + responsable pédagogique | paquets `.artifacts/.../review/` | chaîne jusqu'à `PUBLICATION_APPROVED`, hash inchangé |
| P0 gouvernance | `content/pre-rentree-2026/modules.json` et `pedagogy/manifest.yaml` | le champ historique `publicationStatus: VALIDATED` de la surface marketing ne constitue pas l'approbation disciplinaire `HUMAN_VALIDATION_REQUIRED` du corpus d'évaluation | responsable pédagogique + propriétaire contenu | revue nominative des 17 hashes | vocabulaire réconcilié ou portée marketing explicitement renommée ; le catalogue d'évaluation reste bloqué jusqu'à `PUBLICATION_APPROVED` |
| P0 sécurité | dépendances dev / PR #88 | 36 entrées high `brace-expansion` d'outillage | propriétaire risque puis maintenance outillage | décision SHA-bound réelle | exception bornée ou audit complet à zéro high |
| P0 exploitation | Redis/SMTP | secrets et connectivité production non configurés dans ce lot | exploitation | accès autorisé | smoke tests et alertes, flags encore faux |
| P1 pédagogie | calibrage | aucun seuil réel validé | responsable pédagogique/data | étude de calibration | politique versionnée approuvée et tests de non-régression |
| P1 QA | E2E HTTP positif réel | corpus réel volontairement non affectable | QA + pédagogique | premier module approuvé | parcours sans interception sur services réels |
| P1 produit | audience élève | audience prévue par contrat mais décision produit finale non consignée | produit + juridique/pédagogique | décision audience | matrice de données approuvée ou audience désactivée |
| P1 opérations | workers outbox | traitement asynchrone existant à qualifier pour les nouveaux types | plateforme | environnement de staging | profondeur stable, retry et DLQ testés |
| P1 observabilité | alertes | seuils documentés, connecteur non installé | SRE | stack métriques | alertes testées avec preuve |
| P2 UX | équipe | identifiants techniques saisis pour scoring/publication | produit/frontend | retours utilisateurs internes | sélection guidée et test d'accessibilité |
| P2 architecture | config Prisma | avertissement de dépréciation `package.json#prisma` | plateforme | migration Prisma 7 planifiée | `prisma.config.ts` testé sans dérive |

## Hors périmètre assumé

- enrichissement LLM ;
- seuils de groupe non validés ;
- module Physique-Chimie Seconde absent ;
- activation/déploiement/migration production ;
- approbation de risque ou pédagogique par Codex.

Aucun de ces éléments n'est caché dans un `TODO` du moteur.
