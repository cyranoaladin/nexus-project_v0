# Diagnostic candidat libre 2027 — Audit de séparation élève/parent/staff

## Source de vérité

- Sérialiseur partagé : `lib/diagnostics/candidat-libre/serialize.server.ts`
- Filtre documents par audience : `lib/diagnostics/candidat-libre/access.server.ts` (`isDocumentVisibleToViewer`)
- Guard coach : `lib/guards.ts` (`requireCoachAssignedToStudent`)
- Routes API : `app/api/diagnostics/candidat-libre/**`
- Preuve tests : `__tests__/lib/diagnostics/candidat-libre/serialize.test.ts`

## Pourquoi cet audit

La fuite corrigée au Gate 5 (scores/avis cross-audience) touchait des données concernant un mineur. Cet
audit énumère **chaque route partagée entre audiences**, **chaque champ** qu'elle renvoie, et prouve par
un test que la frontière élève/parent/staff est étanche — pas seulement pour les deux cas déjà trouvés.

## Routes partagées entre plusieurs audiences (candidates à une fuite)

| Route | Audiences pouvant l'atteindre | Vecteur de fuite possible | Statut |
|---|---|---|---|
| `GET /api/diagnostics/candidat-libre` | ELEVE, PARENT, COACH, ADMIN, ASSISTANTE | `serializeCandidateDiagnostic` | ✅ corrigé |
| `POST /api/diagnostics/candidat-libre` | ELEVE, PARENT, ADMIN, ASSISTANTE | `serializeCandidateDiagnostic` | ✅ corrigé |
| `GET /api/diagnostics/candidat-libre/{id}` | ELEVE, PARENT, COACH, ADMIN, ASSISTANTE | `serializeCandidateDiagnostic` | ✅ corrigé |
| `PATCH /api/diagnostics/candidat-libre/{id}` | idem | `serializeCandidateDiagnostic` | ✅ corrigé |
| `GET /api/diagnostics/candidat-libre/{id}/documents` | idem | liste de documents non filtrée | ✅ corrigé |
| `GET .../documents/{documentId}` | idem | téléchargement du fichier lui-même | ✅ corrigé |
| `DELETE .../documents/{documentId}` | idem | — | déjà sûr (ownership `uploadedById`, cf. note) |
| `GET .../modules/{moduleKey}` | ELEVE, PARENT, COACH, ADMIN, ASSISTANTE | `canEditAudience` | déjà sûr (403 cross-audience élève/parent ; coach reçoit la structure sans `answers`) |
| `GET/PUT/POST .../parent` | PARENT uniquement | — | pas de surface cross-audience (`requireRole(PARENT)`) |
| `GET .../staff-export` | COACH, ADMIN, ASSISTANTE uniquement | — | pas de surface cross-audience (ELEVE/PARENT exclus par rôle) |
| `POST .../submit` | ELEVE uniquement | — | pas de surface cross-audience |

**Note DELETE document** : un `PARENT` non-staff ne peut supprimer que les documents dont `uploadedById`
correspond à son propre `User.id`. Comme les documents `WRITTEN_COPY`/`ORAL_RECORDING` sont uploadés par
l'élève, ce check d'ownership bloque déjà un parent qui tenterait de les supprimer — aucun correctif requis,
vérifié par lecture de code (pas de nouveau test ajouté, la protection existante suffit).

## Matrice champ × audience — vue diagnostic (`DiagnosticCampaignView`)

### Niveau racine

| Champ | ELEVE | PARENT | Staff | Justification |
|---|---|---|---|---|
| `id`, `diagnosticKey`, `definitionVersion`, `status`, `targetSession` | ✅ | ✅ | ✅ | métadonnées de campagne, non sensibles |
| `student.{id,firstName,lastName,email,school,gradeLevel}` | ✅ | ✅ | ✅ | identité de l'élève, légitime pour les 3 audiences (le parent est le tuteur légal) |
| `completionPercentage` | ✅ | ✅ | ✅ | agrégat calculé uniquement sur les modules requis ELEVE, jamais de contenu |
| `studentConsentAt`, `parentConsentAt`, `submittedAt`, `retentionDueAt`, `createdAt`, `updatedAt` | ✅ | ✅ | ✅ | jalons de consentement/statut, nécessaires aux deux portails pour le suivi de soumission |

### `modules[]` — un élément par module (16 au total, 15 ELEVE + 1 PARENT)

| Champ | Own audience | Cross audience | Justification |
|---|---|---|---|
| `key`, `status`, `progress`, `startedAt`, `submittedAt`, `availableAt`, `elapsedMs` | ✅ | ✅ **visible** | nécessaire à l'UX « en attente du parent » / « élève en cours » ; ne révèle ni contenu ni score |
| `autoScore` | ✅ | ❌ **null** | contient `evidence[]` (statut CORRECT/INCORRECT par question), `domainScores`, `percentage` — équivalent à une réponse détaillée |
| `reviewSummary` | ✅ | ❌ **null** | avis de correction humaine, même registre que `autoScore` |

Aucun champ `answers` n'apparaît dans `DiagnosticModuleView` — les réponses brutes ne transitent jamais par
cette route, uniquement par `GET .../modules/{moduleKey}` qui a son propre contrôle d'audience strict.

### `documents[]`

| Catégorie | ELEVE | PARENT | Staff | Nature |
|---|---|---|---|---|
| `IDENTITY`, `CYCLADES`, `FRENCH_BAC_TRANSCRIPT`, `TUNISIAN_BAC_TRANSCRIPT`, `SCHOOL_REPORT`, `EXAM_ACCOMMODATION`, `OTHER` | ✅ | ✅ | ✅ | pièces administratives, gérées conjointement par la famille |
| `WRITTEN_COPY` (copie français/maths/tronc commun) | ✅ | ❌ | ✅ | production académique de l'élève — équivalent à une réponse détaillée |
| `ORAL_RECORDING` (Grand oral) | ✅ | ❌ | ✅ | idem, enregistrement de la prestation orale |

Filtrage appliqué à la fois sur la **liste** (`GET .../documents`, `serializeCandidateDiagnostic`) et sur le
**téléchargement** (`GET .../documents/{documentId}`) — un parent ne peut ni lister ni récupérer le fichier
par accès direct à l'identifiant.

## Route `modules/{moduleKey}` — déjà sûre, documentée pour mémoire

`canEditAudience(role, audience)` bloque tout accès cross-audience élève/parent (403). Un `COACH` passe le
gate (n'est bloqué ni ELEVE ni PARENT) mais `canEditAudience(COACH, *)` vaut toujours `false`, donc
`answers` est explicitement `undefined` dans la réponse — un coach voit la structure/le statut de n'importe
quel module (y compris le questionnaire parent) mais jamais son contenu. Comportement déjà correct dans le
lot d'origine, vérifié par relecture de code.

## Ce qui reste hors périmètre de cet audit

- **Qui a le droit d'uploader dans quelle catégorie** (ex. un parent peut aujourd'hui POSTer un document
  `WRITTEN_COPY`) n'a pas été modifié — c'est une question de permission d'écriture, pas de fuite de
  lecture, et un changement là-dessus est un choix produit, pas un correctif de sécurité.
- Les points ops/légal identifiés au Gate 5 (RGPD, rétention, sauvegarde chiffrée, CSP, alerting) restent
  ouverts et hors code.

## Preuve

`__tests__/lib/diagnostics/candidat-libre/serialize.test.ts` verrouille :
- l'ensemble exact des clés d'une vue de module (`Object.keys().sort()` contre une liste explicite) —
  un champ non classé fait échouer le test de classification ;
- pour ELEVE et PARENT : le module de leur propre audience garde son détail, le module de l'autre audience
  a `autoScore`/`reviewSummary` à `null` mais conserve les champs de statut ;
- pour le staff et les appels internes (pas de rôle passé) : détail complet partout ;
- la matrice catégorie × audience de `isDocumentVisibleToViewer`, testée exhaustivement sur les 9 catégories
  existantes pour ELEVE, PARENT et staff.
