# Lot 18 — Public API contract proof

## Route

`POST /api/bilan-gratuit`

## Contrat public attendu

La reponse JSON publique de succes est volontairement minimale :

```json
{
  "success": true,
  "message": "Votre demande a bien été enregistrée. Notre équipe vous recontactera pour la suite."
}
```

## Donnees interdites dans la reponse publique

- `parentId`
- `studentId`
- `token`
- `assessmentToken`
- `leadEmailHash`

## Preuves code/tests

- `app/api/bilan-gratuit/route.ts` retourne `neutralSuccessBody`.
- `__tests__/api/bilan-gratuit.product-rgpd.test.ts` verifie que le JSON ne contient pas d'identifiants publics internes.
- `e2e/real/pages/04-bilan-gratuit.spec.ts` verifie maintenant le contrat public et la redirection confirmation.

## Assertions anti-leak E2E

```ts
expect(body).not.toHaveProperty('parentId');
expect(body).not.toHaveProperty('studentId');
expect(body).not.toHaveProperty('token');
expect(body).not.toHaveProperty('assessmentToken');
expect(body).not.toHaveProperty('leadEmailHash');
expect(JSON.stringify(body)).not.toMatch(/parentId|studentId|token|assessmentToken|leadEmailHash/i);
```

## Decision

`DO_NOT_EXPOSE_INTERNAL_PUBLIC_IDS`.
