# Lot 2 — Décision `/api/assessments/submit`

## Décision

Option A retenue : token signé court avant bêta élargie.

## État actuel

- Route publique.
- Zod strict.
- Rate limit async.
- Payload pédagogique mineur.
- Crée un `Assessment`.
- Réponse avec `assessmentId` et `redirectUrl`, nécessaires au parcours actuel `/assessments/[id]/processing`.

## Décision produit

Le flux public actuel est toléré uniquement pour un parcours contrôlé et volume limité. Avant bêta élargie, la route doit exiger un token signé court :

- token généré après lead qualifié ou session authentifiée ;
- TTL court ;
- scope `subject`, `grade`, éventuelle session/campagne ;
- pas de token brut stocké ;
- pas de réutilisation hors scope.

## Mitigations actuelles

- Pas de `contextJson`, `llmJson`, `validatedJson`, `latexSource`, `metadata` brute en réponse.
- Champs inattendus rejetés.
- No-leak succès/erreur couvert.

## Tests

- `__tests__/api/assessments-submit.test.ts`
- `__tests__/api/security/no-sensitive-fields-in-api-responses.test.ts`

## Verdict

P1 maintenu par décision. Bêta élargie interdite tant que le token signé court n'est pas implémenté.
