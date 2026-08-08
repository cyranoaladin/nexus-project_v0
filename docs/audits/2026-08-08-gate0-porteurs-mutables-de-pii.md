# GATE 0 — Porteurs mutables de PII ré-identifiante

## Date

8 août 2026, fuseau `Africa/Tunis`.

## Objet et méthode

Préalable bloquant à la conception de l'effacement RGPD : établir la liste
**exhaustive** des emplacements **mutables** portant un identifiant réel
ré-identifiable. L'affirmation antérieure « seules `users`, `students` et
`parent_profiles` portent la clé de ré-identification » **est fausse** ; elle
est corrigée ici.

Méthode délibérément non déclarative : introspection du schéma **de la base de
production** (623 colonnes candidates), comptage **exact** de toutes les
tables, puis test empirique des colonnes de texte libre et JSON contre les
noms et adresses réels présents en base. Les lectures de code seules avaient
déjà produit une erreur ; toute affirmation ci-dessous est vérifiée contre la
donnée réelle.

**Avertissement de méthode** : un test naïf `ligne::text ILIKE '%nom%'` produit
des faux positifs massifs — un prénom de 4 lettres se retrouve par hasard dans
les identifiants `cuid`. Un premier passage annonçait ainsi 26/26 lignes
`SessionBooking` porteuses de PII ; recadré sur les seules colonnes de contenu,
le vrai chiffre est **0**. Les chiffres ci-dessous sont ceux du test recadré.

## Résultat 1 — la chaîne append-only est confirmée propre

Preuve structurelle : sur les 623 colonnes candidates, **aucune** colonne
d'identité (`firstName`, `lastName`, `email`, `phone`, `address`, …) n'est
portée par une table protégée par trigger append-only ou trigger
d'immuabilité. Les 50 colonnes de ces tables sont des identifiants, des
statuts, des scores et des horodatages.

Preuve empirique complémentaire : `canonical_evidence_items` (54 lignes, non
vérifiée jusqu'ici) ne contient **aucune** adresse e-mail et **aucun** prénom
réel ; ses clés de payload sont purement pédagogiques (`itemId`, `nodeCpsId`,
`profile`, `weight`…). Idem pour `canonical_api_idempotency_keys.response`
(0 correspondance).

L'effacement n'a donc **rien** à faire sur l'immuable, ce qui confirme
l'abandon du chiffrement et du crypto-shredding.

## Résultat 2 — porteurs mutables **atteignables** par une FK vers l'identité

Une routine d'effacement qui parcourt les clés étrangères depuis `users`
atteint ceux-ci.

| Table (lignes prod) | PII réelle | Correspondances réelles mesurées |
|---|---|---|
| `users` (254) | email, firstName, lastName, phone, password, activationToken, totpSecret | — |
| `students` (154) | school, birthDate, grade, survivalModeReason | — |
| `parent_profiles` (76) | address, city, country | — |
| `user_documents` (13) | title, originalName, description, localPath **+ fichier disque** | **4 lignes** |
| `sessions` (12) | title, description, report | **1 ligne** |
| `entitlements` (5) | label, metadata | **3 lignes** |
| `ai_processing_jobs` (5) | inputData, outputData | **3 lignes** |
| `copy_pages` (4) / `copy_submissions` (1) | ocrText (copie manuscrite), originalFilename **+ fichiers disque** | **2 lignes** |
| `maths_progress` (4) | diagnosticResults, errorTags, exerciseResults | **2 lignes** |
| `stage_bilans` (1) | contentEleve, contentParent, contentInterne | **1 ligne** |
| `payments` (1) | description, metadata, **termsAcceptedIp** | **1 ligne** |

Mesurés à **0** correspondance, donc hors périmètre aujourd'hui mais à
couvrir par principe : `SessionBooking` (26), `coach_student_assignments` (19),
`session_reports` (10), `invoice_items` (10), `trajectories` (1),
`pedagogical_reports` (1), `aria_conversations` (4).

## Résultat 3 — porteurs **invisibles** à un parcours de FK (le vrai risque)

C'est l'ensemble critique : ces lignes portent de la PII réelle et **aucune
clé étrangère ne mène jusqu'à elles**. Une routine d'effacement indexée sur
`userId` les manque intégralement, et l'immuable étant pseudonyme, ce sont
elles qui redeviennent le chemin de ré-identification.

| Table | Lignes | Situation vérifiée en production |
|---|---:|---|
| `assessments` | 15 | **les 15 lignes** ont `studentId IS NULL` **et** un `studentName` réel, plus `studentEmail`, `studentPhone`, `ipAddress`, `userAgent` et les markdown de rapport. Ce sont les soumissions du formulaire public : elles n'ont jamais eu de compte. |
| `contact_leads` | 10 | **10 lignes** avec nom, e-mail, téléphone. Table autonome, aucune FK. |
| `invoices` | 5 | **5 lignes** avec `customerName`, `customerEmail`, `customerAddress`. `createdByUserId`/`beneficiaryUserId` sont de simples chaînes **sans FK** — aucun cascade ne les atteindra jamais. |
| `stage_reservations` | 3 | 1 ligne orpheline avec nom ; porte aussi un `activationToken` **en clair**. |
| `bilans` | 14 | `studentId` en `SetNull` : 0 orpheline aujourd'hui, mais **toute suppression d'élève en crée une**, conservant `studentName`, `studentEmail`, `studentPhone` et les markdown. |
| `diagnostics` | 0 | Vide aujourd'hui, mais porte `studentFirstName`, `studentLastName`, `studentEmail`, `studentPhone`, `teacherName`, `establishment` **sans aucune FK**. Risque futur. |
| `notifications`, `npc_audit_logs`, `canonical_api_idempotency_keys` | — | `userId`/`actorId` sont des chaînes nues sans FK. Propres aujourd'hui, structurellement hors d'atteinte. |

**31 lignes de PII réelle sont aujourd'hui hors de portée d'un effacement par
parcours de clés étrangères.**

## Résultat 4 — fichiers sur disque, et un piège de configuration

| Chemin | Contenu | État |
|---|---|---|
| `/var/www/nexus-shared/documents` (= `DOCUMENT_STORAGE_ROOT`) | — | **vide** |
| `/var/www/nexus-shared/invoices` (= `INVOICE_STORAGE_DIR`) | — | **vide** |
| `/var/www/nexus-shared/storage/documents` | **19 fichiers réels** : PDF de factures (`facture-*.pdf`, contenant nom et adresse du parent) et documents utilisateurs | **c'est là que vivent les données** |

Les variables d'environnement configurées pointent vers des répertoires
**vides** ; les fichiers réels sont dans un chemin hérité différent. Une
routine d'effacement qui suivrait `DOCUMENT_STORAGE_ROOT` ne supprimerait
**aucun** des 19 fichiers. À trancher avant tout build : réconcilier les
chemins, ou traiter explicitement les deux.

Par ailleurs, la suppression d'une ligne `user_documents` en cascade **ne
supprime pas** le fichier sur disque : sans traitement explicite, les fichiers
deviennent orphelins tout en conservant leur contenu nominatif.

## Résultat 5 — file d'e-mails : déjà chiffrée au repos

`canonical_job_outbox` (`jobType = SEND_EMAIL`, 7 lignes) stocke le
destinataire et le corps rendu dans un `ciphertext` AES-256-GCM
(`iv`/`tag`/`keyVersion: v1`). Le seul champ en clair est `messageId`, qui est
un en-tête SMTP standard `<uuid@mail.nexusreussite.academy>` — **pas** une
adresse de destinataire. Aucune PII en clair, donc.

Deux réserves : la clé est une variable d'environnement **globale**, partagée
par tous les sujets — on ne peut pas crypto-shredder un sujet isolément ; et
la table n'a **aucune FK** vers `users`. L'effacement doit donc y supprimer
des lignes ciblées, pas s'appuyer sur un cascade. À noter aussi que seules
les lignes `COMPLETED` sont purgées (30 jours par défaut) : les états
`FAILED_FINAL`, `AMBIGUOUS` et `PENDING` ne le sont jamais.

## Résultat 6 — la suppression est de toute façon impossible

Plusieurs FK en `Restrict` bloquent tout `DELETE FROM users` pour un élève
ayant un bilan : `canonical_assessment_attempts`, `canonical_report_artifacts`,
`canonical_parent_student_links`, `canonical_notification_outbox`,
`clictopay_transactions`, `stage_documents.uploadedById`,
`candidate_diagnostics.createdById`,
`candidate_diagnostic_documents.uploadedById`. Constaté en conditions réelles
lors du nettoyage du 8 août.

L'effacement doit donc être une **anonymisation en place** (UPDATE sur le
mutable), jamais une suppression — ce qui est cohérent avec la conception
retenue et ne touche aucun trigger.

## Conclusion de GATE 0

Le périmètre réel de l'effacement est de **11 tables atteignables par FK**,
**6 tables non atteignables devant être balayées par chaîne** (nom, e-mail,
téléphone), **19 fichiers sur disque à un chemin non configuré**, et **une
file d'e-mails chiffrée sans FK**. Ce n'est pas un problème circonscrit à la
chaîne bilan : c'est un effacement applicatif transverse.

Aucune modification n'a été faite. Ce document est un cadrage.
