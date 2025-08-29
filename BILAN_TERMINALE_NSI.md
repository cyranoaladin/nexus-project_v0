Parfait 👍 J’ai maintenant les programmes de **NSI Première** et de **NSI Terminale**.
Voici un **document complet** qui formalise le **Bilan gratuit NSI Terminale**, avec les deux volets (connaissances & profil pédagogique) et un pipeline technique identique à celui conçu pour Maths et NSI Première.

---

# 📊 Bilan Terminale NSI — QCM + Volet Pédagogique + Pipeline

## 1) Objectif

Évaluer un élève entrant en **Terminale NSI** sur :

* **Volet 1 (QCM)** : consolidation des acquis de **Première NSI**, essentiels pour suivre le programme de Terminale.
* **Volet 2 (Profil pédagogique)** : habitudes de travail, motivations, difficultés éventuelles (DYS, TDAH…), rapport à la programmation, projets et orientation.

Résultat : un **diagnostic clair**, une **feuille de route personnalisée** et une **proposition d’offre Nexus Réussite** adaptée.

---

## 2) Volet 1 — QCM Terminale (40 questions pondérées)

**JSON structuré** : `data/qcm_premiere_for_terminale.json`

Extrait (format identique au bilan Première) :

```json
[
  {
    "id": "Q1",
    "domain": "Représentation des données",
    "weight": 2,
    "statement": "Quel encodage permet de représenter la plupart des langues humaines ?",
    "options": ["ASCII", "ISO-8859-1", "Unicode", "UTF-7"],
    "answer": 2,
    "critical": true
  },
  {
    "id": "Q12",
    "domain": "Algorithmique",
    "weight": 3,
    "statement": "Quelle est la complexité moyenne de la recherche dichotomique ?",
    "options": ["O(1)", "O(n)", "O(log n)", "O(n log n)"],
    "answer": 2,
    "critical": true
  },
  {
    "id": "Q23",
    "domain": "Langages & Programmation",
    "weight": 2,
    "statement": "En Python, que retourne `len({1,2,2,3})` ?",
    "options": ["3", "4", "Erreur", "None"],
    "answer": 0,
    "critical": false
  },
  {
    "id": "Q37",
    "domain": "Bases de données",
    "weight": 3,
    "statement": "En SQL, que fait `SELECT * FROM Eleves WHERE note > 15;` ?",
    "options": [
      "Affiche tous les élèves avec note > 15",
      "Modifie les notes des élèves",
      "Ajoute une ligne dans la table",
      "Supprime les élèves avec note ≤ 15"
    ],
    "answer": 0,
    "critical": true
  }
]
```

> 40 questions couvrant **Première NSI** : représentation des données, structures de base, tables, IHM web simple, algorithmique, Python, réseaux, projets.

---

## 3) Volet 2 — Questionnaire Pédagogique NSI

**JSON structuré** : `data/pedago_nsi_terminale.json`

Extrait :

```json
[
  {
    "id": "P1",
    "category": "Motivation",
    "question": "Pourquoi avez-vous choisi de poursuivre NSI en Terminale ?",
    "type": "text"
  },
  {
    "id": "P6",
    "category": "Pratiques",
    "question": "Combien de temps consacrez-vous par semaine à la programmation personnelle ?",
    "type": "single",
    "options": ["Aucun", "<1h", "1-3h", "3-5h", "5h+"]
  },
  {
    "id": "P12",
    "category": "Difficultés",
    "question": "Avez-vous déjà rencontré des difficultés persistantes (syntaxiques, conceptuelles, organisationnelles) ?",
    "type": "multi",
    "options": ["Syntaxe", "Algorithmique", "Organisation projet", "Travail en groupe", "Autres"]
  },
  {
    "id": "P18",
    "category": "Projet",
    "question": "Quel type de projet vous motive le plus pour cette année de Terminale ?",
    "type": "single",
    "options": [
      "Développement d’un site web avec base de données",
      "Application mobile",
      "Projet IA / apprentissage automatique",
      "Jeu vidéo",
      "Simulation scientifique"
    ]
  }
]
```

---

## 4) Pipeline technique (uniformisé)

### a) **Adaptateur TS (React/Next.js)**

* Wizard `BilanWizard` : étapes QCM → Volet Pédago → Résultats.
* `lib/scoring/qcm.ts` → calcule scores par domaine + %.
* `lib/scoring/pedago.ts` → profil élève (style, difficultés, motivation).
* `lib/scoring/synthese.ts` → forces, faiblesses, risques, feuille de route.

### b) **Script Python radar (matplotlib)**

```python
from scoring_utils import score_qcm, plot_radar

answers = {...}  # dict réponses élève
total, max_total, dom_scores = score_qcm(answers, "data/qcm_premiere_for_terminale.json")
print("Résultat:", total, "/", max_total)
plot_radar(dom_scores, title="Bilan Terminale NSI")
```

### c) **PDF React-PDF**

* `variant="parent"` → analyse pédagogique + ROI (coût/temps → bénéfices Bac/Parcoursup).
* `variant="eleve"` → style gamifié (badges, encouragements, missions).

Exemple :

```tsx
<BilanPdfNSI bilan={bilan} variant="parent" />
<BilanPdfNSI bilan={bilan} variant="eleve" />
```

---

## 5) Sorties attendues

1. **Dashboard élève** : radar, badges, feuille de route (8 semaines).
2. **Dashboard parent** : analyse pédagogique + ROI (heures de coaching, impact mention).
3. **PDF auto-généré** : logo Nexus + watermark + version parent/élève.
4. **Mail automatique** : PDF attaché à élève + parent.

---

⚡ Résultat :
Un élève entrant en **Terminale NSI** reçoit un bilan complet sur ses acquis de Première, un diagnostic de son profil de travail, et une feuille de route claire, avec des **offres Nexus Réussite adaptées** (Studio Flex pour soutien ponctuel, Académies pour intensif, Odyssée pour stratégie Bac/Parcoursup, Cortex IA 24/7 pour autonomie).

Parfait — voici le **QCM “Première → Terminale NSI” complet (40 questions)**, prêt à consommer par ton pipeline (même format que les autres QCM).
Domaines couverts : Représentation des données, Algorithmique & Complexité, Python, Structures de données, Bases SQL, Web & IHM, Réseaux & Protocoles, Architecture & OS.

```json
{
  "meta": {
    "title": "Bilan d'entrée Terminale — NSI",
    "niveauCible": "Terminale",
    "base": "Prérequis de Première NSI",
    "totalQuestions": 40,
    "domainsOrder": [
      "Representations",
      "AlgoComplexite",
      "Python",
      "Structures",
      "SQL",
      "WebIHM",
      "Reseaux",
      "ArchOS"
    ],
    "scoring": "weight per question; critical weighted higher for Terminale"
  },
  "questions": [
    { "id": "Q1", "domain": "Representations", "weight": 2, "critical": true, "type": "single", "statement": "Quel standard permet de représenter la plupart des langues humaines ?", "options": ["ASCII", "ISO-8859-1", "Unicode", "Base64"], "answer": 2 },
    { "id": "Q2", "domain": "Representations", "weight": 2, "critical": false, "type": "single", "statement": "Quel est l'équivalent hexadécimal de l'octet binaire 1111 0000 ?", "options": ["0x0F", "0xF0", "0xFF", "0xF1"], "answer": 1 },
    { "id": "Q3", "domain": "Representations", "weight": 2, "critical": false, "type": "single", "statement": "Le code Huffman est un exemple de :", "options": ["Codage à longueur fixe", "Codage à longueur variable", "Chiffrement symétrique", "Hachage"], "answer": 1 },
    { "id": "Q4", "domain": "Representations", "weight": 2, "critical": false, "type": "single", "statement": "Le hachage SHA-256 produit :", "options": ["Une sortie de taille variable", "Une sortie 256 bits", "Un chiffrement réversible", "Un encodage ASCII"], "answer": 1 },
    { "id": "Q5", "domain": "Representations", "weight": 3, "critical": true, "type": "single", "statement": "Quel format est le plus adapté pour échanger des données structurées sur le Web ?", "options": ["CSV", "TXT", "JSON", "BMP"], "answer": 2 },

    { "id": "Q6", "domain": "AlgoComplexite", "weight": 3, "critical": true, "type": "single", "statement": "Complexité moyenne de la recherche dichotomique :", "options": ["O(1)", "O(n)", "O(log n)", "O(n log n)"], "answer": 2 },
    { "id": "Q7", "domain": "AlgoComplexite", "weight": 2, "critical": false, "type": "single", "statement": "Le tri par insertion a une complexité pire cas :", "options": ["O(n)", "O(n log n)", "O(n^2)", "O(log n)"], "answer": 2 },
    { "id": "Q8", "domain": "AlgoComplexite", "weight": 2, "critical": false, "type": "single", "statement": "Un invariant de boucle est :", "options": ["Une variable globale", "Une propriété vraie à chaque itération", "Une condition d'arrêt", "Un compteur"], "answer": 1 },
    { "id": "Q9", "domain": "AlgoComplexite", "weight": 2, "critical": false, "type": "single", "statement": "La récursivité nécessite :", "options": ["Toujours moins de mémoire", "Une condition d'arrêt", "Un tri préalable", "Un graphe orienté"], "answer": 1 },
    { "id": "Q10", "domain": "AlgoComplexite", "weight": 3, "critical": true, "type": "single", "statement": "Dans un graphe pondéré sans arêtes négatives, l'algorithme classique pour plus court chemin depuis une source est :", "options": ["Kruskal", "Prim", "Dijkstra", "Bellman-Ford"], "answer": 2 },

    { "id": "Q11", "domain": "Python", "weight": 2, "critical": false, "type": "single", "statement": "Que vaut `len({1,2,2,3})` en Python ?", "options": ["2", "3", "4", "Erreur"], "answer": 1 },
    { "id": "Q12", "domain": "Python", "weight": 2, "critical": false, "type": "single", "statement": "Quelle construction crée un itérateur paresseux ?", "options": ["[x*x for x in L]", "(x*x for x in L)", "list(map(f,L))", "set(L)"], "answer": 1 },
    { "id": "Q13", "domain": "Python", "weight": 2, "critical": true, "type": "single", "statement": "Différence `is` vs `==` :", "options": ["Aucune", "`is` compare l'identité objet, `==` la valeur", "`is` compare la valeur, `==` le type", "`==` compare l'identité"], "answer": 1 },
    { "id": "Q14", "domain": "Python", "weight": 2, "critical": false, "type": "single", "statement": "Que retourne `dict.get('k',0)` si 'k' absent ?", "options": ["None", "0", "Exception", "'k'"], "answer": 1 },
    { "id": "Q15", "domain": "Python", "weight": 3, "critical": true, "type": "single", "statement": "Quel est l'intérêt d'un test unitaire (`assert`) ?", "options": ["Mesurer le temps", "Valider automatiquement un comportement", "Remplacer la doc", "Optimiser la mémoire"], "answer": 1 },

    { "id": "Q16", "domain": "Structures", "weight": 3, "critical": true, "type": "single", "statement": "Une pile (stack) respecte :", "options": ["FIFO", "LIFO", "Tri croissant", "Accès aléatoire O(1)"], "answer": 1 },
    { "id": "Q17", "domain": "Structures", "weight": 2, "critical": false, "type": "single", "statement": "Complexité moyenne de l'accès par clé dans un dict Python :", "options": ["O(1)", "O(log n)", "O(n)", "O(n log n)"], "answer": 0 },
    { "id": "Q18", "domain": "Structures", "weight": 2, "critical": false, "type": "single", "statement": "Un arbre binaire de recherche (BST) mal équilibré a une hauteur :", "options": ["Toujours O(log n)", "O(1)", "Pire cas O(n)", "Toujours O(n log n)"], "answer": 2 },
    { "id": "Q19", "domain": "Structures", "weight": 2, "critical": false, "type": "single", "statement": "Pour détecter une présence rapide dans une grande collection non ordonnée on choisit :", "options": ["liste", "tuple", "ensemble (set)", "liste triée"], "answer": 2 },
    { "id": "Q20", "domain": "Structures", "weight": 3, "critical": true, "type": "single", "statement": "Une file de priorité implémentée par tas binaire permet :", "options": ["Insertion O(1), extraction O(1)", "Insertion O(log n), extraction O(log n)", "Tri O(1)", "Suppression O(n^2)"], "answer": 1 },

    { "id": "Q21", "domain": "SQL", "weight": 2, "critical": false, "type": "single", "statement": "Clé primaire :", "options": ["Peut contenir des doublons", "Identifie de manière unique chaque ligne", "Toujours textuelle", "Optionnelle si clé étrangère"], "answer": 1 },
    { "id": "Q22", "domain": "SQL", "weight": 2, "critical": false, "type": "single", "statement": "Que fait `SELECT COUNT(*) FROM T WHERE note>=10;` ?", "options": ["Somme des notes", "Nombre de lignes ayant note>=10", "Moyenne des notes", "Crée une vue"], "answer": 1 },
    { "id": "Q23", "domain": "SQL", "weight": 3, "critical": true, "type": "single", "statement": "Jointure : récupérer élèves et leurs classes (tables Eleve(id,classe_id), Classe(id,nom)) :", "options": ["SELECT * FROM Eleve JOIN Classe ON id=id", "SELECT * FROM Eleve E JOIN Classe C ON E.classe_id=C.id", "SELECT * FROM Eleve,Classe WHERE classe_id=id AND id=id", "SELECT Eleve.*,Classe.* WHERE Eleve.classe_id"], "answer": 1 },
    { "id": "Q24", "domain": "SQL", "weight": 2, "critical": false, "type": "single", "statement": "Contrôler l'injection SQL côté serveur se fait notamment par :", "options": ["Concaténation de chaînes", "Requêtes paramétrées (préparées)", "Commentaires SQL", "Compression Gzip"], "answer": 1 },
    { "id": "Q25", "domain": "SQL", "weight": 3, "critical": true, "type": "single", "statement": "Indexer une colonne augmente en général :", "options": ["La taille et la vitesse des recherches sur cette colonne", "La vitesse d'insertion uniquement", "La compression des lignes", "La sécurité"], "answer": 0 },

    { "id": "Q26", "domain": "WebIHM", "weight": 2, "critical": false, "type": "single", "statement": "Rôle du HTML :", "options": ["Logique métier", "Présentation uniquement", "Structure et contenu", "Requête SQL"], "answer": 2 },
    { "id": "Q27", "domain": "WebIHM", "weight": 2, "critical": false, "type": "single", "statement": "Une requête GET est surtout utilisée pour :", "options": ["Envoyer un mot de passe", "Récupérer une ressource", "Uploader un gros fichier", "Ouvrir un socket TCP brut"], "answer": 1 },
    { "id": "Q28", "domain": "WebIHM", "weight": 3, "critical": true, "type": "single", "statement": "Les cookies servent principalement à :", "options": ["Chiffrer le trafic", "Persister de l'état (ex : session)", "Accélérer la CPU", "Éviter le HTTPS"], "answer": 1 },
    { "id": "Q29", "domain": "WebIHM", "weight": 2, "critical": false, "type": "single", "statement": "Dans le modèle client/serveur Web :", "options": ["Le navigateur exécute Python", "Le serveur répond à des requêtes HTTP du client", "Le client exécute SQL sur le SGBD distant", "Aucune communication"], "answer": 1 },
    { "id": "Q30", "domain": "WebIHM", "weight": 2, "critical": false, "type": "single", "statement": "Protection CSRF côté serveur :", "options": ["Token synchronisé", "Désactiver CSS", "Changer de port", "Mettre en cache"], "answer": 0 },

    { "id": "Q31", "domain": "Reseaux", "weight": 3, "critical": true, "type": "single", "statement": "Le protocole DNS associe :", "options": ["IP → MAC", "Nom de domaine → adresse IP", "HTTP → TLS", "Port → processus"], "answer": 1 },
    { "id": "Q32", "domain": "Reseaux", "weight": 2, "critical": false, "type": "single", "statement": "HTTPS signifie :", "options": ["HTTP en clair", "HTTP sur TLS (chiffré)", "FTP sécurisé", "SSH"], "answer": 1 },
    { "id": "Q33", "domain": "Reseaux", "weight": 2, "critical": false, "type": "single", "statement": "Dans TCP, le contrôle de flux sert à :", "options": ["Éviter l'engorgement du réseau", "Partager la bande passante entre processus", "Adapter l'envoi à la capacité du récepteur", "Compresser les paquets"], "answer": 2 },
    { "id": "Q34", "domain": "Reseaux", "weight": 2, "critical": false, "type": "single", "statement": "Une requête HTTP contient typiquement :", "options": ["Uniquement le corps", "Méthode + chemin + en-têtes", "Du code Python exécuté", "Des tables SQL"], "answer": 1 },
    { "id": "Q35", "domain": "Reseaux", "weight": 3, "critical": true, "type": "single", "statement": "Adresse IPv4 privée valide :", "options": ["8.8.8.8", "192.168.1.10", "1.1.1.1", "172.33.0.1"], "answer": 1 },

    { "id": "Q36", "domain": "ArchOS", "weight": 2, "critical": false, "type": "single", "statement": "Un OS gère notamment :", "options": ["Uniquement l'affichage", "CPU, mémoire, fichiers, E/S", "Le routage Internet mondial", "Le balisage HTML"], "answer": 1 },
    { "id": "Q37", "domain": "ArchOS", "weight": 2, "critical": false, "type": "single", "statement": "Commande Unix pour lister les fichiers :", "options": ["cat", "ls", "ps", "top"], "answer": 1 },
    { "id": "Q38", "domain": "ArchOS", "weight": 2, "critical": false, "type": "single", "statement": "Sur Linux, `chmod 640 f` signifie :", "options": ["rw- r-- ---", "r-- rw- ---", "rwx r-x ---", "rw- --- r--"], "answer": 0 },
    { "id": "Q39", "domain": "ArchOS", "weight": 3, "critical": true, "type": "single", "statement": "Dans l’architecture de Von Neumann :", "options": ["Code et données partagent la même mémoire", "Le CPU est optionnel", "Les entrées/sorties sont codées en HTML", "Il n'y a pas de bus"], "answer": 0 },
    { "id": "Q40", "domain": "ArchOS", "weight": 3, "critical": true, "type": "single", "statement": "Pour automatiser des tâches de projet (tests, build) on utilise :", "options": ["Éditeur de texte uniquement", "Scripts/CI (ex. GitHub Actions)", "Un tableur", "Le navigateur"], "answer": 1 }
  ]
}
```

Souhaites-tu que je génère aussi :

* le **script Python** `score_radar_nsi_terminale.py` (copie adaptée de Première) ;
* l’**adapter TS** `adapter_terminale_nsi.ts` (forces/faiblesses, feuille de route S1–S8, offres Nexus) ;
* et le **template PDF React-PDF** Parent/Élève pour Terminale ?

