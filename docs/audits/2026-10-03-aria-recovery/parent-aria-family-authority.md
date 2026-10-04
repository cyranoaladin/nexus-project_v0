# Autorité familiale des lectures ARIA parent

Date : 4 octobre 2026. Base locale : fe01a8484. Statut global : NOT_READY.

## Défaut et correction

Six routes parent ARIA pouvaient consulter les services pédagogiques malgré un refus ou une panne de l’autorité Core, leur loader interne ne consultant que le parent historique. Douze tests rouges ont reproduit ces accès. Un adaptateur de composition dans lib/families consulte maintenant resolveParentStudentAccess(read) avant tout service ARIA. DENIED donne 403, AUTHORITY_UNAVAILABLE donne 503. Les réponses des six routes, y compris les erreurs, sont privées/no-store, avec Vary Cookie/Authorization. Aucun import Core-v2 ajouté dans lib/aria, aucun appel HTTP à l’application elle-même, aucune modification aux API natives /api/v2/aria.

## Preuves

8 suites, 56 tests verts (dont le garde d’architecture ARIA), couvrant chaque refus/panne et chaque décision de lecture autorisée avant service. Les tests de contrat existants ont une décision familiale autorisée explicite ; leurs assertions DTO, validation et erreurs sont conservées. Typecheck, lint concernés et diff-check réussis. Une première erreur du mock de prédicat et deux erreurs de typage de Session ont été corrigées, sans changement au produit pour faire passer ces tests. Revue indépendante lecture seule : aucun nouveau P0/P1 démontré.

## Limites

Le loader pédagogique continue à vérifier le parent legacy : un responsable autorisé uniquement dans Core peut encore être refusé. Ce refus supplémentaire ne constitue pas un parcours terminé. Le discovery familial unifié et le cutover restent à qualifier. Aucun test E2E/PostgreSQL de ce lot exécuté, aucune migration, aucun déploiement. La CI de 91161a7cf a terminé avec 43 succès, 8 échecs et ARIA Requirement Evidence ignoré ; elle ne qualifie pas ce nouveau lot.
