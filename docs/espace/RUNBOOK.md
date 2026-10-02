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

## 6. Rollback

1. Rebasculer la release applicative précédente (procédure de release habituelle).
2. **Ne pas** supprimer les tables `espace_*` ni les colonnes `users.username/pinHash/pinSetAt/disabledAt` : elles contiennent des travaux d'élèves et sont inertes sans le nouveau code.
3. Vérifier `/`, `/auth/signin`, `/ateliers/poo/` (legacy inchangé).
4. Les travaux déjà enregistrés restent en base ; un redéploiement ultérieur les retrouve.
