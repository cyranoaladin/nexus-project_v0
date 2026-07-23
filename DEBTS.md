# Dettes et gates — Pré-rentrée 2026 · PR #74

## État au 23 juillet 2026

- Branche : `feat/svt-integration-clean`.
- Statut de release : `READY_FOR_REVIEW`.
- Verdict de publication : `BLOCKED`.
- `PUBLIC_READY` est interdit sans toutes les preuves et un GO écrit du propriétaire.
- Le site, les API, les téléchargements, le SEO et la préinscription restent fail-closed.

## Corrections techniques acquises

- Fondations : 4 à 6 élèves, maximum 6 ; Premium : 3 à 5, maximum 5.
- Seconde : Mathématiques, Français et Physique-Chimie uniquement ; aucune SNT ou initiation informatique.
- Première et Terminale conservent la NSI.
- Tarifs, acompte et solde sont dérivés du pricing canonique et testés.
- Provenance documentaire séparée en ancre métier, commit construit et empreinte des sources.
- Modules Maths révisés marqués comme propositions ; SVT maintenue en DRAFT.
- Kit, PDF, rasters, planches contact et manifestes régénérés.
- Formulation matériel SVT validée dans les sources : « Calculatrice scientifique simple recommandée, non obligatoire sauf consigne de l'enseignant. »
- Les anciennes cibles et commandes d'exploitation ont été neutralisées dans l'arbre courant ; les helpers publics échouent volontairement.

## P0 humains encore ouverts

| Référence | Gate | État | Preuve de sortie attendue | Responsable |
|---|---|---:|---|---|
| B-1 | Affectations enseignants | ❌ | Affectation et disponibilité confirmées pour chaque matière et créneau, conservées hors supports publics | Direction pédagogique et opérations |
| B-1 bis | Qualifications | ❌ | Contrôle individuel documenté ; aucun statut certifié/agrégé publié avant preuve | Direction pédagogique |
| B-2 | Validation SVT | ❌ | Validation écrite d'un enseignant SVT qualifié ; les deux PDF restent DRAFT jusque-là | Direction pédagogique |
| M-1 | Validation Maths | ❌ | Revue écrite des modules Maths Seconde et Première révisés à partir des BO 2019/2026 | Direction pédagogique |
| O-1 | Salles | ❌ | Salles et capacités validées pour chaque créneau | Direction des opérations |
| O-2 | Paiement et reçu | ❌ | Parcours d'encaissement, rapprochement et reçu testés | Direction des opérations |
| J-1 | Annulation/remboursement | ❌ | Conditions et CGV approuvées | Direction et conseil juridique |
| J-2 | Confidentialité/rétention | ❌ | Notice, finalités, durées et droits validés | Responsable confidentialité |
| Q-1 | Téléchargements | ❌ | Manifestes, liens, poids, checksums et contrôle E2E final verts | Qualité documentaire |
| Q-2 | Téléphone, WhatsApp, formulaires | ❌ | Parcours de contact testés sans collecte excessive | Communication et technique |
| C-1 | Manuels/remise annuelle | ❌ | Conditions, stock, éligibilité et non-cumul validés ; avantages masqués jusque-là | Direction commerciale |
| C-2 | Date de lancement | ❌ | Date écrite par le propriétaire ; J1…J29 sont calculés depuis cette date | Propriétaire |
| D-5 | Autorisation de publication | ❌ | GO écrit, daté, rattaché au SHA exact | Propriétaire |

Les seuls gates humains actuellement validés sont la capacité et les tarifs.

## Arbitrages éditoriaux

### Statut « certifiés / agrégés »

La formulation publique active est : « Enseignants expérimentés, en exercice dans le système français ». La variante « enseignants certifiés ou agrégés de l'Éducation nationale française, en exercice » est conservée désactivée dans le générateur. Sa restauration exige une preuve individuelle contrôlée et une décision écrite ; voir `ARBITRAGE_ENSEIGNANTS.md`.

### Affectations, salles et rôles

La politique actuelle est fail-closed : aucun nom réel ni code de rôle interne n'est public. Les créneaux et salles ne peuvent être exposés qu'après validation du gate `rooms`; si des rôles sont ensuite affichés, ils restent abstraits. La position métier antérieure « publier salles + créneaux + rôles abstraits » est conservée comme option, pas comme autorisation.

## P1/P2 bornées

| Dette | Priorité | Sortie attendue |
|---|---:|---|
| Réconciliation des dépôts divergents | P1 | Chantier séparé ; aucune réconciliation dans la PR go-live |
| Purge de l'historique Git contenant d'anciens détails d'infrastructure | P1 | Décision propriétaire et procédure dédiée ; impossible ici sans réécriture/force-push interdits |
| Runbook privé et rollback staging | P1 | Runbook hors dépôt public et exercice staging daté ; aucune cible staging fournie dans cette mission |
| Warnings ESLint historiques | P2 | Réduction progressive sans relever le budget ni neutraliser le lint |

## Verdict

`BLOCKED` jusqu'à clôture des contrôles automatisables de la PR et résolution des gates humaines P0. Un feu vert technique ne vaut ni GO commercial ni autorisation de publication.
