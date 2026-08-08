# Grille de relecture — NSI

**Relecteur : Responsable pédagogique**  ·  Module `nsi`  ·  26 items notés

> Reconstituée le 8 août 2026 depuis le contenu réel du dépôt (`definition.public.ts` + `answer-key.server.ts`). Les grilles antérieures avaient été supprimées.

## Comment relire

Pour **chaque** item, remplir « Verdict » : `OK` si l'énoncé et la réponse attendue sont justes et conformes au programme ; `À CORRIGER` sinon, en précisant quoi. Un item sans verdict reste **non validé**, et son score ne sera pas montré à l'étudiant.

Points d'attention : énoncé ambigu, distracteur involontairement correct, niveau inadapté, réponse attendue erronée.

---

### `nsi-01` · 2 pt · single

**Énoncé.** Quelle est l’écriture binaire de 13 ?

- `a` 1011
- `b` 1101
- `c` 1110
- `d` 1001

**Réponse attendue.** `b` — 1101
**Compétence.** representation_entiers

| Verdict | Remarque |
|---|---|
|  |  |

### `nsi-02` · 2 pt · single

**Énoncé.** En Python, que vaut 7 // 2 ?

- `a` 3
- `b` 3.5
- `c` 4
- `d` 1

**Réponse attendue.** `a` — 3
**Compétence.** python_operateurs

| Verdict | Remarque |
|---|---|
|  |  |

### `nsi-03` · 2 pt · single

**Énoncé.** Que vaut len([2,4,6]) ?

- `a` 2
- `b` 3
- `c` 6
- `d` 12

**Réponse attendue.** `b` — 3
**Compétence.** listes

| Verdict | Remarque |
|---|---|
|  |  |

### `nsi-04` · 2 pt · single

**Énoncé.** Après d={"a":2}; d["b"]=5, que vaut len(d) ?

- `a` 1
- `b` 2
- `c` 5
- `d` 7

**Réponse attendue.** `b` — 2
**Compétence.** dictionnaires

| Verdict | Remarque |
|---|---|
|  |  |

### `nsi-05` · 2 pt · single

**Énoncé.** Que renvoie [x*x for x in range(4)] ?

- `a` [1,4,9,16]
- `b` [0,1,4,9]
- `c` [0,1,2,3]
- `d` [0,2,4,6]

**Réponse attendue.** `b` — [0,1,4,9]
**Compétence.** comprehension_liste

| Verdict | Remarque |
|---|---|
|  |  |

### `nsi-06` · 2 pt · single

**Énoncé.** Une fonction récursive doit notamment posséder…

- `a` une boucle infinie
- `b` un cas de base
- `c` deux paramètres
- `d` une variable globale

**Réponse attendue.** `b` — un cas de base
**Compétence.** recursivite

| Verdict | Remarque |
|---|---|
|  |  |

### `nsi-07` · 2 pt · single

**Énoncé.** La complexité d’une recherche dichotomique dans une liste triée est typiquement…

- `a` O(1)
- `b` O(log n)
- `c` O(n)
- `d` O(n²)

**Réponse attendue.** `b` — O(log n)
**Compétence.** complexite

| Verdict | Remarque |
|---|---|
|  |  |

### `nsi-08` · 2 pt · single

**Énoncé.** Dans une pile, l’élément retiré en premier est…

- `a` le premier ajouté
- `b` le dernier ajouté
- `c` le plus petit
- `d` choisi au hasard

**Réponse attendue.** `b` — le dernier ajouté
**Compétence.** structures_lineaires

| Verdict | Remarque |
|---|---|
|  |  |

### `nsi-09` · 2 pt · single

**Énoncé.** Dans une file, l’élément retiré en premier est…

- `a` le premier ajouté
- `b` le dernier ajouté
- `c` le plus grand
- `d` le milieu

**Réponse attendue.** `a` — le premier ajouté
**Compétence.** structures_lineaires

| Verdict | Remarque |
|---|---|
|  |  |

### `nsi-10` · 2 pt · single

**Énoncé.** Dans un arbre binaire de recherche, les valeurs du sous-arbre gauche d’un nœud sont en général…

- `a` supérieures
- `b` inférieures
- `c` égales
- `d` sans relation

**Réponse attendue.** `b` — inférieures
**Compétence.** arbres

| Verdict | Remarque |
|---|---|
|  |  |

### `nsi-11` · 2 pt · single

**Énoncé.** Quelle requête sélectionne tous les élèves dont la note est au moins 10 ?

- `a` SELECT * FROM eleves WHERE note >= 10;
- `b` GET eleves IF note = 10;
- `c` SELECT note > 10 IN eleves;
- `d` FROM eleves SELECT >=10;

**Réponse attendue.** `a` — SELECT * FROM eleves WHERE note >= 10;
**Compétence.** sql

| Verdict | Remarque |
|---|---|
|  |  |

### `nsi-12` · 2 pt · single

**Énoncé.** Une clé primaire sert principalement à…

- `a` chiffrer la table
- `b` identifier de manière unique une ligne
- `c` trier automatiquement les colonnes
- `d` supprimer les doublons de texte

**Réponse attendue.** `b` — identifier de manière unique une ligne
**Compétence.** bases_donnees

| Verdict | Remarque |
|---|---|
|  |  |

### `nsi-13` · 2 pt · single

**Énoncé.** Le protocole HTTP est principalement utilisé pour…

- `a` adresser les paquets sur un réseau local
- `b` échanger des ressources web
- `c` chiffrer les disques
- `d` compiler Python

**Réponse attendue.** `b` — échanger des ressources web
**Compétence.** reseaux

| Verdict | Remarque |
|---|---|
|  |  |

### `nsi-14` · 2 pt · single

**Énoncé.** Une adresse IPv4 contient…

- `a` 16 bits
- `b` 32 bits
- `c` 64 bits
- `d` 128 bits

**Réponse attendue.** `b` — 32 bits
**Compétence.** reseaux

| Verdict | Remarque |
|---|---|
|  |  |

### `nsi-15` · 2 pt · single

**Énoncé.** Le rôle principal du DNS est de…

- `a` traduire un nom de domaine en adresse IP
- `b` compresser les pages web
- `c` attribuer les mots de passe
- `d` exécuter les requêtes SQL

**Réponse attendue.** `a` — traduire un nom de domaine en adresse IP
**Compétence.** reseaux

| Verdict | Remarque |
|---|---|
|  |  |

### `nsi-16` · 2 pt · single

**Énoncé.** Un système d’exploitation gère notamment…

- `a` uniquement les fichiers texte
- `b` les processus, la mémoire et les périphériques
- `c` la syntaxe HTML seulement
- `d` les notes des élèves

**Réponse attendue.** `b` — les processus, la mémoire et les périphériques
**Compétence.** architecture_systeme

| Verdict | Remarque |
|---|---|
|  |  |

### `nsi-17` · 2 pt · single

**Énoncé.** Dans un graphe non orienté, une arête relie…

- `a` un sommet à une table SQL
- `b` deux sommets sans orientation
- `c` toujours trois sommets
- `d` deux fonctions Python

**Réponse attendue.** `b` — deux sommets sans orientation
**Compétence.** graphes

| Verdict | Remarque |
|---|---|
|  |  |

### `nsi-18` · 2 pt · single

**Énoncé.** Un parcours en largeur utilise naturellement…

- `a` une pile
- `b` une file
- `c` un dictionnaire uniquement
- `d` une récursion obligatoire

**Réponse attendue.** `b` — une file
**Compétence.** graphes

| Verdict | Remarque |
|---|---|
|  |  |

### `nsi-19` · 2 pt · single

**Énoncé.** Que vaut f(4) pour f(n): si n==0 retourner 1 sinon retourner n*f(n-1) ?

- `a` 4
- `b` 10
- `c` 16
- `d` 24

**Réponse attendue.** `d` — 24
**Compétence.** recursivite

| Verdict | Remarque |
|---|---|
|  |  |

### `nsi-20` · 2 pt · single

**Énoncé.** Une collision dans une table de hachage se produit lorsque…

- `a` deux clés obtiennent le même indice
- `b` une clé est trop longue
- `c` la table est triée
- `d` un programme compile

**Réponse attendue.** `a` — deux clés obtiennent le même indice
**Compétence.** hachage

| Verdict | Remarque |
|---|---|
|  |  |

### `nsi-21` · 2 pt · single

**Énoncé.** Quel principe réduit le risque d’accès non autorisé ?

- `a` Donner tous les droits à tous
- `b` Principe du moindre privilège
- `c` Réutiliser le même mot de passe
- `d` Désactiver les sauvegardes

**Réponse attendue.** `b` — Principe du moindre privilège
**Compétence.** securite

| Verdict | Remarque |
|---|---|
|  |  |

### `nsi-22` · 2 pt · single

**Énoncé.** Dans le modèle client-serveur…

- `a` le client fournit toujours le service
- `b` le serveur répond à des requêtes de clients
- `c` aucun réseau n’est nécessaire
- `d` les rôles ne peuvent jamais changer

**Réponse attendue.** `b` — le serveur répond à des requêtes de clients
**Compétence.** architecture_reseau

| Verdict | Remarque |
|---|---|
|  |  |

### `nsi-23` · 8 pt · long

**Énoncé.** Sans exécuter le programme, donner la valeur affichée et expliquer :

L=[3,1,4,1,5]
s=0
for i in range(len(L)):
    if L[i] > i:
        s += L[i]
print(s)

**Réponse attendue.** **correction humaine requise**
**Compétence.** trace_programme, explication

| Verdict | Remarque |
|---|---|
|  |  |

### `nsi-24` · 10 pt · long

**Énoncé.** Écrire une fonction Python `indices_pairs(L)` qui renvoie la liste des indices où l’élément de L est pair. Préciser un jeu de tests.

**Réponse attendue.** **correction humaine requise**
**Compétence.** programmation, tests

| Verdict | Remarque |
|---|---|
|  |  |

### `nsi-25` · 10 pt · long

**Énoncé.** On dispose des tables ELEVE(id, nom) et NOTE(id_eleve, matiere, valeur). Écrire une requête qui renvoie le nom et la moyenne de chaque élève en mathématiques.

**Réponse attendue.** **correction humaine requise**
**Compétence.** sql, jointure, agregation

| Verdict | Remarque |
|---|---|
|  |  |

### `nsi-26` · 8 pt · long

**Énoncé.** Expliquer pourquoi un algorithme correct sur quelques exemples peut néanmoins être incorrect en général. Donner un exemple ou une méthode de preuve.

**Réponse attendue.** **correction humaine requise**
**Compétence.** preuve_algorithme, esprit_critique

| Verdict | Remarque |
|---|---|
|  |  |
