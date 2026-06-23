# P0-004 Lot 2E — CI fix predict ownership integration test

## Contexte
- Commit Lot 2E : `5f1d25965`
- Run CI échoué : `26627488455`
- Job échoué : `Integration Tests`
- Fichier : `__tests__/integration/predict-ownership.real.test.ts`

## Cause
Le test d'intégration vérifiait l'ancien contrat de `/api/assessments/predict` :
- `studentId` basé sur `User.id`;
- accès coach basé sur `SessionBooking`;
- ancien message `Aucune séance`.

Le contrat sécurisé Lot 2E est désormais :
- `studentId = Student.id`;
- parent ownership via `ParentProfile.children.some({ id: studentId })`;
- coach ownership via `CoachStudentAssignment` active;
- message de refus non énumérant.

## Correction
- Les appels autorisés utilisent maintenant `student1.id`.
- La fixture coach autorisée crée une `CoachStudentAssignment` active entre `coachProfile.id` et `student1.id`.
- Le test coach non autorisé vérifie le message non énumérant `Accès refusé`.
- Aucun fallback `Student.userId` n'est réintroduit.

## Validation
- typecheck : OK (`npm run typecheck`).
- build : OK (`npm run build`).
- test ciblé : OK, `__tests__/api/assessments.predict.route.test.ts` (1 suite, 17 tests).
- test unitaire complet : OK, 446 suites, 5921 tests.
- test integration local : non lancé, DB test `127.0.0.1:5435` fermée.
- CI attendue : relancer `CI Pipeline` sur le commit de fix et vérifier `Integration Tests`.
