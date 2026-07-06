# Lot 1 — Preuves tests IDOR / no-leak

## Tests documents

- `__tests__/api/documents.id.route.test.ts`
  - non authentifié → 401 ;
  - document absent → 404 ;
  - utilisateur non propriétaire → 404 non révélateur ;
  - propriétaire/admin/assistante → 200 ;
  - fichier manquant → 404 sans log de chemin local ;
  - erreur DB → 500.

- `__tests__/api/documents-access.test.ts`
  - coach assigné peut lire/créer ;
  - coach non assigné → 403 ;
  - rôle non coach → 403 ;
  - réponses coach sans `localPath` ;
  - assistante/admin gardés staff-only.

## Tests factures

- `__tests__/lib/invoice/access-scope.test.ts`
  - admin/assistante scope `{ id }` ;
  - parent scope par `beneficiaryUserId` enfant + fallback `customerEmail` legacy ;
  - parent sans scope → null ;
  - élève/coach/role inconnu → null.

- `__tests__/api/invoices.pdf.route.test.ts`
  - token invalide/mismatch → 404 ;
  - token valide → PDF ;
  - session non autorisée → 404 ;
  - admin → PDF ;
  - facture hors scope → 404.

- `__tests__/api/invoices.receipt.pdf.route.test.ts`
  - non authentifié/role interdit/facture absente → 404 ;
  - facture non payée → 409 ;
  - facture payée → PDF.

## Tests rate limit publics

- `__tests__/api/student.activate.route.test.ts`
  - GET/POST rate-limited → 429 avant service ;
  - token manquant/invalide ;
  - activation valide ;
  - erreur service sobre.

- `__tests__/api/lamis.teacher-report.route.test.ts`
  - payload valide → 200 ;
  - champ inattendu ou tentative malformée → 400 ;
  - GET/POST rate-limited → 429.

- `__tests__/api/public-rate-limit.coverage.test.ts`
  - couverture statique `guardRateLimitAsync` pour routes publiques sensibles listées.

## Résultat ciblé

Commande ciblée exécutée sous Node 20 : `npm run test:unit -- --runInBand ...`

Résultat observé : 5 suites / 45 tests OK pour le dernier lot ciblé, et 5 suites / 43 tests OK pour documents/factures.
