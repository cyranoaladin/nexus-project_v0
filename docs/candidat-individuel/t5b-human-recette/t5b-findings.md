# T5B — Findings produit (§17)

Deux défauts produit ont été observés pendant l'inspection du PDF famille réel (§12). Aucun n'a été
corrigé (interdiction §0 respectée) — ce sont des observations, pas des corrections. Les deux sont
préexistants (aucun n'a été introduit par T5R2 ni par ce lot T5B, qui n'a modifié aucun code) et
apparaissent de façon reproductible sur R1a, R1b et R2.

---

## T5B_FINDING_1 — `SEVERITY = MAJOR`

**Scénario** : R1a, R1b, R2 (tous les scénarios testés).

**Fichier concerné** : `R1-standard/R1a-pdf-original.pdf` (page 2, section "Profil élève et famille"),
`R1-standard/R1b-pdf-original.pdf` (page 2), `R2-headcount/R2-pdf-original.pdf` (page 2). Texte extrait :
`technical/R1a-pdf-original.txt`, `technical/R1b-pdf-original.txt`, `technical/R2-pdf-original.txt`.

**Attendu** : les champs "NIVEAU" et "NIVEAU RESSENTI" du PDF famille affichent un libellé
compréhensible par une famille (ex. "Terminale", "Première", ou une formulation équivalente en
français courant).

**Observé** : ces deux champs affichent le code enum interne brut du parcours réglementaire, par
exemple `P1_LIBRE_2ANS_MODALITE_A` (R1a), `P7_TITULAIRE_BAC` (R1b, R2) — jamais un libellé humain.

**Cause technique (lecture du code, aucune correction appliquée)** :
`lib/quotes/pdf-adapter.server.ts:214` — `parcoursLabel: typeof carte.parcours?.parcoursPrincipal ===
'string' ? carte.parcours.parcoursPrincipal : 'Non renseigné'` assigne directement la valeur brute de
l'enum `ParcoursType`, sans passer par une table de correspondance vers un libellé métier. Cette valeur
alimente ensuite `level`/`currentLevel` (`lib/quotes/pdf-adapter.server.ts:264,268`), rendus tels quels
par `lib/quote/pdf.ts`.

**Impact** : le document commercial envoyé à la famille contient un identifiant technique interne
(`ParcoursType`) au lieu d'une information compréhensible — dégrade le professionnalisme du document et
peut dérouter une famille qui ne comprend pas ce code. N'affecte ni le prix, ni la sécurité, ni les
montants.

---

## T5B_FINDING_2 — `SEVERITY = MINOR`

**Scénario** : R1a, R1b, R2 (tous les scénarios testés).

**Fichier concerné** : mêmes PDF que ci-dessus, page 2, section "Besoin pédagogique", champ
"SPÉCIALITÉS".

**Attendu** : le champ "Spécialités" du PDF liste les spécialités du profil (ex. "Mathématiques,
Physique-Chimie").

**Observé** : ce champ affiche systématiquement "Non renseigné", même lorsque le profil a bien
`specialite1`/`specialite2` renseignées (confirmées dans le formulaire staff, visibles dans les captures
`R1a-01-profil.png`/`R1b-01-profil.png`/etc.).

**Cause technique (lecture du code, aucune correction appliquée)** :
`lib/quotes/pdf-adapter.server.ts:269` — `specialites: []` est une valeur codée en dur pour tout devis
candidat-individuel, jamais dérivée du profil réel.

**Impact atténué** : la famille peut néanmoins déduire les matières couvertes via la section "Inclus
dans le parcours" (chaque ligne commerciale nomme la matière — ex. "Enseignement de spécialité 1",
"Mathématiques anticipées (EAM)"), donc l'information n'est pas totalement absente du document, seulement
redondante manquante à l'endroit dédié.

---

## Aucun autre défaut observé

Aucun montant faux, aucune fuite de token, aucun produit différé vendu, aucune donnée de coût/marge
visible côté famille ou staff n'a été observée sur les scénarios R1-R6 exécutés. Voir
`t5b-human-verdict.md` et `direction-checklist.md` pour la matrice complète (colonnes humaines
`PENDING_HUMAN_REVIEW`).

## Note distincte — observation d'outillage (pas un finding produit)

Voir `technical/production-build-analysis.md` : la chaîne locale `npm run build` échoue à ses deux
dernières portes de validation pour des raisons entièrement liées à l'exécution depuis un dossier
`.worktrees/` et à l'absence du moteur Prisma dans un standalone hors Docker — préexistant, sans lien
avec le produit candidat-individuel ni avec ce lot.
