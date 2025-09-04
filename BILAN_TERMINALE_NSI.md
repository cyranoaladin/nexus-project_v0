Parfait — je vous livre **les deux livrables attendus pour NSI Terminale** :

1. **Un QCM JSON “entrée en Terminale NSI”** (portant uniquement sur le **programme de Première** : types & représentation des données, tableaux/dictionnaires, tables, algorithmique de base, IHM Web, archi/OS/réseaux, langages & programmation).
2. **Un document “BILAN\_NSI\_TERMINALE.md”** prêt pour Cursor (objectifs, fichiers à créer, endpoints, scoring, rendu PDF, tests, etc.), strictement borné au périmètre **Première → pré-requis Terminale**, aligné sur les programmes officiels. &#x20;

---

# 1) `data/qcm_premiere_for_terminale_nsi.json`

> **Schéma identique** à vos QCM précédents :
> `id, domain, type ("mcq" | "numeric" | "short"), difficulty ("A"|"B"|"C"), weight (1..3), prompt_latex (ou texte simple), choices[] (si mcq), answer_latex (si numeric/short), explanation_latex`.

```json
[
  { "id":"NSI1-DON-Q1","domain":"donnees","type":"mcq","difficulty":"A","weight":1,
    "prompt_latex":"En base 2, la valeur binaire 101101 vaut (en base 10) :",
    "choices":[
      {"k":"A","latex":"45","correct":true},
      {"k":"B","latex":"43"},
      {"k":"C","latex":"41"},
      {"k":"D","latex":"47"}
    ],
    "explanation_latex":"1*32+0*16+1*8+1*4+0*2+1*1=45."},

  { "id":"NSI1-DON-Q2","domain":"donnees","type":"mcq","difficulty":"A","weight":1,
    "prompt_latex":"En binaire signé (complément à 2 sur 8 bits), l’intervalle représentable est :",
    "choices":[
      {"k":"A","latex":"[-255, +255]"},
      {"k":"B","latex":"[-128, +127]","correct":true},
      {"k":"C","latex":"[0, 255]"},
      {"k":"D","latex":"[-127, +128]"}
    ],
    "explanation_latex":"Sur n bits : [-2^{n-1},2^{n-1}-1]."},

  { "id":"NSI1-DON-Q3","domain":"donnees","type":"mcq","difficulty":"A","weight":1,
    "prompt_latex":"Pourquoi $0.1 + 0.2 \\neq 0.3$ en flottant binaire ?",
    "choices":[
      {"k":"A","latex":"Bug du langage"},
      {"k":"B","latex":"Arrondi et représentation binaire finie","correct":true},
      {"k":"C","latex":"Addition non associative"},
      {"k":"D","latex":"Division par 0 implicite"}
    ],
    "explanation_latex":"Certaines décimales n'ont pas de représentation binaire finie."},

  { "id":"NSI1-DON-Q4","domain":"donnees","type":"mcq","difficulty":"A","weight":1,
    "prompt_latex":"Quel encodage permet d’unifier la plupart des écritures ?",
    "choices":[
      {"k":"A","latex":"ASCII"},
      {"k":"B","latex":"ISO-8859-1"},
      {"k":"C","latex":"Unicode/UTF-8","correct":true},
      {"k":"D","latex":"EBCDIC"}
    ],
    "explanation_latex":"UTF-8 est l'encodage Unicode le plus courant."},

  { "id":"NSI1-DON-Q5","domain":"donnees","type":"mcq","difficulty":"A","weight":1,
    "prompt_latex":"Dans Python, un dictionnaire est approprié pour :",
    "choices":[
      {"k":"A","latex":"Conserver l’ordre strict d’insertion (seulement)"},
      {"k":"B","latex":"Associer des clés à des valeurs","correct":true},
      {"k":"C","latex":"Parcourir en O(1) toutes les valeurs"},
      {"k":"D","latex":"Calculs vectoriels rapides"}
    ],
    "explanation_latex":"Map clé\\rightarrow valeur ; recherche moyenne O(1)."},

  { "id":"NSI1-DON-Q6","domain":"donnees","type":"short","difficulty":"A","weight":1,
    "prompt_latex":"En Python, écrire une compréhension de liste créant la liste [0,2,4,6] :",
    "answer_latex":"[2*i for i in range(4)]",
    "explanation_latex":"Compréhension simple sur range(4)."},

  { "id":"NSI1-TABLE-Q7","domain":"tables","type":"mcq","difficulty":"A","weight":1,
    "prompt_latex":"Une « table » de données au sens NSI Première est :",
    "choices":[
      {"k":"A","latex":"Une base relationnelle SQL complète"},
      {"k":"B","latex":"Un tableau de p-uplets nommés (ou dicts)","correct":true},
      {"k":"C","latex":"Un graphe orienté"},
      {"k":"D","latex":"Un fichier binaire compressé"}
    ],
    "explanation_latex":"Tables = listes de p-uplets nommés pour préparer la BD en Terminale."},

  { "id":"NSI1-TABLE-Q8","domain":"tables","type":"mcq","difficulty":"B","weight":2,
    "prompt_latex":"Pour filtrer les lignes d’une table selon un prédicat logique, on utilise :",
    "choices":[
      {"k":"A","latex":"Une expression booléenne sur chaque ligne","correct":true},
      {"k":"B","latex":"Un tri aléatoire"},
      {"k":"C","latex":"Un chiffrement préalable"},
      {"k":"D","latex":"Une compilation en C"}
    ],
    "explanation_latex":"Filtrage = sélection par expression (WHERE-like)."},

  { "id":"NSI1-TABLE-Q9","domain":"tables","type":"short","difficulty":"B","weight":2,
    "prompt_latex":"Écrire en Python le filtrage des personnes majeures (age\\ge 18) dans une liste de dicts 'rows' :",
    "answer_latex":"[r for r in rows if r['age']>=18]",
    "explanation_latex":"Sélection par compréhension de liste."},

  { "id":"NSI1-ALGO-Q10","domain":"algorithmique","type":"mcq","difficulty":"A","weight":1,
    "prompt_latex":"Le coût d’une recherche séquentielle dans un tableau non trié (pire cas) est :",
    "choices":[
      {"k":"A","latex":"O(1)"},
      {"k":"B","latex":"O(n)","correct":true},
      {"k":"C","latex":"O(\\log n)"},
      {"k":"D","latex":"O(n\\log n)"}
    ],
    "explanation_latex":"Parcours complet dans le pire cas."},

  { "id":"NSI1-ALGO-Q11","domain":"algorithmique","type":"mcq","difficulty":"B","weight":2,
    "prompt_latex":"La recherche dichotomique nécessite :",
    "choices":[
      {"k":"A","latex":"Un tableau non trié"},
      {"k":"B","latex":"Un tableau trié","correct":true},
      {"k":"C","latex":"Des clés uniques (obligatoire)"},
      {"k":"D","latex":"Des indices négatifs"}
    ],
    "explanation_latex":"Précondition : données triées."},

  { "id":"NSI1-ALGO-Q12","domain":"algorithmique","type":"mcq","difficulty":"B","weight":2,
    "prompt_latex":"Le tri par insertion a un coût en pire cas :",
    "choices":[
      {"k":"A","latex":"O(n)"},
      {"k":"B","latex":"O(\\log n)"},
      {"k":"C","latex":"O(n^2)","correct":true},
      {"k":"D","latex":"O(n\\log n)"}
    ],
    "explanation_latex":"Insertion/selection quadratiques en pire cas."},

  { "id":"NSI1-ALGO-Q13","domain":"algorithmique","type":"short","difficulty":"A","weight":1,
    "prompt_latex":"Donner un invariant de boucle possible pour un tri par insertion.",
    "answer_latex":"Après i itérations, le sous-tableau [0..i) est trié.",
    "explanation_latex":"Invariant classique du tri par insertion."},

  { "id":"NSI1-ALGO-Q14","domain":"algorithmique","type":"mcq","difficulty":"B","weight":2,
    "prompt_latex":"Dans l’algorithme k plus proches voisins (k-NN), la prédiction est :",
    "choices":[
      {"k":"A","latex":"La moyenne des classes"},
      {"k":"B","latex":"La classe majoritaire parmi les k voisins","correct":true},
      {"k":"C","latex":"La classe du voisin le plus éloigné"},
      {"k":"D","latex":"La classe la plus rare"}
    ],
    "explanation_latex":"Vote majoritaire sur les k plus proches voisins."},

  { "id":"NSI1-PROG-Q15","domain":"programmation","type":"mcq","difficulty":"A","weight":1,
    "prompt_latex":"Une « spécification » de fonction sert à :",
    "choices":[
      {"k":"A","latex":"Minifier le code"},
      {"k":"B","latex":"Décrire préconditions/postconditions","correct":true},
      {"k":"C","latex":"Optimiser le binaire"},
      {"k":"D","latex":"Générer l’interface HTML"}
    ],
    "explanation_latex":"Contrat : arguments attendus, résultats, effets."},

  { "id":"NSI1-PROG-Q16","domain":"programmation","type":"short","difficulty":"A","weight":1,
    "prompt_latex":"Écrire une assertion Python garantissant que n est strictement positif.",
    "answer_latex":"assert n>0",
    "explanation_latex":"Assertion = garde d’exécution."},

  { "id":"NSI1-PROG-Q17","domain":"programmation","type":"mcq","difficulty":"A","weight":1,
    "prompt_latex":"Dans un module Python, __name__ vaut '__main__' lorsque :",
    "choices":[
      {"k":"A","latex":"Le module est importé"},
      {"k":"B","latex":"Le module est exécuté directement","correct":true},
      {"k":"C","latex":"La version de Python > 3.10"},
      {"k":"D","latex":"Le module contient une classe Main"}
    ],
    "explanation_latex":"Point d’entrée script."},

  { "id":"NSI1-PROG-Q18","domain":"programmation","type":"short","difficulty":"B","weight":2,
    "prompt_latex":"Écrire un test unitaire (pytest) vérifiant que f(3)==7.",
    "answer_latex":"def test_f():\n    assert f(3)==7",
    "explanation_latex":"Test minimal sous pytest."},

  { "id":"NSI1-WEB-Q19","domain":"web_ihm","type":"mcq","difficulty":"A","weight":1,
    "prompt_latex":"Dans une IHM Web, un « événement » typique est :",
    "choices":[
      {"k":"A","latex":"compilation"},
      {"k":"B","latex":"clic","correct":true},
      {"k":"C","latex":"sérialisation mémoire"},
      {"k":"D","latex":"pagination disque"}
    ],
    "explanation_latex":"Clic, input, submit, etc."},

  { "id":"NSI1-WEB-Q20","domain":"web_ihm","type":"mcq","difficulty":"A","weight":1,
    "prompt_latex":"Différence principale entre GET et POST :",
    "choices":[
      {"k":"A","latex":"GET chiffre toujours en HTTPS, POST non"},
      {"k":"B","latex":"GET met les paramètres dans l’URL ; POST dans le corps","correct":true},
      {"k":"C","latex":"GET modifie la BD ; POST jamais"},
      {"k":"D","latex":"Aucune"}
    ],
    "explanation_latex":"GET=paramètres URL ; POST=corps."},

  { "id":"NSI1-WEB-Q21","domain":"web_ihm","type":"mcq","difficulty":"B","weight":2,
    "prompt_latex":"Dans un dialogue client/serveur, on distingue :",
    "choices":[
      {"k":"A","latex":"Ce qui s’exécute côté client vs côté serveur","correct":true},
      {"k":"B","latex":"Seulement des traitements côté serveur"},
      {"k":"C","latex":"Seulement des traitements côté client"},
      {"k":"D","latex":"Aucun état de session possible"}
    ],
    "explanation_latex":"Répartition des rôles et des états."},

  { "id":"NSI1-ARCH-Q22","domain":"arch_os_reseaux","type":"mcq","difficulty":"A","weight":1,
    "prompt_latex":"Le modèle de Von Neumann décrit :",
    "choices":[
      {"k":"A","latex":"Un réseau pair-à-pair"},
      {"k":"B","latex":"Une architecture avec mémoire, UC et unité de contrôle","correct":true},
      {"k":"C","latex":"Un protocole mail"},
      {"k":"D","latex":"Un modèle d’IHM"}
    ],
    "explanation_latex":"Séparation UC/mémoire/E/S."},

  { "id":"NSI1-ARCH-Q23","domain":"arch_os_reseaux","type":"mcq","difficulty":"A","weight":1,
    "prompt_latex":"Le système d’exploitation gère notamment :",
    "choices":[
      {"k":"A","latex":"Le routage intercontinental"},
      {"k":"B","latex":"La création/ordonnancement de processus","correct":true},
      {"k":"C","latex":"Le chiffrement SSL seul"},
      {"k":"D","latex":"Le partitionnement RAID matériel"}
    ],
    "explanation_latex":"Gestion processus/ressources, E/S, etc."},

  { "id":"NSI1-ARCH-Q24","domain":"arch_os_reseaux","type":"mcq","difficulty":"B","weight":2,
    "prompt_latex":"Sur un réseau, encapsulation en paquets signifie :",
    "choices":[
      {"k":"A","latex":"Compression zip"},
      {"k":"B","latex":"Découpage des données avec en-têtes de protocole","correct":true},
      {"k":"C","latex":"Chiffrement systématique"},
      {"k":"D","latex":"Aucun contrôle d’erreur"}
    ],
    "explanation_latex":"Trames/paquets/segments avec métadonnées."},

  { "id":"NSI1-ARCH-Q25","domain":"arch_os_reseaux","type":"mcq","difficulty":"B","weight":2,
    "prompt_latex":"Le « bit alterné » sert à :",
    "choices":[
      {"k":"A","latex":"Accélérer la 3D"},
      {"k":"B","latex":"Récupérer des pertes de paquets (ARQ simple)","correct":true},
      {"k":"C","latex":"Coder en UTF-32"},
      {"k":"D","latex":"Allouer la mémoire"}
    ],
    "explanation_latex":"Protocole simple d’acquittement/relance."},

  { "id":"NSI1-PROG-Q26","domain":"programmation","type":"short","difficulty":"B","weight":2,
    "prompt_latex":"Écrire une fonction Python récursive fact(n) qui renvoie n! (n≥0) ; base 0!=1.",
    "answer_latex":"def fact(n):\n    return 1 if n==0 else n*fact(n-1)",
    "explanation_latex":"Définition récursive classique ; à ne pas utiliser pour n trop grand en pratique."},

  { "id":"NSI1-PROG-Q27","domain":"programmation","type":"mcq","difficulty":"B","weight":2,
    "prompt_latex":"Dans un projet Python, la « modularité » vise notamment :",
    "choices":[
      {"k":"A","latex":"À coller tout dans un seul fichier"},
      {"k":"B","latex":"À séparer en modules réutilisables testables","correct":true},
      {"k":"C","latex":"À supprimer les tests"},
      {"k":"D","latex":"À remplacer la documentation"}
    ],
    "explanation_latex":"Séparation des responsabilités, réutilisation, testabilité."},

  { "id":"NSI1-ALGO-Q28","domain":"algorithmique","type":"mcq","difficulty":"B","weight":2,
    "prompt_latex":"La terminaison d’une boucle non bornée est usuellement prouvée par :",
    "choices":[
      {"k":"A","latex":"Un invariant"},
      {"k":"B","latex":"Un variant décroissant borné","correct":true},
      {"k":"C","latex":"Un commentaire TODO"},
      {"k":"D","latex":"Un print dans la boucle"}
    ],
    "explanation_latex":"Variant >0 qui décroît garantit la terminaison."},

  { "id":"NSI1-WEB-Q29","domain":"web_ihm","type":"short","difficulty":"A","weight":1,
    "prompt_latex":"Citer 2 exemples d’événements DOM courants.",
    "answer_latex":"click, input (ou submit, change, keydown, etc.)",
    "explanation_latex":"Événements standards IHM."},

  { "id":"NSI1-DON-Q30","domain":"donnees","type":"short","difficulty":"A","weight":1,
    "prompt_latex":"Écrire en Python la création d’un p-uplet (tuple) nommés avec name='Ada', year=1843 (via dict).",
    "answer_latex":"{'name':'Ada','year':1843}",
    "explanation_latex":"Un enregistrement peut être modélisé par un dict clé/valeur."},

  { "id":"NSI1-TABLE-Q31","domain":"tables","type":"mcq","difficulty":"B","weight":2,
    "prompt_latex":"Fusionner deux tables (liste de dicts) selon une clé commune revient à :",
    "choices":[
      {"k":"A","latex":"Concaténer les chaînes"},
      {"k":"B","latex":"Réaliser un appariement par clé (join)","correct":true},
      {"k":"C","latex":"Tronquer les colonnes"},
      {"k":"D","latex":"Compresser en gzip"}
    ],
    "explanation_latex":"Join par clé ; préfigure JOIN SQL vu en Terminale."},

  { "id":"NSI1-PROG-Q32","domain":"programmation","type":"short","difficulty":"A","weight":1,
    "prompt_latex":"Écrire une signature (docstring) simple pour une fonction somme(a,b) décrivant arguments et retour.",
    "answer_latex":"def somme(a,b):\n    \"\"\"Retourne a+b ; a,b nombres (int/float).\"\"\"\n    return a+b",
    "explanation_latex":"Spécification/le contrat dans la docstring."},

  { "id":"NSI1-MINI-Q33","domain":"mini_ex","type":"short","difficulty":"C","weight":4,
    "prompt_latex":"(Mini) Sur une table de films (dicts : titre, annee, duree), écrire un code Python qui : (a) filtre annee>=2000 ; (b) trie par duree décroissante ; (c) renvoie les titres.",
    "answer_latex":"f=[r for r in films if r['annee']>=2000]\nres=[r['titre'] for r in sorted(f,key=lambda x:x['duree'],reverse=True)]",
    "explanation_latex":"Filtrage, tri, projection."},

  { "id":"NSI1-MINI-Q34","domain":"mini_ex","type":"short","difficulty":"C","weight":4,
    "prompt_latex":"(Mini) Écrire une recherche dichotomique en Python qui renvoie l’indice d’une valeur v dans un tableau trié t (ou -1).",
    "answer_latex":"def binsearch(t,v):\n    l,r=0,len(t)-1\n    while l<=r:\n        m=(l+r)//2\n        if t[m]==v: return m\n        if t[m]<v: l=m+1\n        else: r=m-1\n    return -1",
    "explanation_latex":"Précondition : t trié ; boucle avec variant."},

  { "id":"NSI1-MINI-Q35","domain":"mini_ex","type":"short","difficulty":"C","weight":4,
    "prompt_latex":"(Mini) Écrire un test pytest pour la fonction précédente et un cas bord (valeur absente).",
    "answer_latex":"def test_binsearch():\n    t=[1,3,5,7]\n    assert binsearch(t,5)==2\n    assert binsearch(t,2)==-1",
    "explanation_latex":"Cas présent/absent."
  }
]
```

---

# 2) `BILAN_NSI_TERMINALE.md` (prêt pour Cursor)

## 0) Finalité & bornage

* **But** : évaluer, **exclusivement sur le programme de Première NSI**, les **pré-requis** indispensables pour réussir la **Terminale NSI** (aucune question de Terminale).
* **Références** : programmes officiels **Première** et **Terminale** (utilisés uniquement pour repérer les pré-requis/continuités), Ministère de l’Éducation nationale. &#x20;

**Sorties** :

1. Scores par domaines + **profil radar** (données/tables, algorithmique, programmation, web/IHM, archi-OS-réseaux).
2. **Bilan texte** (diagnostic + priorités de remédiation, sans contenu de Terminale).
3. **PDF LaTeX** (élève/parent/nexus), rendu HTML propre pour les notations (pas de KaTeX obligatoire ici, mais possible pour logique/expressions).

---

## 1) Périmètre (Première → pré-requis Terminale)

* **Représentation & types** : binaire, complément à 2, flottants et limites, encodage texte (UTF-8).&#x20;
* **Structures & tables** : listes, dicts, p-uplets nommés, import CSV, filtrage, tri, fusion (JOIN conceptuel).&#x20;
* **Algorithmique de base** : recherche séquentielle, tri insertion/sélection, recherche dichotomique, invariant/variant, k-NN (exemple d’apprentissage).&#x20;
* **Programmation** : spécification (pré/post), assertions, tests unitaires (pytest), modularité.&#x20;
* **Web/IHM** : événements, formulaires, GET vs POST, répartition client/serveur.&#x20;
* **Archi/OS/réseaux** : modèle de Von Neumann, processus/ordonnancement, encapsulation/bit alterné (ARQ simple).&#x20;

> **Interdit** : contenu terminale (BD relationnelles SQL détaillées, graphes/arbres, récursivité avancée, programmation dynamique, sécurité chiffrement détaillé…), bien que ces thèmes soient mentionnés comme perspectives du cycle terminal.&#x20;

---

## 2) Fichiers & arborescence

```
/data/
  qcm_premiere_for_terminale_nsi.json      # le QCM 
  pedago_survey_nsi_terminale.json               # déjà existant (pour la première partie du volet 2)
  pedago_survey_commun.json                # déjà existant (pour la deuxième partie du volet 2)

/lib/scoring/
  nsi_qcm_scorer.ts                        # agrégats domaines + niveau global
  pedago_indices.ts                        # réutilisé (volet commun)

/server/graphics/
  radar/buildRadarPng.ts                   # Chart.js -> PNG

/lib/pdf/
  templates/bilan_nsi_terminale.tex        # gabarit XeLaTeX
  BilanPdfEleve.tsx / Parent / Nexus       # variantes (si déjà factorisées)

/app/(bilan)/
  bilan/initier/page.tsx
  bilan/[bilanId]/questionnaire/page.tsx
  bilan/[bilanId]/resultats/page.tsx

/app/api/bilan/
  questionnaire-structure/route.ts         # GET
  [bilanId]/submit-answers/route.ts        # POST
  generate-report-text/route.ts            # POST
  generate-summary-text/route.ts           # POST
  pdf/[bilanId]/route.ts                   # GET?variant=...
  email/[bilanId]/route.ts                 # POST
```

---

## 3) Schéma JSON (items)

Même schéma que vos bilans précédents (cf. QCM fourni).
**Domaines** : `donnees`, `tables`, `algorithmique`, `programmation`, `web_ihm`, `arch_os_reseaux`, `mini_ex`.

---

## 4) Scoring, niveaux & radar

* **Score item** = `weight` si correct, 0 sinon.
* **Scores domaine** = somme/maximum → **%** ; **global** = moyenne pondérée domaines.
* Seuils : **<50%** faible ; **50–74%** moyen ; **≥75%** solide.
* **Radar** : 5 axes (Données/Tables/Algo/Prog/Web-OS-Réseaux).
* **Lacunes critiques** : <50% sur Tables/Algo/Prog prioritaire (passage Terminale).

---

## 5) Rendu HTML & PDF

* **HTML** : rendu simple (expressions logiques, pseudo-code) ; si besoin de formules, **KaTeX** possible (déjà intégré ailleurs).
* **PDF** : **XeLaTeX** via gabarit `bilan_nsi_terminale.tex` ; insertion `radar.png`, sections texte (`reportText`, `summaryText`), tableau des scores.

---

## 6) Endpoints & workflow

1. `GET /api/bilan/questionnaire-structure?matiere=NSI&niveau=Terminale`

   * Retourne le **QCM** (volet 1) + flags pour le **volet 2** (commun) si non rempli.

2. `POST /api/bilan/[id]/submit-answers`

   * Persiste `qcmRawAnswers` (+ `pedagoRawAnswers` si fournis),
   * Calcule `qcmScores` (`nsi_qcm_scorer.ts`) + `pedagoProfile`/`IDX_*` si volet 2,
   * Détermine **offers** (si votre matrice s’applique à NSI),
   * Déclenche `generate-report-text` et `generate-summary-text`.

3. `GET /api/bilan/pdf/[id]?variant=eleve|parent|nexus`

   * Construit `.tex` + **compile** ; **retourne PDF**.

4. `POST /api/bilan/email/[id]`

   * Envoie la variante PDF choisie (SMTP config prod validée).

> **Sécurité & prod** : RBAC NextAuth, rate-limit, validation Zod des env, **aucun secret versionné**, headers sécurisés (Nginx conf d’exemple). (Rappels de vos standards.)

---

## 7) Génération du texte de bilan (IA)

* **Entrées** : `qcmScores` + **lignes forces/faiblesses** + (facultatif) `pedagoProfile`.
* **Rendu ciblé** (pas de jargon IA) :

  * Intro (objectif & périmètre Première),
  * Synthèse globale (%, niveau),
  * Domaines : 2–3 phrases diagnostic + priorités,
  * **Plan de remédiation** (1–2 semaines) ordonné : *Tables → Algo → Prog → Web → OS/Réseaux*.
* Modèles : `gpt-4o` (prod) / `gpt-4o-mini` (dev), prompts stockés en repo privé, sanitisation.

---

## 8) Tests (unitaires / intégration / E2E)

* **Unitaires** : `nsi_qcm_scorer.ts` (agrégats, seuils), sérialisation `.tex`.
* **Intégration** : `questionnaire-structure`, `submit-answers` (avec/ sans volet 2), `pdf`.
* **E2E** : parcours complet élève → résultats → PDF (déterministe).
* **Qualité** : couverture ≥85% back ; CI “0 vulnérabilité” ; gitleaks pré-commit.

---

## 9) Acceptation (check-list)

* [ ] Aucune question de **Terminale**.
* [ ] QCM couvre bien **Première** (données, tables, algo, prog, web/IHM, arch/OS/réseaux).&#x20;
* [ ] Scores domaine + **radar** générés.
* [ ] Bilan texte cohérent + **PDF** produit (XeLaTeX).
* [ ] RBAC/rate-limit/validation Zod actifs ; **secrets non versionnés**.
* [ ] Tests unitaires/intégration/E2E **verts**.

---

### Remarques de conformité programmes

* Le QCM cible strictement **les attendus de Première** pour sécuriser l’entrée en Terminale : types binaires, tables, tris quadratiques, dichotomie, tests/spécification, IHM Web (événements, GET/POST), Von Neumann, processus, encapsulation/bit alterné.&#x20;
* Les thèmes **Terminale** (SQL relationnel, arbres/graphes, récursivité avancée, PD, chiffrement détaillé…) sont **réservés** au cycle en cours d’année et **ne doivent pas** apparaître dans l’évaluation initiale (au plus, la remédiation textuelle peut les mentionner comme perspective).&#x20;

---

## Ce que vous devez faire

1. **Créer** `data/qcm_premiere_for_terminale_nsi.json` avec le contenu ci-dessus.
2. **Brancher** `/api/bilan/questionnaire-structure` pour renvoyer ce QCM si `matiere=NSI` & `niveau=Terminale`.
3. **Implémenter** `nsi_qcm_scorer.ts` (agrégats + niveaux + lacunes) et **radar** (ChartJS NodeCanvas → PNG).
4. **Ajouter** `templates/bilan_nsi_terminale.tex` et le flux PDF (XeLaTeX).
5. **Écrire** les **tests** (unit/int/E2E) et passer CI.


