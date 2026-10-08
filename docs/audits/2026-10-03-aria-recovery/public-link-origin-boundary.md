# Frontière HTTP du contrôle des liens publics

## Défaut et stratégie

Le checker historique utilisait des préfixes sensibles à la casse, ignorait `javascript:` et considérait les URLs relatives au protocole comme internes. Sa classification a été extraite sans changement pour reproduire le défaut : 9 tests rouges et 6 verts. La version corrigée utilise le parseur URL, autorise uniquement HTTP/HTTPS pour les requêtes et compare les origines exactes. Les schémas dangereux et URLs invalides provoquent une assertion ; ils ne sont pas ignorés. Les liens contact et ancres restent intentionnellement hors requête HTTP.

Les URLs HTTP absolues de même origine sont désormais contrôlées. Les origines externes sont exclues par comparaison structurelle ; les variantes Unicode, user-info, casse et caractères de contrôle sont couvertes. Un lien interne avec user-info est refusé. Les messages d'échec ne reproduisent plus le href complet.

## Preuves

- Matrice finale : 20 tests réussis, 0,476 s.
- Typecheck : code de sortie 0.
- Lint du helper et des tests, et lint explicite `--no-ignore` du checker : zéro avertissement.
- Premier emplacement `__tests__/e2e` exclu par la configuration Jest : aucun test exécuté. Le nouveau fichier de cette mission a été déplacé sous `__tests__/scripts`, sans toucher un fichier historique.
- Le premier lint du checker a rencontré la règle d'exclusion E2E ; le contrôle explicite a ensuite réellement analysé le fichier.
- Journaux : `.artifacts/recovery/public-link-boundary-red-canonical.log`, `public-link-boundary-matrix-green.log`, `public-link-boundary-typecheck.log`.

## Limites

Pas de qualification des huit pages réelles par ces seuls tests de classification. Leur campagne navigateur et CodeQL doivent confirmer le prochain SHA. Aucune requête vers un prestataire externe ni modification de production.

## Révision du 2026-10-08 (revue Copilot sur ec4984256)

Un lien externe porteur d'identifiants (`https://user:pass@externe/`) était classé `EXTERNAL` donc ignoré : une page publique exposant des identifiants n'aurait pas été signalée. Le contrôle user-info précède désormais la comparaison d'origine : tout lien HTTP avec user-info, interne ou externe, est `UNSAFE`. RED 3 → GREEN 22. Aucune source publique ne contient de tel lien (recherche `https?://…@` sur app, components, content, lib, data : 0).
