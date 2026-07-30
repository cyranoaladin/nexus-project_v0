# Rapport de dépendances et de risque

## Date et périmètre

Audit exécuté le 2026-07-30 depuis
`053868b3237cd6cb89916255626720672a945330`, puis après correction dans
`fix/bilan-foundation-readiness-20260730`.

Les preuves machine-readable sont synthétisées dans
`docs/security/2026-07-30-dependency-risk-inventory.json`. Les runs CI
archivent en plus les sorties brutes `npm-audit-production.json`,
`npm-audit-full.json` et le SBOM CycloneDX.

## Résultat

| Périmètre | Avant | Après | Verdict |
|---|---:|---:|---|
| production, moderate+ | 1 moderate | 0 | corrigé |
| production, high/critical | 0 | 0 | vert |
| arbre complet | 1 moderate + 36 high | 36 high | décision propriétaire requise |

Les 36 entrées hautes ne représentent pas 36 avis indépendants. Elles
propagent toutes `GHSA-mh99-v99m-4gvg` dans le graphe d'outillage.

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

## Risque résiduel : brace-expansion

Avis : `GHSA-mh99-v99m-4gvg`, CVSS 7.5, déni de service par expansion non
bornée pouvant épuiser la mémoire.

Versions vulnérables présentes :

- `1.1.16` via ESLint, plugins ESLint et outils Jest ;
- `2.1.2` via CycloneDX → node-gyp → cacache → glob → minimatch.

Chemins exacts attendus par le validateur :

```text
node_modules/brace-expansion
node_modules/cacache/node_modules/brace-expansion
```

Le `5.0.8` présent sous TypeScript-ESLint est corrigé et n'est pas couvert par
l'exception.

### Atteignabilité

Les deux versions vulnérables sont des dépendances de développement. Elles
traitent des motifs ou arbres issus du dépôt et de la CI, pas une entrée HTTP
publique. Elles sont absentes :

- de l'audit `--omit=dev` ;
- du SBOM runtime CycloneDX 1.6 de 523 composants ;
- des répertoires `node_modules` du standalone ;
- du chemin critique de l'application.

Le risque résiduel est une indisponibilité du job de lint, test ou SBOM à la
suite d'un motif malveillant introduit dans une modification du dépôt. Il
n'est pas déclaré inexploitable.

## Expériences officielles du 30 juillet

Une copie temporaire du manifeste et du lockfile a testé les versions publiées
à la date du lot :

| Expérience cumulative | High | Décision |
|---|---:|---|
| arbre retenu | 36 | baseline |
| ESLint 9.39.5 + eslint-config-next 15.5.22 | 33 | non retenu |
| + Jest 30.4.2 / jsdom 30.4.1 / ts-jest 29.4.12 | 33 | non retenu |
| + remplacement du CLI CycloneDX | 27 | non retenu |

L'écart avec l'expérience du 26 juillet, qui indiquait 26, provient de la
résolution courante du registre et est explicitement conservé : les nombres
sont des mesures, pas des constantes à falsifier.

Ces migrations ne rendent pas la gate verte. Jest 30 ne réduit plus le nombre
d'entrées après ESLint 9. Le retrait de CycloneDX supprimerait le générateur
1.6 validé et son augmentation contrôlée pour les dépendances optionnelles,
sans éliminer l'avis. ESLint 10 est exclu par le peer range de
`eslint-config-next@15` et nécessite la migration vers la configuration plate.

Aucun override majeur de `brace-expansion`, aucun fork et aucun
`npm audit fix --force` ne sont appliqués.

## Mesures compensatoires exigées

- archivage du raw audit ;
- audit production sans high/critical, désormais sans moderate ;
- SBOM runtime validé ;
- standalone vérifié sans `brace-expansion` ;
- aucun secret de production dans le job CI ;
- entrée privée liée au SHA exact ;
- expiration maximale de quatorze jours ;
- révocation sur changement d'arbre, de SHA, d'avis, de présence runtime, de
  sévérité critique, d'atteignabilité publique ou de contrôle.

## Plan de suppression

Priorité P0 sécurité outillage, suivi par l'issue GitHub #83.

Critère d'acceptation :

1. une version officielle de chaque lignée dépendante résout vers
   `brace-expansion >=5.0.8`, ou les outils concernés sont remplacés sans perte
   de contrôle ;
2. `npm audit --audit-level=high` retourne zéro ;
3. lint, Jest, SBOM et build passent ;
4. le secret d'exception est supprimé.

Responsable attendu : propriétaire sécurité/technique Nexus Réussite.

## Verdict

La vulnérabilité de production est corrigée. Le risque restant est absent du
runtime mais exige une décision humaine explicite et temporaire ; le code seul
ne peut pas produire une CI complètement verte tant que cette décision n'est
pas fournie.
