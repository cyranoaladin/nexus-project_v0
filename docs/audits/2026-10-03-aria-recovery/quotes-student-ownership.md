# Devis : ownership explicite de l’élève

## Défaut et reproduction

Sur c0bb142a0795d145efba924c0725af5f7383883d, POST /api/quotes affectait directement le studentId fourni par un compte ELEVE au devis. Quatre nouveaux tests ont échoué : élève tiers accepté, profil absent accepté, absence de résolution depuis User.id et panne du store non vérifiée. Aucun accès de production n’a été tenté.

## Correction

Le garde serveur requireStudentOwnsStudent résout uniquement Student.id depuis le User.id authentifié, puis compare au studentId demandé. Le refus 403 précède createQuote ; une panne renvoie 503 constant sans cause du driver. Le cas positif persiste uniquement le profil correspondant. Aucun changement de prix, schéma ou paiement.

## Preuves

quotes-student-ownership-red-4.log : 4 échecs attendus avant correction. quotes-student-ownership-green.log : 3 suites, 18 tests réussis, incluant les refus parent Core par studentId et diagnosticId ainsi que la création publique existante. Les logs restent privés dans .artifacts/recovery. La CI doit être renouvelée après commit.

## Limites et retour arrière

Cette vérification d’identité ne constitue pas un verrou de coordination V1/Core pendant une migration active. Ce risque transversal reste ouvert ; aucun go-live revendiqué. Le rollback applicatif conserve les données et ne nécessite aucune down migration ; réintroduire l’affectation client aveugle est interdit.
