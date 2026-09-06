# Invalidation des accès lors d’un changement de contact parent

## Date et contexte
6 septembre 2026 — revue complémentaire PR 212.

Deux défauts confirmés : le PATCH administrateur modifiait `phone` sans `phoneNormalized`, et un jeton d’activation email existant pouvait rester utilisable après remplacement de l’adresse. Le trigger déjà déployé annulait la preuve `emailVerifiedAt`, mais pas le jeton.

## Corrections
- `app/api/admin/users/route.ts` : pour un parent courant ou cible, normaliser le téléphone et écrire simultanément son affichage et sa valeur canonique. Le trigger existant assure alors révocation des challenges, de l’identité vérifiée et des sessions.
- `lib/services/student-activation.service.ts` : consommation conditionnée à l’email lu, au rôle attendu et, pour un parent, à l’absence de fusion. Le changement intervenant pendant le calcul du mot de passe fait échouer la transition.
- `app/api/auth/resend-activation/route.ts` : même protection sur l’émission. Sans comparaison de l’email, une course partant de champs de jeton vides pouvait émettre un nouveau lien vers l’ancienne adresse après son remplacement.
- Migration additionnelle `20260906130000_parent_email_activation_invalidation` : remplacement de la fonction du trigger existant, sans modification des deux migrations déjà appliquées. Lors d’un changement d’email parent, invalider le jeton et son expiration s’ils conservent l’ancien hash, effacer la preuve email et révoquer les sessions. Un hash distinct émis atomiquement vers la nouvelle adresse est conservé. Le bloc d’invalidation du téléphone reste intégralement préservé.

## Écritures de contact examinées
Recherche des appels `user.update`, `user.updateMany` et `user.upsert` dans `app/` et `lib/`, puis lecture des données effectivement écrites :
- Administration utilisateurs : email générique et téléphone parent — protection par le trigger et normalisation dans le PATCH.
- `lib/bilans/staff/parent-contact-service.ts` : ajout email parent avec émission d’un nouveau hash dans la même écriture ; la branche fusion retire les accès du compte source.
- `lib/families/create-family.ts` : ajout email dans le parcours papier avec nouveau hash atomique ; les écritures de téléphone utilisent déjà `normalizeParentPhone`. Le parcours WhatsApp ne remplace pas implicitement le contact d’un parent existant.
- `lib/bilans/family-landing/access.ts` : ajout/renvoi email avec email et nouveau hash dans la même écriture.
- Réémission d’activation : ne change pas l’email ; CAS renforcé pour garantir que la destination lue reste actuelle au moment de l’émission.
- Activation élève et gestion coach : écritures limitées à ces rôles ; le trigger protège aussi un changement impliquant un ancien ou nouveau rôle parent.
- Réinitialisation de mot de passe, révocation de sessions, inscription parent et cycle de challenge téléphone : ne remplacent pas l’email dans les écritures examinées.
- Anonymisation RGPD : traitement distinct de l’agent responsable ; la protection SQL s’applique aussi aux écritures de contact effectuées directement en base.

Les créations initiales d’utilisateur n’ont pas de précédent jeton à invalider. Le PATCH parent est corrigé sans étendre la normalisation aux autres rôles ou modifier les formulaires.

## Vérifications
- RED unitaires : téléphone canonique absent ; trois courses email/rôle/fusion autorisaient une activation ; réémission vers l’ancienne adresse malgré une course.
- GREEN : 5 suites unitaires, 44 tests réussis, comprenant administration, activation et réémission.
- PostgreSQL 15 synthétique avec 104 migrations : deux échecs attendus avant la migration additionnelle ; le test de téléphone corrigé réussissait déjà.
- Migration 105 appliquée uniquement sur cette base jetable : 2 suites réelles, 13 tests réussis, dont protection complète du téléphone existante, ancien lien invalidé, nouveau lien atomique utilisable et email inchangé préservé.
- ESLint sur les trois fichiers de production : réussi.
- Typecheck global final (`npx tsc --noEmit`) : réussi après stabilisation du fichier concurrent `lib/http/bounded-request-body`.
- Aucun changement des deux migrations antérieures. Aucune opération en production, aucun email envoyé.

## Limite de transition
Le trigger protège les changements futurs. Les anciens jetons email ne portent aucun snapshot de destination : leur provenance ne peut pas être prouvée après un changement historique d’adresse. La migration révoque donc une seule fois les jetons email existants des seuls comptes PARENT non activés (activationToken non nul), en effaçant uniquement activationToken et activationExpiry. Les liens concernés doivent être réémis vers le contact actuel via le parcours existant ; aucun message n’est envoyé par la migration. Les comptes activés, les autres rôles, les challenges WhatsApp, les associations familiales, les droits et l’historique sont conservés. Une émission nouvelle après la migration reste possible.

Recette de transition : fixtures historiques créées avant exécution du SQL final exact de la migration sur PostgreSQL 15 synthétique, dans une transaction annulée pour préserver la base partagée des agents. RED : le seul test de transition échoue sans UPDATE. GREEN : 2 suites PostgreSQL, 14 tests réussis ; révocation ciblée et conservation intégrale vérifiées des lignes parent hors deux champs, élève, parent activé, profil familial, scolarité/historique de séances, droit et challenge WhatsApp ; réémission également vérifiée. Cette recette ne prétend pas à une nouvelle application par Prisma du numéro 105 déjà enregistré dans cette base jetable.

## Retour arrière
Ne pas modifier les migrations déjà enregistrées. Toute correction du trigger après déploiement doit passer par une migration additionnelle. Ne pas restaurer des jetons révoqués.
