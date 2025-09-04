# 🎯 Bilan d’entrée en Première — Mathématiques (volet connaissances de Seconde)

Ce pack uniformise le pipeline avec la version Terminale :

* **JSON (40 questions)** ciblant les notions de **Seconde indispensables** pour réussir la **Première**.
* **Script Python** de scoring + **radar** (PNG) → export `results.json`.
* **Adaptateur TypeScript** pour alimenter les PDF (Parent / Élève) et le dashboard.

**Domaines** :

* `NombresCalculs` (fractions, puissances, racines, notation scientifique)
* `EquationsInequations` (1er degré, système 2×2, inéquations, valeur absolue basique)
* `Fonctions` (affine, carré, parabole, lecture graphique, variations simples)
* `GeometrieTrig` (Pythagore, Thalès, trigonométrie triangle rectangle, aires/périmètres)
* `ProbaStats` (fréquences, moyenne/écart‑type simple, probas élémentaires)
* `AlgoLogique` (algorithmes très simples / tableur, logique de base)

Les items marqués `"critical": true` sont **prérequis clés** pour la réussite en Première.

---

## 1) JSON des questions

**Fichier :** `data/qcm_seconde_for_premiere.json`

```json
{
  "meta": {
    "title": "Bilan d'entrée Première — Mathématiques",
    "niveau": "Première",
    "base": "Programme de Seconde (pré‑requis)",
    "totalQuestions": 40,
    "domainsOrder": [
      "NombresCalculs",
      "EquationsInequations",
      "Fonctions",
      "GeometrieTrig",
      "ProbaStats",
      "AlgoLogique"
    ]
  },
  "questions": [
    {"id":"Q1","domain":"NombresCalculs","weight":2,"critical":false,"type":"single","statement":"Simplifier : 18/24","options":["3/4","2/3","4/3","3/2"],"answer":0},
    {"id":"Q2","domain":"NombresCalculs","weight":2,"critical":false,"type":"single","statement":"Puissances : 2^3 · 2^4 =","options":["2^7","2^{12}","2^{1}","7·2"],"answer":0},
    {"id":"Q3","domain":"NombresCalculs","weight":2,"critical":true,"type":"single","statement":"√50 =","options":["5√2","25√2","10√5","2√5"],"answer":0},
    {"id":"Q4","domain":"NombresCalculs","weight":2,"critical":false,"type":"single","statement":"Écrire en notation scientifique : 0,00036","options":["3,6×10^{-4}","36×10^{-6}","3,6×10^{4}","36×10^{4}"],"answer":0},
    {"id":"Q5","domain":"NombresCalculs","weight":2,"critical":false,"type":"single","statement":"Calcul fractionnaire : 3/5 + 2/15 =","options":["11/15","1/3","7/15","3/15"],"answer":0},

    {"id":"Q6","domain":"EquationsInequations","weight":2,"critical":true,"type":"single","statement":"Résoudre : 3x − 5 = 1","options":["x=2","x=−2","x=1/3","x=−1/3"],"answer":0},
    {"id":"Q7","domain":"EquationsInequations","weight":2,"critical":false,"type":"single","statement":"Système : {x+y=7 ; x−y=1}","options":["(4,3)","(3,4)","(7,1)","(1,7)"],"answer":0},
    {"id":"Q8","domain":"EquationsInequations","weight":2,"critical":true,"type":"single","statement":"Inéquation : 2x+3 > 7","options":["x>2","x<2","x>−2","x<−2"],"answer":0},
    {"id":"Q9","domain":"EquationsInequations","weight":2,"critical":false,"type":"single","statement":"Valeur absolue : |x|=3","options":["x=3 ou x=−3","x=3","x=−3","aucune"],"answer":0},
    {"id":"Q10","domain":"EquationsInequations","weight":2,"critical":false,"type":"single","statement":"Équation produit : (x−2)(x+5)=0","options":["x=2 ou x=−5","x=−2 ou x=5","x=2","x=−5"],"answer":0},

    {"id":"Q11","domain":"Fonctions","weight":2,"critical":true,"type":"single","statement":"Fonction affine : f(x)=2x−1 ; f(3)=","options":["5","7","−1","2"],"answer":0},
    {"id":"Q12","domain":"Fonctions","weight":2,"critical":true,"type":"single","statement":"Zéro de f(x)=x^2−9","options":["±3","±9","3","−3"],"answer":0},
    {"id":"Q13","domain":"Fonctions","weight":3,"critical":true,"type":"single","statement":"Lecture graphique : si f est croissante sur [a,b], alors","options":["f(a)≤f(b)","f(a)>f(b)","f(a)=f(b)","on ne peut rien conclure"],"answer":0},
    {"id":"Q14","domain":"Fonctions","weight":2,"critical":false,"type":"single","statement":"Sommet de y=x^2−4x+1","options":["(2,−3)","(−2,−3)","(2,3)","(−2,3)"],"answer":0},
    {"id":"Q15","domain":"Fonctions","weight":2,"critical":false,"type":"single","statement":"Variations de y=x^2","options":["décroît sur (−∞,0] puis croît sur [0,+∞)","croît partout","décroît partout","constante"],"answer":0},

    {"id":"Q16","domain":"GeometrieTrig","weight":2,"critical":true,"type":"single","statement":"Pythagore : triangle rectangle en A, AB=3, AC=4 ; BC=","options":["5","7","\u221A7","\u221A5"],"answer":0},
    {"id":"Q17","domain":"GeometrieTrig","weight":2,"critical":false,"type":"single","statement":"Thalès : si (MN)//(BC) dans le triangle ABC, alors AM/AB =","options":["AN/AC","MB/BC","AB/AM","AC/AN"],"answer":0},
    {"id":"Q18","domain":"GeometrieTrig","weight":3,"critical":true,"type":"single","statement":"Trigonométrie : dans un triangle rectangle, cos(θ) =","options":["adjacent/hypoténuse","opposé/hypoténuse","opposé/adjacent","hypoténuse/adjacent"],"answer":0},
    {"id":"Q19","domain":"GeometrieTrig","weight":2,"critical":false,"type":"single","statement":"Aire d’un disque de rayon r","options":["πr^2","2πr","πr","r^2/π"],"answer":0},
    {"id":"Q20","domain":"GeometrieTrig","weight":2,"critical":false,"type":"single","statement":"Périmètre d’un cercle de rayon r","options":["2πr","πr^2","πr","r/2"],"answer":0},

    {"id":"Q21","domain":"ProbaStats","weight":2,"critical":false,"type":"single","statement":"Fréquence relative ≈ probabilité quand le nombre d’essais","options":["augmente","diminue","reste constant","est 1"],"answer":0},
    {"id":"Q22","domain":"ProbaStats","weight":2,"critical":false,"type":"single","statement":"Moyenne de 4, 6, 10","options":["6,67","7","8","5"],"answer":0},
    {"id":"Q23","domain":"ProbaStats","weight":2,"critical":false,"type":"single","statement":"Urne : 2 rouges, 3 bleues. P(rouge)","options":["2/5","3/5","1/2","2/3"],"answer":0},
    {"id":"Q24","domain":"ProbaStats","weight":2,"critical":true,"type":"single","statement":"Deux tirages avec remise : P(rouge puis bleu)","options":["(2/5)(3/5)","(2/5)(3/4)","(3/5)(2/5)","(1/5)"],"answer":0},
    {"id":"Q25","domain":"ProbaStats","weight":2,"critical":false,"type":"single","statement":"Écart‑type (intuition) mesure…","options":["la dispersion","la moyenne","la médiane","le maximum"],"answer":0},

    {"id":"Q26","domain":"EquationsInequations","weight":2,"critical":false,"type":"single","statement":"Système 2x+ y=7 ; x− y=1","options":["(\u221A ?)","(4,−1)","(4,−1) est faux","(4,3)"],"answer":3},
    {"id":"Q27","domain":"Fonctions","weight":2,"critical":true,"type":"single","statement":"Si f(x)=ax+b (a>0), alors f est","options":["croissante","décroissante","constante","périodique"],"answer":0},
    {"id":"Q28","domain":"NombresCalculs","weight":2,"critical":false,"type":"single","statement":"(a^3)^2=","options":["a^6","a^5","a^9","a^{3/2}"],"answer":0},
    {"id":"Q29","domain":"NombresCalculs","weight":2,"critical":false,"type":"single","statement":"\u221A(49/4)=","options":["7/2","7/4","49/2","\u221A49/\u221A4 =13/2"],"answer":0},
    {"id":"Q30","domain":"EquationsInequations","weight":3,"critical":true,"type":"single","statement":"Résoudre : x/3 − 2 = 4","options":["x=18","x=6","x=−6","x=12"],"answer":0},

    {"id":"Q31","domain":"Fonctions","weight":2,"critical":false,"type":"single","statement":"Graphe de y=(x−1)^2 : son sommet est","options":["(1,0)","(0,1)","(−1,0)","(0,−1)"],"answer":0},
    {"id":"Q32","domain":"Fonctions","weight":3,"critical":true,"type":"single","statement":"Si f est décroissante sur [a,b], alors","options":["f(a)≥f(b)","f(a)≤f(b)","f(a)=f(b)","aucune"],"answer":0},
    {"id":"Q33","domain":"GeometrieTrig","weight":2,"critical":false,"type":"single","statement":"Dans un triangle rectangle, tan(θ)=","options":["opposé/adjacent","adjacent/opposé","adjacent/hypoténuse","hypoténuse/opposé"],"answer":0},
    {"id":"Q34","domain":"GeometrieTrig","weight":2,"critical":false,"type":"single","statement":"Convertir 60° en radians","options":["π/3","π/2","π/6","2π/3"],"answer":0},
    {"id":"Q35","domain":"ProbaStats","weight":2,"critical":false,"type":"single","statement":"Une expérience a deux issues équiprobables. P(succès)=","options":["1/2","1/3","2/3","1"],"answer":0},

    {"id":"Q36","domain":"AlgoLogique","weight":2,"critical":false,"type":"single","statement":"Algorithme : u←5 ; pour i=1..n : u←u−2 ; afficher u. Résultat ?","options":["5−2n","5+2n","2n−5","2(5−n)"],"answer":0},
    {"id":"Q37","domain":"AlgoLogique","weight":2,"critical":true,"type":"single","statement":"Tableur : si B1=2, B2=5 et B_{k+1}=B_k + B_{k−1}, alors","options":["suite Fibonacci‑like","arithmétique","géométrique","constante"],"answer":0},
    {"id":"Q38","domain":"NombresCalculs","weight":2,"critical":false,"type":"single","statement":"Calcul littéral : (x+3)^2 − (x−3)^2 =","options":["12x","6x","x^2+9","9−x^2"],"answer":0},
    {"id":"Q39","domain":"EquationsInequations","weight":2,"critical":false,"type":"single","statement":"Résoudre : |x−2|<3","options":["−1<x<5","−5<x<1","x<−1 ou x>5","x=±3"],"answer":0},
    {"id":"Q40","domain":"Fonctions","weight":3,"critical":true,"type":"single","statement":"Tableau de variations : si f'(x)>0 sur I, alors","options":["f croît sur I","f décroît sur I","f constante sur I","aucune"],"answer":0}
  ]
}
```

> Total **40 questions**, poids 2 par défaut, **poids 3** sur les `critical` majeurs (variations, affine, équations/inéquations, trigonométrie, racines/puissances).

---

## 2) Script Python — Scoring + Radar PNG

**Fichier :** `scripts/score_radar_premiere.py`

```python
#!/usr/bin/env python3
# -*- coding: utf-8 -*-
"""
Usage:
  python scripts/score_radar_premiere.py \
    --qcm data/qcm_seconde_for_premiere.json \
    --answers answers.json \
    --out results.json \
    --png radar.png

answers.json : {"Q1":0, "Q2":1, ...} (index de l'option choisie)
"""
import json, math, argparse
import matplotlib.pyplot as plt

DOMAINS_ORDER = [
    "NombresCalculs",
    "EquationsInequations",
    "Fonctions",
    "GeometrieTrig",
    "ProbaStats",
    "AlgoLogique",
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
    plt.title("Bilan Première — Radar des domaines", y=1.08)
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

## 3) Adaptateur TypeScript — Payload pour PDF & Dashboard

**Fichier :** `lib/scoring/adapter_premiere.ts`

```ts
export type Results = {
  total: number;
  totalMax: number;
  byDomain: Record<string, { points: number; max: number; percent: number }>;
};

export function toScoresByDomain(results: Results) {
  const order = [
    "NombresCalculs",
    "EquationsInequations",
    "Fonctions",
    "GeometrieTrig",
    "ProbaStats",
    "AlgoLogique",
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

export function suggestPlanPremiere(results: Results) {
  return [
    "S1–S2 : Automatismes Seconde (fractions, puissances, équations 1er degré)",
    "S3–S4 : Fonctions affines & carré — variations, lectures graphiques",
    "S5–S6 : Géométrie & trigonométrie — Pythagore, Thalès, cos/sin/tan",
    "S7–S8 : Probas/Stats — interprétation, fréquences, modélisation simple"
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

export function buildPdfPayloadPremiere(results: Results) {
  const scoresByDomain = toScoresByDomain(results);
  const { forces, faiblesses } = inferStrengthsWeaknesses(results);
  const feuilleDeRoute = suggestPlanPremiere(results);
  const offers = chooseOffer(results);
  const scoreGlobal = Math.round((results.total/Math.max(1,results.totalMax))*100);
  return { scoresByDomain, forces, faiblesses, feuilleDeRoute, offers, scoreGlobal };
}
```

---

## 4) Checklist d’intégration

1. Déposer `data/qcm_seconde_for_premiere.json` dans le repo (ou en DB).
2. Capter les réponses de l’élève → `answers.json` (ou objet JS côté API).
3. Lancer `python scripts/score_radar_premiere.py` → `results.json` + `radar.png`.
4. Côté Next.js, consommer `results.json` avec `buildPdfPayloadPremiere` et alimenter vos PDF (variante Parent/Élève) + dashboard.

**Livré :** JSON (40q) ✅ · Python scoring+radar ✅ · Adapter TS ✅
