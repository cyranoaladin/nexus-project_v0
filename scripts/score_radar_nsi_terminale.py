#!/usr/bin/env python3
# -*- coding: utf-8 -*-
"""Usage
python scripts/score_radar_nsi_terminale.py \
  --qcm data/qcm_premiere_for_terminale_nsi.json \
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
    ax.plot(angles, values, linewidth=2, color="#2563eb")
    ax.fill(angles, values, color="#2563eb", alpha=0.25)
    ax.set_thetagrids([a*180/math.pi for a in angles[:-1]], DOMAINS_ORDER)
    ax.set_ylim(0,100)
    plt.title("Bilan NSI Terminale — Radar des domaines", y=1.08)
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

