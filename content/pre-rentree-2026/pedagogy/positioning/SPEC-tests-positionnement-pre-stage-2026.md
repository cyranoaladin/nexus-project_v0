# SPÉCIFICATION — Tests de positionnement pré-stage 2026

> Document de mission destiné à Claude CLI · repo `cyranoaladin/nexus-project_v0`
> Auteur : responsable pédagogique Nexus Réussite · 29 juillet 2026
> Statut : spécification validée, à implémenter après Phase 0

---

## 0. Avertissement liminaire — lire avant toute ligne de code

Ce dépôt a démontré, sur ce même périmètre, qu'il **perd du travail terminé** : trois artefacts sur le tunnel de bilan, une branche de 21 000 lignes sur la pré-rentrée, 73 branches non fusionnées.

**Une fonctionnalité très proche de celle-ci existe déjà et doit être réutilisée, pas réécrite.** La Phase 0 de cette mission est intégralement consacrée à l'établir. Aucune écriture de code avant son rendu.

Contraintes permanentes du projet, rappelées ici parce qu'elles cadrent la conception :

- Aucune promesse de résultat, de note, de progression ou de taux de réussite.
- Les dossiers parents publiés indiquent explicitement que le **bilan diagnostique n'est pas inclus** dans le stage, et que les **services numériques ne sont pas inclus**. Cette fonctionnalité ne doit contredire ni l'une ni l'autre mention.
- Public mineur : minimisation des données, aucune PII en logs, aucune PII de mineur dans les notifications internes.
- Aucune valeur d'affichage en dur : niveaux, matières, libellés, seuils, tout est dérivé des données.
- Aucun nom d'enseignant publié.

---

## 1. Ce que c'est, et ce que ce n'est pas

### 1.1 L'objet

Un **test de positionnement** court, envoyé à l'élève après confirmation de son inscription à un stage de pré-rentrée, et **avant** la première séance. Il ne mesure pas un niveau global : il vérifie, nœud par nœud, la disponibilité des **prérequis structurants** qui conditionnent l'entrée dans le niveau supérieur.

Sa finalité est opérationnelle : permettre à l'enseignant d'arriver en séance 1 avec la carte de son groupe, de calibrer le tronc commun et d'assigner les paliers d'entraînement.

### 1.2 Le positionnement produit — non négociable

| Ce que c'est | Ce que ce n'est pas |
|---|---|
| Un outil interne de préparation de séance | Un bilan diagnostique commercialisé |
| Gratuit, non facturé, non vendu séparément | Un accès à la plateforme ARIA |
| Sans note, sans classement, sans score brut communiqué au parent | Une évaluation certificative |
| 20 à 25 minutes | Un examen blanc |

Formulation retenue pour toute communication aux familles, **sans variante** :

> Avant le stage, votre enfant reçoit un court test de positionnement (20 minutes). Il ne donne lieu à aucune note et n'est pas un bilan. Il sert uniquement à l'enseignant pour préparer les séances et adapter les exercices au groupe.

### 1.3 Le plancher garanti

Les programmes publiés prévoient déjà un **test flash de priorisation en séance 1**. Il reste en place et constitue le plancher : un élève inscrit la veille du stage est positionné quand même. Le test en ligne est un enrichissement, jamais une condition d'accès.

### 1.4 Arbitrage à confirmer par le propriétaire

L'objet stocké s'appuiera sur le modèle canonique `Bilan` avec `BilanType.DIAGNOSTIC_PRE_STAGE`. Le mot « bilan » existe donc côté technique. **Côté public, le mot employé est « test de positionnement » et sa sortie s'appelle « restitution de positionnement ».** Cette séparation entre nom technique et nom public doit être documentée dans la table de correspondance des sens de « bilan » déjà demandée par ailleurs.

---

## 2. PHASE 0 — Inventaire de l'existant (lecture seule, obligatoire)

Aucun code avant le rendu de cette phase.

### 2.1 Le cimetière d'abord

- Vérifier les cinq tags d'archive déjà posés, et les branches non fusionnées, pour tout ce qui touche : diagnostic, positionnement, assessment, prérequis, QCM.
- Exécuter `scripts/check-work-delivered.sh` sur toute branche candidate.
- **Si une implémentation existe : la rapporter avant d'écrire quoi que ce soit.**

### 2.2 Le moteur de diagnostic existant

`lib/diagnostics/` contient déjà l'essentiel de ce qui est demandé ici. Établir précisément :

| Élément | Question |
|---|---|
| `score-diagnostic.ts` | Le Scoring V2, le TrustScore et le RiskIndex 60 % preuve / 40 % déclaratif sont-ils réutilisables tels quels pour un test à 8 nœuds ? |
| `bilan-renderer.ts` | Les trois renderers (élève tutoiement, parents vouvoiement sans scores bruts, Nexus technique) sont-ils paramétrables par une nouvelle définition ? |
| `signed-token.ts` | Les jetons HMAC-SHA256 par audience couvrent-ils le besoin d'accès parent sans compte ? |
| `definitions/` | Le format des 4 définitions compilées (maths/NSI × 1re/Tle) peut-il porter des définitions à 8 nœuds × 3 items ? |
| Pipeline programmes | Le chemin PDF → JSON généré → YAML mapping → JSON compilé → définitions TS est-il utilisable pour les tests de positionnement ? |

### 2.3 La collision avec `/bilan-pallier2-maths`

Cette page est littéralement nommée « Bilan Diagnostic Pré-Stage ». Établir : est-ce le même objet produit sous un autre nom, un objet différent, ou une génération antérieure à remplacer ? **Répondre avant de créer quoi que ce soit**, sous peine de produire un cinquième sens du mot « bilan ».

### 2.4 Le modèle canonique

Le modèle Prisma `Bilan` porte déjà `BilanType.DIAGNOSTIC_PRE_STAGE`. Établir s'il est alimenté par quoi que ce soit aujourd'hui, et si les modèles legacy (`Diagnostic`, `Assessment`, `StageBilan`) doivent être évités ici.

### 2.5 Le lien avec le tunnel de bilan gratuit

Le chantier Lot A1 est en cours sur `/api/bilan-gratuit`. Établir les fichiers partagés entre les deux chantiers et les signaler **avant** toute modification.

**Livrable** : carte des sources de vérité, verdict de réutilisation élément par élément, et recommandation « réutiliser / étendre / créer » argumentée pour chaque brique. Puis STOP.

---

## 3. Modèle pédagogique

### 3.1 La Carte des prérequis structurants (CPS)

Une CPS par couple (niveau d'entrée, matière), soit 17 cartes. Elle est **la source unique** dont dérivent les items du test, les paliers d'entraînement et les restitutions.

Chaque CPS comporte 8 à 10 **nœuds**. Chaque nœud a quatre champs, tous obligatoires :

| Champ | Contenu | Rôle |
|---|---|---|
| `acquisN1` | La notion de l'année écoulée, dans les termes du programme officiel | Ancrage institutionnel |
| `usageN` | L'attendu précis de l'année suivante qui devient impraticable sans elle | **Critère d'admission du nœud** |
| `obstacles[]` | Les conceptions erronées récurrentes, formulées comme des conceptions et non comme des fautes | Source des distracteurs |
| `critereMaitrise` | Ce que l'élève doit savoir faire, observable | Source du critère de réussite |

**Règle d'admission opposable** : un nœud sans `usageN` nommé n'entre pas dans le test. Ce filtre protège du survol encyclopédique et rend chaque item justifiable devant un parent.

### 3.2 Structure d'un test

- 8 nœuds × 3 items = **24 items**, 20 à 25 minutes.
- Trois items par nœud est le **minimum** pour que le résultat soit interprétable ; deux produisent du bruit statistique. Ne pas descendre en dessous.
- Chaque item porte un `nodeId`, un `palier` (A, B ou C) et une justification de distracteur.
- Chaque item est suivi d'une **déclaration de confiance** obligatoire : `sur` | `hesitant` | `pas_su`.

### 3.3 Le croisement réussite × confiance

C'est le cœur du dispositif, et il réutilise la logique proof/déclaratif déjà présente dans le moteur existant.

| Réussite | Confiance | Profil | Traitement pédagogique |
|---|---|---|---|
| Oui | Sûr | `MAITRISE` | Réactivation courte, pas d'enseignement |
| Oui | Hésitant | `FRAGILE` | Consolidation, palier A puis B |
| Non | Hésitant / pas su | `LACUNE` | Enseignement explicite, palier A |
| **Non** | **Sûr** | **`ERREUR_CONFIANTE`** | **Confrontation à un contre-exemple. Ne se corrige jamais par la répétition.** |

Le profil `ERREUR_CONFIANTE` est le plus important à faire remonter : c'est celui qu'un enseignant ne détecte pas spontanément, parce que l'élève ne pose pas de question.

### 3.4 Agrégation par nœud

| Items réussis sur 3 | Statut du nœud |
|---|---|
| 3 | `ACQUIS` |
| 2 | `FRAGILE` |
| 0 ou 1 | `NON_ACQUIS` |

Si au moins un item du nœud est en `ERREUR_CONFIANTE`, le nœud est marqué d'un drapeau `confrontationRequise`, quel que soit son statut.

### 3.5 Calibrage du tronc commun par le groupe

Le tronc commun **n'est pas figé** : il est calibré par l'agrégat du groupe. C'est la contribution principale du dispositif, et elle ne coûte presque rien.

| Nœud `NON_ACQUIS` ou `FRAGILE` chez… | Décision |
|---|---|
| 4 ou 5 élèves sur 5 | Entre dans le tronc commun, travaillé collectivement |
| 2 ou 3 élèves | Traité en atelier court, paliers différenciés |
| 0 ou 1 élève | Passe en personnalisation : fiche de reprise ciblée |
| Aucun (tous acquis) | Réactivation de 5 minutes, pas d'enseignement |

**Ce calibrage ne modifie jamais les séances publiées.** Titres, objectifs, notions clés, méthodes et livrables des programmes parents sont contractuels et restent identiques. Seuls le dosage, l'ordre interne et les paliers d'entraînement varient.

### 3.6 Assignation des paliers

Trois paliers, identiques dans toutes les matières :

- **A — Consolidation** : le prérequis lui-même, guidé, aides graduées.
- **B — Attendu** : l'exercice standard de l'entrée dans le niveau N.
- **C — Transfert** : tâche combinant plusieurs nœuds, ou ouverture sur N.

**L'élève est assigné par nœud, jamais globalement.** Un même élève peut entrer au palier A sur un nœud et au palier C sur un autre. C'est ce qui évite l'étiquetage et rend la différenciation acceptable pour lui.

---

## 4. Les restitutions

Trois audiences, aucun vocabulaire nouveau : réutiliser les trois renderers existants de `bilan-renderer.ts`.

### 4.1 Carte du groupe — enseignant

**C'est le seul livrable indispensable au 17 août.** Les autres peuvent suivre.

- Matrice nœuds × élèves, trois états lisibles sans couleur (accessibilité) : acquis, fragile, non acquis.
- Drapeau `confrontationRequise` visible.
- Colonne « décision » pré-remplie selon la règle 3.5, modifiable par l'enseignant.
- Taux de complétion du test dans le groupe : un groupe où 2 élèves sur 5 ont répondu ne se calibre pas comme un groupe complet, et l'enseignant doit le voir.

### 4.2 Feuille de route élève — tutoiement

- Trois priorités maximum, nommées en langage d'élève.
- Un **objectif personnel écrit**, suivi sur les cinq séances. C'est le levier de personnalisation le plus perceptible pour un coût quasi nul.
- Micro-plan 5 / 15 / 30 minutes, sur le modèle du renderer existant.
- **Aucun classement entre élèves. Aucune note.**

### 4.3 Restitution parent — vouvoiement

- Ce qui est consolidé, ce qui reste à travailler, ce qu'il est utile de faire d'ici la rentrée.
- **Aucun score brut, aucune note, aucun pourcentage, aucune projection de résultat.** Labels qualitatifs uniquement.
- Rappel explicite du cadre : le stage sélectionne des priorités, ne couvre pas un programme annuel, ne garantit ni résultat ni note.
- Une seule restitution parent, **en fin de stage**, sous la forme d'une fiche de liaison. Les dossiers publiés indiquent que le suivi parent régulier n'est pas inclus : ne pas créer une attente que le stage ne finance pas.

### 4.4 Vue Nexus — direction pédagogique

- Couverture des nœuds par groupe, écarts entre groupes d'un même niveau, modules en tension.
- Taux de complétion des tests, délai moyen de réponse.
- Nœuds systématiquement non acquis : signal que la CPS doit être révisée pour l'édition suivante.

---

## 5. Modèle de données

### 5.1 Source de vérité du contenu

Suivre le pipeline déjà en place pour les programmes : **YAML source de vérité → JSON compilé → définitions TypeScript**. Ne pas inventer un quatrième chemin.

Arborescence proposée, à confirmer en Phase 0 :

```
content/positionnement-2026/
  cps/
    maths-entree-premiere.yaml          # source de vérité, éditée à la main
    ...
  compiled/
    maths-entree-premiere.json          # généré, jamais édité
tools/positionnement/
  compile-cps.ts                        # YAML -> JSON, valide le schéma
lib/positionnement/
  definitions/                          # définitions TS typées
```

### 5.2 Schéma d'une CPS (YAML)

```yaml
id: maths-entree-premiere
niveauEntree: PREMIERE          # enum partagé avec le reste du site
matiere: MATHEMATIQUES          # enum Subject existant
edition: 2026
dureeCibleMinutes: 22
noeuds:
  - id: n07
    ordre: 7
    acquisN1: "Équation de droite, coefficient directeur"
    usageN: "Tangente : le nombre dérivé est un coefficient directeur"
    obstacles:
      - "La droite est vue comme un objet graphique, non comme une fonction"
      - "Le coefficient directeur est confondu avec l'ordonnée à l'origine"
    critereMaitrise: "Déterminer le coefficient directeur d'une droite passant par deux points, et l'interpréter comme un taux de variation"
    seanceRattachement: 3        # renvoie à la séance publiée, contractuelle
    items:
      - id: n07-i1
        palier: A
        type: qcm_unique
        enonce: "..."
        propositions:
          - texte: "..."
            correcte: true
          - texte: "..."
            correcte: false
            obstacleVise: 1      # index dans obstacles[]
        justification: "..."     # jamais affichée à l'élève avant réponse
```

### 5.3 Persistance

Utiliser le modèle canonique `Bilan` avec `BilanType.DIAGNOSTIC_PRE_STAGE`. **Ne pas créer un nouveau modèle** sans démontrer en Phase 0 que le canonique ne convient pas.

Données à stocker :

| Donnée | Remarque |
|---|---|
| Référence de l'inscription au stage | Lien vers `StageReservation` |
| Identifiant de la définition + édition | Permet de rejouer un scoring |
| Réponses brutes, item par item | Réponse + déclaration de confiance + horodatage |
| Résultat agrégé par nœud | Statut + drapeau confrontation |
| Statut du traitement | En attente, complété, expiré |

**Minimisation** : ne stocker aucune donnée d'élève qui ne serve pas au calibrage. Pas d'établissement, pas de date de naissance, pas de commentaire libre non nécessaire.

### 5.4 Rétention

Les tests de positionnement d'une édition sont **anonymisés** à la fin de la période du stage : les réponses agrégées sont conservées pour l'amélioration des CPS, le lien vers l'élève est rompu. Un script de rétention/anonymisation `ContactLead` existe déjà sur une branche archivée : vérifier s'il est généralisable avant d'en écrire un second.

---

## 6. Parcours et workflow

### 6.1 Vue d'ensemble

```
Inscription au stage confirmée par le staff
   │
   ├─► Email à la famille : lien de test + PDF imprimable de repli
   │      (le PDF est le repli exigé par la mention « services numériques non inclus »)
   │
   ├─► Élève : 24 items, 20-25 min, une seule tentative, reprise possible si interrompu
   │
   ├─► Scoring déterministe, immédiat (pas de LLM sur ce chemin)
   │
   ├─► Carte du groupe mise à jour en continu, consultable par l'enseignant
   │
   ├─► J-1 du stage : carte figée, briefing enseignant
   │
   ├─► Séance 1 : test flash pour les non-répondants → carte complétée
   │
   └─► Fin de stage : fiche de liaison parent
```

### 6.2 Points de vigilance du parcours

- **Accès sans compte.** Le lien de test utilise un jeton signé HMAC-SHA256, mécanisme déjà en place. **Ne pas créer de compte pour accéder au test** : le tunnel `/api/bilan-gratuit` fait déjà cela et c'est précisément ce que le Lot A1 corrige.
- **Expiration.** Jeton valide jusqu'au démarrage du stage. Après, le test flash prend le relais.
- **Une seule tentative**, mais reprise possible en cas d'interruption : sauvegarde de progression par item.
- **Sans JavaScript** : afficher le repli PDF et le contact WhatsApp, comme le fait déjà la page de bilan gratuit.
- **Aucun paiement, aucune réservation, aucun compte à rebours** sur ce parcours.

### 6.3 Scoring déterministe, pas de LLM

Le scoring est **entièrement déterministe** : réussite × confiance, agrégation par nœud, règles de calibrage. Aucun appel à Ollama sur ce chemin.

Motif : le pipeline LLM existant prend environ trois minutes en inférence CPU. Un enseignant qui consulte sa carte de groupe le 16 août au soir ne peut pas attendre, et une génération non déterministe ne doit pas décider d'un calibrage pédagogique.

Un enrichissement rédactionnel par LLM des restitutions élève et parent est envisageable **en option, en différé, et jamais bloquant**. Il ne doit ni modifier les statuts, ni introduire de promesse de résultat. À traiter dans un lot ultérieur, pas dans celui-ci.

---

## 7. API

Routes proposées, à ajuster selon la Phase 0 et les conventions existantes.

| Méthode | Route | Rôle |
|---|---|---|
| `GET` | `/api/positionnement/[token]` | Charge la définition + la progression, jeton signé |
| `POST` | `/api/positionnement/[token]/reponse` | Enregistre une réponse, idempotent par item |
| `POST` | `/api/positionnement/[token]/terminer` | Clôture, déclenche le scoring |
| `GET` | `/api/stages/[slug]/positionnement/groupe` | Carte du groupe, réservé COACH/ADMIN/ASSISTANTE |
| `GET` | `/api/positionnement/[id]/restitution` | Restitution par audience, jeton signé |

Exigences transverses, alignées sur l'existant :

- CSRF, corps borné, rate limiting sur toutes les routes publiques.
- **Réponse identique quel que soit l'état d'un jeton inconnu ou expiré** : pas d'oracle d'énumération. Le motif anti-énumération est déjà présent dans `/api/auth/reset-password`.
- Contrôles d'accès via `lib/rbac.ts` et les guards existants. Ne pas créer une nouvelle mécanique d'autorisation.
- Audience `nexus` rejetée sans authentification staff, comme dans le mécanisme de jetons existant.

---

## 8. Frontend

- **Zéro valeur en dur** : niveaux, matières, libellés, durées, nombre d'items, seuils de calibrage — tout vient des données.
- Mobile d'abord : le test est majoritairement passé sur téléphone. Aucun débordement en 375 px.
- Un item par écran, progression visible, pas de minuteur visible — le minuteur crée du stress et fausse la déclaration de confiance.
- La déclaration de confiance est **obligatoire** et présentée sans jugement : « J'étais sûr » / « J'hésitais » / « Je ne savais pas ».
- Aucun score affiché à l'élève en fin de test. Message de clôture neutre : sa réponse est enregistrée et servira à préparer ses séances.
- Palette existante uniquement, violet réservé à ARIA.

---

## 9. Registre de preuves

Toute affirmation publiée par cette fonctionnalité doit avoir son entrée dans `content/pre-rentree-2026/proofs.registry.json` : durée du test, gratuité, absence de note, usage strictement interne, absence de restitution autonome.

**Aucune affirmation constituant une promesse de résultat, de note ou de progression.** Si l'audit du pipeline échoue sur une entrée manquante, compléter le registre ou retirer l'affirmation — jamais désactiver l'audit.

---

## 10. Tests exigés

| Niveau | Ce qui doit être couvert |
|---|---|
| Compilation CPS | Un nœud sans `usageN` fait échouer la compilation |
| Compilation CPS | Un nœud avec moins de 3 items fait échouer la compilation |
| Compilation CPS | Un item référençant un `nodeId` inexistant fait échouer la compilation |
| Scoring | Les quatre profils réussite × confiance, dont `ERREUR_CONFIANTE` |
| Scoring | Agrégation 3/2/≤1 → acquis / fragile / non acquis |
| Calibrage | Les quatre seuils de la règle 3.5, y compris le cas « tous acquis » |
| Calibrage | Groupe incomplet : le taux de complétion est exposé, le calibrage n'est pas faussé silencieusement |
| Restitution parent | **Échoue si un score brut, un pourcentage ou une note apparaît dans la sortie** |
| Restitution élève | Échoue si un classement entre élèves apparaît |
| Sécurité | Jeton invalide, expiré, ou d'une autre audience : réponses indiscernables |
| Sécurité | Audience `nexus` sans session staff : refus |
| PII | Aucune donnée d'élève dans les logs ni dans les notifications internes |
| Contrat | Chaque nœud publié référence une séance existante du programme publié |

---

## 11. Découpage en lots

Chaque lot se termine par lint, typecheck, tests, build verts, un rendu vérifié en 375 px et 1440 px, un point de statut factuel, et `check-work-delivered.sh` sur la branche.

| Lot | Contenu | Critère de fin |
|---|---|---|
| **P0** | Phase 0 — inventaire, verdict de réutilisation, carte des sources | STOP et validation |
| **P1** | Schéma CPS, compilateur YAML → JSON, tests de compilation, **une CPS de référence** : Maths entrée en Première | La CPS de référence compile et refuse les CPS invalides |
| **P2** | Moteur de scoring déterministe et calibrage de groupe, tests complets | Les quatre profils et les quatre seuils sont couverts |
| **P3** | Persistance, jetons, routes API, sécurité | Anti-énumération prouvée par test |
| **P4** | Parcours élève, mobile d'abord, repli sans JavaScript et PDF | Un test complet passable de bout en bout |
| **P5** | Carte du groupe pour l'enseignant | **C'est le livrable du 17 août** |
| **P6** | Restitutions élève et parent, via les renderers existants | Le test « aucun score brut chez le parent » passe |
| **P7** | Vue Nexus, rétention et anonymisation | — |

**Chemin critique** : P1 → P2 → P5. Si le calendrier se tend, ce sont P6 et P7 qui décalent, jamais P5 : un enseignant sans carte de groupe le 17 août rend tout le dispositif inutile.

---

## 12. Contenu à produire — ordre de priorité

L'ordre de production des 17 CPS suit la priorité arbitrée : **Mathématiques, Français, NSI**, puis le reste.

| Vague | CPS | Remarque |
|---|---|---|
| 1 | Maths 4e, 3e, 2de, 1re, Tle | Cœur de la demande |
| 2 | Français 4e, 3e, 2de, 1re (EAF) | Second pilier |
| 3 | NSI 1re, NSI Tle | Enseignant unique, priorité 3 |
| 4 | Maths expertes, PC 1re et Tle, SVT 1re et Tle | Kit allégé |
| 5 | Philosophie Tle | **Cas particulier, voir 12.1** |

Les tableaux complets des nœuds pour Mathématiques, Français et NSI ont été fournis séparément par le responsable pédagogique et font foi. Ils sont à saisir tels quels dans les fichiers YAML.

### 12.1 Trois matières hors modèle standard

**Philosophie — Terminale.** Aucun prérequis disciplinaire : la matière est nouvelle. Sa CPS porte sur des **compétences transférées du français** — analyser une consigne, distinguer thèse et argument, rédiger un paragraphe construit, citer et commenter. Le test de positionnement y est un court écrit, pas un QCM, et son scoring est partiellement manuel.

**NSI — Première.** Les documents publiés affirment qu'aucun prérequis Python n'est exigé. Le test **ne doit contenir aucun code à écrire**, sous peine de contredire notre propre communication. Il porte sur la logique, la lecture d'algorithme et le raisonnement conditionnel.

**Français, tous niveaux.** Les nœuds sont des opérations d'écriture et de lecture, pas des notions. Certains items ne peuvent pas être des QCM : prévoir un type `reponse_courte` marqué `correctionManuelle: true`, exclu du scoring automatique et remonté à l'enseignant dans la carte du groupe. Ne pas forcer le QCM là où il dénature l'objet évalué.

---

## 13. Exemple de référence — Maths, entrée en Première, nœud 7

Ce nœud est le gabarit à suivre pour tous les autres. Il est aussi le plus rentable du module : un élève qui ne relie pas coefficient directeur et nombre dérivé n'apprendra pas la dérivation, il l'appliquera.

```yaml
- id: n07
  ordre: 7
  acquisN1: "Équation de droite, coefficient directeur, taux de variation"
  usageN: "Nombre dérivé et équation de la tangente en un point (séance 3)"
  obstacles:
    - "La droite est perçue comme un tracé, non comme une fonction affine"
    - "Le coefficient directeur est confondu avec l'ordonnée à l'origine"
    - "Le taux de variation n'est pas relié à la pente"
  critereMaitrise: >
    Déterminer le coefficient directeur d'une droite passant par deux points,
    et l'interpréter comme un taux de variation.
  seanceRattachement: 3
  items:
    - id: n07-i1
      palier: A
      type: qcm_unique
      enonce: >
        Une droite passe par A(1 ; 3) et B(4 ; 12).
        Quel est son coefficient directeur ?
      propositions:
        - { texte: "3", correcte: true }
        - { texte: "9", correcte: false, obstacleVise: 2 }   # différence des ordonnées seule
        - { texte: "0", correcte: false, obstacleVise: 1 }   # ordonnée à l'origine supposée
        - { texte: "1/3", correcte: false }                  # rapport inversé
      justification: "(12 - 3) / (4 - 1) = 3"

    - id: n07-i2
      palier: B
      type: qcm_unique
      enonce: >
        Sur un graphique, une droite monte de 2 unités verticalement
        quand on avance de 4 unités horizontalement.
        Que peut-on dire de son coefficient directeur ?
      propositions:
        - { texte: "Il vaut 0,5", correcte: true }
        - { texte: "Il vaut 2", correcte: false, obstacleVise: 0 }
        - { texte: "Il vaut 4", correcte: false, obstacleVise: 2 }
        - { texte: "On ne peut pas le savoir sans l'équation", correcte: false, obstacleVise: 0 }
      justification: "Le coefficient directeur est le rapport 2/4 = 0,5"

    - id: n07-i3
      palier: C
      type: qcm_unique
      enonce: >
        Le prix d'un abonnement passe de 20 € à 26 € entre la 1re et la 4e année.
        Quel est le taux de variation par année, si l'évolution est régulière ?
      propositions:
        - { texte: "2 € par an", correcte: true }
        - { texte: "6 € par an", correcte: false, obstacleVise: 2 }
        - { texte: "26 € par an", correcte: false, obstacleVise: 1 }
        - { texte: "1,3 € par an", correcte: false }
      justification: "(26 - 20) / (4 - 1) = 2 — même calcul que le coefficient directeur"
```

Le troisième item est délibérément posé dans un contexte non géométrique : c'est ce qui révèle si le taux de variation est compris comme concept ou reproduit comme procédure graphique.

---

## 14. Grille de contrôle qualité — sept questions

Aucun contenu ne part sans sept oui :

1. Chaque nœud nomme-t-il l'attendu de l'année N qui le justifie ?
2. Les formulations sont-elles celles des programmes officiels ?
3. Le nœud est-il rattaché à une séance **existante** du programme publié, sans le modifier ?
4. Chaque distracteur vise-t-il un obstacle identifié, plutôt qu'une erreur de calcul arbitraire ?
5. Les trois paliers sont-ils représentés dans les items du nœud ?
6. La restitution parent est-elle exempte de tout score, note ou pourcentage ?
7. Aucune promesse de résultat, de note ou de progression n'apparaît nulle part ?

---

## 15. Ce qui est interdit

- Créer un nouveau modèle de données sans avoir démontré que le canonique `Bilan` ne convient pas.
- Créer un cinquième sens du mot « bilan ».
- Créer un compte utilisateur pour accéder au test.
- Appeler un LLM sur le chemin de scoring.
- Écrire une valeur d'affichage en dur.
- Afficher un score brut, une note ou un pourcentage au parent.
- Présenter le test comme un bilan diagnostique ou comme un accès plateforme.
- Modifier un titre, un objectif, une notion clé, une méthode ou un livrable d'une séance publiée : ils sont contractuels.
- Rendre le test obligatoire pour participer au stage.
- Publier un nom d'enseignant.

---

## 16. Rapport attendu

Format AGENTS.md : Résumé / Fichiers modifiés / Vérifications exécutées / Points de vigilance / Recommandation suivante.

À inclure obligatoirement :

- le verdict de réutilisation de la Phase 0, brique par brique ;
- la table de correspondance entre les sens de « bilan », mise à jour avec ce nouvel objet ;
- la liste des fichiers partagés avec le chantier Lot A1 et le chantier pré-rentrée ;
- la preuve que la restitution parent ne peut pas contenir de score brut, par un test qui échoue si on en introduit un ;
- la sortie de `check-work-delivered.sh` sur la branche.

ADR dans `docs/adr/` pour le choix de réutilisation du moteur de diagnostic. Documentation pédagogique du dispositif dans `docs/pedagogie/`.
