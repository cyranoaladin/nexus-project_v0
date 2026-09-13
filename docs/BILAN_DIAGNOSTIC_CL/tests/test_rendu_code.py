"""Un programme imprimé reste un programme : lignes, indentation, chasse fixe.

Les banques écrivent le code entre clôtures Markdown, lignes et indentation comprises.
Le livret le compose dans l'environnement `codenexus` : chaque ligne reste une ligne,
chaque espace d'indentation garde sa largeur, aucune typographie française ne s'y
applique. Un « def s(L) : total = 0 for x in L : … » aplati en prose ne se relit pas,
et la question qui demande où se trouve le `return` mal placé devient sans réponse.
"""
import json
import re
import sys
from pathlib import Path

import pytest

ROOT = Path(__file__).resolve().parent.parent
sys.path.insert(0, str(ROOT / "scripts"))
import livret as LI  # noqa: E402

RELEASE = ROOT / "release" / "diagnostics-v2"
MOTS_CLES = re.compile(r"\b(def|for|if|return|class|while)\b")
GUILLEMETS_PARASITES = ("“‘", "”’", "“ ‘", "‘‘‘", "```")


def blocs_de_banque():
    """Chaque bloc de code clôturé de chaque banque, avec l'item qui le porte."""
    blocs = []
    for banque in sorted(ROOT.glob("instruments/*/banque.json")):
        for it in json.loads(banque.read_text(encoding="utf-8"))["items"]:
            for m in LI.CLOTURE.finditer(it.get("enonce", "")):
                blocs.append((banque.parent.name, it["item_id"], m.group(1).rstrip("\n")))
    return blocs


BLOCS = blocs_de_banque()


def test_les_banques_portent_du_code_a_composer():
    assert {b[0] for b in BLOCS} >= {"EDS-NSI", "EDS-MATH"}
    assert any("return total" in b[2] for b in BLOCS)


def test_la_source_conserve_lignes_et_indentation():
    for _, iid, code in BLOCS:
        lignes = code.split("\n")
        assert len(lignes) > 1, iid
        assert any(l.startswith("    ") for l in lignes) or not MOTS_CLES.search(code), iid


@pytest.mark.parametrize("instrument,iid,code", BLOCS, ids=[b[1] for b in BLOCS])
def test_chaque_bloc_se_compose_ligne_a_ligne(instrument, iid, code):
    latex = LI.bloc_code(code)
    assert latex.startswith(r"\needspace{") and latex.endswith(r"\end{codenexus}")
    assert latex.splitlines()[1] == r"\begin{codenexus}"
    corps = latex.splitlines()[2:-1]
    rendues = [l for l in corps if l != r"\par"]
    assert len(rendues) == len(code.split("\n")), "une ligne de code, une ligne composée"
    for source, rendue in zip(code.split("\n"), rendues):
        marge = len(source) - len(source.lstrip(" "))
        if source.strip():
            assert rendue.startswith("\\ " * marge) and not rendue.startswith("\\ " * (marge + 1)), source
            assert "~" not in rendue and r"\texttt" not in rendue and "“" not in rendue, source
        else:
            assert rendue == r"\mbox{}"


def test_tex_compose_le_code_a_part_de_la_prose():
    enonce = "Où est l'erreur ?\n\n```\ndef s(L):\n    total = 0\n    return total\n```\n\nSuite : `x`."
    latex = LI.tex(enonce)
    assert latex.count(r"\begin{codenexus}") == 1
    assert "Où est l'erreur~?" in latex and r"\texttt{x}" in latex
    assert "def s(L):" in latex and "def s(L)~:" not in latex
    assert "\\ \\ \\ \\ total = 0" in latex
    assert not any(g in latex for g in GUILLEMETS_PARASITES)


def test_le_gabarit_definit_l_environnement():
    gabarit = (ROOT / "templates" / "nexus-livret.tex").read_text(encoding="utf-8")
    assert r"\newenvironment{codenexus}" in gabarit
    assert r"\monolivret" in gabarit.split(r"\newenvironment{codenexus}")[1][:600]


# ─────────────────────────────────────────────── dans les PDF de la release

def pdfs_avec_code():
    if not (RELEASE / "01_LIVRETS_CANDIDAT").exists():
        return []
    noms = ("SPECIALITE_NSI.pdf", "MATHEMATIQUES_AVEC_SPECIALITE.pdf")
    return sorted(p for p in RELEASE.rglob("*.pdf")
                  if p.name in noms and "03_IMPRESSION" not in str(p))


def lignes_du_pdf(pdf):
    """Les lignes de texte du PDF avec leur abscisse, page par page."""
    fitz = pytest.importorskip("fitz")
    lignes = []
    with fitz.open(pdf) as d:
        for page in d:
            for b in page.get_text("dict")["blocks"]:
                for l in b.get("lines", []):
                    texte = "".join(s["text"] for s in l["spans"])
                    if texte.strip():
                        lignes.append((page.number, round(l["bbox"][0], 1), texte.rstrip()))
    return lignes


@pytest.mark.parametrize("pdf", pdfs_avec_code(), ids=lambda p: str(p.relative_to(RELEASE)))
def test_le_pdf_garde_chaque_ligne_de_code_et_son_indentation(pdf):
    lignes = lignes_du_pdf(pdf)
    textes = [t.strip() for _, _, t in lignes]
    plat = " ".join(textes)
    assert not any(g in plat for g in GUILLEMETS_PARASITES), pdf.name
    instrument = "EDS-NSI" if "NSI" in pdf.name else "EDS-MATH"
    verifies = 0
    for inst, iid, code in BLOCS:
        if inst != instrument or iid not in plat:
            continue
        source = [l for l in code.split("\n") if l.strip()]
        # Chaque ligne de code est une ligne du PDF, dans l'ordre, sans prose autour.
        premiere = next((i for i, t in enumerate(textes) if t == source[0].strip()), None)
        assert premiere is not None, f"{pdf.name} {iid} : {source[0]!r} n'est pas une ligne"
        fenetre = lignes[premiere:premiere + len(source)]
        assert [t.strip() for _, _, t in fenetre] == [l.strip() for l in source], f"{pdf.name} {iid}"
        # L'indentation se lit à l'abscisse : quatre espaces de plus, une marge de plus.
        x0 = fenetre[0][1]
        for (_, x, _), l in zip(fenetre, source):
            marge = len(l) - len(l.lstrip(" "))
            assert (x - x0 > 3) == (marge > 0), f"{pdf.name} {iid} : {l!r}"
        # Deux lignes de même marge partagent la même abscisse, à l'approche de glyphe
        # près (1,5 pt) ; une marge de plus, c'est une abscisse nettement plus grande.
        marges = sorted({(len(l) - len(l.lstrip(" "))) for l in source})
        abscisses = [[x for (_, x, _), s in zip(fenetre, source)
                      if len(s) - len(s.lstrip(" ")) == m] for m in marges]
        assert all(max(a) - min(a) < 1.5 for a in abscisses), f"{pdf.name} {iid} : indentation irrégulière"
        moyennes = [sum(a) / len(a) for a in abscisses]
        assert all(b - a > 3 for a, b in zip(moyennes, moyennes[1:])), f"{pdf.name} {iid}"
        # La forme aplatie ne doit survivre nulle part : deux lignes de code ne se
        # retrouvent jamais sur une même ligne du PDF.
        for a, b in zip(source, source[1:]):
            assert not any(a.strip() in t and b.strip() in t for t in textes), \
                f"{pdf.name} {iid} : {a.strip()!r} et {b.strip()!r} sur une même ligne"
        verifies += 1
    assert verifies > 0, pdf.name


def test_nsi_question_6_montre_le_return_dans_la_boucle():
    pdf = RELEASE / "01_LIVRETS_CANDIDAT/PROFIL_B_DEUXIEME_PARTIE/04_SPECIALITES/SPECIALITE_NSI.pdf"
    if not pdf.exists():
        pytest.skip("release v2 non construite")
    lignes = lignes_du_pdf(pdf)
    idx = next(i for i, (_, _, t) in enumerate(lignes) if t.strip() == "def s(L):")
    bloc = lignes[idx:idx + 5]
    assert [t.strip() for _, _, t in bloc] == ["def s(L):", "total = 0", "for x in L:",
                                               "total = total + x", "return total"]
    x_def, x_total, x_for, x_add, x_return = (x for _, x, _ in bloc)
    assert x_total == x_for and x_total > x_def + 3
    assert x_add == x_return and x_add > x_total + 3, "le return est bien dans la boucle"
