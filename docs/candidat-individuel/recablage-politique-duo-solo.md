# Politique de bascule DUO/SOLO — exigences structurelles (recâblage §10)

**STATUS = STRUCTURE PROPOSÉE, CLAUSES CONTRACTUELLES `DIRECTION_A_VALIDER`.** Ce document liste les
champs qu'une politique DUO/SOLO explicite doit porter, sans fixer de clause contractuelle (remboursement,
consentement) qui relève d'une décision commerciale/juridique — jamais inventée ici.

`lib/quotes/pricing-engine.ts::resolveGroupModality` calcule déjà la bascule GROUPE→DUO→SOLO à partir
d'un effectif donné (§9, testé). Ce qui manque pour que ce calcul devienne une **règle**, pas seulement un
avertissement :

| Champ | Rôle | Statut |
|---|---|---|
| `effectifPrevisionnel` | Nombre d'inscrits visés à l'ouverture des inscriptions | À ajouter au modèle de réservation (hors périmètre `lib/quotes/`) |
| `effectifConfirme` | Nombre réellement inscrit à la date limite | Idem |
| `seuilOuverture` | Déjà existant : `group_min_open` (`candidat_individuel_modules`) | ✅ disponible |
| `dateLimiteOuverture` | Date à laquelle la décision GROUPE/DUO/SOLO est arrêtée | À définir — commercial, pas réglementaire |
| `tarifDeRepli` | Déjà calculable : `resolveGroupModality` retourne le tarif DUO/SOLO | ✅ disponible |
| `consentementFamille` | Preuve que la famille a accepté le tarif de repli avant bascule | **`DIRECTION_A_VALIDER`** — nécessite une clause CGV/contrat, non rédigée ici |
| `remboursementSiRefusOuNonOuverture` | Politique de remboursement si la famille refuse la bascule ou si le groupe n'ouvre jamais | **`DIRECTION_A_VALIDER`** — décision commerciale/juridique |

## Règle imposée par la mission (déjà respectée structurellement)

> Ne transforme pas automatiquement un groupe en DUO/SOLO après acceptation sans nouvelle proposition
> commerciale ou clause contractuelle claire.

`resolveGroupModality` est une fonction de **calcul**, jamais appelée automatiquement pour modifier un
`Quote` déjà accepté — aucun code de ce lot ne bascule un devis existant. Le statut `PROVISIONAL` du
pipeline (`lib/quotes/pipeline.ts`) est réservé exactement pour ce cas : une ligne dont l'effectif n'est
pas encore confirmé resterait `PROVISIONAL`, jamais `READY`, tant qu'une confirmation (famille + effectif)
ne referme pas la boucle — non câblé aujourd'hui faute d'un input effectif dans le pipeline (noté dans
`lib/quotes/pipeline.ts`).

## Ce qui reste à trancher avant activation publique

1. Qui décide de la `dateLimiteOuverture` et selon quel calendrier (lié aux 6 offres, pas encore modélisé).
2. Le texte exact de la clause de consentement/remboursement (CGV) — hors périmètre technique.
3. Si le tarif de repli DUO/SOLO doit être communiqué au moment du devis initial (transparence) ou
   seulement au moment de la bascule réelle — décision produit.

Aucun de ces trois points n'est bloquant pour `ACTIVE_INTERNAL` (aucun devis public n'est concerné) ; les
trois sont bloquants pour `ACTIVE_PUBLIC` par construction (la clause §10 de la mission l'exige
explicitement).
