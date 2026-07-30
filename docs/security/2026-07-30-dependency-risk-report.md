# Rapport de dépendances et de risque

## Date et périmètre

Audit exécuté le 2026-07-30 depuis
`053868b3237cd6cb89916255626720672a945330`, puis après correction dans
`fix/bilan-foundation-readiness-20260730`.

Les preuves machine-readable sont synthétisées dans
`docs/security/2026-07-30-dependency-risk-inventory.json`. Les runs CI
archivent en plus les sorties brutes `npm-audit-production.json`,
`npm-audit-full.json` et les SBOM CycloneDX complet et runtime.

## Résultat

| Périmètre | Avant | Après | Verdict |
|---|---:|---:|---|
| production, moderate+ | 1 moderate | 0 | corrigé |
| production, high/critical | 0 | 0 | vert |
| arbre complet | 1 moderate + 36 high | 0 | corrigé sans exception |

Les 36 entrées hautes initiales ne représentaient pas 36 avis indépendants.
Elles propageaient toutes `GHSA-mh99-v99m-4gvg` dans le graphe d'outillage.

## Risque corrigé : MathLive

- package direct de production : `mathlive` ;
- version installée initialement : `0.108.3` ;
- plage vulnérable : `<=0.109.2` ;
- avis : `GHSA-fm7p-gw32-828p`, CVSS 6.3 ;
- impact : absence d'échappement HTML permettant une XSS ;
- point d'usage : import dynamique dans
  `components/programme/shared/MathInput.tsx`, donc saisie mathématique côté
  navigateur ;
- version corrigée : `0.110.0`.

La mise à jour a aussi révélé puis corrigé un défaut DOM préexistant :
`innerHTML` supprimait un fallback géré par React et pouvait produire
`NotFoundError`. Le conteneur du web component est désormais distinct du
fallback React.

Validations :

- test de l'adaptateur MathInput ;
- typecheck ;
- lint ;
- build Next complet ;
- audit production au seuil moderate ;
- SBOM runtime : `mathlive@0.110.0`.

## Risque corrigé : brace-expansion

Avis : `GHSA-mh99-v99m-4gvg`, CVSS 7.5, déni de service par expansion non
bornée pouvant épuiser la mémoire.

Versions vulnérables initiales :

- `1.1.16` via ESLint, plugins ESLint et outils Jest ;
- `2.1.2` via CycloneDX → node-gyp → cacache → glob → minimatch.

Version finale unique :

```text
brace-expansion@5.0.8
```

La version `5.0.8` est la version officielle corrigée. Elle ajoute une limite
explicite de longueur (`EXPANSION_MAX_LENGTH=4_000_000`) et expose une API
nommée. Les consommateurs modernes `minimatch@10` utilisent directement cette
API.

Les consommateurs historiques ont été éliminés du graphe, sans override de
`brace-expansion` et sans modification de `node_modules` :

- ESLint 8 et `eslint-config-next` ont été remplacés par ESLint 10 et les
  plugins flat-config maintenus nécessaires au périmètre réellement linté ;
- Jest 29 a été migré vers Jest 30 ;
- le CLI CycloneDX et sa chaîne native `libxmljs2` / `node-gyp` ont été
  remplacés par `npm sbom` ;
- `glob@13.0.6` et `test-exclude@8.0.0` sont sélectionnés pour leurs API
  compatibles avec Jest 30 ;
- toutes les occurrences installées de `minimatch` sont en version 10 et
  consomment nativement `brace-expansion@5.0.8`.

Le script `npm run security:brace-expansion` vérifie après installation :

- toutes les versions du lockfile sont `>=5.0.8` ;
- aucun `postinstall` ni script de patch n'existe ;
- aucune version de `minimatch` antérieure à 10 n'existe ;
- le plafond officiel est présent ;
- l'API native du graphe installé fonctionne ;
- le graphe ne contient aucune lignée vulnérable ni override du package.

Résultat :

```text
BRACE_EXPANSION_VULNERABLE_VERSION_COUNT=0
BRACE_EXPANSION_5_0_8_OR_HIGHER_COUNT=1
```

## Expériences de dépendances parentes

Une copie temporaire du manifeste et du lockfile a testé les versions publiées
le 30 juillet, puis la migration native retenue :

| Expérience cumulative | High | Décision |
|---|---:|---|
| arbre initial | 36 | baseline |
| ESLint 9.39.5 + eslint-config-next 15.5.22 | 33 | insuffisant |
| + Jest 30.4.2 / jsdom 30.4.1 / ts-jest 29.4.12 | 33 | insuffisant |
| + remplacement du CLI CycloneDX | 27 | insuffisant |
| ESLint 10 flat config + Jest 30 + npm SBOM + parents glob/test-exclude maintenus | 0 | retenu |

ESLint 9 conservait `minimatch@3`; le passage complet à ESLint 10 et à sa
configuration plate a supprimé cette lignée. Aucun fork, aucun
`npm audit fix`, aucun `--force`, aucun patch post-installation et aucune
exception ne sont appliqués.

## Preuves de sortie

- `npm ci` ne contient aucun hook racine de mutation de dépendance ;
- `npm audit --json` : zéro vulnérabilité ;
- `npm audit --omit=dev --json` : zéro vulnérabilité ;
- test de régression du graphe natif et du plafond mémoire ;
- lint, typecheck et tests des consommateurs exécutés sur l'arbre corrigé ;
- SBOM CycloneDX complet et runtime régénérés par `npm sbom`, normalisés par
  chemin physique de lockfile et validés sans référence dupliquée ou pendante.

## Gouvernance de l'ancienne exception

La demande historique
`docs/security/2026-07-30-dependency-risk-decision-request.md` porte le statut
`SUPERSEDED_BY_DEPENDENCY_FIX`. Elle ne doit pas être signée ni injectée dans
un secret. Les workflows qualifient directement l'audit à zéro ; une
réapparition de la vulnérabilité est bloquante.

## Verdict

Les vulnérabilités de production et d'outillage sont corrigées. Le dépôt ne
dépend plus d'une exception de risque. Sur la tête qualifiée de #88, CI
Success, Security Scan, Dependency Integrity, CodeQL et GitGuardian sont verts.
