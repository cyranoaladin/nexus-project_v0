# Qualification Dependency Integrity — Pré-rentrée 2026

## Statut au 30 juillet 2026

`SUPERSEDED_BY_DEPENDENCY_FIX`

Le blocage décrit ci-dessous est conservé comme trace historique. La résolution
finale supprime les parents historiques plutôt que de forcer leur graphe :
ESLint 10 flat-config, Jest 30, `npm sbom`, `glob@13` et `test-exclude@8`
n'installent plus que `minimatch@10` / `brace-expansion@5.0.8`. Il n'existe
plus d'override du package, de `postinstall` ni de mutation de `node_modules`.
Les audits npm complet et runtime sont à zéro vulnérabilité. Aucune exception
propriétaire ou liée au SHA n'est requise.

## Date

2026-07-26, Africa/Tunis.

## Contexte

La release publique exige que les deux audits npm suivants soient verts :

```bash
npm audit --omit=dev --audit-level=high
npm audit --audit-level=high
```

L'analyse a été rejouée depuis un clone de release isolé, avec Node.js
`v22.21.0`, npm `10.9.8` et le registre npm public. Aucun override
incompatible, fork, patch de package tiers ou abaissement de seuil n'est
appliqué.

## Résultats sur la branche

- audit des dépendances de production : vert, zéro vulnérabilité ;
- audit complet : rouge, 36 vulnérabilités hautes ;
- avis commun :
  `brace-expansion <=5.0.7`, `GHSA-mh99-v99m-4gvg`.

Les lignées vulnérables sont transitives :

- ESLint 8 utilise `minimatch@3` /
  `brace-expansion@1.1.16` ;
- CycloneDX 6 utilise `node-gyp` / `cacache` / `glob@10` / `minimatch@9` /
  `brace-expansion@2.1.2` ;
- TypeScript-ESLint utilise désormais `minimatch@10.2.5` /
  `brace-expansion@5.0.8`, version corrigée.

## Expérience de mise à niveau officielle

Une copie temporaire de `package.json` et `package-lock.json` a été utilisée,
hors du dépôt. Elle a testé cumulativement :

- retrait de `@cyclonedx/cyclonedx-npm@6.0.0` ;
- remplacement par la commande officielle
  `npm sbom --sbom-format cyclonedx --package-lock-only` ;
- ESLint `9.39.5`, dernière majeure acceptée par
  `eslint-config-next@15.5.20` ;
- Jest `30.4.2`, `jest-environment-jsdom@30.4.1` et
  `@types/jest@30.0.0`.

Le lockfile expérimental reste rouge avec **26 vulnérabilités hautes**.
Jest 30 conserve des lignées `glob`/`minimatch` vulnérables et ESLint 9 ainsi
que ses plugins conservent des lignées `minimatch` vulnérables.

Le générateur SBOM officiel de npm fonctionne et a produit un document
CycloneDX 1.5 comportant 1 385 composants. Son adoption isolée ne résout donc
pas l'audit complet.

## Hypothèse historique sur ESLint 10 — invalidée par la résolution

L'audit initial avait écarté ESLint 10 tant que le dépôt dépendait du preset
legacy `eslint-config-next@15.5.20` :

- `eslint-config-next@15.5.20` déclare ESLint
  `^7.23.0 || ^8.0.0 || ^9.0.0`, donc exclut ESLint 10 ;
- la migration ESLint 10 supprime l'ancien système de configuration et impose
  une migration majeure de configuration ;
- la mission interdit explicitement un override majeur incompatible et
  `npm audit fix --force` non maîtrisé.

La résolution finale ne force pas ce preset : elle migre explicitement la
configuration vers le format plat, importe les plugins maintenus et conserve
le périmètre historique `app`, `components`, `lib`, `src`. Cette migration a
été qualifiée par le lint global, le typecheck, la suite Jest et le build.

## Sources officielles vérifiées

- avis GitHub : `https://github.com/advisories/GHSA-mh99-v99m-4gvg` ;
- documentation npm SBOM :
  `https://docs.npmjs.com/cli/commands/npm-sbom/` ;
- guide officiel de migration ESLint 10 :
  `https://eslint.org/docs/latest/use/migrate-to-10.0.0` ;
- versions et peer dependencies : registre npm interrogé avec `npm view`.

## Dispositif de décision bornée

Au 2026-07-26, aucune combinaison n'avait été trouvée sans migration majeure.
Le lot C0.6 autorise et qualifie précisément cette migration de parents. Les
lignées 1.x et 2.x n'ont pas reçu de backport et ont donc été supprimées du
graphe plutôt qu'adaptées.

Le dépôt conserve le raw audit rouge et permet uniquement une décision
propriétaire privée, validée contre un schéma strict :

- advisory exact `GHSA-mh99-v99m-4gvg` ;
- deux chemins de dépendances exacts ;
- audit production à zéro high/critical ;
- zéro critical dans l'audit complet ;
- absence dans le SBOM et l'artefact runtime ;
- SHA produit et preuve CI exacts ;
- issue de remédiation et expiration au plus à quatorze jours ;
- révocation automatique en cas de dérive de SHA, nouvel advisory, présence
  runtime, entrée publique atteignable ou contrôle manquant.

Le workflow ne transforme jamais l'audit brut en vert. Il archive les deux
rapports et n'accepte l'advisory de développement que si l'entrée privée
schema-validée satisfait tous les contrôles. Sans cette entrée exacte, le job
échoue.

## Condition de reprise historique — satisfaite

L'issue GitHub `#83` suit la suppression des deux lignées historiques.
Le critère est satisfait par l'unification testée sur `5.0.8`. Toute
réapparition d'une version inférieure doit faire échouer
`npm run security:brace-expansion` et les contrôles npm audit. L'ancienne
exception ne doit pas être activée.
