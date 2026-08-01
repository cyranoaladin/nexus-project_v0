# REPLI 3 AOÛT — Procédure opérationnelle

Objectif : livrer aux familles inscrites aux stages un bilan de positionnement **réel,
signé par un enseignant**, sans mettre en ligne un questionnaire non validé.

Dimensionné pour 10 à 25 familles. Au-delà de 25, la procédure change de nature :
prévenir avant de lancer.

---

## 1. Principe

Le bilan manuel n'est pas un pis-aller : c'est **la spécification du bilan automatisé**.
La trame de restitution (`REPLI-03-AOUT-trame-bilan.md`) reprend exactement la structure
que produira le rendu déterministe de la mission M2. Ce qui est écrit à la main aujourd'hui
définit ce que la machine devra écrire demain — pas l'inverse.

Corollaire : chaque bilan manuel produit est un **cas de référence**. Les archiver.

---

## 2. Rôles

| Rôle | Qui | Responsabilité |
|---|---|---|
| Enseignant évaluateur | à nommer, par discipline | conduit la passation, remplit la grille, signe le bilan |
| Coordination | assistante | prise de créneaux, envoi, suivi des retours |
| Validation | direction pédagogique | relit et valide chaque bilan avant envoi |

**Blocage à lever en priorité :** sans nom d'enseignant disponible entre le 1er et le 3 août,
la procédure n'est pas exécutable. C'est le point à trancher avant tout le reste.

---

## 3. Calendrier

| Quand | Quoi |
|---|---|
| **Ven. 31 juillet, soir** | Vérifier qu'aucune route publique n'émet de bilan (mission M0 phase 1) |
| **Ven. 31 juillet** | Extraire la liste nominative des familles inscrites aux stages, par niveau et matière |
| **Sam. 1er août** | Envoyer la proposition de créneau à chaque famille (message type §6) |
| **Sam. 1 – dim. 2 août** | Passations, 25 min par élève, visio ou présentiel |
| **Dim. 2 août, soir** | Rédaction des bilans à partir des grilles |
| **Lun. 3 août, matin** | Relecture et validation par la direction pédagogique |
| **Lun. 3 août** | Envoi aux familles + dépôt dans l'espace parent |

Si un créneau ne peut pas être tenu, **le dire à la famille avec une nouvelle date précise**.
Ne jamais écrire « finalisation en cours » : cette formulation a déjà coûté des inscriptions.

---

## 4. Déroulé d'une passation — 25 minutes

| Durée | Séquence | Objet |
|---|---|---|
| 3 min | Cadrage | Rappeler que c'est un positionnement, ni une note, ni un pronostic |
| 12 min | Diagnostic écrit | 8 à 10 items sur la grille papier, l'élève annonce sa confiance après chaque item |
| 7 min | Reprise orale | Faire verbaliser deux items ratés, distinguer erreur de méthode et erreur de calcul |
| 3 min | Restitution immédiate | Deux points d'appui, une priorité, oralement, à l'élève |

**La déclaration de confiance est obligatoire après chaque item, avant correction.**
C'est elle qui produit l'information la plus utile du dispositif : un item raté avec une
confiance élevée signale un point que l'élève ne révisera jamais spontanément, puisqu'il
le croit acquis. Sans cette déclaration, la passation perd son intérêt principal.

Échelle annoncée à l'élève, quatre niveaux, sans milieu :
`1 je devine · 2 peu sûr · 3 plutôt sûr · 4 certain`.

---

## 5. Grille de recueil

Une feuille par élève, une ligne par item :

```
Item | Nœud travaillé | Réussi O/N | Confiance 1-4 | Type d'erreur | Observation
```

Type d'erreur, vocabulaire fermé : `calcul` · `méthode` · `lecture de l'énoncé` ·
`justification` · `non traité`.

Croisement à reporter en fin de grille, quatre cases :

|  | Confiance 1–2 | Confiance 3–4 |
|---|---|---|
| **Réussi** | acquis instable | **acquis** |
| **Échoué** | lacune identifiée | **écart non perçu** ← priorité 1 |

Les items sont construits sur l'intersection année N-1 / année N : les prérequis sans lesquels
les premières semaines de la nouvelle année sont inaccessibles. Ni révision générale de l'année
écoulée, ni anticipation du programme complet.

---

## 6. Message de prise de créneau

> Bonjour,
>
> Avant le stage de prérentrée, nous proposons à [Prénom] un bilan de positionnement
> de 25 minutes, conduit par un enseignant de la discipline. Il sert à cibler le travail
> des cinq séances, pas à évaluer ni à classer.
>
> Deux créneaux possibles : [date/heure 1] ou [date/heure 2], au centre de Mutuelleville
> ou en visioconférence, comme vous préférez.
>
> Vous recevrez ensuite un compte rendu écrit précisant les points d'appui, les priorités
> de travail et ce qui sera repris pendant le stage.
>
> Dites-moi le créneau qui vous convient et je le confirme immédiatement.

Contraintes : pas de score annoncé, pas de promesse de résultat, pas de ressort anxiogène,
pas de nom d'enseignant. Terminer par une question, jamais par un document seul.

---

## 7. Ce qu'un bilan manuel ne doit jamais contenir

- Une note, un pourcentage, un classement
- Une projection de résultat au baccalauréat ou au brevet
- Un nom d'enseignant
- Un engagement de progression chiffré
- Une formulation qui inquiète pour déclencher une inscription

Vérifier chaque bilan contre ces six points avant envoi. C'est exactement ce que le test
automatisé de la mission M2 fera plus tard ; d'ici là, c'est un contrôle humain.

---

## 8. Archivage

Un dossier par élève : grille scannée + bilan validé + date + nom du validateur.
Ces dossiers sont la base de la validation pédagogique nominative qui manque aujourd'hui
au catalogue. Ils serviront à sortir les packs de l'état `REVIEW_REQUIRED`.
