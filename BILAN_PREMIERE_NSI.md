# 🧭 Bilan d’entrée en Première — Spécialité NSI (volet connaissances de Seconde / SNT & cycle 4)

Ce pack uniformise le pipeline Nexus (même logique que Mathématiques) :

* **JSON (40 questions)** couvrant les **prérequis NSI** issus de Seconde/SNT & du cycle 4.
* **Script Python** de scoring + **radar** (PNG) → export `results.json`.
* **Adaptateur TypeScript** → payload pour PDF (Parent/Élève) & dashboard.
* **Squelette PDF React‑PDF** (branding Nexus, watermark, variantes Parent/Élève).

### Domaines évalués (conformes aux attendus NSI Première)

* `TypesBase` : binaire, bases 2/10/16, booléens, flottants
* `TypesConstruits` : listes/tableaux, tuples, dictionnaires
* `Algo` : variables, conditions, boucles, fonctions, complexité intuitive
* `LangagePython` : syntaxe, erreurs fréquentes, tests (assert), docstring
* `TablesDonnees` : CSV, filtrage, tri, fusion simple
* `IHMWeb` : HTML/CSS/JS basiques, formulaires, GET/POST
* `Reseaux` : IP/DNS/TCP-HTTP, requête/réponse, cookies
* `ArchOS` : Von Neumann, fichiers/droits, CLI de base
* `HistoireEthique` : repères, RGPD, usages responsables

> Les items `"critical": true` sont **indispensables en NSI Première** (pondérés à 3).

---

## 1) JSON des questions (40 items)

**Fichier :** `data/qcm_snt_for_nsi_premiere.json`

```json
{
  "meta": {
    "title": "Bilan d'entrée Première — NSI",
    "niveau": "Première",
    "base": "Prérequis Seconde/SNT & cycle 4",
    "totalQuestions": 40,
    "domainsOrder": [
      "TypesBase","TypesConstruits","Algo","LangagePython","TablesDonnees","IHMWeb","Reseaux","ArchOS","HistoireEthique"
    ]
  },
  "questions": [
    {"id":"Q1","domain":"TypesBase","weight":2,"critical":true,"type":"single","statement":"Combien de valeurs différentes peut représenter un octet ?","options":["128","255","256","512"],"answer":2},
    {"id":"Q2","domain":"TypesBase","weight":2,"critical":false,"type":"single","statement":"Écrire (101101)_2 en base 10.","options":["45","46","53","54"],"answer":0},
    {"id":"Q3","domain":"TypesBase","weight":2,"critical":true,"type":"single","statement":"La valeur booléenne de l’expression Python: (True and not False) or False est :","options":["True","False","Erreur","None"],"answer":0},
    {"id":"Q4","domain":"TypesBase","weight":2,"critical":false,"type":"single","statement":"0.1 + 0.2 == 0.3 en Python vaut généralement False car :","options":["arrondi des entiers","représentation flottante binaire","bug de l’interpréteur","priorité des opérateurs"],"answer":1},

    {"id":"Q5","domain":"TypesConstruits","weight":2,"critical":true,"type":"single","statement":"Quelle structure permet un accès par clé en Python ?","options":["liste","tuple","dictionnaire","ensemble ordonné"],"answer":2},
    {"id":"Q6","domain":"TypesConstruits","weight":2,"critical":false,"type":"single","statement":"Soit t=(3,4). Que fait l’instruction t[0]=5 ?","options":["t devient (5,4)","IndexError","TypeError","Aucun effet"],"answer":2},
    {"id":"Q7","domain":"TypesConstruits","weight":2,"critical":false,"type":"single","statement":"Quelle compréhension de liste produit [0,1,4,9]?","options":["[i*i for i in range(4)]","[i^2 for i in 4]","comprehension(i*i,0..4)","map(square,4)"],"answer":0},
    {"id":"Q8","domain":"TypesConstruits","weight":3,"critical":true,"type":"single","statement":"Que renvoie d.get('cle', 0) si 'cle' n’existe pas ?","options":["None","0","Erreur","'cle'"],"answer":1},

    {"id":"Q9","domain":"Algo","weight":3,"critical":true,"type":"single","statement":"La complexité moyenne de la recherche dichotomique dans un tableau trié est :","options":["O(n)","O(log n)","O(n log n)","O(1)"],"answer":1},
    {"id":"Q10","domain":"Algo","weight":2,"critical":false,"type":"single","statement":"Que fait `return` dans une fonction ?","options":["affiche une valeur","termine la fonction et renvoie une valeur","met en pause la fonction","déclare une variable globale"],"answer":1},
    {"id":"Q11","domain":"Algo","weight":2,"critical":false,"type":"single","statement":"Dans une boucle `for i in range(3):`, les valeurs prises par i sont :","options":["0,1","1,2,3","0,1,2","1,2"],"answer":2},
    {"id":"Q12","domain":"Algo","weight":2,"critical":false,"type":"single","statement":"Quel algorithme trie en O(n^2) dans le pire cas ?","options":["Tri fusion","Tri rapide (pire cas)","Tri par insertion","Tri comptage"],"answer":2},

    {"id":"Q13","domain":"LangagePython","weight":2,"critical":true,"type":"single","statement":"Quelle est la bonne signature ?","options":["def f(x,y):","func f(x,y)","define f(x,y)","def f: (x,y)"],"answer":0},
    {"id":"Q14","domain":"LangagePython","weight":2,"critical":false,"type":"single","statement":"`assert x>0` sert principalement à :","options":["mesurer le temps","documenter le code","vérifier une condition durant l’exécution","formater l’affichage"],"answer":2},
    {"id":"Q15","domain":"LangagePython","weight":2,"critical":false,"type":"single","statement":"`try/except` permet :","options":["d’optimiser le code","de gérer les exceptions","de définir des tests unitaires","de créer un itérateur"],"answer":1},
    {"id":"Q16","domain":"LangagePython","weight":3,"critical":true,"type":"single","statement":"`if a is b` en Python teste :","options":["l’égalité de valeur","l’identité (même objet)","la comparaison lexicale","le type"],"answer":1},

    {"id":"Q17","domain":"TablesDonnees","weight":2,"critical":false,"type":"single","statement":"Quel séparateur est le plus courant dans un CSV européen ?","options":[";",",","\t","|"],"answer":0},
    {"id":"Q18","domain":"TablesDonnees","weight":2,"critical":false,"type":"single","statement":"Filtrer une table en Python se fait typiquement avec :","options":["map","filter","reduce","compile"],"answer":1},
    {"id":"Q19","domain":"TablesDonnees","weight":2,"critical":false,"type":"single","statement":"Trier une liste de p‑uplets par clé 'age' :","options":["sorted(L, key='age')","sorted(L, key=lambda x: x['age'])","L.sortby('age')","tri(L,'age')"],"answer":1},
    {"id":"Q20","domain":"TablesDonnees","weight":3,"critical":true,"type":"single","statement":"Fusionner deux tables sur l’identifiant commun revient à :","options":["concaténer les colonnes sans condition","faire une jointure sur la clé","mélanger aléatoirement","supprimer les doublons"],"answer":1},

    {"id":"Q21","domain":"IHMWeb","weight":2,"critical":false,"type":"single","statement":"Dans une page Web, HTML décrit…","options":["le style","la structure/contenu","la logique serveur","les requêtes SQL"],"answer":1},
    {"id":"Q22","domain":"IHMWeb","weight":2,"critical":false,"type":"single","statement":"Une requête GET est plutôt utilisée pour :","options":["envoyer un mot de passe","récupérer une ressource","uploader un fichier volumineux","ouvrir une connexion TCP"],"answer":1},
    {"id":"Q23","domain":"IHMWeb","weight":3,"critical":true,"type":"single","statement":"Côté client vs serveur :","options":["HTML/CSS/JS côté serveur uniquement","JS s’exécute côté client (navigateur)","Python s’exécute toujours côté client","SQL s’exécute dans le navigateur"],"answer":1},
    {"id":"Q24","domain":"IHMWeb","weight":2,"critical":false,"type":"single","statement":"But principal des cookies :","options":["stocker des mots de passe en clair","persister des informations de session","accélérer le CPU","bloquer le protocole HTTP"],"answer":1},

    {"id":"Q25","domain":"Reseaux","weight":2,"critical":true,"type":"single","statement":"Le protocole qui associe un nom de domaine à une adresse IP est :","options":["HTTP","DNS","TCP","ARP"],"answer":1},
    {"id":"Q26","domain":"Reseaux","weight":2,"critical":false,"type":"single","statement":"Quel couple est juste ?","options":["TCP/fiabilité — IP/chiffrement","TCP/fiabilité — IP/acheminement","HTTP/chiffrement — TCP/routage","DNS/chiffrement — HTTP/acheminement"],"answer":1},
    {"id":"Q27","domain":"Reseaux","weight":2,"critical":false,"type":"single","statement":"Dans une URL, `https://` indique :","options":["protocole HTTP sans chiffrement","protocole HTTP sur TLS (chiffré)","protocole FTP","adresse IP privée"],"answer":1},
    {"id":"Q28","domain":"Reseaux","weight":3,"critical":true,"type":"single","statement":"Une requête HTTP contient typiquement :","options":["uniquement le corps","méthode + chemin + en‑têtes","les tables SQL","du code Python exécutable"],"answer":1},

    {"id":"Q29","domain":"ArchOS","weight":2,"critical":false,"type":"single","statement":"Quel composant stocke les programmes et données de façon persistante ?","options":["RAM","CPU","SSD/HDD","GPU"],"answer":2},
    {"id":"Q30","domain":"ArchOS","weight":2,"critical":false,"type":"single","statement":"Un système d’exploitation gère notamment :","options":["uniquement l’affichage","processeur, mémoire, fichiers, E/S","les pages HTML","les routeurs Internet"],"answer":1},
    {"id":"Q31","domain":"ArchOS","weight":3,"critical":true,"type":"single","statement":"Sous un OS type Unix, la commande pour lister les fichiers est :","options":["cat","ls","ps","top"],"answer":1},
    {"id":"Q32","domain":"ArchOS","weight":2,"critical":false,"type":"single","statement":"Sur Linux, `chmod 640 fichier` signifie :","options":["propriétaire rw-, groupe r--, autres ---","propriétaire r--, groupe rw-, autres ---","propriétaire rwx, groupe r-x, autres ---","propriétaire rw-, groupe --- , autres r--"],"answer":0},

    {"id":"Q33","domain":"HistoireEthique","weight":2,"critical":false,"type":"single","statement":"La ‘machine universelle’ (1936) est due à :","options":["Shannon","Turing","Von Neumann","Hopper"],"answer":1},
    {"id":"Q34","domain":"HistoireEthique","weight":2,"critical":false,"type":"single","statement":"Le RGPD traite principalement :","options":["de la vitesse des réseaux","de la protection des données personnelles","du chiffrement quantique","des licences open‑source"],"answer":1},
    {"id":"Q35","domain":"HistoireEthique","weight":2,"critical":false,"type":"single","statement":"Un exemple d’usage responsable en ligne est :","options":["partager des mdp","respecter le droit d’auteur/licences","installer des malwares pour tester","désactiver les mises à jour"],"answer":1},
    {"id":"Q36","domain":"HistoireEthique","weight":2,"critical":false,"type":"single","statement":"Repère historique : premiers ordinateurs opérationnels ~","options":["1910","1948","1969","1984"],"answer":1},

    {"id":"Q37","domain":"Algo","weight":3,"critical":true,"type":"single","statement":"Quel invariant de boucle est pertinent pour un tri par insertion ?","options":["préfixe gauche toujours trié","suffixe droit trié","liste entière triée à chaque itération","aucun"],"answer":0},
    {"id":"Q38","domain":"LangagePython","weight":3,"critical":true,"type":"single","statement":"Quel test unitaire minimal ?","options":["print(f(2))","assert f(2)==4","timeit(f)","help(f)"],"answer":1},
    {"id":"Q39","domain":"TablesDonnees","weight":2,"critical":false,"type":"single","statement":"Charger un CSV en Python sans bibliothèque externe se fait avec :","options":["os","csv","json","re"],"answer":1},
    {"id":"Q40","domain":"Reseaux","weight":3,"critical":true,"type":"single","statement":"Le modèle client‑serveur sur le Web implique :","options":["le client exécute SQL sur la base distante","le serveur répond à des requêtes HTTP du client","le client envoie du code Python au serveur pour exécution directe","aucune communication établie"],"answer":1}
  ]
}
```

---

## 2) Script Python — Scoring + Radar PNG

**Fichier :** `scripts/score_radar_nsi_premiere.py`

```python
#!/usr/bin/env python3
# -*- coding: utf-8 -*-
"""Usage
python scripts/score_radar_nsi_premiere.py \
  --qcm data/qcm_snt_for_nsi_premiere.json \
  --answers answers.json \
  --out results.json \
  --png radar.png

answers.json : {"Q1":2, "Q2":0, ...}
"""
import json, math, argparse
import matplotlib.pyplot as plt

DOMAINS_ORDER = [
  "TypesBase","TypesConstruits","Algo","LangagePython","TablesDonnees","IHMWeb","Reseaux","ArchOS","HistoireEthique"
]

def load_json(path):
    with open(path, 'r', encoding='utf-8') as f:
        return json.load(f)

def score(qcm, answers):
    by_domain = {}
    total = 0
    total_max = 0
    for q in qcm['questions']:
        d = q['domain']
        by_domain.setdefault(d, {'points':0, 'max':0})
        by_domain[d]['max'] += q['weight']
        total_max += q['weight']
        ans = answers.get(q['id'])
        if isinstance(ans, int) and ans == q['answer']:
            by_domain[d]['points'] += q['weight']
            total += q['weight']
    for d in by_domain:
        P = by_domain[d]['points']
        M = max(1, by_domain[d]['max'])
        by_domain[d]['percent'] = round(100*P/M)
    return {'total': total, 'totalMax': total_max, 'byDomain': by_domain}

def radar_plot(results, png_path):
    labels = DOMAINS_ORDER
    values = [ results['byDomain'].get(d, {}).get('percent', 0) for d in labels ]
    labels = labels + [labels[0]]
    values = values + [values[0]]
    angles = [i/float(len(values)-1)*2*math.pi for i in range(len(values)-1)] + [0]

    fig = plt.figure(figsize=(6,6))
    ax = plt.subplot(111, polar=True)
    ax.set_theta_offset(math.pi/2)
    ax.set_theta_direction(-1)
    ax.plot(angles, values, linewidth=2, color="#0ea5e9")
    ax.fill(angles, values, color="#0ea5e9", alpha=0.25)
    ax.set_thetagrids([a*180/math.pi for a in angles[:-1]], DOMAINS_ORDER)
    ax.set_ylim(0,100)
    plt.title("Bilan NSI Première — Radar des domaines", y=1.08)
    plt.tight_layout()
    plt.savefig(png_path, dpi=160)
    plt.close()

if __name__ == '__main__':
    ap = argparse.ArgumentParser()
    ap.add_argument('--qcm', required=True)
    ap.add_argument('--answers', required=True)
    ap.add_argument('--out', default='results.json')
    ap.add_argument('--png', default='radar.png')
    args = ap.parse_args()

    qcm = load_json(args.qcm)
    answers = load_json(args.answers)
    results = score(qcm, answers)

    with open(args.out, 'w', encoding='utf-8') as f:
        json.dump(results, f, ensure_ascii=False, indent=2)

    radar_plot(results, args.png)
    print(f"OK — total {results['total']}/{results['totalMax']} • {args.png} • {args.out}")
```

---

## 3) Adaptateur TypeScript — Payload PDF & Dashboard

**Fichier :** `lib/scoring/adapter_nsi_premiere.ts`

```ts
export type Results = {
  total: number;
  totalMax: number;
  byDomain: Record<string, { points: number; max: number; percent: number }>;
};

export function toScoresByDomain(results: Results) {
  const order = [
    "TypesBase","TypesConstruits","Algo","LangagePython","TablesDonnees","IHMWeb","Reseaux","ArchOS","HistoireEthique"
  ];
  return order.map((d) => ({ domain: d, percent: results.byDomain?.[d]?.percent ?? 0 }));
}

export function inferStrengthsWeaknesses(results: Results) {
  const forces: string[] = [];
  const faiblesses: string[] = [];
  for (const [k,v] of Object.entries(results.byDomain||{})) {
    const p = v.percent || 0;
    if (p >= 75) forces.push(k);
    else if (p < 50) faiblesses.push(k);
  }
  return { forces, faiblesses };
}

export function suggestPlanNSIPremiere(results: Results) {
  return [
    "S1–S2 : Types & Python — booléens, conditions, boucles, fonctions",
    "S3–S4 : Tables de données — CSV, filtres, tris, jointures simples",
    "S5–S6 : IHM Web & HTTP — formulaires, GET/POST, cookies, sécurité basique",
    "S7–S8 : Réseaux & OS — CLI, droits, modèle client‑serveur, projet d’intégration"
  ];
}

export function chooseOffer(results: Results) {
  const percents = Object.values(results.byDomain||{}).map(v=>v.percent||0);
  const avg = percents.length ? percents.reduce((a,b)=>a+b,0)/percents.length : 0;
  const low = percents.filter(p=>p<50).length;
  if (avg >= 65 && low === 0) return { primary: "Cortex", alternatives: ["Studio Flex"], reasoning: "Radar homogène et autonomie présumée." };
  if (low <= 2) return { primary: "Studio Flex", alternatives: ["Académies"], reasoning: "1–2 lacunes ciblées à combler rapidement." };
  if (low >= 3) return { primary: "Académies", alternatives: ["Odyssée"], reasoning: "Plusieurs domaines <50% : besoin d’un boost intensif." };
  return { primary: "Odyssée", alternatives: ["Studio Flex"], reasoning: "Objectif mention / besoin de structuration annuelle." };
}

export function buildPdfPayloadNSIPremiere(results: Results) {
  const scoresByDomain = toScoresByDomain(results);
  const { forces, faiblesses } = inferStrengthsWeaknesses(results);
  const feuilleDeRoute = suggestPlanNSIPremiere(results);
  const offers = chooseOffer(results);
  const scoreGlobal = Math.round((results.total/Math.max(1,results.totalMax))*100);
  return { scoresByDomain, forces, faiblesses, feuilleDeRoute, offers, scoreGlobal };
}
```

---

## 4) Squelette PDF (React‑PDF) — Variantes Parent / Élève

**Fichier :** `lib/pdf/BilanPdfNsiPremiere.tsx`

```tsx
import { Page, Text, View, Document, StyleSheet, Image } from '@react-pdf/renderer';

const styles = StyleSheet.create({
  page: { padding: 30, fontFamily: 'Helvetica' },
  h1: { fontSize: 18, color: '#0f172a', marginBottom: 8 },
  section: { marginBottom: 10 },
  wm: { position: 'absolute', top: '38%', left: '20%', opacity: 0.08 },
});

export function BilanPdfNsiPremiere({ bilan, variant }: any) {
  const S = bilan.synthesis || {};
  const D = bilan.qcmScores?.byDomain || {};
  return (
    <Document>
      <Page size="A4" style={styles.page}>
        <Image style={styles.wm} src="/branding/nexus-watermark.png"/>
        <Text style={styles.h1}>Bilan NSI — Entrée en Première</Text>
        <View style={styles.section}>
          <Text>Élève : {bilan.user?.firstName} {bilan.user?.lastName}</Text>
          <Text>Date : {new Date(bilan.createdAt).toLocaleDateString('fr-FR')}</Text>
        </View>
        <View style={styles.section}>
          <Text>Scores par domaines :</Text>
          {Object.entries(D).map(([dom, s]: any) => (
            <Text key={dom}>{dom}: {s.percent}%</Text>
          ))}
        </View>
        {variant === 'parent' && (
          <View style={styles.section}>
            <Text>Analyse pédagogique & ROI :</Text>
            <Text>- Estimation d’effort vs gains attendus (Bac/Parcoursup).</Text>
            <Text>- Recommandations d’offres : {bilan.offers?.primary}</Text>
          </View>
        )}
        {variant === 'eleve' && (
          <View style={styles.section}>
            <Text>🎖 Badges :</Text>
            <Text>- Solide en { (S.forces||[]).join(', ') || '—' }</Text>
            <Text>- À renforcer : { (S.faiblesses||[]).join(', ') || '—' }</Text>
          </View>
        )}
      </Page>
    </Document>
  );
}
```

---

## 5) Checklist d’intégration

1. Déposer `data/qcm_snt_for_nsi_premiere.json` (40q) dans le repo/DB.
2. Collecter `answers.json` côté front (wizard) → POST API.
3. Lancer `score_radar_nsi_premiere.py` en batch (ou porter le scoring en TS côté serveur) → `results.json` + `radar.png`.
4. Générer le PDF **Parent/Élève** avec `buildPdfPayloadNSIPremiere` et stocker URL/BLOB.
5. Envoyer emails avec PJ PDF aux adresses élève + parent.
6. Afficher sur dashboards (mini‑radar, forces/faiblesses, feuille de route, offres).

**Livré :** JSON (40q) ✅ · Python scoring+radar ✅ · Adapter TS ✅ · Squelette PDF ✅


L’idée est d’évaluer **non seulement les acquis techniques (QCM)** mais aussi le **profil d’apprentissage en informatique**, afin de dresser un **bilan complet** et de proposer une **feuille de route personnalisée**.

---

## 🧩 Deuxième Volet — Profil Pédagogique NSI

### 1. Axes évalués

* **Rapport à l’erreur** : confiance face aux bugs, persévérance.
* **Stratégies d’apprentissage** : lecture de doc, tutoriels vidéo, pratique par projet, pair programming.
* **Organisation & méthodologie** : planification, gestion du temps, usage de Git/notes.
* **Autonomie vs besoin d’accompagnement** : capacité à chercher seul, besoin d’explications guidées.
* **Motivation & projets** : intérêt pour la programmation, appétence pour l’algorithmique vs systèmes, ambition (bac avec mention, orientation supérieure).
* **Difficultés éventuelles** : TDAH, DYS, anxiété numérique, gestion de l’abstraction.
* **Style cognitif (VAK adapté NSI)** : visuel (schémas, diagrammes UML), auditif (explications orales), kinesthésique (code par la pratique).
* **Ambition Parcoursup** : écoles d’ingénieur, informatique, ou simple validation Bac.

---

### 2. Exemple de Questionnaire (JSON)

**Fichier :** `data/pedago_survey_nsi_premiere.json`

```json
{
  "meta": {
    "title": "Volet pédagogique NSI — Première",
    "domains": ["Motivation","Méthodes","Organisation","ProfilCognitif","Difficultés","Orientation"]
  },
  "questions": [
    {
      "id": "P1",
      "domain": "Motivation",
      "type": "single",
      "statement": "J'apprends l'informatique principalement par :",
      "options": ["Curiosité personnelle", "Pour réussir le Bac", "Pour un projet supérieur (ingénieur, dev)", "Parce que c'est obligatoire"]
    },
    {
      "id": "P2",
      "domain": "Méthodes",
      "type": "multi",
      "statement": "Quand je ne comprends pas un code :",
      "options": ["Je cherche dans la documentation", "Je regarde des tutos vidéo", "Je demande à un camarade", "J'abandonne rapidement"]
    },
    {
      "id": "P3",
      "domain": "Organisation",
      "type": "single",
      "statement": "Je rends mes devoirs/exercices de NSI :",
      "options": ["Toujours à temps", "Souvent à temps", "En retard", "Rarement complets"]
    },
    {
      "id": "P4",
      "domain": "ProfilCognitif",
      "type": "single",
      "statement": "Je retiens mieux :",
      "options": ["Avec des schémas/diagrammes", "Quand on m'explique oralement", "Quand j'expérimente en codant"]
    },
    {
      "id": "P5",
      "domain": "Difficultés",
      "type": "multi",
      "statement": "J'éprouve des difficultés particulières en :",
      "options": ["Me concentrer longtemps", "Mémoriser la syntaxe", "Résoudre des problèmes abstraits", "Travailler en groupe"]
    },
    {
      "id": "P6",
      "domain": "Orientation",
      "type": "single",
      "statement": "Après la Terminale, j'aimerais :",
      "options": ["Étudier l'informatique/ingénierie", "Une autre voie scientifique", "Une filière non scientifique", "Je ne sais pas encore"]
    }
  ]
}
```

---

### 3. Traitement & Profilage

* **Motivation** : `curiosité/projet sup` → orientation Cortex/Odyssée ; `obligatoire` → risque de démotivation.
* **Méthodes** : doc/tutos → autonomie ; abandon → besoin d’accompagnement.
* **Organisation** : retards fréquents → risque Terminale → stage intensif recommandé.
* **Profil Cognitif** : VAK adapté aux ressources (schémas UML, vidéos, TP codés).
* **Difficultés** : détection dys/TDAH → mention spéciale → aménagements pédagogiques.
* **Orientation** : ambition supérieure → accent sur académie ou Odyssée.

---

### 4. Intégration

* Fusionné avec le **QCM (volet 1)** pour produire :

  * Forces/faiblesses techniques (radar QCM).
  * Profil pédagogique (cartes synthèse).
  * **Feuille de route personnalisée 8 semaines** (avec méthodo & temps estimé).
  * **Offres Nexus adaptées** (Cortex, Studio Flex, Académies, Odyssée).

# 📊 Bilan Première — QCM + Volet Pédagogique NSI

Ce document fournit :

* Le **JSON structuré** des 40 questions (volet connaissances de Seconde utiles pour la Première en NSI).
* Le **JSON du Volet Pédagogique** (profil, organisation, motivation, difficultés).
* Un **script Python** de scoring + radar (matplotlib).
* Un **adaptateur TypeScript** pour fusionner QCM & Pédago et produire le payload.
* Un **template PDF React-PDF** avec deux variantes (Parent & Élève).

---

## 1) JSON des questions QCM (40 items)

**Fichier :** `data/qcm_seconde_for_premiere_nsi.json`

*(Structure identique à la version Maths, adaptée au programme NSI, 40 questions réparties par domaines : types de base, algorithmes, Python, données, IHM Web, réseaux, systèmes, etc.)*

```json
[
  {
    "id": "Q1",
    "domain": "Types & Variables",
    "weight": 2,
    "statement": "Quel est le type de la valeur renvoyée par 3 // 2 en Python ?",
    "options": ["int","float","bool","str"],
    "answer": 0,
    "critical": true
  },
  {
    "id": "Q2",
    "domain": "Algorithmes",
    "weight": 3,
    "statement": "Quelle est la complexité temporelle de la recherche dichotomique dans une liste triée de n éléments ?",
    "options": ["O(1)","O(log n)","O(n)","O(n log n)"],
    "answer": 1,
    "critical": true
  }
  // ... 38 autres questions
]
```

---

## 2) JSON Volet Pédagogique NSI

**Fichier :** `data/pedago_survey_nsi_premiere.json`

```json
{
  "meta": {
    "title": "Volet pédagogique NSI — Première",
    "domains": ["Motivation","Methodes","Organisation","ProfilCognitif","Collaboration","StressExam","Outils","Difficultes","Orientation"]
  },
  "questions": [
    {
      "id": "P1",
      "domain": "Motivation",
      "type": "single",
      "statement": "Pourquoi avez-vous choisi la spécialité NSI ?",
      "options": ["Curiosité personnelle","Projet supérieur","Pour le Bac","Obligatoire"]
    },
    {
      "id": "P2",
      "domain": "Méthodes",
      "type": "multi",
      "statement": "Que faites-vous quand votre code plante ?",
      "options": ["Lire la doc","Chercher sur Internet","Demander de l’aide","Abandonner"]
    },
    {
      "id": "P3",
      "domain": "Organisation",
      "type": "single",
      "statement": "Vous rendez vos exercices :",
      "options": ["Toujours à temps","Souvent","Parfois en retard","Souvent en retard"]
    }
    // ... 27 autres questions
  ]
}
```

---

## 3) Script Python — Scoring & Radar

**Fichier :** `scripts/scoring_radar_nsi_premiere.py`

```python
import json, numpy as np
import matplotlib.pyplot as plt

with open("data/qcm_seconde_for_premiere_nsi.json") as f:
    QUESTIONS = json.load(f)

student_answers = {"Q1":0, "Q2":1}  # exemple

def score_qcm(answers):
    scores = {}
    total, total_max = 0, 0
    for q in QUESTIONS:
        domain = q["domain"]
        scores.setdefault(domain,{"points":0,"max":0})
        if answers.get(q["id"]) == q["answer"]:
            scores[domain]["points"] += q["weight"]
            total += q["weight"]
        scores[domain]["max"] += q["weight"]
        total_max += q["weight"]
    for d in scores:
        scores[d]["percent"] = round(100*scores[d]["points"]/scores[d]["max"])
    return total, total_max, scores

def plot_radar(scores):
    labels = list(scores.keys())
    values = [scores[d]["percent"] for d in labels]
    angles = np.linspace(0, 2*np.pi, len(labels), endpoint=False).tolist()
    values += values[:1]
    angles += angles[:1]
    fig, ax = plt.subplots(figsize=(6,6), subplot_kw=dict(polar=True))
    ax.plot(angles, values, 'o-', linewidth=2)
    ax.fill(angles, values, alpha=0.25)
    ax.set_thetagrids(np.degrees(angles[:-1]), labels)
    ax.set_ylim(0,100)
    plt.title("Radar Bilan NSI Première")
    plt.show()
```

---

## 4) Adapter TypeScript

**Fichier :** `lib/scoring/adapter_nsi_premiere.ts`

```ts
import { scoreQCM } from './qcm';
import { scorePedago, deriveProfile } from './adapter_nsi_pedago';

export function buildNsiPremierePayload(qcmAnswers:any, pedagoAnswers:any, qcmQuestions:any, pedagoSurvey:any) {
  const qcmScores = scoreQCM(qcmAnswers, qcmQuestions);
  const pedagoScores = scorePedago(pedagoSurvey, pedagoAnswers);
  const pedagoProfile = deriveProfile(pedagoScores);
  const synthesis = {
    forces: Object.entries(qcmScores.byDomain).filter(([d,s]:any)=>s.percent>=75).map(([d])=>d),
    faiblesses: Object.entries(qcmScores.byDomain).filter(([d,s]:any)=>s.percent<50).map(([d])=>d),
    profile: pedagoProfile
  };
  const offers = chooseOffer(qcmScores, pedagoProfile);
  return { qcmScores, pedagoScores, pedagoProfile, synthesis, offers };
}

function chooseOffer(qcmScores:any, profile:any) {
  if (profile.autonomie==='bonne' && Object.values(qcmScores.byDomain).every((s:any)=>s.percent>=65)) return { primary: 'Cortex', alternatives:['Odyssée'] };
  if (profile.autonomie==='faible' || Object.values(qcmScores.byDomain).some((s:any)=>s.percent<50)) return { primary: 'Studio Flex', alternatives:['Académies'] };
  return { primary: 'Odyssée', alternatives:['Cortex'] };
}
```

---

## 5) Template PDF (React-PDF)

**Fichier :** `lib/pdf/BilanPdfNsiPremiere.tsx`

```tsx
import { Page, Text, View, Document, StyleSheet, Image } from '@react-pdf/renderer';

const styles = StyleSheet.create({
  page: { padding: 30, fontFamily: 'Helvetica' },
  header: { fontSize: 20, marginBottom: 10, color: '#1a237e' },
  section: { marginBottom: 12 },
  watermark: { position: 'absolute', top: '40%', left: '25%', opacity: 0.1 }
});

export const BilanPdfNsiPremiere = ({ bilan, variant }: any) => (
  <Document>
    <Page size="A4" style={styles.page}>
      <Image style={styles.watermark} src="/logo-nexus.png" />
      <Text style={styles.header}>Bilan NSI Première — Nexus Réussite</Text>
      <View style={styles.section}>
        <Text>Élève : {bilan.user?.firstName} {bilan.user?.lastName}</Text>
        <Text>Date : {new Date(bilan.createdAt).toLocaleDateString('fr-FR')}</Text>
      </View>
      <View style={styles.section}>
        <Text>Résultats QCM :</Text>
        {Object.entries(bilan.qcmScores.byDomain).map(([dom, s]: any) => (
          <Text key={dom}>{dom}: {s.percent}%</Text>
        ))}
      </View>
      <View style={styles.section}>
        <Text>Profil pédagogique :</Text>
        <Text>- Style cognitif : {bilan.pedagoProfile.vak}</Text>
        <Text>- Autonomie : {bilan.pedagoProfile.autonomie}</Text>
        <Text>- Organisation : {bilan.pedagoProfile.organisation}</Text>
        <Text>- Stress : {bilan.pedagoProfile.stress}</Text>
      </View>
      {variant === 'parent' && (
        <View style={styles.section}>
          <Text>Analyse pédagogique & ROI :</Text>
          <Text>- Estimation heures de coaching vs bénéfices Bac/Parcoursup.</Text>
        </View>
      )}
      {variant === 'eleve' && (
        <View style={styles.section}>
          <Text>🎖 Badges : </Text>
          <Text>- Algorithmes ✅</Text>
          <Text>- Réseaux ⚠️ à renforcer</Text>
        </View>
      )}
    </Page>
  </Document>
);
```

---

## 6) Intégration

* Importer JSON QCM + Pédago.
* Wizard en 2 volets.
* Scoring TS → Radar + Synthèse.
* PDF multivariant (Parent/Élève).
* Sauvegarde DB & envoi email.

✅ Élève : version motivante (badges, encouragements).
✅ Parent : version pédagogique avec ROI et feuille de route.

---

---

## 6) Volet pédagogique — JSON de l’enquête (NSI Première)

**Fichier :** `data/pedago_survey_nsi_premiere.json`

```json
{
  "meta": {
    "title": "Volet pédagogique NSI — Première",
    "niveau": "Première",
    "scale": { "type": "likert", "min": 1, "max": 5, "labels": ["Pas du tout", "Plutôt pas", "Mitigé", "Plutôt oui", "Tout à fait"] },
    "domainsOrder": [
      "Motivation", "Methodes", "Organisation", "ProfilCognitif", "Collaboration", "StressExam", "Outils", "Difficultes", "Orientation"
    ]
  },
  "questions": [
    {"id":"P1","domain":"Motivation","type":"likert","weight":2,"reverse":false,"statement":"J’aime programmer et résoudre des problèmes par le code."},
    {"id":"P2","domain":"Motivation","type":"likert","weight":2,"reverse":false,"statement":"Je souhaite utiliser la NSI pour viser une mention au Bac."},
    {"id":"P3","domain":"Motivation","type":"likert","weight":2,"reverse":false,"statement":"Je me projette vers des études supérieures liées à l’informatique."},

    {"id":"P4","domain":"Methodes","type":"likert","weight":2,"reverse":false,"statement":"Quand je bloque, je consulte la documentation officielle (ex. docs.python.org)."},
    {"id":"P5","domain":"Methodes","type":"likert","weight":2,"reverse":false,"statement":"Je décompose les problèmes en sous‑problèmes testables."},
    {"id":"P6","domain":"Methodes","type":"likert","weight":2,"reverse":false,"statement":"Je crée de petits tests (assert) pour vérifier mes fonctions."},
    {"id":"P7","domain":"Methodes","type":"likert","weight":2,"reverse":true,"statement":"Je préfère recopier un code sans comprendre plutôt que de l’expliquer."},

    {"id":"P8","domain":"Organisation","type":"likert","weight":2,"reverse":false,"statement":"Je planifie chaque semaine un créneau dédié à la NSI."},
    {"id":"P9","domain":"Organisation","type":"likert","weight":2,"reverse":false,"statement":"Je rends mes exercices de NSI à l’heure."},
    {"id":"P10","domain":"Organisation","type":"likert","weight":2,"reverse":false,"statement":"J’utilise un gestionnaire de versions (ex. Git) pour mes projets."},

    {"id":"P11","domain":"ProfilCognitif","type":"likert","weight":2,"reverse":false,"statement":"Je comprends mieux avec des schémas/diagrammes (visuel)."},
    {"id":"P12","domain":"ProfilCognitif","type":"likert","weight":2,"reverse":false,"statement":"Je comprends mieux avec des explications orales (auditif)."},
    {"id":"P13","domain":"ProfilCognitif","type":"likert","weight":2,"reverse":false,"statement":"J’apprends surtout en expérimentant par la pratique (kinesthésique)."},

    {"id":"P14","domain":"Collaboration","type":"likert","weight":2,"reverse":false,"statement":"J’aime travailler en binôme (pair programming)."},
    {"id":"P15","domain":"Collaboration","type":"likert","weight":2,"reverse":false,"statement":"Je sais expliquer mon code à quelqu’un d’autre."},

    {"id":"P16","domain":"StressExam","type":"likert","weight":2,"reverse":true,"statement":"En contrôle, le stress me fait perdre mes moyens."},
    {"id":"P17","domain":"StressExam","type":"likert","weight":2,"reverse":false,"statement":"Je gère correctement mon temps pendant une évaluation."},

    {"id":"P18","domain":"Outils","type":"likert","weight":2,"reverse":false,"statement":"Je suis à l’aise avec l’éditeur/IDE, l’exécution et la lecture des messages d’erreur."},
    {"id":"P19","domain":"Outils","type":"likert","weight":2,"reverse":false,"statement":"Je peux installer/configurer Python et des modules si nécessaire."},

    {"id":"P20","domain":"Difficultes","type":"likert","weight":2,"reverse":true,"statement":"J’ai du mal à rester concentré longtemps sur un problème."},
    {"id":"P21","domain":"Difficultes","type":"likert","weight":2,"reverse":true,"statement":"L’abstraction (algorithmes, structures) me pose souvent problème."},
    {"id":"P22","domain":"Difficultes","type":"likert","weight":2,"reverse":true,"statement":"J’éprouve de l’anxiété ou un blocage face aux consignes techniques."},

    {"id":"P23","domain":"Orientation","type":"single","weight":2,"statement":"Après la Terminale, j’aimerais :","options":["Études d’informatique/ingénierie","Autre filière scientifique","Filière non scientifique","Indécis"]},
    {"id":"P24","domain":"Orientation","type":"single","weight":2,"statement":"Mon objectif principal cette année :","options":["Maîtriser la programmation","Valider la spécialité","Optimiser le contrôle continu","Préparer Parcoursup"]},

    {"id":"P25","domain":"Methodes","type":"likert","weight":2,"reverse":false,"statement":"Je commente/documente mes fonctions et modules (docstrings)."},
    {"id":"P26","domain":"Organisation","type":"likert","weight":2,"reverse":false,"statement":"Je garde des notes structurées (ex. Markdown/Notion) sur ce que j’apprends."},
    {"id":"P27","domain":"Collaboration","type":"likert","weight":2,"reverse":false,"statement":"Je demande de l’aide efficacement (ex. message clair, code minimal reproductible)."},
    {"id":"P28","domain":"Outils","type":"likert","weight":2,"reverse":false,"statement":"Je sais utiliser un dépôt Git distant (push/pull)."},
    {"id":"P29","domain":"Motivation","type":"likert","weight":2,"reverse":false,"statement":"Je suis prêt(e) à travailler régulièrement (2–3 h/semaine) en dehors de la classe."},
    {"id":"P30","domain":"Difficultes","type":"multi","weight":2,"statement":"Je signale des besoins spécifiques afin d’adapter l’accompagnement :","options":["Dyslexie/Dysorthographie","TDAH ou concentration","Anxiété importante","Autre (à préciser)"]}
  ]
}
```

> Types : `likert` (1→5), `single` (index d’option), `multi` (liste d’index). Les items `reverse:true` sont inversés lors du scoring.

---

## 7) Adapter TypeScript — Scoring & Profilage du Volet Pédagogique

**Fichier :** `lib/scoring/adapter_nsi_pedago.ts`

```ts
export type PedagoAnswer = number | number[]; // likert -> number (1..5), single -> index number, multi -> indices[]
export type PedagoQuestion = {
  id: string;
  domain: string;
  type: 'likert'|'single'|'multi';
  weight: number;
  reverse?: boolean;
  options?: string[];
};
export type PedagoSurvey = { meta: any; questions: PedagoQuestion[] };

export type PedagoScores = {
  byDomain: Record<string, { points: number; max: number; percent: number }>;
  raw: Record<string, PedagoAnswer>;
};

function normalizeLikert(v: number, reverse = false) {
  const clamped = Math.max(1, Math.min(5, Number(v||1)));
  const val = reverse ? 6 - clamped : clamped; // 1..5
  return (val - 1) / 4; // 0..1
}

export function scorePedago(survey: PedagoSurvey, answers: Record<string, PedagoAnswer>): PedagoScores {
  const byDomain: PedagoScores['byDomain'] = {};
  for (const q of survey.questions) {
    const d = q.domain;
    byDomain[d] ||= { points: 0, max: 0, percent: 0 };
    byDomain[d].max += q.weight; // max en points (pondéré)
    const a = answers[q.id];
    if (q.type === 'likert' && typeof a === 'number') {
      byDomain[d].points += q.weight * normalizeLikert(a, !!q.reverse);
    }
    // single/multi : non notés en absolu ici (profil), on ajoute un bonus léger de complétion
    if (q.type === 'single' && typeof a === 'number') {
      byDomain[d].points += 0.5 * q.weight; // présence d’un choix déclaré
    }
    if (q.type === 'multi' && Array.isArray(a)) {
      byDomain[d].points += 0.5 * q.weight * Math.min(1, a.length/2);
    }
  }
  // pourcentage
  for (const d in byDomain) {
    const { points, max } = byDomain[d];
    byDomain[d].percent = Math.round(100 * (points / Math.max(1, max)));
  }
  return { byDomain, raw: answers };
}

export type PedagoProfile = {
  vak: 'Visuel'|'Auditif'|'Kinesthesique';
  autonomie: 'faible'|'moyenne'|'bonne';
  organisation: 'faible'|'moyenne'|'bonne';
  stress: 'faible'|'moyen'|'élevé';
  flags: string[]; // ex: ['TDAH_suspect','Anxiete','Besoins_specifiques']
  preferences: {
    pairProgramming: boolean;
    git: boolean;
    tests: boolean;
  };
};

export function deriveProfile(scores: PedagoScores): PedagoProfile {
  // Heuristiques VAK à partir des questions P11 (visuel), P12 (auditif), P13 (kinesth.)
  const raw = scores.raw as Record<string, number|number[]>;
  const v = Number(raw['P11']||3);
  const a = Number(raw['P12']||3);
  const k = Number(raw['P13']||3);
  const top = Math.max(v,a,k);
  const vak: PedagoProfile['vak'] = top === v ? 'Visuel' : top === a ? 'Auditif' : 'Kinesthesique';

  // Autonomie (Methodes P4,P5,P6 vs P7 reverse)
  const meth = avgLikert([['P4',false],['P5',false],['P6',false],['P7',true]], raw);
  const autonomie = meth >= 0.66 ? 'bonne' : meth >= 0.4 ? 'moyenne' : 'faible';

  // Organisation (P8,P9,P10,P26)
  const org = avgLikert([['P8',false],['P9',false],['P10',false],['P26',false]], raw);
  const organisation = org >= 0.66 ? 'bonne' : org >= 0.4 ? 'moyenne' : 'faible';

  // Stress (P16 reverse, P17 direct)
  const stressVal = avgLikert([['P16',true],['P17',false]], raw);
  const stress: PedagoProfile['stress'] = stressVal >= 0.66 ? 'faible' : stressVal >= 0.4 ? 'moyen' : 'élevé';

  // Flags difficultés (P20,P21,P22 élevés) + P30 multi
  const flags: string[] = [];
  if ((Number(raw['P20'])||1) >= 4) flags.push('Concentration');
  if ((Number(raw['P21'])||1) >= 4) flags.push('Abstraction');
  if ((Number(raw['P22'])||1) >= 4) flags.push('Anxiete');
  const p30 = raw['P30'];
  if (Array.isArray(p30)) {
    if (p30.includes(0)) flags.push('Dys');
    if (p30.includes(1)) flags.push('TDAH_suspect');
    if (p30.includes(2)) flags.push('Anxiete');
    if (p30.includes(3)) flags.push('Besoins_specifiques');
  }

  const preferences = {
    pairProgramming: (Number(raw['P14'])||1) >= 4,
    git: (Number(raw['P10'])||1) >= 4 || (Number(raw['P28'])||1) >= 4,
    tests: (Number(raw['P6'])||1) >= 4,
  };

  return { vak, autonomie, organisation, stress, flags, preferences };
}

function avgLikert(items: [string, boolean][], raw: Record<string, any>) {
  const vals = items.map(([id, rev]) => normalizeLikert(Number(raw[id]||3), rev));
  return vals.reduce((a,b)=>a+b,0)/Math.max(1, vals.length);
}

export function recommendModality(profile: PedagoProfile) {
  // Format de séances & hebdomadaire proposé
  let format = 'groupe homogène (4 élèves)';
  if (profile.autonomie === 'faible' || profile.stress === 'élevé' || profile.flags.length>0) format = 'individuel';
  const duree = profile.stress === 'élevé' ? 60 : 90; // minutes
  const hebdo = profile.autonomie === 'bonne' ? 1.5 : profile.autonomie === 'moyenne' ? 2 : 3; // heures/semaine
  return { format, duree, hebdo };
}

export function buildPedagoPayloadNSIPremiere(survey: PedagoSurvey, answers: Record<string, PedagoAnswer>) {
  const pedagoScores = scorePedago(survey, answers);
  const pedagoProfile = deriveProfile(pedagoScores);
  const pedagoModality = recommendModality(pedagoProfile);
  return { pedagoScores, pedagoProfile, pedagoModality };
}

// Optionnel : fusionner avec le payload QCM
export function mergeQcmAndPedago(qcmPayload: any, pedagoPayload: any) {
  return { ...qcmPayload, ...pedagoPayload };
}
```

---

## 8) PDF (React‑PDF) — Variantes Parent / Élève incluant le Volet Pédago

**Fichier :** `lib/pdf/BilanPdfNsiPremiereFull.tsx`

```tsx
import { Page, Text, View, Document, StyleSheet, Image } from '@react-pdf/renderer';

type DomainScore = { percent: number };
type BilanData = {
  user?: { firstName?: string; lastName?: string };
  createdAt: string | Date;
  qcmScores: { byDomain: Record<string, DomainScore> };
  pedagoProfile: {
    vak: 'Visuel'|'Auditif'|'Kinesthesique';
    autonomie: 'faible'|'moyenne'|'bonne';
    organisation: 'faible'|'moyenne'|'bonne';
    stress: 'faible'|'moyen'|'élevé';
    flags: string[];
    preferences: { pairProgramming: boolean; git: boolean; tests: boolean };
  };
  pedagoModality: { format: string; duree: number; hebdo: number };
  offers?: { primary: string; alternatives: string[]; reasoning: string };
  feuilleDeRoute?: string[];
  radarPngUrl?: string; // optionnel : image du radar QCM
};

const styles = StyleSheet.create({
  page: { padding: 32, fontFamily: 'Helvetica' },
  header: { fontSize: 18, color: '#0f172a', marginBottom: 8, fontWeight: 700 },
  sub: { fontSize: 11, color: '#334155', marginBottom: 10 },
  h2: { fontSize: 13, marginTop: 8, marginBottom: 4, color: '#0f172a' },
  li: { fontSize: 11, marginBottom: 2 },
  chip: { fontSize: 10, marginRight: 6, color: '#0f172a' },
  wm: { position: 'absolute', top: '35%', left: '20%', opacity: 0.06 },
  row: { flexDirection: 'row', gap: 14 },
  col: { flex: 1 },
});

function List({ items }: { items?: string[] }) {
  if (!items || !items.length) return null as any;
  return (
    <View>
      {items.map((t, i) => (
        <Text style={styles.li} key={i}>• {t}</Text>
      ))}
    </View>
  );
}

export function BilanPdfNsiPremiereFull({ data, variant }: { data: BilanData; variant: 'standard'|'parent'|'eleve' }) {
  const D = data.qcmScores?.byDomain || {};
  const P = data.pedagoProfile;
  const M = data.pedagoModality;
  return (
    <Document>
      <Page size="A4" style={styles.page}>
        <Image style={styles.wm} src="/branding/nexus-watermark.png" />
        <Text style={styles.header}>Bilan NSI — Entrée en Première (Nexus Réussite)</Text>
        <Text style={styles.sub}>Élève : {data.user?.firstName} {data.user?.lastName}  •  Date : {new Date(data.createdAt).toLocaleDateString('fr-FR')}</Text>

        <View style={styles.row}>
          <View style={styles.col}>
            <Text style={styles.h2}>Scores QCM par domaines</Text>
            {Object.entries(D).map(([dom, s]) => (
              <Text key={dom} style={styles.li}>{dom}: {(s as DomainScore).percent}%</Text>
            ))}
          </View>
          <View style={styles.col}>
            <Text style={styles.h2}>Profil pédagogique</Text>
            <Text style={styles.li}>Style : {P.vak}</Text>
            <Text style={styles.li}>Autonomie : {P.autonomie}</Text>
            <Text style={styles.li}>Organisation : {P.organisation}</Text>
            <Text style={styles.li}>Gestion du stress : {P.stress}</Text>
            {!!P.flags?.length && <Text style={styles.li}>Points de vigilance : {P.flags.join(', ')}</Text>}
          </View>
        </View>

        {data.radarPngUrl && (
          <View>
            <Text style={styles.h2}>Radar des domaines (QCM)</Text>
            <Image src={data.radarPngUrl} />
          </View>
        )}

        <Text style={styles.h2}>Feuille de route (proposition 8 semaines)</Text>
        <List items={data.feuilleDeRoute} />

        <Text style={styles.h2}>Modalités recommandées</Text>
        <List items={[`Format : ${M.format}`, `Séance type : ${M.duree} min`, `Charge hebdo : ${M.hebdo} h/semaine`]} />

        {data.offers && (
          <View>
            <Text style={styles.h2}>Offre Nexus recommandée</Text>
            <Text style={styles.li}>Solution : {data.offers.primary}</Text>
            {!!data.offers.alternatives?.length && <Text style={styles.li}>Alternatives : {data.offers.alternatives.join(', ')}</Text>}
            <Text style={styles.li}>Justification : {data.offers.reasoning}</Text>
          </View>
        )}

        {variant === 'parent' && (
          <View>
            <Text style={styles.h2}>Lecture Parent — Impact & ROI</Text>
            <List items={[
              "Objectif : sécuriser l’année de Première NSI, préparer la Terminale et Parcoursup",
              "Indicateurs : progression des pourcentages par domaines, assiduité, livrables de projets",
              "Estimation d’effort : 1,5–3 h/semaine selon autonomie ; accompagnement ciblé sur les points faibles",
            ]} />
          </View>
        )}

        {variant === 'eleve' && (
          <View>
            <Text style={styles.h2}>Version Élève — Motivation</Text>
            <List items={[
              "🎯 Objectifs clairs chaque semaine",
              "🏅 Badges : Tests unitaires, Git prêt, Web basique, Projet intégrateur",
              "📈 Suivi de progression avec le radar et les réussites",
            ]} />
          </View>
        )}
      </Page>
    </Document>
  );
}
```

---

### ✅ À faire côté intégration

1. Charger `data/pedago_survey_nsi_premiere.json` dans le wizard (Volet 2).
2. À la validation :

   * Construire `answersPedago` (objet `{ [id]: value }`).
   * Appeler `buildPedagoPayloadNSIPremiere`.
   * Fusionner avec le payload QCM (`mergeQcmAndPedago`).
3. Sauvegarder dans Prisma (`pedagoRaw`, `pedagoProfile`, etc.).
4. Générer les PDF **Parent/Élève** avec `BilanPdfNsiPremiereFull`.
5. Envoyer par e‑mail (élève + parent).



