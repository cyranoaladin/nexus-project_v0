# Analyse de capacité — Pré-rentrée 2026, ajout 4e et Philosophie Terminale

Date : 2026-07-27
Branche : `feat/pre-rentree-4e-philo-planning`
Périmètre : mission consolidée "Entrée en 4e" + "Philosophie — Entrée en Terminale" (§0 à §12).

## 1. Ressources (§0/§1)

### Enseignants

| Rôle | Matières | `maxHoursPerDay` (informatif, R3) | Affecté |
|---|---|---|---|
| `TEACHER_A_MATHS_NSI` | Mathématiques, NSI, Mathématiques expertes | 8h | non |
| `TEACHER_B_MATHS_COLLEGE` | Mathématiques (nouveau, collège) | 8h | non |
| `TEACHER_C_FRANCAIS` | Français, **Philosophie** | 6h | non |
| `TEACHER_D_PHYSIQUE_CHIMIE` | Physique-Chimie | 4h | non |
| `TEACHER_E_SVT` | SVT | 4h | non |

`TEACHER_F_LETTRES_COLLEGE` n'a jamais été créé (§0.1 — annulé) : un seul enseignant de français (`TEACHER_C_FRANCAIS`) couvre Français ET Philosophie, cohérent avec la réalité d'un enseignant certifié Lettres/Philosophie pouvant intervenir sur les deux disciplines au niveau lycée.

`maxHoursPerDay` est un champ optionnel du schéma et purement informatif dans le validateur (R3) : il est calculé et rapporté par fenêtre, jamais bloquant (§0.2).

### Salles

3 salles banalisées et interchangeables : `salle-1`, `salle-2`, `salle-3`. Aucune table de compatibilité salle → matière (`roomRoles` supprimé, §0.3). Seule contrainte : au plus 3 groupes simultanés par (fenêtre, bloc) — validateur R2, bloquant.

## 2. Occupation salles/enseignants par fenêtre

### Fenêtre 1 (17–21 août)

| Bloc | Groupes simultanés | Détail |
|---|---|---|
| A | 3/3 | 3e Mathématiques · Première SVT · **4e Français** |
| B | 3/3 | Première Mathématiques · 3e Français · **4e Mathématiques** |
| C | 2/3 | Première NSI · Seconde Français |
| D | 3/3 | Seconde Mathématiques · Première SVT (alternatif) · **Terminale Philosophie** |

### Week-end début Fenêtre 2 (22–23 août)

| Bloc | Groupes simultanés | Détail |
|---|---|---|
| A | 1/3 | Première Français |
| B | 1/3 | Première Physique-Chimie |

### Fenêtre 2 (24–28 août)

| Bloc | Groupes simultanés | Détail |
|---|---|---|
| A | 1/3 | Terminale Mathématiques expertes |
| B | 1/3 | Terminale Mathématiques |
| C | 3/3 | Terminale NSI · Terminale Physique-Chimie · Terminale SVT |
| D | 2/3 | Terminale NSI (alternatif) · Terminale SVT (alternatif) |

Aucune violation R2 (jamais plus de 3 groupes simultanés). Les 3 nouveaux groupes (4e Français bloc A, 4e Mathématiques bloc B, Terminale Philosophie bloc D) sont tous en Fenêtre 1, sans déplacement d'aucun créneau existant (§3).

**Séparation Philosophie / spécialités (§3, exigence d'explicitness) :** Philosophie a lieu exclusivement en Fenêtre 1 (17–21 août) ; les 5 spécialités de Terminale (Mathématiques, Physique-Chimie, NSI, SVT, Mathématiques expertes) ont toutes lieu en Fenêtre 2 (24–28 août). Cette séparation est rendue explicite : FAQ publiée `faq-philosophie-deux-fenetres`, et un encart dédié dans le planning du dossier PDF Terminale (`generate_level_dossiers.py::planning_page`).

## 3. Capacité par niveau (§5.1, §6.3)

| Niveau | Tier | Effectif | Tarif/matière | Matières max |
|---|---|---|---|---|
| 4e | Fondations | **4 à 6** (exception documentée, `PRE2026-4E-350`) | 350 TND | 2 |
| 3e | Fondations | 3 à 6 | 350 TND | 2 |
| Seconde | Fondations | 3 à 6 | 400 TND | 2 |
| Première | Premium | 3 à 5 | pack 1-4 matières (480/900/1350/1800 TND) | 3 |
| Terminale | Premium | 3 à 5 | pack 1-4 matières (480/900/1350/1800 TND) | 4 |

Le plancher d'ouverture du groupe 4e (4, contre 3 pour 3e/Seconde) est une exception commerciale documentée et approuvée (`data/pricing.canonical.json#/pre_rentree_foundations/0/commercial_exception`, `exception_id: PRE2026-4E-350`, statut `APPROVED`, 2026-07-27) — le plancher global `stage_college` reste inchangé pour toute autre offre.

Les effectifs ne sont jamais affichés comme une plage unique "Fondations : X à Y" nulle part (site, PDF) : chaque surface dérive l'effectif PAR NIVEAU (`getPreRentreeLevelCapacities()` côté TypeScript, `group_bounds_for_level()` / `foundations_effectifs_par_niveau()` côté Python).

## 4. Combinatoire pédagogique (§4, R4/R5)

| Niveau | Combinaisons testées | Règle |
|---|---|---|
| 4e | 3 | Fondations, non contraint (1 ou 2 matières parmi Maths/Français) |
| 3e | 3 | idem |
| Seconde | 3 | idem |
| Première | 29 | ≤ 3 spécialités parmi {Mathématiques, Physique-Chimie, NSI, SVT} |
| Terminale | 29 | ≤ 2 spécialités parmi {Mathématiques, Physique-Chimie, NSI, SVT} ; Mathématiques expertes jamais sans Mathématiques (R5) ; **Philosophie hors quota spécialités, toujours vendable seule** |
| **Total** | **67** | 0 violation |

Chiffres produits par `npm run pre-rentree:validate-planning` (`scripts/validate-stage-planning.ts`) :

```json
{
  "modulesCount": 17,
  "sessionTemplatesCount": 85,
  "scheduledOccurrencesCount": 100,
  "combinationsTested": 67,
  "actionableCombinations": 67,
  "blockedCombinations": 0,
  "violationCount": 0
}
```

Ces chiffres correspondent exactement à ceux exigés par la mission (§9) : 14→17 modules, 70→85 gabarits de séance, 85→100 occurrences planifiées (20 groupes × 5 séances), 49→67 combinaisons (répartition 4e:3, 3e:3, 2de:3, 1re:29, Tle:29). Terminale = 29 confirme que Philosophie n'est ni comptée comme spécialité ni rendue invendable seule (les deux auraient fait dévier ce chiffre, cf. avertissement mission §9).

## 5. Documents PDF (§7)

8 PDF publics régénérés par `npm run pre-rentree:public-pdfs` (`tools/pdf-generator/generate_all_pdfs.py` + `generate_level_dossiers.py`) : 5 dossiers de niveau (4e, 3e, Seconde, Première, Terminale) + Planning_InfosPratiques + Tarifs + FlyerEssentiel. Vérifiés par `npm run pre-rentree:public-pdfs:verify` (`scripts/pre-rentree/verify_public_pdfs.py`) : signature PDF, MIME, absence de page vide/débordement, police embarquée, liens `tel:`/`mailto:`/`https:`, CTA canonique, absence de copie interdite, aucun numéro de salle. Le dossier d'accueil imprimable (`DossierAccueil_PRINT.pdf`) reste `INTERNAL_REVIEW`, hors allowlist publique.

## 6. Dette connue, non introduite par cette mission

`NexusReussite_PreRentree2026_Tarifs.pdf` n'affiche que les 4 lignes du pack Premium (1 à 4 matières) et n'affiche jamais les tarifs Fondations par matière (350/400 TND) que la page publique affiche. Divergence pré-existante, documentée et testée par assertion de la réalité actuelle (`__tests__/campaigns/pre-rentree-2026-site-real-pdf-parity.test.ts`), pas introduite ni corrigée par cette mission.
