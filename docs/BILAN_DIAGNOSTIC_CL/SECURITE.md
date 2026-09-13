# Sécurité du dépôt

Dépôt **local**. Aucun remote n'est configuré et aucun remote public ne le sera jamais ;
la décision d'un remote privé appartient à la direction pédagogique.

Les clés de correction et les grilles sont **dans la source versionnée** : `banque.json`
est la source unique de chaque instrument, elle contient énoncés, clés, codes d'erreur et
grilles par construction. Le Cahier § 9 interdit un dépôt *public*, pas la mise sous version.

Les rendus destinés aux candidats et aux correcteurs sont générés dans `instruments/*/build/`,
exclu du dépôt : ils sont reconstructibles depuis la source et leur distribution aux
correcteurs habilités relève de la plateforme, avec traçabilité d'accès (Cahier § 9).

La release remise aux candidats — `release/diagnostics-v2/`, produite par
`python3 scripts/release_v2.py` — et le banc de contrôle de la chaîne —
`build/controle-diffusion/`, produit par `python3 scripts/distribution.py` — sont exclus
pour la même raison : ils se reconstruisent depuis la source. Deux règles y sont tenues
par les scripts, et ils refusent de construire si l'une tombe : **aucun corrigé dans un dossier candidat**, et **aucun document
candidat ne contient un élément de correction** — clé, distracteur, grille, code d'erreur,
barème intermédiaire. Le contrôle porte sur le texte réellement extrait des PDF, non sur
leur nom.

Les trois tableaux d'envoi — `DISTRIBUTION_MATRIX.csv`, `STUDENT_PACK_MATRIX.csv`,
`CANDIDATE_PROFILES.csv` — sont versionnés : ce sont des index, et ils ne portent aucun
nom de candidat. Le questionnaire lui-même interdit tout champ nominatif hors du code
candidat ; si un jour un tableau nominatif est nécessaire, il reste hors du dépôt.
