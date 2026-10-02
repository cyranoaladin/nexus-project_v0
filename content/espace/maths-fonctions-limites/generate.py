#!/usr/bin/env python3
"""Génère content.json du parcours « Fonctions, limites et lecture graphique ».

Source de rédaction du contenu : on édite CE fichier puis on relance
`python3 content/espace/maths-fonctions-limites/generate.py`. Le JSON produit est ce que lit l'application.
Les formules s'écrivent \\( … \\) (en ligne) et \\[ … \\] (centrées) ; on évite < et > dans les formules
(\\lt, \\gt) pour que le HTML reste valide. La typographie française (espaces insécables) est appliquée
automatiquement HORS formules et HORS balises.
"""
import json
import pathlib
import re

HERE = pathlib.Path(__file__).parent
NNBSP = "\u202f"
NBSP = "\u00a0"
_SPLIT = re.compile(r"(\\\(.*?\\\)|\\\[.*?\\\]|<[^>]+>|\{\{[^}]*\}\})", re.S)


def fr(s: str) -> str:
    parts = _SPLIT.split(s)
    for i in range(0, len(parts), 2):
        t = parts[i]
        t = re.sub(r" ([;!?])", NNBSP + r"\1", t)
        t = re.sub(r" :", NBSP + ":", t)
        t = t.replace("« ", "«" + NBSP).replace(" »", NBSP + "»")
        parts[i] = t
    return "".join(parts)


def deep(o):
    if isinstance(o, str):
        return fr(o)
    if isinstance(o, list):
        return [deep(x) for x in o]
    if isinstance(o, dict):
        return {k: (v if k in ("id", "type", "kind", "accept", "when", "fn", "window") else deep(v)) for k, v in o.items()}
    return o


def table(header, rows, style=""):
    cell = 'style="border:1px solid currentColor;padding:.25rem .6rem;text-align:center"'
    head = "".join(f"<th {cell}>{h}</th>" for h in header)
    body = "".join("<tr>" + "".join(f"<td {cell}>{c}</td>" for c in r) + "</tr>" for r in rows)
    return f'<table style="border-collapse:collapse;margin:.5rem 0;{style}"><thead><tr>{head}</tr></thead><tbody>{body}</tbody></table>'


def q(id, text, choices, correct, feedback, choice_feedback=None):
    d = {"id": id, "text": text, "choices": choices, "correct": correct, "feedback": feedback}
    if choice_feedback is not None:
        assert len(choice_feedback) == len(choices), id
        d["choiceFeedback"] = choice_feedback
    return d


def f(id, label, placeholder="", input="area", check=None):
    d = {"id": id, "label": label}
    if placeholder:
        d["placeholder"] = placeholder
    d["input"] = input
    if check:
        d["check"] = check
    return d


def chk(kind, accept, rules=None, success=None, fallback=None):
    d = {"kind": kind, "accept": accept}
    if rules:
        d["rules"] = [{"when": w, "feedback": fb} for w, fb in rules]
    if success:
        d["success"] = success
    if fallback:
        d["fallback"] = fallback
    return d


def rat(num, den):
    return {"kind": "rational", "num": num, "den": den}


G = rat([1, 2], [-1, 1])  # (2x+1)/(x-1)
D = rat([-2, 3], [1, 1])  # (3x-2)/(x+1)
H = rat([-1, 0, 1], [-1, 1])  # (x²-1)/(x-1)
F = rat([1, -3, 2], [4, 0, 1])  # (2x²-3x+1)/(x²+4)
K = rat([0, -3, 2], [-1, 0, 1])  # (2x²-3x)/(x²-1)
M = rat([1, 1, 1], [0, 1])  # (x²+x+1)/x

steps = []

# ───────────────────────────── 0. Diagnostic graphique ─────────────────────────────
steps.append(
    {
        "id": "diagnostic",
        "short": "Lire",
        "title": "Lire une courbe avant de calculer",
        "minutes": 8,
        "level": "Diagnostic (non noté)",
        "concepts": ["lecture graphique", "domaine", "asymptote", "pente de tangente"],
        "intro": "Avant tout calcul, observe. Ces questions ne sont pas notées : elles servent à voir d'où tu pars.",
        "lesson": (
            "<p>La courbe ci-dessous est la courbe \\(\\mathcal C_d\\) d'une fonction \\(d\\). "
            "Regarde-la comme un paysage : où est-elle coupée ? que devient-elle très loin à droite, très loin à gauche ? monte-t-elle ou descend-elle ?</p>"
            "{{fig:diag}}"
            "<p>Réponds uniquement avec ce que tu vois.</p>"
            "{{q:dom}}{{q:av}}{{f:lim-droite}}{{q:val}}{{q:pente}}"
        ),
        "task": "Réponds aux cinq questions en lisant la courbe, sans calcul.",
        "starter": None,
        "figures": [
            {
                "type": "function",
                "id": "diag",
                "caption": "Courbe \\(\\mathcal C_d\\) : lis-la sans calculer.",
                "curveLabel": "courbe de d",
                "fn": D,
                "window": {"xmin": -6, "xmax": 6, "ymin": -6, "ymax": 10},
            }
        ],
        "questions": [
            q(
                "dom",
                "Pour quelle valeur de \\(x\\) la courbe n'existe-t-elle pas ?",
                ["Pour \\(x=-1\\)", "Pour \\(x=1\\)", "Pour \\(x=3\\)", "Elle existe pour tout réel \\(x\\)"],
                0,
                "La courbe est en deux morceaux séparés par la verticale d'abscisse \\(-1\\) : la fonction n'est pas définie en \\(-1\\). On écrit \\(D_d=\\mathbb R\\setminus\\{-1\\}\\).",
                [
                    "",
                    "Regarde de quel côté de l'axe des ordonnées se trouve la coupure : l'abscisse est négative.",
                    "3 est la hauteur vers laquelle la courbe se stabilise à droite, pas une abscisse interdite.",
                    "Le trait est interrompu : il existe une abscisse où il n'y a aucun point de la courbe.",
                ],
            ),
            q(
                "av",
                "Que fait \\(d(x)\\) quand \\(x\\) se rapproche de \\(-1\\) ?",
                [
                    "Il devient de plus en plus grand en valeur absolue (vers \\(+\\infty\\) ou \\(-\\infty\\))",
                    "Il se rapproche de \\(0\\)",
                    "Il se stabilise autour de \\(3\\)",
                    "On ne peut rien dire",
                ],
                0,
                "Près de \\(x=-1\\), la courbe monte (à gauche) ou descend (à droite) sans s'arrêter : la droite \\(x=-1\\) est un bon candidat à être asymptote verticale. Le calcul de limite le prouvera.",
                [
                    "",
                    "Regarde la hauteur de la courbe tout près de la coupure : elle est loin de l'axe des abscisses.",
                    "Ce comportement-là se produit loin sur la droite ou sur la gauche, pas près de la coupure.",
                    "On voit très bien : les deux branches s'éloignent de plus en plus.",
                ],
            ),
            q(
                "val",
                "Lis une valeur approchée de \\(d(1)\\).",
                ["environ \\(-2\\)", "environ \\(0{,}5\\)", "environ \\(1\\)", "environ \\(3\\)"],
                1,
                "Au point d'abscisse 1, la courbe est un peu au-dessus de l'axe des abscisses : \\(d(1)\\approx0{,}5\\) (c'est exactement \\(0{,}5\\)).",
                [
                    "C'est \\(d(0)\\) : la courbe coupe l'axe des ordonnées en \\(-2\\). Ici l'abscisse est 1.",
                    "",
                    "Pour \\(x=1\\), la courbe est encore sous la hauteur 1.",
                    "3 est la limite à l'infini, une hauteur jamais atteinte ici.",
                ],
            ),
            q(
                "pente",
                "Le coefficient directeur de la tangente à \\(\\mathcal C_d\\) au point d'abscisse \\(2\\) est…",
                ["positif", "négatif", "nul", "impossible à deviner"],
                0,
                "Sur ce morceau de courbe, quand on avance vers la droite on monte : toutes les tangentes ont une pente positive.",
                [
                    "",
                    "Une pente négative correspond à une courbe qui descend de gauche à droite : ce n'est pas le cas ici.",
                    "Une tangente horizontale demanderait que la courbe soit « à plat » à cet endroit.",
                    "Si : le sens de variation de la courbe donne le signe de la pente.",
                ],
            ),
        ],
        "fields": [
            f(
                "lim-droite",
                "À droite (quand \\(x\\) devient très grand), vers quelle valeur \\(d(x)\\) semble-t-il se stabiliser ?",
                "Un nombre (une hauteur, à lire sur l'axe vertical).",
                "line",
                chk(
                    "limit",
                    ["3"],
                    [
                        (["-1", "1"], "−1 est une abscisse (la coupure) ; ici on cherche une hauteur : lis sur l'axe vertical."),
                        (["2", "4", "2,5", "3,5"], "Tu es proche : lis la hauteur plus précisément. La courbe s'approche d'un nombre entier."),
                        (["+inf", "inf", "-inf"], "À l'extrême droite la courbe devient presque horizontale : elle ne monte pas sans fin. À quelle hauteur ?"),
                        (["0"], "0 est l'axe des abscisses ; la courbe, à droite, reste nettement au-dessus. Lis plus haut."),
                    ],
                    "Oui : la courbe se rapproche de la hauteur 3. On écrira \\(\\lim_{x\\to+\\infty}d(x)=3\\) ; la droite \\(y=3\\) est une asymptote horizontale possible.",
                    "Regarde l'extrême droite de la courbe : elle devient presque horizontale. À quelle hauteur sur l'axe vertical ?",
                ),
            )
        ],
        "hints": [
            "Cherche d'abord où la courbe est coupée en deux morceaux : la valeur interdite est une abscisse (axe horizontal).",
            "Pour « à droite », regarde la courbe tout au bout, quand \\(x\\) devient grand ; lis la hauteur sur l'axe vertical.",
            "Pour la pente d'une tangente, demande-toi si la courbe monte ou descend quand on se déplace vers la droite.",
        ],
        "takeaway": "Une courbe se lit : les abscisses interdites (coupures), le comportement aux bords (hauteurs vers lesquelles elle tend), le sens de variation (pente). Les calculs qui suivent servent à justifier ce que l'on voit.",
        "tests": [],
    }
)

# ───────────────────────────── 1. Comprendre une limite ─────────────────────────────
tbl_inf = table(
    ["\\(x\\)", "10", "100", "1 000", "10 000"],
    [["\\(g(x)\\)", "2,3333", "2,0303", "2,0030", "2,0003"]],
)
tbl_1m = table(
    ["\\(x\\) (avant 1)", "0,9", "0,99", "0,999"],
    [["\\(g(x)\\)", "\\(-28\\)", "\\(-298\\)", "\\(-2\\,998\\)"]],
)
tbl_1p = table(
    ["\\(x\\) (après 1)", "1,1", "1,01", "1,001"],
    [["\\(g(x)\\)", "32", "302", "3 002"]],
)
steps.append(
    {
        "id": "limite",
        "short": "Limite",
        "title": "Que veut dire « tend vers » ?",
        "minutes": 10,
        "level": "Découverte",
        "concepts": ["limite en l'infini", "limite en un point", "limite à gauche et à droite", "notation lim"],
        "intro": "Une limite décrit ce que devient \\(f(x)\\) quand \\(x\\) évolue d'une façon précise. Deux situations à ne pas confondre.",
        "lesson": (
            "<p><strong>Quand \\(x\\to+\\infty\\)</strong> : \\(x\\) devient aussi grand qu'on veut. On regarde le <em>bord droit</em> de la courbe.</p>"
            "<p><strong>Quand \\(x\\to a\\)</strong> : \\(x\\) se rapproche du réel \\(a\\). On regarde la courbe <em>autour de l'abscisse \\(a\\)</em>. "
            "On distingue \\(x\\to a^-\\) (on arrive par des valeurs plus petites que \\(a\\)) et \\(x\\to a^+\\) (par des valeurs plus grandes).</p>"
            "<p>Toute la séance s'appuie sur une fonction fil rouge : \\[g(x)=\\frac{2x+1}{x-1}.\\] "
            "Voici ce qu'elle fait quand \\(x\\) devient grand :</p>"
            + tbl_inf
            + "<p>Les valeurs <em>se rapprochent de 2</em>. On écrit \\[\\lim_{x\\to+\\infty}g(x)=2.\\]</p>"
            "<p>Voyons maintenant ce qu'elle fait quand \\(x\\) s'approche de 1, d'abord par la gauche, puis par la droite :</p>"
            + tbl_1m
            + tbl_1p
            + "<p>Les valeurs deviennent <em>de plus en plus grandes en valeur absolue</em> : négatives avant 1, positives après 1. On écrit "
            "\\[\\lim_{x\\to1^-}g(x)=-\\infty\\qquad\\text{et}\\qquad\\lim_{x\\to1^+}g(x)=+\\infty.\\]</p>"
            "{{fig:g-lim}}"
            "<p>Sur le graphique, ces deux phénomènes se voient : la courbe se colle à une droite verticale près de 1, et à une droite horizontale très loin à droite.</p>"
            "{{q:lecture}}{{q:notation}}{{f:difference}}"
        ),
        "task": "Lis les tableaux, repère ce que fait \\(g(x)\\), puis réponds aux trois questions.",
        "starter": None,
        "figures": [
            {
                "type": "function",
                "id": "g-lim",
                "caption": "Courbe de \\(g\\) : près de 1 elle « s'envole », très loin à droite elle se rapproche de la hauteur 2.",
                "curveLabel": "courbe de g",
                "fn": G,
                "window": {"xmin": -5, "xmax": 7, "ymin": -8, "ymax": 12},
            }
        ],
        "questions": [
            q(
                "lecture",
                "Dans le premier tableau « avant 1 » (0,9 ; 0,99 ; 0,999), que fait \\(g(x)\\) ?",
                ["Il tend vers \\(+\\infty\\)", "Il tend vers \\(-\\infty\\)", "Il tend vers \\(2\\)", "Il tend vers \\(0\\)"],
                1,
                "Les valeurs \\(-28\\), \\(-298\\), \\(-2\\,998\\) sont négatives et de plus en plus grandes en valeur absolue : \\(g(x)\\to-\\infty\\) quand \\(x\\to1^-\\).",
                [
                    "Regarde le signe des valeurs du tableau : elles sont négatives.",
                    "",
                    "2 est ce que devient \\(g(x)\\) quand \\(x\\) devient grand, pas quand \\(x\\) s'approche de 1.",
                    "Les valeurs s'éloignent de 0 au lieu de s'en approcher.",
                ],
            ),
            q(
                "notation",
                "Quelle écriture traduit « quand \\(x\\) tend vers \\(+\\infty\\), \\(g(x)\\) se rapproche de 2 » ?",
                [
                    "\\(\\lim_{x\\to+\\infty}g(x)=2\\)",
                    "\\(\\lim_{x\\to2}g(x)=+\\infty\\)",
                    "\\(g(+\\infty)=2\\)",
                    "\\(\\lim_{x\\to1^+}g(x)=2\\)",
                ],
                0,
                "Sous « lim » on écrit ce que fait \\(x\\) ; après le signe « = » on écrit ce que devient \\(g(x)\\).",
                [
                    "",
                    "Tu as échangé les rôles : sous « lim » on met le comportement de \\(x\\), après « = » celui de \\(g(x)\\).",
                    "\\(+\\infty\\) n'est pas un nombre : on ne peut pas « calculer \\(g\\) en \\(+\\infty\\) ». On écrit une limite.",
                    "En 1 par valeurs supérieures, \\(g(x)\\) devient très grand (tableau), il ne se rapproche pas de 2.",
                ],
            ),
        ],
        "fields": [
            f(
                "difference",
                "Explique avec tes mots la différence entre \\(x\\to+\\infty\\) et \\(x\\to1\\).",
                "Dans un cas, \\(x\\)… ; dans l'autre, \\(x\\)…",
                "area",
            )
        ],
        "hints": [
            "Relis les deux sortes de tableaux : dans le premier, \\(x\\) grandit ; dans les deux autres, \\(x\\) s'approche de 1.",
            "Sous « lim », on lit le comportement de \\(x\\) ; après le « = », celui de \\(g(x)\\).",
        ],
        "takeaway": "Sous \\(\\lim\\) : ce que fait \\(x\\). Après le signe « = » : ce que devient \\(f(x)\\). Une limite peut être un nombre \\(\\ell\\), ou \\(+\\infty\\), ou \\(-\\infty\\).",
        "tests": [],
    }
)

# ───────────────────────────── 2. Calculer une limite ─────────────────────────────
ops = table(
    ["Situation", "Résultat"],
    [
        ["\\(+\\infty+\\ell\\) ou \\((+\\infty)+(+\\infty)\\)", "\\(+\\infty\\)"],
        ["\\(+\\infty\\times\\ell\\) avec \\(\\ell\\gt0\\) ; \\(+\\infty\\times+\\infty\\)", "\\(+\\infty\\)"],
        ["\\(\\dfrac{\\ell}{\\pm\\infty}\\)", "\\(0\\)"],
        ["\\(\\dfrac{\\ell}{0^+}\\) avec \\(\\ell\\gt0\\)", "\\(+\\infty\\)"],
        ["\\(\\dfrac{\\ell}{0^-}\\) avec \\(\\ell\\gt0\\)", "\\(-\\infty\\)"],
    ],
)
steps.append(
    {
        "id": "operations",
        "short": "Calculer",
        "title": "Calculer une limite : opérations et formes indéterminées",
        "minutes": 20,
        "level": "Application",
        "concepts": ["limites usuelles", "opérations sur les limites", "formes indéterminées", "terme prépondérant"],
        "intro": "Calculer une limite, c'est d'abord essayer de « remplacer » — et reconnaître quand ça ne suffit pas.",
        "lesson": (
            "<h4>1. Limites usuelles</h4>"
            "<p>\\[\\lim_{x\\to+\\infty}x^n=+\\infty\\ (n\\ge1)\\qquad\\lim_{x\\to\\pm\\infty}\\frac1{x^n}=0\\qquad\\lim_{x\\to0^+}\\frac1x=+\\infty\\qquad\\lim_{x\\to0^-}\\frac1x=-\\infty.\\]</p>"
            "<h4>2. Opérations</h4>"
            "<p>Dans les cas suivants, on peut conclure directement (\\(\\ell\\) désigne un réel) :</p>"
            + ops
            + "<p>Mais certains cas ne permettent <strong>pas</strong> de conclure. On les appelle les <strong>formes indéterminées</strong> : \\[\\infty-\\infty,\\qquad\\frac{\\infty}{\\infty},\\qquad\\frac00,\\qquad0\\times\\infty.\\]</p>"
            "<div class=\"contract\"><strong>Une forme indéterminée n'est pas un résultat.</strong> Elle signale qu'il faut transformer l'expression avant de conclure.</div>"
            "{{q:indet}}"
            "<h4>3. Un premier exemple</h4>"
            "<p>Que donne \\(\\lim_{x\\to+\\infty}(x^2-3x)\\) par substitution ? \\(x^2\\to+\\infty\\) et \\(-3x\\to-\\infty\\).</p>"
            "{{q:forme}}"
            "<h4>4. Le terme prépondérant</h4>"
            "<p>Pour un polynôme, quand \\(x\\) est très grand c'est le terme de plus haut degré qui « gagne ». On le met en facteur : "
            "\\[P(x)=3x^4-5x^2+7x-1=3x^4\\left(1-\\frac{5}{3x^2}+\\frac{7}{3x^3}-\\frac{1}{3x^4}\\right).\\] "
            "Entre parenthèses, tout tend vers 0 sauf le \\(1\\) : la parenthèse tend vers \\(1\\), et \\(3x^4\\to+\\infty\\).</p>"
            "{{f:limp}}{{q:limp-moins}}"
            "<h4>5. Un quotient de polynômes</h4>"
            "<p>Soit \\[f(x)=\\frac{2x^2-3x+1}{x^2+4}.\\] Quand \\(x\\to+\\infty\\), le haut et le bas tendent vers \\(+\\infty\\) : c'est \\(\\dfrac\\infty\\infty\\), forme indéterminée. On met \\(x^2\\) en facteur au numérateur et au dénominateur : "
            "\\[f(x)=\\frac{x^2\\left(2-\\dfrac3x+\\dfrac1{x^2}\\right)}{x^2\\left(1+\\dfrac4{x^2}\\right)}=\\frac{2-\\dfrac3x+\\dfrac1{x^2}}{1+\\dfrac4{x^2}}.\\] "
            "Les fractions \\(\\dfrac3x\\), \\(\\dfrac1{x^2}\\), \\(\\dfrac4{x^2}\\) tendent vers 0.</p>"
            "{{f:limf}}{{fig:f-courbe}}{{f:asym-f}}"
        ),
        "task": "Réponds aux questions dans l'ordre : chaque réponse prépare la suivante.",
        "starter": None,
        "figures": [
            {
                "type": "function",
                "id": "f-courbe",
                "caption": "Courbe de \\(f\\) : elle se rapproche de la hauteur trouvée quand \\(x\\) devient grand.",
                "curveLabel": "courbe de f",
                "fn": F,
                "window": {"xmin": -10, "xmax": 10, "ymin": -1, "ymax": 4},
            }
        ],
        "questions": [
            q(
                "indet",
                "Parmi ces cas, lequel n'est PAS une forme indéterminée ?",
                ["\\(\\infty-\\infty\\)", "\\(\\dfrac{\\infty}{\\infty}\\)", "\\(+\\infty+\\infty\\)", "\\(0\\times\\infty\\)"],
                2,
                "\\(+\\infty+\\infty=+\\infty\\) : deux quantités très grandes et positives s'ajoutent. Les trois autres peuvent donner n'importe quel résultat selon les expressions.",
                [
                    "Si : deux quantités énormes de signes opposés qui se retranchent peuvent donner n'importe quoi.",
                    "Si : tout dépend de laquelle « grandit le plus vite ».",
                    "",
                    "Si : « presque zéro » multiplié par « énorme » peut donner n'importe quoi.",
                ],
            ),
            q(
                "forme",
                "Pour \\(\\lim_{x\\to+\\infty}(x^2-3x)\\), la substitution donne…",
                ["\\(+\\infty\\)", "\\(-\\infty\\)", "une forme indéterminée \\(\\infty-\\infty\\)", "\\(0\\)"],
                2,
                "\\(x^2\\to+\\infty\\) et \\(-3x\\to-\\infty\\) : c'est \\(\\infty-\\infty\\), on ne peut pas conclure sans transformer (ici : factoriser \\(x^2(1-\\frac3x)\\), et on trouve bien \\(+\\infty\\)).",
                [
                    "La limite est bien \\(+\\infty\\), mais on ne peut pas l'affirmer par simple substitution : il faut d'abord transformer.",
                    "Rien ne permet d'affirmer \\(-\\infty\\) : les deux termes « se battent ».",
                    "",
                    "0 serait une compensation parfaite : ce n'est pas ce qui se passe, il faut calculer.",
                ],
            ),
            q(
                "limp-moins",
                "Et quand \\(x\\to-\\infty\\) ? La limite de \\(P(x)=3x^4-5x^2+7x-1\\) est…",
                ["\\(+\\infty\\)", "\\(-\\infty\\)", "\\(0\\)"],
                0,
                "Le terme dominant est \\(3x^4\\) : une puissance paire, donc positive même si \\(x\\) est négatif. D'où \\(\\lim_{x\\to-\\infty}P(x)=+\\infty\\).",
                [
                    "",
                    "Pense à la parité : que vaut \\(x^4\\) quand \\(x\\) est négatif ?",
                    "Le terme dominant devient infiniment grand en valeur absolue : il n'y a aucune raison d'arriver à 0.",
                ],
            ),
        ],
        "fields": [
            f(
                "limp",
                "\\(\\lim_{x\\to+\\infty}P(x)=\\) ?",
                "\\(+\\infty\\), \\(-\\infty\\) ou un nombre",
                "line",
                chk(
                    "limit",
                    ["+inf"],
                    [
                        (["-inf"], "Regarde le signe du terme dominant \\(3x^4\\) quand \\(x\\) est très grand : est-il positif ou négatif ?"),
                        (["inf-inf", "∞-∞", "inf/inf", "∞/∞"], "Ce n'est pas un résultat : \\(\\infty-\\infty\\) est une forme indéterminée. Mets en facteur le terme de plus haut degré, \\(3x^4\\)."),
                        (["3"], "3 est le coefficient du terme dominant, pas la limite : \\(x^4\\) devient infiniment grand."),
                        (["0"], "Pour avoir 0, il faudrait que tout s'annule. Or \\(3x^4\\) devient immense."),
                    ],
                    "Oui : la parenthèse tend vers 1 et \\(3x^4\\to+\\infty\\), donc \\(P(x)\\to+\\infty\\).",
                    "Mets \\(3x^4\\) en facteur, comme dans l'exemple, puis demande-toi ce que devient chaque morceau.",
                ),
            ),
            f(
                "limf",
                "\\(\\lim_{x\\to+\\infty}f(x)=\\) ?",
                "Un nombre, \\(+\\infty\\) ou \\(-\\infty\\)",
                "line",
                chk(
                    "limit",
                    ["2"],
                    [
                        (["inf/inf", "∞/∞"], "\\(\\dfrac\\infty\\infty\\) est une forme indéterminée, ce n'est pas le résultat : transforme l'expression avant de conclure."),
                        (["+inf"], "Le haut est grand, mais le bas aussi : ils grandissent « à la même vitesse ». Après factorisation par \\(x^2\\), que reste-t-il ?"),
                        (["0"], "0 serait la limite si le dénominateur l'emportait (degré plus grand). Ici les deux degrés sont égaux : compare les coefficients de \\(x^2\\)."),
                        (["1"], "Presque : divise bien chaque terme par \\(x^2\\). Le coefficient de \\(x^2\\) au numérateur est 2, pas 1."),
                        (["1/2", "0,5"], "Tu as inversé le quotient : c'est le coefficient du numérateur (2) sur celui du dénominateur (1)."),
                    ],
                    "Oui : \\(f(x)=\\dfrac{2-\\frac3x+\\frac1{x^2}}{1+\\frac4{x^2}}\\to\\dfrac21=2\\).",
                    "Dans l'expression factorisée, que deviennent \\(\\frac3x\\), \\(\\frac1{x^2}\\) et \\(\\frac4{x^2}\\) quand \\(x\\to+\\infty\\) ?",
                ),
            ),
            f(
                "asym-f",
                "Interprétation graphique : donne l'équation de l'asymptote horizontale de la courbe de \\(f\\) en \\(+\\infty\\).",
                "Une équation, par exemple y = …",
                "line",
                chk(
                    "equation",
                    ["y=2"],
                    [
                        (["x=2"], "\\(x=2\\) serait une droite verticale. La limite 2 est une hauteur : la droite est horizontale, d'équation \\(y=\\dots\\)"),
                        (["y=1", "y=0"], "Reprends la limite que tu viens de trouver : la droite horizontale a cette hauteur."),
                    ],
                    "Oui : la courbe se rapproche de la droite \\(y=2\\). C'est l'asymptote horizontale en \\(+\\infty\\).",
                    "Quand \\(\\lim_{x\\to+\\infty}f(x)=\\ell\\), la droite d'équation \\(y=\\ell\\) est asymptote. Écris l'équation complète.",
                ),
            ),
        ],
        "hints": [
            "Pour une forme indéterminée, la méthode à retenir : mettre en facteur le terme de plus haut degré.",
            "Dans le quotient, factorise par \\(x^2\\) en haut ET en bas, puis simplifie par \\(x^2\\).",
            "Après simplification, remplace chaque fraction du type \\(\\frac1x\\), \\(\\frac1{x^2}\\) par 0.",
        ],
        "takeaway": "Une forme indéterminée n'est jamais le résultat final d'une limite. Pour un polynôme ou un quotient de polynômes à l'infini : on met en facteur le terme de plus haut degré.",
        "tests": [],
    }
)

# ───────────────────────────── 3. Asymptote verticale ─────────────────────────────
steps.append(
    {
        "id": "asymptote-verticale",
        "short": "Verticale",
        "title": "Quand la courbe s'envole : l'asymptote verticale",
        "minutes": 15,
        "level": "Application",
        "concepts": ["limite en un point", "limites à gauche et à droite", "signe d'un quotient", "asymptote verticale", "contre-exemple"],
        "intro": "Dire « le dénominateur s'annule donc il y a une asymptote » est incomplet, et parfois faux. On va voir pourquoi.",
        "lesson": (
            "<p>Étudions \\(g(x)=\\dfrac{2x+1}{x-1}\\) près de \\(1\\), là où le dénominateur s'annule.</p>"
            "<p>Quand \\(x\\to1\\) : le numérateur \\(2x+1\\) tend vers \\(3\\), un nombre <strong>positif</strong>. Le dénominateur \\(x-1\\) tend vers \\(0\\). "
            "Un nombre proche de 3 divisé par un nombre très proche de 0 est très grand en valeur absolue : le résultat dépend uniquement du <strong>signe</strong> de \\(x-1\\).</p>"
            "{{q:signe-moins}}"
            "<p>Quand \\(x\\to1^-\\) : numérateur proche de \\(3\\) (positif), dénominateur négatif proche de \\(0\\) (on note \\(0^-\\)). Le quotient est négatif et très grand en valeur absolue.</p>"
            "{{f:lim-moins}}"
            "<p>Pour \\(x\\to1^+\\), reprends le même raisonnement avec le signe de \\(x-1\\) pour \\(x\\gt1\\).</p>"
            "{{f:lim-plus}}"
            "{{fig:g-av}}"
            "{{f:av-eq}}"
            "<h4>Attention : un contre-exemple essentiel</h4>"
            "<p>Soit \\(h(x)=\\dfrac{x^2-1}{x-1}\\). Son dénominateur s'annule aussi en 1. Mais \\(x^2-1=(x-1)(x+1)\\), donc pour \\(x\\ne1\\) : \\[h(x)=\\frac{(x-1)(x+1)}{x-1}=x+1.\\]</p>"
            "{{f:limh}}{{fig:h}}"
            "{{q:condition}}"
            "{{f:contre}}"
        ),
        "task": "Mène l'étude de \\(g\\) en 1, puis compare avec \\(h\\).",
        "starter": None,
        "figures": [
            {
                "type": "function",
                "id": "g-av",
                "caption": "La courbe de \\(g\\) se colle à la droite pointillée \\(x=1\\) : elle descend sans fin à gauche, monte sans fin à droite.",
                "curveLabel": "courbe de g",
                "fn": G,
                "window": {"xmin": -5, "xmax": 7, "ymin": -8, "ymax": 12},
                "verticalAsymptotes": [1],
            },
            {
                "type": "function",
                "id": "h",
                "caption": "Courbe de \\(h\\) : c'est la droite \\(y=x+1\\), avec un petit « trou » (cercle ouvert) en 1. Aucune asymptote.",
                "curveLabel": "courbe de h",
                "fn": H,
                "window": {"xmin": -4, "xmax": 5, "ymin": -3, "ymax": 7},
            },
        ],
        "questions": [
            q(
                "signe-moins",
                "Pour \\(x\\lt1\\) très proche de 1 (par exemple \\(0{,}99\\)), le signe de \\(x-1\\) est…",
                ["négatif", "positif", "nul"],
                0,
                "\\(0{,}99-1=-0{,}01\\lt0\\) : le dénominateur est négatif et proche de 0 (\\(0^-\\)).",
                [
                    "",
                    "Calcule \\(0{,}99-1\\) : est-ce positif ?",
                    "\\(x\\) n'est jamais égal à 1 : il s'en approche seulement.",
                ],
            ),
            q(
                "condition",
                "Quelle condition permet de conclure qu'une droite \\(x=a\\) est asymptote verticale ?",
                [
                    "Le dénominateur s'annule en \\(a\\)",
                    "Une limite (à gauche ou à droite) de \\(f\\) en \\(a\\) vaut \\(+\\infty\\) ou \\(-\\infty\\)",
                    "La fonction n'est pas définie en \\(a\\)",
                    "La courbe semble monter près de \\(a\\)",
                ],
                1,
                "C'est la limite qui prouve. Le dénominateur nul est un signal à examiner, pas une preuve : \\(h\\) en est le contre-exemple.",
                [
                    "Nécessaire pour qu'il y ait un problème, mais pas suffisant : \\(h\\) a un dénominateur nul en 1 et pas d'asymptote.",
                    "",
                    "Ne suffit pas : \\(h\\) n'est pas définie en 1 et n'a pas d'asymptote. Une valeur interdite n'est pas toujours une asymptote.",
                    "Le dessin peut tromper : seule une limite infinie le prouve.",
                ],
            ),
        ],
        "fields": [
            f(
                "lim-moins",
                "\\(\\lim_{x\\to1^-}g(x)=\\) ?",
                "\\(+\\infty\\) ou \\(-\\infty\\)",
                "line",
                chk(
                    "limit",
                    ["-inf"],
                    [
                        (["+inf"], "Examine le signe de \\(x-1\\) quand \\(x\\) approche 1 par valeurs inférieures : le numérateur est proche de 3 (positif). Quel est le signe du quotient ?"),
                        (["3"], "3 est la limite du numérateur seulement. Le dénominateur tend vers 0 : que devient le quotient ?"),
                        (["0"], "Le dénominateur tend vers 0, ce qui rend le quotient grand, pas petit."),
                        (["3/0"], "On ne divise pas par 0 : le dénominateur est proche de 0 mais non nul. Son signe (\\(0^-\\) ou \\(0^+\\)) donne \\(-\\infty\\) ou \\(+\\infty\\)."),
                    ],
                    "Oui : numérateur proche de 3 (positif), dénominateur négatif proche de 0 : le quotient tend vers \\(-\\infty\\).",
                    "Étudie séparément le signe du numérateur (proche de 3) et celui du dénominateur \\(x-1\\) pour \\(x\\lt1\\).",
                ),
            ),
            f(
                "lim-plus",
                "\\(\\lim_{x\\to1^+}g(x)=\\) ?",
                "\\(+\\infty\\) ou \\(-\\infty\\)",
                "line",
                chk(
                    "limit",
                    ["+inf"],
                    [
                        (["-inf"], "Pour \\(x\\gt1\\) proche de 1, le dénominateur \\(x-1\\) est positif et le numérateur aussi : quel est le signe du quotient ?"),
                        (["3", "0"], "Le dénominateur tend vers 0 : le quotient devient très grand en valeur absolue."),
                    ],
                    "Oui : numérateur positif, dénominateur positif proche de 0 (\\(0^+\\)) : le quotient tend vers \\(+\\infty\\).",
                    "Pour \\(x\\gt1\\), \\(x-1\\) est un petit nombre positif. Un nombre proche de 3 divisé par un petit positif donne…",
                ),
            ),
            f(
                "av-eq",
                "Conclusion graphique : donne l'équation de l'asymptote verticale de la courbe de \\(g\\).",
                "Une équation, par exemple x = …",
                "line",
                chk(
                    "equation",
                    ["x=1"],
                    [
                        (["y=1"], "\\(y=1\\) est une droite horizontale. Ici \\(x\\) tend vers un nombre : l'asymptote est une droite verticale d'équation \\(x=\\dots\\)"),
                        (["x=-1", "x=1/2", "x=-1/2"], "Le dénominateur s'annule pour \\(x-1=0\\) : résous cette équation."),
                        (["y=2"], "\\(y=2\\) sera l'asymptote horizontale (comportement en l'infini) : à ne pas confondre avec la verticale."),
                    ],
                    "Oui : \\(\\lim_{x\\to1^-}g(x)=-\\infty\\) et \\(\\lim_{x\\to1^+}g(x)=+\\infty\\), donc la droite \\(x=1\\) est asymptote verticale.",
                    "Une asymptote verticale a une équation de la forme \\(x=a\\), où \\(a\\) est la valeur dont \\(x\\) s'approche.",
                ),
            ),
            f(
                "limh",
                "\\(\\lim_{x\\to1}h(x)=\\) ? (utilise \\(h(x)=x+1\\) pour \\(x\\ne1\\))",
                "Un nombre ou \\(\\pm\\infty\\)",
                "line",
                chk(
                    "limit",
                    ["2"],
                    [
                        (["+inf", "-inf"], "Après simplification par \\(x-1\\) (possible car \\(x\\ne1\\)), \\(h(x)=x+1\\). Que vaut \\(x+1\\) quand \\(x\\) s'approche de 1 ?"),
                        (["0/0", "0"], "\\(\\dfrac00\\) est une forme indéterminée, pas un résultat : simplifie l'expression pour \\(x\\ne1\\)."),
                        (["1"], "C'est la valeur de \\(x\\), pas celle de \\(x+1\\). Remplace \\(x\\) par 1 dans \\(x+1\\)."),
                    ],
                    "Oui : \\(h(x)=x+1\\to2\\). La limite est finie : la courbe de \\(h\\) n'a pas d'asymptote verticale en 1.",
                    "Remplace \\(h(x)\\) par \\(x+1\\) (valable pour \\(x\\ne1\\)), puis fais tendre \\(x\\) vers 1.",
                ),
            ),
            f(
                "contre",
                "Complète par une phrase : « Un dénominateur qui s'annule ne suffit pas à… »",
                "Un dénominateur qui s'annule ne suffit pas à… car…",
                "area",
            ),
        ],
        "hints": [
            "Pour la limite en \\(1^-\\) : étudie séparément le numérateur (proche de 3) et le dénominateur \\(x-1\\) (de quel signe pour \\(x\\lt1\\) ?).",
            "Un nombre proche de 3 divisé par un nombre négatif très proche de 0 est un nombre négatif très grand en valeur absolue.",
            "Pour \\(h\\) : pense à factoriser \\(x^2-1=(x-1)(x+1)\\) et à simplifier.",
        ],
        "takeaway": "Si une limite à gauche ou à droite en \\(a\\) vaut \\(\\pm\\infty\\), alors la droite \\(x=a\\) est asymptote verticale. Un dénominateur qui s'annule est un signal à examiner, jamais une preuve.",
        "tests": [],
    }
)

# ───────────────────────────── 4. Asymptote horizontale ─────────────────────────────
steps.append(
    {
        "id": "asymptote-horizontale",
        "short": "Horizontale",
        "title": "Se stabiliser très loin : l'asymptote horizontale",
        "minutes": 8,
        "level": "Application",
        "concepts": ["limite en ±∞", "asymptote horizontale", "position d'une courbe par rapport à une asymptote"],
        "intro": "Même fonction \\(g\\), autre extrémité : que fait la courbe très loin à droite et très loin à gauche ?",
        "lesson": (
            "<p>On met \\(x\\) en facteur au numérateur et au dénominateur de \\(g(x)=\\dfrac{2x+1}{x-1}\\) : \\[g(x)=\\frac{x\\left(2+\\dfrac1x\\right)}{x\\left(1-\\dfrac1x\\right)}=\\frac{2+\\dfrac1x}{1-\\dfrac1x}.\\] "
            "Quand \\(x\\to\\pm\\infty\\), \\(\\dfrac1x\\to0\\).</p>"
            "{{f:lim-plus-inf}}{{f:lim-moins-inf}}{{f:ah-eq}}"
            "{{fig:g-complete}}"
            "{{q:vert-hori}}"
            "<h4>Une asymptote est-elle une barrière ?</h4>"
            "<p>Reprenons la fonction \\(f\\) de l'étape précédente. Sa courbe se rapproche de \\(y=2\\) en \\(+\\infty\\). Mais résolvons \\(f(x)=2\\) : "
            "\\[\\frac{2x^2-3x+1}{x^2+4}=2\\iff2x^2-3x+1=2x^2+8\\iff x=-\\frac73.\\]</p>"
            "{{fig:f-croise}}"
            "{{q:croise}}"
        ),
        "task": "Calcule les deux limites de \\(g\\) à l'infini, conclus, puis réfléchis à ce qu'est vraiment une asymptote.",
        "starter": None,
        "figures": [
            {
                "type": "function",
                "id": "g-complete",
                "caption": "Courbe de \\(g\\) avec ses deux asymptotes : \\(x=1\\) et \\(y=2\\).",
                "curveLabel": "courbe de g",
                "fn": G,
                "window": {"xmin": -6, "xmax": 8, "ymin": -8, "ymax": 12},
                "verticalAsymptotes": [1],
                "horizontalAsymptotes": [2],
            },
            {
                "type": "function",
                "id": "f-croise",
                "caption": "Courbe de \\(f\\) : elle coupe sa propre asymptote \\(y=2\\) au point B, d'abscisse \\(-\\dfrac73\\approx-2{,}33\\), avant de s'en rapprocher.",
                "curveLabel": "courbe de f",
                "fn": F,
                "window": {"xmin": -10, "xmax": 10, "ymin": -1, "ymax": 4},
                "horizontalAsymptotes": [2],
                "points": [{"x": -7 / 3, "label": "B"}],
            },
        ],
        "questions": [
            q(
                "vert-hori",
                "Quelle phrase est correcte ?",
                [
                    "Une asymptote verticale a pour équation \\(x=a\\) ; une asymptote horizontale a pour équation \\(y=\\ell\\)",
                    "Une asymptote verticale a pour équation \\(y=a\\) ; une asymptote horizontale a pour équation \\(x=\\ell\\)",
                    "Les deux ont une équation de la forme \\(y=\\dots\\)",
                    "Une asymptote est toujours la courbe elle-même",
                ],
                0,
                "Verticale : on fixe l'abscisse, \\(x=a\\) (quand \\(x\\to a\\), \\(f\\) tend vers l'infini). Horizontale : on fixe la hauteur, \\(y=\\ell\\) (quand \\(x\\to\\pm\\infty\\), \\(f(x)\\to\\ell\\)).",
                [
                    "",
                    "Tu as inversé : une droite verticale a tous ses points de même abscisse.",
                    "Une droite verticale ne peut pas s'écrire \\(y=\\dots\\) : tous ses points ont la même abscisse.",
                    "Une asymptote est une droite dont la courbe se rapproche, pas la courbe elle-même.",
                ],
            ),
            q(
                "croise",
                "Une courbe peut-elle couper son asymptote horizontale ?",
                [
                    "Non : une asymptote est une barrière que la courbe ne franchit jamais",
                    "Oui : l'asymptote décrit le comportement à l'infini, pas ce qui se passe à distance finie",
                    "Oui, mais seulement là où la fonction n'est pas définie",
                    "Non, sinon la limite ne vaudrait pas 2",
                ],
                1,
                "L'asymptote horizontale ne parle que du comportement quand \\(x\\to\\pm\\infty\\). Ici \\(f(-\\frac73)=2\\) : la courbe coupe sa propre asymptote, puis s'en rapproche. Une asymptote n'est pas une barrière.",
                [
                    "Le point B de la figure montre le contraire.",
                    "",
                    "En B, la fonction \\(f\\) est bien définie (\\(f(-\\frac73)=2\\)) et pourtant la courbe coupe la droite.",
                    "La limite ne dépend que de ce qui se passe quand \\(x\\) devient très grand, pas du reste de la courbe.",
                ],
            ),
        ],
        "fields": [
            f(
                "lim-plus-inf",
                "\\(\\lim_{x\\to+\\infty}g(x)=\\) ?",
                "Un nombre ou \\(\\pm\\infty\\)",
                "line",
                chk(
                    "limit",
                    ["2"],
                    [
                        (["inf/inf", "∞/∞"], "\\(\\dfrac\\infty\\infty\\) est une forme indéterminée, ce n'est pas le résultat : utilise la forme factorisée."),
                        (["+inf"], "Haut et bas grandissent ensemble : compare leurs coefficients dominants après factorisation par \\(x\\)."),
                        (["1", "0"], "Dans la forme factorisée, les fractions \\(\\frac1x\\) tendent vers 0 ; que reste-t-il en haut et en bas ?"),
                    ],
                    "Oui : \\(\\dfrac{2+\\frac1x}{1-\\frac1x}\\to\\dfrac21=2\\).",
                    "Dans \\(\\dfrac{2+\\frac1x}{1-\\frac1x}\\), remplace \\(\\frac1x\\) par 0.",
                ),
            ),
            f(
                "lim-moins-inf",
                "\\(\\lim_{x\\to-\\infty}g(x)=\\) ?",
                "Un nombre ou \\(\\pm\\infty\\)",
                "line",
                chk(
                    "limit",
                    ["2"],
                    [
                        (["-2"], "Le signe de \\(x\\) disparaît quand on simplifie par \\(x\\) : \\(\\frac1x\\to0\\) aussi en \\(-\\infty\\), et le quotient tend encore vers 2."),
                        (["-inf", "+inf"], "Même forme factorisée qu'en \\(+\\infty\\) : les fractions \\(\\frac1x\\) tendent encore vers 0."),
                    ],
                    "Oui : même calcul qu'en \\(+\\infty\\), \\(\\dfrac1x\\to0\\) aussi en \\(-\\infty\\). La limite vaut encore 2.",
                    "Utilise la même forme factorisée : \\(\\frac1x\\) tend aussi vers 0 quand \\(x\\to-\\infty\\).",
                ),
            ),
            f(
                "ah-eq",
                "Conclusion : donne l'équation de l'asymptote horizontale de la courbe de \\(g\\).",
                "Une équation, par exemple y = …",
                "line",
                chk(
                    "equation",
                    ["y=2"],
                    [
                        (["x=2"], "La limite 2 est une hauteur, pas une abscisse : l'équation est de la forme \\(y=\\dots\\)"),
                        (["x=1"], "\\(x=1\\) est l'asymptote verticale, trouvée à l'étape précédente. Ici on cherche la horizontale."),
                    ],
                    "Oui : \\(\\lim_{x\\to\\pm\\infty}g(x)=2\\), donc \\(y=2\\) est asymptote horizontale (en \\(+\\infty\\) et en \\(-\\infty\\)).",
                    "Quand la limite en l'infini vaut \\(\\ell\\), l'asymptote est \\(y=\\ell\\).",
                ),
            ),
        ],
        "hints": [
            "Utilise la forme factorisée \\(\\dfrac{2+\\frac1x}{1-\\frac1x}\\) pour les deux limites.",
            "Une asymptote horizontale a une équation \\(y=\\ell\\), où \\(\\ell\\) est la limite en l'infini.",
        ],
        "takeaway": "Si \\(\\lim_{x\\to+\\infty}f(x)=\\ell\\) (ou en \\(-\\infty\\)), la droite \\(y=\\ell\\) est asymptote horizontale dans cette direction. Une courbe peut très bien couper son asymptote horizontale.",
        "tests": [],
    }
)

# ───────────────────────────── 5. Dérivée et tangente ─────────────────────────────
steps.append(
    {
        "id": "tangente",
        "short": "Tangente",
        "title": "Dérivée et tangente : de la pente à l'équation",
        "minutes": 12,
        "level": "Application",
        "concepts": ["nombre dérivé", "coefficient directeur", "équation de tangente", "dérivée d'un quotient"],
        "intro": "Le nombre dérivé est une pente. L'équation de la tangente se construit à partir de cette pente et d'un point.",
        "lesson": (
            "<p>Le <strong>nombre dérivé</strong> \\(f'(a)\\) est le coefficient directeur de la tangente à la courbe au point \\(A\\bigl(a\\,;\\,f(a)\\bigr)\\).</p>"
            "<p><strong>Construisons l'équation.</strong> Une droite de coefficient directeur \\(m\\) a pour équation \\(y=mx+p\\). Elle doit passer par \\(A\\) : "
            "\\(f(a)=ma+p\\), donc \\(p=f(a)-ma\\). On obtient \\(y=mx+f(a)-ma\\), c'est-à-dire \\[T_a:\\ y=f(a)+f'(a)(x-a).\\]</p>"
            "<div class=\"contract\"><strong>Ne pas confondre</strong> \\(f(a)\\), l'ordonnée du point, et \\(f'(a)\\), la pente de la tangente.</div>"
            "<h4>Application à \\(g\\) en \\(a=0\\)</h4>"
            "<p>On dérive \\(g=\\dfrac uv\\) avec \\(u=2x+1\\), \\(v=x-1\\), donc \\(u'=2\\), \\(v'=1\\) : \\[g'(x)=\\frac{u'v-uv'}{v^2}=\\frac{2(x-1)-(2x+1)\\times1}{(x-1)^2}.\\]</p>"
            "{{q:pente-sens}}"
            "{{f:num}}"
            "<p>Le numérateur étant constant, \\(g'(x)=\\dfrac{-3}{(x-1)^2}\\). Maintenant, les deux ingrédients de la tangente en 0 :</p>"
            "{{f:g0}}{{f:gp0}}"
            "<p>Assemble-les avec la formule \\(T_a:\\ y=f(a)+f'(a)(x-a)\\) et <em>vérifie tout de suite sur la figure</em> : ta droite s'affiche en pointillés rouges.</p>"
            "{{f:tangente}}{{fig:g-tan}}"
        ),
        "task": "Dérive \\(g\\), calcule \\(g(0)\\) et \\(g'(0)\\), écris l'équation de la tangente et confronte-la à la figure.",
        "starter": None,
        "figures": [
            {
                "type": "function",
                "id": "g-tan",
                "caption": "Courbe de \\(g\\), asymptotes, point A d'abscisse 0 et tangente (trait vert). Ta droite apparaît en pointillés rouges.",
                "curveLabel": "courbe de g",
                "fn": G,
                "window": {"xmin": -4, "xmax": 6, "ymin": -8, "ymax": 8},
                "verticalAsymptotes": [1],
                "horizontalAsymptotes": [2],
                "tangentAt": 0,
                "points": [{"x": 0, "label": "A"}],
                "overlayFieldId": "tangente",
            }
        ],
        "questions": [
            q(
                "pente-sens",
                "Au point d'abscisse 0, la courbe de \\(g\\) « descend » quand on avance vers la droite. Le nombre dérivé \\(g'(0)\\) est donc…",
                ["négatif", "positif", "nul"],
                0,
                "Une courbe qui descend a des tangentes de pente négative : on attend \\(g'(0)\\lt0\\). Garde cette attente pour contrôler ton calcul.",
                [
                    "",
                    "Une pente positive correspond à une courbe qui monte de gauche à droite.",
                    "Une tangente horizontale correspond à un sommet ou un creux, pas à une courbe qui descend nettement.",
                ],
            )
        ],
        "fields": [
            f(
                "num",
                "Calcule le numérateur \\(u'v-uv'=2(x-1)-(2x+1)\\times1\\) en développant avec soin.",
                "Un nombre (le résultat ne dépend pas de x)",
                "line",
                chk(
                    "number",
                    ["-3"],
                    [
                        (["3"], "Attention au signe : développe \\(2(x-1)=2x-2\\), puis retranche TOUT le second produit : \\(-(2x+1)=-2x-1\\)."),
                        (["-1"], "Tu as sans doute oublié de changer le signe du 1 : \\(-(2x+1)\\) donne \\(-2x\\) puis \\(-1\\) (et non \\(+1\\))."),
                        (["1"], "Rassemble : \\(2x-2-2x-1\\). Les termes en \\(x\\) s'annulent ; que reste-t-il ?"),
                    ],
                    "Oui : \\(2x-2-2x-1=-3\\). Les termes en \\(x\\) disparaissent.",
                    "Développe \\(2(x-1)\\) puis \\((2x+1)\\times1\\), et retranche : \\(2x-2-(2x+1)\\).",
                ),
            ),
            f(
                "g0",
                "Calcule \\(g(0)\\).",
                "Un nombre",
                "line",
                chk(
                    "number",
                    ["-1"],
                    [
                        (["1"], "Remplace \\(x\\) par 0 : \\(\\dfrac{2\\times0+1}{0-1}\\). Le dénominateur vaut \\(-1\\) : quel signe pour le quotient ?"),
                        (["-3"], "−3 sera \\(g'(0)\\), pas \\(g(0)\\). \\(g(0)\\) est l'ordonnée du point : calcule \\(\\frac{2\\times0+1}{0-1}\\)."),
                    ],
                    "Oui : \\(g(0)=\\dfrac{1}{-1}=-1\\). Le point de tangence est \\(A(0\\,;\\,-1)\\).",
                    "Remplace \\(x\\) par 0 dans \\(\\dfrac{2x+1}{x-1}\\).",
                ),
            ),
            f(
                "gp0",
                "Calcule \\(g'(0)\\) avec \\(g'(x)=\\dfrac{-3}{(x-1)^2}\\).",
                "Un nombre",
                "line",
                chk(
                    "number",
                    ["-3"],
                    [
                        (["3"], "Signe : \\(g'(x)=\\dfrac{-3}{(x-1)^2}\\). Avec \\(x=0\\), \\((0-1)^2=1\\), donc \\(\\dfrac{-3}{1}\\)."),
                        (["-1"], "−1 est \\(g(0)\\), pas \\(g'(0)\\) : \\(f(a)\\) est l'ordonnée du point, \\(f'(a)\\) la pente de la tangente."),
                        (["-3/-1", "3/1"], "Le carré \\((0-1)^2\\) vaut \\(+1\\) : un carré n'est jamais négatif."),
                    ],
                    "Oui : \\(g'(0)=\\dfrac{-3}{(-1)^2}=-3\\). La pente est négative, comme prévu.",
                    "Remplace \\(x\\) par 0 dans \\(\\dfrac{-3}{(x-1)^2}\\) et n'oublie pas que \\((-1)^2=1\\).",
                ),
            ),
            f(
                "tangente",
                "Écris l'équation de la tangente \\(T_0\\) à la courbe de \\(g\\) au point d'abscisse 0.",
                "Sous la forme y = ax + b",
                "line",
                chk(
                    "linear",
                    ["y=-3x-1"],
                    [
                        (["y=-3x+1"], "Vérifie \\(g(0)\\) : l'ordonnée à l'origine est \\(g(0)=-1\\), pas son opposé."),
                        (["y=3x-1", "y=3x+1"], "Le coefficient directeur est \\(g'(0)=-3\\), avec son signe."),
                        (["y=-x-3"], "Tu as échangé \\(f(a)\\) et \\(f'(a)\\) : la pente est \\(g'(0)=-3\\), l'ordonnée du point est \\(g(0)=-1\\)."),
                        (["y=-3x"], "Tu as oublié \\(f(a)\\) : \\(y=f(a)+f'(a)(x-a)=-1-3(x-0)\\)."),
                        (["y=-1"], "Il manque la pente : \\(y=f(a)+f'(a)(x-a)\\) avec \\(f'(0)=-3\\)."),
                    ],
                    "Oui : \\(T_0:\\ y=-1+(-3)(x-0)=-3x-1\\). Sur la figure, la droite rouge pointillée se superpose au trait vert.",
                    "Applique \\(y=f(a)+f'(a)(x-a)\\) avec \\(a=0\\), \\(f(a)=-1\\) et \\(f'(a)=-3\\).",
                ),
            ),
        ],
        "hints": [
            "Le numérateur de la dérivée est \\(u'v-uv'\\) : attention au signe devant tout le second produit.",
            "\\(f(a)\\) est une ordonnée (un point), \\(f'(a)\\) est une pente : ne les mélange pas.",
            "Remplace dans \\(y=f(a)+f'(a)(x-a)\\) : \\(y=-1+(-3)(x-0)\\), puis simplifie.",
        ],
        "takeaway": "La tangente en \\(a\\) : \\(T_a:\\ y=f(a)+f'(a)(x-a)\\). \\(f(a)\\) donne le point, \\(f'(a)\\) donne la pente.",
        "tests": [],
    }
)

# ───────────────────────────── 6. Variations ─────────────────────────────
steps.append(
    {
        "id": "variations",
        "short": "Variations",
        "title": "Le signe de la dérivée donne les variations",
        "minutes": 8,
        "level": "Application",
        "concepts": ["signe de la dérivée", "sens de variation", "tableau de variations", "domaine non connexe"],
        "intro": "Une dérivée négative, c'est une fonction décroissante. Mais attention à la valeur interdite : on ne traverse pas \\(x=1\\).",
        "lesson": (
            "<p>On a \\(g'(x)=\\dfrac{-3}{(x-1)^2}\\) pour \\(x\\ne1\\). Le numérateur \\(-3\\) est négatif ; le dénominateur \\((x-1)^2\\) est un carré, donc strictement positif dès que \\(x\\ne1\\).</p>"
            "{{q:signe-gprime}}"
            "<p>Donc \\(g'(x)\\lt0\\) sur \\(]-\\infty\\,;1[\\) et sur \\(]1\\,;+\\infty[\\). On construit le tableau <strong>intervalle par intervalle</strong>, en utilisant les limites trouvées avant :</p>"
            + table(
                ["", "sur \\(]-\\infty\\,;1[\\)", "en \\(x=1\\)", "sur \\(]1\\,;+\\infty[\\)"],
                [
                    ["signe de \\(g'(x)\\)", "\\(-\\)", "\\(g\\) n'est pas définie", "\\(-\\)"],
                    ["variations de \\(g\\)", "décroît de \\(2\\) (en \\(-\\infty\\)) à \\(-\\infty\\) (en \\(1^-\\))", "asymptote \\(x=1\\)", "décroît de <strong>?</strong> (en \\(1^+\\)) à <strong>?</strong> (en \\(+\\infty\\))"],
                ],
            )
            + "{{f:var-debut}}{{f:var-fin}}"
            "<p>On ne dit jamais « \\(g\\) est décroissante sur \\(\\mathbb R\\setminus\\{1\\}\\) » :</p>"
            "{{q:piege}}"
        ),
        "task": "Détermine le signe de la dérivée, complète le tableau à droite de 1, puis démasque le piège.",
        "starter": None,
        "figures": [],
        "questions": [
            q(
                "signe-gprime",
                "Le signe de \\(g'(x)=\\dfrac{-3}{(x-1)^2}\\) pour \\(x\\ne1\\) est…",
                ["toujours négatif", "toujours positif", "positif puis négatif", "il change de signe en \\(x=1\\)"],
                0,
                "Le numérateur \\(-3\\) est négatif et \\((x-1)^2\\gt0\\) pour \\(x\\ne1\\) : le quotient est toujours négatif.",
                [
                    "",
                    "Le numérateur est \\(-3\\) : il est négatif. Un carré ne change pas son signe.",
                    "Il n'y a aucune valeur de \\(x\\) où le numérateur change de signe : il vaut toujours \\(-3\\).",
                    "En 1, la dérivée n'existe pas (la fonction n'est pas définie) : elle ne change pas de signe de part et d'autre.",
                ],
            ),
            q(
                "piege",
                "Peut-on dire que \\(g\\) est décroissante sur \\(\\mathbb R\\setminus\\{1\\}\\) tout entier ?",
                [
                    "Oui, puisque \\(g'\\lt0\\) partout où elle existe",
                    "Non : \\(g(0)=-1\\) est plus petit que \\(g(2)=5\\) alors que \\(0\\lt2\\)",
                    "Oui, mais seulement sur \\(]1\\,;+\\infty[\\)",
                    "Non, car \\(g\\) n'a pas de dérivée",
                ],
                1,
                "La décroissance n'est vraie que sur chaque intervalle séparément. Si on traverse l'asymptote, la courbe « saute » du bas vers le haut : \\(g(0)=-1\\lt g(2)=5\\). Dans le tableau, on ne traverse jamais \\(x=1\\).",
                [
                    "Le contre-exemple \\(g(0)=-1\\), \\(g(2)=5\\) contredit une décroissance globale : une fonction décroissante vérifie \\(x_1\\lt x_2\\Rightarrow f(x_1)\\gt f(x_2)\\).",
                    "",
                    "Elle est bien décroissante sur \\(]1\\,;+\\infty[\\), mais la question porte sur les deux intervalles à la fois.",
                    "Elle est dérivable sur chaque intervalle de son domaine : \\(g'\\) existe, elle vaut \\(\\frac{-3}{(x-1)^2}\\).",
                ],
            ),
        ],
        "fields": [
            f(
                "var-debut",
                "Sur \\(]1\\,;+\\infty[\\) : de quelle valeur la fonction part-elle, c'est-à-dire \\(\\lim_{x\\to1^+}g(x)\\) ?",
                "\\(+\\infty\\) ou \\(-\\infty\\)",
                "line",
                chk(
                    "limit",
                    ["+inf"],
                    [(["-inf"], "Reprends ta réponse sur la limite à droite de 1 (étape « verticale ») : le tableau doit lui être cohérent.")],
                    "Oui : \\(g\\) part de \\(+\\infty\\) près de 1 et décroît.",
                    "Cette valeur est celle de ta limite en \\(1^+\\).",
                ),
            ),
            f(
                "var-fin",
                "Sur \\(]1\\,;+\\infty[\\) : vers quelle valeur la fonction décroît-elle, c'est-à-dire \\(\\lim_{x\\to+\\infty}g(x)\\) ?",
                "Un nombre ou \\(\\pm\\infty\\)",
                "line",
                chk(
                    "limit",
                    ["2"],
                    [(["-inf"], "Une fonction qui décroît de \\(+\\infty\\) peut s'arrêter vers une valeur finie : reprends la limite en \\(+\\infty\\).")],
                    "Oui : \\(g\\) décroît de \\(+\\infty\\) vers 2 sans jamais l'atteindre.",
                    "Reprends la limite de \\(g\\) en \\(+\\infty\\).",
                ),
            ),
        ],
        "hints": [
            "Un carré est positif ; le signe de la dérivée est donc celui du numérateur.",
            "Dans le tableau, on remplit chaque intervalle avec ses propres limites aux bornes.",
        ],
        "takeaway": "Une dérivée négative sur un intervalle : la fonction décroît sur cet intervalle. Quand le domaine a une valeur interdite, on étudie chaque intervalle séparément et on ne traverse jamais la valeur interdite dans le tableau.",
        "tests": [],
    }
)

# ───────────────────────────── 7. Étude complète ─────────────────────────────
steps.append(
    {
        "id": "etude",
        "short": "Étude",
        "title": "Étude complète de g : tout assembler",
        "minutes": 15,
        "level": "Synthèse",
        "concepts": ["domaine", "limites", "asymptotes", "dérivée", "variations", "tangente", "cohérence graphique"],
        "intro": "Tu as tous les morceaux. Il s'agit maintenant de les relier entre eux et de les confronter au graphique.",
        "lesson": (
            "<p>Voici la fiche d'étude de \\(g(x)=\\dfrac{2x+1}{x-1}\\), que tu as construite étape par étape :</p>"
            + table(
                ["Étape", "Résultat établi"],
                [
                    ["1. Domaine", "\\(D_g=\\mathbb R\\setminus\\{1\\}\\)"],
                    ["2. Limites en 1", "\\(\\lim_{x\\to1^-}g=-\\infty\\) ; \\(\\lim_{x\\to1^+}g=+\\infty\\)"],
                    ["3. Asymptote verticale", "\\(x=1\\)"],
                    ["4. Limites à l'infini", "\\(\\lim_{x\\to\\pm\\infty}g=2\\)"],
                    ["5. Asymptote horizontale", "\\(y=2\\)"],
                    ["6–7. Dérivée et signe", "\\(g'(x)=\\dfrac{-3}{(x-1)^2}\\lt0\\)"],
                    ["8. Variations", "décroissante sur \\(]-\\infty\\,;1[\\) puis sur \\(]1\\,;+\\infty[\\)"],
                    ["9. Tangente en 0", "\\(y=-3x-1\\)"],
                ],
            )
            + "<p>Un bon mathématicien ne se contente pas d'empiler des résultats : il les fait <strong>se contrôler les uns les autres</strong>. À toi.</p>"
            "<h4>Contrôle 1 — le domaine, source de tout</h4>"
            "{{q:dom}}"
            "<h4>Contrôle 2 — les quatre limites ensemble</h4>"
            "<p>Un élève propose quatre jeux de limites pour \\(g\\). Un seul est cohérent avec toute l'étude.</p>"
            "{{q:bornes}}"
            "<h4>Contrôle 3 — où est la courbe par rapport à son asymptote ?</h4>"
            "<p>On calcule \\(g(x)-2=\\dfrac{2x+1-2(x-1)}{x-1}=\\dfrac{3}{x-1}\\).</p>"
            "{{q:position}}"
            "<h4>Contrôle 4 — un point que le graphique doit confirmer</h4>"
            "{{f:zero}}"
            "{{fig:g-etude}}"
            "{{q:coherence}}"
            "<h4>Conclusion rédigée</h4>"
            "{{f:variations}}"
        ),
        "task": "Réponds aux contrôles, regarde la figure, puis rédige ta conclusion.",
        "starter": None,
        "figures": [
            {
                "type": "function",
                "id": "g-etude",
                "caption": "Vision d'ensemble de \\(g\\) : asymptotes \\(x=1\\) et \\(y=2\\), point A et tangente en 0.",
                "curveLabel": "courbe de g",
                "fn": G,
                "window": {"xmin": -6, "xmax": 8, "ymin": -8, "ymax": 12},
                "verticalAsymptotes": [1],
                "horizontalAsymptotes": [2],
                "tangentAt": 0,
                "points": [{"x": 0, "label": "A"}],
            }
        ],
        "questions": [
            q(
                "dom",
                "Quel est l'ensemble de définition de \\(g\\) ?",
                ["\\(\\mathbb R\\)", "\\(\\mathbb R\\setminus\\{1\\}\\)", "\\(\\mathbb R\\setminus\\{-\\frac12\\}\\)", "\\(]1\\,;+\\infty[\\)"],
                1,
                "Un quotient est défini quand son dénominateur est non nul : \\(x-1\\ne0\\iff x\\ne1\\).",
                [
                    "Le dénominateur s'annule en 1 : la fonction n'y est pas définie.",
                    "",
                    "\\(-\\frac12\\) annule le numérateur (\\(2x+1=0\\)), ce qui est permis. Ce qui est interdit, c'est d'annuler le dénominateur.",
                    "La fonction est aussi définie pour \\(x\\lt1\\) (par exemple \\(g(0)=-1\\)).",
                ],
            ),
            q(
                "bornes",
                "Quel jeu de limites est cohérent avec l'étude de \\(g\\) ?",
                [
                    "\\(\\lim_{1^-}=-\\infty\\) ; \\(\\lim_{1^+}=+\\infty\\) ; \\(\\lim_{+\\infty}=2\\) ; \\(\\lim_{-\\infty}=2\\)",
                    "\\(\\lim_{1^-}=+\\infty\\) ; \\(\\lim_{1^+}=-\\infty\\) ; \\(\\lim_{+\\infty}=2\\) ; \\(\\lim_{-\\infty}=2\\)",
                    "\\(\\lim_{1^-}=-\\infty\\) ; \\(\\lim_{1^+}=+\\infty\\) ; \\(\\lim_{+\\infty}=2\\) ; \\(\\lim_{-\\infty}=-2\\)",
                    "\\(\\lim_{1^-}=+\\infty\\) ; \\(\\lim_{1^+}=+\\infty\\) ; \\(\\lim_{+\\infty}=2\\) ; \\(\\lim_{-\\infty}=2\\)",
                ],
                0,
                "Le dénominateur change de signe en 1 (donc les deux limites en 1 sont de signes contraires) et \\(\\frac1x\\to0\\) aux deux extrémités (donc la même limite 2 en \\(\\pm\\infty\\)).",
                [
                    "",
                    "Les signes sont inversés : pour \\(x\\lt1\\), \\(x-1\\) est négatif et le numérateur est positif.",
                    "En \\(-\\infty\\), \\(\\frac1x\\) tend aussi vers 0 : la limite est 2, pas −2.",
                    "Le dénominateur \\(x-1\\) est de signe contraire de part et d'autre de 1 (il n'est pas élevé au carré) : les deux limites en 1 sont de signes contraires.",
                ],
            ),
            q(
                "position",
                "Avec \\(g(x)-2=\\dfrac3{x-1}\\), la courbe de \\(g\\) est…",
                [
                    "au-dessus de la droite \\(y=2\\) pour \\(x\\gt1\\), en dessous pour \\(x\\lt1\\)",
                    "toujours au-dessus de la droite \\(y=2\\)",
                    "au-dessus de la droite \\(y=2\\) pour \\(x\\lt1\\), en dessous pour \\(x\\gt1\\)",
                    "confondue avec la droite \\(y=2\\)",
                ],
                0,
                "Le signe de \\(g(x)-2\\) est celui de \\(x-1\\) : positif pour \\(x\\gt1\\) (courbe au-dessus de \\(y=2\\)), négatif pour \\(x\\lt1\\) (en dessous). Remarque : \\(g(x)=2\\) n'a jamais de solution, la courbe ne coupe pas son asymptote.",
                [
                    "",
                    "\\(\\frac3{x-1}\\) change de signe en 1 : ce n'est pas toujours positif.",
                    "Tu as inversé : pour \\(x\\gt1\\), \\(x-1\\gt0\\) donc \\(\\frac3{x-1}\\gt0\\).",
                    "Si elles étaient confondues, \\(g(x)-2\\) vaudrait 0 : or elle vaut \\(\\frac3{x-1}\\ne0\\).",
                ],
            ),
            q(
                "coherence",
                "Laquelle de ces affirmations sur le graphique est INCOMPATIBLE avec l'étude ?",
                [
                    "La courbe passe par le point \\((0\\,;-1)\\)",
                    "La courbe coupe la droite d'équation \\(x=1\\)",
                    "La courbe est au-dessus de \\(y=2\\) pour \\(x\\gt1\\)",
                    "La tangente en 0 descend quand on avance vers la droite",
                ],
                1,
                "\\(x=1\\) est une valeur interdite : aucun point de la courbe n'a pour abscisse 1. La courbe ne peut donc pas couper cette droite.",
                [
                    "Compatible : \\(g(0)=-1\\).",
                    "",
                    "Compatible : c'est le contrôle 3.",
                    "Compatible : \\(g'(0)=-3\\lt0\\).",
                ],
            ),
        ],
        "fields": [
            f(
                "zero",
                "En quelle abscisse la courbe coupe-t-elle l'axe des abscisses ? (résous \\(g(x)=0\\))",
                "Un nombre",
                "line",
                chk(
                    "number",
                    ["-1/2"],
                    [
                        (["1/2", "0,5"], "Résous \\(2x+1=0\\) : \\(2x=-1\\). Attention au signe."),
                        (["-1"], "−1 est \\(g(0)\\), l'ordonnée à l'origine. Ici on cherche l'abscisse où \\(g(x)=0\\) : il faut \\(2x+1=0\\)."),
                        (["1"], "En \\(x=1\\), la fonction n'est pas définie. Un quotient est nul quand son numérateur est nul : \\(2x+1=0\\)."),
                    ],
                    "Oui : un quotient est nul quand son numérateur l'est : \\(2x+1=0\\iff x=-\\frac12\\). Vérifie sur la figure : la courbe traverse bien l'axe des abscisses entre −1 et 0.",
                    "Un quotient est nul quand son numérateur est nul (et son dénominateur non nul).",
                ),
            ),
            f(
                "variations",
                "Rédige en deux phrases la conclusion sur les variations de \\(g\\), en précisant les intervalles et les limites aux bornes.",
                "g est strictement … sur … ; elle … de … vers …",
                "area",
            ),
        ],
        "hints": [
            "Si deux résultats de ton étude se contredisent, l'un des deux est faux : reviens au signe du dénominateur.",
            "Pour la position relative, étudie le signe de \\(g(x)-2=\\dfrac{3}{x-1}\\).",
            "Pour la rédaction : « sur chaque intervalle, \\(g'\\lt0\\) donc \\(g\\) est strictement décroissante ; elle passe de … à … ».",
        ],
        "takeaway": "Une étude de fonction n'est pas une liste : le domaine explique les asymptotes verticales, les limites en l'infini les horizontales, le signe de la dérivée les variations. Chaque résultat doit être compatible avec les autres et avec le graphique.",
        "tests": [],
    }
)

# ───────────────────────────── 8. Autonomie ─────────────────────────────
steps.append(
    {
        "id": "autonome",
        "short": "Autonomie",
        "title": "À toi : une autre fonction",
        "minutes": 14,
        "level": "Transfert",
        "concepts": ["fonction rationnelle à deux pôles", "limites latérales", "asymptotes", "dérivée", "tangente"],
        "intro": "Même démarche, autre fonction : deux valeurs interdites cette fois. Je te laisse mener l'étude.",
        "lesson": (
            "<p>Soit \\[k(x)=\\frac{2x^2-3x}{x^2-1}.\\]</p>"
            "<p>Pour t'organiser : (1) domaine, (2) limite en \\(1^-\\) et conséquence, (3) limite en \\(+\\infty\\), (4) asymptotes, (5) dérivée et sens de variation, (6) tangente en 0.</p>"
            "<p><em>Le graphique n'est volontairement affiché qu'à la fin : ne triche pas, calcule d'abord.</em></p>"
            "{{q:dom-k}}"
            "<p>Étude en \\(1\\) : au numérateur, \\(2\\times1^2-3\\times1=-1\\) (négatif). Au dénominateur, \\(x^2-1=(x-1)(x+1)\\).</p>"
            "{{f:k-1m}}{{f:k-inf}}{{q:k-asym}}"
            "<p>La dérivée de \\(k=\\dfrac uv\\), avec \\(u=2x^2-3x\\) et \\(v=x^2-1\\), s'écrit \\(\\dfrac{u'v-uv'}{v^2}\\) avec \\(u'=4x-3\\), \\(v'=2x\\).</p>"
            "{{q:k-prime}}"
            "<p>Le numérateur est \\(3x^2-4x+3\\), un trinôme de discriminant \\(\\Delta=(-4)^2-4\\times3\\times3=-20\\).</p>"
            "{{q:k-signe}}"
            "{{f:k-tan}}"
            "{{fig:k-fig}}"
        ),
        "task": "Mène l'étude de \\(k\\) en suivant les six étapes, puis compare à la figure.",
        "starter": None,
        "figures": [
            {
                "type": "function",
                "id": "k-fig",
                "caption": "Courbe de \\(k\\) : deux asymptotes verticales (\\(x=-1\\), \\(x=1\\)), une horizontale (\\(y=2\\)), et la tangente en 0.",
                "curveLabel": "courbe de k",
                "fn": K,
                "window": {"xmin": -6, "xmax": 6, "ymin": -8, "ymax": 10},
                "verticalAsymptotes": [-1, 1],
                "horizontalAsymptotes": [2],
                "tangentAt": 0,
                "points": [{"x": 0, "label": "O'"}],
            }
        ],
        "questions": [
            q(
                "dom-k",
                "Quel est l'ensemble de définition de \\(k\\) ?",
                ["\\(\\mathbb R\\setminus\\{1\\}\\)", "\\(\\mathbb R\\setminus\\{-1\\,;1\\}\\)", "\\(\\mathbb R\\setminus\\{0\\}\\)", "\\(\\mathbb R\\)"],
                1,
                "\\(x^2-1=0\\iff x=1\\) ou \\(x=-1\\) : deux valeurs interdites.",
                [
                    "Il manque une valeur : \\(x^2-1=(x-1)(x+1)\\) s'annule aussi en \\(-1\\).",
                    "",
                    "0 n'annule pas le dénominateur : \\(0^2-1=-1\\).",
                    "Le dénominateur s'annule : il y a des valeurs interdites.",
                ],
            ),
            q(
                "k-asym",
                "Que peut-on affirmer pour les asymptotes de la courbe de \\(k\\) ? (Raisonne de la même façon en \\(-1\\) : numérateur \\(2+3=5\\gt0\\), dénominateur \\(0^\\pm\\).)",
                [
                    "Verticales \\(x=1\\) et \\(x=-1\\) ; horizontale \\(y=2\\)",
                    "Verticale \\(x=1\\) seulement ; horizontale \\(y=2\\)",
                    "Verticales \\(x=1\\) et \\(x=-1\\) ; aucune horizontale",
                    "Horizontale \\(y=2\\) seulement",
                ],
                0,
                "Au voisinage de 1 et de \\(-1\\) le numérateur est non nul et le dénominateur tend vers 0 : les limites sont infinies, donc deux asymptotes verticales. En \\(\\pm\\infty\\), \\(k(x)\\to2\\) : asymptote horizontale \\(y=2\\).",
                [
                    "",
                    "En \\(-1\\) aussi le dénominateur s'annule avec un numérateur non nul (égal à 5) : il y a une seconde asymptote verticale.",
                    "Tu as calculé que \\(k(x)\\to2\\) en l'infini : cela donne l'horizontale.",
                    "Les limites infinies en \\(\\pm1\\) donnent aussi des asymptotes verticales.",
                ],
            ),
            q(
                "k-prime",
                "Quelle est la dérivée de \\(k\\) ?",
                [
                    "\\(k'(x)=\\dfrac{3x^2-4x+3}{(x^2-1)^2}\\)",
                    "\\(k'(x)=\\dfrac{4x-3}{2x}\\)",
                    "\\(k'(x)=\\dfrac{-3x^2+4x-3}{(x^2-1)^2}\\)",
                    "\\(k'(x)=\\dfrac{(4x-3)(x^2-1)+(2x^2-3x)(2x)}{(x^2-1)^2}\\)",
                ],
                0,
                "\\(u'v-uv'=(4x-3)(x^2-1)-(2x^2-3x)(2x)=4x^3-4x-3x^2+3-4x^3+6x^2=3x^2-4x+3\\).",
                [
                    "",
                    "La dérivée d'un quotient n'est pas le quotient des dérivées : la formule est \\(\\frac{u'v-uv'}{v^2}\\).",
                    "Vérifie le signe global : développe bien \\((4x-3)(x^2-1)-(2x^2-3x)(2x)\\).",
                    "Il y a un « moins » entre les deux produits dans \\(u'v-uv'\\), pas un « plus ».",
                ],
            ),
            q(
                "k-signe",
                "Le trinôme \\(3x^2-4x+3\\) (discriminant \\(-20\\)) est…",
                ["toujours strictement positif", "toujours strictement négatif", "positif puis négatif", "nul en deux points"],
                0,
                "\\(\\Delta\\lt0\\) : pas de racine réelle, donc un signe constant, celui du coefficient de \\(x^2\\) (ici \\(3\\gt0\\)). Ainsi \\(k'(x)\\gt0\\) : \\(k\\) est strictement croissante sur chacun des trois intervalles \\(]-\\infty\\,;-1[\\), \\(]-1\\,;1[\\), \\(]1\\,;+\\infty[\\).",
                [
                    "",
                    "Le coefficient de \\(x^2\\) est \\(+3\\) : un trinôme sans racine a le signe de ce coefficient.",
                    "Un changement de signe exige des racines réelles, or \\(\\Delta\\lt0\\).",
                    "Un trinôme s'annule en ses racines réelles : ici il n'y en a pas, car \\(\\Delta\\lt0\\).",
                ],
            ),
        ],
        "fields": [
            f(
                "k-1m",
                "\\(\\lim_{x\\to1^-}k(x)=\\) ? (numérateur proche de \\(-1\\) ; signe de \\(x^2-1=(x-1)(x+1)\\) pour \\(x\\lt1\\) proche de 1 ?)",
                "\\(+\\infty\\) ou \\(-\\infty\\)",
                "line",
                chk(
                    "limit",
                    ["+inf"],
                    [
                        (["-inf"], "Numérateur proche de \\(-1\\) (négatif). Dénominateur \\((x-1)(x+1)\\) pour \\(x\\lt1\\) proche de 1 : \\(x-1\\lt0\\) et \\(x+1\\gt0\\). Que donne « négatif divisé par négatif » ?"),
                        (["-1", "0"], "−1 est la limite du numérateur seulement. Le dénominateur tend vers 0 : le quotient devient très grand en valeur absolue."),
                    ],
                    "Oui : numérateur négatif, dénominateur négatif proche de 0 : le quotient est positif et tend vers \\(+\\infty\\).",
                    "Étudie le signe du numérateur (proche de \\(-1\\)) et celui du dénominateur pour \\(x\\lt1\\).",
                ),
            ),
            f(
                "k-inf",
                "\\(\\lim_{x\\to+\\infty}k(x)=\\) ?",
                "Un nombre ou \\(\\pm\\infty\\)",
                "line",
                chk(
                    "limit",
                    ["2"],
                    [
                        (["inf/inf", "∞/∞"], "\\(\\dfrac\\infty\\infty\\) est une forme indéterminée, ce n'est pas le résultat : mets \\(x^2\\) en facteur en haut et en bas."),
                        (["+inf"], "Haut et bas ont même degré : compare les coefficients de \\(x^2\\)."),
                        (["0"], "0 demanderait un dénominateur de plus haut degré que le numérateur. Ici les degrés sont égaux."),
                        (["1", "-2", "3"], "Les termes dominants sont \\(2x^2\\) en haut et \\(x^2\\) en bas : leur quotient donne la limite."),
                    ],
                    "Oui : \\(k(x)=\\dfrac{2-\\frac3x}{1-\\frac1{x^2}}\\to2\\).",
                    "Mets \\(x^2\\) en facteur au numérateur et au dénominateur, puis simplifie.",
                ),
            ),
            f(
                "k-tan",
                "Équation de la tangente à la courbe de \\(k\\) au point d'abscisse 0. (Indication : \\(k(0)=0\\) et \\(k'(0)=\\dfrac{3}{(0-1)^2}\\).)",
                "Sous la forme y = ax + b",
                "line",
                chk(
                    "linear",
                    ["y=3x"],
                    [
                        (["y=-3x"], "Signe : \\(k'(0)=\\dfrac{3\\times0-4\\times0+3}{(0-1)^2}=\\dfrac31=3\\)."),
                        (["y=0"], "La tangente est horizontale seulement si \\(k'(0)=0\\). Ici \\(k'(0)=3\\)."),
                        (["y=3x+1", "y=3x-1"], "L'ordonnée à l'origine est \\(k(0)=0\\), pas 1."),
                    ],
                    "Oui : \\(T_0:\\ y=k(0)+k'(0)(x-0)=3x\\).",
                    "Applique \\(y=f(a)+f'(a)(x-a)\\) avec \\(a=0\\), \\(k(0)=0\\), \\(k'(0)=3\\).",
                ),
            ),
        ],
        "hints": [
            "Pour la limite en \\(1^-\\) : écris le signe du numérateur, puis celui de chaque facteur du dénominateur pour \\(x\\lt1\\).",
            "Pour la dérivée : calcule d'abord \\(u'v\\) et \\(uv'\\) séparément, puis soustrais. Les termes en \\(x^3\\) s'annulent.",
            "Le trinôme \\(3x^2-4x+3\\) n'a pas de racine réelle : son signe est constant.",
            "Pour la tangente : \\(k(0)=0\\) et \\(k'(0)=3\\), donc la tangente passe par l'origine.",
        ],
        "takeaway": "La même démarche s'applique à toute fonction rationnelle : domaine, limites aux valeurs interdites (par les signes), limites en l'infini (terme prépondérant), dérivée et son signe, tangente.",
        "tests": [],
    }
)

# ───────────────────────────── 9. Méthodes à retenir ─────────────────────────────
steps.append(
    {
        "id": "methodes",
        "short": "Méthodes",
        "title": "Ma fiche méthode",
        "minutes": 5,
        "level": "Synthèse",
        "concepts": ["fiche méthode", "asymptotes", "tangente"],
        "intro": "Voici la fiche à garder. Tu peux l'imprimer avec le bouton prévu à cet effet.",
        "lesson": (
            "<h3>Fiche méthode — Limites, asymptotes et tangentes</h3>"
            "<h4>Quotient de polynômes à l'infini</h4>"
            "<p>On met en facteur le terme de plus haut degré au numérateur et au dénominateur, on simplifie, puis les fractions en \\(\\frac1x\\) tendent vers 0. "
            "Exemple : \\(\\dfrac{2x^2-3x+1}{x^2+4}\\to2\\). Une forme \\(\\dfrac\\infty\\infty\\) n'est jamais un résultat.</p>"
            "<h4>Asymptote verticale</h4>"
            "<p>Si \\[\\lim_{x\\to a^-}f(x)=\\pm\\infty\\quad\\text{ou}\\quad\\lim_{x\\to a^+}f(x)=\\pm\\infty,\\] alors la droite \\(x=a\\) est asymptote verticale. "
            "On détermine le signe du quotient à gauche et à droite de \\(a\\). Un dénominateur nul ne suffit pas : \\(\\dfrac{x^2-1}{x-1}\\) n'a pas d'asymptote en 1.</p>"
            "<h4>Asymptote horizontale</h4>"
            "<p>Si \\[\\lim_{x\\to+\\infty}f(x)=\\ell\\quad\\text{ou}\\quad\\lim_{x\\to-\\infty}f(x)=\\ell,\\] alors la droite \\(y=\\ell\\) est asymptote horizontale dans la direction considérée. "
            "La courbe peut couper son asymptote.</p>"
            "<h4>Tangente en \\(a\\)</h4>"
            "<p>\\[T_a:\\ y=f(a)+f'(a)(x-a).\\] \\(f(a)\\) est l'ordonnée du point, \\(f'(a)\\) la pente. "
            "Avec \\(g(x)=\\dfrac{2x+1}{x-1}\\) : \\(g'(x)=\\dfrac{-3}{(x-1)^2}\\), \\(T_0:\\ y=-3x-1\\).</p>"
            "<h4>Variations</h4>"
            "<p>Le signe de \\(f'\\) donne le sens de variation, intervalle par intervalle ; on ne traverse jamais une valeur interdite.</p>"
            "{{f:retenir}}"
        ),
        "task": "Lis la fiche, puis écris la méthode que tu risques le plus d'oublier.",
        "starter": None,
        "printable": True,
        "figures": [],
        "questions": [],
        "fields": [
            f(
                "retenir",
                "Quelle est, pour toi, l'erreur la plus facile à commettre dans ce chapitre ? Écris-la, avec la façon de l'éviter.",
                "L'erreur : … Pour l'éviter : …",
                "area",
            )
        ],
        "hints": [],
        "takeaway": "Calcul, graphique et sens vont ensemble : limite ↔ asymptote ; dérivée ↔ variations ↔ tangente.",
        "tests": [],
    }
)

# ───────────────────────────── Bonus ─────────────────────────────
steps.append(
    {
        "id": "bonus",
        "short": "Approfondissement",
        "title": "Approfondissement : une asymptote oblique",
        "minutes": 0,
        "level": "Approfondissement (facultatif, hors durée)",
        "concepts": ["asymptote oblique"],
        "intro": "Facultatif : si tu as terminé, voici un cas où la courbe se rapproche d'une droite qui n'est ni verticale ni horizontale.",
        "lesson": (
            "<p>Soit \\(m(x)=\\dfrac{x^2+x+1}{x}\\). Pour \\(x\\ne0\\), \\[m(x)=x+1+\\frac1x.\\] "
            "Quand \\(x\\to\\pm\\infty\\), \\(\\dfrac1x\\to0\\) : l'écart entre la courbe et la droite \\(y=x+1\\) devient aussi petit qu'on veut, car \\[m(x)-(x+1)=\\frac1x\\to0.\\] "
            "Une droite \\(y=ax+b\\) telle que \\(\\lim\\bigl(f(x)-(ax+b)\\bigr)=0\\) est une <strong>asymptote oblique</strong>.</p>"
            "{{f:bonus-ab}}{{fig:bonus-fig}}"
        ),
        "task": "Trouve la droite \\(y=ax+b\\) telle que \\(m(x)-(ax+b)\\to0\\).",
        "starter": None,
        "figures": [
            {
                "type": "function",
                "id": "bonus-fig",
                "caption": "Courbe de \\(m\\) et ta droite (pointillés rouges) : elles se rejoignent loin du centre.",
                "curveLabel": "courbe de m",
                "fn": M,
                "window": {"xmin": -6, "xmax": 6, "ymin": -8, "ymax": 8},
                "verticalAsymptotes": [0],
                "overlayFieldId": "bonus-ab",
            }
        ],
        "questions": [],
        "fields": [
            f(
                "bonus-ab",
                "Équation de l'asymptote oblique de la courbe de \\(m\\).",
                "Sous la forme y = ax + b",
                "line",
                chk(
                    "linear",
                    ["y=x+1"],
                    [
                        (["y=x"], "Presque : \\(m(x)-x=1+\\frac1x\\to1\\), pas 0. Il manque une constante."),
                        (["y=1", "y=x-1", "y=-x+1"], "Cherche \\(a\\) et \\(b\\) pour que \\(m(x)-(ax+b)=\\frac1x\\) : lis la décomposition \\(x+1+\\frac1x\\)."),
                    ],
                    "Oui : \\(m(x)-(x+1)=\\frac1x\\to0\\) : la droite \\(y=x+1\\) est asymptote oblique.",
                    "Écris \\(m(x)=x+1+\\frac1x\\) et repère la partie qui tend vers 0.",
                ),
            )
        ],
        "hints": ["Dans \\(x+1+\\frac1x\\), la partie \\(\\frac1x\\) tend vers 0 : que reste-t-il ?"],
        "takeaway": "Asymptote oblique : \\(y=ax+b\\) avec \\(\\lim\\bigl(f(x)-(ax+b)\\bigr)=0\\). C'est un approfondissement : il n'est pas exigible dans cette séance.",
        "tests": [],
    }
)

content = {
    "version": "1.0.0",
    "title": "Fonctions, limites et lecture graphique",
    "subtitle": "Limites · asymptotes · dérivation · variations · tangentes",
    "session": "Mathématiques • Terminale",
    "duration": sum(s["minutes"] for s in steps),
    "ui": {"phases": True},
    "steps": steps,
}

out = HERE / "content.json"
out.write_text(json.dumps(deep(content), ensure_ascii=False, indent=1) + "\n", encoding="utf-8")
print(f"{out} : {len(steps)} étapes, durée {content['duration']} min")
