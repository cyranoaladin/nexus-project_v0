# NOTE 01 — Arbitrage du 3 août

Date : 31 juillet 2026 · Référence : audit Codex sur `origin/main` = `b7f9aace`
Production : `11e0dce`, trois commits derrière `origin/main`, mêmes défauts.

---

## 1. Décision

**Le questionnaire en ligne reste non publié le 3 août.** Les bilans du 3 août sont
produits manuellement, par un enseignant, selon la procédure `REPLI-03-AOUT-procedure.md`.

Ce n'est pas un renoncement : c'est la seule option compatible avec la contrainte que vous avez
vous-même posée — jamais de questionnaire non validé pédagogiquement en ligne. Les quatre packs
Maths/NSI sont marqués `REVIEW_REQUIRED` et « deliberately unpublished » dans le catalogue
canonique (`lib/bilans/catalog/fixtures/maths-nsi.v1.ts:49`). Aucun `reviewedBy`, aucun
`validatedBy`, aucune date sur les quatre définitions v1.3. Publier reviendrait à passer outre
votre propre règle et le garde-fou déjà écrit dans la spec du 14 juillet.

Le chiffrage de Codex — 3 à 6 jours pour le parcours complet, 3 à 5 jours pour rendre
Maths Terminale seul présentable — porte sur du temps technique, hors relecture pédagogique.
Nous sommes vendredi. Le 3 août est lundi.

---

## 2. Le piège d'ordonnancement — à traiter en priorité absolue

Le correctif le plus tentant est le moins cher : configurer `OLLAMA_URL` et installer le bon
modèle. **C'est le pire changement possible en premier.**

En production, le pipeline échoue actuellement sur `fetch failed` parce que `lib/ollama-client.ts:64`
pointe vers `http://ollama:11434` alors que PM2 tourne sur l'hôte. Cet échec est aujourd'hui
**la seule chose qui empêche des bilans erronés de partir**.

Le bilan réellement produit en run local, sur données synthétiques, contient :

- une moyenne de 12/20 transformée en **12/100** ;
- un basculement du singulier au pluriel — « les élèves » à la place de l'élève concerné ;
- des recommandations génériques et non mesurables ;
- un scoring V1 en entrée qui **perd deux domaines** (`prob_stats`, `algorithmic`) présents dans V2.

Réparer la configuration LLM sans avoir d'abord retiré le générateur du chemin critique
mettrait ce texte entre les mains de parents. **Le risque n'est pas l'absence de bilan :
c'est un bilan faux, signé Nexus.**

**Conséquence opérationnelle :** aucune modification de `OLLAMA_URL`, `OLLAMA_MODEL`,
ni aucun ajout de clé OpenRouter avant la mission M2. Le gel reste actif sur ce point.

---

## 3. Ce que l'audit valide de la doctrine

L'ADR-0012 du kit précédent proposait un moteur déterministe, sans LLM sur le chemin critique.
L'audit ne la discute plus : il l'établit par la preuve. Un modèle de langage a introduit
une erreur d'unité sur la donnée la plus simple du dossier — une moyenne scolaire. Sur un
document que des parents lisent comme un diagnostic, c'est disqualifiant.

Corollaire utile : **si le LLM sort du chemin de génération du bilan, la question de la
pseudonymisation et d'OpenRouter disparaît du chemin critique.** Elle ne devient plus qu'une
condition d'un usage ARIA ultérieur, hors périmètre du 3 août. Un blocage à 1–2 jours
s'évapore par simplification d'architecture, pas par contournement.

---

## 4. Périmètre autorisé pour le week-end

Trois interventions seulement, chacune sans dette et réversible. Elles nécessitent une levée
de gel explicite de votre part, ligne par ligne.

| # | Intervention | Effort | Risque |
|---|---|---|---|
| **A** | Audit lecture seule de toutes les routes publiques pouvant émettre un bilan, puis fermeture de celles qui le peuvent | 2 h | nul en lecture, faible en fermeture |
| **B** | Retrait de la promesse fausse « un bilan sera envoyé par email » affichée aujourd'hui aux parents | 1 h | faible |
| **C** | Carte honnête dans l'espace parent : bilan de positionnement programmé, avec la date réelle | 2 h | faible |

**A est un P0 indépendant du 3 août.** Le trafic Meta Ads est actif. Tant que
`/bilan-pallier2-maths` est atteignable publiquement, une réparation de configuration
faite par n'importe qui — y compris par inadvertance — publie des bilans erronés.
À vérifier ce soir.

**B est également un P0 éditorial.** Le composant promet aujourd'hui un envoi par e-mail
que le pipeline ne réalise pas. C'est une promesse non tenue, affichée en production,
à des familles qui ont payé un acompte.

---

## 5. Ce qui n'est pas fait ce week-end

Le rattachement `studentId`, la refonte du tunnel, le remplacement du générateur, la banque
Maths Première, le cycle de revue. Tout cela est planifié en missions M1 et M2, après le 3 août,
sur branche dédiée, avec relecture.

---

## 6. Ce que vous devez arbitrer maintenant

1. **Levée de gel ciblée** pour A, B, C — ou refus, auquel cas seul A en lecture seule est exécuté.
2. **Volume réel** : combien de familles inscrites aux stages attendent un bilan le 3 août ?
   La procédure de repli est dimensionnée pour 10 à 25 familles. Au-delà, elle change de nature.
3. **Qui signe les bilans manuels** — nom, discipline, disponibilité entre le 1er et le 3 août.
   Sans réponse à ce point, le repli manuel n'est pas exécutable non plus.
4. **Sort de `/bilan-pallier2-maths`** : fermeture, ou maintien avec génération désactivée.
