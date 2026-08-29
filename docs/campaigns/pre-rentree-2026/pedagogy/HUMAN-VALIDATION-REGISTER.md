# Registre de validation humaine du corpus pédagogique

## Statut

Registre non signé généré à partir des paquets de revue du 30 juillet 2026.
Il ne constitue aucune approbation. Les 17 modules restent
`HUMAN_VALIDATION_REQUIRED`.

Les paquets détaillés sont reproductibles avec :

```bash
npm run pre-rentree:pedagogy:review
```

Ils résident sous `.artifacts/pre-rentree-2026/pedagogy/review/`, ne sont pas
suivis par Git et ne sont pas des sources éditoriales.

## Inventaire lié aux hashes

| Module | Discipline | Niveau | Séances | Items | Manuelles | Hash de définition |
|---|---|---|---:|---:|---:|---|
| `quatrieme-mathematiques` | Mathématiques | 4e | 5 | 24 | 0 | `sha256:59f6c280f780258ba3382665f6947bf2e6cf4d350b045cc67b4060d7d021ae7e` |
| `quatrieme-francais` | Français | 4e | 5 | 24 | 2 | `sha256:688c812a29ddc7a0c52931989ad569c92888e5eda2d89a5a27fbec5d05ab004c` |
| `troisieme-mathematiques` | Mathématiques | 3e | 5 | 24 | 0 | `sha256:f2c913c0c7c3262d6e896e75cf0216300e79bb144f8d0804e36bd9336e74d754` |
| `troisieme-francais` | Français | 3e | 5 | 24 | 2 | `sha256:eb23866c49e64f6af81b12c71dced04f8dd5b2894a97cadae352864e20234b49` |
| `seconde-mathematiques` | Mathématiques | 2de | 5 | 24 | 0 | `sha256:a9034380394aefd0260979cf491fc9c390fd5b5cdefc19da7795f4047d50b552` |
| `seconde-francais` | Français | 2de | 5 | 24 | 3 | `sha256:1a400616f139b471a8d9e7daf0e920dc445abc6502a54925eb1642ff7f43b4a5` |
| `premiere-mathematiques` | Mathématiques | 1re | 5 | 24 | 0 | `sha256:5046fc98815058cdfffc08a35f2e01a0fb4d8f956830ed520b44de8466eab56b` |
| `premiere-francais-eaf` | Français | 1re | 5 | 24 | 2 | `sha256:d0cbc12eba633b4e710e9b0f0f18fd3339efdb682bc2939802e1abb5ab7ebd4c` |
| `premiere-nsi` | NSI | 1re | 5 | 24 | 0 | `sha256:db4260b374dc6d4b3388737881282df470d7dcd1534c7723b33e4d68d270bf1e` |
| `premiere-physique-chimie` | Physique-Chimie | 1re | 5 | 24 | 0 | `sha256:845bce6b9de5d3752c42226d7320730a81f1913a796a4fd6f229f0d8245d9adf` |
| `terminale-mathematiques` | Mathématiques | Tle | 5 | 24 | 0 | `sha256:db723beb770084dc1622f2644e0d64630d21b376c67895b54c58b8457ebde16c` |
| `terminale-maths-expertes` | Maths expertes | Tle | 5 | 24 | 0 | `sha256:406c96ed808ea40195c76906b30ee1c7844c6831acd7045cc4b9d2578e2ac151` |
| `terminale-nsi` | NSI | Tle | 5 | 24 | 0 | `sha256:3597c891ea2679a22db58e599c29727a2cad04a3824e40a3ed9efd598a301928` |
| `terminale-physique-chimie` | Physique-Chimie | Tle | 5 | 24 | 0 | `sha256:fd592175f6ff58e221403322f0e03c11a1c98b512278391225578c8848f91d0b` |
| `premiere-svt` | SVT | 1re | 5 | 24 | 0 | `sha256:c485a45d6d5abbd29aa6908dcf4c1fb7e95a1d25a76c260ceaba143d71221a1a` |
| `terminale-svt` | SVT | Tle | 5 | 24 | 0 | `sha256:815cba0064429cb8e67f7a1914170eae0bb95017ae9ca82431bf14bb0cffff82` |
| `terminale-philosophie` | Philosophie | Tle | 5 | 24 | 24 | `sha256:850fada56b41db592ede7bd8ef4ab2ce9dc72eeb172919bade0d0320e34ee1ec` |

Totaux dérivés : 17 modules, 85 séances, 408 items et 33 réponses manuelles.

## Blocage commun

Les 17 paquets signalent `OFFICIAL_SOURCES_NOT_CITED`. Pour chaque module, les
personnes suivantes ne sont pas renseignées et doivent être réelles :

- enseignant disciplinaire ;
- responsable pédagogique ;
- responsable de publication.

## Fiche de décision obligatoire par module

| Champ | Valeur attendue |
|---|---|
| module, discipline, niveau | dérivés du paquet |
| sources officielles | références structurées vérifiées |
| enseignant disciplinaire | identité vérifiable |
| revue disciplinaire | date, décision et réserves |
| responsable pédagogique | identité vérifiable |
| revue propriétaire | date, décision et réserves |
| responsable publication | identité vérifiable |
| hash validé | exactement le hash de la source revue |
| décision | transition explicite et signée |

Transitions requises :

```text
HUMAN_VALIDATION_REQUIRED
  -> SUBJECT_REVIEW_APPROVED
  -> PEDAGOGICAL_OWNER_APPROVED
  -> PUBLICATION_APPROVED
```

Toute modification qui change le hash invalide les approbations antérieures.
Une validation technique ou une réponse de Codex ne vaut pas validation
disciplinaire.

## Physique-Chimie Seconde

Aucun module de Physique-Chimie Seconde n'existe dans cet inventaire. Il reste
interdit de le créer, le référencer ou l'affecter tant que cinq séances, une
CPS et toutes les validations requises n'existent pas dans les sources
canoniques.
