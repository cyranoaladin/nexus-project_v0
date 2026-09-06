# CGV : annulation sans comptabilité de crédits

## Date
6 septembre 2026.

## Contexte et état observé
Revue PR 212 : les CGV publiées présentent encore une consommation et une restitution automatique de crédits, supprimées du fonctionnement actif.
Source effective : `app/conditions-generales/page.tsx` ; `/conditions` redirige vers cette page.
Lecture HTTP de `https://nexusreussite.academy/conditions-generales` : 200, texte des articles 7.1 à 7.3 confirmé avant modification.

L'ancienne route `POST /api/sessions/cancel` calculait l'éligibilité à une restitution via `canCancelBooking`, puis annulait la séance même hors délai. Le préavis de 24 heures ne constituait donc pas une interdiction technique d'annuler. La route actuelle conserve les contrôles de rôle, de rattachement et de statut ; elle ne traite plus de restitution. Aucune modification de cette route n'est nécessaire.

## Décisions
- Retirer les mentions de crédits actifs des offres et des articles 7.1 à 7.3.
- Conserver expressément la possibilité d’annuler ou de reporter sans pénalité jusqu’à 24 heures avant une séance individuelle. Supprimer le compteur ne modifie pas cet engagement ; le fait que l’API puisse enregistrer une annulation tardive ne dispense pas de préserver la règle contractuelle.
- Distinguer l'enregistrement d'une annulation, le report à confirmer et le traitement des conséquences selon la commande acceptée.
- Ne promettre aucun remboursement automatique ; conserver intégralement les clauses de remboursement et de rétractation des articles 8 et 9.
- Préserver explicitement prestations acquises, délais, reports et droits convenus pour les commandes antérieures. Leur traitement appartient à l'équipe, selon les justificatifs contractuels et l'historique conservés.
- Versionner cette publication en CGV v1.1, date du 6 septembre 2026, dans la source existante `lib/cgv-policy.ts`. Ne pas modifier les versions d'acceptation déjà enregistrées, les archives, les transactions historiques ou la base de données.

## Fichiers modifiés
- `app/conditions-generales/page.tsx`
- `lib/cgv-policy.ts`
- `__tests__/legal/cgv-policy.test.ts`
- `__tests__/api/payments.bank-transfer.confirm.test.ts`
- Le présent compte rendu.

## Vérifications
- TDD : trois nouveaux contrôles CGV échouaient avant la première correction. Le retour de revue a ajouté un test qui échouait sur l’absence de la règle des 24 heures ; il réussit après rétablissement de cette phrase.
- `npm test -- --runInBand __tests__/legal/cgv-policy.test.ts __tests__/api/sessions.cancel.route.test.ts __tests__/api/payments.bank-transfer.confirm.test.ts` : 3 suites, 28 tests réussis (après retour de revue sur le maintien de la règle des 24 heures).
- Le test de rejeu d'un virement existant conserve sa version CGV v1.0 et sa date d'acceptation alors que la version courante est v1.1 ; aucune écriture réelle en base. Le mock expose et interdit explicitement `create`, `createMany`, `update`, `updateMany`, `upsert`, `delete` et `deleteMany`, ainsi que toute transaction et notification sur ce rejeu. La version et la date d’acceptation sont comparées à des valeurs littérales historiques, indépendantes des références de l’objet simulé.
- `npx eslint app/conditions-generales/page.tsx lib/cgv-policy.ts` : réussi.
- Mise en page, navigation et styles de la page inchangés ; aucune nouvelle recette visuelle locale réalisée pour cette correction textuelle.

## Limites et exploitation
Cette correction ne met pas en place de conversion automatique des anciens droits ni de calcul monétaire. Une ancienne commande doit être examinée selon ses propres documents ; la suppression du compteur ne vaut pas extinction de ses engagements. Elle ne constitue pas une nouvelle analyse juridique des autres articles. Les obligations de notification prévues à l'article 15 restent inchangées. Aucune publication, aucun déploiement et aucune notification externe effectués.

## Retour arrière
Annuler uniquement les modifications de cette correction avant publication. Après publication, préserver toute preuve d'acceptation de la version v1.1 ; ne pas rétrograder les versions déjà acceptées.
