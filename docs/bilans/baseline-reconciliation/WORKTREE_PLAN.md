# Plan du worktree B1

## Base figée

`c90b142c88d69bdc600f3f848b44ca0317c00242`

Ne pas utiliser implicitement `origin/main` au moment de la création : la branche distante peut avancer entre la décision B0 et B1.

## Commande exacte proposée

```bash
git -C ./nexus-project_v0 worktree add \
  ../nexus-project_v0-bilans-security \
  -b fix/bilans-security-ownership \
  c90b142c88d69bdc600f3f848b44ca0317c00242
```

Cette commande n'a pas été exécutée pendant B0.

## Préconditions avant exécution

```bash
git -C ./nexus-project_v0 cat-file -t c90b142c88d69bdc600f3f848b44ca0317c00242
git -C ./nexus-project_v0 branch --list fix/bilans-security-ownership
test ! -e ./nexus-project_v0-bilans-security
git -C ./nexus-project_v0 worktree list
```

Si la branche ou le chemin existe, arrêter et réconcilier ; ne pas supprimer automatiquement.

## Vérifications immédiatement après création

```bash
git -C ./nexus-project_v0-bilans-security branch --show-current
git -C ./nexus-project_v0-bilans-security rev-parse HEAD
git -C ./nexus-project_v0-bilans-security status --short --untracked-files=all
git -C ./nexus-project_v0-bilans-security merge-base --is-ancestor \
  1b8219b1cfcfe63354d8cb4035645143e27e5a43 HEAD
```

Résultats attendus : branche `fix/bilans-security-ownership`, HEAD exact `c90b142c...`, worktree propre, production ancêtre.

## Relation avec le worktree actuel

Le worktree actuel reste inchangé et sert de source documentaire en lecture seule :

`/home/alaeddine/Projets/nexus-bilans-workspace/nexus-project_v0/docs/bilans`

Les documents de reconstruction, rapports B0 et fichiers curriculum sont non suivis. Ils n'apparaîtront pas dans le nouveau worktree. Ne pas les copier automatiquement et ne pas appliquer l'archive snapshot sur le nouveau worktree. B1 les consulte par chemin absolu.

## Première séquence B1 recommandée

1. relire les règles depuis le nouveau worktree ;
2. reconstituer l'inventaire exact des routes Bilans au SHA `c90b142c` ;
3. vérifier `buildBilanWriteWhere/ReadWhere` et les tests IDOR ajoutés ;
4. écrire les tests rouges manquants pour `POST /api/bilans` et les projections d'audience ;
5. obtenir l'autorisation avant de lancer PostgreSQL éphémère ;
6. appliquer uniquement les correctifs B1 validés ;
7. ne pas importer le registre curriculum, créer de migration canonique ou déployer.

## Rollback du worktree futur

La création est additive et ne touche pas le worktree actuel. Si aucun travail utile n'y est présent et seulement après vérification/autorisation, le futur worktree pourra être retiré avec les commandes Git normales. Aucune commande de retrait n'est proposée ici afin d'éviter une suppression accidentelle.
