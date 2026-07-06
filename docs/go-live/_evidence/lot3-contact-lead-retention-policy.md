# Lot 3 — ContactLead retention policy

## Décision

Les leads publics mineur-related sont conservés avec une durée bornée et une procédure d'effacement.

## Politique

- Durée de conservation proposée : `365` jours.
- SLA d'effacement demande parent : `30` jours maximum.
- Base légale : consentement parent et demande précontractuelle.
- Action production requise : planifier un job de purge/anonymisation avant go-live large.

## Code

- `lib/crm/contact-leads.ts`
- Exports ajoutés :
  - `CONTACT_LEAD_RETENTION_DAYS`
  - `CONTACT_LEAD_ERASURE_SLA_DAYS`
  - `buildContactLeadRetentionDecision()`

## Dédoublonnage

`captureContactLead` recherche un lead `NEW` existant pour le même email et la même source, puis met à jour cette ligne au lieu de créer systématiquement un doublon.

## Tests

- `__tests__/lib/crm/contact-leads.retention.test.ts`

## Réserve

Le job de purge réel n'est pas implémenté dans ce lot pour éviter une migration ou tâche runtime non validée. Il reste requis avant go-live large.
