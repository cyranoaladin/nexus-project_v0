# Lot 1-ter — NPC documents et fichiers

## Routes traitées

| Route | Après | Preuve |
| --- | --- | --- |
| `/api/npc/submissions` | P2 | Body/query Zod, tests sécurité |
| `/api/npc/submissions/[submissionId]/documents` | P2 | Param Zod, refus traversal avant DB |
| `/api/npc/submissions/[submissionId]/documents/[documentId]` | P2 | Params/body Zod, documentId unsafe refusé |
| `/api/npc/submissions/[submissionId]/generate` | P2 | Param Zod, refus avant DB |
| `/api/npc/uploads` | P2 | Metadata Zod, tests invalid metadata/MIME |

## Contrôles appliqués

- Identifiants route bornés par regex avant DB.
- Metadata upload strictement validée.
- Champs inattendus refusés sur les mutations traitées.
- Tests ciblés vérifient absence de DB/fichier avant paramètres valides.

## Tests

- `__tests__/api/npc.documents.route.test.ts`
- `__tests__/api/npc.submissions.security.test.ts`
- `__tests__/api/npc.generate.test.ts`
- `__tests__/api/npc.uploads.route.test.ts`
- `__tests__/api/security/no-sensitive-fields-in-api-responses.test.ts`

## Réserves

Le mode runtime NPC/worker, le stockage réel et la preuve production de non-exposition de chemins restent à vérifier hors mocks.
