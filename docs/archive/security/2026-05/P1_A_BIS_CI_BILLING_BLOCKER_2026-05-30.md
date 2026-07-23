# P1-A-bis — Blocage CI GitHub Actions billing

## Résumé
- Commit concerné : `024721f92f9aebfe833f90bae5a80ee2ba3dfc0e` (`test(security): stabilize P1-A-bis rate-limit tests`).
- CI Pipeline : run `26665528428`, `completed/failure`.
- Data Invariants : run `26665528472`, `completed/failure`.
- Cause : GitHub Actions n'a pas exécuté les jobs; les jobs sont terminés en échec sans runner et sans steps. Le contexte opérationnel indique un verrouillage GitHub Actions lié à la facturation.
- Production : stabilisée sur P1-A runtime.
- Runtime : `69f0e1435a07a96495b8c918dd8c4b4b56cf69b2`.
- Déploiement : P1-A-bis non déployé, aucun reload PM2 après la tentative.

## État production
- HEAD : `69f0e1435a07a96495b8c918dd8c4b4b56cf69b2`.
- PM2 : `<PROCESS_NAME>` online.
- Health : `api_health=200`.
- Configuration rate-limit : `REDIS_URL=present`, Upstash missing/missing, `RATE_LIMIT_DISABLE_1=absent`.
- Divergence disque/runtime : non, rollback disque effectué vers le dernier runtime validé.
- Décision : ne pas déployer tant que la CI du commit correctif n'est pas verte.

## État local
- Repo principal : non modifié par ce lot; contient des changements hors périmètre (`app/dashboard/eleve/page.tsx`, `prisma/schema.prisma`, dossiers `stage-eam-stmg` et `content`).
- Worktree propre : `/home/alaeddine/Bureau/nexus-deploy-clean-p1a-bis`, HEAD `024721f92f9aebfe833f90bae5a80ee2ba3dfc0e`.
- Fichiers hors périmètre : conservés dans le repo principal, non stagés et non déplacés.

## Validations locales déjà obtenues
- Tests ciblés P1-A-bis : 4 suites / 17 tests OK.
- REDIS_URL présent en test : `contact.rate-limit.test.ts` et `auth.reset-password.rate-limit.test.ts` OK.
- Typecheck : OK.
- Build : OK.
- Unit complet : 457 suites / 5979 tests OK.

## Cause CI
- Message GitHub observé hors logs CLI : compte verrouillé à cause d'un problème de facturation.
- Jobs CI Pipeline : `Lint`, `TypeScript Type Check`, `Security Scan` et `CI Success` en failure; jobs dépendants skipped.
- Jobs Data Invariants : `invariants` en failure.
- Steps : vides dans l'API GitHub, aucun log de test/build/lint exploitable.
- Conclusion : le code n'est pas mis en cause par les logs GitHub disponibles; la reprise dépend de la résolution du blocage Actions.

## Action humaine requise
1. Résoudre le problème GitHub billing / verrouillage Actions.
2. Relancer la CI du commit `024721f92f9aebfe833f90bae5a80ee2ba3dfc0e`.
3. Attendre `CI Pipeline` et `Data Invariants` en `completed/success`.
4. Reprendre le déploiement P1-A-bis depuis le début.

## Reprise après résolution
- CI gate.
- Préflight production.
- Backup.
- Pull fast-forward.
- `npm ci`.
- Tests serveur.
- Build.
- PM2 reload.
- Smokes.
- Documentation.

## Décision
- P1-A-bis : non déployé.
- Bêta contrôlée : maintenue.
- Bêta élargie : bloquée tant que P1-A-bis n'est pas déployé et le mode Redis validé.
- Go-live large : non recommandé.
