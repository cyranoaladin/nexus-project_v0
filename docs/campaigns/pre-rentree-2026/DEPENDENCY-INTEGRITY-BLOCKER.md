# Blocage Dependency Integrity — Pré-rentrée 2026

## Date

2026-07-26, Africa/Tunis.

## Contexte

La release publique exige que les deux audits npm suivants soient verts :

```bash
npm audit --omit=dev --audit-level=high
npm audit --audit-level=high
```

L'analyse a été menée depuis un clone de release isolé, avec Node.js
`v22.21.0`, npm `10.9.8` et le registre npm public. Aucun override, patch de
package tiers, abaissement de seuil ou waiver n'a été appliqué au dépôt.

## Résultats sur la branche

- audit des dépendances de production : vert, zéro vulnérabilité ;
- audit complet : rouge, 36 vulnérabilités hautes ;
- avis commun :
  `brace-expansion <=5.0.7`, `GHSA-mh99-v99m-4gvg`.

Les lignées vulnérables sont transitives :

- ESLint 8 et ses plugins utilisent `minimatch@3` /
  `brace-expansion@1.1.16` ;
- Jest 29 utilise `glob@7` / `minimatch@3` /
  `brace-expansion@1.1.16` ;
- CycloneDX 6 utilise `glob@10` / `minimatch@9` /
  `brace-expansion@2.1.2` ;
- TypeScript-ESLint utilise `minimatch@10.2.5` /
  `brace-expansion@5.0.7`.

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

## Pourquoi ESLint 10 n'est pas appliqué

`npm audit fix --force` propose ESLint `10.8.0`. Cette solution n'est pas
compatible avec la toolchain du dépôt :

- `eslint-config-next@15.5.20` déclare ESLint
  `^7.23.0 || ^8.0.0 || ^9.0.0`, donc exclut ESLint 10 ;
- la migration ESLint 10 supprime l'ancien système de configuration et impose
  une migration majeure de configuration ;
- la mission interdit explicitement un override majeur incompatible et
  `npm audit fix --force` non maîtrisé.

## Sources officielles vérifiées

- avis GitHub : `https://github.com/advisories/GHSA-mh99-v99m-4gvg` ;
- documentation npm SBOM :
  `https://docs.npmjs.com/cli/commands/npm-sbom/` ;
- guide officiel de migration ESLint 10 :
  `https://eslint.org/docs/latest/use/migrate-to-10.0.0` ;
- versions et peer dependencies : registre npm interrogé avec `npm view`.

## Décision

Aucune combinaison officielle, publiée et compatible n'a été trouvée au
2026-07-26 pour rendre l'audit complet vert sans contourner les règles de
sécurité.

Conséquences :

- aucune modification de `package.json`, `package-lock.json`, workflow ou
  script de sécurité n'est commise ;
- `publication_authorization` reste ouverte ;
- `releaseStatus` ne passe pas à `PUBLIC_READY` ;
- aucun tag de GO n'est créé ;
- aucun merge ni déploiement n'est autorisé.

Verdict sécurité : **RELEASE BLOQUÉE PAR DEPENDENCY INTEGRITY**.

## Condition de reprise

Rejouer l'expérience lorsque Next/ESLint, Jest et leurs plugins auront publié
des arbres transitifs utilisant une version corrigée de `brace-expansion`, puis
exécuter la totalité des gates de la release sans waiver.
