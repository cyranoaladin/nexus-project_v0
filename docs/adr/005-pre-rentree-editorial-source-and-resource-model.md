# ADR 005 — Source éditoriale unique et modèle de ressources banalisé (pré-rentrée 2026)

## Statut

Accepté — 2026-07-27.

## Contexte

### Éditorial

`lib/campaigns/pre-rentree-2026/public-surface.ts` (le seul compilateur consommé par la page publique) hardcodait sa FAQ (7 questions), ses 5 étapes de méthode et sa notice de réservation directement dans le code TypeScript, alors que `data/campaigns/pre-rentree-2026.json`'s `content.*` contenait déjà :

- `content.faq` : 19 entrées, textuellement différentes des 7 publiées, consommées uniquement par `scripts/pre-rentree/publication-sources.ts` — un pipeline qui n'alimente jamais aucun fichier public (voir section « pipeline PDF » ci-dessous).
- `content.method` : 4 étapes structurées (titre + description), jamais publiées.
- `content.practical.preRegistrationNotice` et les autres notices : jamais publiées.

Deux consommateurs indépendants du même contenu conceptuel, avec des textes divergents et aucun mécanisme empêchant la dérive.

### Pipeline PDF

Investigation menée en réponse à un audit utilisateur (Lot 1) : les 7 PDF réellement téléchargeables (`public/documents/pre-rentree-2026/*.pdf`, référencés par `lib/campaigns/pre-rentree-2026/documents.ts`) sont produits par `tools/pdf-generator/generate_level_dossiers.py` (`pre_rentree_data.py`), qui lit **directement** `data/campaigns/pre-rentree-2026.json` / `content/pre-rentree-2026/*.json` / `data/pricing.canonical.json` — jamais via `scripts/pre-rentree/publication-sources.ts`/`publication-derivations.ts`.

Ce second pipeline TypeScript (`publication-sources.ts` → `publication.snapshot.json` → `generate_documents.py`) construit un artefact de revue interne (`.artifacts/pre-rentree-2026/build`, gitignoré, jamais copié vers `public/`) avec son propre plan de nommage de fichiers (`GuideParents_COMPLET.pdf`, `FAQ_Parents_PreRentree2026.pdf`, etc.) qui ne correspond plus aux 7 fichiers réellement publiés depuis la refonte du 2026-07-25. Il reste utile comme audit interne mais ne protège pas ce qu'une famille télécharge réellement.

Conséquence pratique : Python ne peut pas importer le compilateur TypeScript. « Un seul compilateur consommé par les deux surfaces » n'est donc pas atteignable au sens littéral pour le site et les PDF réels. L'unification réalisable est : **une seule source de données canonique, zéro texte dupliqué en dur dans chaque consommateur**, vérifiée par un test de parité qui compare des FAITS (jamais des formulations éditoriales) entre le site et la sortie réelle des PDF.

Un exemple concret de la duplication évitable : `pre_rentree_data.py` maintenait un dictionnaire `_MATERIALS_FALLBACK` répétant (avec un texte différent) `campaign.content.practical.materialsBySubject`, déjà présent dans le JSON et déjà lu côté TypeScript.

### Modèle de ressources

`roomRoles` (`data/campaigns/pre-rentree-2026.json`) associait chaque salle à une liste de matières autorisées — une spécialisation qui n'a jamais correspondu à une contrainte physique réelle (les 3 salles sont interchangeables) et qui compliquait toute ouverture de nouveau groupe sans bénéfice réel. De même, `teacherRoles[].maxHoursPerDay` était une règle bloquante du validateur (`scripts/validate-stage-planning.ts`, R3) alors qu'un plafond horaire engage une personne réelle et ne se décide pas depuis un fichier de configuration.

## Décision

1. **Éditorial** : `public-surface.ts` cesse d'écrire la FAQ, la méthode et les notices en dur. Il lit `campaign.content.*` et se limite à sélectionner/ordonner/formater/templater (placeholders `{{...}}` résolus contre les mêmes faits dérivés que le reste de la page — jamais un nombre figé). Publication de la FAQ gérée par un flag `published: boolean` par entrée plutôt que par un second tableau parallèle ; l'ordre de publication est déclaré explicitement (`PUBLISHED_FAQ_ORDER`) puisque le tableau source entrelace entrées publiées et réservées.
2. **Pipeline PDF** : le pipeline réellement public (`tools/pdf-generator/pre_rentree_data.py`) supprime sa duplication locale des matériels par matière et lit `campaign.content.practical.materialsBySubject` directement. Le pipeline `publication-sources.ts`/`generate_documents.py` reste en l'état (audit interne, hors périmètre de cette mission) — son plan de nommage obsolète est documenté ici comme dette connue, pas corrigé.
3. **Parité** : `__tests__/campaigns/pre-rentree-2026-site-real-pdf-parity.test.ts` compare `compilePreRentreeReviewSurfaceDTO()` aux PDF réellement commis (`assets/campaigns/pre-rentree-2026/documents-final/*.pdf`, extraction texte via `pdftotext`), sur des faits explicitement listés (effectifs, tarif de départ, créneau, plafond de pack). Un écart pré-existant et non introduit par cette mission (`NexusReussite_PreRentree2026_Tarifs.pdf` n'affiche jamais les 4 tarifs Fondations) est documenté par un test qui assert la réalité actuelle plutôt que d'être supprimé ou ignoré silencieusement.
4. **Salles** : `roomRoles` (table de compatibilité salle → matières) est supprimée, remplacée par `rooms: string[]` (3 identifiants permanents, interchangeables). La seule contrainte de salle devient un comptage : au plus 3 groupes simultanés par (fenêtre, bloc) — validateur R2.
5. **Charge enseignant** : `teacherRoles[].maxHoursPerDay` devient optionnel dans le schéma et purement informatif dans le validateur (R3) — calculé et rapporté (blocs/jour/fenêtre par rôle), jamais bloquant.

## Conséquences

- Le contenu réellement affiché aux familles (FAQ : 7 questions, méthode : 4 étapes réelles, notice de réservation) change de texte source mais pas de texte de sortie pour la FAQ (« mot pour mot » vérifié par diff JSON avant/après compilation, zéro écart) ; la méthode et la notice changent intentionnellement de texte affiché puisqu'ils étaient auparavant des données mortes jamais publiées (divulgation explicite dans le rapport de fin de section).
- `campaign.content.faq` passe de 19 à 24 entrées (7 publiées + 17 réservées), pas 18 comme anticipé initialement — la mission supposait un recoupement propre 7+11 qui ne correspondait pas à la réalité des données (2 questions existantes partageaient le même texte de question qu'une question live mais un texte de réponse différent ; mises à jour en place plutôt que dupliquées).
- Le validateur reste vert sur le planning existant après ces 5 changements (mêmes 14/70/85/49 chiffres) — aucun comportement observable du planning actuel ne change.
- Le pipeline `publication-sources.ts` legacy reste une dette documentée, pas résolue par cette ADR.

## Symboles retirés

- `roomRoles` (schéma + données) → remplacé par `rooms: string[]`.
- `_MATERIALS_FALLBACK` (`tools/pdf-generator/pre_rentree_data.py`).
- Le tableau `faq` en dur, le tableau `method` en dur (5 chaînes) et la chaîne `reservation.rule`/`explanation` en dur dans `public-surface.ts`.
