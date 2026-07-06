# Lot 6 — ContactLead retention DB dry-run

## Objectif

Valider le script de purge/anonymisation ContactLead en dry-run contre une DB non production, sans PII et sans mutation.

## Préconditions vérifiées

```bash
if [ -n "${DATABASE_URL:-}" ]; then echo "DATABASE_URL_PRESENT"; else echo "DATABASE_URL_ABSENT"; fi
if [ "${NEXUS_ALLOW_CONTACT_LEAD_DRY_RUN_DB:-}" = "true" ]; then echo "CONTACT_LEAD_DRY_RUN_ALLOWED"; else echo "CONTACT_LEAD_DRY_RUN_NOT_ALLOWED"; fi
```

Résultats :

- `DATABASE_URL_ABSENT`
- `CONTACT_LEAD_DRY_RUN_NOT_ALLOWED`

## Dry-run DB

NON EXÉCUTÉ.

Cause : aucune DB non production disponible dans l'environnement local et aucune autorisation explicite.

Commande attendue quand la DB non production est confirmée :

```bash
source /home/alaeddine/.nvm/nvm.sh && nvm use 20.20.0 >/dev/null && npx tsx scripts/maintenance/contact-leads-retention.ts
```

## Preuve par fixture existante

Lot 5 a validé `__tests__/scripts/contact-leads-retention.test.ts` :

- dry-run par défaut ;
- pas d'email/téléphone en clair ;
- demande d'effacement parentale par hash ;
- `--apply` explicite requis.

## Décision

- `CONTACT_LEAD_DB_DRY_RUN = NOT_PROVEN`
- `--apply` production interdit sans validation humaine explicite.
- Go-live large interdit tant qu'un dry-run DB non production n'est pas exécuté.
