# Lot 2 — `/api/bilan-gratuit` produit/RGPD

## Décision

Option `lead_only` implémentée.

## Avant

La route publique créait :

- `User` parent inactif ;
- `ParentProfile` ;
- `User` élève inactif ;
- `Student` ;
- token d'activation hashé ;
- email d'activation avec token brut dans l'URL.

## Après

La route crée uniquement un `ContactLead` CRM via `captureContactLead`.

- Aucune création de `User`.
- Aucune création de `ParentProfile`.
- Aucune création de `Student`.
- Aucun token d'activation généré.
- Aucun email d'activation envoyé.
- Réponse neutre sans `leadId`, `parentId`, `studentId`, token ou email-existence.
- `studentBirthDate` n'est pas persisté dans les notes CRM.

## Données conservées

- Parent : nom, email, téléphone.
- Intérêt : bilan gratuit et niveau.
- Notes minimisées : prénom/nom élève, niveau, établissement si fourni, matières, objectifs/difficultés tronqués, modalité/disponibilités.

## Tests

- `__tests__/api/bilan-gratuit.product-rgpd.test.ts`
- `__tests__/api/bilan-gratuit.security.test.ts`
- `__tests__/api/bilan-gratuit.test.ts`
- `__tests__/api/security/no-sensitive-fields-in-api-responses.test.ts`

## Verdict

Ambiguïté produit/RGPD fermée pour le formulaire public. La route reste publique sensible et dépend du rate limiting runtime avant campagne large.
