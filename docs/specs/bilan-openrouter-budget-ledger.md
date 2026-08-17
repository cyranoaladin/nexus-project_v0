# Ledger budgétaire OpenRouter

## Unité et plafonds

Tous les montants sont des entiers en micro-USD. Aucune conversion monétaire ne
passe par un flottant. Les plafonds pilote propriétaires sont :

- audience/report : `300000` ;
- assessment : `750000` ;
- journée : `15000000` ;
- avertissement : 70 % ;
- arrêt dur : 100 %.

Les plafonds de production restent une entrée propriétaire explicite et ne
possèdent aucun fallback illimité.

## Écritures logiques

| Type | Effet |
| --- | --- |
| `RESERVE` | immobilise une borne conservatrice avant appel |
| `RECONCILE` | remplace la réserve par le coût fournisseur connu |
| `HOLD_UNKNOWN` | conserve la réserve d'un résultat ambigu |
| `RELEASE_NO_CALL` | libère uniquement si la preuve montre qu'aucun appel n'a commencé |
| `ADJUST_OPERATOR` | correction auditée, jamais automatique |

Chaque écriture est liée à `jobId`, `invocationId`, audience, assessment,
politique, date budgétaire et clé d'idempotence. Une contrainte atomique devra
empêcher deux réservations concurrentes de dépasser un plafond.

## Algorithme pré-appel

1. Charger les coûts réalisés, réserves ouvertes et plafonds dans une transaction
   courte avec verrouillage approprié.
2. Calculer la réserve depuis prix catalogue validé, tokens d'entrée bornés,
   plafond de sortie et marge de sécurité.
3. Refuser si un plafond audience, assessment ou quotidien serait dépassé.
4. Persister `RESERVE`, puis commit.
5. Exécuter l'appel hors transaction.
6. Persister `RECONCILE` avec le coût OpenRouter, source de vérité.

Prix absent/invalide : arrêt avant appel. Coût partiel d'une sortie invalide :
comptabilisé. Résultat inconnu : réserve conservée jusqu'à réconciliation
opérateur. Les métriques ne peuvent jamais minorer coût connu + réserves inconnues.

## Observabilité

Exposer uniquement agrégats et identifiants techniques : réservé, réalisé,
inconnu, pourcentage par plafond, avertissements et refus. Aucun prompt, contenu,
élève, parent ou secret dans le ledger ou ses logs.
