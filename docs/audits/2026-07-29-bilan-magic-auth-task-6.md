# Authentification parent par lien magique — tâche 6

## Date

2026-07-29

## Contexte

Le parcours canonique de bilan crée un compte parent inactif ou rattache une
demande à un parent existant. Cette étape ajoute la vérification du parent et la
reprise du parcours sans mot de passe, sans exposer l’existence d’un compte.

## Problèmes observés

- Aucun provider Auth.js ne consommait les liens `BilanMagicLink`.
- Aucun parcours client ne retirait le jeton du fragment avant authentification.
- La page d’authentification générique redirigeait les utilisateurs déjà
  connectés avant qu’un nouveau lien puisse être consommé.
- Il n’existait pas de rotation publique neutre des liens expirés ou perdus.

## Décisions prises

- Le jeton brut reste uniquement dans le fragment
  `/auth/bilan-magic#token=<jeton>` et n’est jamais persisté.
- La consommation recherche exclusivement le hash SHA-256 puis vérifie le rôle,
  le parent de la demande et le lien parent-enfant avant toute mutation.
- La consommation, l’activation, les vérifications et l’événement
  `ACCOUNT_VERIFIED` partagent une transaction `Serializable`.
- Le provider `bilan-magic` ignore uniquement les champs techniques ajoutés par
  Auth.js (`csrfToken`, `callbackUrl`) et refuse tout champ métier fourni par le
  client.
- La demande d’un nouveau lien retourne un contrat identique pour les comptes
  absents, ambigus, inéligibles ou pour les échecs SMTP.
- La page exacte `/auth/bilan-magic` est exemptée de la redirection des pages
  d’authentification et reçoit `Referrer-Policy: no-referrer`.

## Fichiers modifiés

- `auth.ts`, `auth.config.ts`, `middleware.ts`
- `lib/bilans/auth/consume-magic-link.ts`
- `lib/bilans/notifications/templates.ts`
- `app/auth/bilan-magic/page.tsx`
- `app/api/auth/bilan-magic/request/route.ts`
- tests unitaires, middleware et PostgreSQL associés

## Tests exécutés

- Tests unitaires du service, du provider, de la route, de la page et des
  templates.
- Régressions Auth.js et identifiants/mots de passe existants.
- Test PostgreSQL jetable : succès, relecture concurrente et rollback.
- TypeScript, lint, scanner de sécurité et vérifications de diff.

## Résultats

La consommation est à usage unique et un échec en aval laisse le jeton
utilisable grâce au rollback. Une demande sans enfant associé vérifie le parent
sans créer d’élève. Les réponses publiques ne contiennent ni jeton, ni identifiant
de demande, ni indication d’éligibilité.

## Risques restants

L’envoi SMTP de renouvellement est encore direct et best-effort. Une panne après
rotation laisse un nouveau lien hashé non livré ; le parent peut refaire une
demande, qui révoquera ce lien. La livraison durable sera prise en charge par le
worker de notifications prévu dans la suite du plan.

Le rate-limit distribué fail-closed en production est prévu avec les frontières
API versionnées de la tâche suivante. La route utilise déjà le preset public
`auth`.

## Rollback

Retirer le provider et les deux routes/pages ajoutées, puis restaurer les règles
génériques d’authentification dans `auth.config.ts` et `middleware.ts`. Aucun
changement de schéma ou de données n’est requis pour ce rollback.
