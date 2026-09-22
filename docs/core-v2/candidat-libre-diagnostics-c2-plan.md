# Diagnostics candidats libres — C2 (branche séparée de C1)

Branche `feat/candidat-libre-diagnostics-jalon-c2`, synchronisée avec la
tête réelle de C1 (`e41b02188`, puis les correctifs post-fusion #315 —
transport antivirus sans Docker, root cause corrigée, fuite ASSISTANTE
corrigée, cycle de traitement réellement résumable, troncature explicite)
avant sa propre qualification, sans jamais réintroduire un défaut déjà
corrigé côté C1. Jamais fusionnée dans C1 tant que celui-ci n'est pas
lui-même revu et fusionné sur `main`. Parcours attendu : soumission C1 →
traitement persistant → projet de bilan → revue pédagogique → publication
autorisée.

## État réel à ce stade (mise à jour, ceci n'est plus seulement un plan)

Écrit, testé et migré (Core v2), pas seulement prévu :
- `DiagnosticSubmissionProcessing` / `DiagnosticSubmissionExtraction`
  (migrations 0011-0013) : un traitement par soumission, jamais recréé ;
  une révision par tentative, jamais écrasée.
- Cycle enqueue/drain à bail (`leaseOwner`/`leaseExpiresAt`/`attemptCount`),
  même patron que `lib/bilans/worker/drain-outbox.ts` (`FOR UPDATE SKIP
  LOCKED`, bail qui expire plutôt que statut qui peut rester bloqué,
  plafond de tentatives). Le worker réel est
  `lib/core-v2/diagnostics/processing-scheduler.ts`, câblé dans
  `instrumentation.ts`, opt-in via `DIAGNOSTIC_PROCESSING_WORKER_ENABLED`.
- Extraction de texte bornée en durée (délai réel, processus réellement
  tué — pas seulement l'attente abandonnée) et en taille stockée, avec
  troncature explicite (`truncated`, `totalCharacterCount`) — jamais un
  extrait partiel présenté comme la réponse complète.
- Séparation RBAC vérifiée par contre-épreuve HTTP : déclencher/suivre un
  traitement (ASSISTANTE, `DIAGNOSTIC_SUBMISSION_TRACK`) ne renvoie plus
  jamais le texte académique lui-même, qui reste derrière la route dédiée
  (`DIAGNOSTIC_SUBMISSION_CONTENT_READ`, ADMIN).

Ce qui suit reste réellement non écrit : correction déterministe, appel
IA, interface de revue pédagogique, gestion des révisions de bilan,
contrôles de publication.

## Autorité et réutilisation

- Identité/dossier : Core v2 (comme C1).
- Traitement : file persistante dédiée (ci-dessus), inspirée du patron
  déjà existant `lib/npc/` (`CopySubmission → AiProcessingJob →
  PedagogicalReport`, revue humaine obligatoire) et de
  `lib/bilans/llm/teacher-brief-service.ts` (`TeacherBrief`, statut
  `PENDING_REVIEW`, jamais montré aux familles) — sans réutiliser ces
  modèles directement : ils sont scopés aux élèves inscrits/coachs, pas au
  candidat libre, et leurs contrats (Student+CoachProfile obligatoires)
  ne correspondent pas à ce dont C1 dispose (un Student existe bien via
  Core v2, mais aucun coach n'est nécessairement assigné à un candidat
  libre).
- IA : voir « Prérequis IA — état vérifié » ci-dessous. Aucun appel réel
  n'a été effectué ni déclenché dans cette passe.

## Références figées (jamais relues après création)

Un `DiagnosticSubmissionProcessing` fige, au moment de sa création :
- `submissionId` (unique — un traitement par soumission, jamais recréé
  pour la même soumission ; une nouvelle soumission = un nouveau
  traitement) ;
- `submissionSha256Snapshot` / `submissionVersionSnapshot` /
  `subjectVersionSnapshot` — copiés depuis la soumission et l'attribution
  au moment de l'enqueue, jamais relus depuis une source mutable après.

Un futur `processingConfigSnapshot` (quelle configuration IA — activation,
modèle autorisé, budget, délais, reprises — était active à l'enqueue) et
`aiModelVersion` (nullable : renseigné seulement si un appel IA réel a eu
lieu) restent à ajouter au moment où un appel IA réel devient autorisé —
non ajoutés maintenant pour ne pas figer un contrat avant que ces valeurs
aient un sens réel.

Statuts (fermés, transitions explicites, même discipline que
`DiagnosticAssignmentStatus`/`CatalogStatus`) — la partie EXTRACTION est
livrée : `QUEUED → EXTRACTING → EXTRACTED → NO_EXTRACTABLE_TEXT` ou
`EXTRACTION_FAILED`. La suite (`SCORED_DETERMINISTIC → AI_ASSISTED_DRAFT →
PEDAGOGICAL_REVIEW → PUBLISHED`, avec `AI_UNAVAILABLE` comme sortie
explicite) reste à construire, sur ce même modèle de statuts fermés et de
sorties explicites — jamais un repli silencieux présenté comme « analysé
par IA ».

## Séparation stricte : correction déterministe / proposition IA / décision pédagogique

Trois enregistrements distincts par item, jamais fusionnés dans un seul
champ libre — reste à construire :
1. **Correction déterministe** — appliquée uniquement quand la réponse est
   objectivement vérifiable (QCM à clé stable, réponse courte à motif
   fixe). Jamais pour une tâche ouverte. Ne nécessite aucun accès IA —
   c'est la prochaine tranche concrète à écrire, indépendamment du
   prérequis IA ci-dessous.
2. **Proposition IA** — un texte + un lien explicite vers l'item, la page/
   zone source, et le niveau d'incertitude d'extraction. Jamais présentée
   comme la correction elle-même. Nécessite le prérequis IA.
3. **Décision pédagogique** — le relecteur accepte, corrige ou rejette la
   proposition ; seule cette décision produit un score retenu. Ne
   nécessite aucun accès IA pour exister comme mécanisme (l'interface de
   revue peut être construite et testée sans appel IA réel, en revuant
   une proposition simulée en isolation explicite).

## Audiences

Reprend la matrice déjà en vigueur (mission §9) : vue interne complète
(relecteur pédagogique), version candidat, synthèse famille autorisée —
jamais mélangées dans une même réponse API. Le rôle « relecteur
pédagogique » est distinct de la vue logistique ASSISTANTE déjà livrée en
C1/C2 (`DIAGNOSTIC_SUBMISSION_TRACK`/`DIAGNOSTIC_CATALOG_READ`) : une
nouvelle capacité RBAC dédiée sera nécessaire (non ajoutée dans cette
passe — voir ci-dessous).

## Prérequis IA — état vérifié dans cette passe (mission §7)

Vérifié sans afficher aucune valeur de secret et sans déclencher aucun
appel réel : des clés de fournisseur LLM existent dans l'environnement de
développement de cette session (présence confirmée par nom de variable
uniquement), et une intégration technique avec un fournisseur externe
existe déjà ailleurs dans le dépôt pour une fonctionnalité distincte
(`lib/bilans/llm/teacher-brief-service.ts`, avec une clé déployée en
production pour CETTE fonctionnalité-là — voir la mémoire du projet,
02/08/2026).

Ce qui n'est PAS vérifié, et qui reste une vraie question pour le
propriétaire, distincte de « une clé existe quelque part » :
- **Compte fournisseur accessible pour CETTE fonctionnalité** (candidat
  libre, diagnostics C2) — non confirmé.
- **Modèle autorisé** pour ce traitement spécifique — non confirmé.
- **Budget établi et borné** pour ce traitement — non confirmé.
- **Autorisation explicite d'envoyer même les seules données synthétiques
  du pilote** (le sujet/la réponse DEMO_FIXTURE) à un fournisseur externe
  — non confirmée.

Aucun appel IA n'a été effectué ni déclenché dans cette passe, sur aucune
donnée, synthétique ou autre.

**Ce prérequis ne bloque PAS** (contrairement à une affirmation antérieure
de ce document, retirée) : la correction déterministe, les contrats de
résultats, l'interface de revue, la gestion des révisions, les contrôles
de publication. Ces parties peuvent et doivent avancer sans attendre une
confirmation de budget — seul l'appel réel au fournisseur IA lui-même
l'attend.

## Prochain incrément concret

Le socle d'extraction (modèle, migration, service d'enqueue/drain,
extraction bornée et résumable) est livré — voir « État réel » ci-dessus.
Le prochain incrément indépendant du prérequis IA : la correction
déterministe d'un item à clé stable (le QCM du sujet de démonstration),
référençant explicitement la soumission, son empreinte et la version du
sujet — jamais un fichier mutable désigné par son nom — avec un état
consultable par l'acteur autorisé et une distinction stricte entre
correction déterministe et proposition IA dès sa conception, même avant
que la seconde existe réellement.
