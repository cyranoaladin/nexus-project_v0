# NEXUS — POINT D'ENTRÉE DU DÉPÔT

## Surface officielle de diffusion

L'unique surface officielle de distribution des livrets de diagnostic Nexus V2 est :

```text
release/diagnostics-v2/
```

Rien d'autre ne doit être envoyé à un candidat ou à sa famille.

* **`release/diagnostics-v2/01_LIVRETS_CANDIDAT/`** : Seule source officielle des livrets remis aux candidats, organisée par profil et par matière.
* **`release/diagnostics-v2/02_CORRECTIONS_COACH/`** : Documents de correction et grilles d'évaluation à usage exclusif des coachs Nexus (**CONFIDENTIEL — ne sort jamais de Nexus**).
* **`release/diagnostics-v2/03_IMPRESSION/`** : Catalogues de référence et recueils complets d'impression (`CATALOGUE_RECUEIL_COMPLET_*`).
* **`release/diagnostics-v2/00_GUIDE/`** : Guide de l'opérateur, matrices réglementaires et planches visuelles.
* **`release/diagnostics-v2/04_INTERNE/`** : Manifestes techniques et matrices d'attribution.

## Source unique de vérité

```text
CANONICAL_DISTRIBUTION_ROOT = release/diagnostics-v2
CANDIDATE_EXPORTS_ARE_DERIVED = YES
```

* `release/diagnostics-v2/` ne contient que des PDF **génériques** : aucun nom réel de candidat n'y figure, ni dans un livret, ni dans un manifeste, ni dans une matrice.
* `release/diagnostics-v2/04_INTERNE/MANIFESTE_V2.json` fait foi pour les artefacts canoniques : empreinte de chaque fichier et commit source (`source_git_head`).
* Les PDF propres à un candidat (couverture nominative, session) sont des **sorties dérivées**, reconstruites depuis la release par `scripts/pack_candidat.py`. Ils ne sont jamais corrigés à la main et ne deviennent jamais une seconde source de vérité : une correction se porte dans la source, puis la release est reconstruite, puis l'export est regénéré.
* `exports_candidats/` reste hors versionnement Git (`.gitignore`). Aucun chemin suivi par Git ne porte de nom de candidat.

## Génération de packs candidats personnalisés

Pour générer un pack sur-mesure pour un candidat spécifique (sans inclure de spécialités non suivies) :

```bash
python3 scripts/pack_candidat.py --profil P2 --mode-ep annuelle \
  --spes-1re MATH PC NSI --spe-abandonnee PC --spes-tle MATH NSI --eaf-due none \
  --candidat-id CL-TEST-0001 --candidat-nom "Camille TEST"
```

Le dossier est généré dans `exports_candidats/` (hors versionnement Git). Sans `--candidat-nom`, les livrets restent les binaires canoniques, sans aucune donnée personnelle.

Avec `--candidat-nom`, la couverture de chaque livret reçoit le nom et la session, et le **dossier d'entrée est recomposé depuis la source des formulaires** : il ouvre sur un encadré « Situation déjà enregistrée par Nexus », rappelle sous chaque question réglementaire déjà connue (profil, session, EAF, spécialités, spécialité non poursuivie, passage en une même session, mode des évaluations ponctuelles) la mention « Information déjà enregistrée » au lieu d'une zone de saisie, écarte la section d'éligibilité au passage en une même session quand elle est sans objet, et annonce une durée recalculée au prorata des questions effectivement posées. Le PDF canonique de la release n'est jamais modifié.

Le dossier d'export est **déterministe et lisible** : `<SLUG_NOM>__<ID_CANDIDAT>__BAC<SESSION>`, par exemple `Camille_TEST__CL-TEST-0001__BAC2027/` (sans nom : `CL-TEST-0001__BAC2027/`). Regénérer le même candidat ne crée jamais de dossier horodaté voisin : le pack se construit dans un chantier temporaire, est validé, puis remplace l'export précédent. Un échec laisse l'export précédent intact.

```text
exports_candidats/<SLUG_NOM>__<ID>__BAC<SESSION>/
├── A_ENVOYER/            BORDEREAU_ENVOI.txt + livrets/*.pdf (remis à la famille)
├── OPTION_IMPRESSION/    PACK_IMPRESSION_CANDIDAT.pdf (impression en un seul fichier)
└── _INTERNE_NEXUS/       BORDEREAU_OPERATEUR_INTERNE.txt (ne sort jamais de Nexus)
```

## Statut des répertoires de construction et d'audit

* **`build/controle-diffusion/`** : **AUDIT ONLY**. Banc de test et fixtures pour le contrôle qualité de la chaîne de distribution. Aucun document ne doit en être extrait pour diffusion.
* **`instruments/*/build/`** : Artefacts de compilation intermédiaires, reconstructibles et jetables.

## Périmètre réglementaire

* **Matières hors périmètre Nexus** : LVA, LVB, EPS (`OUT_OF_SCOPE_REGULATORY_SUBJECTS=LVA,LVB,EPS`).
* **Format officiel EMC** : `TC_EMC_REGULATORY_FORMAT_CONFIRMED=NO` (durée et format diagnostiques internes dans l'attente de la note de service ministérielle 2026-2027).
