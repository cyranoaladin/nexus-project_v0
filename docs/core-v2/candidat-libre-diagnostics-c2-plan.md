# Diagnostics candidats libres — C2 (démarrage, branche séparée de C1)

Branche `feat/candidat-libre-diagnostics-jalon-c2`, forkée du commit C1
(`90a8327af`, PR #314) — indépendante, jamais fusionnée dans C1 tant que
C1 n'est pas lui-même revu/fusionné. Premier parcours attendu : soumission
C1 → traitement persistant → projet de bilan → revue pédagogique →
publication autorisée.

## Autorité et réutilisation

- Identité/dossier : Core v2 (comme C1).
- Traitement : nouvelle file persistante dédiée (voir modèle ci-dessous),
  inspirée du patron déjà existant `lib/npc/` (`CopySubmission →
  AiProcessingJob → PedagogicalReport`, revue humaine obligatoire) et de
  `lib/bilans/llm/teacher-brief-service.ts` (`TeacherBrief`, statut
  `PENDING_REVIEW`, jamais montré aux familles) — sans réutiliser ces
  modèles directement : ils sont scopés aux élèves inscrits/coachs, pas au
  candidat libre, et leurs contrats (Student+CoachProfile obligatoires)
  ne correspondent pas à ce dont C1 dispose (un Student existe bien via
  Core v2, mais aucun coach n'est nécessairement assigné à un candidat
  libre).
- IA : fournisseur et mécanismes déjà autorisés ailleurs dans le dépôt
  (à confirmer lequel exactement avant tout appel réel — budget et accès
  non vérifiés dans cette passe, voir « Prérequis manquant » ci-dessous).

## Références figées (jamais relues après création)

Un `DiagnosticSubmissionProcessing` (à créer, migration Core v2 séparée
de celle de C1) fige, au moment de sa création :
- `submissionId` (unique — un traitement par soumission, jamais recréé
  pour la même soumission ; une nouvelle soumission = un nouveau
  traitement) ;
- `subjectVersionSnapshot` / `bareme` / `grilleSnapshot` — copiés depuis
  `DiagnosticAssignment.*Snapshot` au moment de l'enqueue, jamais relus
  depuis le catalogue après ;
- `transcriptionRevision` — incrémenté à chaque nouvelle extraction/
  transcription humaine ou automatique, jamais un écrasement de la
  précédente ;
- `processingConfigSnapshot` — quelle configuration IA (activation,
  modèle autorisé, budget, délais, reprises) était active à l'enqueue ;
- `aiModelVersion` — nullable : renseigné seulement si un appel IA réel a
  eu lieu (jamais une valeur inventée pour un repli déterministe).

Statuts (fermés, transitions explicites, même discipline que
`DiagnosticAssignmentStatus`/`CatalogStatus`) :
`QUEUED → EXTRACTING → SCORED_DETERMINISTIC → AI_ASSISTED_DRAFT →
PEDAGOGICAL_REVIEW → PUBLISHED`, avec `FAILED_EXTRACTION` et
`AI_UNAVAILABLE` comme sorties explicites (jamais un repli silencieux
présenté comme « analysé par IA »).

## Séparation stricte : correction déterministe / proposition IA / décision pédagogique

Trois enregistrements distincts par item, jamais fusionnés dans un seul
champ libre :
1. **Correction déterministe** — appliquée uniquement quand la réponse est
   objectivement vérifiable (QCM à clé stable, réponse courte à motif
   fixe). Jamais pour une tâche ouverte.
2. **Proposition IA** — un texte + un lien explicite vers l'item, la page/
   zone source, et le niveau d'incertitude d'extraction. Jamais présentée
   comme la correction elle-même.
3. **Décision pédagogique** — le relecteur accepte, corrige ou rejette la
   proposition ; seule cette décision produit un score retenu.

## Audiences

Reprend la matrice déjà en vigueur (mission §9) : vue interne complète
(relecteur pédagogique), version candidat, synthèse famille autorisée —
jamais mélangées dans une même réponse API. Le rôle « relecteur
pédagogique » est distinct de la vue logistique ASSISTANTE déjà livrée en
C1 (`DIAGNOSTIC_SUBMISSION_TRACK`/`DIAGNOSTIC_CATALOG_READ`) : une
nouvelle capacité RBAC dédiée sera nécessaire (non ajoutée dans cette
passe — voir ci-dessous).

## Prérequis manquant, explicitement non résolu ici

Le budget IA autorisé et borné, et l'accès réel au fournisseur pour cette
fonctionnalité spécifique, n'ont pas été vérifiés dans cette passe. Sans
ce prérequis, le premier essai réel sur données synthétiques ne peut pas
être conduit. Ce qui suit reste donc non commencé tant que ce prérequis
n'est pas confirmé par le propriétaire :
- l'appel réel au fournisseur IA ;
- le worker de consommation de la file (à câbler sur un mécanisme déjà
  actif dans l'environnement de qualification, jamais une file alimentée
  sans consommateur) ;
- l'UI de revue pédagogique et de publication.

Ce qui est indépendant de ce prérequis et constitue le prochain incrément
concret à livrer sur cette branche : le modèle Core v2
`DiagnosticSubmissionProcessing` et sa migration, le service d'enqueue
(figeant les références ci-dessus), et l'extraction de texte pour les PDF
dont le texte est déjà disponible (sans OCR) — aucun de ces éléments
n'a encore été écrit dans cette passe.
