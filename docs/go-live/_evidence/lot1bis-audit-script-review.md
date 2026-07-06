# Lot 1-bis — Revue du script `audit-api-guards.mjs`

## Synthèse

Le script a été contre-audité parce que la baisse `P0=44 -> 0` dépend en partie de ses heuristiques. Un faux positif/faux négatif potentiel a été trouvé : la détection de rate limit acceptait le simple mot `rateLimit`, donc un commentaire pouvait suffire.

Correction appliquée :

- ajout de `hasRateLimitGuard(source)` dans `scripts/security/audit-api-guards.mjs` ;
- même durcissement dans `scripts/go-live/generate-api-security-matrix.mjs` ;
- ajout de `__tests__/scripts/audit-api-guards.classification.test.ts`.

## Règle : `staffOnlyRoute`

- Motif regex ou logique : route sous `app/api/admin|assistante` ou `requireAnyRole(['ADMIN','ASSISTANTE'])`, avec auth + role.
- Risque de faux négatif : staff-only réel non détecté si guard custom.
- Risque de faux positif : route admin avec role guard insuffisant.
- Routes impactées : admin/assistante dynamiques.
- Test de script existant : staff-only sensible mutation n’est pas P0 et n’est pas OK.
- Test de script à ajouter : couverture par fixture réelle possible si le script devient plus complexe.
- Verdict : acceptable pour triage statique, pas preuve go-live.

## Règle : routes publiques fixes

- Motif regex ou logique : `app/api/public-documents/*` GET avec `FILE_NAME`.
- Risque de faux négatif : document fixe autre pattern.
- Risque de faux positif : document public qui contiendrait une donnée personnelle.
- Routes impactées : `/api/public-documents/corrige-dnb-maths-2026`.
- Test de script existant : route fixe publique devient P2, pas OK.
- Verdict : acceptable si fichier public est validé comme contenu marketing/pédagogique non propriétaire.

## Règle : routes `410`

- Motif regex ou logique : présence de `status: 410`.
- Risque de faux négatif : 410 construit indirectement.
- Risque de faux positif : route partiellement active avec un 410 dans un seul cas.
- Routes impactées : aucune P0 critique observée dans le Top 20 courant.
- Test de script existant : non ajouté dans Lot 1-bis.
- Verdict : à surveiller ; ne pas utiliser seul pour déclarer OK.

## Règle : routes `501`

- Motif regex ou logique : route webhook + `status: 501` + texte not configured.
- Risque de faux négatif : service désactivé par helper externe.
- Risque de faux positif : route avec chemin de succès alternatif.
- Routes impactées : `/api/payments/clictopay/webhook`.
- Test de script existant : route 501 ClicToPay devient P1, pas OK.
- Verdict : acceptable. ClicToPay reste P1 tant que non complet.

## Règle : réexports

- Motif regex ou logique : `export { ... } from '...'` lu via `sourceFor(file)`.
- Risque de faux négatif : réexport indirect ou barrel plus complexe.
- Risque de faux positif : collision de méthodes source/route.
- Routes impactées : routes générées/réexportées coach reports.
- Test de script existant : réexport suit la source et conserve `POST`, sans P0 artificiel.
- Verdict : amélioration utile, pas preuve métier.

## Règle : `ownership`

- Motif regex ou logique : helpers `buildDocumentOwnershipWhere`, `assertCoachCanAccessStudent`, `buildInvoiceAccessWhere`, `buildBilanReadWhere`, `canReadSubmission`, etc.
- Risque de faux négatif : ownership réel non listé dans les motifs.
- Risque de faux positif : helper appelé mais résultat non appliqué correctement.
- Routes impactées : documents, factures, bilans, coach, NPC.
- Test de script existant : route dynamique sensible sans ownership reste P0.
- Verdict : indicateur de triage seulement. Les tests IDOR restent requis.

## Règle : `roleGuard`

- Motif regex ou logique : `requireRole`, `requireAnyRole`, `enforcePolicy`, `UserRole`, `session.user.role`.
- Risque de faux négatif : guard custom.
- Risque de faux positif : simple référence au rôle sans enforcement.
- Routes impactées : admin/assistante/coach/parent/student.
- Test de script existant : staff-only mutation non P0/non OK.
- Verdict : acceptable pour priorité, pas pour preuve finale.

## Règle : `authGuard`

- Motif regex ou logique : `auth()`, `requireAuth`, `requireRole`, `requireAnyRole`, `enforcePolicy`, `getActor`.
- Risque de faux négatif : auth dans wrapper non détecté.
- Risque de faux positif : `auth()` appelé mais non vérifié.
- Routes impactées : toutes routes sensibles.
- Test de script existant : public sensible sans auth/rate/ownership reste P0.
- Verdict : à compléter par tests route.

## Règle : `zod`

- Motif regex ou logique : `zod`, `z.`, `.parse`, `.safeParse`.
- Risque de faux négatif : validation non-Zod correcte.
- Risque de faux positif : Zod importé mais pas utilisé sur le payload.
- Routes impactées : public sensible, mutations.
- Test de script existant : public sensible avec Zod + rate limit devient P1, pas OK.
- Verdict : indicateur faible mais utile.

## Règle : `rateLimit`

- Ancien motif : `guardRateLimitAsync|checkRateLimitAsync|rateLimit`.
- Nouveau motif : appels explicites `guardRateLimitAsync(`, `guardRateLimit(`, `checkRateLimitAsync(`, `checkRateLimit(`, `RateLimitPresets.*(`, etc.
- Risque de faux négatif : wrapper custom non listé.
- Risque de faux positif : fortement réduit ; un commentaire ne suffit plus.
- Routes impactées : routes publiques sensibles.
- Test de script existant : commentaire `// TODO: add rateLimit` reste P0.
- Verdict : correction validée.
