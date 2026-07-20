# Preuves de tests reproduits

Environnement : Linux workspace, Node/npm du dépôt, Next 15.5.12 installé, Prisma 6.19.2, date 2026-07-11. Aucune connexion production n'a été utilisée par les tests.

| Commande | Résultat | Durée observée | Tests / échecs | Classification |
|---|---|---:|---:|---|
| `npm test -- --runInBand __tests__/lib/curriculum` | PASS | 1,72 s | 15 / 0, 3 suites | nouveau lot |
| `npx eslint lib/curriculum __tests__/lib/curriculum` | PASS | 1,55 s | 0 erreur/warning | nouveau lot |
| `npm run typecheck` | PASS | 5,51 s | n/a | global |
| `DATABASE_URL=postgresql://nexus_test:nexus_test@localhost:5434/nexus_test npx prisma validate` | PASS | 1,13 s | schéma valide | sans connexion |
| même URL factice + `npx prisma generate` | PASS | 1,77 s | client 6.19.2 | génération locale |
| `npm run lint` | PASS avec warnings préexistants | 6,47 s | 0 erreur | global |
| `npm test -- --runInBand --silent` | environnement restreint | 72,30 s | 6 434 : 6 407 pass, 23 fail, 4 skip ; 516/517 suites exécutées | 6 suites bloquées par `EPERM` subprocess |
| rerun hors sandbox `migrate-bilans` | PASS | 2,73 s | 17 / 0 | confirme contrainte environnementale |
| rerun hors sandbox des 5 autres suites EPERM | PASS | 2,88 s | 29 / 0 | confirme contrainte environnementale |
| lot assessments ciblé | PASS | 1,30 s | 37 / 0, 5 suites | mocks/unitaires |
| lot diagnostics ciblé | PASS | 1,85 s | 308 / 0, 15 suites | mocks/unitaires |
| lot auth/RBAC ciblé | PASS | 1,26 s | 212 / 0, 7 suites | mocks/unitaires |
| lot RAG/rapports ciblé | PASS | 1,14 s | 90 / 0, 6 suites | mocks/unitaires |
| `npm run build` | PASS | ~128 s | compilation, types, 143 pages statiques | production build |
| `npm run test:integration -- --runInBand` | FAIL environnement | 3,36 s | 125 : 109 pass, 16 fail ; 4/11 suites fail | `BLOCKED_NOT_VALIDATED` |
| `npm audit --json` | PASS commande / vulnérable | réseau escaladé | 24 vulnérabilités | voir audit dépendances |

## Analyse du lancement global

Les 23 tests initialement en échec avaient tous `EPERM` sur un sous-processus (Node/shell/pdfinfo). Rerun hors sandbox : 46/46 passent. Conclusion probatoire : ces échecs ne démontrent pas une régression du changeset. Ils montrent toutefois que le chiffre global brut ne peut pas être présenté comme un pass unique sans la seconde commande.

## Intégration PostgreSQL

Le dépôt fournit `docker-compose.test.yml` (PostgreSQL local port 5434, stockage tmpfs) et la CI utilise un service PostgreSQL. L'exécution sans `DATABASE_URL` échoue exactement sur :

- `__tests__/integration/predict-ownership.real.test.ts`
- `__tests__/integration/activate-student.real.test.ts`
- `__tests__/lib/bilan/bilan-schema.real.test.ts`
- `__tests__/security/idor-real.test.ts`

Erreur commune : `Environment variable not found: DATABASE_URL` dans `schema.prisma:11`. Le build préalable crée en plus des collisions Jest avec `.next/standalone`; elles n'expliquent pas les quatre échecs DB, mais prouvent une isolation imparfaite du runner.

Le démarrage de la base éphémère a été soumis à approbation comme demandé et n'a pas été autorisé pendant la mission. Statut : **BLOCKED_NOT_VALIDATED**, jamais « probablement valide ». Redis et la concurrence worker restent également non validés.

## Test direct du resolver

Commande `npx tsx -e` avec trois requêtes : mauvaise voie, mauvaise variante, année 2035-2036. Sortie :

```text
wrong-track NO_MATCH TARGET
wrong-variant NO_MATCH TARGET
unknown-year {
  academicYear: '2035-2036',
  previousAcademicYear: '2034-2035',
  prerequisite: 'fr-maths-premiere-speciality-2026',
  target: 'fr-maths-terminale-speciality-2026'
}
```

Ce test est le fondement de P0-001.

## Dépôts sources

Au début et à la fin, la boucle `git -C <repo> status --short --untracked-files=all` a retourné vide pour les cinq dépôts. Ils sont donc restés propres. Toute sortie non vide aurait été classée P0.
