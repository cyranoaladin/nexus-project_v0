# Correction de la vérification — NSI — Entrée en Terminale — Séance 3

## Bases de données et SQL

**Statut :** `HUMAN_VALIDATION_REQUIRED`

### Correction question 1

```sql
SELECT Eleve.nom, Note.valeur
FROM Eleve
JOIN Note ON Eleve.id = Note.eleve_id
WHERE Note.valeur >= 15
ORDER BY Note.valeur DESC;
```

**Critère d'attribution du point :** la réponse respecte la méthode suivante : Relier les clés, filtrer avec WHERE, puis trier avec ORDER BY.

**Source :** `programme:terminale-nsi:s03:B`

### Correction question 2

**Réponse : B — une clé**

La clé donne accès à la valeur 16.

**Lecture des erreurs possibles**

- A : Clé et valeur sont confondues.
- C : L'unicité d'une clé n'est pas comprise.
- D : Clé et valeur sont confondues.

**Critère d'attribution du point :** la réponse respecte la méthode suivante : Identifier une clé et retrouver la valeur ou la ligne associée.

**Source :** `n04:n04-i1`

### Correction question 3

**Réponse : B — un identifiant de classe commun**

La clé étrangère permet la jointure.

**Lecture des erreurs possibles**

- A : Une requête est pensée séquentiellement comme un programme.
- C : Filtrer et projeter sont confondus.
- D : Une requête est pensée séquentiellement comme un programme.

**Critère d'attribution du point :** la réponse respecte la méthode suivante : Distinguer lignes filtrées et colonnes sélectionnées.

**Source :** `n06:n06-i3`

## Décision pédagogique

| Résultat | Statut du nœud | Action pour la séance suivante |
|---:|---|---|
| 3/3 | ACQUIS | Réactivation brève puis palier supérieur |
| 2/3 | FRAGILE | Reprise ciblée de l'erreur et nouvel item court |
| 0–1/3 | NON_ACQUIS | Fiche de reprise, guidage et nouvelle vérification |

Une réponse encore en correction manuelle reste `PENDING_REVIEW` et ne doit pas être comptée comme un échec.
