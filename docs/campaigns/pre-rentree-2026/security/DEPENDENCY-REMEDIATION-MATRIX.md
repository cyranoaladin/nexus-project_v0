# Matrice de remédiation Dependency Integrity

## Date

2026-07-26, Africa/Tunis.

## Baseline

| Expérience | Hypothèse officielle | Audit high | Résultat |
|---|---|---:|---|
| E0 | Arbre de la PR #82 | 36 | Baseline reproduite |
| E1 | Patch/minor dans les majeures actuelles | 36 | `brace-expansion@5.0.8` corrige la lignée 5.x, sans supprimer les lignées 1.x/2.x |
| E2 | Jest 30 officiel | 35 | Incomplet |
| E3 | ESLint 9 compatible Next 15 | 33 | Incomplet |
| E4 | CycloneDX retiré au profit du SBOM npm officiel | 30 | Incomplet et couverture SBOM moins adaptée |
| E5 | Combinaison E2+E3+E4 | 26 | Incomplet, diff majeur |
| E6 | Override global / `npm audit fix --force` / seuil réduit | non pertinent | Rejeté : incompatible ou non correctif |

Chaque hypothèse a été mesurée isolément à partir de la même baseline. Les
lockfiles expérimentaux n'ont pas été conservés.

## Arbre retenu

```text
@cyclonedx/cyclonedx-npm@6.0.0
→ libxmljs2@0.37.0
→ node-gyp@11.5.0
→ make-fetch-happen@14.0.3
→ cacache@19.0.1
→ glob@10.5.0
→ minimatch@9.0.9
→ brace-expansion@2.1.2

eslint@8.57.1
→ minimatch@3.1.5
→ brace-expansion@1.1.16

eslint-config-next@15.5.20
→ @typescript-eslint/parser@8.65.0
→ @typescript-eslint/typescript-estree@8.65.0
→ minimatch@10.2.5
→ brace-expansion@5.0.8
```

La troisième lignée est corrigée. Les deux premières sont exclusivement des
outils de lint/SBOM et n'entrent pas dans l'artefact déployé.

## Règle de sortie

Le scan complet reste visible. L'exception ne couvre que
`GHSA-mh99-v99m-4gvg`, échoue après son expiration, et est révoquée dès que le
registre publie une migration officielle compatible.
