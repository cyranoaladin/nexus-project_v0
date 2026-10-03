# Frontière CSRF — configuration administrative

## Défaut reproduit

Le helper acceptait l’origine hostile lorsqu’elle correspondait au `Host` ou `X-Forwarded-Host` reçu. Il acceptait aussi toute origine localhost en production et la variante HTTP du domaine public via Host. Les handlers PATCH `/api/admin/config` et POST `/api/admin/config/rollback` ne vérifiaient pas l’origine. RBAC était présent, mais ne remplace pas cette frontière navigateur. Une exploitation complète dépend encore du contexte cookies/proxy ; le défaut de validation serveur a été reproduit directement.

## Correction

Les origines de production viennent uniquement du domaine canonique et des URL officielles configurées. Aucune confiance dans Host/X-Forwarded-Host. Les URL configurées sont réduites à leur origine HTTP(S), sans credentials ; un en-tête Origin doit être une origine exacte, sans chemin, credentials ou liste multiple. Referer reste un fallback uniquement en l’absence d’Origin. Le développement conserve les origines locales, la production exige leur configuration explicite avec port exact. Les deux mutations vérifient CSRF après RBAC et avant lecture du corps ou transaction.

## Preuves

Deux nouvelles suites testent le vrai contrôle avec `NODE_ENV=production`, 20 assertions comprenant les refus, origines officielles/preview/local configurées, absence d’origine et conservation de la réponse 401. RED : 8 échecs causaux, 12 réussites. GREEN avec deux suites voisines : 4 suites, 53 tests réussis. Les erreurs de préparation (résolution Jest implicite, puis types des fixtures) sont conservées dans les preuves privées ; le runner final utilise le script canonique.

Le bypass historique `NODE_ENV=test` n’est pas une preuve de sécurité et n’a pas été utilisé pour ces assertions. La validation navigateur/CI élargie reste nécessaire sur le prochain SHA. Aucune mutation production, aucune modification de prix ou du schéma. Rollback applicatif : conserver cette garde dans tout artefact de repli autorisé ; ne pas réintroduire la confiance dans les headers reçus.
