# Filtrage des définitions legacy sans curriculum connu

## Contexte

Le lot bilans introduit un adaptateur qui convertit les définitions diagnostiques historiques vers le contrat canonique `AssessmentDefinition`. Une définition dont la combinaison matière/niveau n'est pas référencée reçoit des identifiants de curriculum sentinelles préfixés par `UNKNOWN:` et doit être exclue par l'adaptation en lot.

Le test existant démontre que cette exclusion ne fonctionne pas : `adaptLegacyDefinitions` cherche actuellement le mot `UNKNOWN` dans le texte libre des avertissements, alors que l'avertissement produit ne le contient pas. La définition invalide est donc ajoutée aux résultats.

## Décision approuvée

Déterminer le caractère critique depuis les données structurées de `curriculumBinding`, en vérifiant si `prerequisiteCurriculumId` ou `targetCurriculumId` commence par `UNKNOWN:`.

Cette approche est préférée à :

- modifier le libellé de l'avertissement, qui maintiendrait un couplage fragile au texte ;
- introduire immédiatement un nouveau type d'avertissement structuré, qui élargirait inutilement cette correction.

## Comportement attendu

- Une définition connue reste adaptée et incluse dans `results`.
- Une définition sans liaison curriculum connue est absente de `results` et sa clé est ajoutée à `skipped`.
- `adaptLegacyDefinition` conserve son comportement actuel : il retourne une définition `DRAFT` et des avertissements pour permettre une inspection unitaire.
- Aucun changement n'est apporté aux mappings curriculum ni aux contrats publics.

## Modification

Le seul changement fonctionnel concerne `lib/diagnostics/legacy-adapter.ts`. Le test rouge existe déjà dans `__tests__/lib/diagnostics/assessment-definition.test.ts` et sert de preuve de régression.

## Validation

1. Rejouer le test isolé et constater son échec avant correction.
2. Appliquer la détection minimale des deux identifiants structurés.
3. Rejouer le test isolé, puis les quatre suites du lot bilans.
4. Exécuter le typecheck, le lint, les contrôles de sécurité, la suite unitaire complète et le build.
5. Vérifier le diff indexé avant commit et la synchronisation avec l'amont après push.
