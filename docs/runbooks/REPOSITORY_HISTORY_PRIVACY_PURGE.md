# Runbook — purge de données personnelles dans l'historique Git

> **Statut : `HISTORY_PRIVACY_PURGE_STATUS=PLANNED_REQUIRED`.**
> Ce runbook ne doit **pas** être exécuté tant que la stack ARIA (#177, #178,
> #179 et les PR suivantes) est ouverte : une réécriture d'historique invalide
> toutes les branches et toutes les PR en cours. Il s'exécute lors d'une
> maintenance dédiée, après fermeture ou fusion de la stack.

## 1. Ce qui doit être purgé

Un document tiers versionné dans le dépôt contient le nom et le numéro de
téléphone d'un intervenant externe. Il a été **retiré de l'arbre de travail**
(voir le lot « ressources / provenance »), mais reste atteignable dans
l'historique.

Constat établi lors de l'audit de provenance :

| Élément | Valeur |
|---|---|
| Blob | `52d6a9c132ba475bfe0aa4aae7a4297543403499` |
| Taille | 17 427 206 octets |
| Atteignable depuis | `origin/main` (arbre du HEAD au moment de l'audit) |
| Commits concernés | 7 |
| Chemins historiques | 2 (le fichier a été déplacé et renommé) |

Le manifeste interne `docs/stack-closure/history-privacy-manifest.json` porte
l'empreinte du blob, la liste des commits et l'inventaire des références. Il ne
contient **ni la donnée personnelle, ni les chemins littéraux** : les y inscrire
les réintroduirait dans le dépôt après la purge, ce qui viderait l'opération de
son sens. Les chemins exacts se dérivent au moment de l'exécution :

```bash
BLOB=$(jq -r .blobSha docs/stack-closure/history-privacy-manifest.json)
git log --all --find-object="$BLOB" --name-only --format='' | sort -u
```

> Retirer le fichier du HEAD ne suffit pas. Tant que l'historique n'est pas
> réécrit, la donnée reste récupérable par `git show <commit>:<chemin>` depuis
> n'importe quel clone, y compris ceux déjà distribués.

## 2. Pré-requis

- Aucune PR ouverte sur le dépôt (ou fermeture assumée de celles qui restent).
- Fenêtre de maintenance annoncée à toute personne disposant d'un clone.
- Accès administrateur au dépôt GitHub (protections de branche, force-push).
- `git-filter-repo` installé (`pipx install git-filter-repo`). **Ne pas utiliser
  `git filter-branch`** : lent, et connu pour laisser des références résiduelles.
- Une sauvegarde complète du dépôt (miroir) conservée hors ligne avant toute
  opération.

## 3. Inventaire préalable (à produire et à archiver)

```bash
# Miroir de travail, jamais le clone de développement
git clone --mirror git@github.com:cyranoaladin/nexus-project_v0.git purge-mirror
cd purge-mirror

# Inventaire des références AVANT réécriture
git for-each-ref --format='%(refname) %(objectname)' > ../refs-before.txt
git tag --list > ../tags-before.txt
git branch -a --list > ../branches-before.txt

# Commits portant le blob visé
git log --all --oneline --find-object=<BLOB_SHA> > ../commits-with-blob.txt

# Confirmation que le blob est bien atteignable
git rev-list --objects --all | grep <BLOB_SHA> > ../blob-reachability-before.txt
```

Archiver ces cinq fichiers : ils constituent la preuve de l'état initial et
serviront à la vérification finale.

## 4. Réécriture

Construire la liste des chemins depuis le blob, puis la passer à
`filter-repo` via un fichier — le chemin d'origine contient des caractères non
ASCII et un espace, qu'un passage en ligne de commande abîme facilement :

```bash
BLOB=<empreinte du manifeste>
git log --all --find-object="$BLOB" --name-only --format='' | sort -u > ../paths-to-purge.txt

# Contrôle humain OBLIGATOIRE avant de continuer :
# ce fichier doit contenir exactement les chemins attendus, et rien d'autre.
cat ../paths-to-purge.txt

git filter-repo --force --invert-paths --paths-from-file ../paths-to-purge.txt
```

`--invert-paths` supprime les chemins listés de **tout** l'historique. Ne pas
compléter par `--replace-text` : le contenu à retirer est un fichier binaire
entier, pas une chaîne dans un fichier texte.

Supprimer `../paths-to-purge.txt` à la fin de l'opération : il porte la donnée
en clair.

## 5. Vérification avant publication

```bash
# Le blob ne doit plus exister
git rev-list --objects --all | grep <BLOB_SHA> && echo "ÉCHEC : blob encore présent" || echo "OK : blob absent"

# Aucun des chemins ne doit plus apparaître
git log --all --oneline -- '<CHEMIN_ACTUEL>' '<CHEMIN_HISTORIQUE_ORIGINAL>'

# Inventaire APRÈS, à diffuser aux porteurs de clones
git for-each-ref --format='%(refname) %(objectname)' > ../refs-after.txt
diff ../refs-before.txt ../refs-after.txt > ../refs-changed.txt || true
```

Contrôler que `tags-before.txt` et `branches-before.txt` se retrouvent
intégralement côté « after » : `filter-repo` réécrit les références mais ne doit
en supprimer aucune.

## 6. Publication coordonnée

1. Désactiver temporairement la protection de branche sur `main` (et sur toute
   branche protégée), en notant la configuration exacte pour la rétablir.
2. `git push --force --all` puis `git push --force --tags` depuis le miroir.
3. Rétablir immédiatement les protections de branche à l'identique.
4. Publier `refs-changed.txt` à l'équipe.

## 7. Après publication

- **Clones locaux** : tout clone existant contient encore l'ancien historique.
  La seule consigne sûre est de le supprimer et de recloner. Un `git pull` ne
  purge rien.
- **Références GitHub résiduelles** : GitHub conserve des objets accessibles via
  les `refs/pull/*` des PR fermées et un cache interne. Ouvrir un ticket
  **GitHub Support** en demandant explicitement la suppression des objets
  inatteignables et l'expiration du cache, en citant le SHA du blob.
- **Forks** : un fork conserve sa propre copie. Les recenser et demander leur
  suppression ou leur purge.
- **Vérification externe** : après confirmation du support, tenter
  `curl -sI https://github.com/<org>/<repo>/raw/<ancien_commit>/<chemin>` et
  vérifier une réponse 404.

## 7 bis. Restauration en cas d'erreur

La sauvegarde miroir de l'étape 2 est la seule voie de retour. Tant qu'elle
n'est pas confirmée, ne pas lancer le force-push.

```bash
# Depuis la sauvegarde, et seulement après avoir redésactivé les protections
cd backup-mirror
git push --force --all
git push --force --tags
```

Points d'attention :

- une restauration ne « défait » pas les clones que des tiers auraient déjà
  recréés entre-temps : prévenir avant, pas après ;
- les PR fermées automatiquement par le force-push ne se rouvrent pas seules ;
- si la restauration intervient après un ticket GitHub Support, le signaler dans
  le même ticket.

## 7 ter. PR de la stack ARIA

La réécriture change tous les SHA : les PR ouvertes pointeront sur des commits
qui n'existent plus. Le manifeste liste les PR concernées.

Stratégie, pour chaque PR de la stack, de la base vers le sommet :

1. Avant la purge, produire pour chaque branche un patch de son contenu
   fonctionnel :
   ```bash
   git format-patch --stdout <base>..<branche> > ../patches/<branche>.patch
   git diff <base>..<branche> | git hash-object --stdin > ../patches/<branche>.diffhash
   ```
2. Après la purge, recréer chaque branche depuis le nouveau point de base et
   réappliquer son patch. **Ne pas rebaser** une branche locale existante sur
   l'historique réécrit : ses commits appartiennent à l'ancien graphe.
3. Vérifier que le contenu fonctionnel est identique :
   ```bash
   git diff <nouvelle_base>..<branche_recréée> | git hash-object --stdin
   # doit égaler ../patches/<branche>.diffhash
   ```
   Une empreinte différente signifie que la purge a touché un fichier porté par
   la PR : investiguer avant de republier.
4. Rouvrir les PR dans l'ordre de la stack, chacune ciblant la précédente.

## 8. Requalification du `main` réécrit

La réécriture change tous les SHA. Rejouer la qualification complète :

```bash
npm run enums:check
npm run typecheck
npm run lint
npm test
npx prisma migrate deploy   # sur base jetable uniquement
```

Puis rouvrir les PR restantes depuis des branches recréées sur le nouveau
`main`. **Ne pas rebaser** d'anciennes branches sur l'historique réécrit :
recréer.

## 9. Journal d'exécution à compléter le jour J

| Étape | Horodatage | Opérateur | Résultat |
|---|---|---|---|
| Sauvegarde miroir | | | |
| Sauvegarde vérifiée restaurable | | | |
| Patchs de branches de la stack produits | | | |
| Inventaire avant | | | |
| Réécriture | | | |
| Vérification blob absent | | | |
| Protections désactivées | | | |
| Force-push | | | |
| Protections rétablies | | | |
| Ticket GitHub Support | | | |
| Clones recréés | | | |
| PR de la stack recréées | | | |
| Empreintes fonctionnelles vérifiées | | | |
| `paths-to-purge.txt` détruit | | | |
| Requalification | | | |
