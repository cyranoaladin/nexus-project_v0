# README_ETAT — Instruments de bilan diagnostic « Candidats libres »

## Hiérarchie des sources

Le Cahier de conception (`cahier.md`, version 1.0 du 10 septembre 2026) reste la source de
conception du dispositif, mais il ne tranche pas contre un texte réglementaire : l'audit du
2026-09-10 a montré qu'il pouvait être obsolète — œuvre du bloc C rattachée à la session
2028, épreuve anticipée de mathématiques ignorée. L'ordre de préséance est le suivant.

| Rang | Source | Exemples |
|---|---|---|
| 1 | **Textes réglementaires officiels** applicables à la session et à la situation du candidat | décret et arrêté du 10 juin 2025 · arrêté du 16 juillet 2018 · notes de service au Bulletin officiel |
| 2 | **Décisions formelles de la direction pédagogique** compatibles avec ces textes | arbitrages A-01 à A-10 · décisions Q-13 à Q-25 · reprises R1, P1, P2 |
| 3 | **Cahier de conception** v1.0 | |
| 4 | **Référentiels et conventions techniques** dérivées | `competences.json` · `catalogue_instruments.json` · `regles_bilan.json` · `programmes_examen.json` |
| 5 | **Code et rendus** | |

Un texte officiel postérieur ou plus spécifique l'emporte toujours sur le Cahier. Une
divergence se tranche en faveur du texte, se déclare comme écart et se trace au registre.
La règle est portée par `referentiels/programmes_examen.json` → `hierarchie_normative`, et
`scripts/audit_readme.py` refuse toute formulation qui replacerait le Cahier au-dessus.
Une divergence entre le prompt de production et le Cahier reste, elle, tranchée par le
Cahier et signalée au rapport de porte.

**Convention de date.** Les dates de ce document sont celles des commits, en heure locale
de Tunis (UTC+1), fuseau du poste de travail. Une section datée du jour porte la date du
commit qui la produit ; aucune date future n'y figure. Les sections « 5 undecies » et
« 5 decies » avaient été datées du 2026-09-11 par erreur, pour des travaux commités le
2026-09-10 à 20 h 41 et 22 h 07 : corrigé.

Dernière mise à jour : 2026-09-10 — **Portes 1 à 7 produites, Porte 8 consolidée puis
contre-expertisée, soumise à validation ; généralisation non autorisée**. L'état des instruments, des référentiels et des tests n'est plus recopié ici : il est calculé au § 1 bis et vérifié par test.

---

## 1. Ce qui existe dans le dossier

| Fichier | Nature | Statut |
|---|---|---|
| `NexusReussite_CandidatsLibres_CahierConception_BilansDiagnostic.docx` | Cahier de conception v1.0 | Fourni par la direction — **non modifiable** |
| `cahier.md` | Conversion pandoc du Cahier, lecture seule | Généré (audit) |
| `README_ETAT.md` | Ce fichier | Généré |
| `referentiels/competences.json` | Référentiel des périmètres, compétences, chapitres et écarts au Cahier | **Effectifs : § 1 bis, calculé** |
| `referentiels/codes_erreur.json` | Catalogue fermé des codes d'erreur | **Effectifs : § 1 bis, calculé** |
| `referentiels/termes_bloquants.json` | Expressions proscrites, avec motifs et exceptions de domaine | **Effectifs : § 1 bis, calculé** |
| `referentiels/catalogue_instruments.json` | Enregistrements instrument × version, durées cibles du § 3.1, plan de passation | **Effectifs : § 1 bis, calculé** |
| `scripts/validate_referentiel.py` | Contrôles des quatre référentiels, importé par `validate_instrument.py` | Portes 1 et 1b |
| `scripts/validate_instrument.py` | Contrôles d'un instrument : banque + assemblage | **Porte 1c — soumis à validation** |
| `scripts/build_instrument.py` | Génération déterministe des quatre rendus, plus PDF | **Porte 1c — soumis à validation** |
| `instruments/_FIXTURE/` | Instrument **fictif** de test, deux versions | Porte 1c |
| `tests/` | Suite pytest — référentiels, validateur, générateur, français, règles de bilan, maquette, bilan, provenance, passation | **Effectifs : § 1 bis, calculé** |
| `instruments/<CODE>/` | Banques, assemblages, grilles et formulaires des **20 instruments métier** : les quinze du Cahier initial, `MATH-EA` (Q-24), `TC-HG` (B9), `TC-EMC` (B10), `FR-POS` et `FR-POS-ORAL` (B11). S'y ajoutent `_FIXTURE`, **fixture technique** sur laquelle les contrôles s'éprouvent, et les dossiers `_MAQUETTE*`, qui sont des jeux de données et non des instruments : ni l'une ni les autres n'entrent dans le décompte du dispositif | **Inventaire, effectifs et état : § 1 bis, calculé** |
| `referentiels/variables_qp.json` | Variables du questionnaire, typées et bornées | **Effectifs : § 1 bis, calculé** |
| `referentiels/dimensions_met.json` | Dimensions de méthode et outillage par niveau | **Effectifs : § 1 bis, calculé** |
| `referentiels/regles_bilan.json` | Seuils et règles de décision du moteur de bilan (§ 5.2 à § 5.5, § 7.13, § 8.1, § 8.2) | **Porte 8 — soumis à validation** |
| `scripts/maquette_donnees.py` | Dérive le jeu de saisie fictif depuis la commande portée par `specification.json` | Porte 8 |
| `scripts/maquette_bilan.py` | Moteur : scores, agrégats, groupes de planification, règles du § 8.2 ; maquette destinée à la direction | **Porte 8 — soumis à validation** |
| `scripts/bilan.py` | Rendu déterministe du document remis : sept sections du § 8.1, deux registres, provenance des nombres, contrôles du § 6.3 | **Porte 8 — soumis à validation** |
| `scripts/passation.py` | Plan de passation calculé : demi-journées, plafond du § 1.1, supports à distance | **Porte 8 — soumis à validation** |
| `scripts/etat_depot.py` | Produit les blocs calculés du § 1 bis et vérifie que ce README n'a pas dérivé | **Porte 8 — soumis à validation** |
| `scripts/diffusabilite.py` | Statut de diffusabilité d'un instrument, calculé depuis ses fichiers — source unique | **Contre-expertise — soumis à validation** |
| `scripts/mesures.py` | Relevé sémantique des mesures diagnostiques, pour la non-régression | **Contre-expertise — soumis à validation** |
| `scripts/preuve_registre.py` | Preuve automatisée que la version parent ne diffère que par le registre | **Contre-expertise — soumis à validation** |
| `scripts/audit_readme.py` | Audite l'état courant du README contre le dépôt : effectifs, noms retirés, œuvres hors session, questions closes, statuts, hiérarchie des sources | **Contre-expertise — soumis à validation** |
| `scripts/eligibilite.py` | Q-26 — éligibilité au passage de toutes les épreuves à la même session, évaluée depuis la matrice du référentiel | **Contre-expertise — soumis à validation** |
| `referentiels/programmes_examen.json` | Cartographie réglementaire par session : œuvres au programme, épreuves anticipées, conservation des notes | **Contre-expertise — soumis à validation** |
| `instruments/_MAQUETTE_P1/` | Jeu fictif P1 : couvre la règle de priorité du § 8.2 propre à ce profil | **Contre-expertise — soumis à validation** |
| `tests/instantanes/mesures.json` | Instantané des mesures, figé au commit précédent la contre-expertise | Contre-expertise |
| `instruments/_MAQUETTE/` | Jeu fictif P3 : commande, saisie, maquette, bilans candidat et parent | **Porte 8 — soumis à validation** |
| `instruments/_MAQUETTE_P2/` | Jeu fictif P2 en configuration « oral » : commande, saisie, bilan court | **Porte 8 — soumis à validation** |
| `referentiels/textes_sources.json` | Registre des sept textes sources : édition, fac-similé, bornes, mesures, empreintes, usages autorisés | **Release V1 — soumis à validation** |
| `scripts/textes_sources.py` | Contrôles du registre : appariement par empreinte, collision, contamination entre instruments, champs recalculés | **Release V1 — soumis à validation** |
| `scripts/release.py` | Produit le manifeste de version depuis le dépôt, et son résumé lisible | **Release V1 — soumis à validation** |
| `scripts/distribution.py` | **Banc de contrôle** de la chaîne de diffusion : scan de fuite de correction, preflight PDF, complétude des packs, doublons. Écrit dans `build/controle-diffusion/{preflight,audit-fixtures}`, hors de `release/`, sous des noms qui ne peuvent pas se confondre avec un envoi | **Livraison V1 — soumis à validation** |
| `scripts/dates_anterieures.py` | Classe les dates postérieures à aujourd'hui : décision antérieure, citation explicative, ou inexpliquée | **Livraison V1 — soumis à validation** |
| `DISTRIBUTION_MATRIX.csv` | Une ligne par version d'instrument : niveau, matière, profils, durée, fichiers, empreinte, prêt ou non | Généré par `scripts/distribution.py` |
| `STUDENT_PACK_MATRIX.csv` | Une ligne par pack de profil : instruments, documents, durée totale, manquants | Généré par `scripts/distribution.py` |
| `CANDIDATE_PROFILES.csv` | Profils de candidats du dépôt, anonymisés : diagnostics requis, documents prêts et manquants | Généré par `scripts/distribution.py` |
| `pytest.ini` | Restreint la collecte par défaut à `tests/` : le matériel de passation NSI n'est pas la suite du dépôt | **Livraison V1 — soumis à validation** |
| `PRINT_MATRIX.csv` | Une ligne par destinataire préparé : pack papier, archive NSI, prêt à envoyer, prêt à imprimer | Généré par `scripts/distribution.py` |
| `APRES_LIVRAISON.md` | Le seul chantier reporté après diffusion : sortir les jeux de test de `instruments/` | Go-live V1 |
| `MANIFESTE_DEPOT.json` | Manifeste du **dépôt** : effectifs, empreintes de banques, d'assemblages, de rendus et de PDF, textes sources, critère de fin. Nommé `RELEASE_DIAGNOSTICS_V1` jusqu'à la refonte, ce qui laissait croire à une release concurrente de `diagnostics-v2` | Généré par `scripts/release.py` |
| `MANIFESTE_DEPOT.md` | Le même manifeste, lisible par la direction — dérivé du JSON, jamais ressaisi | Généré par `scripts/release.py` |
| `assets/brand/` | Logos officiels Nexus — horizontal et icône — et `MARQUE.json` : dimensions, rapport, empreintes SHA-256 | **Refonte V2 — soumis à validation** |
| `referentiels/modalites_epreuves.json` | Modalités officielles de chaque épreuve et évaluation ponctuelle : intitulé, type, durée, coefficient, structure, matériel, calculatrice, dispenses, source et NOR | **Refonte V2 — soumis à validation** |
| `templates/nexus-livret.tex` | Gabarit éditorial A4 : palette, polices, règles de composition, bandeaux, zones de réponse, extraits, documents d'appui | **Refonte V2 — soumis à validation** |
| `scripts/livret.py` | Compose **un livret autonome par matière**, candidat ou coach, depuis la banque et le référentiel des modalités | **Refonte V2 — soumis à validation** |
| `scripts/release_v2.py` | Construit `release/diagnostics-v2/` : guide, livrets par profil, corrections coach, packs d'impression, interne | **Refonte V2 — soumis à validation** |
| `scripts/planche_contact.py` | Planches de contact des couvertures et des pages intérieures, pour la revue visuelle de la direction | **Refonte V2 — soumis à validation** |
| `tests/test_design.py` | Garde-fous de la collection : marque, couvertures, composition, zones de réponse, documents d'appui, absence de fuite de correction | **Refonte V2 — soumis à validation** |
| `DESIGN_SYSTEM_NEXUS_DIAGNOSTICS.md` | Charte : palette, typographie, grille, règles de composition, couverture, zones, corrigés, profils | **Refonte V2 — soumis à validation** |
| `AUDIT_MODALITES_ET_DIAGNOSTICS.md` | Audit réglementaire par épreuve, blueprints par spécialité, écarts de couverture et leurs deux statuts | **Refonte V2 — soumis à validation** |
| `SECURITE.md` | Régime du dépôt : local, sans remote, clés dans la source | Porte 1 |
| `.gitignore` | Exclut `instruments/*/build/` et les fichiers de travail | Porte 1 |

Aucun référentiel, aucune banque d'items, aucun gabarit, aucun script ne préexiste.
Aucun `AGENTS.md` dans le dossier ni dans son parent immédiat ; un `AGENTS.md` global
existe dans `~/` (règles de méthode : validation des specs avant code, découpage en
étapes validées, TDD, vérification avant de déclarer terminé) — appliqué.
Le dossier n'était **pas** un dépôt Git à l'audit ; il l'est depuis la Porte 1 (décision A-06 :
branche `diagnostic/instruments`, un commit par porte, aucun remote).

## 1 bis. État calculé du dépôt

Les chiffres de cette section ne sont pas saisis : `scripts/etat_depot.py` les produit
depuis le dépôt, et `tests/test_etat_depot.py` échoue si ce fichier a dérivé. C'est la
réponse au constat de la consolidation : un README qui recopie des effectifs à la main
cesse d'être un état dès la porte suivante.

### Instruments

<!-- ETAT-CALCULE instruments début : produit par scripts/etat_depot.py, ne pas éditer -->
**20 instruments métier + 1 fixture technique.** Le périmètre du dispositif Nexus est celui des 20 instruments ci-dessous. S'y ajoute `_FIXTURE`, instrument fictif sur lequel les contrôles s'éprouvent : il est validé comme les autres et n'entre dans aucun décompte du dispositif. Un rapport qui additionnerait les deux nombres confondrait le dispositif et son banc d'essai.

| Instrument | Nature | Items en banque | Assemblages (items) | Durées cibles (min) | État de diffusion |
|---|---|---|---|---|---|
| `EDS-HGGSP` | banque + assemblages | 34 | N1 (24) · NT (31) | N1 75 · NT 90 | diffusable |
| `EDS-HLP` | banque + assemblages | 28 | N1 (21) · NT (28) | N1 75 · NT 90 | diffusable |
| `EDS-MATH` | banque + assemblages | 66 | N1 (33) · NT (44) | N1 75 · NT 90 | diffusable |
| `EDS-NSI` | banque + assemblages | 49 | N1 (30) · NT (33) | N1 75 · NT 90 | diffusable |
| `EDS-PC` | banque + assemblages | 44 | N1 (28) · NT (32) | N1 75 · NT 90 | diffusable |
| `EDS-SES` | banque + assemblages | 35 | N1 (25) · NT (26) | N1 75 · NT 90 | diffusable |
| `EDS-SVT` | banque + assemblages | 40 | N1 (29) · NT (33) | N1 75 · NT 90 | diffusable |
| `FR-EAF` | banque + assemblages | 52 | ecrit (34) · ecrit_2028 (34) · oral (29) · oral_2028 (29) · standard (42) · standard_2028 (42) | standard 90 · standard_2028 90 · ecrit 80 · ecrit_2028 80 · oral 50 · oral_2028 50 | diffusable |
| `FR-EAF-ORAL` | grille ou formulaire | — | — | standard 20 | diffusable |
| `FR-MAI` | banque + assemblages | 34 | standard (18) | standard 60 | diffusable |
| `FR-POS` | banque + assemblages | 23 | standard (23) | standard 45 | diffusable |
| `FR-POS-ORAL` | grille ou formulaire | — | — | standard 10 | diffusable |
| `GO` | grille ou formulaire | — | — | standard 15 | diffusable |
| `MATH-EA` | banque + assemblages | 44 | SPE (35) · SPECIFIQUES (36) | SPE 75 · SPECIFIQUES 75 | diffusable |
| `MET` | grille ou formulaire | — | — | standard 20 | diffusable |
| `PHI` | banque + assemblages | 36 | standard (23) | standard 60 | diffusable |
| `QP` | grille ou formulaire | — | — | standard 20 | diffusable |
| `TC-EMC` | grille ou formulaire | — | — | 1RE 20 · TLE 20 · ETENDUE 25 | diffusable |
| `TC-ES` | banque + assemblages | 34 | 1RE (20) · ETENDUE (30) · TLE (20) | 1RE 40 · TLE 40 · ETENDUE 55 | diffusable |
| `TC-HG` | banque + assemblages | 39 | 1RE (18) · ETENDUE (23) · TLE (18) | 1RE 45 · TLE 45 · ETENDUE 60 | diffusable |

**Instruments non diffusables à ce jour : 0**. Le statut est calculé par `scripts/diffusabilite.py` et vérifié par `V-Instruments` à chaque rendu de bilan : un instrument dont la source porte un emplacement réservé, un support sans édition ou une erreur de validation ne peut pas être imprimé, et un bilan de production qui s'en nourrit reste en attente.
<!-- ETAT-CALCULE instruments fin : produit par scripts/etat_depot.py, ne pas éditer -->

### Référentiels

<!-- ETAT-CALCULE referentiels début : produit par scripts/etat_depot.py, ne pas éditer -->
| Référentiel | Contenu |
|---|---|
| `competences.json` | 15 périmètres, 101 compétences, 205 chapitres, 36 écarts au Cahier |
| `catalogue_instruments.json` | 39 enregistrements instrument × version |
| `codes_erreur.json` | 161 codes |
| `termes_bloquants.json` | 21 expressions |
| `variables_qp.json` | 36 variables |
| `dimensions_met.json` | 4 dimensions, 12 niveaux |
<!-- ETAT-CALCULE referentiels fin : produit par scripts/etat_depot.py, ne pas éditer -->

### Tests

<!-- ETAT-CALCULE tests début : produit par scripts/etat_depot.py, ne pas éditer -->
| Fichier de test | Fonctions de test |
|---|---|
| `tests/test_audit_inventory.py` | 14 |
| `tests/test_audit_readme.py` | 15 |
| `tests/test_bilan.py` | 34 |
| `tests/test_bordereau_durees.py` | 3 |
| `tests/test_build_instrument.py` | 36 |
| `tests/test_calculatrice_coherence.py` | 5 |
| `tests/test_charge_q27.py` | 12 |
| `tests/test_contexte.py` | 23 |
| `tests/test_dates_anterieures.py` | 5 |
| `tests/test_design.py` | 39 |
| `tests/test_diffusabilite.py` | 17 |
| `tests/test_distribution.py` | 41 |
| `tests/test_dossier_entree_personnalise.py` | 7 |
| `tests/test_eligibilite.py` | 35 |
| `tests/test_espace_candidats.py` | 5 |
| `tests/test_etat_depot.py` | 13 |
| `tests/test_export_deterministe.py` | 9 |
| `tests/test_faits_candidat.py` | 8 |
| `tests/test_francais.py` | 15 |
| `tests/test_gate_profil.py` | 12 |
| `tests/test_go_duree.py` | 5 |
| `tests/test_hg_tle_documents.py` | 6 |
| `tests/test_intitules_versionnes.py` | 7 |
| `tests/test_maquette.py` | 36 |
| `tests/test_math_ea.py` | 21 |
| `tests/test_math_ea_expertise.py` | 54 |
| `tests/test_non_regression.py` | 6 |
| `tests/test_nsi_harnais.py` | 5 |
| `tests/test_p1_2026_2027.py` | 20 |
| `tests/test_pack_candidat.py` | 21 |
| `tests/test_pack_personnalisation.py` | 13 |
| `tests/test_passation.py` | 10 |
| `tests/test_passation_cas.py` | 6 |
| `tests/test_phi_attribution.py` | 3 |
| `tests/test_print_canonicalization.py` | 12 |
| `tests/test_profil_p1.py` | 14 |
| `tests/test_provenance.py` | 12 |
| `tests/test_regles_bilan.py` | 32 |
| `tests/test_release.py` | 11 |
| `tests/test_rendu_code.py` | 7 |
| `tests/test_sessions_fr_eaf.py` | 21 |
| `tests/test_textes_sources.py` | 21 |
| `tests/test_tronc_commun_et_positionnement.py` | 8 |
| `tests/test_validate_instrument.py` | 62 |
| `tests/test_validate_referentiel.py` | 30 |
| **total** | **791** |

Le nombre de cas exécutés est supérieur : les fonctions paramétrées comptent pour plusieurs.
<!-- ETAT-CALCULE tests fin : produit par scripts/etat_depot.py, ne pas éditer -->

### Tests ignorés

<!-- ETAT-CALCULE skips début : produit par scripts/etat_depot.py, ne pas éditer -->
| Mécanisme | Emplacement | Raison technique | Fonctionnalité concernée | Nécessaire à une passation réelle ? | Effet sur le statut de l'instrument |
|---|---|---|---|---|---|
| `pytest.skip` | `instruments/EDS-NSI/tests/conftest.py:24` | rendu.py absent du répertoire de travail | correction des tâches sur machine du bloc C de EDS-NSI (§ 7.8) | oui — le fichier est écrit par le candidat pendant l'épreuve, il n'existe pas dans le dépôt et n'y est jamais versionné | sans effet sur la diffusabilité : `tests/test_nsi_harnais.py` exécute le même harnais contre une solution de référence et contre une réponse fausse, et confronte le résultat au barème |
| `pytest.skip` | `tests/test_bilan.py:104` | aucun item fermé raté dans le jeu | mise en attente du bilan sur échec de V-Cohérence (§ 6.3) | non — garde-fou du test lui-même | sans effet : le jeu comporte des items ratés, le test s'exécute |
| `pytest.skip` | `tests/test_bordereau_durees.py:65` | release v2 non construite | contrôles de la collection sur les PDF de `release/diagnostics-v2/` | oui — ce sont les documents remis au candidat | sans effet ; le test s'exécute dès que `python3 scripts/release_v2.py` a tourné |
| `pytest.mark.skipif` | `tests/test_build_instrument.py:121` | pandoc ou xelatex absent | rendus PDF de build_instrument.py (arbitrage A-04) | oui | identique à « outils PDF absents » |
| `pytest.mark.skipif` | `tests/test_build_instrument.py:134` | pandoc ou xelatex absent | rendus PDF de build_instrument.py (arbitrage A-04) | oui | identique à « outils PDF absents » |
| `pytest.mark.skipif` | `tests/test_build_instrument.py:156` | outils PDF absents | rendus PDF de build_instrument.py (arbitrage A-04) | oui — les sujets sont imprimés depuis ces PDF | bloquant si les outils manquent ; pandoc et xelatex sont présents sur ce poste, ces tests s'exécutent |
| `pytest.mark.skipif` | `tests/test_build_instrument.py:164` | outils PDF absents | rendus PDF de build_instrument.py (arbitrage A-04) | oui — les sujets sont imprimés depuis ces PDF | bloquant si les outils manquent ; pandoc et xelatex sont présents sur ce poste, ces tests s'exécutent |
| `pytest.mark.skipif` | `tests/test_build_instrument.py:172` | outils PDF absents | rendus PDF de build_instrument.py (arbitrage A-04) | oui — les sujets sont imprimés depuis ces PDF | bloquant si les outils manquent ; pandoc et xelatex sont présents sur ce poste, ces tests s'exécutent |
| `pytest.mark.skipif` | `tests/test_build_instrument.py:184` | outils PDF absents | rendus PDF de build_instrument.py (arbitrage A-04) | oui — les sujets sont imprimés depuis ces PDF | bloquant si les outils manquent ; pandoc et xelatex sont présents sur ce poste, ces tests s'exécutent |
| `pytest.mark.skipif` | `tests/test_build_instrument.py:236` | outils PDF absents | rendus PDF de build_instrument.py (arbitrage A-04) | oui — les sujets sont imprimés depuis ces PDF | bloquant si les outils manquent ; pandoc et xelatex sont présents sur ce poste, ces tests s'exécutent |
| `pytest.mark.skipif` | `tests/test_build_instrument.py:322` | outils PDF absents | rendus PDF de build_instrument.py (arbitrage A-04) | oui — les sujets sont imprimés depuis ces PDF | bloquant si les outils manquent ; pandoc et xelatex sont présents sur ce poste, ces tests s'exécutent |
| `pytest.skip` | `tests/test_calculatrice_coherence.py:85` | release v2 non construite | contrôles de la collection sur les PDF de `release/diagnostics-v2/` | oui — ce sont les documents remis au candidat | sans effet ; le test s'exécute dès que `python3 scripts/release_v2.py` a tourné |
| `pytest.skip` | `tests/test_design.py:78` | outils PDF absents | rendus PDF de build_instrument.py (arbitrage A-04) | oui — les sujets sont imprimés depuis ces PDF | bloquant si les outils manquent ; pandoc et xelatex sont présents sur ce poste, ces tests s'exécutent |
| `pytest.skip` | `tests/test_design.py:211` | outils PDF absents | rendus PDF de build_instrument.py (arbitrage A-04) | oui — les sujets sont imprimés depuis ces PDF | bloquant si les outils manquent ; pandoc et xelatex sont présents sur ce poste, ces tests s'exécutent |
| `pytest.skip` | `tests/test_design.py:225` | outils PDF absents | rendus PDF de build_instrument.py (arbitrage A-04) | oui — les sujets sont imprimés depuis ces PDF | bloquant si les outils manquent ; pandoc et xelatex sont présents sur ce poste, ces tests s'exécutent |
| `pytest.skip` | `tests/test_design.py:391` | release non construite | contrôle d'unicité de la release sous `release/` | non — le contrôle porte sur le rangement, pas sur un instrument | sans effet ; le test s'exécute dès que `python3 scripts/release_v2.py` a tourné |
| `pytest.skip` | `tests/test_design.py:407` | release v2 non construite | contrôles de la collection sur les PDF de `release/diagnostics-v2/` | oui — ce sont les documents remis au candidat | sans effet ; le test s'exécute dès que `python3 scripts/release_v2.py` a tourné |
| `pytest.skip` | `tests/test_design.py:437` | release v2 non construite | contrôles de la collection sur les PDF de `release/diagnostics-v2/` | oui — ce sont les documents remis au candidat | sans effet ; le test s'exécute dès que `python3 scripts/release_v2.py` a tourné |
| `pytest.skip` | `tests/test_design.py:470` | release v2 non construite | contrôles de la collection sur les PDF de `release/diagnostics-v2/` | oui — ce sont les documents remis au candidat | sans effet ; le test s'exécute dès que `python3 scripts/release_v2.py` a tourné |
| `pytest.skip` | `tests/test_design.py:490` | release v2 non construite | contrôles de la collection sur les PDF de `release/diagnostics-v2/` | oui — ce sont les documents remis au candidat | sans effet ; le test s'exécute dès que `python3 scripts/release_v2.py` a tourné |
| `pytest.skip` | `tests/test_design.py:574` | release v2 non construite | contrôles de la collection sur les PDF de `release/diagnostics-v2/` | oui — ce sont les documents remis au candidat | sans effet ; le test s'exécute dès que `python3 scripts/release_v2.py` a tourné |
| `pytest.skip` | `tests/test_design.py:584` | release v2 non construite | contrôles de la collection sur les PDF de `release/diagnostics-v2/` | oui — ce sont les documents remis au candidat | sans effet ; le test s'exécute dès que `python3 scripts/release_v2.py` a tourné |
| `pytest.skip` | `tests/test_distribution.py:134` | outils PDF absents | rendus PDF de build_instrument.py (arbitrage A-04) | oui — les sujets sont imprimés depuis ces PDF | bloquant si les outils manquent ; pandoc et xelatex sont présents sur ce poste, ces tests s'exécutent |
| `pytest.skip` | `tests/test_distribution.py:145` | outils PDF absents | rendus PDF de build_instrument.py (arbitrage A-04) | oui — les sujets sont imprimés depuis ces PDF | bloquant si les outils manquent ; pandoc et xelatex sont présents sur ce poste, ces tests s'exécutent |
| `pytest.skip` | `tests/test_dossier_entree_personnalise.py:59` | release v2 non construite | contrôles de la collection sur les PDF de `release/diagnostics-v2/` | oui — ce sont les documents remis au candidat | sans effet ; le test s'exécute dès que `python3 scripts/release_v2.py` a tourné |
| `pytest.skip` | `tests/test_dossier_entree_personnalise.py:145` | release v2 non construite | contrôles de la collection sur les PDF de `release/diagnostics-v2/` | oui — ce sont les documents remis au candidat | sans effet ; le test s'exécute dès que `python3 scripts/release_v2.py` a tourné |
| `pytest.skip` | `tests/test_espace_candidats.py:39` | release v2 non construite | contrôles de la collection sur les PDF de `release/diagnostics-v2/` | oui — ce sont les documents remis au candidat | sans effet ; le test s'exécute dès que `python3 scripts/release_v2.py` a tourné |
| `pytest.skip` | `tests/test_export_deterministe.py:67` | release v2 non construite | contrôles de la collection sur les PDF de `release/diagnostics-v2/` | oui — ce sont les documents remis au candidat | sans effet ; le test s'exécute dès que `python3 scripts/release_v2.py` a tourné |
| `pytest.skip` | `tests/test_pack_candidat.py:391` | release v2 non construite | contrôles de la collection sur les PDF de `release/diagnostics-v2/` | oui — ce sont les documents remis au candidat | sans effet ; le test s'exécute dès que `python3 scripts/release_v2.py` a tourné |
| `pytest.skip` | `tests/test_pack_candidat.py:640` | release v2 non construite | contrôles de la collection sur les PDF de `release/diagnostics-v2/` | oui — ce sont les documents remis au candidat | sans effet ; le test s'exécute dès que `python3 scripts/release_v2.py` a tourné |
| `pytest.skip` | `tests/test_pack_candidat.py:711` | release v2 non construite | contrôles de la collection sur les PDF de `release/diagnostics-v2/` | oui — ce sont les documents remis au candidat | sans effet ; le test s'exécute dès que `python3 scripts/release_v2.py` a tourné |
| `pytest.skip` | `tests/test_pack_personnalisation.py:41` | release v2 non construite | contrôles de la collection sur les PDF de `release/diagnostics-v2/` | oui — ce sont les documents remis au candidat | sans effet ; le test s'exécute dès que `python3 scripts/release_v2.py` a tourné |
| `pytest.skip` | `tests/test_pack_personnalisation.py:53` | release v2 non construite | contrôles de la collection sur les PDF de `release/diagnostics-v2/` | oui — ce sont les documents remis au candidat | sans effet ; le test s'exécute dès que `python3 scripts/release_v2.py` a tourné |
| `pytest.skip` | `tests/test_phi_attribution.py:46` | release v2 non construite | contrôles de la collection sur les PDF de `release/diagnostics-v2/` | oui — ce sont les documents remis au candidat | sans effet ; le test s'exécute dès que `python3 scripts/release_v2.py` a tourné |
| `pytest.skip` | `tests/test_print_canonicalization.py:51` | release v2 non construite | contrôles de la collection sur les PDF de `release/diagnostics-v2/` | oui — ce sont les documents remis au candidat | sans effet ; le test s'exécute dès que `python3 scripts/release_v2.py` a tourné |
| `pytest.skip` | `tests/test_print_canonicalization.py:90` | release v2 non construite | contrôles de la collection sur les PDF de `release/diagnostics-v2/` | oui — ce sont les documents remis au candidat | sans effet ; le test s'exécute dès que `python3 scripts/release_v2.py` a tourné |
| `pytest.skip` | `tests/test_print_canonicalization.py:122` | release v2 non construite | contrôles de la collection sur les PDF de `release/diagnostics-v2/` | oui — ce sont les documents remis au candidat | sans effet ; le test s'exécute dès que `python3 scripts/release_v2.py` a tourné |
| `pytest.skip` | `tests/test_print_canonicalization.py:140` | release v2 non construite | contrôles de la collection sur les PDF de `release/diagnostics-v2/` | oui — ce sont les documents remis au candidat | sans effet ; le test s'exécute dès que `python3 scripts/release_v2.py` a tourné |
| `pytest.skip` | `tests/test_print_canonicalization.py:182` | release v2 non construite | contrôles de la collection sur les PDF de `release/diagnostics-v2/` | oui — ce sont les documents remis au candidat | sans effet ; le test s'exécute dès que `python3 scripts/release_v2.py` a tourné |
| `pytest.skip` | `tests/test_print_canonicalization.py:294` | release v2 non construite | contrôles de la collection sur les PDF de `release/diagnostics-v2/` | oui — ce sont les documents remis au candidat | sans effet ; le test s'exécute dès que `python3 scripts/release_v2.py` a tourné |
| `pytest.skip` | `tests/test_print_canonicalization.py:300` | release v2 non construite | contrôles de la collection sur les PDF de `release/diagnostics-v2/` | oui — ce sont les documents remis au candidat | sans effet ; le test s'exécute dès que `python3 scripts/release_v2.py` a tourné |
| `pytest.skip` | `tests/test_print_canonicalization.py:383` | release v2 non construite | contrôles de la collection sur les PDF de `release/diagnostics-v2/` | oui — ce sont les documents remis au candidat | sans effet ; le test s'exécute dès que `python3 scripts/release_v2.py` a tourné |
| `pytest.skip` | `tests/test_print_canonicalization.py:390` | release v2 non construite | contrôles de la collection sur les PDF de `release/diagnostics-v2/` | oui — ce sont les documents remis au candidat | sans effet ; le test s'exécute dès que `python3 scripts/release_v2.py` a tourné |
| `pytest.skip` | `tests/test_rendu_code.py:149` | release v2 non construite | contrôles de la collection sur les PDF de `release/diagnostics-v2/` | oui — ce sont les documents remis au candidat | sans effet ; le test s'exécute dès que `python3 scripts/release_v2.py` a tourné |

Un mécanisme non annoté fait échouer la production de ce tableau : un test qui ne s'exécute pas doit dire ce qu'il laisse non prouvé.
<!-- ETAT-CALCULE skips fin : produit par scripts/etat_depot.py, ne pas éditer -->

### Plan de passation

<!-- ETAT-CALCULE passation début : produit par scripts/etat_depot.py, ne pas éditer -->
Plafond du § 1.1 : **3 h 15** par demi-journée. QP et MET se passent à distance et ne comptent pas dans les demi-journées.

| Profil | Configuration française | Durée au centre | Demi-journées |
|---|---|---|---|
| P2 | aucune | 7 h 10 | 3 |
| P2 | ecrit | 8 h 30 | 3 |
| P2 | oral | 8 h 20 | 3 |
| P2 | les_deux | 9 h | 3 |
| P3 | les_deux | 9 h 30 | 3 |
<!-- ETAT-CALCULE passation fin : produit par scripts/etat_depot.py, ne pas éditer -->

## 2. Ce qui manque (périmètre total à produire)

### Référentiels

Tous produits. **Effectifs : § 1 bis, calculés** — ce paragraphe ne les recopie plus.

- [x] `referentiels/competences.json` — périmètres, compétences, chapitres, écarts au Cahier
- [x] `referentiels/codes_erreur.json` — catalogue fermé, ≥ 8 codes par périmètre
- [x] `referentiels/termes_bloquants.json` — expressions contextualisées ; la direction complète
- [x] `referentiels/catalogue_instruments.json` — enregistrements instrument × version, durées cibles du § 3.1
- [x] `referentiels/programmes_examen.json` — cartographie réglementaire par session (contre-expertise)

### Outillage
- [x] `scripts/validate_instrument.py` — 14 contrôles + 3 catégories de couverture
- [x] `scripts/build_instrument.py` — 4 rendus déterministes octet à octet, PDF compris
- [x] `instruments/_FIXTURE/` — instrument fictif, 2 versions, 18 items
- [x] `referentiels/regles_bilan.json` + `scripts/maquette_bilan.py` — moteur de bilan, seuils au référentiel
- [x] `scripts/bilan.py` — document remis, sept sections du § 8.1, contrôles du § 6.3

### Instruments (source unique `banque.json` + assemblages + `build/`)

**Deux périmètres, à ne pas confondre.** Le *périmètre du Cahier initial* compte **quinze
instruments**. Le *périmètre réglementaire corrigé* en compte **seize** : l'audit du 2026-09-10 a
établi qu'une épreuve anticipée de mathématiques est due à compter de la session 2027 (Q-24), et
**`MATH-EA` a été créé le même jour**, sur autorisation de la direction et après le passage du
gate réglementaire. Les seize sont produits. Effectifs, assemblages, durées et état de diffusion :
**§ 1 bis, calculé**. Les cinq instruments qui attendaient un texte — `FR-EAF`,
`FR-EAF-ORAL`, `FR-MAI`, `PHI`, `EDS-HLP` — l'ont reçu le 2026-09-11 (§ 4) : **les seize
sont diffusables**. `FR-ORAL` est retiré du dépôt depuis Q-20 et remplacé par
`FR-EAF-ORAL`.

## 3. Ce qui est produit dans cette session

**Rien avant validation de la Porte 1.** Ordre prévu (Cahier § 10, portes du prompt § 6) :

| Porte | Contenu | Statut |
|---|---|---|
| — | Audit du dossier, lecture du Cahier, `README_ETAT.md` | **fait** |
| — | Questions d'arbitrage de démarrage (§ 9) | **8 tranchées le 2026-09-10, 7 reportées aux portes concernées** |
| 1 | `referentiels/competences.json` + `validate_referentiel.py` + dépôt Git | **validée** |
| 1b | `codes_erreur.json`, `termes_bloquants.json`, `catalogue_instruments.json` + validateur étendu | **validée** |
| 1c | `validate_instrument.py`, `build_instrument.py`, fixture, 125 tests | **validée** |
| 2 | FR-EAF (à l'époque, FR-ORAL reporté en Porte 4 ; retiré depuis par Q-20) | **validée** — instrument non diffusable jusqu'à insertion des textes |
| 3 | EDS-MATH N1 et NT | **produite, clôturée — instrument terminé** |
| 4 | PHI, FR-MAI, GO, et FR-ORAL — ce dernier retiré depuis par Q-20 | **produite — GO terminé, PHI et FR-MAI non diffusables (textes à insérer)** |
| 5 | EDS-PC, EDS-SVT, EDS-SES | **validée, clôturée — les trois terminés** |
| 6 | EDS-NSI, EDS-HGGSP, EDS-HLP | **produite — NSI et HGGSP terminés, HLP « en cours »** |
| 7 | TC-ES, MET, QP | **produite — les trois terminés** |
| 8 | Moteur de bilan, maquettes v1 et v2, configurations du français, bilan de sortie, consolidation | **produite — soumise à validation** |

Étapes de la Porte 8, dans l'ordre : seuils du moteur portés au référentiel · maquette du bilan
sur candidat fictif · audit de la direction et maquette v2 · configurations du français (Q-19 à
Q-21) · calibration par le bloc 0 (R1, P1, P2) · bilan de sortie P3 et bilan court P2 ·
**consolidation** (Q-22, EC-27 repris, provenance des nombres, plan de passation, README
calculé) — § 5 decies.

## 4. Textes sources insérés

Cette section a porté, jusqu'au 2026-09-11, la liste des emplacements réservés
`[EXTRAIT À INSÉRER…]`. Il n'en reste aucun : les sept passages ont été transcrits depuis
des éditions publiques identifiées, confrontés page à page à leur fac-similé, mesurés dans
le PDF réellement produit, et enregistrés dans `referentiels/textes_sources.json`.

| Support | Texte | Édition | Mots | Lignes PDF | Spécification |
|---|---|---|---|---|---|
| `FR-EAF` bloc B — six assemblages, sessions 2027 et 2028 | La Boétie, *Discours de la servitude volontaire* | Bonnefon, Bossard, 1922 | 441 | 25 brutes / 25 pleines | 20 à 25 lignes ✓ |
| `FR-EAF` bloc C — `standard`, `ecrit` — session 2027 | Balzac, *La Peau de chagrin*, « Le Talisman » | Charpentier, 1839 | 265 | 17 brutes / 16 pleines | 15 à 20 lignes ✓ |
| `FR-EAF` bloc C — `standard_2028`, `ecrit_2028` — session 2028 | Zola, *Pot-Bouille*, chapitre I | G. Charpentier, 1883 | 326 | 23 brutes / 18 pleines | 15 à 20 lignes ✓ |
| `FR-EAF-ORAL` — extrait remis au candidat | Molière, *Le Misanthrope*, acte I scène 1 | Louandre, Charpentier, 1910 | 82 | 12 | 10 à 12 lignes ✓ |
| `FR-MAI` bloc B | Condorcet, *Sur l'instruction publique*, premier mémoire | Didot, 1847, tome 7 | 395 | 28 | 380 à 420 mots ✓ |
| `PHI` bloc C | Descartes, *Discours de la méthode*, première partie | Cousin, Levrault, 1824, tome I | 322 | 20 | 15 à 20 lignes ✓ |
| `EDS-HLP` bloc C — `N1` et `NT` | Montaigne, *Essais*, « De la vanité des paroles » | Musart, Périsse Frères, 1847 | 248 | 18 | 15 à 20 lignes ✓ |
| `FR-POS` bloc B | Enseignante de français, *Test de positionnement — Français scolaire* | Nexus Réussite, 2026 | 266 | 20 brutes / 15 pleines | 10 à 25 lignes ✓ |

**Le PDF fait foi, pas le compte de mots.** Chaque longueur ci-dessus a été mesurée sur le
PDF candidat produit par `scripts/build_instrument.py` dans le gabarit réel de son
instrument, et non sur une composition approchée.

**Ce que la fenêtre mesure.** Les longueurs sont données en lignes brutes du PDF et en
**lignes pleines équivalentes** : les lignes brutes diminuées des coupures de paragraphe de
l'édition. Chaque coupure coûte au plus une ligne partielle, et une ligne partielle
n'ajoute rien à lire. Mesurer les lignes brutes revenait à pénaliser la fidélité à
l'édition — rétablir les six paragraphes de *Pot-Bouille* (session 2028) ajoutait trois
lignes sans ajouter un mot.

Avant d'amender la règle, le reflow typographique a été mesuré sur le gabarit réel :
déclaration de la langue au moteur, marges portées à 1,8 cm puis à 1,6 cm. Aucun réglage
n'atteint 20 lignes brutes, et 1,6 cm n'est pas une marge d'impression acceptable pour un
sujet agrafé. La fenêtre n'est pas une exigence réglementaire — aucun texte applicable ne
fixe la longueur de l'extrait —, c'est une convention de conception destinée à borner la
charge de lecture. Elle est donc énoncée sur la grandeur qu'elle a toujours voulu borner,
définie dans `referentiels/textes_sources.json → mesure_de_longueur`, et **vérifiée** par
`scripts/textes_sources.py` : les sept passages la tiennent.

**Ce que la confrontation au fac-similé a trouvé.** Le niveau de relecture affiché par la
source ne dispense pas de comparer à l'image : six écarts ont été relevés et rétablis —
deux sur une page « corrigée », quatre sur des pages « validées » par deux contributeurs.

| Texte | Transcription en ligne | Fac-similé | Rétabli |
|---|---|---|---|
| Balzac | « siège » | « siége » | « siége » — graphie de 1839, modernisée en silence par la transcription |
| Balzac | *chagrin* en romain | *chagrin* en italique | l'italique, qui désigne l'objet et porte la description |
| Condorcet | « très réelle » | « très-réelle » | le trait d'union de l'édition Didot |
| Condorcet | « par lui-même et sans » | « par lui-même, et sans » | la virgule |
| Condorcet | intertitre fondu dans le texte courant | titre de section, centré et en italique | le titre comme titre — le texte courant ne dit pas « cette obligation » sans antécédent |
| Molière | « saurait » | « sauroit » | la finale en -oit de l'édition Louandre |

La page de l'édition Musart portant Montaigne est **non corrigée** sur sa source en ligne :
la transcription n'y valait donc pas vérification. Les deux images du fac-similé ont été
lues et comparées mot à mot ; aucun écart. Le même fac-similé établit que cette édition
numérote le chapitre **XX**, quand les éditions de référence modernes le placent au livre I,
chapitre LI : `referentiels/textes_sources.json` distingue le titre canonique
« De la vanité des paroles » de l'identification propre à cette édition.

**Aucun passage ne sert deux diagnostics.** `scripts/textes_sources.py` recalcule
l'empreinte de chaque support depuis les instruments, la confronte au registre, refuse deux
entrées de même empreinte et refuse qu'un même passage apparaisse dans deux instruments.
Le contrôle entre dans `validate_instrument.py --tous` : une collision arrête le build.

**Un emplacement réservé hors banque.** Le bilan de sortie porte `{{formule_nexus}}` en
section 7 (§ 8.1 : « tarif issu de la source de prix canonique, jamais recopié »). La source
de prix canonique n'est pas dans le dossier ; la plateforme substitue la formule et son tarif
à l'édition. Le contrôle V-Tarif refuse tout montant dans le rendu. Il ne concerne pas les
sujets de diagnostic.
## 4 bis. Diffusion — une seule source de vérité

`release/diagnostics-v2/` est **la** release. Rien d'autre ne se remet à un candidat.
Elle est décrite au § 4 ter, et produite par `python3 scripts/release_v2.py`.

L'ancienne façade `release/diagnostics-v1/` — 00_INDEX, packs de profil, 154 archives de
combinaisons — **n'existe plus**. Elle demandait au candidat de décompresser une archive
et à l'opérateur de choisir entre deux produits. Ce que faisait son script reste utile,
mais ce n'est plus un produit : `scripts/distribution.py` est désormais le **banc de
contrôle** de la chaîne — scan de fuite de correction sur le texte réellement extrait des
PDF, preflight d'imprimabilité, complétude des packs, recensement des doublons par
empreinte et par inode. Il écrit dans `build/controle-diffusion/`, hors de `release/`, et
ses sorties ne quittent pas le dépôt. Trente-neuf tests s'y adossent.

Les quatre tableaux restent versionnés — ce sont des index, pas des rendus :

| Fichier | Contenu |
|---|---|
| `DISTRIBUTION_MATRIX.csv` | une ligne par version d'instrument : niveau, matière, mode de remise, version courante, durée, empreinte |
| `STUDENT_PACK_MATRIX.csv` | une ligne par **classe d'équivalence de sélection** de l'espace d'états candidats valide (`faits_candidat.candidate_state_space`) : faits représentatifs, instruments, livrets, nombre d'états, durée, archive témoin du banc quand elle existe |
| `PRINT_MATRIX.csv` | une ligne par destinataire préparé : pack papier, archive NSI, prêt à envoyer, prêt à imprimer |
| `CANDIDATE_PROFILES.csv` | les profils du dépôt, anonymisés : diagnostics requis, documents prêts et manquants |

Ils sont recopiés dans `release/diagnostics-v2/04_INTERNE/` : l'opérateur qui ouvre la
release n'a pas à revenir dans le dépôt pour les lire.

**154 combinaisons ne sont pas 154 élèves.** Le dépôt ne porte aucune liste d'inscrits :
`PROFILE_COMBINATIONS = 154` est le catalogue des profils possibles, `ACTIVE_CANDIDATES = 0`
l'effectif réel. La combinatoire reste un contrôle interne ; elle n'est plus une
expérience utilisateur.

**Deux instruments ne s'envoient pas.** L'entretien oral de français et le Grand oral sont
menés par un coach avec une grille : leur `delivery_mode` vaut `COACH_INTERVIEW`. Ils
comptent dans les durées et n'ont pas de sujet composé pour le candidat. Fabriquer un PDF
pour eux serait fabriquer un document qui n'existe pas.

## 4 ter. La release — `release/diagnostics-v2/`

Ce que le candidat reçoit n'est plus une archive à décompresser : ce sont des livrets.

| Dossier | Ce qu'on y trouve |
|---|---|
| `00_GUIDE/` | `GUIDE_OPERATEUR.pdf`, la matrice des profils, la matrice des épreuves officielles, les planches de contact |
| `01_LIVRETS_CANDIDAT/` | `PROFIL_A_PREMIERE_PARTIE/`, `PROFIL_B_DEUXIEME_PARTIE/`, `PROFIL_C_BAC_EN_UNE_SESSION/` — un PDF par matière, plus le dossier d'entrée |
| `02_CORRECTIONS_COACH/` | le corrigé de chaque livret, même arborescence, couverture bordeaux, `CONFIDENTIEL` en pied de chaque page |
| `03_IMPRESSION/` | un PDF par profil, assemblé depuis les mêmes livrets, intercalaire avant chaque matière et signets |
| `04_INTERNE/` | matériel NSI sur machine, tableaux techniques, manifeste — jamais remis à une famille |

**36 livrets distincts couvrent 1 027 combinaisons.** Le nombre de fichiers ne suit plus le
nombre de combinaisons possibles : un livret de mathématiques de profil A est le même quels
que soient les autres enseignements du candidat. Les 154 archives de la V1 étaient une
expérience utilisateur, pas un catalogue ; le catalogue, ce sont les livrets.

**Le candidat ne voit aucun code technique.** Ni `N1`, ni `NT`, ni `SPECIFIQUES`, ni
`ETENDUE`, ni `standard_2028`. Les trois profils portent leur nom : *Première partie du
baccalauréat*, *Deuxième partie du baccalauréat*, *Baccalauréat complet en une session*.
Le code de version figure en 7,5 pt gris au pied de la couverture, pour l'administration.

**`ACTIVE_CANDIDATES = 0` reste vrai.** Aucun pack nominatif n'est fabriqué : les livrets
sont canoniques, et un dossier `CANDIDAT_<REF>/` ne se crée que lorsqu'un candidat réel
existe.

## 5. Arbitrages actés par la direction (2026-09-10)

| # | Objet | Décision |
|---|---|---|
| A-01 | Session visée | **Session finale 2027**, précisée par le modèle à trois axes du 2026-09-10 : session finale, année scolaire de passation des épreuves anticipées, mode de passation. Le programme d'œuvres de la session 2027 (NOR MENE2418442N) est **vérifié et porté par `referentiels/programmes_examen.json`** ; seuls les passages à transcrire restent des emplacements réservés. |
| A-02 | Compétences de production à item unique | **Complétées par des items A/B en bloc D** jusqu'à 3 items sur 2 paliers. Aucune règle du Cahier n'est modifiée. Tracé sous `ecarts_cahier` → `EC-01`. |
| A-03 | Format d'identifiant | **Niveau 2/1/T pour les périmètres adossés à un programme ; jeton de périmètre (EAF, MAI) pour le français.** Tracé sous `conventions.item_id`. |
| A-04 | Format des rendus | **Markdown source + PDF généré par script.** `xelatex`, `pdflatex` et `weasyprint` sont disponibles sur le poste. |
| A-05 | Calculatrice (Q-05) | **Bloc C uniquement**, mode examen, sans programme ni mémoire accessible. Consigne identique en MATH et PC. Blocs A, B et D sans calculatrice : ils mesurent des automatismes et des ordres de grandeur. |
| A-06 | Dépôt Git (Q-07) | **`git init`, branche `diagnostic/instruments`, un commit par porte** (message = titre de la porte), aucun `git add -A`, **aucun remote**. Les clés restent dans la source versionnée ; seul `build/` est exclu. Voir `SECURITE.md`. |
| A-07 | Termes bloquants (Q-15) | **Expressions contextualisées**, jamais de mots isolés. Chaque entrée porte `motif`, `contexte_interdit` et `exceptions_domaine` ; le validateur affiche 60 caractères de contexte de part et d'autre. Toute exception ajoutée est listée dans le rapport de la porte. |
| A-08 | Périmètre V1 (Q-09) | **HG, LV et EMC hors périmètre.** Aucun code de compétence créé pour ces matières, pas même vide. |
| A-09 | Compétences sans items (Q-12) | Statut **`indicateur_transversal`** : FR-MAI/ORAL (`evaluee_par: GO`) et HLP/LANG (`evaluee_par: criteres_C`, `code_critere: LANG`). Exclues de la règle 3 items / 2 paliers, soumises à un minimum de 2 sources. |
| A-10 | États de compétence | **`hors_version`** (référentiel : hors programme du niveau, absente du bilan) distingué de **`non_evaluee`** (moteur § 5.2 : moins de 3 items renseignés). Une compétence `hors_version` n'est jamais rendue « Non évaluée ». |

## 7. Dossiers réglementaires ouverts

Deux questions bloquent la suite : elles portent sur ce que le candidat **doit** présenter,
et aucune n'est tranchable dans le dépôt. La cartographie est portée par
`referentiels/programmes_examen.json` ; les points marqués `a_confirmer` attendent la
lecture du Journal officiel par la direction, `legifrance.gouv.fr` refusant la récupération
automatisée.

### Q-24 — épreuve anticipée de mathématiques, session 2027

Textes : décret n° 2025-513 et arrêté du 10 juin 2025 (NOR MENE2508110A) · notes de service
du 10-6-2025 NOR MENE2515469N (épreuve) et MENE2516240N (automatismes évaluables) · arrêté
du 16 juillet 2018 relatif aux épreuves anticipées, version en vigueur depuis le 1er
septembre 2025 · note de service du 25 août 2025, NOR MENE2523745N (situations
particulières).

Épreuve : **2 h, coefficient 2, calculatrice interdite**, notée sur 20 — QCM d'automatismes
sur 6 points, puis deux ou trois exercices sur 14. Elle s'applique « à compter de l'année
scolaire 2025-2026, pour les épreuves présentées au titre de la session 2027 ». **Trois
sujets distincts**, et non deux : spécialité mathématiques de la voie générale ;
mathématiques spécifiques intégrées à l'enseignement scientifique de la voie générale ;
mathématiques du tronc commun de la voie technologique.

| Situation candidat | Session précédente | Maths anticipées déjà présentées ? | Note conservable ? | Dispense ? | À présenter en 2027 ? | Fondement |
|---|---|---|---|---|---|---|
| En première 2025-2026, **avec** spécialité mathématiques | aucune | non | sans objet | non | **oui — sujet spécialité** | MENE2515469N |
| En première 2025-2026, **sans** spécialité mathématiques | aucune | non | sans objet | non | **oui — sujet mathématiques spécifiques** | MENE2515469N |
| A échoué au baccalauréat à la **session 2026** | 2026, échec | non — l'épreuve n'existait pas | sans objet | **oui** | **non** | arrêté du 10 juin 2025, art. 17 · `a_confirmer` |
| Scolarité aménagée par le recteur, entré en terminale **avant la rentrée 2026** | variable | non | sans objet | **oui**, pour la session du jury et, en cas d'échec, la suivante | **non** | art. 17 · `a_confirmer` |
| A résidé temporairement à l'étranger après avoir présenté les épreuves anticipées en **2024-2025** | 2024-2025 à l'étranger | non | sans objet | **oui**, pour l'une des deux sessions suivantes | **non** | art. 17 · `a_confirmer` |
| Redoublant de première en 2026-2027, ayant présenté les épreuves anticipées en juin 2026 | 2026-2027 | **oui** | non — les nouvelles notes remplacent les précédentes | non | **oui**, il les représente | arrêté du 16 juillet 2018, **art. 2** — corrigé le 2026-09-10, la version en vigueur ne porte pas cette règle à l'article 4 |
| Régulièrement inscrit, empêché de subir l'épreuve | — | non | **oui**, pour la session suivante | sans objet | selon conservation | art. 5 · `a_confirmer` |
| A présenté l'épreuve en juin 2026 et échoue à la session 2027 | 2027, échec | oui | **oui si ≥ 10/20**, cinq sessions | non | **non si la note est conservée** | D334-13 · MENE2523745N · `a_confirmer` |
| **P3 — si et seulement si éligible au passage de toutes les épreuves à la même session (Q-26)** | aucune | non | sans objet | non | **oui**, à la même session que les épreuves terminales, sujet selon la spécialité déclarée | arrêté du 16 juillet 2018, art. 3 · MENE2515469N |
| P3 demandé mais **non éligible** (Q-26) | — | — | — | — | le profil P3 est interdit : parcours P1 puis P2 sur deux sessions | art. 3 |

**Architecture — créée le 2026-09-10.** L'instrument dédié **`MATH-EA`** existe, avec deux
assemblages pour la voie générale : **`SPE`** (enseignement de spécialité de mathématiques) et
**`SPECIFIQUES`** (mathématiques intégrées à l'enseignement scientifique). Aucun assemblage
technologique : le périmètre V1 est le baccalauréat général. Détail au § 5 quindecies.

**Ce qui n'est pas fait :** la variable `maths_anticipees_a_presenter` n'existe pas et n'a pas
lieu d'exister sous cette forme — le statut est **dérivé** des faits par `scripts/contexte.py`
(point J). Reste à décider l'entrée au questionnaire des faits que cette dérivation exige :
dispense transitoire, épreuve déjà présentée, conservation demandée.

**Le gate de l'article 3 ne porte plus sur un instrument** (2026-09-11). Il était vérifié dans
la sélection de MATH-EA : un candidat dont le passage en une seule session n'était pas établi
perdait l'épreuve anticipée de mathématiques et gardait tout le reste. Il porte désormais le
profil entier, en amont de toute dérivation — `eligibilite.statut_profil`, appelé une fois par
`maquette_donnees.liste_effective_des_instruments_a_passer`.

### Q-26 — éligibilité au passage de toutes les épreuves à la même session

Le profil P3 du Cahier — épreuves anticipées et terminales à la même session — n'est pas un
choix du candidat. L'article 3 de l'arrêté du 16 juillet 2018 énumère les situations qui
l'autorisent, sous réserve de n'avoir pas présenté les épreuves anticipées l'année
précédente. `scripts/eligibilite.py` évalue la matrice du référentiel et rend trois verdicts.

| Critère | Situation | Droit | Pièce qui l'établit |
|---|---|---|---|
| `AGE-20` | Au moins vingt ans au 31 décembre de l'année de l'examen | **oui** | pièce d'identité |
| `ENFANT` | Enfant à charge au moment de l'inscription | **oui** | justificatif de charge d'enfant |
| `RETOUR` | Retour en formation initiale | **oui** | attestation de reprise d'études |
| `FORCE-MAJEURE` | Empêchement constaté, force majeure | **conditionnelle** | décision administrative |
| `ETRANGER-TEMPORAIRE` | Résidence temporaire à l'étranger au niveau de la première | **oui** | justificatif de résidence |
| `ETRANGER-PERMANENT-SANS-CENTRE` | Résidence permanente dans un pays sans centre d'examen | **oui** | *aucune pièce du candidat ne l'établit* |
| `ETRANGER-PERMANENT-CENTRE-ELOIGNE` | Résidence permanente, centre trop éloigné | **conditionnelle** | décision administrative |
| `ECHEC-ANTERIEUR` | Échec antérieur au baccalauréat | **oui** | relevé de notes de la session antérieure |
| `EA-SANS-INSCRIPTION-SUIVANTE` | Épreuves anticipées présentées puis absence d'inscription | **oui** | relevé de notes de la session antérieure |
| `TITULAIRE-DIPLOME-FR` | Titulaire d'un diplôme français de la liste réglementaire | **oui** | diplôme |
| `TITULAIRE-DIPLOME-ETRANGER` | Diplôme étranger à reconnaître comme comparable | **conditionnelle** | décision administrative |
| `CHANGEMENT-VOIE-TERMINALE` | Changement de voie ou de série en terminale | **oui** | attestation de scolarité |

À défaut de tout critère : **non**. Le profil P3 est alors interdit et le candidat suit le
parcours P1 puis P2 sur deux sessions.

**Le droit et la preuve sont deux dimensions**, et les confondre revenait à traiter une pièce
non encore produite comme une incertitude juridique. `eligibilite_reglementaire` dit si une
catégorie de l'article 3 couvre la situation ; `statut_verification` dit ce qu'il reste à
produire. Le passage en une seule session n'est autorisé que si le droit vaut « oui » **et** la
vérification « verifie ».

**Un fait déclaré n'est pas un fait vérifié** (2026-09-11). Aucun critère n'est plus « verifie »
d'emblée : chacun nomme la pièce qui l'établit, et le statut ne s'élève que lorsque cette pièce
figure au dossier. Deux conséquences en découlent. Une situation soumise à appréciation —
force majeure, éloignement du centre, comparabilité d'un diplôme étranger — reste
« decision_administrative_requise » quelles que soient les pièces produites. Et l'absence de
centre d'examen dans un pays est un **fait administratif**, qu'aucune pièce détenue par le
candidat n'établit : la liste officielle des centres ouverts à l'étranger est absente du dépôt,
le critère reste donc indéfiniment à vérifier, et le référentiel dit pourquoi.

**Trois statuts de profil, en amont de tout instrument.** `P3_OUVERT` (droit établi, pièce au
dossier), `P3_EN_ATTENTE_DE_VERIFICATION` (droit établi ou conditionnel, preuve à faire),
`P3_NON_OUVERT` (aucune catégorie de l'article 3). Hors du mode « même session », le statut est
« sans objet » : l'article 3 ne s'applique pas à une passation par anticipation. Quand le profil
n'est pas ouvert, **aucun** instrument n'est dérivé, et aucun plan de passation ne se construit.

**Rien n'est branché sur le questionnaire.** Les variables de l'article 3 sont proposées, pas
créées ; un test refuse leur entrée au formulaire tant que la direction ne l'a pas décidée. Les
jeux de maquette les portent dans leur `qp.json` pour exercer la règle avant son branchement,
et les jeux P2 et P3 portent leur pièce justificative : ils franchissent le gate pour de bon,
sans user de la porte de simulation que le mode de rendu « maquette » ouvre.

<!-- HISTORIQUE début : phrases datées, citées comme telles -->

## Historique des décisions et des audits

*Tout ce qui suit, jusqu'au registre des questions, est un journal daté : ces sections disent ce qui a été décidé à une date, non ce qui est vrai aujourd'hui. Elles peuvent citer un nom retiré depuis, un effectif d'alors ou une règle amendée. L'état courant est aux sections 1 à 5 et 8 à 10.*

## 5 quatervicies. Fermeture des huit bloqueurs d'acceptation (2026-09-12)

L'audit d'acceptation en lecture seule a conclu `READY_FOR_CANDIDATES=NO` et nommé huit
bloqueurs. Ils sont fermés à la source, et la release a été reconstruite de zéro.

**Quatre situations réglementaires n'avaient aucun document.** `nom_livret()` ignorait la
variante : deux livrets différents écrivaient le même chemin et le dernier composé
effaçait le premier. Un candidat de première **sans** spécialité mathématiques aurait reçu
un livret contenant une spécialité qu'il ne suit pas ; un candidat qui ne doit que l'oral
de français aurait reçu l'écrit. L'identité d'un artefact dépend désormais du profil, de
la matière **et** de la variante ; la construction s'arrête sur une collision de chemin.
Les noms restent humains : `MATHEMATIQUES_SANS_SPECIALITE`, `FRANCAIS_ORAL_SEUL`.

**Le manifeste attestait un contenu qui n'existait pas.** Huit entrées partageaient trois
chemins et portaient toutes l'empreinte du dernier fichier écrit — c'est ce qui masquait la
collision. Le nouveau manifeste part des fichiers réellement présents, porte le commit
source, décrit **tout** ce que la release contient sauf lui-même et sa projection lisible,
et refuse d'écrire sur un `artifact_id` ou un chemin en double.

**Le banc de contrôle ressemblait encore à une release.** Sous `build/controle-diffusion/`
subsistaient `01_A_ENVOYER_AUX_CANDIDATS/` et des `PACK_DIAGNOSTIC_CANDIDAT.pdf` en
ancienne charte : le renommage de la racine n'avait pas suffi. Les éprouvettes s'appellent
maintenant ce qu'elles sont — `audit-fixtures/`, `preflight/`, `ASSEMBLAGE_AUDIT.pdf` — et
un test refuse tout chemin sous `build/` qui pourrait passer pour un envoi.

**Le livret de NSI faisait travailler l'épreuve dont il annonçait la dispense.** Page 2 :
« vous en êtes dispensé » ; question 32 : « sur la machine du centre, ouvrez `rendu.py` ».
Les deux items de la partie pratique sont déclarés au référentiel et ne sont plus imprimés.
La programmation reste diagnostiquée à l'écrit — analyse de code, correction, méthode — et
le matériel machine devient `COMPLEMENT_OPTIONNEL_NSI_PRATIQUE`, facultatif et nommé comme
tel dans le livret.

**Le balisage Markdown s'imprimait.** Douze livrets portaient `**plan détaillé**` avec ses
astérisques. `tex()` rend désormais le gras, l'italique, le code et les puces ; un contrôle
preflight refuse toute astérisque, tout titre et tout lien Markdown restés bruts.

**Le livret de français était une concaténation.** Deux « Partie 1 », deux « Partie 2 ». Il
a maintenant une hiérarchie — `MODULE A — Diagnostic de l'écrit`, `MODULE B — Diagnostic de
l'oral` — et une numérotation qui court d'un bout à l'autre.

**Le Grand oral n'avait aucune tâche** et écrivait pourtant « répondez à toutes les
questions sur ce livret ». Il porte désormais le protocole réel : les deux questions que le
candidat apporte, celle que le coach retient, la préparation en cinq zones — problématique,
connaissances, plan, arguments, conclusion —, le déroulé de la passation et un repère de
l'épreuve officielle. La page d'accueil ne promet plus de zones là où il n'y en a pas.

**Deux défauts trouvés en corrigeant les autres.** Les livrets se composant en parallèle
partageaient le cache de figures : un processus embarquait une figure à demi écrite et
rendait un PDF tronqué que rien ne signalait. Les figures s'écrivent à côté puis se
renomment, et la composition vérifie que le PDF produit est lisible avant de le déposer.
La police italique d'EB Garamond était servie en WOFF, que le pilote de sortie ne sait pas
embarquer : les faces de la serif sont désormais épinglées par fichier.

## 5 tervicies. Une seule source de vérité (2026-09-11)

Deux façades cohabitaient sous `release/` : `diagnostics-v1`, ses 154 archives et ses
packs de profil, et `diagnostics-v2`. Un opérateur devait deviner laquelle faisait foi.

`release/` ne contient plus que `diagnostics-v2`. L'ancienne façade est supprimée, et
`scripts/distribution.py` n'est plus un producteur de documents candidats : c'est le banc
de contrôle de la chaîne — scan de fuite de correction sur le texte réellement extrait des
PDF, preflight d'imprimabilité, complétude, doublons par empreinte et par inode. Il écrit
dans `build/controle-diffusion/`, hors de `release/`. Les trente-neuf tests qui s'y
adossent sont conservés : ce sont eux qui refusent qu'un corrigé entre dans un pack.

`RELEASE_DIAGNOSTICS_V1.json` devient `MANIFESTE_DEPOT.json`. Il n'a jamais décrit la
façade V1 : il décrit le dépôt — instruments, empreintes, textes sources, critère de fin.
Son nom, à côté de `diagnostics-v2`, faisait croire à deux releases concurrentes. Son
champ `version` nomme désormais la release courante.

Trois tests gardent ce rangement : `release/` ne porte qu'un dossier, le banc de contrôle
n'est pas rangé sous `release/`, et les quatre tableaux d'envoi voyagent dans
`04_INTERNE/` — l'opérateur qui ouvre la release n'a pas à revenir dans le dépôt.

## 5 quatervicies. Exports candidats dérivés, source unique (2026-09-13)

```text
CANONICAL_DISTRIBUTION_ROOT = release/diagnostics-v2
CANDIDATE_EXPORTS_ARE_DERIVED = YES
```

`release/diagnostics-v2/` reste l'unique source canonique de distribution : des PDF
génériques, sans aucun nom réel, décrits par `04_INTERNE/MANIFESTE_V2.json` (empreinte de
chaque fichier, commit source `source_git_head` égal au commit source `HEAD^` du commit de
release). Les packs nominatifs de `exports_candidats/` sont des **sorties dérivées** de cette
release par `scripts/pack_candidat.py` : la couverture reçoit le nom et la session, rien
d'autre ne change, et aucun export ne se corrige à la main. Une correction passe par la
source, la reconstruction de la release, puis la regénération de l'export.

Le dossier d'export est déterministe : `<SLUG_NOM>__<ID_CANDIDAT>__BAC<SESSION>` (sans nom,
`<ID_CANDIDAT>__BAC<SESSION>`). Le slug garde les lettres lisibles, remplace les espaces par
`_` et retire les caractères interdits ; l'identifiant est toujours présent, deux homonymes
ne se recouvrent donc pas. Regénérer la même personne ne crée plus de dossier horodaté : le
pack se construit dans un chantier voisin, est validé (bordereaux, livrets attendus,
couvertures nominatives, pack d'impression), puis remplace l'export précédent. Un échec
laisse l'export validé intact. `tests/test_export_deterministe.py` garde ces règles ;
`exports_candidats/` reste hors Git et aucun chemin versionné ne porte de nom.

## 5 duovicies. Refonte produit — `diagnostics-v2` (2026-09-11)

La direction a retiré `DIAGNOSTICS_GO_LIVE_READY=YES`. Le moteur n'était pas en cause :
ce qui partait au candidat n'était pas un produit. Cette section dit ce qui a changé, et
ce qui ne pouvait pas être réglé par une mise en page.

**Le candidat reçoit un document par matière, et non quatre fichiers par instrument.**
`sujet_candidat.pdf` et `feuille_reponses.pdf` n'existent plus comme envois séparés : un
livret autonome porte la couverture, la page « avant de commencer », les questions, les
documents et les zones de réponse. Deux regroupements sont éditoriaux et le restent —
le français réunit l'écrit et la composante orale, les mathématiques réunissent l'épreuve
anticipée et la spécialité quand le candidat suit les deux. **Les périmètres du moteur ne
bougent pas** : le regroupement est un fait d'édition, pas de mesure.

**Les faits réglementaires ne sont plus écrits à la main.** `referentiels/modalites_epreuves.json`
porte, pour chaque épreuve, l'intitulé officiel, la durée, le coefficient, la structure, le
matériel, la calculatrice, la dispense de partie pratique, la source et son NOR. Les
couvertures et les pages d'accueil le lisent. Un test refuse toute durée ou tout
coefficient écrit en dur dans le script de couverture.

**Trois écarts pédagogiques trouvés par l'audit, et corrigés.**

1. *Le Grand oral ne mesurait pas ce que l'épreuve pèse* : les deux questions apportées par
   le candidat étaient fournies par le diagnostic. Trois critères ajoutés — `QUEST`,
   `DISCIP`, `ARGU` — déroulé revu, fenêtre « trois à cinq critères » passée au référentiel
   avec son exception motivée. Dix-neuf mesures ont bougé, toutes attribuables au Grand oral
   et à l'oral de `FR-MAI`, et le relevé de non-régression le montre.
2. *Les documents d'appui n'étaient composés nulle part* : trente et un tableaux et figures
   de la banque — SES, SVT, HGGSP, physique-chimie, `MATH-EA` — n'entraient dans aucun
   rendu du livret. Le candidat lisait « d'après le tableau ci-dessus » sans tableau. Ils
   sont maintenant imprimés avec leur question, au-dessus ou au-dessous selon ce que
   l'énoncé annonce, et rappelés plutôt que réimprimés quand ils resservent.
3. *Les zones de réponse ne mesuraient pas ce qu'on demandait d'écrire* : six lignes sous
   « expliquez en une vingtaine de lignes ». La hauteur se lit désormais dans l'énoncé —
   « une quinzaine de lignes », « dix à douze lignes », « en 80 mots » — et retombe sur le
   barème à défaut. Le renvoi au cahier de composition disparaît : tout s'écrit dans le
   livret.

**Une seconde fuite, dans le premier document que le candidat ouvre.** Le dossier
d'entrée était un assemblage : une page de garde Nexus, puis les deux formulaires de
secours composés par l'ancienne chaîne. Le formulaire de méthodes de travail se termine
par une section « Dépouillement — réservé au coach », avec sa méthode et le renvoi aux
seuils : elle partait au candidat. Le dossier est désormais **composé**, sur le gabarit de
la collection, depuis les sources des formulaires, et sans rien qui appartienne au
correcteur. Deux motifs de plus entrent dans le test de fuite : les sections réservées au
correcteur, et les chemins de fichiers du dépôt.

**Une fuite réelle de correction, trouvée par le test de la collection.** La grille
d'évaluation du coach était composée dans le livret **candidat** de français : le
générateur appelait la grille dès qu'un instrument portait une `definition.json`, sans
regarder s'il composait pour le candidat ou pour le correcteur. Séparé en deux fonctions.
Le livret candidat porte l'extrait et la question ; la grille reste au correcteur.

**Le trou de couverture réglementaire est nommé, pas masqué.** Les évaluations ponctuelles
du candidat individuel pèsent 40 points de coefficient ; Nexus en couvre 14. Histoire-
géographie, LVA, LVB, EMC et EPS ne sont couvertes par aucun instrument. Deux statuts
distincts sont donc tenus — `DIAGNOSTICS_NEXUS_SUPPORTED_COMPLETE` et
`REGULATORY_BAC_COVERAGE_COMPLETE` — et la matrice opérateur écrit
`NON COUVERT PAR LE DISPOSITIF NEXUS` en toutes lettres. Aucune complétude n'est déclarée.

**Ce qui n'a pas été fait, et pourquoi.** `mode_evaluations_ponctuelles` — annuelle ou fin
de cycle — reste déduit du profil, ce qui est vrai dans le cas fréquent et faux en général.
La corriger touche la dérivation des instruments, donc ce que chaque candidat reçoit :
c'est écrit dans `APRES_LIVRAISON.md`, à faire dans un commit séparé.

## 5 unvicies. Go-live opérationnel (2026-09-11)

**Le blocage signalé n'en était pas un, mais il en cachait un.** Les packs de première
portaient `FRANCAIS-EAF_STANDARD-2028`. La sélection était juste — un élève de première en
2026-2027 passe l'épreuve au titre de la session finale 2028 — mais le nom se lisait
« pour 2028 » et disait l'inverse de ce qu'il désignait. Le mapping est conservé ; le nom
dit maintenant l'année de première, celle que l'opérateur connaît de son élève. Le
catalogue marque `_COURANT` le programme applicable.

**Trois libellés trompeurs corrigés.** `sans-francais` devient `EAF-non-requise` : le
candidat concerné reçoit toujours le diagnostic de maîtrise du français, qui mesure la
langue comme outil de travail et non comme objet d'examen. Les entretiens — oral de
français, Grand oral — portent un `delivery_mode` explicite au lieu d'apparaître comme des
instruments sans sujet. Et le questionnaire de parcours n'est plus rangé parmi les
documents du correcteur.

**Deux mille quatre cent trente et un fichiers deviennent deux cent quatre-vingt-six.**
L'ancienne façade répétait le même contenu cent cinquante-quatre fois. Chaque combinaison
est désormais une archive contenant un mode d'emploi, **un seul PDF** — les sujets et les
feuilles de réponses fusionnés dans l'ordre de composition, avec signets — et l'archive NSI
s'il y a lieu. Le recensement des doublons est fait par empreinte et par inode, non par
nom : 0 doublon inattendu, 0 collision de version.

**Trois doublons réels trouvés et supprimés** : deux profils de référence de même
composition bâtissaient deux fois le même pack, et le mode d'emploi NSI existait en deux
exemplaires. Ils pointent maintenant sur un exemplaire unique.

**Le fail-closed porte sur la fusion.** Scanner les sujets un à un ne suffisait pas : c'est
le document fusionné qui part. Il est scanné avant d'être archivé, et une contre-épreuve
glisse un corrigé dans un pack pour vérifier que la construction s'arrête.

**Ce qui n'a pas été fait, et pourquoi.** Les jeux `_FIXTURE` et `_MAQUETTE*` restent dans
`instruments/` : leurs chemins sont écrits dans une quinzaine de scripts et de tests, et
les déplacer la veille d'une diffusion risquerait la chaîne qui produit les sujets pour un
gain invisible du destinataire. Le déplacement est décrit dans `APRES_LIVRAISON.md`, à
faire dans un commit séparé après diffusion.

## 5 vicies. Packs de diffusion — livraison V1 (2026-09-11)

**Ce que la passe a fait.** La release est devenue une arborescence d'envoi. 16 instruments,
31 versions, 29 sujets candidats, 29 documents correcteur, 154 packs de profil couvrant les
trois profils, les sept spécialités et les quatre configurations de français. Trois tableaux
disent quoi envoyer : `DISTRIBUTION_MATRIX.csv`, `STUDENT_PACK_MATRIX.csv`,
`CANDIDATE_PROFILES.csv`. Le détail est au § 4 bis.

**Les vingt-trois tests ignorés.** Vingt-deux étaient les tests des tâches NSI sur machine,
collectés par le dépôt alors qu'ils ne peuvent s'exécuter que dans le répertoire de travail
d'un candidat, contre le `rendu.py` qu'il écrit. Ils ne prouvaient rien et masquaient les
autres. `pytest.ini` restreint la collecte par défaut à `tests/` : ils ne sont ni supprimés
ni désactivés, et `tests/test_nsi_harnais.py` continue de les exécuter pour de bon, contre
une solution de référence puis contre une réponse fausse. Le vingt-troisième — le
dépassement du plafond horaire du § 8.2 — était un test valide que le jeu n'exerçait jamais :
il abaisse désormais les heures déclarées sur une copie, et une contre-épreuve vérifie le
cas inverse. **Zéro test ignoré.**

**Quatre défauts trouvés en préparant les envois.**

| Défaut | Conséquence évitée |
|---|---|
| Le compositeur n'a jamais su que les documents étaient en français | Coupure des mots aux règles anglaises ; « l'intersection » sortait de onze points de la justification dans le corrigé de MATH-EA. `polyglossia` en français est désormais chargé pour tous les rendus. |
| Les questionnaires `QP` et `MET` étaient classés « document correcteur » | Ils sont remplis par le candidat : les packs partaient sans eux, et aucun bilan n'est interprétable sans le questionnaire de parcours. |
| Le README NSI copié dans le dossier candidat était celui du correcteur | Il portait le barème des tâches sur machine. Le candidat reçoit désormais un mode d'emploi écrit pour lui. |
| Un code d'erreur, son libellé et sa description tenaient sur une ligne | La ligne débordait de la justification et le correcteur cherchait le code au milieu du texte. Le code et son libellé passent en tête, la description dessous. |

**Ce que le script refuse.** Aucun corrigé dans un dossier candidat ; aucun élément de
correction dans le texte extrait d'un document candidat ; aucun PDF qui échoue au preflight
— page blanche accidentelle, glyphe manquant, commande du compositeur imprimée, police non
embarquée, texte hors justification. Les trois contrôles sont éprouvés sur des documents
volontairement fautifs.

**La fenêtre de longueur.** Le passage de *Pot-Bouille* mesurait 23 lignes brutes pour une
fenêtre de 15 à 20. Le reflow a été mesuré avant toute décision — langue déclarée, marges à
1,8 cm puis 1,6 cm — et n'y suffit pas. La fenêtre n'est pas réglementaire : elle borne ce
qu'il y a à lire. Elle est donc énoncée sur les **lignes pleines équivalentes**, les lignes
du PDF diminuées des coupures de paragraphe de l'édition, et **vérifiée** par
`scripts/textes_sources.py`. Les sept passages la tiennent.

**Dates.** Cent cinq métadonnées créées par la release et datées du lendemain ont été
ramenées au 2026-09-11. Les décisions enregistrées avant cette passe gardent leur date :
`scripts/dates_anterieures.py` les classe une par une, et `UNEXPLAINED_FUTURE_DATES = 0`.

## 5 novodecies. Release V1 — insertion des textes sources et finalisation (2026-09-11)

**Ce que la passe a fait.** Les sept passages littéraires et philosophiques attendus ont été
transcrits depuis leurs éditions publiques, confrontés au fac-similé page à page, insérés,
mesurés dans les PDF réels et enregistrés (§ 4). Les cinq instruments qui les attendaient
sont devenus diffusables : `FR-EAF`, `FR-EAF-ORAL`, `FR-MAI`, `PHI`, `EDS-HLP`. Le dépôt
porte désormais **seize instruments métier, seize diffusables**.

**Ce que la confrontation au fac-similé a coûté.** Six écarts entre la transcription en
ligne et l'image de l'édition, dont une graphie modernisée en silence et un intertitre
fondu dans le texte courant ; le détail est au § 4. La leçon est enregistrée dans
`referentiels/textes_sources.json` : le niveau de relecture affiché par une source ne
dispense pas de regarder l'image.

**Corrections disciplinaires après insertion.** Le texte réel a montré que des items
écrits pour un texte générique ne fonctionnaient plus, ou n'avaient jamais fonctionné :

| Item | Défaut constaté sur le texte réel | Correction |
|---|---|---|
| `FR-EAF-COMP-01` à `-11` (9 items) | énoncés et clés écrits pour un texte argumentatif abstrait — « le pronom souligné au premier paragraphe » — que le support ne contient pas | récrits sur le passage de La Boétie |
| `FR-EAF-COMP-04` | intention de l'auteur, propositions valables pour tout texte argumentatif | propositions liées à l'apostrophe et à l'injonction du passage |
| `FR-EAF-COMP-08` | demandait une concession que le passage ne contient pas ; la bonne réponse à l'ancien énoncé aurait été « il ne concède rien » | porte sur la construction correctrice « non pas… mais » |
| `FR-EAF-REDA-01` | axe de rédaction écrit pour Zola, item servant les deux sessions | sessionné à 2027, axe réécrit sur Balzac ; `FR-EAF-REDA-04` créé pour 2028 |
| `FR-EAF-REDA-02` | « Voici un paragraphe rédigé par un autre candidat » sans paragraphe | le paragraphe est fourni ; la clé nomme l'idée directrice manquante |
| `FR-EAF-CULT-07` | la bonne réponse était « Pot-Bouille », devenu le support du bloc C du même sujet : l'item se résolvait en tournant la page | réponse portée sur un autre roman du programme 2028 |
| `FR-EAF-CULT-05` | nommait le mouvement de Zola dans le sujet dont le bloc C est un texte de Zola | sessionné à 2027 ; `FR-EAF-CULT-09` créé pour 2028, sur Balzac |
| `HLP-1-LECT-05` à `-08`, `HLP-T-LECT-09` | clés génériques | clés citant les éléments réellement présents chez Montaigne |
| `HLP-1-INTER-01`, `HLP-1-ESSAI-01` | grilles de niveaux sans indication de ce que le texte permet | `elements_attendus` ajoutés |
| `FR-MAI-COMPA-01`, `-04` | propositions métalinguistiques — « la position que l'auteur défend » | propositions tirées du texte de Condorcet |
| `FR-MAI-COMPA-02` | clé « poser le problème traité » : le premier paragraphe énonce une thèse | clé et propositions refaites |
| `FR-MAI-COMPA-03` | clé « une conséquence » : le dernier paragraphe s'ouvre par « Mais » | clé corrigée en opposition |
| `FR-MAI-COMPA-05`, `-06` | propositions valables pour tout texte concessif | liées à la concession et au destinataire réels |
| `FR-MAI-COMPA-07`, `-08` | thèse générique ; item portant sur « les deux derniers paragraphes » | thèse réelle ; connecteur « ainsi » désigné |
| `FR-MAI-COMPA-09` | « le texte oppose deux positions » : le passage n'en oppose aucune | porte sur la concession et sa restriction |
| `FR-MAI-SYNT-01`, `-02` | attendus non bornés ; résumé annoncé sans être fourni | `elements_attendus` ; résumé déformé fourni |
| `PHI-T-TEXT-01` | grille de niveaux sans thèse ni étapes nommées ; la note revendiquait de fonctionner avec tout texte | thèse, cinq étapes, articulations, réponses partielles et codes d'erreur écrits sur Descartes |

**Mise en page.** Quatre défauts corrigés dans `scripts/build_instrument.py` : un support à
cheval sur deux pages, un support séparé de sa question, un titre de bloc resté seul en bas
de page, un point d'interrogation rejeté en tête de ligne. L'extrait et la question de
grammaire de `FR-EAF-ORAL`, qui n'étaient imprimés nulle part, le sont désormais dans le
document coach.

**Non-régression.** Huit mesures ont bougé depuis le commit précédent, toutes dans le relevé
des codes d'erreur de `FR-EAF/REDA` et conséquence directe de la réécriture de
`FR-EAF-REDA-02`. Aucun score, aucun niveau, aucun palier, aucun agrégat, aucune calibration
n'a changé.

**Release.** `scripts/release.py` produit `MANIFESTE_DEPOT.json` et son résumé
`MANIFESTE_DEPOT.md` depuis le dépôt, sans aucun état recopié.

## 5 octodecies. Micro-patch de clôture (2026-09-12)

Dernière passe de conception avant la phase des supports textuels. Quatre décisions.

**Passage de *Pot-Bouille*.** Celui du 2026-09-11 est refusé — 136 mots, 8 lignes. La
direction refuse également l'assemblage de deux fragments et l'abaissement de la
spécification, et autorise le dialogue lorsqu'il appartient à une séquence continue et
participe à l'analyse. La nouvelle séquence — de « Au plafond, deux grandes fentes coupaient
les caissons… » à « …tout retomba à un silence de mort. » — mesure **326 mots et 20 lignes**
dans le gabarit réel du sujet, dans la fenêtre de 15 à 20 lignes. Aucune borne n'a eu à être
déplacée. Statut : `passage_designe_non_transcrit`.

**« Modéliser » en SPE.** Deux observations suffisent en V1, à condition qu'elles en soient.
La première question de RAIS-01 demandait d'appliquer un taux fourni par l'énoncé : elle ne
constituait pas une seconde source. Elle exige désormais que le modèle soit écrit — suite
définie, relation de récurrence ou expression explicite — avant tout calcul, à points et à
durée inchangés. INFO-03, qui applique un ajustement donné, perd la même étiquette pour la
même raison. Mention portée au référentiel : *minimum de couverture V1 — à réexaminer après
pilote*.

**AUTO.FONC-3.** MATH-EA V1 reste un échantillonnage de **seize automatismes observés sur
dix-sept**. La capacité de tracé est enregistrée `non_observe_v1_modalite_graphique` :
au programme, dans le périmètre, non observée par la V1. Aucun QCM proxy, aucune grille,
aucun type d'item, aucune chaîne de saisie nouvelle.

**Décompte des instruments.** Un rapport a écrit « 17 instruments ». La cause est
`validate_instrument.py --tous`, qui parcourt les dossiers sur disque et y trouve `_FIXTURE`.
Le dispositif compte **seize instruments métier** ; `_FIXTURE` est une fixture technique, les
`_MAQUETTE*` sont des jeux de données. Les deux nombres sont désormais rendus séparément par
l'état calculé et par le validateur, et trois tests interdisent de les additionner.

## 5 septdecies. Correction de MATH-EA après audit direct des fichiers (2026-09-11)

La direction a refusé la validation technique et pédagogique de MATH-EA : l'audit direct des
PDF remis a trouvé des défauts que les tests ne voyaient pas. L'instrument a été retiré de la
diffusion pendant la correction, par un motif de plus dans le calcul de diffusabilité — pas
d'état parallèle, pas de contournement de V-Instruments.

**Notation mathématique.** Vingt commandes LaTeX étaient doublement échappées dans la banque :
le sujet imprimait « times » pour ×, « mathbb » pour ℝ, « div » pour ÷. Le défaut était
invisible dans le fichier source, qui écrit déjà toute barre doublée, et dans le Markdown, qui
n'interprète pas les commandes. Deux contrôles l'attrapent désormais : un contrôle de source
sur la chaîne décodée, un préflight qui lit le texte extrait du PDF produit.

**AUTOG-06 était faux.** De « g croissante et g(4) = 0 » on déduit g(x) ≤ 0 avant 4, non
g(x) < 0 : la proposition « on ne peut pas conclure » était défendable. L'item porte désormais
une courbe construite, dont le signe sur l'intervalle interrogé est non ambigu.

**Prérequis et partie officielle.** Le bloc A, assiette du taux de prérequis, contenait les
automatismes du programme de **première** : un candidat qui échouait sur le contenu de son
année était envoyé travailler le niveau inférieur. Le bloc A ne porte plus que des acquis du
programme de seconde — MENE2602914A entre au référentiel des capacités —, et les automatismes
de première rejoignent le bloc B. Deux dimensions sont séparées : la partie de l'épreuve et le
rôle diagnostique.

**Étiquettes transversales.** Quatre ne correspondaient à aucune tâche. Un cercle
trigonométrique, un tableau croisé et un arbre pondéré à construire rendent réelles celles qui
pouvaient l'être ; les deux autres sont retirées. Un contrôle refuse une étiquette sans trace.

**Le bilan rend trois nombres** pour MATH-EA, et non un pour l'autre : score global du
diagnostic, production du bloc C, note estimée à la pondération officielle 6/14.

**Décisions.** EC-31 est tranché — la règle du français devient « épreuves anticipées si
fragiles », et les mathématiques anticipées passent du sixième au premier rang du jeu P1
2026-2027. EC-32 est clos : deux paliers par domaine, et le rendu nomme le palier maximal
testé. Le bloc C de FR-EAF session 2028 reçoit sa désignation — Zola, *Pot-Bouille*,
chapitre I — dont le passage mesure huit lignes et non quinze à vingt, ce que le référentiel
dit. Les faits de l'article 3 entrent au questionnaire, derrière une section conditionnelle.

**Couverture des automatismes : seize sur dix-sept.** La dix-septième demande un tracé, que la
chaîne de saisie ne peut pas enregistrer. MATH-EA est un échantillonnage diagnostique, et le
dépôt le dit.

## 5 sexdecies. Consolidation avant supports textuels (2026-09-11)

Dernière passe avant l'insertion des textes littéraires et philosophiques. Cinq objets : rendre
Q-26 opposable au profil entier, fermer EC-18, rendre opérationnel le P1 de 2026-2027, éprouver
MATH-EA/SPECIFIQUES de bout en bout, conduire la contre-expertise disciplinaire de MATH-EA.

**Q-26 porte le profil, plus un instrument.** L'ordre est celui des faits : déclarations →
éligibilité de l'article 3 → vérification de la preuve → ouverture du profil → dérivation de
tous les instruments. Aucun critère n'est plus « vérifié » sur la seule déclaration du
candidat ; l'absence de centre d'examen à l'étranger, fait administratif qu'aucune pièce du
candidat n'établit, reste indéfiniment à vérifier faute de source canonique versionnée.

**EC-18 est transformé, Q-27 close.** Le seuil de séquencement du § 8.2 est rétabli à 20 h avec
sa comparaison stricte — 20 h ne déclenche pas, 20,5 h déclenche. Le signal de 15 h devient un
indicateur distinct, « vigilance — charge élevée », qui atteint son seuil sans rien imposer. Le
motif de l'amendement — « 20 h serait inatteignable » — était devenu faux depuis que MATH-EA
porte le plafond à 21 h, et une règle amendée ne survit pas à son motif. RB-11 refuse désormais
qu'un indicateur ajouté commande la règle citée.

**Le P1 opérationnel est la cohorte 2026-2027.** Entrée en première en septembre 2026, épreuves
anticipées en juin 2027 par anticipation, session finale 2028. FR-EAF reçoit trois assemblages
de session 2028 : noyau commun d'items, deux items de repères sessionnés par l'objet d'étude
renouvelé — le roman —, support du bloc B commun aux deux sessions puisque la littérature
d'idées n'est pas renouvelée, et support du bloc C **non désigné**. *Pot-Bouille* redevient
éligible dans un contexte 2028 ; cela ne vaut pas désignation, et l'emplacement réservé
maintient FR-EAF non diffusable pour cette session. Le jeu `_MAQUETTE_P1` reste au dépôt comme
cohorte historique : il est le seul à opposer le programme de mathématiques antérieur.

**Contre-expertise de MATH-EA.** Les items renvoyaient au programme, jamais à une capacité :
les annexes des deux arrêtés sont transcrites dans `referentiels/capacites_mathematiques.json`
et chaque item nomme la ligne qu'il évalue, par parcours. Les six compétences du préambule
deviennent une dimension déclarée, et une compétence n'est tenue pour couverte que si deux
tâches de la seconde partie l'exercent. Cinq items reçoivent une figure réelle, produite par le
générateur déterministe du dépôt, là où la capacité visée est une lecture graphique. Un score
au format de l'épreuve applique la pondération officielle 6/14, indépendamment du barème
interne. La correspondance entre les blocs du diagnostic et les deux parties officielles est
établie **par registre de tâche** et non par bloc : elle figure au référentiel des programmes
et porte son propre avertissement. Les blocs A, B, C et D sont la structure du diagnostic ; le
§ 5 quindecies, daté du 2026-09-10, dit que le diagnostic « garde l'architecture » de l'épreuve
— la formule est trop forte, et le bloc D n'a aucun équivalent à l'épreuve. La durée passe de 60 à 75 minutes et une seconde tâche de production est créée
(EC-33) : la seconde partie de l'épreuve compte deux ou trois exercices, le diagnostic n'en
observait qu'un, et les deux critères qui servaient le palier de raisonnement provenaient de
cette tâche unique.

**Deux défauts de rendu trouvés en chemin.** `rendre_figure` lisait `type` là où la donnée
porte `type_graphe` : tout diagramme en barres du dépôt était tracé en courbe continue sur un
axe catégoriel. `controler_donnees` attendait la même chose, si bien qu'aucune figure n'était
contrôlée. Les deux sont corrigés, et le contrôle passe désormais réellement sur EDS-SES et
EDS-SVT.

**Ce qui reste ouvert.** EC-31 — le § 8.2 n'ordonne pas le groupe MATHEMATIQUES d'un candidat
sans spécialité mathématiques ; le motif rendu est corrigé, le rang attend un arbitrage.
EC-32 — aucune compétence de contenu de MATH-EA n'atteint le palier D3, la calibration en
détermine deux ; le raisonnement est déterminé au niveau du périmètre.

## 5 quindecies. MATH-EA — instrument de l'épreuve anticipée de mathématiques (2026-09-10)

Créé après le passage du gate réglementaire, sur autorisation de la direction. C'est le
seizième instrument, et le premier qui ne vienne pas du Cahier.

**Ce qu'il mesure, et ce qu'il ne mesure pas.** L'épreuve dure 2 h, vaut coefficient 2, se
passe **sans calculatrice** et se compose d'un QCM d'automatismes sur 6 points puis de deux
ou trois exercices sur 14. MATH-EA mesure la préparation à ce format et à ses attendus ; il
ne mesure pas le programme de spécialité pour lui-même, ce que fait EDS-MATH. Les deux
coexistent sans que rien ne soit fusionné.

**Deux parcours, pas trois.** Le texte distingue en voie générale l'enseignement de spécialité
et les mathématiques intégrées à l'enseignement scientifique ; le tronc commun désigne la voie
technologique, hors périmètre V1. Les assemblages s'appellent donc **`SPE`** et
**`SPECIFIQUES`**, et leurs intitulés sont lisibles en clair dans les rendus.

**Programme de l'année de passation.** Les deux assemblages sont construits sur les arrêtés du
26 février 2026 — NOR MENE2602917A et MENE2602916A, entrés en vigueur à la rentrée 2026-2027 —
dont les annexes ont été lues intégralement. La note transitoire MENE2516240N n'a servi à rien :
elle ne vaut que pour les passations de 2025-2026, et un test le vérifie. Chaque compétence cite
l'arrêté et la partie du programme dont elle relève.

| Compétence | Objet | SPE | SPECIFIQUES |
|---|---|---|---|
| `AUTO` | Automatismes de calcul : taux d'évolution, calcul numérique et algébrique | ✓ | ✓ |
| `AUTOG` | Automatismes graphiques et statistiques : lectures, droites, indicateurs | ✓ | ✓ |
| `PROBA` | Probabilités conditionnelles, indépendance, répétition d'épreuves de Bernoulli | ✓ | ✓ |
| `EXACT` | Conduite d'une épreuve sans calculatrice : calcul exact, ordres de grandeur, vraisemblance | ✓ | ✓ |
| `RAIS` | Raisonnement et rédaction : justifier une étape, rédiger une réponse complète | ✓ | ✓ |
| `ALGAN` | Algèbre et analyse de la spécialité : suites, second degré, dérivation, exponentielle | ✓ | — |
| `GEOM` | Géométrie et trigonométrie de la spécialité : produit scalaire, géométrie repérée | ✓ | — |
| `EVOL` | Modélisation d'un phénomène d'évolution : linéaire, quadratique, exponentielle | — | ✓ |
| `INFO` | Analyse de l'information chiffrée : séries bivariées et ajustement affine | — | ✓ |

**Durée diagnostique : 60 minutes, décision enregistrée.** L'épreuve dure 120 minutes ; aucune
règle du dossier ne dit comment condenser. Le diagnostic garde l'architecture — bloc A
d'automatismes, bloc B de contenus, bloc C au format de la seconde partie, bloc D de méthode —
à la moitié de l'échelle, pour deux raisons : le diagnostic mesure un point de départ et non
une performance d'examen, et le § 1.1 plafonne une demi-journée à 3 h 15, que l'ajout d'une
heure entière aurait fait franchir plus souvent. Les deux assemblages tiennent exactement dans
la fenêtre : 31 items et 60 minutes pour `SPE`, 32 items et 60 minutes pour `SPECIFIQUES`.

**Aucune figure.** Les données graphiques sont décrites en toutes lettres — tableau de
variations, diagramme en boite, nuage de points — de sorte que l'instrument n'attend aucun
support externe. C'est la raison pour laquelle **MATH-EA est le seul instrument à support
externe potentiel qui soit diffusable dès sa création** : rien n'y est en attente de
transcription.

**Groupe de planification MATHEMATIQUES.** EDS-MATH et MATH-EA forment une seule matière de
travail : l'enveloppe hebdomadaire est le **maximum** des deux rythmes, jamais leur somme, et le
plan nomme le module prioritaire puis le second objectif. Sur le jeu P3, les deux périmètres
appellent 3 h chacun : l'enveloppe reste à 3 h et le total du plan ne bouge pas.

**Plan de passation.** Le P3 passe de 8 h 15 à **9 h 15** au centre, toujours en trois
demi-journées ; le P2 de 7 h 05 à **8 h 05**, également en trois. En revanche, un P2 en
configuration « aucune », qui tenait en deux demi-journées, en demande désormais **trois** :
c'est le seul changement de calendrier, et il vient de l'heure ajoutée, non d'un dépassement
toléré.

**Conséquence sur EC-18, signalée.** L'abaissement du seuil d'alerte de charge de 20 h à 15 h
était justifié par l'impossibilité d'atteindre 20 h avec six matières. Le périmètre corrigé en
compte sept pour un P3 sans spécialité mathématiques : la charge maximale atteignable passe à
**21 h**, et le seuil du Cahier redeviendrait atteignable. Le seuil de 15 h reste la décision de
la direction ; sa justification a changé et le référentiel le dit. Le contrôle RB-05 a été
corrigé au passage : il comptait des périmètres, il compte désormais des groupes de
planification, seule unité qui ouvre une enveloppe.

**Ce que MATH-EA n'a pas.** Aucun jeu fictif ne l'exerce en parcours `SPECIFIQUES` : les trois
candidats de maquette déclarent tous la spécialité mathématiques. Le parcours est validé,
couvert et testé — sélection, couverture des compétences, rendus — mais aucun bilan complet ne
le montre. C'est le premier jeu à produire si la direction veut le voir à l'œuvre.

## 5 quaterdecies. Clôture réglementaire — sessions, article 17, article 3 (2026-09-10)

Passe de fermeture des derniers défauts réglementaires, avant autorisation de créer MATH-EA.
Aucun passage littéraire transcrit, aucun manuel HLP.

**Q-26 reprise sur le texte (A).** La matrice comptait sept critères dont un fourre-tout ;
elle en compte douze, tous nommés à l'article 3. Trois corrections de fond. La **résidence
permanente à l'étranger** n'ouvre plus le passage à elle seule : le texte la conditionne à
l'absence de centre d'examen dans le pays, ou à son éloignement — la première branche est
déterministe, la seconde relève d'une appréciation. L'**échec antérieur**, le **diplôme
français** de la liste réglementaire, le **changement de voie ou de série** et le **retour en
formation initiale** sortent du générique « à vérifier » : ce sont des catégories explicites.
Enfin, **le droit et la preuve sont séparés** : `eligibilite_reglementaire` ∈ {oui, non,
conditionnelle} d'un côté, `statut_verification` ∈ {verifie, piece_a_verifier,
decision_administrative_requise} de l'autre. Un titulaire du baccalauréat relève d'une
catégorie explicite même s'il n'a pas encore produit son diplôme : c'est une pièce à fournir,
pas une ambiguïté de droit. P3 ne s'ouvre que si le droit est établi **et** la pièce vérifiée.

**Article 17 en entier (B).** Les cinq situations sont modélisées séparément — échec à la
session 2026 ; force majeure ayant empêché de subir la session 2026 après des épreuves
anticipées passées en 2024-2025 ; résidence temporaire à l'étranger après ces mêmes épreuves ;
aménagement de scolarité avec enseignements de première commencés avant la rentrée 2025 ;
aménagement avec entrée en terminale avant la rentrée 2026. Chacune a son test positif et son
contre-test, et les sessions couvertes sont portées par la donnée, non par le code.

**Le redoublant relève de l'article 2 (C).** La source était fausse : l'article 2 dispose que
l'élève qui redouble la première représente les épreuves anticipées et que les nouvelles notes
remplacent les précédentes. Les articles 4 et 5 gardent leur rôle de conservation, D334-13 le
sien après échec à l'examen.

**Trois axes au lieu d'un (D, E).** `session_visee` servait à deux décisions différentes. Il
est déprécié au profit de `session_baccalaureat_finale`, `annee_scolaire_passation_ea` et
`mode_passation_ea`. Le cas de juin 2027 le justifie : deux candidats composent le même jour,
l'un au titre de la session finale 2027, l'autre par anticipation au titre de la session 2028 ;
même année de passation, programmes d'œuvres différents, programme de mathématiques commun. Un
test le prouve et échoue si l'on revient à un champ unique.

**FR-EAF redevient sensible à la session (F, G).** La purge de *Pot-Bouille* valait pour la
session 2027, non pour l'instrument : le contrôle confronte désormais chaque œuvre citée au
programme de **la session de l'assemblage**. Un test prouve que *Pot-Bouille* est refusé en
2027 et **accepté en 2028** ; La Boétie passe dans les deux. Les assemblages déclarent leur
session finale, les items propres à une session portent `sessions_applicables`, et le moteur
refuse qu'un candidat compose un assemblage d'une autre session que la sienne.

**Constat sur la session 2028.** Aucun assemblage FR-EAF n'existe pour elle, et en créer un
demanderait de nouveaux items de repères : en retirant les trois items propres à 2027, la
compétence CULT tomberait à trois points répartis sur deux paliers, sous le minimum de la règle
de couverture. C'est pourquoi le jeu P1 est requalifié en **cohorte 2025-2026** — épreuves
anticipées en juin 2026, session finale 2027, mode anticipation — plutôt que déclaré 2026-2027
sans instrument capable de le mesurer. Un P1 de la cohorte 2026-2027 relève de la session 2028
et **ne peut pas être diagnostiqué aujourd'hui** : c'est une conséquence du périmètre corrigé,
et elle est testée.

**Programme de mathématiques par année de passation (I).** MENE2515469N : le candidat compose
sur le programme en vigueur pendant l'année scolaire de passation. Les deux programmes du
26 février 2026 — MENE2602917A pour la spécialité, MENE2602916A pour les mathématiques
intégrées à l'enseignement scientifique, entrés en vigueur à la rentrée 2026-2027 — sont
enregistrés et leurs annexes lues. MENE2516240N reste au référentiel comme donnée historique de
l'année 2025-2026, avec son exclusion explicite ; un test refuse qu'elle serve de source pour
une passation 2026-2027.

**Statut de l'épreuve dérivé, non déclaré (J).** Le questionnaire ne demandera pas au candidat
s'il « doit » passer l'épreuve : le moteur dérive `a_presenter_spe`, `a_presenter_specifiques`,
`dispensee`, `note_conservee`, `deja_presentee_valable`, `sans_objet` ou `a_verifier` à partir
de la session, de l'année de passation, du parcours, des épreuves déjà présentées, de la
conservation et de l'éligibilité Q-26.

**README (Q).** Quatre résidus fermés : A-01 ne dit plus les œuvres invérifiables ; le § 9
quater porte la vérification faite, barrée et datée ; la justification des emplacements réservés
parle de Balzac et non de Zola ; et le périmètre distingue les **quinze instruments du Cahier
initial** des **seize du périmètre réglementaire corrigé**. Trois familles de contrôle sont
ajoutées à `audit_readme.py` — attente réglementaire périmée, désignation de support contredite,
périmètre d'instruments — chacune avec son contre-test.

## 5 terdecies. Contre-expertise de clôture — seconde passe (2026-09-10)

Passe courte et ciblée, avant autorisation de créer MATH-EA, d'insérer les textes sources et
de reprendre HLP. Aucun extrait d'auteur n'a été transcrit, aucun instrument créé.

**Hiérarchie des sources (point 1).** La formule « le Cahier fait foi » est retirée : elle
était fausse depuis que l'audit a montré que le Cahier pouvait être obsolète. L'ordre de
préséance est en tête de ce document et au référentiel
(`programmes_examen.json → hierarchie_normative`) ; `scripts/audit_readme.py` refuse toute
réaffirmation de la primauté du Cahier contre un texte réglementaire, dans le README comme
dans les référentiels.

**Programme EAF (point 2).** La direction ayant lu les pages officielles, la réserve
« listes établies indirectement » est levée pour les sessions 2027 et 2028 : les deux notes
de service passent en confiance haute, avec leur phrase d'applicabilité — « l'année scolaire
2025-2026 et les épreuves anticipées de la session 2027 » d'une part, le programme 2026-2027
pour la session 2028 d'autre part.

**Roman du bloc C (point 3).** Balzac, *La Peau de chagrin* est enregistré comme œuvre
désignée dans `programmes_examen.json → designations_oeuvres`. Le **passage** reste non
désigné et rien n'a été transcrit : FR-EAF demeure non diffusable pour ce motif. Le résidu
*Pot-Bouille* est purgé partout où il valait comme support attendu de la session 2027 — les
deux assemblages, le renvoi `FR-EAF/ecrit bloc C`, le § 4 et le § 9 — et **un item de repères
qui donnait *Pot-Bouille* pour bonne réponse à une question sur « les œuvres au programme de
la session 2027 » a été corrigé** : il était faux. Un contrôle nouveau
(`controler_oeuvres_citees`) refuse désormais qu'un item cite au candidat une œuvre d'une
autre session ; l'œuvre reste au référentiel comme donnée de la session 2028.

**Q-24 (point 4).** Le tableau juridique est refait au § 7 : dispenses transitoires de
l'article 17 modélisées une par une, régime propre des épreuves anticipées (articles 4 et 5)
distingué de la conservation générale, et catégorie vague « première partie validée avant
2027 » supprimée. Les points qui dépendent d'articles non lus au Journal officiel portent
`a_confirmer`. Aucune variable n'a été créée à partir de ce tableau.

**Terminologie (point 5).** `MATH-EA`, assemblages `SPE` et `SPECIFIQUES` pour la voie
générale ; « tronc commun » est réservé à la voie technologique, conformément au texte. Pas
d'assemblage technologique sans décision de périmètre.

**Q-26 (point 6).** Ouverte, modélisée, testée, branchée en amont de la dérivation (`liste_effective_des_instruments_a_passer` consulte le gate, une seule fois). La règle est déterministe et
rend `oui`, `non` ou `a_verifier` ; toute situation soumise à appréciation administrative
produit `a_verifier`, jamais `oui`.

**Q-25 (point 8).** Tranchée : le séquencement descend de l'ordre du plan et des prérequis
bloquants (EC-30). L'ancienne phrase générique est retirée du référentiel et du rendu ;
aucun découpage trimestriel n'est proposé. Le bilan P3 nomme désormais la matière que le plan
met en tête, puis les groupes en remise à niveau qui conditionnent la suite.

**README (point 9).** Le document est coupé en « état courant » et « historique des
décisions ». `scripts/audit_readme.py` audite le seul état courant sur sept familles
d'incohérence — effectifs recopiés, noms retirés, œuvres hors session, questions closes
présentées comme ouvertes, statuts contredits par le calcul, primauté du Cahier, effectifs
d'items — et rendait **vingt incohérences** au premier passage ; il en rend zéro. Les
questions Q-08, Q-13, Q-14 et Q-25 quittent le registre des questions ouvertes pour un
§ 8 bis « Questions tranchées ».

**Maquette P3 (point 10).** Le README de `_MAQUETTE` annonçait « poursuivies mathématiques et
SES, abandonnée physique-chimie » : l'inverse du questionnaire, de la spécification et du
bilan. **Le jeu n'a pas été touché** — SES est la spécialité abandonnée, mesurée en N1 — et
la description a été refaite sous forme de tableau que deux tests confrontent au jeu réel.

**Date (point 11).** Convention explicite en tête ; les deux sections datées du 2026-09-11
sont ramenées au 2026-09-10, date des commits en heure de Tunis.

## 5 duodecies. Contre-expertise de clôture — première passe (2026-09-10)

Aucune porte reprise, aucune architecture réécrite. Dix points, dans l'ordre de la demande.

### 1. Diffusabilité des instruments — le trou est fermé

Un bilan terminait par huit contrôles réussis alors que trois de ses instruments sources
impriment encore une consigne d'insertion à la place de leur texte. `scripts/diffusabilite.py`
devient la **source unique** du statut : il le calcule depuis les fichiers — emplacement
réservé actif, support sans texte, sans référence ou sans édition, désignation d'œuvre non
conforme, erreur de validation — et nomme chaque motif. Personne ne le recopie : le § 1 bis
le rapporte, le bilan l'interroge.

Le contrôle **V-Instruments** entre dans la chaîne du § 6.3. En mode `production`, un seul
instrument non diffusable met le bilan **en attente** ; le corps n'est pas rendu. Le mode est
**déclaré** par le jeu de données (`mode_rendu`, liste fermée `production` / `maquette`) et
jamais déduit du nom d'un dossier : un jeu posé dans `_MAQUETTE` sans déclaration est traité
en production, et le test le vérifie. Tout bilan de maquette porte, immédiatement sous son
titre, `MAQUETTE — DONNÉES FICTIVES — NON DIFFUSABLE`, et V-Instruments y est rendu **sans
objet**, jamais réussi. Deux tests adversariaux ferment les contournements : un instrument
porteur d'un emplacement réservé ne produit pas de bilan de production diffusable, et effacer
la consigne d'insertion sans renseigner l'édition ne suffit pas — le motif `support_a_completer`
subsiste sur le champ `edition`.

### 2. Audit réglementaire de la session 2027 — le Cahier avait tort sur le roman

Le Cahier ne fait plus foi contre un texte réglementaire applicable à la session visée.
`referentiels/programmes_examen.json` porte la cartographie, avec sa règle de correspondance
et sa preuve : *« la liste des œuvres et des parcours inscrits au programme de première pour
l'année scolaire 2024-2025 et pour les épreuves anticipées de la session 2026 »* (note de
service du 12-6-2023, NOR MENE2315136N, lue en PDF). Donc **session = fin de la première + 1**.

| Session | Année scolaire de première | Texte |
|---|---|---|
| 2026 | 2024-2025 | note de service du 12-6-2023, NOR MENE2315136N |
| **2027** — visée par le dossier | **2025-2026** | NOR MENE2418442N, BO n° 30 du 25 juillet 2024 |
| 2028 | 2026-2027 | NOR MENE2518792N, BO n° 30 du 24 juillet 2025 |

Deux vérifications, l'une et l'autre par le même mécanisme :

- **La Boétie, *Discours de la servitude volontaire*** est bien au programme de la session
  2027 — objet d'étude renouvelé cette année-là, parcours « “Défendre” et “entretenir” la
  liberté ». Le support du bloc B de FR-EAF est confirmé, non par le Cahier mais par le texte.
- **Zola, *Pot-Bouille* n'y est pas.** L'œuvre appartient au programme de première 2026-2027,
  donc aux épreuves anticipées de la **session 2028**, avec le parcours « dévoiler les rouages
  de la société ». Le contrôle `oeuvre_au_programme` du validateur refuse la désignation et
  FR-EAF en devient non diffusable pour ce motif en plus des autres. Le placeholder n'a pas
  été rempli et l'œuvre n'a pas été remplacée d'autorité : **proposition** au § 4, Balzac,
  *La Peau de chagrin* — au programme 2027, domaine public, prose descriptive continue, et
  d'un autre objet d'étude que le bloc B, ce qui évite de mesurer deux fois le même texte.

Réserve de méthode : `education.gouv.fr` et `eduscol` refusent la récupération automatisée
(HTTP 403). La note de service de la session 2026 a été lue intégralement en PDF ; les listes
2027 et 2028 sont établies par recoupement de sources concordantes et portent leur niveau de
confiance dans le référentiel. La direction doit les confronter au Bulletin officiel avant
impression.

### 3. Q-24 — l'épreuve anticipée de mathématiques n'est pas dans le dispositif

Vérifié sur pièce, sujet zéro ministériel lu en PDF (référence 26-MATSPEGEG11, baccalauréat
général) : **2 heures, coefficient 2, calculatrice interdite**, notée sur 20, en deux parties
— QCM d'automatismes sur 6 points, puis deux à trois exercices sur 14. Créée par décret et
arrêté du 10 juin 2025, première passation en juin 2026, **au titre de la session 2027**. Le
sujet diffère selon le parcours suivi : programme de spécialité pour les candidats qui la
suivent, mathématiques du tronc commun pour les autres, programme technologique pour la voie
technologique. Le Cahier, écrit avant, l'ignore entièrement.

| Profil | Situation | Épreuve à présenter ? | Programme / sujet | Instrument diagnostique | Justification |
|---|---|---|---|---|---|
| P1 | En première, prépare les épreuves anticipées, **avec** spécialité mathématiques | **Oui** | Sujet « avec enseignement de spécialité mathématiques » | **Manquant.** `EDS-MATH/N1` mesure le programme, pas le format de l'épreuve — ni QCM d'automatismes chronométré, ni interdiction de calculatrice | Sujet zéro ministériel ; épreuve due par tout candidat de première à compter de 2025-2026 |
| P1 | En première, **sans** spécialité mathématiques | **Oui** | Sujet « tronc commun », adossé à l'enseignement scientifique | **Manquant, et sans périmètre d'accueil.** `TC-ES` porte l'enseignement scientifique, pas les mathématiques du tronc commun | Idem ; c'est le trou le plus large |
| P2 | A validé sa première partie à une session **antérieure à 2027** | **Non** | — | Aucun | L'épreuve n'existait pas ; rien à représenter |
| P2 | Note d'épreuve anticipée **conservée** (≥ 10/20, dans les cinq sessions) | **Non** | — | Aucun | Code de l'éducation, art. D334-13 |
| P2 | Doit représenter l'épreuve (note non conservée, ou représentation intégrale choisie) | **Oui** | Selon la spécialité suivie | Manquant | À confirmer sur la note de service du 25 août 2025, NOR MENE2523745N |
| P3 | Candidat individuel présentant l'ensemble à la session 2027 | **Oui**, à la même session que les épreuves terminales | Selon la spécialité déclarée | Manquant | Le candidat individuel choisit de présenter les évaluations en une fois à la fin du cycle |

**Architecture proposée — non implémentée, arbitrage requis.**

1. Une variable de questionnaire `maths_anticipees_a_presenter`, fermée et typée, sur le
   modèle exact de `epreuves_francais_a_presenter` : `specialite`, `tronc_commun`,
   `aucune_note_conservee`, `aucune_deja_validee`. Elle est **orthogonale au profil**, comme
   l'est déjà la configuration française depuis Q-19.
2. Un instrument dédié plutôt qu'un ajout aux banques existantes. Le format de l'épreuve
   — automatismes sans calculatrice, chronométrés — ne se mesure pas avec des items conçus
   pour le programme de spécialité, et le cas « sans spécialité mathématiques » n'a
   aujourd'hui **aucun périmètre**. Deux assemblages : `specialite` et `tronc_commun`.
3. Rattachement au plan : le groupe de planification `FRANCAIS` a montré la voie ; les
   mathématiques anticipées relèveraient du groupe de la spécialité pour un candidat qui la
   suit, et d'un groupe propre sinon.

Conformément à la consigne, **rien n'a été créé** : ni instrument, ni variable, ni item, et
ni `EDS-MATH` ni `TC-ES` n'ont été modifiés pour y faire entrer cette épreuve de force.

### 4. Intitulés versionnés — un N1 ne lit plus de contenu de Terminale

Dix-sept compétences réparties sur les sept spécialités portaient un intitulé de la forme
« … ; … **en Terminale** » alors que leur version N1 n'assemble aucun item de ce niveau. Le
référentiel porte désormais `intitule_par_version` pour chacune, et un contrôle du validateur
l'exige : toute compétence évaluée dans une version sans item de Terminale doit avoir son
intitulé propre, et cet intitulé ne doit plus mentionner la Terminale. Le moteur choisit
l'intitulé de la version passée, le rendu le cite par son chemin. Vingt-trois tests couvrent
les sept spécialités dans les deux versions.

### 5. Non-régression des mesures — 2 027 clés, aucune différence

`scripts/mesures.py` relève tout ce qui est mesure — score, niveau, palier, agrégats,
non-réponse, tâche type épreuve, codes d'erreur et fréquences, calibrations par compétence et
par matière, grilles coach, rythme par périmètre, portée de la réévaluation — et rien de ce
qui est plan ou texte. Comparaison entre `244838d` et l'état courant : **2 027 clés comparées,
zéro différence**, sur les trois jeux d'alors. L'instantané `tests/instantanes/mesures.json`
fige ce relevé et `tests/test_non_regression.py` échoue à la première mesure déplacée. Le
libellé d'un module en est volontairement exclu : c'est un affichage, et le point 4 vient de
le changer.

### 6. Rythme et module d'entrée — la cause est nommée

Le bilan disait « module Fragile, rythme au titre du niveau Non acquis » sans dire où se
trouvait ce Non acquis. Le moteur expose `competence_du_rythme` et le rendu nomme la
compétence : sur le français du jeu P3, « porté par “Repères : œuvres au programme, parcours
associés, mouvements littéraires” — c'est cette compétence, et non le module d'entrée, qui
commande l'enveloppe ». EC-17 n'est pas touché.

### 7. Séquencement de charge — grammaire corrigée, politique non inventée

La phrase de la section 7 était un groupe nominal sans verbe. Le référentiel porte désormais
une phrase complète, et le bilan la fait suivre de la matière que le plan met réellement en
tête, sans trancher entre les deux lectures : le § 8.2 qualifie lui-même ce séquencement de
choix à arbitrer avec la famille. Dériver le séquencement des priorités calculées est une
politique pédagogique : elle est soumise en **Q-25**, non appliquée.

### 8. Q-23 — c'était une couverture manquante, elle est comblée

Le § 8.2 porte déjà la règle P1 : français d'abord sous le seuil, sinon spécialité la plus
fragile. Elle était déclarée et jamais exercée. Le placement est maintenant lu au référentiel
(`francais_si_fragile.placement`, par profil) et le jeu `instruments/_MAQUETTE_P1/` l'exerce :
français en tête sous le seuil, spécialités en tête au-dessus, **et rien à la valeur frontière
— le § 8.2 écrit « < 55 % »**. Le même jeu couvre l'égalité entre deux spécialités, départagée
par l'ordre de déclaration au questionnaire faute de coefficient discriminant, et une
spécialité entrant par remise à niveau. Aucune ambiguïté nouvelle n'est apparue : **Q-23 est
close sans arbitrage.**

### 9. Tests ignorés — registre exhaustif et harnais NSI éprouvé

Le registre figure au § 1 bis, produit depuis le code : un mécanisme d'ignorance non annoté
fait échouer sa production. Les vingt-deux ignorés de NSI tenaient à l'absence du fichier
`rendu.py`, que le candidat écrit pendant l'épreuve : c'est le chemin normal de la passation,
mais il laissait le harnais de correction **jamais exécuté**. Une solution de référence
(`instruments/EDS-NSI/tests/rendu_reference.py`, matériel de correction, jamais remis au
candidat) permet désormais de l'exercer : les vingt-deux cas passent contre elle, une réponse
volontairement fausse — recherche séquentielle, double parcours — en fait échouer une partie,
et le barème `bareme_tests_machine` en tire la note attendue. Aucun test n'a été supprimé, et
les ignorés d'origine subsistent pour ce qu'ils sont.

### 10. Version parent — preuve produite

`scripts/preuve_registre.py` compose les deux versions, neutralise **les seules variantes que
la composition déclare elle-même** — chaque appel à `dit(candidat, parent)` enregistre son
couple — et exige que le reste soit identique au caractère près. Sur `CL-2026-0001` : quatre
zones de registre, **zéro différence résiduelle**, 276 nombres imprimés dans le même ordre de
part et d'autre. Le couple complet est remis : `bilan_P3_CL-2026-0001.md`,
`bilan_P3_CL-2026-0001_parent.md` et `preuve_registre_CL-2026-0001.md`.

## 5 decies. Consolidation de la Porte 8 (2026-09-10)

Contre-expertise de l'étape 3, avant généralisation. Sept points.

**Q-22 — FR-MAI est conservé pour un P2 qui repasse l'épreuve anticipée.** La recommandation
de le retirer est refusée par la direction, et le motif est net : FR-EAF mesure la préparation
à l'épreuve effectivement présentée, FR-MAI la maîtrise du français comme outil de travail
académique. Les deux ne sont pas substituables. La sélection reste donc : configuration
`aucune` → FR-MAI ; `ecrit` → FR-MAI + FR-EAF/ecrit ; `oral` → FR-MAI + FR-EAF/oral +
FR-EAF-ORAL ; `les_deux` → FR-MAI + FR-EAF/standard + FR-EAF-ORAL. La configuration reste
orthogonale au profil.

**Ce qui était faux, c'était la planification (EC-28).** Deux périmètres diagnostiques ne font
pas deux matières de travail. `conventions.groupes_planification` de `competences.json`
introduit la notion, générique : tout périmètre sans groupe déclaré forme le sien, FR-EAF et
FR-MAI déclarent `FRANCAIS`. Le rythme d'un groupe est le **maximum** des rythmes de ses
périmètres, jamais leur somme, et la règle de priorité entre matières s'applique désormais aux
groupes — les deux lectures du français portent donc un seul rang. Sur le jeu P2, le plan passe
de 12 h à **10 h** par semaine, avec une seule enveloppe française de 2 h, le module prioritaire
nommé et le second objectif nommé. Les résultats, eux, ne bougent pas : aucun score moyenné,
aucune compétence fusionnée, la cartographie garde ses deux sections, la famille LANGUE sa mise
en regard. Le moteur indexant ses résultats par (périmètre, compétence), la fusion est
impossible par construction même sur les codes homonymes d'EC-02.

**Q-22, volet calendrier (EC-29).** Le plan de passation n'était pas calculé. Il l'est
(`scripts/passation.py`), et le § 1 bis en donne le résultat : un P2 en configuration `aucune`
tient en deux demi-journées, mais **il en faut trois dès que le français de l'épreuve
s'ajoute**, dans les trois autres configurations. Deux constats en découlent. Le découpage
proposé au § 3.2 pour P2 — philosophie, FR-MAI et une spécialité le même jour — vaut 3 h 30,
soit trente minutes **au-delà du plafond de 3 h 15 du § 1.1**, et cela avant Q-19 : c'est un
ordre de grandeur, pas un ordonnancement opposable. Et le plafond est désormais un invariant
testé pour les quatre configurations, pas une intention : aucun instrument n'est retiré pour le
tenir, c'est le nombre de demi-journées qui augmente.

**EC-27 repris — les priorités descendent du plan.** La règle « les trois compétences les plus
basses » est abandonnée : elle laissait la section 2, la section 4 et la section 5 raconter trois
ordres différents. Les trois priorités sont maintenant les **modules d'entrée des trois premiers
groupes du plan qui appellent une intervention**, dans l'ordre de la priorité entre matières. Les
appuis restent les trois compétences évaluées les plus solides, sans recouvrement. À moins de
trois groupes concernés, il y a moins de trois priorités et aucune ligne de remplissage. Un test
paramétré sur les deux jeux refuse tout ordre de section 4 qui ne serait pas celui du plan.

**Provenance des nombres — « enregistré » n'est pas « autorisé ».** La garantie annoncée à
l'étape 3 était surévaluée : V-Texte vérifiait qu'un nombre du rendu avait été enregistré par
l'accumulateur, ce que n'importe quel texte traversant une fonction générique obtenait. La
garantie est maintenant structurelle : **aucune méthode d'émission n'accepte une valeur**. Elles
prennent une clé, un chemin ou un identifiant et vont chercher la valeur dans l'une des quatre
origines admises — registre du moteur (`valeurs_moteur`, 475 clés sur le jeu P3), questionnaire,
référentiel canonique par chemin, ou la liste fermée des constantes structurelles du document
(numéros de section, renvois au Cahier). Trois barrières : une clé inconnue lève ; une ligne
composée contenant un nombre non émis interrompt la composition ; **V-Provenance** rejoue en fin
de rendu chaque émission dans sa source et compare. Écrire « 87 » dans le document est
impossible, et truquer le registre après coup est détecté. `tests/test_provenance.py` exerce les
six cas demandés, plus la modification du registre et la disparition d'une clé.

**« Niveau d'entrée » et « module d'entrée » — distinction conservée, désormais typée.** Le
moteur porte deux méthodes séparées, `niveau_entree` et `module_entree` ; un test vérifie sur les
deux jeux que le niveau appartient à l'échelle du référentiel, que le module porte l'intitulé
entier de la compétence désignée, que la synthèse ne contient jamais l'intitulé et que la
section 5 le contient toujours. Aucun intitulé n'est tronqué.

**README calculé.** Les effectifs de ce fichier avaient dérivé sur bien plus que les trois
exemples signalés : catalogue 24 → **26**, EDS-HLP 26 → **28**, mais aussi PHI 35 → **36**,
EDS-NSI 47 → **49**, compétences 75 → **79**, chapitres 166 → **169**, codes d'erreur 111 →
**117**, termes bloquants 17 → **21**, variables QP 19 → **20**, et `FR-ORAL` encore listé alors
que Q-20 l'a retiré. Tout cela est désormais produit par `scripts/etat_depot.py` au § 1 bis,
entre marqueurs, et `tests/test_etat_depot.py` échoue si le README a dérivé du dépôt.

**EDS-HLP reste bloqué.** La banque compte 28 items, l'assemblage N1 en retient 21 et NT 28 ; le
support des deux blocs C porte toujours l'emplacement réservé Montaigne, dans les deux
assemblages. Aucune source textuelle vérifiable n'existe dans le dépôt : le passage n'est ni
inventé, ni paraphrasé, ni reconstitué de mémoire. L'instrument est donc **non diffusable**, et
il n'est pas seul : `FR-EAF`, `FR-EAF-ORAL`, `FR-MAI` et `PHI` le sont aussi, pour la même
raison. Le § 1 bis les compte, un test le vérifie, et les rendus `build/` ne sont pas versionnés.

## 5 nonies. Étape 3 — le bilan de sortie (2026-09-10)

Le document remis est produit par `scripts/bilan.py`, qui ne calcule rien : il lit les résultats
du moteur et les règles du référentiel, et compose les sept sections du § 8.1. Trois documents
sont rendus à la lecture de la direction :

| Document | Jeu | Registre |
|---|---|---|
| `instruments/_MAQUETTE/bilan_P3_CL-2026-0000.md` | P3, candidat majeur | candidat |
| `instruments/_MAQUETTE/bilan_P3_CL-2026-0001_parent.md` | le même candidat, variante mineure | responsables légaux |
| `instruments/_MAQUETTE_P2/bilan_P2_CL-2026-0002.md` | P2 en configuration « oral » | candidat |

La variante mineure produit aussi sa version candidat (`bilan_P3_CL-2026-0001.md`) : un candidat
mineur reçoit son bilan, ses responsables légaux reçoivent le leur. Le déclenchement est la
variable `statut_minorite` du questionnaire (§ 9), non un choix du script.

**Rendu déterministe plutôt que rédaction à la main.** Le § 1.1 pose que « la génération du texte
du bilan (rendu déterministe puis, éventuellement, reformulation assistée) intervient après le
calcul des scores et ne peut ni les modifier, ni en produire ». Le bilan manuel de l'étape 2
portait des chiffres recopiés : il datait de la maquette v1, nommait FR-ORAL retiré par Q-20, et
aucun mécanisme n'empêchait qu'il diverge du moteur. Il est retiré du dépôt et remplacé par le
rendu. Deux dispositifs tiennent l'interdit du § 8.3 :

- **Aucun chiffre n'est écrit dans un texte.** Tout nombre imprimé passe par un accumulateur qui
  l'enregistre ; **V-Texte** extrait ensuite les nombres du rendu et refuse celui qui n'a pas été
  enregistré. Un chiffre recopié à la main ne peut pas atteindre le document — le test l'exerce en
  en insérant un.
- **Un contrôle qui échoue ne se contourne pas.** Les sept contrôles du § 6.3 passent sur le corps
  composé. Si l'un échoue, le corps n'est pas diffusé : le document rendu est le relevé des
  contrôles, sous le titre « en attente ».

**EC-27 — points d'appui et priorités.** Le § 8.1 demande trois appuis et trois priorités sans
dire sur quelle population ni comment départager. Population : les compétences évaluées de tous
les périmètres passés ; départage par l'ordre des chapitres ; aucune compétence dans les deux
listes ; à effectif insuffisant, moins de lignes plutôt qu'un complément arbitraire.

**« Niveau d'entrée » et « module d'entrée ».** Le § 8.1 demande un *niveau* d'entrée dans la
synthèse, le § 8.2 définit un *module* d'entrée. Le premier est le degré du second : la synthèse
porte « Remise à niveau » ou le niveau de la compétence désignée, et la section 5 nomme le module
en entier. Les intitulés du référentiel font de trois à quinze mots ; les mettre dans une colonne
de tableau les rendait illisibles, et les abréger est proscrit.

**Emplacement réservé `{{formule_nexus}}`.** Le § 8.1 veut la formule Nexus « tarif issu de la
source de prix canonique, jamais recopié ». Cette source n'existe pas dans le dossier : le bilan
porte l'emplacement réservé, et un contrôle **V-Tarif** vérifie qu'aucun montant ne figure dans le
rendu.

**Deux constats produits par le jeu P2, qui était fait pour cela.**

1. **Le titre du périmètre FR-EAF annonçait « écrit et oral »** à un candidat qui ne repasse que
   l'oral. Le référentiel porte désormais `libelle_par_version` pour ce périmètre et le bilan
   nomme la matière d'après la version passée. Corrigé.
2. **Un P2 en configuration « oral » passe deux périmètres de français** : FR-MAI par le profil,
   FR-EAF/oral par la configuration. Le plan lui proposait alors 2 h de chacun, soit 4 h de
   français sur 12 h disponibles. Question **Q-22**, tranchée par la direction le 2026-09-10 et
   appliquée à la consolidation : § 5 decies.

**Reprise du référentiel.** Le périmètre FR-EAF n'admettait que les profils P1 et P3, alors que le
catalogue ouvrait ses trois assemblages à P2 depuis Q-19 : le validateur refusait le catalogue.
P2 est ajouté au périmètre, avec la note qui rappelle que le profil n'entre pas dans la sélection
des instruments de français.

## 5 octies. Calibration par le bloc 0 — R1, P1, P2 (2026-09-10)

**R1 — la calibration ignorait le bloc 0, et l'écart n'était pas déclaré.** Le § 5.4 nomme sa
source : « Écart entre l'auto-positionnement (bloc 0, converti sur 0–100) et le score
mesuré ». La maquette v2 lisait à la place l'auto-positionnement du questionnaire et rangeait
ce choix en « origine : conception », en affirmant que le Cahier ne disait pas le grain. La
transcription portée au référentiel disait « bloc 0 » : l'affirmation était fausse contre sa
propre source. Conséquence : trois compétences calibrées au lieu de vingt-neuf, et le bloc 0
rempli par le candidat dans chacun des quinze instruments n'était lu par personne.

Corrigé, avec l'écart déclaré EC-23 pour la conservation du grain matière depuis le
questionnaire :

- **Le bloc 0 porte désormais un identifiant imprimé**, au format
  `<CODE_INSTRUMENT>-0-<COMPETENCE>` inscrit en convention. Il ne l'était pas : la saisie
  n'avait rien à référencer. Sujet, feuille de réponses et CSV de saisie vierge le portent.
- **Le § 6.2 s'étend** : une ligne par domaine, valeur de l'échelle dans `response`, colonne
  `score` vide. `controler_lignes_saisie` accepte les trois formes de ligne — item, critère
  de grille coach, domaine de bloc 0 — et refuse un score porté sur un domaine. Le
  générateur du jeu de maquette y soumet sa propre production avant de l'écrire.
- **Un domaine sans réponse vaut « non renseignée »**, jamais un écart de zéro. La commande
  laisse EDS-SES/DOCU non renseigné pour l'exercer (attendu S-12).
- `auto_francais` sort de la calibration et devient donnée de contexte de la section 1.

**Réserve à porter à l'arbitrage.** Le bloc 0 ne compte que **cinq domaines par instrument**,
pour six à neuf compétences : **trente et un couples compétence × assemblage** restent sans
domaine, donc sans calibration par compétence. Sur le profil de la maquette, seize
compétences évaluées sont dans ce cas et le rendu le dit. Étendre le bloc 0 toucherait les
quinze instruments et relève d'une soumission préalable.

**P1 — départage des spécialités par gravité du module d'entrée**, avant le score global
(EC-16 précisé). Sur le jeu de la maquette, EDS-MATH (remise à niveau, 56 %) passe désormais
avant EDS-PC (module QUANT fragile, 50 %) : sans cette précision, l'ordre était inversé.

**P2 — écart à la commande non signalé.** Le niveau visé de COMP ne figurait pas dans la
spécification : la commande détaillée de la Porte 7 n'est pas dans les messages reçus, et le
tableau « Demandé » de l'audit, seule énumération disponible, ne portait pas ce point.
`specification.json` porte maintenant le niveau visé de COMP (attendu S-07, En consolidation)
et le champ `source_complement` dit d'où il vient. Un attendu S-12 est ajouté pour le domaine
non renseigné.

## 5 septies. Configurations du français — Q-19, Q-20, Q-21 (2026-09-10)

Un candidat individuel qui se représente conserve ses notes épreuve par épreuve pendant cinq
ans, et l'écrit et l'oral de l'épreuve anticipée sont deux épreuves distinctes. La
configuration « oral seul » existe donc, et le Cahier ne la couvrait pas.

**Q-19 — la configuration est une variable, orthogonale au profil.**
`epreuves_francais_a_presenter` ∈ {`les_deux`, `ecrit`, `oral`, `aucune`}, fermée et typée.
`eaf_deja_passe` devient dérivée (`aucune` ⇒ oui) et sort du formulaire. La matrice du § 3.2
est amendée : les instruments de français sont indexés par cette variable, les autres par le
profil. Un P2 qui repasse l'oral est un P2 en configuration `oral`.

**Q-20 — FR-EAF-ORAL remplace FR-ORAL (EC-24).** Deux passations orales pour un même
candidat n'ont pas de sens : la langue parlée se mesure dans l'exercice réel. Vingt minutes,
extrait du domaine public de 10 à 12 lignes, dix minutes de préparation, cinq d'explication
linéaire, une question de grammaire, quatre d'entretien. Cinq critères, quatre compétences
propriétaires : LANG-ORAL (nouvel indicateur transversal de la famille LANGUE, deux
critères), EXPL (production), GRAM (existante), ENTR. `instruments/FR-ORAL/` est retiré du
dépôt ; ses critères survivent dans la nouvelle grille. Coût de passation : cinq minutes
nettes pour P1 et P3.

**Q-21 — trois assemblages, masquage à l'assemblage (EC-26).** Chaque compétence de FR-EAF
porte un champ `epreuve`. `standard` reprend l'assemblage existant ; `ecrit` retire GRAM ;
`oral` retient COMP, ANAL, CULT et GRAM, items de types A et B seulement, sans REDA ni bloc C.
Un contrôle du validateur refuse tout item dont l'épreuve est incompatible avec la
configuration de son assemblage, et la table de compatibilité est au catalogue, non dans le
script. **La durée de l'assemblage oral est de 50 minutes et non des 45 estimées** :
quarante-huit minutes d'items plus deux de bloc 0.

**EC-25 — couverture des compétences mesurées par une grille coach.** EXPL, ENTR et LANG-ORAL
n'ont aucun item : les règles de couverture par items ne peuvent pas s'y appliquer. Le
précédent existait pour FR-MAI/ORAL (EC-07) ; il est généralisé aux catégories ordinaire et
production, avec un minimum d'un critère propriétaire, et le validateur vérifie que la grille
nommée existe réellement. Le code composé `LANG-ORAL` n'est admis que parce qu'il n'entre
jamais dans un identifiant d'item : le contrôle de format le réserve aux compétences
mesurées hors items.

## 5 sexies. Maquette v2 — application de l'audit du 2026-09-10

L'audit de la direction (partie I) refusait la maquette v1 sur trois points. Ils sont
traités ici ; le tableau « demandé / livré » est produit par le script lui-même, en fin de
`instruments/_MAQUETTE/maquette_bilan.md`.

**A — le jeu de données ne suivait pas la commande, et ne le disait pas.** La commande est
désormais un fichier, `instruments/_MAQUETTE/specification.json` : onze attendus, chacun
avec ses vérifications exécutables, et cent quatre cibles de points par compétence, bloc et
palier. `scripts/maquette_donnees.py` en dérive `saisie.csv` et `grilles.csv` ; plus aucune
valeur n'est écrite à la main. `verifier_specification()` confronte le bilan produit à
chaque attendu, le rendu porte le tableau, et `tests/test_maquette.py` échoue sur le moindre
écart — y compris, à titre de démonstration, sur les 10 h de la v1.

Deux points de la commande sont impossibles par construction et sont signalés comme tels
avec leur raison : le taux de prérequis exact de 35 % sur EDS-MATH/NT, dont le bloc A compte
vingt-quatre items à un point ; et un code d'erreur dominant sur EDS-PC/QUANT, qui n'a que
des items de type A en version Terminale. Un troisième l'est aussi, hors attendus : avec 18 h
déclarées, un P3 ne peut pas dépasser le plafond, six matières à 3 h faisant 18 h — c'est le
raisonnement même de EC-18. Les branches non exercées par le jeu sont couvertes par des
tests unitaires.

**B — le rapport affirmait ce que le code contredisait.** Les seuils étaient déjà passés au
référentiel (§ 5 quinquies). Restaient trois défauts : les trois matières codées en dur, les
intitulés tronqués à soixante caractères, et l'absence de test. Les matières se déduisent
maintenant du profil et des spécialités déclarés au questionnaire, par le catalogue et sa
nouvelle convention `selection_version_specialite` — la maquette rend cette dérivation
visible en « Règle 0 ». Les intitulés sont entiers. Trois tests statiques ferment les trois
défauts : aucun seuil, aucune matière, aucune troncature dans le script.

**C — six décisions appliquées**, enregistrées comme écarts au Cahier EC-16 à EC-22 :

| Décision | Écart | Objet |
|---|---|---|
| C1 | EC-19 | Évaluation intermédiaire bornée au module d'entrée : 9 compétences au lieu de 26 |
| C2 | EC-17 | Le rythme se fonde sur le niveau le plus bas de la matière |
| C3 | EC-16 | Départage des spécialités par fragilité ; français avant la philosophie s'il est fragile |
| C4 | EC-18 | Seuil d'alerte à 15 h ; paragraphe unique quand les deux alertes coïncident |
| C5 | EC-20, EC-21 | Décision Grand oral à 50 % ; oral de français en section 3, sans rythme |
| C6 | EC-22 | Le taux de prérequis se lit avec le statut déclaré de la spécialité |

**Deux ajouts non demandés, mais imposés par les interdits du prompt.** Le § 5.5 était
appliqué de façon approximative : le score global rapportait des points au lieu de pondérer
les S(c) par le nombre de mesures, et le taux de prérequis prenait tous les points des
compétences ayant un item en A au lieu des seuls items du bloc A. Les deux formules sont
maintenant celles du Cahier, et deux tests vérifient que les résultats diffèrent de
l'approximation — sans quoi ils ne prouveraient rien. Par ailleurs, les écarts EC-16 à EC-22
ne sont racontés qu'une fois, dans le registre `ecarts_cahier` de `competences.json` :
`regles_bilan.json` n'en porte que la référence et le contrôle RB-10 refuse toute copie.

**Contrôles ajoutés au validateur de référentiels** : RB-07 (toute transcription cite un
texte qui existe réellement dans le Cahier, tableaux compris — d'où le parseur de cellules
à colonnes fixes), RB-08 (toute règle porte une source), RB-09 (la sélection de version de
spécialité désigne des versions ouvertes au profil), RB-10 (registre unique des écarts).

**Version parent** : `maquette_bilan_parent.md`, produite sur la variante mineure. Un test
vérifie que les deux documents sont identiques hors titre, référence candidat, statut de
minorité et paragraphe de destinataire — donc qu'aucun chiffre ne diffère.

## 5 quinquies. Seuils du moteur de bilan — correction du 2026-09-10

Le prompt interdit d'« écrire une valeur (durée, score, seuil, intitulé) en dur dans un script
ou un gabarit au lieu de la lire depuis la source ». `scripts/maquette_bilan.py` violait cet
interdit sur huit valeurs, et sa docstring affirmait le contraire. Les seuils du § 5.2, du
§ 5.3 et du § 5.5 n'étaient inscrits dans aucun référentiel : ils n'existaient que dans le code.

- **Créé** `referentiels/regles_bilan.json` — source unique des paliers de niveau (§ 5.2), de
  la fraction du palier de profondeur (§ 5.3), de l'écart de calibration (§ 5.4), du seuil de
  prérequis (§ 5.5), des rythmes hebdomadaires, du seuil d'alerte de charge et du délai de
  l'évaluation intermédiaire (§ 8.2).
- **Rebranché** le moteur et, surtout, les phrases de citation, qui réécrivaient les mêmes
  chiffres une seconde fois à la main. Aucun nombre n'est écrit dans un texte : les phrases du
  § 5.2 et du § 8.2 sont composées depuis les valeurs du référentiel.
- **Ajouté** les contrôles RB-01 à RB-06 au validateur de référentiels et
  `tests/test_regles_bilan.py` (17 tests). Les quatre tests statiques échouent sur la version
  d'avant correction ; les quatre tests dynamiques échouent si un seuil est lu ailleurs qu'au
  référentiel.
- **Vérifié** que le rendu ne bouge que là où Q-18 le fait bouger : la colonne « Palier » de la
  maquette est identique caractère pour caractère à la version d'avant.

RB-05 mérite d'être signalé : il refuse un seuil d'alerte de charge que la matrice du § 3.2
rend inatteignable. Éprouvé sur les 20 h du Cahier, il produit — sans que le chiffre lui soit
donné — le plafond de 18 h qui fonde la décision Q-18 : 3 h × 6 matières pour un P3.

## 5 quater. Reprises et décisions appliquées le 2026-09-10 (Porte 1c)

| # | Objet | Application |
|---|---|---|
| R1 | Test négatif versionné | `tests/test_validate_referentiel.py` — 46 cas pytest, un par défaut injecté, plus les exceptions de domaine et les emplois disciplinaires qui doivent passer. |
| R2 | Exceptions en motifs testables | Chaque exception porte `regex`, `perimetres`, `justification` et `exemple`. Un contrôle refuse toute exception **décorative** : son exemple doit déclencher un motif parent. Trois exceptions ont été retirées à ce titre. |
| R3 | Couverture des tournures | Chaque expression peut porter des `regex` couvrant les personnes (« vous », « le candidat », « l'élève », « votre enfant », « il/elle ») et les tournures nominales. Voir le rapport de la Porte 1c. |
| D1 | « trop tard » | Intégré, catégorie `anxiogene`, tous contextes. |
| D2 | « il suffit de » / « c'est facile » | Intégré, catégorie `minimisation`, contexte `cle_correcteur` exempté. |
| D3 | Compléments à la liste | « lacune », « niveau insuffisant », « faible », « mauvais », « médiocre », « incapable », « grave » appliqué à une difficulté, « ne pourra pas », « n'a aucune chance », « trop juste », « il faut tout reprendre ». Un mot isolé n'est admis que si ses contextes interdits excluent les énoncés candidat et la clé correcteur ; ce point est lui-même contrôlé. |

## 5 ter. Précisions de la direction appliquées le 2026-09-10 (Porte 1b)

| # | Objet | Application |
|---|---|---|
| P1 | Trois catégories de couverture | `ordinaire` (3 items / 2 paliers), `production` (1 item C à ≥ 3 critères valant 3 sources + ≥ 1 item A/B à un autre palier en bloc D), `indicateur_transversal` (≥ 2 sources). 14 compétences classées `production`. `EC-01` mis à jour. |
| P2 | PHI/REP tranché | Cournot, Ricœur, Anscombe, Rawls, Simondon, Beauvoir, Simone Weil intégrés au noyau en confiance haute ; Canguilhem et Habermas retirés. Source officielle inscrite au chapitre. PHI/REP sort de `a_verifier`. |
| P3 | Durées | Aucune constante de durée par type : chaque item porte son `duree_min`, sommé par le validateur. L'hypothèse A = 1 min / B = 2 min est rangée sous `hypothese_planification` avec la mention « non utilisée par le validateur ». Références de rédaction : A 1–1,5 min ; B 2–3 min ; C durée déclarée par l'item. |
| P4 | HLP/CULT | Mesurée par reconnaissance et mise en relation, jamais par rappel. Règle inscrite en `regle_redaction`. Confiance portée à haute. |
| P5 | Hygiène de rapport | « Arbitrages tracés » et « Questions d'arbitrage » sont désormais deux sections distinctes, présentes même vides. |

## 5 bis. Amendements de la direction appliqués le 2026-09-10

| # | Objet | Application |
|---|---|---|
| A1 | TC-ES : ajout de `ASTR` « La Terre, un astre singulier » | Créée, version 1RE et ETENDUE, 3 chapitres officiels. Tracé `EC-04`. |
| A2 | TC-ES : scission de `TERR` en `CLIM` et `ENER` | `TERR` supprimée ; `CLIM` (4 chapitres) et `ENER` (4 chapitres) créées en TLE et ETENDUE. `INFO` reprend l'intitulé officiel « Une histoire du vivant » et ses 4 sous-thèmes. Tracé `EC-04`. |
| A3 | HGGSP : thème omis | Il s'agit bien de « De nouveaux espaces de conquête » (Terminale). Ajouté à `CONN` en confiance haute. |
| A4 | PC : répartition des niveaux | Kepler et gravitation → niveau T, bloc B de NT, paliers D1–D2. Intensité sonore, atténuation et lunette astronomique → niveau T. `OND` en Première : ondes mécaniques, lentilles minces et images, couleur des objets. |
| A5 | FR-EAF/`GRAM` : périmètre restreint | Intitulé amendé ; « expression du temps » retirée, ne subsiste que « subordonnée circonstancielle de temps ». 5 chapitres. Tracé `EC-05`. |
| A6 | NSI : prérequis de niveau 2 | Algorithmique de seconde (maths) → `PYTH` ; SNT (données structurées, Web, réseaux) → `REPR`, qui passe en blocs A et B pour N1. Tracé `EC-06`. |

## 6. Divergences prompt / Cahier relevées à l'audit

1. **Position de FR-ORAL.** Le prompt le place en Porte 2 (avec FR-EAF) ; le Cahier § 10
   le place au livrable 4 (semaine 2, avec PHI, FR-MAI, GO). *Le Cahier l'emporte* :
   FR-ORAL est traité en Porte 4, sauf instruction contraire de la direction.
2. **Format d'identifiant.** Le prompt impose `MATIERE-NIVEAU-COMPETENCE-NN`, mais
   l'exemple donné par le prompt **et** par le Cahier § 4.2 est `FR-EAF-COMP-02`, où
   `EAF` est un périmètre et non un niveau de programme (2/1/T). Une convention
   explicite est nécessaire pour les instruments non-EDS (question d'arbitrage n° 6).
3. **Règle de couverture vs. compétences de production.** Le Cahier § 4.2 impose ≥ 3 items
   sur ≥ 2 paliers par compétence ; le Cahier § 7 attribue à plusieurs compétences un
   unique item de type C (FR-EAF/REDA, PHI/TEXT, PHI/DISS, FR-MAI/SYNT, FR-MAI/ARGU,
   HLP/INTER, HLP/ESSAI, SES/DOCU). Ces compétences sortiraient « Non évaluée ».
   Contradiction interne au Cahier à arbitrer (question n° 7).
4. **Volumétrie TC-ES.** Le Cahier § 7.4 décrit 26 items A + 10 items B (36 items) pour
   40 min ; à durée réaliste (1 min/A, 2 min/B) le total est ≈ 46 min, hors bloc 0.
   Incompatible avec la fenêtre 90–100 % du catalogue (question n° 8).
5. **Bloc D non rattaché.** Le squelette § 4 impose un bloc D à tout instrument, mais les
   tableaux de compétences du § 7 ne prévoient pas systématiquement de compétence
   d'accueil pour ces items (cas de FR-EAF, FR-MAI, TC-ES). Rattachement à arbitrer (n° 7b).


<!-- HISTORIQUE fin -->

## 8. Questions d'arbitrage reportées

Chacune sera reposée **complète, avec recommandation, à la porte qu'elle bloque**.

| # | Question | Recommandation | Bloque |
|---|---|---|---|
| **Q-24** | **Épreuve anticipée de mathématiques**, créée à compter de la session 2027 (2 h, coefficient 2, sans calculatrice) : le Cahier l'ignore, aucun instrument ne la mesure, et le questionnaire n'a pas de variable pour la porter. | Ouvrir une variable `maths_anticipees_a_presenter` sur le modèle du français, puis créer un instrument dédié — l'épreuve a son format propre et concerne aussi les candidats sans spécialité mathématiques, qu'aucun périmètre actuel ne couvre. Dossier complet au § 5 undecies. | **Généralisation — arbitrage requis avant toute création d'instrument** |
| **Q-26** | **Éligibilité au passage de toutes les épreuves à la même session** : le profil P3 était ouvert à qui le demandait, alors que l'article 3 de l'arrêté du 16 juillet 2018 énumère les situations qui l'autorisent. | Matrice, règle déterministe et variables minimales proposées au § 7 ; confirmer le texte au Journal officiel, puis décider l'entrée des six variables au questionnaire. Tant que la réserve tient, aucun bilan de production ne devrait ouvrir P3 sans fondement enregistré. | **Généralisation — arbitrage requis** |

## 8 bis. Questions tranchées

Elles ne sont plus des questions : elles sont des décisions en vigueur. Le détail est à
l'historique, section indiquée.

| # | Objet | Décision | Où |
|---|---|---|---|
| Q-08 | Instruments sans items scorés | Structure allégée `definition.json` ; le validateur n'applique que les contrôles pertinents | Portes 4 et 7 |
| Q-13 | NSI — barème du critère « tests passés » | Conversion par tranches, `conventions.bareme_tests_machine` | Porte 6 |
| Q-14 | SVT — critères de grille rattachés à DOC | Chaque critère est rattaché à sa compétence propriétaire (EC-08) | Porte 5 |
| Q-19 à Q-21 | Configurations du français | Variable de configuration, FR-EAF-ORAL, trois assemblages | § 5 septies |
| Q-22 | Deux périmètres de français pour un P2 | FR-MAI conservé ; groupe de planification FRANCAIS (EC-28) | § 5 decies |
| Q-23 | Priorité du français pour un P1 | Couverture produite, jeu `_MAQUETTE_P1` ; aucun arbitrage nécessaire | § 5 undecies |
| Q-25 | Séquencement d'une charge élevée | Il descend de l'ordre du plan et des prérequis bloquants (EC-30) | § 5 duodecies |

## 9. Chapitres dont la conformité au programme reste incertaine

| Confiance | Périmètre / compétence | Objet | Traitement |
|---|---|---|---|
| `haute` | FR-EAF / CULT | Œuvres et parcours de la session 2027 | **Levé le 2026-09-10** : `referentiels/programmes_examen.json` porte le programme de la session 2027 (NOR MENE2418442N), un contrôle confronte chaque œuvre citée à ce référentiel, et l'item de repères qui donnait *Pot-Bouille* (session 2028) pour bonne réponse a été corrigé. |
| `a_verifier` | PHI / REP | Auteurs dont l'appartenance à la liste officielle n'est pas garantie : Cournot, Canguilhem, Simondon, Ricœur, Rawls, Habermas, Anscombe, Simone Weil, Beauvoir | Aucun item tant que la direction n'a pas confirmé. Le noyau de 45 auteurs en confiance haute suffit à couvrir la compétence. Règle inscrite dans le référentiel : aucune thèse attribuée sans œuvre citable dans `notes_conception`. |
| `moyenne` | EDS-SES / POL | Rattachement à POL de « justice sociale » et « action publique pour l'environnement », qui relèvent des regards croisés | Choix du Cahier § 7.10, conservé tel quel. |
| `moyenne` | EDS-HLP / CULT | Le programme HLP ne fixe pas de liste fermée d'auteurs | Items restreints aux auteurs et œuvres du domaine public dont le rattachement à un thème est incontestable. |

## 9 bis. Passation des formulaires

QP et MET (Porte 7) collecteront des données personnelles. **La saisie se fait sur la plateforme** ;
le formulaire papier n'est qu'un secours pour une passation empêchée (§ 3.2, qui n'admet la
passation à distance que pour ces deux instruments). Aucun document rendu ne porte de valeur de
test ni d'exemple nominatif.

## 9 ter. Données des supports

Toute donnée d'un tableau ou d'une figure porte soit une **source publique citée**, soit la mention
**« données simulées à visée pédagogique »**, dont les ordres de grandeur sont justifiés dans les
`notes_conception` de l'item. Un contrôle du validateur refuse toute autre situation. Les figures
sont **générées par le build** depuis les données de la banque (matplotlib, rendu vectoriel
déterministe) ; aucune image externe n'est insérée, aucun document de manuel n'est reproduit.

| Support | Provenance |
|---|---|
| `PC-EXP-TAB` — ressort | Données simulées ; raideur ≈ 25 N/m, longueur à vide 10 cm |
| `SVT-DOC-TAB`, `SVT-DOC-FIG` — activité enzymatique | Données simulées ; optimum ≈ 37 °C, dénaturation au-delà de 45 °C |
| `SVT-ECO-FIG` — CO₂ atmosphérique | NOAA Global Monitoring Laboratory, Mauna Loa, relevé 2024, URL citée |
| `SES-STAT-TAB` — taux de chômage | INSEE, enquête Emploi en continu, édition 2024, URL citée |
| `SES-DOCU-FIG` — chômage selon le diplôme | INSEE, enquête Emploi, édition 2024, URL citée |

## 9 quater. À vérifier avant impression

Éléments dont la source est extérieure au dossier. Aucun n'empêche la validation d'un
instrument ; tous doivent être confirmés avant qu'un document soit imprimé. Une ligne barrée est
une vérification faite : elle reste au tableau pour mémoire, datée.

| Élément | Valeur à confirmer | Employé par |
|---|---|---|
| INSEE, enquête Emploi en continu — taux de chômage BIT | Millésime de l'édition (2024), URL `insee.fr/fr/statistiques/2012804`, valeurs 2015-2023 | `SES-STAT-TAB` |
| INSEE, enquête Emploi — chômage selon le diplôme | Millésime de l'édition (2024), URL `insee.fr/fr/statistiques/2489498`, quatre valeurs par diplôme | `SES-DOCU-FIG` |
| NOAA Global Monitoring Laboratory, Mauna Loa | Relevé 2024, URL `gml.noaa.gov/ccgg/trends/data.html`, valeurs 1960-2020 | `SVT-ECO-FIG` |
| SIPRI, Military Expenditure Database | Édition 2024, URL `milex.sipri.org/sipri`, dix valeurs de dépenses | `HGGSP-DOC-TAB` |
| ~~Note de service EAF session 2027~~ | **Levé le 2026-09-10** : la note NOR MENE2418442N est vérifiée et portée par `referentiels/programmes_examen.json`, avec sa phrase d'applicabilité ; un contrôle confronte chaque œuvre citée au programme de la session de l'assemblage. | `FR-EAF/CULT` |

## 10 bis. Leçons de conduite

| # | Leçon | Origine |
|---|---|---|
| L-01 | **Une anomalie non reproductible se traite en la rendant capturable, jamais en la déclarant close.** Le déterminisme des PDF divergeait une exécution sur trois. Signalée sans cause en Porte 3, elle a été outillée en Porte 4 (`--check-determinisme`, archivage des divergences avec leur version `qdf`), puis élucidée en Porte 6 : xdvipdfmx range parfois le trailer dans un flux compressé et `/ID` n'y apparaît pas en clair. Sans l'outil de capture et sans le garde-fou qui fait échouer le build quand le patch ne s'applique pas, des PDF non reproductibles seraient sortis en silence. | Portes 3 à 6 |
| L-02 | **Une hypothèse écartée sur une observation mal lue doit être rouverte, pas oubliée.** La cause du point précédent avait été formulée dès la Porte 4 puis abandonnée sur la foi d'un `grep` sur un binaire, dont le résultat avait été mal interprété. Elle était juste. | Portes 4 et 6 |
| L-04 | **Un chiffre recopié à la main se désynchronise du calcul dès la première correction.** Le bilan manuel portait « 58 % » pour la compréhension en français : la valeur était juste avant que la correction du périmètre des grilles coach ne la porte à 62 %, et je ne l'avais pas reprise. Le rapprochement texte/JSON exigé par la direction l'a attrapée en une exécution. C'est la justification de ce contrôle, obtenue sur mon propre document. | Porte 8 |
| L-05 | **Une docstring qui affirme une propriété ne la vérifie pas ; elle la dissimule.** `scripts/maquette_bilan.py` déclarait « Aucun seuil n'est écrit ici : tout vient des référentiels » alors qu'il en contenait huit, dont trois qui n'existaient dans aucun référentiel. La phrase a fonctionné comme une garantie et a dispensé de regarder. Toute propriété qu'un module s'attribue doit être tenue par un test qui échoue quand elle est fausse : `tests/test_regles_bilan.py` échoue sur la version d'avant correction, pour les quatre familles de seuils. | Porte 8 |
| L-06 | **Un seuil fractionnaire ne se stocke pas en décimale tronquée.** La part du palier de profondeur, portée au référentiel comme `0.6667`, est supérieure à 2/3 : vingt paliers réussis 4 points sur 6 sont sortis déclassés à la première régénération. Le rapprochement avec le rendu d'avant correction l'a montré en une ligne de `diff`. La part est désormais une fraction exacte, comparée par produit en croix. | Porte 8 |
| L-07 | **Une spécification tenue hors du dépôt n'est pas opposable.** Le jeu de la maquette v1 s'écartait de la commande sur neuf points ; aucun contrôle ne pouvait le voir, puisque la commande n'existait que dans un message. Portée en fichier avec des vérifications exécutables, elle rend l'écart impossible à taire — et elle a immédiatement rejeté deux de mes propres cibles, mal calculées à la main. | Porte 8 |
| L-08 | **Une règle appliquée « en gros » se découvre en l'écrivant à la lettre.** Le § 5.5 était appliqué depuis six portes avec deux approximations — pondération par les points au lieu du nombre de mesures, assiette du bloc A prise sur les compétences au lieu des items. Aucune validation ne les voyait : elles produisaient des nombres plausibles. Il a fallu relire la phrase du Cahier pour les trouver. | Porte 8 |
| L-03 | **Un item ajouté pour une raison de forme doit être justifié par une raison de fond, ou retiré.** Un item ajouté en Porte 6 pour une marge de durée ne renforçait aucun palier fragile ; il a été conservé parce qu'il couvre un thème du programme sous-représenté, et sa note de conception le dit explicitement. | Porte 6 |

## 10. Améliorations différées

Hors périmètre des portes, à reprendre après la V1.

| # | Objet | Motif du report |
|---|---|---|
| AD-01 | Passage de XeLaTeX à LuaLaTeX pour disposer d'une police de texte à empattements avec repli sur une police symbole | Décision D3 du 2026-09-10. En V1, DejaVu Sans est la police de tout le document : c'est la seule des polices installées qui couvre U+2610, la case à cocher employée par le bloc 0, les items de type A et la feuille de réponses. Un repli par plage de caractères demande LuaLaTeX. |
| AD-04 | **MET : porter chaque dimension à cinq questions.** Avec trois questions à poids 0-1-2, une seule réponse peut faire franchir un seuil de niveau. Accepté en V1 parce que MET n'alimente que la section 6 du bilan — l'outillage — et n'entre dans aucune règle de décision du § 8.2 : vérifié, aucune variable QP ne cible une dimension MET, et aucune règle du § 8.2 ne lit MET. | Décision de la direction du 2026-09-10. À reprendre en V2. |
| AD-03 | Notation mathématique : toute expression passe par la notation LaTeX de pandoc entre `$…$`, rendue nativement. Un contrôle refuse les caractères Unicode d'indice, d'exposant et de symbole hors mode mathématique. | Reprise R2 du 2026-09-10. Les indices Unicode ne couvrent ni les fractions, ni les racines, ni les limites, et DejaVu ne porte pas toutes les formes. |
| AD-02 | Répartition des durées par bloc conforme aux indications du § 4 | Décision D4 : ces durées sont indicatives et non validées. Le bloc B de FR-EAF dure 50 min pour une indication de 25 à 35, conséquence de la volumétrie du § 7.1. La fenêtre du catalogue et la couverture restent la loi. |
