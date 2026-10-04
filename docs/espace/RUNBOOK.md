# Espace pédagogique — exploitation

Toutes les commandes écrivent **uniquement avec `--execute`**. Les codes personnels ne sont jamais affichés ni versionnés.

## 1. Créer / vérifier les comptes

```bash
# 1. Lecture seule : que va-t-on faire ? (liste privée hors dépôt)
npx tsx scripts/espace/provision.ts apply --roster /chemin/prive/espace-roster.json

# 2. Application. Les codes sont écrits UNE fois dans un fichier 0600 hors dépôt.
npx tsx scripts/espace/provision.ts apply --roster /chemin/prive/espace-roster.json \
  --execute --credentials-out /chemin/prive/codes-AAAA-MM-JJ.txt
```
- Un compte existant homonyme n'est **jamais** réutilisé silencieusement : le plan affiche `NEEDS_ADOPT_FLAG` ; après vérification humaine, relancer avec `--adopt` (seul l'identifiant est posé, mot de passe/email/rôle intacts).
- Un identifiant déjà porté par une autre personne, ou un homonyme déjà identifié autrement, est un `CONFLICT` : rien n'est écrit tant qu'il n'est pas résolu.
- Plusieurs comptes portent le même nom : le plan les liste (fin d'identifiant technique + date de création) et s'arrête ; désigner le bon par `"matchUserId": "<identifiant technique>"` dans la liste (un enseignant peut aussi être désigné par `matchEmail`).
- Un compte élève existant dont l'activation par la famille est encore en attente n'est adopté que sur décision écrite (`"activatePending": true`) : l'adopter le marque activé et le lien d'activation envoyé à la famille cessera de fonctionner. Un compte déjà activé conserve sa date d'activation.
- Relancer est sans effet (idempotent) et n'émet plus de code.
- Format de la liste : voir `scripts/espace/roster.example.json` (matières `MATHS`, `NSI`, `MATHS_EXPERTES`).

## 2. Transmettre / réinitialiser un code

Transmettre le fichier de codes par un canal privé, puis le **détruire**. Code perdu :

```bash
npx tsx scripts/espace/provision.ts reset-pin --username adam.c --execute --credentials-out /chemin/prive/nouveau-code.txt
```
L'ancien code cesse de fonctionner et les sessions ouvertes sont révoquées. Désactiver un compte : `disable --username … --execute`.

## 3. Installer les ressources de Maths (PDF privés)

```bash
npx tsx scripts/espace/install-resources.ts --from <dossier resources> --module suites            # dry-run
npx tsx scripts/espace/install-resources.ts --from <dossier resources> --module suites --execute
```
Chaque fichier est vérifié contre `MATHS_RESOURCES_MANIFEST.json` avant et après copie ; un fichier existant de contenu différent n'est pas écrasé. Destination : `$DOCUMENT_STORAGE_ROOT/espace/resources/suites/` (jamais public).

## 4. Archives POO historiques

Voir `docs/legacy-poo/LEGACY_POO_LINKING.md`. Le service et l'archive historiques ne sont jamais modifiés par l'espace.

## 5. Diagnostiquer

- Logs applicatifs (pm2) : lignes `[ESPACE]` (erreur non gérée, sans contenu d'élève), `[AUTH] Login success` (rôle seulement), `Espace sign-in refused by the rate limiter` (`THROTTLED` ou `BACKEND_UNAVAILABLE`, sans identifiant).
- Conflits de version : codes HTTP 409 `REVISION_CONFLICT` sur `PUT /api/espace/works/:id`. Erreurs d'accès : 404 (indiscernable) ; permissions : 403 ; remis : 423.
- Aucune réponse d'élève, aucun PIN, aucun cookie n'est journalisé.

## 6. Export de secours et lecture des archives

- `GET /api/espace/teacher/export?workId=… | sessionId=… | studentId=…` (enseignant ou admin, mêmes droits d'accès que la lecture d'un travail) : télécharge un JSON (contenu, versions, annotations, métadonnées des pièces jointes, chronologie des statuts) pour audit, sauvegarde ou portabilité. Aucune donnée d'authentification n'y figure ; les fichiers eux-mêmes ne sont pas inclus. Le bouton « Exporter » de l'écran de correction l'utilise.
- `GET /api/espace/teacher/legacy` et la page `/espace/enseignant/archives-poo` : lecture seule de l'instantané de métadonnées produit par `legacy-poo.ts inventory --snapshot-out`. Aucune action d'association n'existe côté web (voir `LEGACY_POO_LINKING.md`).

## 7. Rollback

1. Rebasculer la release applicative précédente (procédure de release habituelle).
2. **Ne pas** supprimer les tables `espace_*` ni les colonnes `users.username/pinHash/pinSetAt/disabledAt` : elles contiennent des travaux d'élèves et sont inertes sans le nouveau code.
3. Vérifier `/`, `/auth/signin`, `/ateliers/poo/` (legacy inchangé).
4. Les travaux déjà enregistrés restent en base ; un redéploiement ultérieur les retrouve.

## 8. Ajouter un parcours guidé (exemple : Récursivité)

1. Contenu : `content/espace/<module>/` (`build_content.py` → `content.json` + corrigé `docs/espace/corriges/<module>/corrige.html`, `runner.py` si Python, `solutions.py`). Enregistrer le slug dans `lib/espace/lesson-routes.ts`, l'activité dans `lib/espace/catalog.ts` (champ `theme` pour le regroupement affiché), une page `app/espace/<matière>/<module>/page.tsx`, l'inclusion du `runner.py` dans `next.config.mjs` (`outputFileTracingIncludes`).
2. Tests : unitaires (contenu, harnais), intégration vraie base, E2E, puis fumée de production.
3. Corrigé : `npx tsx scripts/espace/build-corriges.ts --only <module>` puis `install-resources.ts --module <module>` (ou copie vérifiée par empreinte vers `<DOCUMENT_STORAGE_ROOT>/espace/resources/<moduleSlug>/`).
4. **Miroir de catalogue en base** (obligatoire avant la première ouverture par un élève) : `npx tsx scripts/espace/provision.ts sync-activities` (dry-run) puis `--execute`.
5. Compétences annotables côté enseignant : champ `skills` du contenu (réutilise les annotations existantes, aucun nouveau stockage).


## 9. Déployer une release (verrou + compare-and-swap)

Toute bascule passe par `scripts/espace/switch-release.sh`, exécuté **sur le serveur** (copié par `ssh … 'bash -s -- <args>' < scripts/espace/switch-release.sh`).

1. Préparer la release hors ligne (build en clone propre hors `.worktrees`, `rsync` du standalone, `.runtime` copié d'une release vivante, `release-manifest.json`, `RELEASE_SOURCE_SHA`, `root:root` 755/644). Ressources privées et miroir de catalogue **avant** la bascule (§8).
2. Relever la release servie : `readlink -f /var/www/nexus-project_v0`. C'est la valeur **vérifiée** à passer en `--expected-current`.
3. `switch-release.sh --new <release> --expected-current <release servie vérifiée>` :
   - **verrou** `flock -n /var/lock/nexus-production-deploy.lock` : si un autre déploiement le tient → `LOCK_BUSY`, arrêt (jamais d'attente ni de contournement) ;
   - **compare-and-swap** : si la release servie n'est plus celle vérifiée → `CAS_MISMATCH`, arrêt, réévaluation humaine ; on n'écrase jamais une release plus récente ;
   - pré-vol (artefact, Node embarqué `v22.23.1`, garde de pointeur), bascule atomique du seul pointeur canonique, garde `--expected-release`, `pm2 restart`, santé ; **retour arrière automatique** si la santé n'est pas confirmée.
4. Vérifier ensuite : `GARDE_FINAL=OK`, `CANON`, `ALIAS`, `CMDLINE`, exécutable Node, santé, journaux.
5. **Rollback readiness** (sans rien basculer) : `switch-release.sh --check <release précédente saine>` — dossier, `server.js`, `BUILD_ID`, Node, propriétaire, commande pm2, pointeur modifiable, garde de l'état courant. Compatibilité base : comparer `prisma/` entre les deux commits (diff vide = aucun schéma à défaire).
6. Rollback réel : `switch-release.sh --new <release précédente saine> --expected-current <release servie>`.

## 10. Comptes techniques de validation (jamais de vrai compte)

Les comptes `val.*` (désactivés, non supprimés) servent aux fumées de production. Réutiliser, ne pas recréer :

```bash
# réactivation TEMPORAIRE (refuse tout identifiant hors val.*) ; identifiants dans un fichier 0600 hors dépôt
npx tsx scripts/espace/provision.ts enable-technical --username val.b --execute --credentials-out ~/Documents/Nexus_Conservation/<fichier>
# après la fumée : fermeture + sessions révoquées
npx tsx scripts/espace/provision.ts disable --username val.b --execute
```

Les travaux techniques peuvent rester (traces) mais le compte doit être désactivé : la connexion doit être refusée.

## 11. Contrôle catalogue ↔ base (étape de déploiement)

`npx tsx scripts/espace/provision.ts audit-activities` — lecture seule, code de sortie 1 en cas d'écart bloquant (activité absente de la base, type, matière, module, titre, nombre d'étapes ou version différents). Aucune mutation au démarrage de l'application. Correction : `sync-activities` (ne touche qu'à `espace_activities`, jamais aux comptes, codes ou inscriptions).

## 12. Plan de secours hors ligne

`~/Documents/Nexus_Conservation/espace-terminale-fallback/` (TP POO 2, Récursivité, Maths ; l'ancien `urgence-seances-2026-10-03/` est conservé tel quel). Reconstruction : `build-corriges.ts` puis `build-fallback.ts --out … --corriges …`. Lancement : voir `LIRE_DABORD.md`.
