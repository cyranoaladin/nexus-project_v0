# Drainage manuel des jobs Canonical (scoring + génération de rapport)

## Portée

Deux points d'entrée distincts, un par type de job. Ni l'un ni l'autre ne crée de
soumission ni ne traite le type de job de l'autre. Aucun daemon, ordonnanceur ou
déclenchement permanent n'est activé par ces commandes (le scheduler en process,
`lib/bilans/worker/scheduler.ts`, gated par `BILAN_WORKER_ENABLED`, est un mécanisme
séparé et optionnel — ces scripts restent le filet de secours manuel tant qu'il est
désactivé).

Le pipeline est en deux temps : `SCORE_ATTEMPT` calcule le score puis enqueue
`GENERATE_REPORT` ; `GENERATE_REPORT` produit le rapport (LLM si `OPENROUTER_API_KEY`
est configurée, sinon repli déterministe — jamais d'échec pour absence de clé) et le
met en attente de revue. **Si le scheduler est désactivé, les deux scripts doivent être
exécutés l'un après l'autre** pour qu'une passation soumise atteigne la revue ; exécuter
uniquement le premier laisse la tentative bloquée à `SCORED`.

## Préconditions

- Exécuter depuis la version applicative qui a créé les jobs.
- Charger l'environnement de l'application par le mécanisme d'exploitation approuvé.
- Vérifier que le feature flag du pack concerné est explicitement autorisé.
- Ne jamais afficher `DATABASE_URL` ni le contenu d'un fichier d'environnement.

## Commandes

```bash
./node_modules/.bin/tsx scripts/bilans/drain-scoring-outbox.ts --limit 10
./node_modules/.bin/tsx scripts/bilans/drain-report-generation-outbox.ts --limit 10
```

`--limit` accepte un entier de 1 à 100 pour chaque commande. La sortie ne contient que
des compteurs, des identifiants techniques et des codes d'erreur. Elle ne contient ni
nom, ni e-mail, ni réponse d'élève.

Un job `FAILED` peut être repris par la même commande. Le lease empêche deux exécutions
concurrentes de revendiquer le même job; un lease expiré redevient éligible.
