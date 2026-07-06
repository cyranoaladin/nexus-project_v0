# Lot 13 — Checklist avant exécution humaine

## Avant chaque commit

- [ ] Exécuter uniquement la commande `git add -- ...` du bloc concerné.
- [ ] Exécuter `git diff --cached --name-only`.
- [ ] Vérifier qu’aucun fichier Exclude n’est staged.
- [ ] Vérifier qu’aucun fichier Needs human review non validé n’est staged.
- [ ] Vérifier qu’aucun `.env*` n’est staged.
- [ ] Vérifier que `rapport_audit_2_07_2026.md` n’est pas staged.
- [ ] Vérifier que `docs/audits/audit-nexus-reussite.md` n’est pas staged.
- [ ] Exécuter les tests recommandés du bloc.
- [ ] Committer uniquement si le staging correspond exactement au bloc.
- [ ] Après commit, vérifier `git status --short`.

## Interdits

- [ ] Aucun `git push`.
- [ ] Aucune PR.
- [ ] Aucun déploiement.
- [ ] Aucune migration.
