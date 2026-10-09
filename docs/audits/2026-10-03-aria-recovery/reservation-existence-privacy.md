# Réservation — suppression de l’oracle d’existence public

4 octobre 2026. Autorité : mandat deny-by-default, confidentialité des familles. Aucun changement commercial ou de paiement.

## Cause et compatibilité

POST /api/reservation/verify acceptait un e-mail fourni librement et retournait son existence dans les réservations sans authentification ni throttling. La réponse booléenne constitue déjà une information privée. Recherche app/components/e2e : aucun appel produit actif trouvé ; le contrat est référencé par ses tests et l’architecture de normalisation.

La recherche administrative conserve son contrat {exists:boolean} pour ADMIN et ASSISTANTE. Elle ne constitue ni une preuve de possession ni une autorisation familiale. Les rôles publics sont désormais refusés avant lecture du corps et de la DB. Aucun rapprochement familial/paiement par e-mail n’est ajouté.

## Preuves et correction

Cinq tests rouges : quatre identités publiques obtenaient 200, et le refus de rate limit n’était pas pris en compte. Le premier passage était pollué par un rejet DB conservé par un ancien mock ; son reset explicite a confirmé les cinq mêmes défauts sur 200 avant correction.

La route applique le guard staff canonique, CSRF, limite IP + identité staff (jamais e-mail recherché), lecture réellement bornée à 2048 octets et schéma strict. SELECT id uniquement. Les réponses et refus portent private/no-store et Vary Cookie, Authorization ; une panne d’autorité retourne 503 opaque sans lecture DB. Les messages de driver ne sont pas propagés.

La revue indépendante a identifié l’absence initiale de cache privé sur refus et la propagation d’une panne du limiter. Quatre tests de cache et un test de panne ont reproduit ces écarts, puis passent après correction. Les six scénarios historiques restent testés sous identité staff explicite. Le test historique n’utilise plus any.

Résultat : 4 suites, 43 tests réussis, dont 17 sur le endpoint ; normalisation canonique, politique de rate limit et refus production voisins inclus. ASSISTANTE autorisée ; origine hostile en production refusée avant limite/DB. Typecheck et ESLint ciblé réussis. Aucun test ignoré ni assertion abaissée. Aucun nouveau schéma, envoi ou paiement ; fixtures synthétiques seulement.

## Limites et rollback

Les administrateurs disposent du droit de gestion des inscriptions prévu par les routes existantes ; ce lot n’élargit aucun rôle financier. Les anciennes lectures de réservations staff et leur audit restent à qualifier séparément. La CI distante du prochain SHA doit renouveler cette preuve. Rollback applicatif par commit inverse ; ne pas rouvrir l’oracle public sans mécanisme de preuve de possession autorisé et testé.
