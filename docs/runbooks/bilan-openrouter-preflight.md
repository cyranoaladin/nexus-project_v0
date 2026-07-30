# Runbook — preflight privé OpenRouter

## Portée

Le preflight vérifie le contrat C1 avec des données synthétiques. Il
n'autorise ni activation métier, ni donnée de mineur, ni publication.
Il n'est jamais lancé automatiquement par la CI.

## Prérequis privés

- clé OpenRouter Nexus dédiée dans
  `/home/alaeddine/.config/nexus-secrets/openrouter-api-key` ;
- allowlist des deux modèles approuvés ;
- ZDR et collecte fournisseur configurés selon la politique ;
- budgets owner par bilan et par jour ;
- accès HTTPS à `https://openrouter.ai/api/v1`.

La clé reste dans le store runtime privé. Elle n'est placée ni dans Git, ni
dans une base, ni dans une preuve.

## Configuration

```text
BILAN_REPORT_GENERATION_MODE=OPENROUTER_REQUIRED
OPENROUTER_BASE_URL=https://openrouter.ai/api/v1
BILAN_OPENROUTER_PRIMARY_MODEL=anthropic/claude-sonnet-5
BILAN_OPENROUTER_FALLBACK_MODELS=["openai/gpt-5.6-terra"]
BILAN_OPENROUTER_MODEL_POLICY_VERSION=bilan-model-policy-v1.1
BILAN_OPENROUTER_TIMEOUT_MS=90000
BILAN_OPENROUTER_MAX_ATTEMPTS=3
BILAN_OPENROUTER_MAX_OUTPUT_TOKENS=2048
BILAN_OPENROUTER_MAX_COST_USD_PER_REPORT=0.30
BILAN_OPENROUTER_MAX_COST_USD_PER_ASSESSMENT=0.75
BILAN_OPENROUTER_DAILY_BUDGET_USD=15.00
```

Les budgets de production n'ont aucun fallback illimité.

Le dossier de la clé doit être `0700`, le fichier régulier `0600`, appartenir
à l'utilisateur local, ne pas être un lien symbolique et contenir exactement
une ligne non vide. La clé n'est jamais passée dans les arguments de commande.

## Commandes

Contrôle CI sans réseau :

```bash
npm run bilan:openrouter:capabilities
```

Preflight privé live :

```bash
npm run bilan:openrouter:preflight
```

## Contrôles effectués

1. lecture de `/api/v1/models` ;
2. résolution des deux slugs canoniques ;
3. structured output strict et `max_tokens` ;
4. reasoning `low` simultané ;
5. `require_parameters`, `data_collection=deny` et ZDR ;
6. appel synthétique séparé de chaque modèle ;
7. identifiant de génération, usage, coût et budget ;
8. validation Zod du contrat `synthetic-no-pii`.

Une capacité supplémentaire n'est jamais activée. Un changement de slug ou
d'une capacité requise bloque avec
`BLOCKED_BY_MODEL_PARAMETER_COMPATIBILITY`.

## Preuve

Le rapport expurgé est écrit sous :

`~/.local/share/nexus-release-evidence/bilan-openrouter-preflight/<timestamp>/`

- répertoire : `0700` ;
- fichier : `0600`.

Il contient configuration expurgée, politique, preuve intègre, snapshots et
provenance.
Il ne contient ni clé, ni prompt brut métier, ni réponse brute, ni donnée
élève.

La preuve expire au plus 24 heures après sa vérification. Son checksum lie le
catalogue, la politique, l'empreinte HMAC non réversible de la clé et le SHA Git
exact du logiciel. Les snapshots ont cinq minutes au plus. Toute horloge future
est refusée. Il faut relancer le preflight après changement de clé, logiciel,
politique, slug ou capacité.

Le catalogue live et une complétion n'ont pas la même limite : 32 MiB pour
`/models`, 4 MiB pour une réponse de Chat Completions et 64 KiB pour une
enveloppe d'erreur.

Les réglages de compte `prompt logging`, `completion logging` et entraînement
ne sont pas déduits du succès du transport. Si aucune API de compte vérifiable
n'est disponible, la preuve porte explicitement `OWNER_EVIDENCE_REQUIRED`.
L'activation reste bloquée jusqu'à une preuve privée nominative.

## Échecs

- Ne jamais contourner une incompatibilité en retirant reasoning.
- Ne jamais activer un paramètre nouveau sans version de politique.
- Ne jamais substituer un modèle non approuvé.
- Conserver `BILAN_REPORT_GENERATION_MODE=DISABLED`.
- Qualifier le blocage : configuration, compatibilité modèle, budget ou
  fournisseur.

Le preflight C1 vérifie les bornes configurées et le coût de ses appels
synthétiques. Le compteur partagé du budget journalier appartient au worker
C2 ; tant qu'il n'est pas implémenté et testé atomiquement, garder le mode
`DISABLED`.

## Rollback

Le preflight n'écrit aucun état applicatif. Supprimer localement sa preuve
privée si la politique de conservation l'exige, révoquer/faire tourner la clé
selon le processus sécurité, et maintenir la génération désactivée.
