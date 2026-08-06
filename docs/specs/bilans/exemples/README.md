# Exemples de bilans Canonical

Ces six fichiers sont les rendus de référence A95 du pack `entree-premiere-maths-v1`
pour les audiences ELEVE, PARENTS et NEXUS, en HTML et PDF.

- la FactSheet est synthétique et issue de la recette déterministe ;
- l'identité `Élève de démonstration` n'est pas une donnée réelle ;
- les fichiers sont produits par le moteur Canonical partagé, sans LLM, agent ni RAG ;
- la CI les compare byte-for-byte au résultat du générateur.

Vérifier sans écrire :

```bash
npx tsx scripts/bilans/generate-rendered-examples.ts --check
```

Une mise à jour intentionnelle exige `--write`, une inspection visuelle des six fichiers
et un commit qui justifie la variation.
