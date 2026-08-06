# 04 — Contrats API

Toutes les routes sont des Route Handlers App Router sous `app/api/positionnement/`.
Toute entrée est validée par Zod **avant** tout accès base. Toute sortie est un DTO explicite,
jamais un modèle Prisma sérialisé directement.

## §1. Surface publique (sans session)

L'accès se fait par `accessToken` opaque, transmis en en-tête `X-Attempt-Token`.
Jamais dans l'URL en clair côté serveur de logs — voir spec 07 §3.

### `POST /api/positionnement/attempts`

Crée une passation depuis le tunnel bilan gratuit.

```ts
// entrée
{
  testSlug: string,
  context: "BILAN_GRATUIT" | "STAGE" | "RENTREE",
  lead: {
    firstName: string,        // 1..80
    lastName: string,         // 1..80
    email: string,            // email
    phone: string,            // E.164 ou format TN toléré
    levelNextYear: Level,
    consent: true             // littéral, refus = 400
  }
}
// sortie 201
{ attemptId: string, accessToken: string, expiresAt: string, itemCount: number }
```

Règles :

- **N'écrit jamais dans `User`.** Écrit ou met à jour un `Lead`.
- Réponse et latence **strictement identiques** que l'e-mail soit déjà connu ou non.
  Aucun message du type « un compte existe déjà ». Voir spec 07 §2.
- Anti-abus : limite par IP et par empreinte e-mail normalisée. Dépassement ⇒ `429`,
  même corps d'erreur générique.
- Aucun envoi d'e-mail synchrone : la notification part d'une file, après réponse.

### `GET /api/positionnement/attempts/current`

En-tête `X-Attempt-Token`. Renvoie le test tel que l'élève doit le voir :
items dans l'ordre canonique, **options mélangées par `seed`** (permutation déterministe),
sans `answerKey`, sans `shortCorrection`, sans `nodeCpsId`.

Fuite d'un de ces trois champs sur cette route = P0.

### `PUT /api/positionnement/attempts/current/answers/:itemId`

```ts
{ rawAnswer: unknown, confidence: 1|2|3|4 | null, elapsedMs: number }
```

Upsert idempotent. Rejeté si `status !== IN_PROGRESS`. Réponse `204`.

### `POST /api/positionnement/attempts/current/submit`

Idempotent. Premier appel : passe en `SUBMITTED`, exécute le moteur, écrit `PositioningResult`,
passe en `SCORED`. Appels suivants : renvoie le résultat existant sans recalcul.

```ts
// sortie 200
{ status: "SCORED", restitutionAvailable: boolean }
```

### `GET /api/positionnement/attempts/current/restitution`

Renvoie **exclusivement** le bilan d'audience `ELEVE`. Jamais `globalScore`,
jamais `calibrationIndex` brut, jamais `groupBand`.

## §2. Surface parent

### `GET /api/positionnement/bilans/:bilanId`

Accès par lien signé à durée limitée (`BILAN_LINK_TTL_HOURS`), envoyé par e-mail au lead.
Audience forcée à `PARENT`. Renvoie `404` — pas `403` — si l'audience ne correspond pas,
afin de ne rien révéler de l'existence des autres bilans.

Refusé tant que la revue humaine requise n'est pas faite (spec 01 §5.6, spec 02 §11).

## §3. Surface staff (session NextAuth requise)

| Route | Rôles | Objet |
|---|---|---|
| `GET /api/admin/positionnement/attempts` | ADMIN, ASSISTANTE, COACH | liste filtrable, paginée |
| `GET /api/admin/positionnement/attempts/:id` | ADMIN, ASSISTANTE, COACH | détail complet, audience `NEXUS` |
| `POST /api/admin/positionnement/attempts/:id/rescore` | ADMIN | rejoue le moteur, archive l'ancien résultat |
| `POST /api/admin/positionnement/bilans/:id/review` | ADMIN, COACH | pose `reviewedBy` / `reviewedAt` |
| `POST /api/admin/positionnement/tests/:id/publish` | ADMIN | `DRAFT` → `PUBLISHED`, gèle la version |
| `GET /api/admin/positionnement/export` | ADMIN | export CSV agrégé, sans données nominatives |

Chaque route staff passe par `lib/rbac.ts` (ressource `POSITIONNEMENT`) **et** par
`lib/access/guard.ts::requireFeatureApi`. Les trois couches existantes s'appliquent :
middleware Edge → garde client → garde serveur. Une garde client seule n'est jamais suffisante.

**Rôles PARENT et ELEVE : aucun accès aux routes `/api/admin/**`.** Un parent connecté
accède à la restitution de ses enfants via une route dédiée, à spécifier au lot L4,
avec vérification explicite du lien de filiation — pas par simple présence d'une session.

## §4. Codes d'erreur

| Code | Cas |
|---|---|
| `400` | validation Zod, consentement absent |
| `401` | jeton de passation absent ou invalide |
| `404` | ressource inexistante **ou** non autorisée (on ne distingue pas) |
| `409` | passation non modifiable dans son état courant |
| `410` | passation ou lien expiré |
| `429` | limitation de débit |
| `500` | erreur interne, corps générique, aucun détail technique exposé |

Corps uniforme : `{ error: { code: string, message: string } }`.
`message` est destiné à l'affichage, en français, sans détail d'implémentation.

## §5. Journalisation

Journaliser : `attemptId`, `testSlug`, `status`, durées, codes HTTP.
Ne **jamais** journaliser : `accessToken`, `rawAnswer`, e-mail, téléphone, nom.
Corrélation par `attemptId` uniquement.
