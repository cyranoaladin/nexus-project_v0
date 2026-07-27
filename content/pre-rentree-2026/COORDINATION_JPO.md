# COORDINATION — Intégration SVT ↔ périmètre codex (`ops/jpo-pre-rentree-2026`)

La branche `feat/svt-integration-final` **ne touche pas** à `content/pre-rentree-2026/jpo-2026/**` (périmètre de l'agent codex). En contrepartie, voici la liste **exhaustive** des chaînes que codex doit appliquer dans son périmètre pour rester cohérent avec l'intégration SVT scellée (D3, D4-final).

## Règles à appliquer
- **Énumérations Première/Terminale** : ajouter **SVT** (5ᵉ matière) — Première : Maths, Physique-Chimie, NSI, Français, **SVT** ; Terminale : Maths, Physique-Chimie, NSI, Philosophie, **SVT**.
- **Formulation packs** : « 1 à 4 matières **au choix parmi 5** » (jamais « 1 à 4 » seul pour Première/Terminale).
- **SVT = Première et Terminale uniquement** — ne jamais l'ajouter en 3e ni en Seconde.
- **Interdits** : aucune mention de rémunération enseignant, aucun chiffre invérifiable, jamais le mot « formation ».

## Chaînes précises — `content/pre-rentree-2026/jpo-2026/master.fr.json`

| Ligne (approx.) | Clé | Valeur actuelle | Correction attendue |
|---|---|---|---|
| ~227 | `publicWording` | « …de 1 à 4 matières parmi Mathématiques, Physique-Chimie, NSI et Français. » | « …de 1 à 4 matières au choix parmi 5 : Mathématiques, Physique-Chimie, NSI, Français et **SVT**. » |
| ~250 | `publicWording` | « …de 1 à 4 matières parmi Mathématiques, Physique-Chimie, NSI et Philosophie. » | « …de 1 à 4 matières au choix parmi 5 : Mathématiques, Physique-Chimie, NSI, Philosophie et **SVT**. » |
| ~364 | `publicWording` | « Premium — … pack de 1 à 4 matières, 10 heures… » | « …pack de 1 à 4 matières **au choix parmi 5**, 10 heures… » |
| ~734 | `publicWording` | « Mathématiques, Physique-Chimie, NSI et Français, de une à quatre matières. » | « Mathématiques, Physique-Chimie, NSI, Français et **SVT**, de 1 à 4 matières au choix parmi 5. » |
| ~742 | `publicWording` | « Mathématiques, Physique-Chimie, NSI et Philosophie, de une à quatre matières. » | « Mathématiques, Physique-Chimie, NSI, Philosophie et **SVT**, de 1 à 4 matières au choix parmi 5. » |
| ~790 | `publicWording` | « …Premium concerne la Première et la Terminale, avec des packs de 1 à 4 matières et des groupes de 3 à 5. » | « …packs de 1 à 4 matières **au choix parmi 5**, groupes de 3 à 5. » |

> Numéros de ligne indicatifs (le fichier peut avoir bougé) — chercher par `publicWording` + le texte source.

## FAQ SVT
Si `jpo-2026/master.fr.json` porte une FAQ, y ajouter une entrée SVT équivalente à celle du manifeste :
« La SVT est proposée en Première et Terminale uniquement… seuil d'ouverture identique… décision au plus tard le 10 août à 18 h. » (aucun chiffre nouveau).

## Contrôle
Un grep de conformité sur `jpo-2026/**` est consigné dans `DEBTS.md` (rubrique « dette codex ») en fin de mission : la branche SVT **constate** les non-conformités, elle **ne les corrige pas**.
