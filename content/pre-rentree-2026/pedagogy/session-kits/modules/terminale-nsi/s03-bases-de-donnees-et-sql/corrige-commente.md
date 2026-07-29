# Corrigé commenté — NSI — Entrée en Terminale — Séance 3

## Bases de données et SQL

**Statut :** `HUMAN_VALIDATION_REQUIRED`  
**Usage :** document enseignant ; ne pas distribuer avant le travail élève.

## Banque A — Consolidation guidée

### Correction A1

**Réponse : B — une clé**

La clé donne accès à la valeur 16.

**Lecture des erreurs possibles**

- A : Clé et valeur sont confondues.
- C : L'unicité d'une clé n'est pas comprise.
- D : Clé et valeur sont confondues.

**Méthode à institutionnaliser :** Identifier une clé et retrouver la valeur ou la ligne associée.

**Erreur à confronter :** Clé et valeur sont confondues

**Traçabilité :** `n04:n04-i1`

### Correction A2

**Réponse : D — filtrer des lignes**

WHERE exprime une condition sur les lignes.

**Lecture des erreurs possibles**

- A : Une requête est pensée séquentiellement comme un programme.
- B : Une requête est pensée séquentiellement comme un programme.
- C : Filtrer et projeter sont confondus.

**Méthode à institutionnaliser :** Distinguer lignes filtrées et colonnes sélectionnées.

**Erreur à confronter :** Une requête est pensée séquentiellement comme un programme

**Traçabilité :** `n06:n06-i1`

### Correction A3

```sql
SELECT Eleve.nom, Note.valeur
FROM Eleve
JOIN Note ON Eleve.id = Note.eleve_id
WHERE Note.valeur >= 15
ORDER BY Note.valeur DESC;
```

**Méthode à institutionnaliser :** Guidage à retirer progressivement : Relier les clés, filtrer avec WHERE, puis trier avec ORDER BY.

**Erreur à confronter :** Faire un produit cartésien en oubliant la condition de jointure.

**Traçabilité :** `programme:terminale-nsi:s03:A`

## Banque B — Attendu autonome

### Correction B1

**Réponse : C — identifier chaque ligne de manière unique**

Elle distingue les enregistrements.

**Lecture des erreurs possibles**

- A : L'unicité d'une clé n'est pas comprise.
- B : Clé et valeur sont confondues.
- D : Clé et valeur sont confondues.

**Méthode à institutionnaliser :** Identifier une clé et retrouver la valeur ou la ligne associée.

**Erreur à confronter :** Clé et valeur sont confondues

**Traçabilité :** `n04:n04-i2`

### Correction B2

**Réponse : A — la colonne nom**

SELECT choisit les colonnes projetées.

**Lecture des erreurs possibles**

- B : Une requête est pensée séquentiellement comme un programme.
- C : Filtrer et projeter sont confondus.
- D : Une requête est pensée séquentiellement comme un programme.

**Méthode à institutionnaliser :** Distinguer lignes filtrées et colonnes sélectionnées.

**Erreur à confronter :** Une requête est pensée séquentiellement comme un programme

**Traçabilité :** `n06:n06-i2`

### Correction B3

```sql
SELECT Eleve.nom, Note.valeur
FROM Eleve
JOIN Note ON Eleve.id = Note.eleve_id
WHERE Note.valeur >= 15
ORDER BY Note.valeur DESC;
```

**Méthode à institutionnaliser :** Relier les clés, filtrer avec WHERE, puis trier avec ORDER BY.

**Erreur à confronter :** Faire un produit cartésien en oubliant la condition de jointure.

**Traçabilité :** `programme:terminale-nsi:s03:B`

## Banque C — Transfert et justification

### Correction C1

**Réponse : D — des valeurs de clés correspondantes**

La relation repose sur des attributs communs.

**Lecture des erreurs possibles**

- A : Clé et valeur sont confondues.
- B : Clé et valeur sont confondues.
- C : L'unicité d'une clé n'est pas comprise.

**Méthode à institutionnaliser :** Identifier une clé et retrouver la valeur ou la ligne associée.

**Erreur à confronter :** Clé et valeur sont confondues

**Traçabilité :** `n04:n04-i3`

### Correction C2

**Réponse : B — un identifiant de classe commun**

La clé étrangère permet la jointure.

**Lecture des erreurs possibles**

- A : Une requête est pensée séquentiellement comme un programme.
- C : Filtrer et projeter sont confondus.
- D : Une requête est pensée séquentiellement comme un programme.

**Méthode à institutionnaliser :** Distinguer lignes filtrées et colonnes sélectionnées.

**Erreur à confronter :** Une requête est pensée séquentiellement comme un programme

**Traçabilité :** `n06:n06-i3`

### Correction C3

```sql
SELECT Eleve.nom, Note.valeur
FROM Eleve
JOIN Note ON Eleve.id = Note.eleve_id
WHERE Note.valeur >= 15
ORDER BY Note.valeur DESC;
```

**Extension attendue :** la donnée modifiée doit être annoncée ; la prévision doit s'appuyer sur la méthode « Relier les clés, filtrer avec WHERE, puis trier avec ORDER BY. » ; le nouveau résultat doit être contrôlé et comparé au premier.

**Méthode à institutionnaliser :** Résoudre, contrôler, prévoir l'effet d'une variation, puis vérifier : Relier les clés, filtrer avec WHERE, puis trier avec ORDER BY.

**Erreur à confronter :** Faire un produit cartésien en oubliant la condition de jointure.

**Traçabilité :** `programme:terminale-nsi:s03:C`
