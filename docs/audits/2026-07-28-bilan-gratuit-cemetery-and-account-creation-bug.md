# Audit — Le cimetière du bilan-gratuit : comment un correctif a été perdu sans décision

Date : 2026-07-28
Périmètre : `app/api/bilan-gratuit/route.ts`, `lib/crm/*`, la mission « Bilan stratégique gratuit »

## Résumé

Trois fois sur le même périmètre (le pipeline de qualification `/bilan-gratuit`), du travail correct a été produit puis rendu inatteignable sans qu'aucune décision explicite n'ait jamais tranché de l'abandonner. Le bug le plus coûteux qui en résulte — une énumération de comptes sur un endpoint public non authentifié (`app/api/bilan-gratuit/route.ts:57-62`) — est en production depuis le **6 juillet 2026**, alors qu'un correctif l'éliminant existait dès ce jour-là.

## Les trois artefacts

| Commit | Date | Branche | Contenu | Statut avant cet audit |
|---|---|---|---|---|
| `798f712ae` | 2026-07-06 | `pr58-archive` (jamais mergée dans `main`) | Correctif « lead-only » complet : `captureContactLead()` propre, réponse neutre anti-énumération, jeton d'assessment séparé | Invisible — vivait sur une branche archivée, jamais intégrée |
| `b099bcbde` | 2026-07-27 16:06 | *aucune* (checkpoint automatique) | Refonte `ContactLead` avec champs bilan, `consentAt`, `campaignContext`, migration additive, vocabulaire de statut français | Dangling — commit de sécurité auto-créé au changement de branche, jamais poussé, jamais revu |
| `2fb5c47ae` | 2026-07-27 16:08 | *aucune* (checkpoint automatique, non poussé) | Tests modifiés affirmant que `bilanGratuitSchema` doit ignorer tout `parentPassword` injecté (« lead tunnel — no account ») | Dangling — même mécanisme que ci-dessus |

Un quatrième commit (`735079712`, checkpoint également) a été trouvé pendant l'inventaire mais concerne un sujet différent (le hoisting `SUBJECT_IDS`/`QUATRIEME` du chantier pré-rentrée) et s'est révélé **entièrement superflu** : son contenu est un brouillon antérieur d'un travail déjà terminé et fusionné proprement dans `origin/main`. Archivé par précaution uniquement, aucune valeur récupérable.

### Tags d'archive — index nommé

| Tag | Commit | Contenu | Pourquoi conservé |
|---|---|---|---|
| `archive/leadonly-bilan-fix-20260706` | `798f712ae` | Correctif lead-only complet du 6 juillet : `captureContactLead()` propre, réponse neutre anti-énumération, jeton d'assessment séparé | Seule trace du correctif qui aurait évité le bug d'énumération de comptes ; n'existait que sur une branche locale non poussée avant cet audit |
| `archive/checkpoint-bilan-lead-pipeline` | `b099bcbde` | Refonte `ContactLead` avec champs bilan, `consentAt`, `campaignContext`, migration additive, vocabulaire de statut français, spec pédagogique du diagnostic N-1 | Checkpoint automatique jamais poussé ; base de départ retenue pour le Lot A1 (schéma + migration, pas la spec pédagogique) |
| `archive/checkpoint-bilan-lead-pipeline-tests` | `2fb5c47ae` | Tests modifiés affirmant que `bilanGratuitSchema` doit ignorer tout `parentPassword` injecté (« lead tunnel — no account ») | Checkpoint automatique jamais poussé ; troisième preuve indépendante de la direction lead-only |
| `archive/checkpoint-schema-draft-20260727` | `735079712` | Brouillon antérieur du hoisting `SUBJECT_IDS`/`QUATRIEME` | Dangling au moment de l'inventaire ; confirmé superflu (`origin/main` plus abouti) — conservé par principe, pas par valeur |
| `archive/pre-rentree-2026-final-rc-20260713` | tip de `release/pre-rentree-2026-final-rc` | Implémentation alternative complète de la campagne pré-rentrée 2026 (50 commits, 174 fichiers, ~21 000 lignes) ; contient notamment le câblage de « Pré-rentrée 2026 » dans `CorporateNavbar` (commits `ea2b26eb8`/`6e54c6c9f`), absent de `origin/main` | Branche déjà sur `origin` (pas de risque de perte), mais contenu jamais confronté à ce qui a été retenu — marqué pour référence, non ré-audité en intégralité |

**Correction d'un constat erroné du rapport A1.0 précédent** : `pr58-archive` n'était **pas** présente sur `origin` au moment de ce rapport (`git ls-remote origin | grep pr58` ne renvoyait rien) — la confirmation affichée alors provenait d'une mauvaise lecture de la sortie de deux commandes exécutées à la suite. La branche a depuis été poussée (`git push origin pr58-archive:refs/heads/pr58-archive`). Elle s'est révélée bien plus étendue que le seul commit `798f712ae` : **339 fichiers, ~22 000 lignes**, incluant un mécanisme de rétention/anonymisation déjà écrit pour `ContactLead` (`scripts/maintenance/contact-leads-retention.ts`), des durcissements de sécurité (guards admin/rôles, audit API, redaction PII), et une correction de paiement (ClicToPay fail-closed). Ce périmètre dépasse largement la mission Bilan gratuit et n'a pas été audité en détail au-delà de ce qui est cité ici — un examen dédié serait nécessaire avant toute réutilisation.

## Comment le correctif du 6 juillet a été perdu

`798f712ae` (« fix(public-funnel): lead-only bilan and assessment token binding ») et `5ab7df3cd` (« feat(pre-rentree): publish complete 2026 pre-registration experience », 2026-07-13) modifient tous deux `app/api/bilan-gratuit/route.ts` **à partir de la même base** (`index 29b417278..*`) : deux branches ont divergé du même point, l'une supprimant la création de compte au profit d'un `ContactLead`, l'autre continuant de faire évoluer la version qui crée un compte.

`git merge-base --is-ancestor 798f712ae origin/main` échoue : ce commit n'a **jamais** atteint `main`. La branche qui a été intégrée (`5ab7df3cd`, puis `20f9ab87f`) ne descend pas de `798f712ae` — elle ignore purement et simplement son existence.

**Il n'y a pas eu de décision de revenir en arrière.** Personne n'a comparé les deux approches et choisi la création de compte au détriment du correctif : une branche a simplement été mergée, l'autre non, sans que quiconque n'ait examiné ce que la seconde corrigeait.

## Ce que cela a coûté

- Un endpoint public non authentifié permet, depuis le 6 juillet 2026, de savoir si un email correspond à un compte Nexus existant (`{ error: 'Un compte existe déjà avec cet email' }`, statut 400) — sur une base de données de familles avec des mineurs.
- Un parent déjà client qui tente d'inscrire un second enfant reçoit une erreur bloquante plutôt qu'une prise en charge — perte commerciale sur le profil le plus facile à convertir.
- Le champ `type` sur `ContactLead`, pourtant déjà résolu dans les trois artefacts perdus, est resté non persisté en production : toute tentative de distinguer les canaux de demande (bilan / rappel / contact / newsletter) a échoué silencieusement pendant la même période.

## Ce qui a permis que cela passe inaperçu

Deux commits de checkpoint automatiques (créés par l'outillage au changement de branche, pas par une action délibérée) contenaient un travail substantiel et cohérent — au point qu'un audit ultérieur (Phase 0 de la mission Bilan gratuit, 2026-07-28) les a pris pour l'état réel du dépôt, sans vérifier leur ascendance par rapport à `origin/main`. L'erreur a été détectée uniquement parce que le propriétaire du projet a demandé une vérification croisée avec la production (Lot 0/Section C de cette même mission).

## Mesure préventive proposée

Deux scripts exécutables, versionnés dans le dépôt, plutôt qu'une seule règle textuelle dans `AGENTS.md` :
- `scripts/check-branch-ascendancy.sh` — signaux structurels (divergence avec `origin/main`, visibilité depuis une branche distante, signature de checkpoint automatique via le reflog) plutôt qu'une correspondance de texte sur le message de commit.
- `scripts/check-work-delivered.sh` — vérifie qu'un travail est réellement livré (fusionné dans `origin/main`), pas seulement vert en local ; alerte si un commit poussé reste non fusionné au-delà d'un seuil d'ancienneté configurable.

`AGENTS.md` doit renvoyer à ces deux commandes en plus de la règle textuelle — proposition soumise à validation séparément, non appliquée à ce fichier avant accord.

## Le cimetière du chantier pré-rentrée (découvert en élargissant l'inventaire, 2026-07-28)

Le même mécanisme — travail réel produit sur une branche, jamais mergé, jamais tranché — existe à une échelle bien plus grande sur le chantier pré-rentrée. `release/pre-rentree-2026-final-rc` (54 commits en comptant ses 3 branches-ancêtres redondantes `fix/pre-rentree-2026-finalize-preview`, `-homepage-spotlight`, `-planning-ui`) est une implémentation complète et alternative de toute la campagne pré-rentrée 2026 (174 fichiers, ~21 000 lignes), développée depuis un point de départ commun avec la lignée qui a fini par constituer `origin/main`, mais jamais intégrée.

**Constat le plus actionnable** : les commits `ea2b26eb8` (« feat(marketing): link pre-rentree campaign across public navigation », 2026-07-12) et `6e54c6c9f` (« fix(navigation): prioritize pre-rentree campaign on mobile ») câblent explicitement « Pré-rentrée 2026 » comme premier élément du menu déroulant « Programmes » de `CorporateNavbar.tsx`, avec la note de commit « Direct access in one click from navbar on all pages ». C'est exactement le lien de navigation constaté absent de `origin/main` en A0.7 — pas parce qu'il n'a jamais été fait, mais parce que la branche qui le contenait n'a pas été celle qui a été retenue. Reste un constat factuel, remonté au propriétaire du projet conformément à sa consigne : rien n'a été branché.

Le reste du contenu de cette branche (174 fichiers) n'a pas été audité en détail au-delà de ce point précis — une revue dédiée serait nécessaire avant toute réutilisation. Tag de préservation : `archive/pre-rentree-2026-final-rc-20260713`.
