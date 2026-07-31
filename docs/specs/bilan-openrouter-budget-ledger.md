# Ledger budgétaire OpenRouter

## But

Empêcher un appel qui pourrait dépasser une limite, compter les coûts connus
d'échecs et conserver une réserve pour toute issue inconnue. C1.5 valide ce
contrat hors DB ; C2 devra rendre ses écritures atomiques avec les transitions
de job.

## Unités et plafonds

Tous les montants sont des entiers `micro-USD`. Aucune conversion monétaire ne
passe par un flottant. Les plafonds pilote approuvés sont :

- audience : `300000` ;
- assessment : `750000` ;
- quotidien : `15000000` ;
- avertissement quotidien : 70 % ;
- arrêt dur : 100 %.

Le benchmark C1.5 possède ses plafonds isolés : avertissement `700000`, arrêt
dur `1000000`, 42 appels réseau au maximum.

## Réservation pré-appel

La réserve conservatrice est calculée à partir des prix du catalogue, de la
borne d'entrée, de la limite de sortie, du reasoning facturable, du coût fixe
éventuel et d'une marge versionnée. Prix absent, négatif, exponentiel ou non
borné : aucun appel.

Avant le réseau, une opération atomique vérifie :

`coût connu + réserves ouvertes + réserves inconnues + nouvelle réserve ≤ plafond`

Puis elle inscrit une réservation unique liée au job et au numéro de tentative.

## Réconciliation

- coût retourné : ajouter le coût connu et fermer la réserve ;
- réponse invalide avec usage : même traitement, le coût est compté ;
- panne sans coût fiable : passer la réserve en `UNKNOWN`, sans la libérer ;
- réconciliation tardive : remplacer `UNKNOWN` par le coût confirmé, une seule
  fois et avec audit ;
- annulation avant tout octet réseau : libération explicite et auditée.

Le compteur `reportedCostUndercountMicrosUsd` doit rester zéro. Les DTO JSON
sérialisent les montants comme chaînes lorsque la sûreté numérique l'exige.

## Concurrence

La future implémentation impose une contrainte unique sur la réservation de
tentative, un verrou ou update conditionnel sur le budget agrégé et une version
optimiste. Deux workers ne peuvent ni réserver ni réconcilier la même tentative
deux fois.

## Alertes

Alerter au seuil d'avertissement, à toute réserve `UNKNOWN` trop ancienne, à
un coût fournisseur supérieur à la réserve, à 401/402 et au hard stop. Une
alerte n'augmente jamais automatiquement un budget.
