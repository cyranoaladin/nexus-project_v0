# Décisions requises

| ID | Décision | Recommandation | Requis avant |
|---|---|---|---|
| D01 | Valider la chaîne canonique et les quatre machines d'état | adopter les dix entités, pas un enum/table universels | Lot D |
| D02 | Rôles enseignant/responsable | capacités explicites, rôles humains seulement si gouvernance le requiert | Lots B/D/I |
| D03 | Rattachement légal | `GuardianStudentLink` N–N vérifié, permissionné, révocable | Lot D/H |
| D04 | Audience et approbation | versions séparées ; parent toujours revue humaine au lancement | Lot H |
| D05 | Queue durable | PostgreSQL outbox + jobs comme source de vérité ; BullMQ seulement si besoin mesuré | Lot F |
| D06 | Backend RAG | décider après inventaire production ; maintenir Chroma par défaut transitoire | Lot G |
| D07 | Embeddings/corpus | un modèle/dimension par version de corpus, pas de coercition silencieuse | Lot G |
| D08 | Fournisseur LLM | registre d'usages, région/rétention/coût ; Mistral/Ollama à comparer sur staging | Lot G |
| D09 | Stockage artefacts | objet privé S3-compatible avec chiffrement/version/lifecycle | Lot H |
| D10 | Politique de rétention | durées par réponses, evidence, rapports, PDFs, logs et prompts | Lots D/G/H |
| D11 | Horizon curriculum | fenêtre explicitement vérifiée, renouvellement annuel, fail closed | Lot C |
| D12 | Pilote | Maths entrée Seconde 2026-2027, petit groupe, fallback déterministe | Lot J |

## Arbitrages à formaliser

### Score et publication

Décider qui peut relancer un scoring après correction de règle : la recommandation est nouveau `ScoringRun` et nouveau snapshot, jamais modification. Définir si l'élève voit tous les axes dès `SCORED` ou une projection bornée ; le score global ne doit pas attendre le rapport.

### Famille

Définir preuve de lien, permissions (`VIEW_REPORTS`, `DOWNLOAD_PDF`, `RECEIVE_NOTIFICATIONS`), gestion des désaccords entre responsables et procédure de révocation. Ne pas auto-vérifier les liens historiques sans trace : les backfiller avec statut/méthode « legacy-migration » et campagne de confirmation si juridiquement requise.

### Revue

Définir reviewer et publisher séparés ou cumulables, SLA, motifs de rejet, quorum pour une question/curriculum et version de template. L'assistante ne reçoit que la visibilité opérationnelle nécessaire.

### Production

Choisir l'autorité d'exploitation et le runbook unique PM2/Docker. Confirmer backup/restore, stockage objet, queue, métriques/alertes et DPA fournisseurs avant données réelles.

## Décisions déjà imposées par le cahier des charges

Une seule application `nexus-project_v0`, pas de plateforme parallèle ; score indépendant du LLM ; RAG cité/versionné ; revue humaine parent ; PDF privé ; migration additive/réversible ; anciens workflows préservés pendant transition ; aucune intégration curriculum runtime dans cette reconstruction.
