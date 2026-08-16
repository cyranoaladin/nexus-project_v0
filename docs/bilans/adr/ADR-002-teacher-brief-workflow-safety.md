# ADR-002 — Sécurisation et industrialisation du workflow des briefs enseignant

Statut : accepté (2026-08-16). Fait suite à un incident P0 de gouvernance
pédagogique audité le même jour.

## Incident

Un audit en lecture seule du dashboard assistante (§ voir conversation du
2026-08-16) a confirmé qu'un brief enseignant enrichi par LLM au statut
`PENDING_REVIEW` — c'est-à-dire jamais relu par un humain — pouvait être
inclus dans le dossier enseignant HTML/PDF remis au staff, au même titre
qu'un brief `APPROVED`. L'invariant documenté dans le code
(`teacher-brief-review-service.ts`) affirmait pourtant que seul `APPROVED`
devait atteindre l'enseignant. En production, 28 briefs existaient, tous
`PENDING_REVIEW`, 0 `APPROVED` : si un dossier avait été généré pour un
groupe contenant ces briefs, 100 % du contenu IA qu'il aurait porté n'aurait
jamais été relu par un humain, sans que rien dans le document ne le
signale.

Causes concourantes identifiées :
- une liste de statuts unique (`['PENDING_REVIEW', 'APPROVED']`) servait à
  la fois à bloquer une régénération, à compter un brief « existant » et à
  autoriser le rendu enseignant — trois questions différentes, une seule
  réponse ;
- un repli PLANCHER (échec de génération) ne laissait aucune trace en base,
  empêchant toute corrélation par bilan et tout calcul de coût réel ;
- la génération groupée était synchrone (8–10 minutes de requête HTTP),
  sans progression ni compte rendu ;
- l'édition manuelle acceptait un texte libre re-parsé en JSON par le
  dossier — un texte non JSON pouvait être validé puis disparaître
  silencieusement du document.

## Décision

1. **Invariant fail-closed, défense en profondeur à 3 couches** (§2) :
   - couche 1 — la requête du dossier (`teacher-dossier-service.ts`) ne
     sélectionne QUE les briefs `status: APPROVED` (`BRIEF_STATUSES_SAFE_FOR_TEACHER`,
     `lib/bilans/staff/teacher-brief-status.ts`) ;
   - couche 2 — le service rejette en plus tout brief `APPROVED` dont le
     `scoreSnapshotId` ne correspond plus à la révision COURANTE du bilan
     (staleness, §5) ;
   - couche 3 — le renderer (`teacher-dossier/render.ts`) n'accepte un
     `brief` non nul que s'il porte le marqueur `TEACHER_BRIEF_SAFETY_MARKER`
     posé exclusivement par la couche 2 ; sinon il lève
     `TEACHER_DOSSIER_UNSAFE_BRIEF_RENDER_BLOCKED` et ne rend rien.
   - Testé : `__tests__/bilans/teacher-dossier-render.test.ts` (HTML + PDF,
     extraction textuelle réelle), `__tests__/bilans/teacher-dossier-service.test.ts`.

2. **Trois paliers de dossier explicites** (§3) — `SOCLE_DETERMINISTE`,
   `ENRICHI_SECURISE_PARTIEL`, `ENRICHI_COMPLET` — calculés par
   `computeCompleteness()`. `ENRICHI_COMPLET` exige que chaque élève inclus
   ait soit un brief `APPROVED` courant, soit un statut terminal explicite
   (dernière tentative `DETERMINISTIC_ONLY`, journal des tentatives) —
   jamais « pas encore essayé ». Le document affiche le palier, le nombre
   d'élèves inclus, de briefs approuvés, de socles seuls, et — pour chaque
   élève sans brief approuvé — la phrase fixe « Socle pédagogique
   déterministe utilisé — aucun brief enrichi validé. », jamais une
   formulation laissant croire à une approbation.

3. **Machine de statuts nommée et stricte** (§4) —
   `TeacherBriefStatus` est désormais un enum Postgres natif (migration
   `20260816000000_secure_teacher_brief_workflow`), plus la CHECK
   constraint textuelle redondante. Un trigger SQL
   (`canonical_bilans_guard_teacher_brief_mutation`) refuse toute
   transition hors de : `PENDING_REVIEW → APPROVED`,
   `PENDING_REVIEW → CORRECTION_REQUESTED`,
   `CORRECTION_REQUESTED → SUPERSEDED`. `lib/bilans/staff/teacher-brief-status.ts`
   regroupe quatre ensembles nommés distincts
   (`BRIEF_STATUSES_BLOCKING_DUPLICATE_GENERATION`,
   `BRIEF_STATUSES_PENDING_HUMAN_ACTION`, `BRIEF_STATUSES_SAFE_FOR_TEACHER`,
   `BRIEF_STATUSES_TERMINAL_HISTORY`) — aucune liste dupliquée ailleurs.

4. **Détection des briefs obsolètes** (§5) : la staleness (couche 2
   ci-dessus) est dérivée, pas persistée séparément — un brief `APPROVED`
   dont le `scoreSnapshotId` diffère de la révision courante du bilan
   n'est jamais rendu et compte dans `staleBriefCount` côté dashboard.
   `approveTeacherBrief` refuse en plus l'approbation elle-même si le
   snapshot courant a changé depuis la génération du brief
   (`BRIEF_STALE_SNAPSHOT`, concurrence optimiste).

5. **Édition manuelle structurée** (§6) : `editedContent String?` (texte
   libre) est supprimé (0 valeur non nulle vérifiée en production avant
   suppression) et remplacé par `approvedContent Json?` — même schéma Zod
   que le contenu généré (`teacherBriefSchema`), posé une seule fois à
   l'approbation, ré-ancré sur les faits pédagogiques
   (`assertBriefRespectsFacts`) et le lexique interdit avant écriture. Le
   dossier lit `approvedContent ?? content`, jamais de `JSON.parse` défensif
   sur une chaîne libre.

6. **Journal canonique des tentatives** (§7) — table
   `canonical_teacher_brief_attempts` (append-only, trigger réutilisant le
   garde générique existant), un enregistrement par tentative traitée
   (`GENERATED`, `ALREADY_PRESENT`, `DETERMINISTIC_ONLY`,
   `RETRYABLE_FAILURE`, `BLOCKED_FAILURE`, `BUDGET_BLOCKED`, `STALE_INPUT`,
   `CANCELLED_BEFORE_START`), avec coût réellement engagé (y compris les
   tentatives ratées mais facturées) et `domainOutcomes` (détail par appel
   de domaine). `costUnknown=true` remplace un coût à zéro silencieux
   quand le fournisseur n'a renvoyé aucun usage exploitable (timeout avant
   réponse).

7. **Politique de retry explicite** (§8), appliquée dans
   `lib/bilans/worker/generate-teacher-brief-job.ts` :
   - **A — déterministe, pas une panne** : `TEACHER_BRIEF_TOO_FEW_PRIORITIES`
     → `DETERMINISTIC_ONLY`, job `COMPLETED`, jamais retenté, aucun coût.
   - **B — transitoire, retry borné** : timeout, réseau, HTTP 429/5xx, JSON
     invalide, schéma rejeté, sortie tronquée → `RETRYABLE_FAILURE`, job
     `FAILED`, repris par le cycle de drain existant (`MAX_JOB_ATTEMPTS=20`,
     quarantaine + alerte au-delà — mécanisme déjà éprouvé,
     `drain-outbox.ts`).
   - **C — aucun retry automatique** : PII, lexique interdit, ancrage,
     pack indisponible/checksum différent, configuration invalide →
     `BLOCKED_FAILURE`, job `COMPLETED`, action humaine requise, jamais de
     relâchement des gardes de sécurité pour améliorer un taux de succès.

8. **Traitement asynchrone** (§10) — réutilisation intégrale de
   l'infrastructure canonique déjà en place et éprouvée
   (`canonical_job_outbox`, `FOR UPDATE SKIP LOCKED`, bail/lease,
   `lib/bilans/worker/scheduler.ts` — worker EN PROCESS dans `nexus-prod`,
   démarré par `instrumentation.ts`, jamais un second process PM2, jamais
   le worker NPC). Nouveau type `GENERATE_TEACHER_BRIEF` dans
   `CanonicalJobType`, nouveau `lib/bilans/worker/generate-teacher-brief-job.ts`
   (calqué sur `generate-report-job.ts`), nouveau
   `lib/bilans/llm/teacher-brief-enqueue.ts` (idempotencyKey =
   `teacher-brief:{reportArtifactId}:{scoreSnapshotId}`, contrainte UNIQUE
   déjà existante sur `canonical_job_outbox.idempotencyKey` →
   double clic/deux onglets = `ON CONFLICT DO NOTHING`, aucun effet de
   bord). Le clic assistante répond en dessous de la seconde. Concurrence
   volontairement limitée à 1 génération à la fois
   (`drainTeacherBriefJobs({ limit: 1 })`).

9. **Budget atomique** (§11) — `canonical_teacher_brief_monthly_budgets`
   (une ligne par mois), réservation/régularisation par une unique
   instruction `UPDATE ... WHERE spentUsd + reservedUsd + montant <=
   budgetUsd` (`lib/bilans/llm/teacher-brief-budget.ts`) : aucune lecture
   non verrouillée suivie d'un appel, aucune course possible entre deux
   batches concurrents — prouvé par un test réel (deux réservations
   concurrentes, une seule passe). Le dashboard affiche plafond, dépensé,
   réservé, disponible — jamais invisible, jamais la clé.

10. **Dashboard sans ambiguïté** (§12) — le libellé « briefs manquants »
    est retiré. Chaque carte matière × niveau affiche :
    éligibles / à générer / en file / en cours / à relire / corrections
    demandées / approuvés / socle déterministe / échecs retentés / blocages
    / briefs obsolètes / palier de complétude. Le bouton de génération est
    désactivé pendant un batch actif (`hasActiveBatch`).

11. **Politique des rôles** (§14) — ASSISTANTE : génération, relecture,
    approbation, correction, téléchargement. ADMIN : consultation et
    supervision en lecture seule — aucune action de génération/relecture
    proposée dans l'UI, et refusée côté serveur
    (`assertAssistanteOnly`, `app/dashboard/assistante/bilans/actions.ts`)
    même si elle était appelée directement. COACH/PARENT/ELEVE/anonyme :
    aucun accès (inchangé, déjà couvert par
    `__tests__/architecture/teacher-dossier-confidentiality.test.ts`).

12. **Backfill** (§15) — `scripts/bilans/backfill-teacher-brief-attempts.ts`,
    idempotent, `--dry-run` disponible, source `LEGACY_BACKFILL`. N'auto-
    approuve rien, ne supprime rien, ne modifie aucun contenu existant.
    N'invente PAS l'historique des 61 échecs PLANCHER non corrélables
    constatés dans les logs avant ce correctif (aucun identifiant de bilan
    dans ces lignes de log historiques) — limite documentée ici, pas
    comblée par une supposition.

## Ce que cette ADR NE couvre PAS encore (dette explicite, pas cachée)

- **§9 — qualification LLM en corpus réel** : le protocole de sortie
  structurée (JSON Schema strict si le modèle/OpenRouter le permet) n'a
  pas été évalué sur un corpus de ≥20 bilans réels avec budget plafonné et
  appels réseau réels — cela nécessite une exécution humaine, budgétée,
  hors de cette session en lecture-écriture disposable. Gate minimum
  (0 contenu non conforme, ≤5 % JSON/schéma invalide après retry) **non
  vérifié** : `NOT_READY` sur ce point précis tant que cette qualification
  n'a pas été exécutée.
- **§13 — file de relecture dédiée** (navigation précédent/suivant,
  progression X/Y, conservation de brouillon côté navigateur) : la relecture
  reste intégrée à la page `bilans` existante avec les nouveaux motifs
  structurés et le rejet de tout textarea de JSON libre ; l'ergonomie dédiée
  (page séparée, clavier, brouillon local) reste à construire.
- Reprise après crash worker sous charge concurrente réelle (plusieurs
  workers, plusieurs batches simultanés en environnement de charge) :
  prouvée par construction (verrouillage `FOR UPDATE SKIP LOCKED`,
  réservation budgétaire atomique par UPDATE conditionnel — tous deux des
  mécanismes déjà utilisés et éprouvés ailleurs dans ce worker) et par un
  test d'intégration (réservations concurrentes), mais pas par un test de
  charge dédié.

## Preuves

- Migration testée sur clone avec les 28 (26 au moment du dump) briefs
  réels de production, données synthétiques APPROVED/CORRECTION_REQUESTED/
  SUPERSEDED, dump/restore complet (exit 0, 0 diff de schéma, 94 tables des
  deux côtés) — voir description de PR.
- Suite complète : 9152/9155 tests unitaires passent (3 échecs pré-
  existants, sans rapport, confirmés par `git diff` vide sur les fichiers
  concernés) ; 7/7 tests d'intégration réels (vraie base PostgreSQL,
  jamais de mock de `$queryRaw`) sur le nouveau worker asynchrone.
