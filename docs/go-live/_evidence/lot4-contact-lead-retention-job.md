# Lot 4 — ContactLead retention job

## Script

`scripts/maintenance/contact-leads-retention.ts`

## Contrat

- Dry-run par défaut.
- Application uniquement avec `--apply`.
- Anonymise les leads non convertis au-delà de `CONTACT_LEAD_RETENTION_DAYS`.
- Supporte les demandes d'effacement parentales via `--email-hash` ou `--email-hashes-file`.
- Ne renvoie/logue pas d'email ou téléphone en clair.
- Ne modifie pas les leads `ENROLLED`.
- N'anonymise pas les leads `QUALIFIED` par rétention automatique ; seulement sur demande d'effacement.

## Données anonymisées

- `name = Lead anonymisé`
- `email = erased-<id>@deleted.nexus.local`
- `phone/profile/interest/urgency/notes = null`
- `source = retention-anonymized`
- `status = LOST`

## Tests

- `__tests__/scripts/contact-leads-retention.test.ts`
- `__tests__/lib/crm/contact-leads.retention.test.ts`

## Décision opérationnelle

Le mécanisme est exécutable et testé. L'exécution `--apply` en production requiert validation humaine et fenêtre de maintenance.
