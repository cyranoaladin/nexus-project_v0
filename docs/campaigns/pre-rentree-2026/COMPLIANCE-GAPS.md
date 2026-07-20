# Lacunes de conformité et d’exploitation

## Juridique

Aucune source ne porte simultanément une version de termes, une date d’effet, une référence d’approbation propriétaire et une référence d’approbation juridique. Restent donc exclus de la publication :

- échéance définitive du solde, y compris la recommandation de 72 heures ;
- annulation familiale, absence, interruption, maladie et remplacement d’élève ;
- report, rattrapage, force majeure et indisponibilité d’un enseignant ;
- délai de remboursement si Nexus n’ouvre pas un groupe ;
- durée de maintien contractuelle de la proposition de place.

Le principe commercial « aucun transfert automatique sans l’accord de la famille » doit être intégré aux termes approuvés avant d’être opposable.

## Confidentialité

La notice versionnée et approuvée manque. Les gabarits de revue ne contiennent aucune donnée réelle et ne peuvent pas être publiés ou utilisés pour collecter des données. Responsable de traitement, finalités, bases, destinataires, durées, droits, contact et gestion des consentements doivent être validés.

## Manuels

Les quatre entrées du registre sont éligibles mais `printReady`, `ownerApproved` et `stockReady` valent faux. Aucun avantage manuel n’apparaît donc dans les surfaces familiales.

## Planning et équipe

Le planning socle n’a pas d’affectation validée de salles ni d’enseignants. Il reste marqué pour revue. Aucun titre ou qualification d’enseignant ne peut être annoncé.

## Parcours Premium 360

Les artefacts pédagogiques structurés existent, mais les questionnaires, bilans, relecture, stockage, diffusion et capacité de production nominative ne sont pas opérationnels. Ils ne sont pas des engagements publics.

## Conséquence

```text
PRIVATE_CONTRACTUAL_PACKAGE=BLOCKED
OWNER_REVIEW=PENDING
LEGAL_REVIEW=PENDING
PRIVACY_REVIEW=PENDING
TEACHER_ASSIGNMENTS_VALIDATED=false
ROOM_ASSIGNMENTS_VALIDATED=false
PUBLIC_DISTRIBUTION=NOT_AUTHORIZED
```

Ces éléments sont des gates externes et opérationnels explicitement tracés. Ils ne sont pas contournés par le renderer.
