# Pré-rentrée 2026 — dossier de gouvernance

> NON PUBLIC — usage interne Nexus Réussite uniquement.

Ce dossier organise trois décisions distinctes :

1. la revue propriétaire du lot public v5 ;
2. la revue juridique des conditions particulières ;
3. la revue de la notice de confidentialité du dossier privé.

## Ordre de travail

1. Générer le lot canonique.
2. Exécuter le vérificateur de gouvernance.
3. Réaliser la checklist propriétaire sur les artefacts liés au manifest de revue.
4. Copier `owner-approval.template.json` vers `owner-approval.json` et saisir manuellement la décision.
5. Relancer le vérificateur. Une modification d’artefact rend l’ancienne décision `STALE`.
6. Transmettre séparément les deux demandes aux responsables compétents.
7. Ne jamais créer de PDF privé avant disponibilité de sources juridiques et confidentialité approuvées.

## Commandes

```bash
python scripts/pre-rentree/verify_release_approvals.py \
  --package outputs-v5-canonical

python scripts/pre-rentree/verify_release_approvals.py \
  --package outputs-v5-canonical \
  --require-owner-approval
```

Le second mode est volontairement bloquant tant que la décision propriétaire n’est pas `APPROVED`. Il ne constitue pas une autorisation automatique de publication.

## Fichiers

- `owner-review-checklist.md` : contrôle humain du public.
- `legal-review-request.md` : questions contractuelles à soumettre.
- `privacy-review-request.md` : éléments de la notice à faire valider.

Ces documents ne sont ni des conditions particulières, ni une notice juridiquement approuvée, ni une source publique.
