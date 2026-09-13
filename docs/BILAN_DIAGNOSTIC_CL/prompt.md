# Passation — pour l'instance antigravity

Dépôt : `/home/alaeddine/Téléchargements/BILAN_DIAGNOSTIC_CL`, branche `diagnostic/instruments`.

Une autre instance (Claude Code) vient de fermer huit bloqueurs d'acceptation sur la chaîne
de production des livrets candidats. Son travail est commité en `6c498d2` — « Fermeture des
huit bloqueurs d'acceptation ». Tu reprends à partir de là **sans défaire ce qui suit**.

**Ton périmètre** : ajout des disciplines manquantes — histoire-géographie, EMC, et niveau
de français. Rien d'autre.

---

## 1. Partage des fichiers

**À toi, écris librement :**

| Chemin | Contenu |
|---|---|
| `instruments/<NOUVEAU_CODE>/**` | banques, assemblages, définitions, formulaires |
| `referentiels/competences.json` | périmètres, compétences, chapitres |
| `referentiels/textes_sources.json` | registre des textes sources |
| `referentiels/catalogue_instruments.json` | entrées instrument × version |
| `tests/test_<ta_discipline>.py` | tes tests disciplinaires |

**À l'autre instance — ne modifie que pour déclarer ta discipline (§ 3) :**

`scripts/livret.py` · `scripts/release_v2.py` · `scripts/distribution.py` ·
`scripts/planche_contact.py` · `templates/nexus-livret.tex` · `tests/test_design.py`

**Artefacts générés — ne les édite jamais à la main :**

`release/diagnostics-v2/**` · `build/**` · `MANIFESTE_DEPOT.json` · `MANIFESTE_DEPOT.md` ·
`DISTRIBUTION_MATRIX.csv` · `STUDENT_PACK_MATRIX.csv` · `CANDIDATE_PROFILES.csv` ·
`PRINT_MATRIX.csv`

**Ne commite jamais avec `git add -A`.** Ajoute tes fichiers un par un. Le fichier non suivi
`Test de positionnement _ Candidat.pdf`, à la racine, appartient à la direction : laisse-le
non suivi.

---

## 2. Invariants que ton travail ne doit pas casser

Huit règles sont tenues par des tests. Si l'un tombe, c'est ton ajout qui est en cause, pas
le socle.

**B1 — Identité d'artefact.** Un livret est identifié par (profil, matière, variante
réglementaire). Deux variantes ne partagent jamais un chemin. `release_v2.variante()` dit la
variante, `release_v2.nom_livret()` en tire le nom de fichier, et la construction s'arrête
sur une collision de chemin.

**B2 — Manifeste sans doublon.** `artifact_id` et `path` uniques. `ecrire_manifeste()` lève
`SystemExit` sur *duplicate artifact_id* ou *duplicate canonical path*.

**B3 — Manifeste complet.** Tout fichier de `release/diagnostics-v2` est manifesté, sauf
`MANIFESTE_V2.json` et `MANIFESTE_V2.md`. Le manifeste porte le commit source. Si tu ajoutes
un fichier à la release, il doit y entrer automatiquement.

**B4 — Rien sous `build/` ne ressemble à un envoi.** Pas de `A_ENVOYER`, pas de
`PACK_CANDIDAT`, pas de `FINAL`, pas de `PROD`. Source officielle d'envoi, unique :
`release/diagnostics-v2/01_LIVRETS_CANDIDAT`.

**B5 — Aucune épreuve dont le candidat est dispensé dans son livret.** Les items d'une partie
pratique se déclarent dans `referentiels/modalites_epreuves.json` →
`epreuves_terminales.<CODE>.partie_pratique.items_hors_livret_candidat`. Ils restent dans la
banque et dans le moteur ; seul le livret ne les imprime pas.

**B6 — Aucun balisage brut.** Les énoncés sont écrits en balisage léger — `**gras**`,
`` `code` ``, `*emphase*`, puces `- ` — et `livret.tex()` le convertit. N'écris pas de LaTeX
dans une banque et n'invente pas d'autre balisage : tout `**`, `__`, `## ` ou `[texte](lien)`
restant dans un PDF fait échouer `test_aucun_balisage_markdown_brut`.

**B7 — Numérotation unique.** Un livret qui réunit plusieurs instruments a des `MODULE A` /
`MODULE B` et une numérotation de parties continue. Jamais deux « Partie 1 » dans le même
document.

**B8 — Pas de consigne sans tâche.** Si un livret ne porte aucune zone de réponse, la page
« Avant de commencer » ne dit pas « répondez à toutes les questions ».

**Zéro jargon technique dans un PDF candidat** : ni `N1`, ni `NT`, ni `SPECIFIQUES`, ni
`ETENDUE`, ni `standard_2028`, ni chemin de dépôt, ni nom de script, ni empreinte. La
traçabilité est au manifeste et sur la couverture du correcteur.

**Zéro fuite de correction** : ni clé, ni distracteur, ni grille, ni code d'erreur, ni seuil,
ni section « réservé au coach » dans un document candidat.

---

## 3. Ce que tu dois déclarer pour qu'une discipline entre dans la release

Pour chaque discipline ajoutée — histoire-géographie, EMC, niveau de français :

### a) `referentiels/modalites_epreuves.json`

- une entrée dans `epreuves_terminales` **ou** dans `evaluations_ponctuelles`, avec intitulé
  officiel, type, classe, coefficient, durée, nature, structure, programme, matériel,
  calculatrice, source, NOR, date du texte, confiance ;
- `materiel_court` si le matériel se décrit par une phrase — le cartouche de couverture tient
  en trois mots ;
- **retire** la discipline de `couverture_nexus.non_couverts` et ajoute-la à
  `couverture_nexus.couverts` ;
- **mets à jour** `coefficients_couverts_controle_continu` et
  `coefficients_non_couverts_controle_continu` (aujourd'hui **14 / 26**). Ces deux nombres
  sont lus par le guide opérateur et par la matrice de couverture.

### b) `scripts/livret.py`

| Structure | Ce que tu ajoutes |
|---|---|
| `MATIERES` | `(nom lu par le candidat, sous-titre)` — jamais un code |
| `COMPOSITION` | les codes d'instrument qui composent la matière |
| `EPREUVE_DE` | les épreuves officielles correspondantes, pour que la couverture et la page 2 lisent les faits réglementaires au référentiel |
| `LIBELLE_MODULE` | seulement si ta matière réunit plusieurs instruments |

### c) `scripts/release_v2.py`

- `ORDRE_IMPRESSION` : place ta matière dans l'ordre de passation, sinon
  `test_le_pack_dimpression_place_toutes_les_matieres` échoue ;
- `variante()` : **seulement** si ta discipline a plusieurs situations réglementaires dans un
  même profil, comme les mathématiques avec ou sans spécialité. Sinon elle retombe d'elle-même
  sur `("UNIQUE", "")` et le nom de fichier reste simple.

### d) `scripts/distribution.py`

Rien à faire si ton instrument suit les conventions existantes : il est découvert par le
catalogue.

---

## 4. Trois pièges qui ont déjà coûté cher

**Polices.** La face italique d'EB Garamond est installée aussi en `.woff`, que `xdvipdfmx`
ne sait pas embarquer : il s'arrête, laisse le PDF de la passe précédente, et LaTeX ne
signale rien. `livret.options_police()` épingle les fichiers par leur nom. Si tu introduis
une autre police, épingle-la de la même façon.

**Cache de figures.** Les livrets se composent en parallèle et partagent
`instruments/*/build/`. Les figures s'écrivent désormais de façon atomique — fichier
temporaire puis `os.replace`. Si tu ajoutes une écriture dans un dossier partagé pendant la
composition, fais-la atomique elle aussi.

**Machine partagée.** Huit compositions simultanées ont fait tuer le build par le noyau. Le
défaut est prudent ; `NEXUS_COMPOSITEURS=<n>` l'ajuste.

---

## 5. Comment finaliser, dans cet ordre

```bash
python3 scripts/validate_instrument.py --tous   # 0 erreur attendu
python3 scripts/distribution.py                 # banc de contrôle
rm -rf release/diagnostics-v2
python3 scripts/release_v2.py                   # 0 échec attendu
python3 scripts/etat_depot.py                   # recalcule les blocs du README
python3 scripts/audit_readme.py                 # 0 incohérence
python3 scripts/release.py                      # manifeste du dépôt
python3 -m pytest -q                            # 0 échec, 0 ignoré
```

Ne lance pas deux de ces commandes en même temps, et ne lance pas le build pendant que la
suite tourne : la suite lit la release.

Puis, pour chaque discipline ajoutée, **vérifie sur les PDF réels**, pas sur les tests seuls :
ouvre le livret candidat et contrôle la couverture — logo, profil en clair, matière, durée,
épreuve officielle —, la page 2, la numérotation des parties, les zones de réponse, les
documents d'appui, et l'absence de tout code technique.

---

## 6. Ce qui reste vrai et que tu ne dois pas re-déclarer

Tant que l'histoire-géographie, l'EMC, la LVA, la LVB et l'EPS ne sont pas toutes couvertes,
le dispositif ne peut pas être présenté comme une couverture complète du baccalauréat du
candidat individuel. Deux statuts distincts sont tenus :

| Statut | Ce qu'il affirme |
|---|---|
| `DIAGNOSTICS_NEXUS_SUPPORTED_COMPLETE` | tout ce que Nexus offre est prêt |
| `REGULATORY_BAC_COVERAGE_COMPLETE` | toutes les évaluations obligatoires sont couvertes — **faux aujourd'hui** |

Ne déclare le second que lorsque le décompte de coefficients du § 3.a le justifie, et que la
matrice `COUVERTURE_REGLEMENTAIRE` ne porte plus aucun « NON COUVERT PAR LE DISPOSITIF
NEXUS » autre que l'EPS.

**L'EPS ne doit jamais être déclarée couverte par un diagnostic écrit** : l'évaluation porte
sur trois activités physiques relevant de trois champs d'apprentissage, et aucun document ne
peut en tenir lieu.
