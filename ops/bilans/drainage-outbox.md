# Drainage manuel des jobs de scoring Canonical

## Portée

Ce point d'entrée reprend les jobs `SCORE_ATTEMPT` en attente ou en échec. Il ne crée
aucune soumission et ne traite aucun autre type de job. Aucun daemon, ordonnanceur ou
déclenchement permanent n'est activé par cette commande.

## Préconditions

- Exécuter depuis la version applicative qui a créé les jobs.
- Charger l'environnement de l'application par le mécanisme d'exploitation approuvé.
- Vérifier que le feature flag du pack concerné est explicitement autorisé.
- Ne jamais afficher `DATABASE_URL` ni le contenu d'un fichier d'environnement.

## Commande

```bash
./node_modules/.bin/tsx scripts/bilans/drain-scoring-outbox.ts --limit 10
```

`--limit` accepte un entier de 1 à 100. La sortie ne contient que des compteurs, des
identifiants techniques et des codes d'erreur. Elle ne contient ni nom, ni e-mail, ni
réponse d'élève.

Un job `FAILED` peut être repris par la même commande. Le lease empêche deux exécutions
concurrentes de revendiquer le même job; un lease expiré redevient éligible.
