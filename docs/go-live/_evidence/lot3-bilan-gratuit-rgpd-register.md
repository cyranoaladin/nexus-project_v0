# Lot 3 — Registre RGPD `/api/bilan-gratuit` lead_only

## Décision

Le tunnel public `/api/bilan-gratuit` reste en `lead_only`.

## Finalité

Permettre à un parent de demander un rappel ou un bilan pédagogique gratuit pour son enfant.

## Base légale

Consentement parent et demande précontractuelle.

## Données traitées

- Parent : prénom, nom, email, téléphone.
- Élève : prénom, nom optionnel, niveau, établissement optionnel.
- Besoin pédagogique : matières, niveau actuel, objectifs, difficultés, modalité, disponibilités.
- Consentements : conditions et newsletter optionnelle.

## Données retirées ou refusées

- `studentBirthDate` n'est plus accepté dans le schéma public.
- Aucun `User`, `ParentProfile`, `Student`, token d'activation ou email d'activation n'est créé.
- Aucune réponse publique ne renvoie `leadId`, `parentId`, `studentId`, token ou email-existence.

## Minimisation

Les notes CRM sont tronquées et limitées aux éléments nécessaires au rappel. La date de naissance est rejetée au lieu d'être ignorée silencieusement.

## Destinataires internes

Équipe admissions/pédagogie Nexus Réussite.

## Rétention

Voir `docs/go-live/_evidence/lot3-contact-lead-retention-policy.md`.

## Tests

- `__tests__/api/bilan-gratuit.rgpd-minimization.test.ts`
- `__tests__/api/bilan-gratuit.product-rgpd.test.ts`
- `__tests__/api/bilan-gratuit.security.test.ts`
- `__tests__/api/bilan-gratuit.test.ts`

## Risque résiduel

Le formulaire reste public et manipule des données de mineurs. La bêta élargie exige la preuve Redis/Upstash et une validation humaine de la politique de confidentialité.
