# Lot 7 — Audit des scripts de securite

## Verdict

`SECURITY_AUDIT_SCRIPTS_ACCEPTED`

Acceptation avec reserves : les scripts sont acceptes comme outils de triage statique, pas comme preuve unique de securite applicative. Les 6 P1 restent visibles et ne sont pas requalifies.

## Scripts audites

| Script | Statut | Decision |
|---|---|---|
| `scripts/security/audit-api-guards.mjs` | Modifie | Accepte avec tests de classification et regression |
| `scripts/go-live/generate-api-security-matrix.mjs` | Non suivi / nouveau | Accepte comme generateur documentaire depuis l'inventaire |
| `scripts/check-bundle-weight.sh` | Modifie | Accepte, correction de detection des routes dynamiques dans le build |

## `scripts/security/audit-api-guards.mjs`

Constats :

- Le script suit les reexports via `sourceFor`, ce qui reduit les faux positifs pour les routes qui exportent un handler partage.
- Les routes webhook `501` restent `P1`, pas `OK`.
- Les routes publiques sensibles avec Zod et rate limit restent `P1` si mutation, pas `OK`.
- Les routes publiques fixes/documentaires peuvent etre `P2`, mais pas `OK`.
- Les routes staff-only ne sont sorties de `P0` que si auth et role guard sont detectes.
- Les helpers ownership reconnus sont des signaux statiques ; ils ne remplacent pas les tests IDOR.

Risques :

- La detection ownership reste heuristique.
- Une route avec un helper mal utilise peut etre surclassee statiquement.
- L'inventaire ne prouve pas la couverture runtime, ni Redis/Upstash, ni les decisions produit/RGPD.

Mitigations :

- Test existant `__tests__/scripts/audit-api-guards.classification.test.ts`.
- Test ajoute Lot 7 `__tests__/scripts/security-audit-scripts-regression.test.ts`.
- Les 6 P1 actuels sont verrouilles en regression.

## `scripts/go-live/generate-api-security-matrix.mjs`

Constats :

- Le script lit `docs/security/API_GUARD_INVENTORY.md`.
- Il ne reclassifie pas independamment une route vers `OK`.
- Les compteurs de la matrice dependent des statuts de l'inventaire genere.
- Les sections P1 conservent les 6 routes publiques/paiement.

Risque :

- Si l'inventaire source est faux, la matrice reproduit l'erreur.

Mitigation :

- Test Lot 7 : verification que les 6 P1 restent P1 dans l'inventaire et la matrice.
- Gate finale : regeneration de l'inventaire et de la matrice apres tests.

## `scripts/check-bundle-weight.sh`

Constats :

- Le diff remplace la recherche stricte `○ route` par une recherche de ligne contenant ` route `.
- Objectif : ne pas echouer si Next marque une page protegee par cookie comme dynamique `ƒ`.
- La route reste exigee : si elle disparait du build output, le script echoue encore.

Verdict : accepte.

## Tests executes

```bash
source /home/alaeddine/.nvm/nvm.sh && nvm use 20.20.0 >/dev/null && npm run test:unit -- --runInBand __tests__/scripts/audit-api-guards.classification.test.ts __tests__/scripts/security-audit-scripts-regression.test.ts
```

Resultat : `2` suites passees, `10` tests passes.

## Decision

Les scripts ne maquillaient pas les 6 P1 au moment de l'audit Lot 7. Ils restent acceptables pour release candidate avec les reserves suivantes :

- ne pas utiliser l'inventaire comme preuve unique ;
- conserver les tests de regression script ;
- garder les P1 visibles jusqu'a preuve runtime et decision humaine.
