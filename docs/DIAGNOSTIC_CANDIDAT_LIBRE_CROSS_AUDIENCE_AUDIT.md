# Diagnostic candidat libre 2027 — Audit de séparation élève/parent/staff

## Source de vérité

- Sérialiseur partagé : `lib/diagnostics/candidat-libre/serialize.server.ts`
- Filtre documents par audience : `lib/diagnostics/candidat-libre/access.server.ts` (`isDocumentVisibleToViewer`)
- Guard coach : `lib/guards.ts` (`requireCoachAssignedToStudent`)
- Routes API : `app/api/diagnostics/candidat-libre/**`
- Preuve tests : `__tests__/lib/diagnostics/candidat-libre/serialize.test.ts`,
  `__tests__/api/diagnostics/candidat-libre/staff-export-content-visibility.test.ts`

## Pourquoi cette révision (V2)

La V1 de cet audit (classification par route, colonne unique « Staff ») a laissé passer un trou réel :
`GET .../staff-export` renvoyait `answers`/`autoScore`/`manualScore`/`reviewSummary` de tous les modules,
y compris `questionnaire-parent`, à tout `COACH` — alors que `GET .../modules/{moduleKey}` refuse
explicitement ce même contenu à ce même rôle. Le défaut de méthode : la V1 classait par « qui passe le
gate de rôle » (ELEVE/PARENT exclus ⇒ jugé sûr), pas par **l'audience réelle que chaque champ vise**. Un
COACH n'est ni ELEVE ni PARENT, donc il passait le gate — mais passer le gate ne veut pas dire être
l'audience légitime du contenu.

**Nouveau critère de classification, appliqué ci-dessous à toutes les routes, pas seulement à
`staff-export`** : pour chaque champ, on ne demande plus « quels rôles sont bloqués ? » mais « à qui ce
contenu est-il fonctionnellement destiné ? ». Deux familles de légitimité, distinctes :

- **Audience directe** : ELEVE et PARENT sur leurs propres modules (l'élève sur son travail, le parent sur
  son propre questionnaire — jamais l'inverse).
- **Pilotage administratif du dossier** : ADMIN/ASSISTANTE, qui arbitrent le dossier dans son ensemble et
  en ont besoin pour cette fonction — une légitimité différente de « être l'audience », documentée comme
  telle, pas fusionnée avec elle.

`COACH` n'appartient à aucune des deux familles pour le **contenu** (réponses/scores/avis de correction).
Il reste légitime sur la **structure/statut** (suivi pédagogique du parcours) et sur les **productions
académiques de l'élève** (`WRITTEN_COPY`/`ORAL_RECORDING` — pertinentes à l'accompagnement), ce qui est une
troisième famille de légitimité distincte, documentée séparément par champ/catégorie ci-dessous plutôt que
supposée.

## Routes partagées entre plusieurs audiences (candidates à une fuite)

| Route | Audiences pouvant l'atteindre | Vecteur de fuite possible | Statut (critère audience-du-champ) |
|---|---|---|---|
| `GET /api/diagnostics/candidat-libre` | ELEVE, PARENT, COACH, ADMIN, ASSISTANTE | `serializeCandidateDiagnostic` | ⚠️ **gap ouvert** — voir ci-dessous |
| `POST /api/diagnostics/candidat-libre` | ELEVE, PARENT, ADMIN, ASSISTANTE | `serializeCandidateDiagnostic` | pas de COACH sur ce verbe — sûr |
| `GET /api/diagnostics/candidat-libre/{id}` | ELEVE, PARENT, COACH, ADMIN, ASSISTANTE | `serializeCandidateDiagnostic` | ⚠️ **gap ouvert** — voir ci-dessous |
| `PATCH /api/diagnostics/candidat-libre/{id}` | idem | `serializeCandidateDiagnostic` | ⚠️ **gap ouvert** — voir ci-dessous |
| `GET /api/diagnostics/candidat-libre/{id}/documents` | idem | liste de documents non filtrée | ✅ correct (COACH légitime sur les productions académiques, PARENT exclu) |
| `GET .../documents/{documentId}` | idem | téléchargement du fichier lui-même | ✅ correct, même filtre |
| `DELETE .../documents/{documentId}` | idem | — | ✅ déjà sûr (ownership `uploadedById`) |
| `GET .../modules/{moduleKey}` | ELEVE, PARENT, COACH, ADMIN, ASSISTANTE | `canEditAudience` | ✅ correct — implémentation de référence du critère audience-du-champ |
| `GET/PUT/POST .../parent` | PARENT uniquement | — | pas de surface cross-audience |
| `GET .../staff-export` | COACH, ADMIN, ASSISTANTE uniquement | `answers`/`autoScore`/`manualScore`/`reviewSummary` par module | ✅ **corrigé** (alignement sur `canEditAudience`, voir commit `3d29af76`) |
| `POST .../submit` | ELEVE uniquement | — | pas de surface cross-audience |

## ⚠️ Gap ouvert — `serializeCandidateDiagnostic` (routes racine, pas `staff-export`)

`lib/diagnostics/candidat-libre/serialize.server.ts` calcule `restrictToAudience = viewerRole === 'ELEVE'
|| viewerRole === 'PARENT' ? viewerRole : null`. Pour `COACH`, `viewerRole` ne vaut ni `'ELEVE'` ni
`'PARENT'`, donc `restrictToAudience = null`, donc `ownAudience = true` pour **tous** les modules — un
`COACH` reçoit `autoScore`/`reviewSummary` de `questionnaire-parent` par `GET /candidat-libre` et
`GET .../{id}`, exactement le même contenu que `staff-export` exposait avant correction. Le docstring de
la fonction documente ce choix comme intentionnel (« Staff (COACH/ADMIN/ASSISTANTE) ... see everything »)
et `serialize.test.ts` le verrouille par un test explicite (« pour le staff ... détail complet partout »)
— ce n'est donc pas un défaut ponctuel isolé, c'est la même décision de conception que `staff-export`
avait, prise à un autre endroit, testée, et jamais reconsidérée à la lumière de la décision sur
`staff-export`.

**Pas corrigé dans ce commit.** Contrairement à `staff-export` (aucun test préexistant, verrouillait un
comportement jamais examiné), toucher `serializeCandidateDiagnostic` casserait un contrat testé
explicitement et partagé par plusieurs routes (`GET /candidat-libre`, `GET/PATCH {id}`) — un changement
silencieux ici est plus risqué qu'un gap documenté. Décision produit nécessaire avant correctif : un COACH
doit-il perdre l'accès à `autoScore`/`reviewSummary` de **tous** les modules hors de son audience (symétrie
stricte avec `modules/{moduleKey}`), ou seulement à ceux d'audience `PARENT` (le coach garde le détail des
modules `ELEVE`, pertinent à l'accompagnement) ? Les deux corrigent la fuite sur `questionnaire-parent` ;
elles diffèrent sur ce qu'un coach voit du travail de l'élève lui-même, question hors du périmètre
sécurité de cet audit.

## Matrice champ × audience — vue diagnostic (`DiagnosticCampaignView`)

### Niveau racine

| Champ | ELEVE | PARENT | COACH | ADMIN/ASSISTANTE | Audience visée |
|---|---|---|---|---|---|
| `id`, `diagnosticKey`, `definitionVersion`, `status`, `targetSession` | ✅ | ✅ | ✅ | ✅ | métadonnées de campagne — dossier entier |
| `student.{id,firstName,lastName,email,school,gradeLevel}` | ✅ | ✅ | ✅ | ✅ | identité de l'élève — légitime aux 4 (le parent est le tuteur légal, le coach suit cet élève nommément) |
| `completionPercentage` | ✅ | ✅ | ✅ | ✅ | agrégat de progression, jamais de contenu |
| `studentConsentAt`, `parentConsentAt`, `submittedAt`, `retentionDueAt`, `createdAt`, `updatedAt` | ✅ | ✅ | ✅ | ✅ | jalons de statut, nécessaires au suivi par les 4 |

### `modules[]` — un élément par module (16 au total, 15 audience ELEVE + 1 audience PARENT)

| Champ | Audience visée | ELEVE (même audience) | ELEVE (autre audience) | PARENT (même audience) | PARENT (autre audience) | COACH | ADMIN/ASSISTANTE |
|---|---|---|---|---|---|---|---|
| `key`, `status`, `progress`, `startedAt`, `submittedAt`, `availableAt`, `elapsedMs` | dossier entier | ✅ | ✅ | ✅ | ✅ | ✅ | ✅ |
| `autoScore`, `reviewSummary` | ELEVE **ou** PARENT selon `module.audience` — jamais l'autre, jamais COACH | ✅ | ❌ null | ✅ | ❌ null | ⚠️ **voir gap ci-dessus** | ✅ (pilotage dossier) |
| `answers` | idem, uniquement via `modules/{moduleKey}` | n/a (champ absent de cette vue) | | | | | |

Aucun champ `answers` n'apparaît dans `DiagnosticCampaignView` — les réponses brutes ne transitent que par
`GET .../modules/{moduleKey}`, qui a son propre contrôle (`canEditAudience`, déjà correct pour COACH).

### `documents[]`

| Catégorie | Audience visée | ELEVE | PARENT | COACH | ADMIN/ASSISTANTE |
|---|---|---|---|---|---|
| `IDENTITY`, `CYCLADES`, `FRENCH_BAC_TRANSCRIPT`, `TUNISIAN_BAC_TRANSCRIPT`, `SCHOOL_REPORT`, `EXAM_ACCOMMODATION`, `OTHER` | dossier entier | ✅ | ✅ | ✅ | ✅ | pièces administratives, gérées conjointement |
| `WRITTEN_COPY` (copie français/maths/tronc commun) | ELEVE + suivi pédagogique | ✅ | ❌ | ✅ | ✅ | production académique — pertinente au coach qui accompagne, pas au parent |
| `ORAL_RECORDING` (Grand oral) | idem | ✅ | ❌ | ✅ | ✅ | idem |

Filtrage appliqué sur la **liste** (`GET .../documents`, `serializeCandidateDiagnostic`), le
**téléchargement** (`GET .../documents/{documentId}`) et désormais aussi sur `staff-export`
(`isDocumentVisibleToViewer`, ajouté par cohérence — sans effet pratique aujourd'hui puisque `PARENT`
n'atteint pas cette route).

## Route `modules/{moduleKey}` — implémentation de référence du critère audience-du-champ

`canEditAudience(role, audience)` bloque tout accès cross-audience élève/parent (403 en écriture). En
lecture, un `COACH` passe le gate de rôle (n'est bloqué ni ELEVE ni PARENT) mais `canEditAudience(COACH,
*)` vaut toujours `false` pour toute audience — donc `answers` est explicitement `undefined`, **quelle que
soit l'audience du module**, y compris les modules ELEVE. C'est plus strict que la classification retenue
pour `documents[]` (où COACH garde `WRITTEN_COPY`/`ORAL_RECORDING`) : cette route ne distingue pas
« module ELEVE » de « module PARENT » pour COACH, elle exclut COACH du contenu partout. `staff-export` est
maintenant aligné sur exactement ce comportement (commit `3d29af76`). `serializeCandidateDiagnostic` ne
l'est pas encore (gap documenté plus haut).

## Ce qui reste hors périmètre de cet audit

- **Qui a le droit d'uploader dans quelle catégorie** (ex. un parent peut aujourd'hui POSTer un document
  `WRITTEN_COPY`) n'a pas été modifié — question de permission d'écriture, pas de fuite de lecture.
- Les points ops/légal identifiés au Gate 5 (RGPD, rétention, sauvegarde chiffrée, CSP, alerting) restent
  ouverts et hors code.
- Le gap `serializeCandidateDiagnostic` documenté ci-dessus attend une décision produit avant correctif.

## Preuve

- `__tests__/lib/diagnostics/candidat-libre/serialize.test.ts` verrouille l'ensemble exact des clés d'une
  vue de module, le masquage ELEVE/PARENT réciproque, le comportement staff actuel (y compris le gap COACH
  documenté ci-dessus — ce test devra changer le jour où ce gap sera tranché), et la matrice catégorie ×
  audience de `isDocumentVisibleToViewer` sur les 9 catégories existantes.
- `__tests__/api/diagnostics/candidat-libre/staff-export-content-visibility.test.ts` verrouille le
  comportement corrigé de `staff-export` : COACH sans contenu sur `questionnaire-parent`, ADMIN/ASSISTANTE
  avec contenu complet.
