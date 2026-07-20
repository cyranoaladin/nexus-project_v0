# Audit frontend, backend et routage

## Conclusion

**NO-GO backend ; GO SOUS CONDITIONS pour la seule conception frontend.** Le portail existant doit être étendu, mais aucun parcours générique diagnostic n'est branché. Les défauts d'autorisation, d'audience, d'idempotence et de durabilité bloquent toute exposition.

## Carte des routes métier

Inventaire produit par `rg --files app/api | rg '/route\.ts$' | rg '(assessment|diagnostic|questionnaire|bilan|report|pdf|parent|student|eleve|coach|admin|rag|aria|npc|generate)'`: 123 fichiers pertinents. Le build confirme les URLs. Les routes administratives génériques ont été inspectées pour leur guard mais ne font pas partie de la future chaîne de diagnostic.

| Route exacte / groupe homogène | Méthode | Fonction / workflow | Guard / validation | Transaction, idempotence, rate | Décision / risque |
|---|---|---|---|---|---|
| `/api/assessments/submit` | POST | soumission, score, génération | Zod + rate-limit, **sans auth** | aucune transaction/idempotency; fire-and-forget | remplacer/fusionner ; P0/P1 |
| `/api/assessments/[id]/status` | GET | progression | session + `buildAssessmentAccessWhere` | lecture | conserver après audience |
| `/api/assessments/[id]/result` | GET | résultat | session + ownership | retourne student + parents Markdown | fusionner ; fuite inter-audiences |
| `/api/assessments/[id]/export` | GET | export | session + ownership | pas d'URL publique | conserver sous conditions |
| `/api/assessments/predict` | POST | prédiction | guard et ownership testés | coûteux, rate à confirmer | séparer du score |
| `/api/assessments/test` | GET/POST | diagnostic technique | guard dépôt | hors workflow | ne pas exposer au parcours |
| `/api/diagnostics/definitions` | GET | définitions | public, pas d'ownership | lecture | ne doit jamais exposer corrections |
| `/api/bilan-pallier2-maths`, `/retry` | POST | ancien diagnostic/génération | flux spécifique | async spécifique | migrer vers chaîne canonique |
| `/api/bilans` | GET/POST | liste/création canonique annoncée | rôles ; coach non assigné vérifié insuffisamment au POST | hors transaction | bloquer arbitraire studentId |
| `/api/bilans/[id]` | GET/PUT/DELETE | contenu/statut/publication | ownership lecture/écriture | pas de state machine/version; DELETE destructif | remplacer API de publication |
| `/api/bilans/[id]/export` | GET | export | ownership | à conserver après audiences | P1 tant que publication booléenne |
| `/api/bilans/generate` | POST/GET | lance/suit LLM+RAG | rôle seulement, pas ownership ID | client choisit collections; fire-and-forget; pas rate | **P0** |
| `/api/eleve/questionnaire-eaf-stage-printemps` | GET/POST | questionnaire EAF | élève session | flux dédié | migrer |
| `/api/eleve/questionnaire-maths-premiere-stage-printemps` | GET/POST | questionnaire maths | élève session | flux dédié | migrer |
| `/api/eleve/bilan-diagnostic-maths-terminale` | GET | diagnostic maths | élève session | lecture | migrer |
| `/api/coach/students/[studentId]/bilan-diagnostic-maths-terminale` | GET/PUT | bilan coach | assignation | flux dédié | migrer |
| `/api/coach/eaf-stage-printemps/students/[studentId]/report{,/regenerate}` | GET/POST | rapport EAF | coach + assignation | régénération synchrone | fusionner |
| `/api/coach/maths-premiere-stage-printemps/students/[studentId]/report` + 2 regenerations | GET/POST | rapport maths audiences | coach + assignation | chaîne parallèle | fusionner |
| `/api/coach/students/[studentId]/eaf-preparation-report{,/validate}` | GET/PUT/POST | collecte/validation coach | coach + assignation | statut dédié | adapter comme preuve |
| `/api/coach/students/[studentId]/generated-reports` | GET | jobs/rapports | coach + assignation | lecture | conserver après convergence |
| `/.../generated-reports/[reportId]/generate`, `/regenerate` | POST | traitement rapport | coach + assignation/report | synchrone, pas de queue durable/rate | remplacer par enqueue idempotent |
| `/.../generated-reports/[reportId]/download` | GET | PDF privé | coach + assignation + report.studentId; no-store | fichier local | guard positif, stockage à remplacer |
| `/api/parent/bilans/[id]/pdf` | GET | PDF parent | parent + ownership/publication | génération protégée | conserver principe |
| `/api/parent/children`, `/dashboard`, `/stages` | GET | relations parent | parent + lien | lecture | modèle mono-parent limite |
| `/api/student/bilans/[publicShareId]` | GET | partage bilan élève | token publicShareId | identifiant doit être imprévisible/révocable | revoir pour audience |
| `/api/npc/submissions{,/[id]/generate}` et documents | divers | correction de copies | RBAC NPC | worker/stockage propres | adapter, ne pas fusionner aveuglément |
| `/api/programme/maths-1ere/rag`, `/maths-1ere-stmg/rag` | POST | RAG programme | session selon route | timeout client RAG | fusionner filtres/provenance |
| `/api/aria/chat`, `/conversations`, `/feedback` | POST/GET | assistant ARIA | auth/quota propres | fournisseur OpenAI | hors scoring ; conserver séparé |

Toutes les routes s'exécutent au runtime Node par défaut sauf déclaration locale contraire ; aucun runtime Edge pertinent au curriculum n'a été trouvé. La recherche de `$transaction` dans ces routes montre qu'aucune des soumissions/générations critiques citées n'encapsule l'ensemble du workflow.

## Preuves critiques

- Identité client : `assessments/submit/route.ts:48,118-138`; score serveur correct `:73-108`; trois écritures séparées `:118-166`; async non durable `:168-182`.
- Audience : `assessments/[id]/result/route.ts:40-56,124-146` sélectionne et renvoie simultanément `studentMarkdown` et `parentsMarkdown`. `lib/security/ownership.ts:161-172` ne retire que les champs internes, pas l'autre audience.
- IDOR de génération : `bilans/generate/route.ts:45-55` fait `findUnique(id)` sans `buildBilanWriteWhere`; le GET a le même défaut `:135-188`.
- Création coach : `bilans/route.ts:140-180` fixe le coach courant mais ne prouve pas son assignation à `studentId`.
- Mutation large : `bilans/[id]/route.ts:30-50,145-177` permet score, trois contenus, statut et publication sans machine d'état ni revue.

## Navigation et frontend

- `app/dashboard/eleve` contient cockpit, bilans/stages, questionnaires spécifiques ; aucun catalogue « Mon diagnostic de rentrée » ni reprise générique.
- `app/dashboard/parent` fournit enfants, finances, stages et NPC, mais pas une bibliothèque unifiée de rapports publiés par audience.
- `app/dashboard/coach` expose bilans et dossiers ; le panneau GeneratedReports a un rafraîchissement manuel, pas polling/événement.
- Admin/assistante existent ; enseignant et responsable pédagogique ne sont pas des rôles routés.
- Les composants gèrent plusieurs vides/erreurs, mais aucun test E2E ne prouve le futur parcours, sa reprise ou son accessibilité responsive.

Parcours cible non atteint :

```text
connexion élève → dashboard existant → diagnostic disponible → tentative durable
→ autosave/reprise → soumission idempotente → score déterministe
→ job durable → revue → publication audience → rapport
```

```text
connexion parent → lien parent-enfant vérifié → rapports PARENT publiés
→ endpoint/PDF privé → aucune donnée interne/élève non autorisée
```

Le nouvel écran doit être un module des dashboards existants, pas un portail autonome.
