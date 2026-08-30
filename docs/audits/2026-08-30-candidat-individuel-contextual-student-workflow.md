# Workflow contextuel élève vers devis candidat individuel

## Date

30 août 2026

## Contexte

Le simulateur renvoyait vers l'espace Élèves sans transmettre d'intention métier. L'annuaire ne permettait donc ni de choisir un élève existant pour le devis, ni de réutiliser immédiatement un élève créé.

## Problèmes observés

- lien générique vers l'annuaire Élèves ;
- aucune action contextuelle par élève ;
- identifiants retournés par la création ignorés par le parcours devis ;
- aucun retour autoritatif via `identity/resolve` ;
- appel interactif de résolution sans timeout.

## Décisions prises

- intent fermé `candidat-individuel`, sans `returnTo` client ;
- destinations déduites exclusivement du rôle `ADMIN` ou `ASSISTANTE` ;
- transport du seul `Student.id` opaque dans l'URL ;
- résolution obligatoire par l'API existante `identity/resolve` ;
- même fonction de résolution pour la recherche inline et le retour contextuel ;
- timeout de 10 secondes, abort au démontage et retry explicite ;
- nettoyage immédiat de `studentId` après résolution, sans reload ni stockage local.

## Fichiers modifiés

- pages Élèves ADMIN et ASSISTANTE ;
- `StaffStudentsPage` et `StudentsManagementWorkspace` ;
- `CandidatIndividuelWorkspace` ;
- helpers de navigation et de résolution d'identité ;
- tests unitaires, composants, pages et E2E candidat individuel.

## Tests exécutés

- typecheck et lint ;
- unitaires et composants ciblés ;
- API, DB, intégration PostgreSQL réelle ;
- gels d'architecture et sécurité PR180 ;
- E2E standalone pour création et sélection contextuelle ADMIN/ASSISTANTE ;
- build Next.js standalone et audit d'artefact.

## Résultats

Le parcours contextuel existant et créé aboutit à une identité complète et au Profil. Le mode normal de l'annuaire reste inchangé. Aucun redirect arbitraire, aucune PII supplémentaire et aucune migration n'ont été introduits.

## Risques restants

L'incident P1-A de sélection inline dans le Chrome habituel de la direction reste indépendant et attend les deux traces live prévues.

## Rollback

Aucun cutover n'est réalisé dans ce lot avant la trace live. La production reste sur `ca2b86efa0c552277bc3a98c03c3944be8459835`.
