# Lot 2 — Décision `/api/lamis/teacher-report`

## Décision

Public anonyme assumé.

## Justification

La route calcule un rapport pédagogique à partir d'essais envoyés par le client, sans email, nom, compte, document, facture ou écriture DB. Elle reste publique pour supporter la page Lamis et l'usage pédagogique immédiat.

## Mitigations

- Zod strict.
- Rate limit async.
- Maximum 300 tentatives.
- Pas de stockage serveur.
- Pas de réponse avec champs interdits.

## Tests

- `__tests__/api/lamis.teacher-report.route.test.ts`
- `__tests__/api/security/no-sensitive-fields-in-api-responses.test.ts`

## Verdict

Décision produit claire. La route peut rester publique, mais reste suivie en P1 statique par prudence jusqu'à preuve runtime Redis/Upstash.
