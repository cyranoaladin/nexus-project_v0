# Diagnostic candidat libre 2027 — Audit de séparation élève/parent/staff

## Source de vérité

- Matrice de lecture (single source of truth) : `lib/diagnostics/candidat-libre/access.server.ts` —
  `canViewModuleDetail(role, moduleAudience)` pour le détail des modules,
  `isDocumentVisibleToViewer(category, role)` pour les documents.
- Sérialiseur partagé (routes racine) : `lib/diagnostics/candidat-libre/serialize.server.ts` — délègue
  entièrement à `canViewModuleDetail`/`isDocumentVisibleToViewer`, ne réimplémente rien.
- Permission d'écriture (distincte de la lecture) : `canEditAudience` dans
  `app/api/diagnostics/candidat-libre/[diagnosticId]/modules/[moduleKey]/route.ts`.
- Preuve tests : `__tests__/lib/diagnostics/candidat-libre/serialize.test.ts` (matrice `canViewModuleDetail`
  exhaustive par couple rôle × audience, `isDocumentVisibleToViewer` par catégorie × rôle),
  `__tests__/api/diagnostics/candidat-libre/staff-export-content-visibility.test.ts`,
  `__tests__/api/diagnostics/candidat-libre/module-detail-visibility.test.ts`.

## V3 — le critère change de nouveau, et pourquoi

**V1** classait par rôle exclu par le gate (« ELEVE/PARENT bloqués ⇒ jugé sûr ») — a laissé passer le trou
`staff-export`/COACH.

**V2** classait par « quelle audience le champ vise », mais a fait une erreur inverse : elle a traité
`canEditAudience` (qui gouverne qui peut MODIFIER une réponse) comme si elle gouvernait aussi qui peut la
LIRE. Sur cette base, un COACH — qui ne peut jamais éditer — a été considéré comme ne devant jamais lire
non plus. C'est un faux parallèle : le COACH travaille précisément à partir du détail des modules ELEVE de
l'élève qu'il accompagne ; le priver de lecture aurait rendu le diagnostic illisible pour la personne même
qui en a l'usage pédagogique.

**V3 (arbitrée 2026-08-07)** sépare explicitement deux matrices :
- **Écriture** — `canEditAudience(role, audience)` : qui peut soumettre des réponses. Inchangée.
- **Lecture** — `canViewModuleDetail(role, audience)` : qui peut voir `answers`/`autoScore`/`manualScore`/
  `reviewSummary`. Nouvelle, c'est le sujet de cette révision.

## Matrice de lecture arbitrée

| Rôle | Modules audience ELEVE | Module audience PARENT (`questionnaire-parent`) | Justification |
|---|---|---|---|
| ELEVE | Détail complet (propre travail) | Statut/progression uniquement | Élève ne lit jamais le questionnaire parent |
| PARENT | Statut/progression uniquement | Détail complet (propre questionnaire) | Parent ne lit jamais le détail académique de l'enfant |
| **COACH** | **Détail complet** — matière de travail | Statut/progression uniquement | Le coach travaille à partir du diagnostic académique réel de l'élève ; le questionnaire parent est un instrument famille/direction, pas un outil de coaching |
| **ASSISTANTE** | **Aucun détail** — statut/progression uniquement | **Aucun détail** — statut/progression uniquement | Rôle logistique, moindre privilège sur les données d'un mineur, sur toute la surface académique |
| ADMIN | Détail complet | Détail complet | Direction pédagogique — c'est là qu'atterrit l'instrument confidentiel famille |

Le critère n'est donc ni « qui est exclu par rôle » (V1) ni « qui peut éditer » (V2), mais **le besoin
légitime établi par rôle, évalué séparément de la permission d'écriture**.

## Routes partagées entre plusieurs audiences

| Route | Audiences pouvant l'atteindre | Mécanisme | Statut |
|---|---|---|---|
| `GET /api/diagnostics/candidat-libre` | ELEVE, PARENT, COACH, ADMIN, ASSISTANTE | `serializeCandidateDiagnostic` → `canViewModuleDetail` | ✅ conforme à la matrice V3 |
| `GET /api/diagnostics/candidat-libre/{id}` | idem | idem | ✅ |
| `PATCH /api/diagnostics/candidat-libre/{id}` | idem | idem | ✅ |
| `GET .../documents` | idem | `isDocumentVisibleToViewer` | ✅ PARENT et ASSISTANTE exclus de `WRITTEN_COPY`/`ORAL_RECORDING`, COACH/ADMIN les voient (matière de travail) |
| `GET .../documents/{documentId}` | idem | idem | ✅ même filtre sur le téléchargement direct |
| `DELETE .../documents/{documentId}` | idem | ownership `uploadedById`, ADMIN/ASSISTANTE bypass | déjà sûr, non changé par cette révision |
| `GET .../modules/{moduleKey}` | ELEVE, PARENT, COACH, ADMIN, ASSISTANTE | `canViewModuleDetail` pour `answers` (changé — utilisait `canEditAudience` avant), `canEditAudience` toujours pour le 403 cross-audience ELEVE/PARENT et pour PUT/POST | ✅ conforme à la matrice V3 |
| `GET/PUT/POST .../parent` | PARENT uniquement | — | pas de surface cross-audience |
| `GET .../staff-export` | COACH, ADMIN, ASSISTANTE uniquement | `canViewModuleDetail` par module, `isDocumentVisibleToViewer`, `synthesis` masqué à ASSISTANTE | ✅ conforme à la matrice V3 |
| `POST .../submit` | ELEVE uniquement | — | pas de surface cross-audience |

## Champ `synthesis` (`staff-export` uniquement) — décision prise, résidu documenté

`buildStaffDiagnosticSynthesis` agrège des pourcentages/couvertures/flags dérivés du contenu académique de
tous les modules, sans distinction d'audience par champ interne. Puisque ASSISTANTE ne doit voir aucun
détail académique, `synthesis` lui est retourné `null` en bloc — cohérent avec la matrice, pas une
extension arbitraire.

**Résidu non traité, documenté explicitement** : pour un COACH, `synthesis.moduleScores` inclut une
entrée `questionnaire-parent` (percentage/coverage — vraisemblablement `null` en pratique puisque ces
items ne sont pas notés, `Points max: 0` dans la banque), et le flag `PARENT_MISSING` (un fait procédural,
pas un contenu). C'est une fuite structurelle mineure de la matrice de lecture stricte : pour la corriger
complètement, `buildStaffDiagnosticSynthesis` devrait connaître l'audience de chaque module qu'il agrège
et exclure `questionnaire-parent` du calcul pour un viewer COACH. Non fait dans cette révision — hors
périmètre de ce qui a été arbitré, signalé pour arbitrage séparé si jugé nécessaire.

## Incohérences trouvées, remontées et non contournées

1. **`canEditAudience` autorise toujours ASSISTANTE à écrire des réponses** (`return role === ADMIN ||
   role === ASSISTANTE`), y compris sur des modules dont elle ne peut désormais plus rien lire — elle
   pourrait écraser un contenu qu'elle ne voit jamais. Décision produit nécessaire : soit ASSISTANTE
   perd aussi l'écriture (cohérence stricte avec la lecture), soit c'est un cas d'usage réel (ex. saisie
   pour le compte de la famille) et seule la lecture doit rester restreinte. Non tranché, non codé.
2. **L'upload de documents ne restreint aucune catégorie par rôle** (`documents/route.ts` POST) —
   ASSISTANTE peut aujourd'hui déposer un `WRITTEN_COPY`/`ORAL_RECORDING` qu'elle ne peut plus voir dans
   la liste une fois déposé. Comportement inchangé par cette révision (l'upload n'était pas dans le
   périmètre arbitré), signalé pour cohérence future.

## Ce qui reste hors périmètre de cet audit

- Qui a le droit d'uploader dans quelle catégorie — question de permission d'écriture, cf. point 2
  ci-dessus.
- Les points ops/légal identifiés au Gate 5 (RGPD, rétention, sauvegarde chiffrée, CSP, alerting) restent
  ouverts et hors code.
- Le résidu `synthesis`/COACH documenté ci-dessus.

## Preuve

- `canViewModuleDetail` : verrouillé exhaustivement pour les 5 rôles × 2 audiences (10 cas explicites,
  `__tests__/lib/diagnostics/candidat-libre/serialize.test.ts`).
- `isDocumentVisibleToViewer` : verrouillé pour les 9 catégories × ELEVE/COACH/ADMIN/PARENT/ASSISTANTE.
- `serializeCandidateDiagnostic` : verrouille l'ensemble exact des clés d'une vue de module, le masquage
  réciproque ELEVE/PARENT, le comportement COACH (détail ELEVE, pas PARENT), ASSISTANTE (aucun détail),
  ADMIN et appelant interne (détail complet).
- `staff-export` : verrouille COACH (détail ELEVE, pas PARENT, synthesis non nul), ADMIN (tout),
  ASSISTANTE (rien, `synthesis: null`, documents administratifs uniquement).
- `modules/{moduleKey}` GET : verrouille que `answers` suit désormais `canViewModuleDetail`, pas
  `canEditAudience` — COACH lit `mathematiques` sans pouvoir l'éditer, ASSISTANTE ne lit rien malgré une
  permission d'édition inchangée.
