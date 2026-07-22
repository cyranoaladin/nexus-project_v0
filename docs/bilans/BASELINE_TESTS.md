# Tests de référence avant implémentation

## Environnement

- Date : 10 juillet 2026, timezone Africa/Tunis.
- Gestionnaire : npm, `package-lock.json` présent ; aucun champ `packageManager` ni `engines` dans `package.json`.
- Node : `v22.21.0`.
- npm : `11.6.3`.
- Dépendances d'infrastructure identifiées : PostgreSQL/Prisma, Redis/Upstash, ChromaDB via service FastAPI, Ollama/OpenAI, SMTP, stockage de rapports local configurable, Playwright et Docker Compose pour les tests DB/E2E.
- Aucune valeur de secret n'a été lue. Seules les clés des fichiers `.env*.example` ont été inventoriées avec valeurs masquées.

## Résultats

| Commande exacte | Durée observée | Résultat | Tests/erreurs | Interprétation |
|---|---:|---|---|---|
| `npm ls --depth=0` | 0,98 s | échec | toutes dépendances manquantes | Préexistant dans l'environnement : `node_modules` absent. |
| `npm ci` | 20,66 s | succès | 1 194 paquets ajoutés ; 24 vulnérabilités npm signalées | Installation reproductible depuis le lockfile. Warnings de peer dependency Nodemailer/Auth et paquets dépréciés. |
| `npx prisma validate` | 1,11 s | échec | P1012, `DATABASE_URL` absent | Limite d'environnement, pas une invalidité du schéma. |
| `DATABASE_URL='postgresql://nexus_test:nexus_test@127.0.0.1:5432/nexus_test?schema=public' npx prisma validate` | 1,11 s | succès | 0 erreur de schéma | Validation hors connexion avec URL locale fictive ; avertissement de dépréciation `package.json#prisma`. |
| `DATABASE_URL='postgresql://nexus_test:nexus_test@127.0.0.1:5432/nexus_test?schema=public' npx prisma generate` | 1,79 s | succès | client Prisma 6.19.2 généré | Aucun accès DB ; artefact généré dans `node_modules`. |
| `npm run typecheck` | 35,53 s | succès | 0 erreur TypeScript | Baseline compilateur valide. |
| `npm run lint` | 11,41 s | succès avec warnings | nombreuses alertes `no-explicit-any`, imports inutilisés et hooks ; `next lint` déprécié | Dette préexistante. Aucun échec lint. Le comptage compact est à joindre au rapport de session. |
| `npm test -- --runInBand` | 67,63 s | succès | 513 suites passées, 1 ignorée ; 6 415 tests passés, 4 ignorés ; 7 snapshots passés | Référence unitaire complète. Les nombreuses traces d'erreur sont majoritairement des scénarios négatifs simulés ; la sortie n'est pas silencieuse. |
| `npm run test:integration -- --runInBand` | 3,08 s | échec | 4 suites en échec, 7 passées ; 16 tests en échec, 109 passés | Échec environnemental préexistant : les suites dites « BDD réelle » exécutent des écritures sans `DATABASE_URL` ni base de test. Aucune base de production utilisée. |
| `npm run build` | 135,48 s | succès | compilation 62 s, typecheck, 143 pages statiques, traces et copie des assets standalone | Build de référence valide sans secret de production. |
| `npm run security:repo` | 0,15 s | succès | aucune clé privée suivie ou détectée | Contrôle rapide du dépôt uniquement. |
| `npm audit --json` | environ 8 s avec le contrôle précédent | échec attendu npm audit | 24 vulnérabilités : 3 faibles, 9 modérées, 12 élevées, 0 critique | Dette de dépendances préexistante ; aucune correction automatique appliquée. |

## Scripts non exécutés

- `test:db:full` et E2E : non exécutés faute de base Docker de test préparée et parce qu'ils écrivent dans une base éphémère ; aucune base de production ne doit être contactée.
- Déploiement, migration deploy, seed et scripts d'écriture : non exécutés.
- Tests de navigateur : non nécessaires au premier lot backend pur de registre curriculum ; à exécuter dès qu'une interface ou une route est ajoutée.

## Variables nécessaires observées

Les exemples déclarent notamment `DATABASE_URL`, `NEXTAUTH_URL`, `NEXTAUTH_SECRET`, SMTP, `OPENAI_API_KEY`, `OLLAMA_URL`, `RAG_INGESTOR_URL`, `RAG_API_TOKEN`, variables Redis/Upstash, stockage PDF et rate limiting. Le premier lot de registre curriculum ne dépend d'aucune de ces variables.
