# P0-004 Lot 2C — NPC reports/submissions/documents

Date : 2026-05-29

Ce document cadre le prochain sous-lot P0-004 après le déploiement production du Lot 2B. Il ne contient aucune correction applicative.

## Verdict de cadrage

Le Lot 2C doit auditer et corriger les routes NPC qui exposent ou manipulent copies élèves, documents, fichiers disque, rapports pédagogiques générés, sorties IA et jobs de traitement. Le go-live large reste non autorisé tant que ce lot et les lots P0-004 restants ne sont pas triés.

Statut 2026-05-29 : Lot 2C corrigé et testé localement. Rapport détaillé : `docs/security/P0_API_IDOR_LOT2C_NPC_REPORTS_SUBMISSIONS_2026-05-29.md`. Non déployé production dans ce cycle.

## Tableau préparatoire

| Groupe | Route | Méthodes | Données sensibles | Guard actuel | Ownership attendu | Risque | Priorité |
|---|---|---|---|---|---|---|---|
| NPC submissions | `app/api/npc/submissions/route.ts` | À confirmer | Copies élèves, métadonnées dépôt | À lire | Élève propriétaire, coach assigné ou staff | Fuite données mineur / upload abusif | P0-A |
| NPC submission documents | `app/api/npc/submissions/[submissionId]/documents/route.ts` | À confirmer | Documents liés à une copie | À lire | Owner submission, coach assigné ou staff | IDOR document/copie | P0-A |
| NPC submission document detail | `app/api/npc/submissions/[submissionId]/documents/[documentId]/route.ts` | À confirmer | Fichier ou métadonnées document | À lire | Owner submission + document lié | IDOR + accès fichier avant auth | P0-A |
| NPC generate | `app/api/npc/submissions/[submissionId]/generate/route.ts` | À confirmer | Déclenchement IA, copie élève | À lire | Coach assigné ou staff, selon workflow | Génération abusive / coût IA / fuite contexte | P0-B |
| NPC uploads | `app/api/npc/uploads/route.ts` | À confirmer | Upload fichiers élèves | À lire | Utilisateur autorisé + ownership cible | Upload non autorisé / type-size / malware | P0-A |
| NPC files | `app/api/npc/files/[...path]/route.ts` | À confirmer | Fichiers disque originaux/convertis | À lire | Autorisation avant accès disque | Path traversal / fuite fichier | P0-A |
| Coach generated reports | `app/api/coach/students/[studentId]/generated-reports/route.ts` | À confirmer | Rapports pédagogiques IA | À lire | Coach assigné à l'élève ou staff | IDOR rapport élève | P0-A |
| Report download | `app/api/coach/students/[studentId]/generated-reports/[reportId]/download/route.ts` | À confirmer | PDF/rapport, fichiers disque | À lire | Coach assigné + report lié à student | IDOR + accès fichier avant auth | P0-A |
| Report generate | `app/api/coach/students/[studentId]/generated-reports/[reportId]/generate/route.ts` | À confirmer | Sortie IA, rapport ciblé | À lire | Coach assigné + report lié à student | Génération abusive / fuite IA | P0-B |
| Report regenerate | `app/api/coach/students/[studentId]/generated-reports/[reportId]/regenerate/route.ts` | À confirmer | Retry IA, rapport ciblé | À lire | Coach assigné + report lié à student | Retry abusif / coût IA | P0-B |
| EAF report | `app/api/coach/eaf-stage-printemps/students/[studentId]/report/route.ts` | À confirmer | Rapport stage EAF élève | À lire | Coach autorisé sur stage/élève ou staff | IDOR rapport stage | P0-A |
| EAF report regenerate | `app/api/coach/eaf-stage-printemps/students/[studentId]/report/regenerate/route.ts` | À confirmer | Regeneration rapport stage | À lire | Coach autorisé sur stage/élève ou staff | Retry abusif / fuite IA | P0-B |

## Règles de sécurité attendues

- Aucun accès fichier disque avant autorisation.
- Toute route coach doit vérifier que le coach est assigné à l'élève ou explicitement participant au stage/session concerné.
- Un élève ne doit voir que ses propres rapports et seulement les versions visibles côté élève.
- Un parent ne doit voir que les rapports de ses enfants et seulement les versions autorisées.
- Un contenu `COACH_ONLY` ne doit jamais être visible par élève ou parent.
- Les champs `rawAiOutput`, `validatedAiOutput`, `diagnostic`, `storedFilePath`, `originalFilePath`, `convertedFilePaths` et `ocrText` doivent rester limités au staff/coach autorisé selon audience.
- Les jobs IA doivent être staff/admin/worker-only si exposés; jamais publics.
- Les uploads doivent valider type, taille et ownership cible.
- Les downloads doivent interdire le path traversal et valider l'autorisation avant toute lecture disque.

## Tests attendus

- Non-auth refusé sur routes NPC sensibles.
- Coach non assigné refusé sur submission/report d'un autre élève.
- Coach assigné autorisé sur les rapports de ses élèves.
- Élève/parent refusés sur contenus coach-only.
- `storedFilePath`, `originalFilePath`, `convertedFilePaths`, `rawAiOutput` et `ocrText` absents des réponses non staff/coach autorisé.
- Download refuse path traversal.
- Upload refuse type invalide et taille excessive.
- Regenerate/generate refuse un `studentId` ou `reportId` incohérent.

## Hors périmètre Lot 2C

- Messages/conversations : Lot 2D.
- Assessments submit/test : Lot 2E.
- CSP/CORS/Jitsi.
- Monitoring, backup/restore, runtime minimal.
- UX, business, dashboards et pédagogie.
