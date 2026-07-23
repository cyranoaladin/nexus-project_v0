# P1-A-bis — Blocage de déploiement et récupération

## Résumé
- CI : `26663713008`, `completed/success`, SHA `67ac3a326c07ff5896fe5a4b715bd1591e37d882`.
- Production avant tentative : runtime P1-A `69f0e1435a07a96495b8c918dd8c4b4b56cf69b2`.
- Pull effectué : fast-forward vers `67ac3a326c07ff5896fe5a4b715bd1591e37d882`.
- Tests échoués : timeouts Jest sur les tests 429 de `/api/contact` et `/api/auth/reset-password`.
- Build : non lance.
- Reload PM2 : non execute.
- Runtime active : non, P1-A-bis n'a pas ete charge par PM2.
- Decision : rollback disque vers le dernier HEAD runtime valide, puis correctif tests avant nouvelle tentative.

## Etat intermediaire observe
- HEAD disque apres pull : `67ac3a326c07ff5896fe5a4b715bd1591e37d882`.
- HEAD runtime suppose : `69f0e1435a07a96495b8c918dd8c4b4b56cf69b2`, car aucun reload PM2 n'a ete execute apres le pull.
- Backup : `/root/nexus-backups/deploy-p1-a-bis-redis-rate-limit-20260530001817`.
- Health : `api_health=200`.
- Configuration rate-limit : `REDIS_URL=present`, Upstash missing/missing, `RATE_LIMIT_DISABLE_1=absent`.
- Risque : divergence disque/runtime et dependances modifiees par `npm ci` avant validation complete.

## Action de stabilisation
- Rollback disque : `git reset --hard 69f0e1435a07a96495b8c918dd8c4b4b56cf69b2`.
- `npm ci --prefer-offline` : execute apres rollback pour resynchroniser `node_modules` avec le HEAD P1-A.
- Health apres rollback : `api_health_after_disk_rollback=200`.
- PM2 : `<PROCESS_NAME>` online.
- Reload execute : non.
- Etat final production : disque revenu sur `69f0e143`, runtime conserve et health OK.

## Cause probable des timeouts
- Les tests de route `contact.rate-limit.test.ts` et `auth.reset-password.rate-limit.test.ts` ne neutralisaient pas `REDIS_URL`, `UPSTASH_REDIS_REST_URL` et `UPSTASH_REDIS_REST_TOKEN`.
- En environnement serveur, Jest/Next peut charger `.env`; avec `REDIS_URL=present`, les tests unitaires appelaient le backend Redis reel au lieu du `MemoryStore`.
- Les tests 429 devenaient alors dependants du Redis local et non deterministes, ce qui a produit les timeouts.

## Correctif applique
- Les deux tests de route effacent explicitement `REDIS_URL`, `UPSTASH_REDIS_REST_URL` et `UPSTASH_REDIS_REST_TOKEN` avant de reinitialiser le store.
- Un `afterEach` nettoie aussi les variables distribuees et reinitialise le store.
- Le comportement production n'est pas modifie.

## Validations du correctif
- Tests cibles P1-A-bis : 4 suites / 17 tests OK.
- Reproduction avec `REDIS_URL` present : `contact.rate-limit.test.ts` et `auth.reset-password.rate-limit.test.ts` OK.
- `npm run typecheck` : OK.
- `npm run build` : OK.
- `npm run test:unit -- --runInBand` : 457 suites / 5979 tests OK.

## Warnings classes
- `npm ci` signale des warnings de peer dependency `nodemailer`, des engines `@cortex-js/compute-engine`, des paquets deprencies et `20 vulnerabilities`.
- Ces points sont classes hors correctif P1-A-bis et doivent etre traites dans un lot dependances/audit npm separe.

## Prochaine tentative
- Attendre la CI verte du commit correctif.
- Repartir du protocole complet : CI gate, preflight, backup, pull fast-forward, `npm ci`, tests serveur, build, reload PM2, smokes.
- Ne pas declarer P1-A-bis deploye tant que le reload et les smokes ne sont pas valides.
