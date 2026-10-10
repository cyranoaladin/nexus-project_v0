#!/usr/bin/env python3
"""Génère content.json du parcours « Le second degré » (Mathématiques, Première générale).

Source de rédaction du contenu : on édite CE fichier puis on relance
`python3 content/espace/maths-second-degre/generate.py`. Le JSON produit est ce que lit l'application.
Les formules s'écrivent \\( … \\) (en ligne) et \\[ … \\] (centrées) ; on évite < et > dans les formules
(\\lt, \\gt) pour que le HTML reste valide. La typographie française (espaces insécables) est appliquée
automatiquement HORS formules et HORS balises.

Réponses attendues : jamais recopiées à la main depuis le texte — elles sont recalculées
indépendamment par __tests__/lib/espace/maths-second-degre-content.test.ts (Δ, racines, sommets,
valeurs), de sorte qu'une erreur de calcul dans ce fichier fait échouer la CI.
"""
import json
import pathlib
import re

HERE = pathlib.Path(__file__).parent
NNBSP = "\u202f"
NBSP = "\u00a0"
_SPLIT = re.compile(r"(\\\(.*?\\\)|\\\[.*?\\\]|<[^>]+>|\{\{[^}]*\}\})", re.S)


def fr(s: str) -> str:
    # Les chaînes brutes (r"…") ne décodent pas \u202f / \u00a0 : on les résout ici.
    s = s.replace("\\u202f", NNBSP).replace("\\u00a0", NBSP)
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


CELL = 'style="border:1px solid currentColor;padding:.25rem .6rem;text-align:center"'


def table(header, rows):
    head = "".join(f"<th {CELL}>{h}</th>" for h in header)
    body = "".join("<tr>" + "".join(f"<td {CELL}>{c}</td>" for c in r) + "</tr>" for r in rows)
    return f'<table style="border-collapse:collapse;margin:.5rem 0;"><thead><tr>{head}</tr></thead><tbody>{body}</tbody></table>'


def box(title, html):
    return f'<div class="method-box"><p><strong>{title}</strong></p>{html}</div>'


def q(id, text, choices, correct, feedback, choice_feedback):
    assert len(choice_feedback) == len(choices), id
    return {"id": id, "text": text, "choices": choices, "correct": correct, "feedback": feedback, "choiceFeedback": choice_feedback}


def f(id, label, placeholder="", input="line", check=None):
    d = {"id": id, "label": label}
    if placeholder:
        d["placeholder"] = placeholder
    d["input"] = input
    if check:
        d["check"] = check
    return d


def chk(kind, accept, success, fallback, solution, rules=None):
    d = {"kind": kind, "accept": accept, "success": success, "fallback": fallback, "solution": solution}
    if rules:
        d["rules"] = [{"when": w, "feedback": fb} for w, fb in rules]
    return d


def poly(coeffs):
    return {"kind": "polynomial", "coeffs": coeffs}


def fig(id, caption, label, coeffs, window, points=None):
    d = {"type": "function", "id": id, "caption": caption, "curveLabel": label, "fn": poly(coeffs), "window": window}
    if points:
        d["points"] = points
    return d


steps = []

# ───────────────────────── 0. Diagnostic ─────────────────────────
steps.append(
    {
        "id": "diagnostic",
        "short": "Reconnaître",
        "title": "Reconnaître un trinôme du second degré",
        "minutes": 8,
        "level": "Diagnostic (non noté)",
        "concepts": ["fonction polynôme du second degré", "parabole", "coefficients a, b, c", "lecture graphique"],
        "intro": "Avant de calculer, on regarde. Ces questions ne sont pas notées : elles servent à voir d'où tu pars. Tu peux vérifier chaque réponse tout de suite.",
        "lesson": (
            r"<p>Une fonction du second degré s'écrit \(f(x)=ax^2+bx+c\) avec \(a\ne0\). Sa courbe est une <strong>parabole</strong>. "
            r"Voici la courbe de \(f(x)=x^2-2x-3\).</p>{{fig:diag}}"
            r"<p>Observe-la : où coupe-t-elle les axes ? vers où sont tournées ses branches ?</p>"
            r"{{q:type}}{{q:abc}}{{q:sens}}{{f:f0}}{{f:lecture}}"
        ),
        "task": "Réponds aux questions, puis clique sur « Je vérifie » pour contrôler tes réponses écrites.",
        "starter": None,
        "figures": [
            fig("diag", r"Courbe de \(f(x)=x^2-2x-3\).", "courbe de f", [-3, -2, 1], {"xmin": -4, "xmax": 5, "ymin": -5, "ymax": 6}),
        ],
        "questions": [
            q(
                "type",
                r"Laquelle de ces fonctions est une fonction du second degré ?",
                [r"Fonction \(f\) définie par \(f(x)=3x-2\)", r"Fonction \(g\) définie par \(g(x)=(x-1)^2+4\)", r"Fonction \(h\) définie par \(h(x)=x^3-x\)", r"Fonction \(k\) définie par \(k(x)=\dfrac{1}{x^2}\)"],
                1,
                r"En développant, \(g(x)=x^2-2x+5\) : c'est bien de la forme \(ax^2+bx+c\) avec \(a=1\ne0\).",
                [
                    r"C'est une fonction affine (degré 1) : il n'y a pas de terme en \(x^2\).",
                    "",
                    r"Le plus grand exposant est 3 : c'est une fonction du troisième degré.",
                    r"\(x\) est au dénominateur : ce n'est pas un polynôme.",
                ],
            ),
            q(
                "abc",
                r"Pour \(p(x)=2x^2-5x+1\), quelles sont les valeurs de \(a\), \(b\), \(c\) ?",
                ["a = 2, b = −5, c = 1", "a = 2, b = 5, c = 1", "a = −5, b = 2, c = 1", "a = 1, b = −5, c = 2"],
                0,
                r"\(a\) est devant \(x^2\), \(b\) devant \(x\), \(c\) est le terme constant. Le signe fait partie du coefficient : \(b=-5\).",
                [
                    "",
                    r"Regarde le signe : le terme est \(-5x\), donc \(b=-5\) et non \(5\).",
                    r"Les coefficients se lisent dans l'ordre \(x^2\), puis \(x\), puis la constante.",
                    r"Le coefficient de \(x^2\) est 2 : c'est \(a\), pas \(c\).",
                ],
            ),
            q(
                "sens",
                r"Vers quel côté sont tournées les branches de la parabole de \(f\) ?",
                ["Vers le haut", "Vers le bas", "On ne peut pas le savoir sans calcul"],
                0,
                r"Les branches montent : ici \(a=1\gt0\). Si \(a\) était négatif, la parabole serait tournée vers le bas.",
                [
                    "",
                    r"Regarde les deux extrémités de la courbe : elles montent, elles ne descendent pas.",
                    r"Le sens se voit directement sur la courbe, et il dépend uniquement du signe de \(a\).",
                ],
            ),
        ],
        "fields": [
            f(
                "f0",
                r"Calcule \(f(0)\).",
                "Un nombre",
                "line",
                chk(
                    "number",
                    ["-3"],
                    r"Oui : \(f(0)=0-0-3=-3\). C'est l'ordonnée du point où la courbe coupe l'axe des ordonnées, et c'est toujours le coefficient \(c\).",
                    r"Remplace \(x\) par 0 dans \(x^2-2x-3\), puis calcule : que reste-t-il ?",
                    r"\(f(0)=0^2-2\times0-3=-3\). On retrouve le point \((0\,;-3)\) de la courbe.",
                    [(["3"], r"Attention au signe : le terme constant est \(-3\), donc \(f(0)=-3\).")],
                ),
            ),
            f(
                "lecture",
                r"Lis sur la courbe les abscisses des points où elle coupe l'axe des abscisses.",
                "Par exemple : 1 ; 4",
                "line",
                chk(
                    "set",
                    ["-1;3"],
                    r"Oui : la courbe coupe l'axe en \(x=-1\) et en \(x=3\). Ces deux nombres sont les <strong>racines</strong> de \(f\) : c'est le sujet de la prochaine étape.",
                    r"Cherche les deux points où la courbe touche l'axe horizontal, puis lis leur position horizontale (avec son signe).",
                    r"La courbe coupe l'axe des abscisses aux points \((-1\,;0)\) et \((3\,;0)\) : les abscisses sont \(-1\) et \(3\).",
                    [(["1;-3"], r"Les signes sont inversés : le point de gauche est à gauche de l'axe des ordonnées, donc son abscisse est négative.")],
                ),
            ),
        ],
        "hints": [
            r"Pour \(f(0)\), toute puissance de \(x\) disparaît : il ne reste que le terme constant.",
            r"Une racine est une abscisse : tu lis la position horizontale du point sur l'axe.",
        ],
        "takeaway": r"Une fonction du second degré s'écrit \(ax^2+bx+c\) avec \(a\ne0\) ; sa courbe est une parabole, tournée vers le haut si \(a\gt0\), vers le bas si \(a\lt0\). Elle coupe l'axe des ordonnées en \(c\).",
        "tests": [],
    }
)

# ───────────────────────── 1. Racines ─────────────────────────
steps.append(
    {
        "id": "racines",
        "short": "Racines",
        "title": "Racines d'un trinôme et factorisation",
        "minutes": 10,
        "level": "Découverte",
        "concepts": ["racine", "produit nul", "factorisation", "racine évidente"],
        "intro": "Une racine, c'est une valeur de \\(x\\) qui annule le trinôme. Les racines sont la clé de la factorisation.",
        "lesson": (
            r"<p>Un réel \(r\) est une <strong>racine</strong> de \(f\) si \(f(r)=0\). Graphiquement, c'est l'abscisse d'un point où la courbe coupe l'axe des abscisses.</p>"
            r"<p>Pour tester si un nombre est racine, on <em>remplace</em> \(x\) par ce nombre et on regarde si le résultat est 0. "
            r"Par exemple pour \(p(x)=x^2-7x+10\) : \(p(1)=1-7+10=4\ne0\), donc 1 n'est pas une racine.</p>"
            r"{{q:test}}"
            + box(
                "Produit nul",
                r"<p>Un produit est nul si, et seulement si, <strong>l'un de ses facteurs est nul</strong> : \[A\times B=0\iff A=0\ \text{ou}\ B=0.\]</p>"
                r"<p>Donc pour résoudre une équation, on cherche d'abord à la <em>factoriser</em> : facteur commun, identité remarquable \(a^2-b^2=(a-b)(a+b)\), ou racine connue.</p>",
            )
            + r"<p>Si \(x_1\) et \(x_2\) sont des racines de \(ax^2+bx+c\), alors \[ax^2+bx+c=a(x-x_1)(x-x_2).\]</p>"
            r"{{f:produit-nul}}{{f:commun}}{{f:ident}}{{f:factorise}}"
        ),
        "task": "Teste une racine, résous trois équations déjà factorisables, puis factorise un trinôme à partir de ses racines.",
        "starter": None,
        "figures": [],
        "questions": [
            q(
                "test",
                r"Le nombre 5 est-il une racine de \(p(x)=x^2-7x+10\) ?",
                [r"Oui, car \(p(5)=25-35+10=0\)", r"Non, car \(p(5)=10\)", r"Non, car \(p(5)=-10\)", r"Oui, car \(5\) est le coefficient de \(x\) au signe près"],
                0,
                r"\(p(5)=5^2-7\times5+10=25-35+10=0\) : 5 est une racine (l'autre est 2).",
                [
                    "",
                    r"10 est la valeur de \(p(0)\), pas de \(p(5)\). Remplace bien \(x\) par 5 partout.",
                    r"Refais le calcul : \(25-35+10\) vaut 0, pas \(-10\).",
                    r"Aucun lien : le coefficient de \(x\) n'indique pas les racines. Il faut calculer \(p(5)\).",
                ],
            )
        ],
        "fields": [
            f(
                "produit-nul",
                r"Résous \((x-4)(2x+6)=0\). Écris les solutions séparées par un point-virgule.",
                "Par exemple : 1 ; -2",
                "line",
                chk(
                    "set",
                    ["4;-3"],
                    r"Oui : \(x-4=0\) donne \(x=4\), et \(2x+6=0\) donne \(x=-3\).",
                    r"Un produit est nul quand un facteur est nul : résous séparément \(x-4=0\) puis \(2x+6=0\).",
                    r"\((x-4)(2x+6)=0\iff x-4=0\ \text{ou}\ 2x+6=0\iff x=4\ \text{ou}\ x=-3\). \(S=\{-3\,;4\}\).",
                    [(["4;3"], r"Presque : \(2x+6=0\) donne \(2x=-6\), donc \(x=-3\) et non \(3\).")],
                ),
            ),
            f(
                "commun",
                r"Résous \(x^2-5x=0\).",
                "Par exemple : 1 ; -2",
                "line",
                chk(
                    "set",
                    ["0;5"],
                    r"Oui : \(x^2-5x=x(x-5)\), donc \(x=0\) ou \(x=5\).",
                    r"Cherche un facteur commun aux deux termes : tu peux factoriser par \(x\).",
                    r"\(x^2-5x=x(x-5)=0\iff x=0\ \text{ou}\ x=5\). \(S=\{0\,;5\}\).",
                    [(["5"], r"Tu as perdu la racine 0 : en divisant par \(x\) on oublie le cas \(x=0\). Factorise plutôt : \(x(x-5)=0\).")],
                ),
            ),
            f(
                "ident",
                r"Résous \(x^2-9=0\).",
                "Par exemple : 1 ; -2",
                "line",
                chk(
                    "set",
                    ["-3;3"],
                    r"Oui : \(x^2-9=(x-3)(x+3)\), donc \(x=3\) ou \(x=-3\).",
                    r"Reconnais l'identité remarquable \(a^2-b^2=(a-b)(a+b)\) avec \(a=x\) et \(b=3\).",
                    r"\(x^2-9=(x-3)(x+3)=0\iff x=3\ \text{ou}\ x=-3\). \(S=\{-3\,;3\}\).",
                    [(["3"], r"L'équation \(x^2=9\) a <strong>deux</strong> solutions : \(3\) et \(-3\), car \((-3)^2=9\) aussi.")],
                ),
            ),
            f(
                "factorise",
                r"Sachant que 2 et \(-3\) sont les racines de \(q(x)=x^2+x-6\), écris \(q(x)\) sous forme <strong>factorisée</strong> (un produit de facteurs).",
                "Par exemple : (x-1)(x+4)",
                "line",
                chk(
                    "polynomial",
                    ["(x-2)(x+3)"],
                    r"Oui : \(q(x)=(x-2)(x+3)\). (Vérifie que ta réponse est bien <em>un produit</em> : le contrôle reconnaît toute expression égale à \(q(x)\).)",
                    r"Si \(x_1\) et \(x_2\) sont les racines et \(a=1\), alors \(q(x)=a(x-x_1)(x-x_2)\).",
                    r"\(a=1\), \(x_1=2\), \(x_2=-3\) : \(q(x)=(x-2)(x-(-3))=(x-2)(x+3)\). En développant : \(x^2+3x-2x-6=x^2+x-6\).",
                    [(["(x+2)(x-3)"], r"Attention : si 2 est racine, le facteur est \((x-2)\), pas \((x+2)\). C'est \(x-\text{racine}\).")],
                ),
            ),
        ],
        "hints": [
            r"Pour \(2x+6=0\) : isole d'abord \(2x\), puis divise par 2.",
            r"Dans \(x^2-5x\), les deux termes contiennent \(x\) : mets-le en facteur.",
            r"Le facteur associé à la racine \(r\) est \((x-r)\) : le signe change.",
        ],
        "takeaway": r"\(r\) est racine de \(f\) si \(f(r)=0\). Un produit est nul si un facteur est nul. Si \(x_1,x_2\) sont les racines : \(ax^2+bx+c=a(x-x_1)(x-x_2)\).",
        "tests": [],
    }
)

# ───────────────────────── 2. Équations ─────────────────────────
steps.append(
    {
        "id": "equations",
        "short": "Équations",
        "title": "Résoudre ax² + bx + c = 0 : le discriminant",
        "minutes": 15,
        "level": "Application",
        "concepts": ["discriminant", "nombre de solutions", "formules des racines", "racine double"],
        "intro": "Quand on ne voit aucune factorisation, le discriminant donne une méthode qui marche toujours.",
        "lesson": (
            r"<p>Pour \(ax^2+bx+c=0\) avec \(a\ne0\), on calcule le <strong>discriminant</strong> \[\Delta=b^2-4ac.\]</p>"
            + table(
                ["Signe de \\(\\Delta\\)", "Solutions réelles", "Formule"],
                [
                    [r"\(\Delta\gt0\)", "deux solutions distinctes", r"\(x_1=\dfrac{-b-\sqrt\Delta}{2a}\) et \(x_2=\dfrac{-b+\sqrt\Delta}{2a}\)"],
                    [r"\(\Delta=0\)", "une solution (racine double)", r"\(x_0=\dfrac{-b}{2a}\)"],
                    [r"\(\Delta\lt0\)", "aucune solution réelle", r"\(S=\varnothing\)"],
                ],
            )
            + box(
                "Méthode en quatre temps",
                r"<ol><li>Ramener l'équation à la forme \(ax^2+bx+c=0\) (tout dans le membre de gauche).</li>"
                r"<li>Lire \(a\), \(b\), \(c\) <em>avec leurs signes</em>.</li>"
                r"<li>Calculer \(\Delta=b^2-4ac\).</li>"
                r"<li>Conclure selon le signe de \(\Delta\), puis écrire l'ensemble des solutions.</li></ol>",
            )
            + r"<p><strong>Exemple résolu.</strong> \(x^2-3x+2=0\) : \(a=1\), \(b=-3\), \(c=2\). \(\Delta=(-3)^2-4\times1\times2=9-8=1\gt0\). "
            r"Donc \(x_1=\dfrac{3-1}{2}=1\) et \(x_2=\dfrac{3+1}{2}=2\).</p>"
            r"<p>À toi, avec \(2x^2-3x-2=0\).</p>{{f:delta1}}{{f:sol1}}"
            r"<p>Combien de solutions quand \(\Delta=0\) ?</p>{{q:double}}{{f:sol2}}"
            r"<p>Et quand \(\Delta\lt0\) ?</p>{{f:sol3}}"
            r"<p>Quand \(\Delta\) n'est pas un carré parfait, on garde la racine carrée : c'est la valeur <em>exacte</em>.</p>{{f:sol4}}"
            r"<p>Attention à la forme de départ.</p>{{f:sol5}}"
        ),
        "task": "Calcule des discriminants et résous cinq équations, en vérifiant chaque réponse.",
        "starter": None,
        "figures": [],
        "questions": [
            q(
                "double",
                r"L'équation \(x^2-6x+9=0\) a un discriminant \(\Delta=(-6)^2-4\times1\times9=0\). Combien a-t-elle de solutions réelles ?",
                ["Aucune", "Une seule (double)", "Deux solutions distinctes"],
                1,
                r"Quand \(\Delta=0\), la formule donne \(x_0=\dfrac{-b}{2a}=\dfrac{6}{2}=3\) : une unique solution, dite double (car \(x^2-6x+9=(x-3)^2\)).",
                [
                    r"Le discriminant n'est pas négatif : il vaut exactement 0, ce qui donne une solution.",
                    "",
                    r"Deux solutions distinctes demandent \(\Delta\gt0\) ; avec \(\Delta=0\) les deux « solutions » coïncident.",
                ],
            )
        ],
        "fields": [
            f(
                "delta1",
                r"Calcule \(\Delta\) pour \(2x^2-3x-2=0\).",
                "Un nombre",
                "line",
                chk(
                    "number",
                    ["25"],
                    r"Oui : \(\Delta=(-3)^2-4\times2\times(-2)=9+16=25\).",
                    r"Identifie d'abord \(a=2\), \(b=-3\), \(c=-2\), puis applique \(b^2-4ac\).",
                    r"\(a=2\), \(b=-3\), \(c=-2\). \(\Delta=b^2-4ac=9-4\times2\times(-2)=9+16=25\).",
                    [
                        (["-7"], r"Regarde le signe de \(-4ac\) : \(c=-2\), donc \(-4ac=-4\times2\times(-2)=+16\), pas \(-16\)."),
                        (["17"], r"N'oublie pas le facteur \(a\) : \(4ac=4\times2\times(-2)=-16\), pas \(-8\)."),
                    ],
                ),
            ),
            f(
                "sol1",
                r"Résous \(2x^2-3x-2=0\). Écris les solutions séparées par un point-virgule.",
                "Par exemple : 1 ; -2",
                "line",
                chk(
                    "set",
                    ["-1/2;2"],
                    r"Oui : \(x_1=\dfrac{3-5}{4}=-\dfrac12\) et \(x_2=\dfrac{3+5}{4}=2\).",
                    r"Avec \(\Delta=25\) et \(\sqrt{25}=5\) : calcule \(\dfrac{-b\pm5}{2a}\), en gardant \(-b=+3\).",
                    r"\(x_1=\dfrac{-(-3)-\sqrt{25}}{2\times2}=\dfrac{3-5}{4}=-\dfrac12\) ; \(x_2=\dfrac{3+5}{4}=2\). \(S=\left\{-\dfrac12\,;2\right\}\).",
                    [(["-2;1/2"], r"Signe : l'opposé de \(b=-3\) est \(-b=+3\). Recalcule \(\dfrac{3\pm5}{4}\).")],
                ),
            ),
            f(
                "sol2",
                r"Résous \(x^2-6x+9=0\).",
                "Par exemple : 1 ; -2",
                "line",
                chk(
                    "set",
                    ["3"],
                    r"Oui : \(S=\{3\}\). On vérifie : \(x^2-6x+9=(x-3)^2\).",
                    r"Avec \(\Delta=0\), il n'y a qu'une valeur : \(\dfrac{-b}{2a}\).",
                    r"\(\Delta=0\) donc \(x_0=\dfrac{-b}{2a}=\dfrac{6}{2}=3\). \(S=\{3\}\).",
                ),
            ),
            f(
                "sol3",
                r"Résous \(x^2+x+1=0\). Écris ∅ s'il n'y a aucune solution.",
                "Un ou plusieurs nombres, ou ∅",
                "line",
                chk(
                    "set",
                    ["∅"],
                    r"Oui : \(\Delta=1-4=-3\lt0\) donc \(S=\varnothing\) : la parabole ne touche jamais l'axe des abscisses.",
                    r"Calcule \(\Delta=b^2-4ac\) avec \(a=b=c=1\) : quel est son signe ?",
                    r"\(\Delta=1^2-4\times1\times1=-3\lt0\). Une racine carrée n'existe pas pour un nombre négatif : aucune solution réelle, \(S=\varnothing\).",
                ),
            ),
            f(
                "sol4",
                r"Résous \(x^2-x-1=0\). Donne les valeurs <strong>exactes</strong> (avec \(\sqrt5\)).",
                "Par exemple : (1+√3)/2 ; (1-√3)/2",
                "line",
                chk(
                    "set",
                    ["(1-√5)/2;(1+√5)/2"],
                    r"Oui : \(\Delta=1+4=5\), donc \(x=\dfrac{1\pm\sqrt5}{2}\). (Ce sont environ \(-0{,}618\) et \(1{,}618\).)",
                    r"Calcule \(\Delta\) : \(a=1\), \(b=-1\), \(c=-1\). Puis \(x=\dfrac{-b\pm\sqrt\Delta}{2a}\) en gardant \(\sqrt\Delta\) sous forme exacte.",
                    r"\(\Delta=(-1)^2-4\times1\times(-1)=5\gt0\). \(x_1=\dfrac{1-\sqrt5}{2}\), \(x_2=\dfrac{1+\sqrt5}{2}\).",
                    [(["-0,618;1,618"], r"Ces valeurs sont des approximations. Ici on demande les valeurs exactes : écris-les avec \(\sqrt5\).")],
                ),
            ),
            f(
                "sol5",
                r"Résous \(3x^2=5x+2\).",
                "Par exemple : 1 ; -2",
                "line",
                chk(
                    "set",
                    ["-1/3;2"],
                    r"Oui : on passe à gauche, \(3x^2-5x-2=0\), puis \(\Delta=25+24=49\) et \(x=\dfrac{5\pm7}{6}\).",
                    r"Mets d'abord tous les termes à gauche pour obtenir la forme \(ax^2+bx+c=0\), puis identifie \(a\), \(b\), \(c\).",
                    r"\(3x^2=5x+2\iff3x^2-5x-2=0\) : \(a=3\), \(b=-5\), \(c=-2\). \(\Delta=25+24=49\), \(x_1=\dfrac{5-7}{6}=-\dfrac13\), \(x_2=\dfrac{5+7}{6}=2\).",
                    [(["2/3;1"], r"Tu as gardé \(+2\) : en passant le 2 de droite à gauche il devient \(-2\), donc \(c=-2\).")],
                ),
            ),
        ],
        "hints": [
            r"Écris \(a=\ldots\), \(b=\ldots\), \(c=\ldots\) avant tout calcul, avec les signes.",
            r"Mets les parenthèses autour d'un \(b\) négatif : \(b^2=(-3)^2=9\), jamais \(-9\).",
            r"Si \(\Delta\) est un carré parfait, les solutions sont rationnelles ; sinon, garde \(\sqrt\Delta\).",
        ],
        "takeaway": r"\(\Delta=b^2-4ac\). Si \(\Delta\gt0\) : deux solutions \(\frac{-b\pm\sqrt\Delta}{2a}\). Si \(\Delta=0\) : une solution \(\frac{-b}{2a}\). Si \(\Delta\lt0\) : aucune solution réelle.",
        "tests": [],
    }
)

# ───────────────────────── 3. Inéquations ─────────────────────────
steps.append(
    {
        "id": "inequations",
        "short": "Inéquations",
        "title": "Signe d'un trinôme et inéquations",
        "minutes": 15,
        "level": "Application",
        "concepts": ["signe du trinôme", "tableau de signes", "intervalles", "inéquation du second degré"],
        "intro": "Résoudre une inéquation, c'est dire où la parabole est au-dessus ou en dessous de l'axe des abscisses.",
        "lesson": (
            r"<p>Le signe de \(f(x)=ax^2+bx+c\) se lit sur la parabole : au-dessus de l'axe, \(f(x)\gt0\) ; en dessous, \(f(x)\lt0\).</p>"
            r"{{fig:ineq}}"
            + box(
                "Règle du signe du trinôme",
                r"<ul><li>Si \(\Delta\gt0\) : \(f(x)\) est du signe de \(a\) <strong>à l'extérieur</strong> des racines, du signe contraire <strong>entre</strong> les racines.</li>"
                r"<li>Si \(\Delta=0\) : \(f(x)\) est du signe de \(a\), et vaut 0 en la racine double.</li>"
                r"<li>Si \(\Delta\lt0\) : \(f(x)\) est du signe de \(a\) pour tout réel \(x\).</li></ul>",
            )
            + r"<p>Pour \(a\gt0\) et \(\Delta\gt0\), avec \(x_1\lt x_2\) :</p>"
            + table(
                ["Valeurs de x", r"avant \(x_1\)", r"en \(x_1\)", r"entre \(x_1\) et \(x_2\)", r"en \(x_2\)", r"après \(x_2\)"],
                [["Signe de f(x)", r"\(+\)", r"\(0\)", r"\(-\)", r"\(0\)", r"\(+\)"]],
            )
            + box(
                "Méthode",
                r"<ol><li>Ramener à une comparaison avec 0 : \(f(x)\gt0\), \(\ge0\), \(\lt0\) ou \(\le0\).</li>"
                r"<li>Trouver les racines (discriminant).</li><li>Regarder le signe de \(a\).</li>"
                r"<li>Conclure avec des intervalles : bornes <em>ouvertes</em> pour une inégalité stricte, <em>fermées</em> pour une inégalité large.</li></ol>",
            )
            + r"<p><strong>Exemple résolu.</strong> \(x^2-4x+3\le0\) : racines 1 et 3, \(a=1\gt0\), donc le trinôme est négatif entre les racines et nul en elles : \(S=[1\,;3]\).</p>"
            r"{{f:i1}}{{f:i2}}{{f:i3}}{{f:i4}}{{f:i5}}{{q:carre}}"
        ),
        "task": "Résous cinq inéquations (réponse sous forme d'intervalles) et vérifie chacune.",
        "starter": None,
        "figures": [
            fig(
                "ineq",
                r"Courbe de \(f(x)=x^2-x-6\) : au-dessus de l'axe hors des racines \(-2\) et \(3\), en dessous entre elles.",
                "courbe de f",
                [-6, -1, 1],
                {"xmin": -4, "xmax": 5, "ymin": -8, "ymax": 8},
                [{"x": -2, "label": "-2"}, {"x": 3, "label": "3"}],
            )
        ],
        "questions": [
            q(
                "carre",
                r"Que vaut l'ensemble des solutions de \((x-2)^2\le0\) ?",
                [r"Aucun réel", r"Uniquement \(x=2\)", r"Tous les réels", r"L'intervalle \(]-\infty\,;2]\)"],
                1,
                r"Un carré est toujours positif ou nul : \((x-2)^2\le0\) n'arrive que lorsqu'il vaut 0, c'est-à-dire pour \(x=2\).",
                [
                    r"Pour \(x=2\), le carré vaut 0 et 0 est bien inférieur ou égal à 0 : il y a au moins une solution.",
                    "",
                    r"Pour \(x=5\) par exemple, \((5-2)^2=9\) n'est pas inférieur ou égal à 0.",
                    r"Pour \(x=0\), \((0-2)^2=4\) n'est pas inférieur ou égal à 0 : ce n'est pas une solution.",
                ],
            )
        ],
        "fields": [
            f(
                "i1",
                r"Résous \(x^2-x-6\gt0\).",
                "Par exemple : ]-inf ; 1[ ∪ ]4 ; +inf[",
                "line",
                chk(
                    "interval",
                    ["]-∞;-2[∪]3;+∞["],
                    r"Oui : racines \(-2\) et \(3\), \(a=1\gt0\) : positif à l'extérieur, bornes exclues (inégalité stricte).",
                    r"Trouve d'abord les racines de \(x^2-x-6\), puis regarde le signe de \(a\) pour savoir si le trinôme est positif à l'extérieur ou entre les racines.",
                    r"\(\Delta=1+24=25\), racines \(\frac{1\pm5}{2}\) : \(-2\) et \(3\). \(a=1\gt0\) : \(f\gt0\) à l'extérieur des racines. \(S=]-\infty\,;-2[\,\cup\,]3\,;+\infty[\).",
                    [
                        (["[-2;3]", "]-2;3["], r"Tu as décrit la zone <em>entre</em> les racines, où le trinôme est négatif. Ici \(a\gt0\) : la parabole est au-dessus de l'axe à l'extérieur."),
                        (["]-∞;-2]∪[3;+∞["], r"L'inégalité est stricte (\(\gt0\)) : en \(-2\) et en \(3\) le trinôme vaut 0, ces valeurs sont exclues. Utilise des crochets ouverts."),
                    ],
                ),
            ),
            f(
                "i2",
                r"Résous \(-x^2+4x-3\ge0\).",
                "Par exemple : [0 ; 5]",
                "line",
                chk(
                    "interval",
                    ["[1;3]"],
                    r"Oui : racines 1 et 3, \(a=-1\lt0\) : positif <em>entre</em> les racines, bornes incluses (inégalité large).",
                    r"Trouve les racines puis attention : ici \(a\) est négatif, la parabole est tournée vers le bas.",
                    r"\(\Delta=16-12=4\), racines \(\frac{-4\pm2}{-2}\) : \(3\) et \(1\). \(a=-1\lt0\) : \(f\ge0\) entre les racines, inclus. \(S=[1\,;3]\).",
                    [
                        (["]-∞;1]∪[3;+∞["], r"Ici \(a=-1\lt0\) : la parabole est tournée vers le bas, donc positive <em>entre</em> les racines (et non à l'extérieur)."),
                        ([ "]1;3[" ], r"L'inégalité est large (\(\ge0\)) : en 1 et en 3 le trinôme vaut 0, ces valeurs conviennent. Utilise des crochets fermés."),
                    ],
                ),
            ),
            f(
                "i3",
                r"Résous \(x^2+2x+5\gt0\). Tu peux écrire ℝ.",
                "ℝ, ∅ ou un intervalle",
                "line",
                chk(
                    "interval",
                    ["ℝ"],
                    r"Oui : \(\Delta=4-20=-16\lt0\), donc le trinôme est du signe de \(a=1\gt0\) pour tout \(x\) : \(S=\mathbb R\).",
                    r"Calcule d'abord le discriminant : s'il est négatif, le trinôme garde le signe de \(a\) sur tout \(\mathbb R\).",
                    r"\(\Delta=2^2-4\times1\times5=-16\lt0\) : pas de racine, la parabole ne coupe pas l'axe. Elle est entièrement au-dessus (\(a=1\gt0\)). \(S=\mathbb R=]-\infty\,;+\infty[\).",
                    [(["∅"], r"Vérifie avec \(x=0\) : \(0+0+5=5\gt0\), donc 0 est solution. L'ensemble n'est pas vide.")],
                ),
            ),
            f(
                "i4",
                r"Résous \(2x^2-x-1\le0\).",
                "Par exemple : [0 ; 5]",
                "line",
                chk(
                    "interval",
                    ["[-1/2;1]"],
                    r"Oui : racines \(-\frac12\) et 1, \(a=2\gt0\) : négatif entre les racines, bornes incluses.",
                    r"Trouve les racines avec le discriminant, puis dis où une parabole tournée vers le haut est sous l'axe.",
                    r"\(\Delta=1+8=9\), racines \(\frac{1\pm3}{4}\) : \(-\frac12\) et \(1\). \(a=2\gt0\) : \(f\le0\) entre les racines, inclus. \(S=\left[-\frac12\,;1\right]\).",
                    [(["]-∞;-1/2]∪[1;+∞["], r"Ici on cherche \(f(x)\le0\) : pour \(a\gt0\), c'est <em>entre</em> les racines que la parabole est sous l'axe.")],
                ),
            ),
            f(
                "i5",
                r"Résous \(x^2\gt2x+3\).",
                "Par exemple : ]-inf ; 1[ ∪ ]4 ; +inf[",
                "line",
                chk(
                    "interval",
                    ["]-∞;-1[∪]3;+∞["],
                    r"Oui : on se ramène à \(x^2-2x-3\gt0\), de racines \(-1\) et \(3\), positif à l'extérieur.",
                    r"Commence par tout passer à gauche pour comparer à 0 : \(x^2-2x-3\gt0\).",
                    r"\(x^2\gt2x+3\iff x^2-2x-3\gt0\). \(\Delta=4+12=16\), racines \(\frac{2\pm4}{2}\) : \(-1\) et \(3\). \(a=1\gt0\) : \(S=]-\infty\,;-1[\,\cup\,]3\,;+\infty[\).",
                    [(["]-1;3["], r"Tu as décrit la zone où \(x^2-2x-3\lt0\). On veut le signe <em>positif</em> : pour \(a\gt0\), c'est à l'extérieur des racines.")],
                ),
            ),
        ],
        "hints": [
            r"Dessine la parabole : tournée vers le haut si \(a\gt0\), vers le bas si \(a\lt0\), et place les racines sur l'axe.",
            r"Inégalité stricte (\(\gt\), \(\lt\)) : crochets ouverts. Inégalité large (\(\ge\), \(\le\)) : crochets fermés.",
            r"Une borne infinie est toujours ouverte : \(]-\infty\,;\ldots\) et \(\ldots\,;+\infty[\).",
        ],
        "takeaway": r"Le trinôme est du signe de \(a\) à l'extérieur des racines et du signe contraire entre elles (si \(\Delta\gt0\)) ; du signe de \(a\) partout si \(\Delta\lt0\). On conclut en intervalles, avec la bonne ouverture des crochets.",
        "tests": [],
    }
)

# ───────────────────────── 4. Somme et produit ─────────────────────────
steps.append(
    {
        "id": "somme-produit",
        "short": "Somme et produit",
        "title": "Somme et produit des racines",
        "minutes": 12,
        "level": "Application",
        "concepts": ["somme des racines", "produit des racines", "racine évidente", "deux nombres de somme et produit donnés"],
        "intro": "Parfois on n'a pas besoin de calculer les racines : leur somme et leur produit se lisent directement sur les coefficients.",
        "lesson": (
            r"<p>Si \(ax^2+bx+c\) a deux racines \(x_1\) et \(x_2\), alors \(ax^2+bx+c=a(x-x_1)(x-x_2)=a\bigl(x^2-(x_1+x_2)x+x_1x_2\bigr)\). En identifiant les coefficients :</p>"
            + box(
                "Somme et produit",
                r"<p>\[S=x_1+x_2=-\frac ba\qquad\text{et}\qquad P=x_1x_2=\frac ca.\]</p>"
                r"<p><strong>Réciproque.</strong> Deux nombres de somme \(S\) et de produit \(P\) sont les solutions de \(X^2-SX+P=0\) (s'il y en a : il faut \(S^2-4P\ge0\)).</p>"
                r"<p><strong>Racines évidentes.</strong> Si \(a+b+c=0\), alors 1 est racine et l'autre vaut \(\frac ca\). Si \(a-b+c=0\), alors \(-1\) est racine et l'autre vaut \(-\frac ca\).</p>",
            )
            + r"<p><strong>Exemple.</strong> \(x^2-5x+6=0\) : \(S=5\), \(P=6\) ; les nombres 2 et 3 conviennent (\(2+3=5\), \(2\times3=6\)).</p>"
            r"<p>À toi : on considère \(2x^2-10x+12=0\) (elle a deux racines réelles).</p>{{f:s1}}{{f:p1}}{{f:r1}}"
            r"<p>Racines évidentes — regarde \(a+b+c\) et \(a-b+c\) :</p>{{f:ev1}}{{f:ev2}}"
            r"<p>Deux nombres connaissant leur somme et leur produit :</p>{{f:sp2}}{{q:sp3}}"
            r"<p>Une racine connue :</p><p>L'équation \(x^2-8x+c=0\) a pour racine 3.</p>{{f:autre}}{{f:cc}}"
            r"<p>Un peu plus difficile : sans calculer les racines.</p>{{f:carres}}"
        ),
        "task": "Utilise \\(S=-b/a\\) et \\(P=c/a\\) pour aller plus vite que le discriminant.",
        "starter": None,
        "figures": [],
        "questions": [
            q(
                "sp3",
                r"Existe-t-il deux nombres réels de somme 2 et de produit 5 ?",
                [r"Oui : 1 et 1", r"Oui : 5 et \(-3\)", r"Non, il n'en existe pas"],
                2,
                r"Ils seraient solutions de \(X^2-2X+5=0\) : \(\Delta=4-20=-16\lt0\), donc aucune solution réelle. Il n'existe pas de tels réels.",
                [
                    r"1 et 1 ont bien pour somme 2, mais leur produit vaut 1 et non 5.",
                    r"5 et \(-3\) ont bien pour somme 2, mais leur produit vaut \(-15\) et non 5.",
                    "",
                ],
            )
        ],
        "fields": [
            f(
                "s1",
                r"Pour \(2x^2-10x+12=0\), calcule la somme \(S=x_1+x_2\).",
                "Un nombre",
                "line",
                chk(
                    "number",
                    ["5"],
                    r"Oui : \(S=-\dfrac ba=-\dfrac{-10}{2}=5\).",
                    r"Applique \(S=-\dfrac ba\) avec \(a=2\) et \(b=-10\) : attention au signe de \(b\).",
                    r"\(a=2\), \(b=-10\) : \(S=-\dfrac ba=-\dfrac{-10}{2}=5\).",
                    [(["-5"], r"\(b=-10\) est négatif, donc \(-b=+10\) et \(S=\dfrac{10}{2}=5\).")],
                ),
            ),
            f(
                "p1",
                r"Calcule le produit \(P=x_1x_2\).",
                "Un nombre",
                "line",
                chk(
                    "number",
                    ["6"],
                    r"Oui : \(P=\dfrac ca=\dfrac{12}{2}=6\).",
                    r"Applique \(P=\dfrac ca\).",
                    r"\(P=\dfrac ca=\dfrac{12}{2}=6\).",
                    [(["12"], r"Il faut diviser par \(a\) : \(P=\dfrac ca=\dfrac{12}{2}\), pas simplement \(c\).")],
                ),
            ),
            f(
                "r1",
                r"Déduis-en les racines : deux nombres de somme 5 et de produit 6.",
                "Par exemple : 1 ; 4",
                "line",
                chk(
                    "set",
                    ["2;3"],
                    r"Oui : \(2+3=5\) et \(2\times3=6\). On retrouve les racines sans discriminant.",
                    r"Cherche deux nombres dont le produit est 6 et dont la somme est 5.",
                    r"Les couples de produit 6 sont (1,6), (2,3)… Seul (2,3) a pour somme 5. Les racines sont 2 et 3.",
                ),
            ),
            f(
                "ev1",
                r"Résous \(2x^2-7x+5=0\) en remarquant que \(a+b+c=0\).",
                "Par exemple : 1 ; -2",
                "line",
                chk(
                    "set",
                    ["1;5/2"],
                    r"Oui : \(2-7+5=0\), donc 1 est racine ; l'autre est \(\dfrac ca=\dfrac52\).",
                    r"Calcule \(a+b+c\). Si c'est 0, une racine est 1 et l'autre vaut \(c/a\).",
                    r"\(a+b+c=2-7+5=0\) : 1 est racine. Produit \(P=\dfrac ca=\dfrac52\), donc l'autre racine est \(\dfrac52\). \(S=\left\{1\,;\dfrac52\right\}\).",
                    [(["1;-5/2"], r"Le produit des racines est \(\dfrac ca=+\dfrac52\) : \(1\times x_2=\dfrac52\), donc \(x_2=+\dfrac52\).")],
                ),
            ),
            f(
                "ev2",
                r"Résous \(2x^2+5x+3=0\) en remarquant que \(a-b+c=0\).",
                "Par exemple : 1 ; -2",
                "line",
                chk(
                    "set",
                    ["-1;-3/2"],
                    r"Oui : \(2-5+3=0\), donc \(-1\) est racine ; l'autre est \(-\dfrac ca=-\dfrac32\).",
                    r"Calcule \(a-b+c\). Si c'est 0, une racine est \(-1\) et l'autre vaut \(-c/a\).",
                    r"\(a-b+c=2-5+3=0\) : \(-1\) est racine. Produit \(P=\dfrac ca=\dfrac32=(-1)\times x_2\), donc \(x_2=-\dfrac32\). \(S=\left\{-\dfrac32\,;-1\right\}\).",
                    [(["-1;3/2"], r"Le produit des racines vaut \(\dfrac32\) : \((-1)\times x_2=\dfrac32\) donne \(x_2=-\dfrac32\).")],
                ),
            ),
            f(
                "sp2",
                r"Trouve deux nombres de somme 7 et de produit 12.",
                "Par exemple : 1 ; 4",
                "line",
                chk(
                    "set",
                    ["3;4"],
                    r"Oui : ce sont les solutions de \(X^2-7X+12=0\) (\(\Delta=1\), \(X=\frac{7\pm1}{2}\)) : 3 et 4.",
                    r"Écris l'équation \(X^2-SX+P=0\) avec \(S=7\) et \(P=12\), puis résous-la.",
                    r"\(X^2-7X+12=0\) : \(\Delta=49-48=1\), \(X=\dfrac{7\pm1}{2}\) donc 3 et 4. Vérification : \(3+4=7\), \(3\times4=12\).",
                ),
            ),
            f(
                "autre",
                r"Quelle est l'autre racine ?",
                "Un nombre",
                "line",
                chk(
                    "number",
                    ["5"],
                    r"Oui : la somme des racines vaut \(-\dfrac ba=8\), donc \(x_2=8-3=5\).",
                    r"La somme des deux racines vaut \(-\dfrac ba\) : ici \(a=1\), \(b=-8\).",
                    r"\(S=-\dfrac ba=8\). Une racine vaut 3, donc l'autre vaut \(8-3=5\).",
                ),
            ),
            f(
                "cc",
                r"Quelle est la valeur de \(c\) ?",
                "Un nombre",
                "line",
                chk(
                    "number",
                    ["15"],
                    r"Oui : \(c=a\times P=1\times(3\times5)=15\). Vérification : \(x^2-8x+15=(x-3)(x-5)\).",
                    r"Le produit des racines vaut \(\dfrac ca\) : ici \(a=1\), donc \(c\) est le produit des racines.",
                    r"\(P=\dfrac ca=3\times5=15\) et \(a=1\), donc \(c=15\). On vérifie : \(3^2-8\times3+15=9-24+15=0\).",
                    [(["8"], r"8 est la somme des racines, pas leur produit. Le produit vaut \(\dfrac ca\).")],
                ),
            ),
            f(
                "carres",
                r"Les racines de \(2x^2-6x+1=0\) (réelles, car \(\Delta=28\gt0\)) sont \(x_1\) et \(x_2\). Calcule \(x_1^2+x_2^2\) sans calculer les racines.",
                "Un nombre. Indice : (x1+x2)² = x1² + 2x1x2 + x2²",
                "line",
                chk(
                    "number",
                    ["8"],
                    r"Oui : \(S=3\), \(P=\frac12\), donc \(x_1^2+x_2^2=S^2-2P=9-1=8\).",
                    r"Développe \((x_1+x_2)^2\) pour faire apparaître \(x_1^2+x_2^2\) : tout s'exprime avec \(S\) et \(P\).",
                    r"\(x_1^2+x_2^2=(x_1+x_2)^2-2x_1x_2=S^2-2P\). Ici \(S=-\dfrac{-6}{2}=3\) et \(P=\dfrac12\) : \(9-1=8\).",
                    [(["9"], r"\(S^2=9\) est le carré de la somme, mais \((x_1+x_2)^2=x_1^2+2x_1x_2+x_2^2\) : il faut retirer \(2P\).")],
                ),
            ),
        ],
        "hints": [
            r"Garde le signe de \(b\) : \(S=-\dfrac ba\) change le signe de \(b\).",
            r"Pour deviner deux nombres, liste les couples de facteurs du produit, puis garde celui dont la somme convient.",
            r"Pour \(x_1^2+x_2^2\) : développe \((x_1+x_2)^2\).",
        ],
        "takeaway": r"\(x_1+x_2=-\dfrac ba\) et \(x_1x_2=\dfrac ca\). Deux nombres de somme \(S\) et produit \(P\) sont solutions de \(X^2-SX+P=0\). Si \(a+b+c=0\), 1 est racine ; si \(a-b+c=0\), \(-1\) est racine.",
        "tests": [],
    }
)

# ───────────────────────── 5. Variations ─────────────────────────
steps.append(
    {
        "id": "variations",
        "short": "Variations",
        "title": "Forme canonique, sommet et variations",
        "minutes": 15,
        "level": "Application",
        "concepts": ["forme canonique", "sommet de la parabole", "extremum", "tableau de variations", "image d'un intervalle"],
        "intro": "Tout trinôme peut s'écrire avec son sommet. C'est la clé pour les variations et pour trouver un maximum ou un minimum.",
        "lesson": (
            r"<p>Tout trinôme \(f(x)=ax^2+bx+c\) s'écrit sous <strong>forme canonique</strong> \[f(x)=a(x-\alpha)^2+\beta.\]"
            r"Ici \(\alpha=-\dfrac b{2a}\) et \(\beta=f(\alpha)\). "
            r"Le point \(S(\alpha\,;\beta)\) est le <strong>sommet</strong> de la parabole.</p>"
            + box(
                "Variations",
                r"<ul><li>Si \(a\gt0\) : \(f\) est décroissante sur \(]-\infty\,;\alpha]\), croissante sur \([\alpha\,;+\infty[\) ; elle admet un <strong>minimum</strong> \(\beta\) en \(\alpha\).</li>"
                r"<li>Si \(a\lt0\) : \(f\) est croissante sur \(]-\infty\,;\alpha]\), décroissante sur \([\alpha\,;+\infty[\) ; elle admet un <strong>maximum</strong> \(\beta\) en \(\alpha\).</li></ul>",
            )
            + r"<p>Fil rouge : \(g(x)=2x^2-8x+5\).</p>{{fig:g}}{{f:alpha}}{{f:beta}}{{f:canonique}}{{q:minimum}}{{q:racines-g}}"
            r"<p>Cas \(a\lt0\) : \(h(x)=-x^2+6x-4\).</p>{{f:hmax}}{{f:hcroi}}"
            r"<p>Utiliser les variations pour comparer sans calculer :</p>{{q:compare}}"
            r"<p>Image d'un intervalle : \(k(x)=x^2-4x+3\) sur \([0\,;5]\). Attention, le sommet est à l'intérieur de l'intervalle.</p>{{f:image}}"
        ),
        "task": "Trouve le sommet de deux paraboles, décris leurs variations, puis détermine l'image d'un intervalle.",
        "starter": None,
        "figures": [
            fig(
                "g",
                r"Courbe de \(g(x)=2x^2-8x+5\) ; le point S est le sommet.",
                "courbe de g",
                [5, -8, 2],
                {"xmin": -1, "xmax": 5, "ymin": -5, "ymax": 14},
                [{"x": 2, "label": "S"}],
            )
        ],
        "questions": [
            q(
                "minimum",
                r"D'après son coefficient \(a=2\), que peut-on dire de \(g\) ?",
                [r"Elle admet un minimum en \(x=2\)", r"Elle admet un maximum en \(x=2\)", r"Elle est croissante sur \(\mathbb R\)"],
                0,
                r"\(a=2\gt0\) : la parabole est tournée vers le haut, son sommet est son point le plus bas. \(g\) décroît jusqu'à \(x=2\), puis croît : minimum \(g(2)=-3\).",
                [
                    "",
                    r"Un maximum correspond à une parabole tournée vers le bas (\(a\lt0\)). Ici \(a=2\gt0\).",
                    r"Une parabole change toujours de sens de variation au niveau de son sommet : elle ne peut pas être croissante partout.",
                ],
            ),
            q(
                "racines-g",
                r"Combien l'équation \(g(x)=0\) a-t-elle de solutions ?",
                ["Aucune", "Une", "Deux"],
                2,
                r"Le minimum de \(g\) vaut \(-3\lt0\) et les branches montent à l'infini : la courbe passe sous l'axe puis le coupe de part et d'autre. Il y a deux solutions (on peut vérifier : \(\Delta=64-40=24\gt0\)).",
                [
                    r"Si le minimum était positif, la courbe serait entièrement au-dessus de l'axe. Ici le minimum \(-3\) est négatif.",
                    r"Il n'y aurait une seule solution que si le sommet était sur l'axe (minimum égal à 0).",
                    "",
                ],
            ),
            q(
                "compare",
                r"Soit \(f(x)=x^2-6x+1\), de sommet d'abscisse \(\alpha=3\). Que peut-on dire de \(f(1)\) et \(f(2)\) ?",
                [r"On a \(f(1)\gt f(2)\)", r"On a \(f(1)\lt f(2)\)", r"On a \(f(1)=f(2)\)"],
                0,
                r"\(a=1\gt0\) : \(f\) est décroissante sur \(]-\infty\,;3]\). Comme \(1\lt2\le3\), on a \(f(1)\gt f(2)\) : en effet \(f(1)=-4\) et \(f(2)=-7\).",
                [
                    "",
                    r"Sur \(]-\infty\,;3]\) la fonction <em>décroît</em> (\(a\gt0\), avant le sommet) : la plus petite abscisse donne la plus grande image.",
                    r"Les deux nombres ne sont pas symétriques par rapport à 3 (qui serait le cas de 1 et 5) : les images sont différentes.",
                ],
            ),
        ],
        "fields": [
            f(
                "alpha",
                r"Calcule \(\alpha\), l'abscisse du sommet de \(g\).",
                "Un nombre",
                "line",
                chk(
                    "number",
                    ["2"],
                    r"Oui : \(\alpha=-\dfrac b{2a}=\dfrac8{4}=2\).",
                    r"Applique \(\alpha=-\dfrac b{2a}\) avec \(a=2\) et \(b=-8\).",
                    r"\(\alpha=-\dfrac b{2a}=-\dfrac{-8}{2\times2}=\dfrac84=2\).",
                    [
                        (["4"], r"\(-\dfrac ba=4\) est la <em>somme</em> des racines. L'abscisse du sommet est la moitié : \(-\dfrac b{2a}\)."),
                        (["-2"], r"\(b=-8\) est négatif : \(-b=+8\), donc \(\alpha\) est positif."),
                    ],
                ),
            ),
            f(
                "beta",
                r"Calcule \(\beta=g(\alpha)\), l'ordonnée du sommet.",
                "Un nombre",
                "line",
                chk(
                    "number",
                    ["-3"],
                    r"Oui : \(g(2)=2\times4-16+5=-3\). Le sommet est \(S(2\,;-3)\).",
                    r"Remplace \(x\) par \(\alpha=2\) dans \(2x^2-8x+5\).",
                    r"\(g(2)=2\times2^2-8\times2+5=8-16+5=-3\).",
                    [(["5"], r"5 est \(g(0)=c\), l'ordonnée à l'origine, pas celle du sommet. Calcule \(g(2)\).")],
                ),
            ),
            f(
                "canonique",
                r"Écris \(g(x)\) sous forme canonique \(a(x-\alpha)^2+\beta\).",
                "Par exemple : 3(x-1)^2+4",
                "line",
                chk(
                    "polynomial",
                    ["2(x-2)^2-3"],
                    r"Oui : \(g(x)=2(x-2)^2-3\). On vérifie : \(2(x^2-4x+4)-3=2x^2-8x+5\). (Vérifie que ta réponse est bien sous la forme \(a(x-\alpha)^2+\beta\) : le contrôle reconnaît toute expression égale à \(g(x)\).)",
                    r"Utilise \(a=2\), \(\alpha=2\), \(\beta=-3\) : \(g(x)=a(x-\alpha)^2+\beta\).",
                    r"\(g(x)=a(x-\alpha)^2+\beta=2(x-2)^2-3\). Développement de contrôle : \(2(x^2-4x+4)-3=2x^2-8x+8-3=2x^2-8x+5\).",
                    [
                        (["2(x+2)^2-3"], r"Le facteur est \((x-\alpha)\) avec \(\alpha=2\) : c'est \((x-2)\), pas \((x+2)\)."),
                        (["(x-2)^2-3"], r"N'oublie pas le coefficient \(a=2\) devant la parenthèse : \(a(x-\alpha)^2+\beta\)."),
                    ],
                ),
            ),
            f(
                "hmax",
                r"Pour \(h(x)=-x^2+6x-4\), calcule le <strong>maximum</strong> de \(h\) (la valeur, pas l'abscisse).",
                "Un nombre",
                "line",
                chk(
                    "number",
                    ["5"],
                    r"Oui : \(\alpha=-\dfrac6{-2}=3\) et \(h(3)=-9+18-4=5\). Le maximum de \(h\) vaut 5, atteint en \(x=3\).",
                    r"Trouve d'abord l'abscisse \(\alpha=-\dfrac b{2a}\), puis calcule \(h(\alpha)\).",
                    r"\(\alpha=-\dfrac{6}{2\times(-1)}=3\). \(h(3)=-3^2+6\times3-4=-9+18-4=5\). Comme \(a=-1\lt0\), c'est un maximum.",
                    [(["3"], r"3 est l'abscisse du sommet. On demande la valeur du maximum : calcule \(h(3)\).")],
                ),
            ),
            f(
                "hcroi",
                r"Sur quel intervalle \(h\) est-elle croissante ?",
                "Par exemple : [1 ; +inf[",
                "line",
                chk(
                    "interval",
                    ["]-∞;3]"],
                    r"Oui : \(a\lt0\), la parabole monte jusqu'à son sommet d'abscisse 3, puis redescend. \(h\) est croissante sur \(]-\infty\,;3]\).",
                    r"Ici \(a=-1\lt0\) : la parabole est tournée vers le bas. Elle monte avant le sommet, puis descend.",
                    r"\(a\lt0\) : \(h\) est croissante sur \(]-\infty\,;\alpha]=]-\infty\,;3]\) et décroissante sur \([3\,;+\infty[\).",
                    [(["[3;+∞["], r"C'est l'intervalle où \(h\) <em>décroît</em>. Avec \(a\lt0\), la parabole monte d'abord, jusqu'au sommet.")],
                ),
            ),
            f(
                "image",
                r"Détermine l'image de l'intervalle \([0\,;5]\) par \(k(x)=x^2-4x+3\). Écris-la sous forme d'intervalle.",
                "Par exemple : [0 ; 9]",
                "line",
                chk(
                    "interval",
                    ["[-1;8]"],
                    r"Oui : le minimum est atteint au sommet (\(k(2)=-1\)) et le maximum à une borne (\(k(5)=8\)). L'image est \([-1\,;8]\).",
                    r"Calcule l'abscisse du sommet et regarde si elle est dans \([0\,;5]\). Puis compare les valeurs au sommet et aux deux bornes.",
                    r"\(\alpha=2\in[0\,;5]\) et \(a=1\gt0\) : minimum \(k(2)=4-8+3=-1\). Aux bornes : \(k(0)=3\), \(k(5)=25-20+3=8\). Le maximum est 8. Image : \([-1\,;8]\).",
                    [(["[3;8]"], r"Tu as utilisé les valeurs aux bornes (3 et 8). Mais \(k\) descend jusqu'au sommet d'abscisse 2 (dans l'intervalle) où elle vaut \(-1\).")],
                ),
            ),
        ],
        "hints": [
            r"\(\alpha=-\dfrac b{2a}\) : n'oublie pas le 2 au dénominateur.",
            r"Pour \(\beta\), calcule \(f(\alpha)\) avec la forme développée, c'est le plus sûr.",
            r"Pour l'image d'un intervalle, compare toujours : valeur au sommet (si dans l'intervalle) et valeurs aux deux bornes.",
        ],
        "takeaway": r"\(f(x)=a(x-\alpha)^2+\beta\) avec \(\alpha=-\dfrac b{2a}\) et \(\beta=f(\alpha)\). Si \(a\gt0\), minimum \(\beta\) en \(\alpha\) ; si \(a\lt0\), maximum \(\beta\). Sur un intervalle, comparer sommet et bornes.",
        "tests": [],
    }
)

# ───────────────────────── 6. Problèmes I ─────────────────────────
steps.append(
    {
        "id": "problemes",
        "short": "Problèmes 1",
        "title": "Petits problèmes : géométrie et nombres",
        "minutes": 12,
        "level": "Transfert",
        "concepts": ["mise en équation", "choix de l'inconnue", "domaine de validité", "optimisation"],
        "intro": "Le second degré sert à résoudre de vrais problèmes. La difficulté n'est pas le calcul : c'est de choisir l'inconnue et de mettre en équation.",
        "lesson": (
            box(
                "Méthode",
                r"<ol><li>Choisir l'inconnue \(x\) et préciser dans quel intervalle elle peut varier.</li>"
                r"<li>Exprimer la grandeur cherchée en fonction de \(x\).</li>"
                r"<li>Résoudre (équation, inéquation ou recherche d'extremum).</li>"
                r"<li>Vérifier que la solution est <em>possible</em> dans le problème, puis répondre par une phrase.</li></ol>",
            )
            + r"<h3>Problème 1 — Le rectangle d'aire maximale</h3>"
            r"<p>Un rectangle a un périmètre de 20 m. On note \(x\) (en m) sa longueur, avec \(0\lt x\lt10\) ; sa largeur est donc \(10-x\).</p>"
            r"{{f:aire}}{{f:xmax}}{{f:amax}}{{q:nature}}"
            r"<h3>Problème 2 — Deux entiers consécutifs</h3>"
            r"<p>Le produit de deux entiers consécutifs vaut 156. Si \(n\) est le plus petit, l'équation est \(n(n+1)=156\), soit \(n^2+n-156=0\).</p>{{f:entiers}}"
            r"<h3>Problème 3 — Un chemin autour d'une pelouse</h3>"
            r"<p>Un terrain rectangulaire mesure 60 m sur 40 m. On trace tout autour, à l'intérieur, un chemin de largeur constante \(x\) (en m). "
            r"La pelouse restante est un rectangle de dimensions \(60-2x\) et \(40-2x\), et on veut qu'elle ait une aire de 1\u202f500\u00a0m².</p>"
            r"<p>L'équation est \((60-2x)(40-2x)=1\,500\), c'est-à-dire \(4x^2-200x+900=0\).</p>{{f:simplifie}}{{f:chemin}}{{q:rejet}}"
        ),
        "task": "Mets en équation, résous, puis vérifie que chaque solution a un sens dans le problème.",
        "starter": None,
        "figures": [],
        "questions": [
            q(
                "nature",
                r"Quelle est la nature du rectangle d'aire maximale ?",
                ["Un carré", "Un rectangle dont la longueur est le double de la largeur", "Il n'y a pas de maximum"],
                0,
                r"Le maximum est atteint pour \(x=5\) : la largeur vaut alors \(10-5=5\). Longueur et largeur sont égales : c'est un carré de 5 m de côté.",
                [
                    "",
                    r"Si \(x=5\), la largeur vaut \(10-x=5\) : longueur et largeur sont égales, pas dans un rapport de 2.",
                    r"\(A(x)=-x^2+10x\) a \(a=-1\lt0\) : c'est une parabole tournée vers le bas, donc elle a un maximum.",
                ],
            ),
            q(
                "rejet",
                r"Les solutions de l'équation sont \(x=5\) et \(x=45\). Pourquoi rejeter \(x=45\) ?",
                [
                    r"Parce que le chemin ne peut pas dépasser 20 m de largeur (il faut \(0\lt x\lt20\))",
                    r"Parce que 45 n'est pas un nombre entier",
                    r"On ne rejette rien : les deux valeurs conviennent",
                ],
                0,
                r"Pour que la pelouse existe, il faut \(40-2x\gt0\), donc \(x\lt20\). Avec \(x=45\), les dimensions \(60-90\) et \(40-90\) seraient négatives : impossible. Seul \(x=5\) m convient.",
                [
                    "",
                    r"45 est bien un entier ; le problème est ailleurs : regarde le signe de \(40-2x\).",
                    r"Pour \(x=45\), la largeur \(40-2\times45=-50\) est négative : ce n'est pas possible.",
                ],
            ),
        ],
        "fields": [
            f(
                "aire",
                r"Exprime l'aire \(A(x)\) du rectangle en fonction de \(x\).",
                "Par exemple : x(5-x)",
                "line",
                chk(
                    "polynomial",
                    ["x(10-x)"],
                    r"Oui : \(A(x)=x(10-x)=-x^2+10x\). C'est un trinôme avec \(a=-1\lt0\) : il a un maximum.",
                    r"L'aire d'un rectangle est longueur × largeur : ici \(x\) et \(10-x\).",
                    r"\(A(x)=\text{longueur}\times\text{largeur}=x(10-x)=-x^2+10x\).",
                ),
            ),
            f(
                "xmax",
                r"Pour quelle valeur de \(x\) l'aire est-elle maximale ?",
                "Un nombre",
                "line",
                chk(
                    "number",
                    ["5"],
                    r"Oui : \(\alpha=-\dfrac{10}{2\times(-1)}=5\).",
                    r"Le maximum d'un trinôme avec \(a\lt0\) est atteint au sommet : \(\alpha=-\dfrac b{2a}\).",
                    r"\(A(x)=-x^2+10x\) : \(a=-1\), \(b=10\). \(\alpha=-\dfrac{10}{-2}=5\).",
                ),
            ),
            f(
                "amax",
                r"Quelle est alors l'aire maximale, en m² ?",
                "Un nombre",
                "line",
                chk(
                    "number",
                    ["25"],
                    r"Oui : \(A(5)=5\times5=25\) m².",
                    r"Remplace \(x\) par la valeur trouvée à la question précédente dans \(A(x)=x(10-x)\), puis calcule.",
                    r"\(A(5)=5\times(10-5)=25\). L'aire maximale est de 25 m².",
                ),
            ),
            f(
                "entiers",
                r"Résous \(n^2+n-156=0\) : donne toutes les valeurs possibles de \(n\), le plus petit des deux entiers.",
                "Par exemple : 3 ; -8",
                "line",
                chk(
                    "set",
                    ["12;-13"],
                    r"Oui : \(\Delta=625\), \(n=\dfrac{-1\pm25}{2}\) : \(n=12\) (entiers 12 et 13) ou \(n=-13\) (entiers \(-13\) et \(-12\)).",
                    r"Calcule \(\Delta=1+624\) : c'est un carré parfait. Puis \(n=\dfrac{-1\pm\sqrt\Delta}{2}\).",
                    r"\(\Delta=1^2-4\times1\times(-156)=625=25^2\). \(n_1=\dfrac{-1-25}{2}=-13\), \(n_2=\dfrac{-1+25}{2}=12\). Les couples sont (12 ; 13) et (\(-13\) ; \(-12\)).",
                    [(["12"], r"Il y a une deuxième solution : les entiers peuvent être négatifs. \((-13)\times(-12)=156\) aussi.")],
                ),
            ),
            f(
                "simplifie",
                r"Simplifie l'équation par 4 : écris le membre de gauche de l'équation équivalente de la forme \(x^2+bx+c=0\).",
                "Par exemple : x^2-3x+2",
                "line",
                chk(
                    "polynomial",
                    ["x^2-50x+225"],
                    r"Oui : \(4x^2-200x+900=0\iff x^2-50x+225=0\) (on divise chaque terme par 4).",
                    r"Divise <em>chaque</em> terme par 4 : \(4x^2\), \(-200x\) et \(900\).",
                    r"\(\dfrac{4x^2-200x+900}{4}=x^2-50x+225\). L'équation devient \(x^2-50x+225=0\).",
                    [(["4x^2-200x+900"], r"C'est correct mais pas simplifié : divise tous les coefficients par 4.")],
                ),
            ),
            f(
                "chemin",
                r"Résous \(x^2-50x+225=0\). Donne les deux solutions de l'équation.",
                "Par exemple : 1 ; 2",
                "line",
                chk(
                    "set",
                    ["5;45"],
                    r"Oui : \(\Delta=2500-900=1600\), \(x=\dfrac{50\pm40}{2}\) : 5 et 45. Seule la valeur 5 est possible (question suivante).",
                    r"Calcule \(\Delta=(-50)^2-4\times225\) : c'est un carré parfait (\(40^2\)). Puis \(x=\dfrac{50\pm40}{2}\).",
                    r"\(\Delta=2\,500-900=1\,600=40^2\). \(x_1=\dfrac{50-40}{2}=5\), \(x_2=\dfrac{50+40}{2}=45\). On vérifie : \(5+45=50\) et \(5\times45=225\).",
                ),
            ),
        ],
        "hints": [
            r"Pour \(A(x)=x(10-x)\), développe : \(10x-x^2\).",
            r"Pour deux entiers consécutifs, essaie \(12\times13\) pour te rassurer.",
            r"Vérifie toujours que ta solution respecte les contraintes : une longueur est positive.",
        ],
        "takeaway": r"Un problème se résout en quatre temps : inconnue et domaine, mise en équation, résolution, vérification de la solution dans le contexte (rejet éventuel). Un maximum de trinôme (\(a\lt0\)) est atteint en \(\alpha=-\frac b{2a}\).",
        "tests": [],
    }
)

# ───────────────────────── 7. Problèmes II ─────────────────────────
steps.append(
    {
        "id": "problemes-2",
        "short": "Problèmes 2",
        "title": "Petits problèmes : mouvement et bénéfice",
        "minutes": 12,
        "level": "Transfert",
        "concepts": ["modélisation", "maximum", "inéquation", "interprétation"],
        "intro": "Deux modèles réels : la hauteur d'une balle et le bénéfice d'une entreprise. Mêmes outils, nouveaux contextes.",
        "lesson": (
            r"<h3>Problème 4 — Une balle lancée</h3>"
            r"<p>Du toit d'un immeuble, on lance une balle vers le haut. Sa hauteur au-dessus du sol, en mètres, à l'instant \(t\) (en secondes) est \[h(t)=-5t^2+20t+25.\]</p>"
            r"{{fig:balle}}{{f:tmax}}{{f:hmaxb}}{{f:tsol}}{{f:t40}}"
            r"<h3>Problème 5 — Un bénéfice</h3>"
            r"<p>Une entreprise fabrique et vend \(x\) centaines d'objets par mois (\(0\le x\le8\)). Son bénéfice mensuel, en milliers de dinars, est \[B(x)=-2x^2+12x-10.\]</p>"
            r"{{f:rentable}}{{f:xopt}}{{f:bmax}}{{f:perte}}{{q:conclusion}}"
        ),
        "task": "Interprète un maximum, des instants, un intervalle de rentabilité, en vérifiant chaque réponse.",
        "starter": None,
        "figures": [
            fig(
                "balle",
                r"Hauteur \(h(t)\) en fonction du temps (seule la partie \(t\ge0\) a un sens).",
                "h(t)",
                [25, 20, -5],
                {"xmin": -1, "xmax": 6, "ymin": -5, "ymax": 50},
                [{"x": 2, "label": "S"}],
            )
        ],
        "questions": [
            q(
                "conclusion",
                r"Quelle conclusion est correcte pour l'entreprise ?",
                [
                    r"Elle réalise un bénéfice si elle produit entre 100 et 500 objets (exclus), avec un bénéfice maximal de 8\u00a0000\u00a0dinars pour 300 objets",
                    r"Elle réalise un bénéfice dès qu'elle produit plus de 100 objets",
                    r"Plus elle produit, plus elle gagne",
                ],
                0,
                r"\(B(x)\gt0\) pour \(x\in]1\,;5[\), c'est-à-dire entre 100 et 500 objets (exclus). Le maximum \(B(3)=8\) (milliers de dinars) est atteint pour 300 objets. Au-delà de 500 objets, le bénéfice redevient négatif.",
                [
                    "",
                    r"Au-delà de \(x=5\) (500 objets), \(B(x)\) redevient négatif : produire beaucoup trop fait perdre de l'argent.",
                    r"Faux : \(B\) est une parabole tournée vers le bas. Après le sommet, le bénéfice diminue, puis devient négatif.",
                ],
            )
        ],
        "fields": [
            f(
                "tmax",
                r"À quel instant la balle atteint-elle sa hauteur maximale ? (en secondes)",
                "Un nombre",
                "line",
                chk(
                    "number",
                    ["2"],
                    r"Oui : \(t=-\dfrac{20}{2\times(-5)}=2\) s.",
                    r"La hauteur est un trinôme avec \(a=-5\lt0\) : son maximum est au sommet \(\alpha=-\dfrac b{2a}\).",
                    r"\(a=-5\), \(b=20\) : \(\alpha=-\dfrac{20}{-10}=2\). La balle est au plus haut à \(t=2\) s.",
                ),
            ),
            f(
                "hmaxb",
                r"Quelle est cette hauteur maximale ? (en mètres)",
                "Un nombre",
                "line",
                chk(
                    "number",
                    ["45"],
                    r"Oui : \(h(2)=-5\times4+40+25=45\) m.",
                    r"Remplace \(t\) par l\'instant du maximum dans \(h(t)=-5t^2+20t+25\), puis calcule.",
                    r"\(h(2)=-5\times2^2+20\times2+25=-20+40+25=45\). La hauteur maximale est de 45 m.",
                    [(["25"], r"25 m est la hauteur de départ (\(h(0)=25\)). La hauteur maximale est atteinte plus tard, à \(t=2\).")],
                ),
            ),
            f(
                "tsol",
                r"À quel instant la balle touche-t-elle le sol ? (une durée positive, en secondes)",
                "Un nombre",
                "line",
                chk(
                    "number",
                    ["5"],
                    r"Oui : \(h(t)=0\iff t^2-4t-5=0\), de racines \(-1\) et \(5\). On garde \(t=5\) (un instant négatif n'a pas de sens ici).",
                    r"Résous \(h(t)=0\) : divise par \(-5\) pour simplifier, puis résous. Une durée est positive : élimine la solution négative.",
                    r"\(-5t^2+20t+25=0\iff t^2-4t-5=0\). \(\Delta=16+20=36\), \(t=\dfrac{4\pm6}{2}\) : \(5\) ou \(-1\). On garde \(t=5\) s.",
                    [(["-1"], r"\(-1\) est bien une solution de l'équation, mais un instant négatif n'a pas de sens pour ce lancer. On garde la solution positive.")],
                ),
            ),
            f(
                "t40",
                r"À quels instants la balle est-elle à 40 m du sol ? Donne les deux instants.",
                "Par exemple : 0,5 ; 3",
                "line",
                chk(
                    "set",
                    ["1;3"],
                    r"Oui : \(h(t)=40\iff-5t^2+20t-15=0\iff t^2-4t+3=0\), soit \(t=1\) (à la montée) et \(t=3\) (à la descente).",
                    r"Écris \(h(t)=40\), passe tout à gauche et simplifie par \(-5\) : \(t^2-4t+3=0\).",
                    r"\(-5t^2+20t+25=40\iff-5t^2+20t-15=0\iff t^2-4t+3=0\). Racines évidentes : \(1\) (car \(1-4+3=0\)) et \(3\) (somme 4). La balle passe à 40 m en montant (\(t=1\)) puis en descendant (\(t=3\)).",
                ),
            ),
            f(
                "rentable",
                r"Pour quelles valeurs de \(x\) le bénéfice est-il strictement positif ? Écris un intervalle.",
                "Par exemple : ]2 ; 6[",
                "line",
                chk(
                    "interval",
                    ["]1;5["],
                    r"Oui : \(B(x)\gt0\iff x\in]1\,;5[\). Racines de \(B\) : 1 et 5, \(a=-2\lt0\) donc positif entre les racines.",
                    r"Cherche les racines de \(B\) (simplifie par \(-2\)), puis souviens-toi du signe d'un trinôme avec \(a\lt0\).",
                    r"\(B(x)=0\iff x^2-6x+5=0\) : racines 1 et 5. \(a=-2\lt0\) : \(B(x)\gt0\) entre les racines. \(S=]1\,;5[\).",
                    [(["]-∞;1[∪]5;+∞["], r"Avec \(a=-2\lt0\), la parabole est tournée vers le bas : positive <em>entre</em> les racines et non à l'extérieur.")],
                ),
            ),
            f(
                "xopt",
                r"Pour quelle valeur de \(x\) le bénéfice est-il maximal ? (en centaines d'objets)",
                "Un nombre",
                "line",
                chk(
                    "number",
                    ["3"],
                    r"Oui : \(\alpha=-\dfrac{12}{2\times(-2)}=3\) : 300 objets. (C'est aussi le milieu des racines 1 et 5.)",
                    r"Sommet d'un trinôme avec \(a=-2\lt0\) : \(\alpha=-\dfrac b{2a}\).",
                    r"\(a=-2\), \(b=12\) : \(\alpha=-\dfrac{12}{-4}=3\). Le bénéfice est maximal pour \(x=3\), soit 300 objets.",
                ),
            ),
            f(
                "bmax",
                r"Quel est ce bénéfice maximal, en milliers de dinars ?",
                "Un nombre",
                "line",
                chk(
                    "number",
                    ["8"],
                    r"Oui : \(B(3)=-18+36-10=8\) milliers de dinars, soit 8\u00a0000\u00a0dinars.",
                    r"Remplace \(x\) par l\'abscisse du sommet dans \(B(x)=-2x^2+12x-10\), puis calcule.",
                    r"\(B(3)=-2\times9+12\times3-10=-18+36-10=8\) : 8 milliers de dinars.",
                    [(["3"], r"3 est le nombre de centaines d'objets. On demande la valeur du bénéfice : calcule \(B(3)\).")],
                ),
            ),
            f(
                "perte",
                r"Calcule \(B(8)\) : que se passe-t-il si l'entreprise produit 800 objets ?",
                "Un nombre",
                "line",
                chk(
                    "number",
                    ["-42"],
                    r"Oui : \(B(8)=-128+96-10=-42\) : une perte de 42 milliers de dinars. Produire plus ne rapporte pas toujours plus.",
                    r"Remplace \(x\) par 8 dans \(-2x^2+12x-10\), en faisant attention aux signes.",
                    r"\(B(8)=-2\times64+12\times8-10=-128+96-10=-42\). Le résultat est négatif : l'entreprise perd de l'argent.",
                    [(["42"], r"Le signe compte : \(B(8)=-42\) est négatif, c'est une perte et non un bénéfice.")],
                ),
            ),
        ],
        "hints": [
            r"Pour \(h(t)=0\) ou \(h(t)=40\), ramène toujours à une équation égale à 0, puis simplifie par un facteur commun.",
            r"Un temps négatif ou une quantité négative d'objets n'ont pas de sens : écarte-les.",
            r"Le maximum d'une parabole tournée vers le bas est au milieu de ses deux racines.",
        ],
        "takeaway": r"Dans un modèle du second degré, le sommet donne l'optimum (maximum ou minimum) ; les racines donnent les instants ou les quantités où la grandeur s'annule ; le signe du trinôme donne les plages de rentabilité. Toujours interpréter dans le contexte.",
        "tests": [],
    }
)

# ───────────────────────── 8. Fiche méthodes ─────────────────────────
steps.append(
    {
        "id": "methodes",
        "short": "Méthodes",
        "title": "Fiche de synthèse : le second degré",
        "minutes": 5,
        "level": "Synthèse",
        "concepts": ["fiche méthode", "discriminant", "signe", "sommet"],
        "intro": "Voici la fiche à garder. Tu peux l'imprimer avec le bouton prévu à cet effet.",
        "lesson": (
            r"<h3>Fiche méthode — Le second degré</h3>"
            r"<h4>Les formes d'un trinôme</h4>"
            + table(
                ["Forme", "Écriture", "Ce qu'elle donne"],
                [
                    ["Développée", r"\(ax^2+bx+c\)", r"l'ordonnée à l'origine \(c\)"],
                    ["Factorisée", r"\(a(x-x_1)(x-x_2)\)", "les racines"],
                    ["Canonique", r"\(a(x-\alpha)^2+\beta\)", "le sommet et l'extremum"],
                ],
            )
            + r"<h4>Équation \(ax^2+bx+c=0\)</h4>"
            + table(
                [r"Discriminant \(\Delta=b^2-4ac\)", "Solutions", "Factorisation"],
                [
                    [r"\(\gt0\)", r"\(\dfrac{-b\pm\sqrt\Delta}{2a}\)", r"\(a(x-x_1)(x-x_2)\)"],
                    [r"\(=0\)", r"\(-\dfrac b{2a}\)", r"\(a(x-x_0)^2\)"],
                    [r"\(\lt0\)", "aucune", "impossible dans \\(\\mathbb R\\)"],
                ],
            )
            + r"<h4>Signe de \(ax^2+bx+c\)</h4>"
            + table(
                [r"Discriminant", "Signe du trinôme"],
                [
                    [r"\(\gt0\)", r"signe de \(a\) à l'extérieur des racines, signe contraire entre elles"],
                    [r"\(=0\)", r"signe de \(a\), nul en \(x_0\)"],
                    [r"\(\lt0\)", r"signe de \(a\) pour tout réel \(x\)"],
                ],
            )
            + r"<h4>Somme et produit</h4><p>\(x_1+x_2=-\dfrac ba\), \(x_1x_2=\dfrac ca\). Racines évidentes : \(a+b+c=0\Rightarrow1\) ; \(a-b+c=0\Rightarrow-1\).</p>"
            r"<h4>Variations</h4><p>Sommet \(S(\alpha\,;\beta)\), \(\alpha=-\dfrac b{2a}\), \(\beta=f(\alpha)\). \(a\gt0\) : décroissante puis croissante, minimum \(\beta\). \(a\lt0\) : croissante puis décroissante, maximum \(\beta\).</p>"
            r"<h4>Les cinq erreurs les plus fréquentes</h4><ul>"
            r"<li>Oublier le signe de \(b\) ou de \(c\) en calculant \(\Delta\).</li>"
            r"<li>Résoudre sans avoir tout passé dans le même membre (il faut comparer à 0).</li>"
            r"<li>Diviser par \(x\) et perdre la solution \(x=0\).</li>"
            r"<li>Se tromper de zone : pour \(a\lt0\), le trinôme est positif <em>entre</em> les racines.</li>"
            r"<li>Oublier de vérifier que la solution a un sens dans le problème.</li></ul>"
            r"{{f:retenir}}"
        ),
        "task": "Lis la fiche, puis écris la méthode que tu risques le plus d'oublier.",
        "starter": None,
        "figures": [],
        "questions": [],
        "fields": [
            f(
                "retenir",
                r"Quelle erreur de la liste risques-tu de faire ? Écris comment tu l'évites.",
                "Quelques mots",
                "area",
            )
        ],
        "hints": [],
        "takeaway": r"Calcul, graphique et sens vont ensemble : racines ↔ intersections avec l'axe ; signe ↔ position de la parabole ; sommet ↔ variations et extremum.",
        "printable": True,
        "tests": [],
    }
)

# ───────────────────────── 9. Bonus ─────────────────────────
steps.append(
    {
        "id": "bonus",
        "short": "Approfondissement",
        "title": "Équations qui se ramènent au second degré",
        "minutes": 0,
        "level": "Approfondissement (facultatif, hors durée)",
        "concepts": ["changement de variable", "équation bicarrée"],
        "intro": "Facultatif : une équation de degré 4 peut se ramener au second degré par un changement de variable.",
        "lesson": (
            r"<p>Dans une équation <em>bicarrée</em> \(ax^4+bx^2+c=0\), on pose \(X=x^2\) : on obtient \(aX^2+bX+c=0\). "
            r"Attention : \(X=x^2\) doit être <strong>positif ou nul</strong>, donc on rejette toute solution \(X\lt0\).</p>"
            r"<p>Résous \(x^4-5x^2+4=0\) : avec \(X=x^2\), \(X^2-5X+4=0\), de solutions \(X=1\) et \(X=4\). Reviens à \(x\).</p>{{f:bic1}}"
            r"<p>Résous \(x^4+x^2-6=0\) : \(X^2+X-6=0\) a deux solutions, mais une seule est acceptable.</p>{{f:bic2}}"
        ),
        "task": "Pose \\(X=x^2\\), résous, rejette ce qui est impossible, puis reviens à \\(x\\).",
        "starter": None,
        "figures": [],
        "questions": [],
        "fields": [
            f(
                "bic1",
                r"Donne toutes les solutions réelles de \(x^4-5x^2+4=0\).",
                "Quatre nombres séparés par des points-virgules",
                "line",
                chk(
                    "set",
                    ["-2;-1;1;2"],
                    r"Oui : \(x^2=1\) donne \(\pm1\), \(x^2=4\) donne \(\pm2\). Quatre solutions.",
                    r"Pose \(X=x^2\) et résous \(X^2-5X+4=0\) : \(X=1\) ou \(X=4\). Puis résous \(x^2=1\) et \(x^2=4\) : chacune a deux solutions.",
                    r"\(X^2-5X+4=0\) a pour solutions \(X=1\) et \(X=4\). Puis \(x^2=1\iff x=\pm1\) et \(x^2=4\iff x=\pm2\). \(S=\{-2\,;-1\,;1\,;2\}\).",
                    [(["1;2"], r"Chaque équation \(x^2=k\) (avec \(k\gt0\)) a <strong>deux</strong> solutions : \(\sqrt k\) et \(-\sqrt k\).")],
                ),
            ),
            f(
                "bic2",
                r"Donne toutes les solutions réelles de \(x^4+x^2-6=0\).",
                "Par exemple : -√3 ; √3",
                "line",
                chk(
                    "set",
                    ["-√2;√2"],
                    r"Oui : \(X^2+X-6=0\) donne \(X=2\) ou \(X=-3\). \(X=-3\) est impossible (un carré n'est pas négatif), donc \(x^2=2\) et \(x=\pm\sqrt2\).",
                    r"Pose \(X=x^2\) : \(X^2+X-6=0\). Pour chaque solution \(X\), demande-toi si \(x^2=X\) est possible.",
                    r"\(X^2+X-6=0\) : \(\Delta=25\), \(X=\dfrac{-1\pm5}{2}\) : \(2\) ou \(-3\). \(x^2=-3\) n'a pas de solution réelle. \(x^2=2\iff x=\pm\sqrt2\). \(S=\{-\sqrt2\,;\sqrt2\}\).",
                    [(["√2"], r"\(x^2=2\) a deux solutions : \(\sqrt2\) et \(-\sqrt2\).")],
                ),
            ),
        ],
        "hints": [r"Un carré est toujours positif ou nul : \(x^2=-3\) est impossible dans \(\mathbb R\)."],
        "takeaway": r"Changement de variable \(X=x^2\) : on résout en \(X\), on écarte \(X\lt0\), puis on revient à \(x=\pm\sqrt X\).",
        "tests": [],
    }
)

content = {
    "version": "1.0.0",
    "title": "Le second degré",
    "subtitle": "Racines · équations · inéquations · somme et produit · variations · problèmes",
    "session": "Mathématiques • Première générale",
    "duration": sum(s["minutes"] for s in steps),
    "ui": {"phases": True},
    "steps": steps,
}

out = HERE / "content.json"
out.write_text(json.dumps(deep(content), ensure_ascii=False, indent=1) + "\n", encoding="utf-8")
print(f"{out} : {len(steps)} étapes, durée {content['duration']} min")
