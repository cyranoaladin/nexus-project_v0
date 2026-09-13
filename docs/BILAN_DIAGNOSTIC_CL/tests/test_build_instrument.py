"""Preuve que build_instrument.py produit des rendus corrects et reproductibles.

Le déterminisme est vérifié octet à octet sur les quatre rendus et sur le PDF.
Les autres cas vérifient qu'aucune valeur n'est écrite en dur : modifier la source
doit changer le rendu, et modifier un référentiel doit s'y refléter.
"""
import hashlib
import shutil
import subprocess
import sys
from pathlib import Path

import pytest

RACINE = Path(__file__).resolve().parent.parent
sys.path.insert(0, str(RACINE / "scripts"))
import build_instrument as BI


def empreintes(dossier: Path) -> dict[str, str]:
    return {p.name: hashlib.sha256(p.read_bytes()).hexdigest()
            for p in sorted(dossier.glob("*")) if p.is_file()}


@pytest.fixture
def construit(dossier_fixture, tmp_path):
    """Copie la fixture dans un dossier temporaire et y construit les rendus."""
    d = tmp_path / "_FIXTURE"
    shutil.copytree(dossier_fixture, d, ignore=shutil.ignore_patterns("build"))
    BI.construire(d, "standard")
    return d


# ─────────────────────────────────────────────────────── rendus produits

def test_les_quatre_rendus_sont_produits(construit):
    noms = {p.name for p in (construit / "build").iterdir()}
    assert noms == {
        "_FIXTURE_standard_sujet_candidat.md",
        "_FIXTURE_standard_cle_et_grilles_correcteur.md",
        "_FIXTURE_standard_feuille_reponses.md",
        "_FIXTURE_standard_saisie_vierge.csv",
    }


def test_le_sujet_ne_contient_aucune_cle(construit):
    txt = (construit / "build/_FIXTURE_standard_sujet_candidat.md").read_text(encoding="utf-8")
    assert "Réponse exacte" not in txt
    assert "Distracteurs" not in txt
    assert "2 points" not in txt
    for interdit in ("Compétence :", "palier D", "FIX-ERR-"):
        assert interdit not in txt, interdit


def test_le_sujet_imprime_les_identifiants_d_items(construit):
    txt = (construit / "build/_FIXTURE_standard_sujet_candidat.md").read_text(encoding="utf-8")
    assert "FIX-2-CALC-01" in txt and "FIX-1-REDA-01" in txt


def test_la_cle_porte_les_codes_avec_leur_explication(construit):
    txt = (construit / "build/_FIXTURE_standard_cle_et_grilles_correcteur.md").read_text(encoding="utf-8")
    assert "FIX-ERR-DEF" in txt
    assert "Notion définie par un exemple" in txt
    assert "double lecture" in txt.lower()


def test_la_cle_porte_les_quatre_descripteurs_de_chaque_critere(construit):
    txt = (construit / "build/_FIXTURE_standard_cle_et_grilles_correcteur.md").read_text(encoding="utf-8")
    assert txt.count("| 0 |") >= 2 and txt.count("| 3 |") >= 2


def test_la_feuille_de_reponses_ne_nomme_pas_le_candidat(construit):
    txt = (construit / "build/_FIXTURE_standard_feuille_reponses.md").read_text(encoding="utf-8")
    assert "Code candidat" in txt and "jamais le nom" in txt
    assert "Nom" not in txt and "Prénom" not in txt


def test_la_feuille_porte_une_ligne_par_critere_pour_les_items_c(construit):
    txt = (construit / "build/_FIXTURE_standard_feuille_reponses.md").read_text(encoding="utf-8")
    for code in ("IDEE", "APPUI", "STRU", "LANG"):
        assert f"↳ {code}" in txt, code


# ─────────────────────────────────────────────────────── CSV de saisie

def test_csv_colonnes_du_cahier(construit, refs_fixture):
    import csv
    attendu = [c["colonne"] for c in refs_fixture["catalogue"]["conventions"]["format_saisie"]]
    with open(construit / "build/_FIXTURE_standard_saisie_vierge.csv", encoding="utf-8") as f:
        lignes = list(csv.DictReader(f))
        f.seek(0)
        assert next(csv.reader(f)) == attendu


def test_csv_prerempli_sans_identifiant_a_taper(construit):
    import csv
    with open(construit / "build/_FIXTURE_standard_saisie_vierge.csv", encoding="utf-8") as f:
        lignes = list(csv.DictReader(f))
    assert lignes, "CSV vide"
    for l in lignes:
        assert l["item_id"] and l["instrument"]
        assert l["score"] == "" and l["candidate_ref"] == ""


def test_csv_une_ligne_par_critere_pour_les_items_c(construit):
    import csv
    with open(construit / "build/_FIXTURE_standard_saisie_vierge.csv", encoding="utf-8") as f:
        lignes = [l for l in csv.DictReader(f) if l["item_id"] == "FIX-1-REDA-01"]
    assert [l["criterion"] for l in lignes] == ["IDEE", "APPUI", "STRU", "LANG"]


# ─────────────────────────────────────────────────────── déterminisme

def test_deterministe_sur_les_rendus_texte(construit):
    avant = empreintes(construit / "build")
    shutil.rmtree(construit / "build")
    BI.construire(construit, "standard")
    assert empreintes(construit / "build") == avant


@pytest.mark.skipif(shutil.which("pandoc") is None or shutil.which("xelatex") is None,
                    reason="pandoc ou xelatex absent")
def test_deterministe_sur_le_pdf(construit):
    shutil.rmtree(construit / "build")
    BI.construire(construit, "standard", pdf=True)
    avant = empreintes(construit / "build")
    shutil.rmtree(construit / "build")
    BI.construire(construit, "standard", pdf=True)
    apres = empreintes(construit / "build")
    assert apres == avant
    assert sum(1 for n in apres if n.endswith(".pdf")) == 3


@pytest.mark.skipif(shutil.which("pandoc") is None or shutil.which("xelatex") is None,
                    reason="pandoc ou xelatex absent")
def test_caractere_absent_de_la_police_fait_echouer_le_rendu(construit, tmp_path):
    """Un glyphe manquant disparaît du PDF sans erreur : le build doit le refuser."""
    src = tmp_path / "essai.md"
    src.write_text("Un caractere absent des polices installees : ˿؅\n", encoding="utf-8")
    with pytest.raises((RuntimeError, subprocess.CalledProcessError)):
        BI.vers_pdf(src)


# ───────────────────── intégrité du PDF après réécriture de /ID

PDF_OUTILS = all(shutil.which(x) for x in ("pandoc", "xelatex", "qpdf", "pdffonts", "pdfinfo"))


@pytest.fixture
def construit_pdf(construit):
    shutil.rmtree(construit / "build")
    BI.construire(construit, "standard", pdf=True)
    return sorted((construit / "build").glob("*.pdf"))


@pytest.mark.skipif(not PDF_OUTILS, reason="outils PDF absents")
def test_pdf_structurellement_valide_apres_patch_id(construit_pdf):
    """La réécriture de /ID est une écriture dans un binaire : le PDF doit rester sain."""
    for p in construit_pdf:
        r = subprocess.run(["qpdf", "--check", str(p)], capture_output=True, text=True)
        assert r.returncode == 0, f"{p.name} :\n{r.stdout}\n{r.stderr}"


@pytest.mark.skipif(not PDF_OUTILS, reason="outils PDF absents")
def test_pdf_lisible_par_les_outils_standards(construit_pdf):
    for p in construit_pdf:
        for outil in (["pdfinfo", str(p)], ["pdftotext", str(p), "-"]):
            r = subprocess.run(outil, capture_output=True, text=True)
            assert r.returncode == 0 and not r.stderr.strip(), f"{outil[0]} sur {p.name} : {r.stderr}"


@pytest.mark.skipif(not PDF_OUTILS, reason="outils PDF absents")
def test_polices_toutes_embarquees(construit_pdf):
    """Le PDF sera imprimé au centre, sur une machine qui n'a pas les polices du poste."""
    for p in construit_pdf:
        lignes = subprocess.run(["pdffonts", str(p)], capture_output=True, text=True,
                                check=True).stdout.splitlines()[2:]
        assert lignes, f"{p.name} : aucune police déclarée"
        for l in lignes:
            champs = l.split()
            assert champs[-5] == "yes", f"{p.name} : police non embarquée — {l}"


@pytest.mark.skipif(not PDF_OUTILS, reason="outils PDF absents")
def test_identifiant_pdf_derive_du_contenu(construit_pdf):
    """qpdf --deterministic-id calcule /ID depuis les pages : deux rendus du même
    contenu portent le même identifiant, même quand le trailer est compressé."""
    for p in construit_pdf:
        avant = subprocess.run(["qpdf", "--show-npages", str(p)],
                               capture_output=True, text=True, check=True).stdout
        assert avant.strip().isdigit(), f"{p.name} : PDF illisible"
    empreinte = {p.name: hashlib.sha256(p.read_bytes()).hexdigest() for p in construit_pdf}
    for p in construit_pdf:
        BI.vers_pdf(p.with_suffix(".md"))
        assert hashlib.sha256(p.read_bytes()).hexdigest() == empreinte[p.name], \
            f"{p.name} : identifiant non déterministe"


# ─────────── contrôles nés des défauts trouvés à l'inspection visuelle

def test_chaque_item_a_porte_toutes_ses_propositions(construit, banque):
    """Défaut trouvé en Porte 2 : le sujet imprimait « ☐ A. ☐ B. » sans le texte."""
    txt = (construit / "build/_FIXTURE_standard_sujet_candidat.md").read_text(encoding="utf-8")
    for it in banque["items"]:
        if it["type"] != "A":
            continue
        bloc = txt.split(f"**{it['item_id']}**", 1)[1].split("**FIX-", 1)[0]
        attendues = sorted(it["propositions"].items())
        for lettre, texte in attendues:
            assert f"☐ **{lettre}.** {texte}" in bloc, f"{it['item_id']} / {lettre}"
        rendues = [l.split("**")[1].rstrip(".") for l in bloc.splitlines() if l.startswith("- ☐ **")]
        assert rendues == [k for k, _ in attendues], f"{it['item_id']} : ordre des propositions"


def test_chaque_item_b_a_une_zone_de_reponse(construit, banque):
    """Défaut trouvé en Porte 2 : les insécables ne produisaient aucune zone visible."""
    feuille = (construit / "build/_FIXTURE_standard_feuille_reponses.md").read_text(encoding="utf-8")
    sujet = (construit / "build/_FIXTURE_standard_sujet_candidat.md").read_text(encoding="utf-8")
    for it in banque["items"]:
        if it["type"] != "B":
            continue
        ligne = next(l for l in feuille.splitlines() if l.startswith(f"| {it['item_id']} "))
        zone = ligne.split("|")[2]
        assert zone.count(".") >= 15, f"{it['item_id']} : zone de réponse trop courte sur la feuille"
        assert BI.ZONE_ECRITURE.strip() in sujet, f"{it['item_id']} : aucune zone dans le sujet"


def test_identifiant_a_souligne_ne_casse_pas_le_balisage(construit):
    """« _FIXTURE » ouvrirait une mise en italique : l'échappement doit tenir."""
    for nom in ("sujet_candidat", "feuille_reponses", "cle_et_grilles_correcteur"):
        txt = (construit / f"build/_FIXTURE_standard_{nom}.md").read_text(encoding="utf-8")
        assert "\\_FIXTURE" in txt, nom
        assert "**_FIXTURE" not in txt, nom


@pytest.mark.skipif(not PDF_OUTILS or shutil.which("pdftoppm") is None,
                    reason="outils PDF absents")
def test_apercus_produits_pour_les_rendus_candidat(construit):
    """La rasterisation est un artefact de build : elle doit exister pour être regardée."""
    shutil.rmtree(construit / "build")
    BI.construire(construit, "standard", pdf=True)
    apercus = sorted(p.name for p in (construit / "build/preview").glob("*.png"))
    assert apercus == ["_FIXTURE_standard_feuille_reponses-1.png",
                       "_FIXTURE_standard_sujet_candidat-1.png"], apercus
    for p in (construit / "build/preview").glob("*.png"):
        assert p.stat().st_size > 10_000, f"{p.name} : image suspecte, page probablement vide"


# ────────────────────────────────────── aucune valeur écrite en dur

def test_intitule_de_bloc_lu_dans_le_referentiel(dossier_fixture):
    """Renommer un bloc dans les conventions doit changer le rendu, sans toucher au script."""
    c = BI.contexte(dossier_fixture, "standard")
    c["conv"]["blocs"]["A"] = "INTITULÉ TÉMOIN DE BLOC"
    assert "INTITULÉ TÉMOIN DE BLOC" in BI.sujet_candidat(c)


def test_echelle_du_bloc_0_lue_dans_le_referentiel(dossier_fixture):
    c = BI.contexte(dossier_fixture, "standard")
    c["conv"]["echelle_bloc_0"] = ["Un", "Deux", "Trois", "Quatre"]
    for rendu in (BI.sujet_candidat, BI.feuille_reponses):
        assert "☐ Un  ☐ Deux  ☐ Trois  ☐ Quatre" in rendu(c), rendu.__name__


def test_libelle_de_code_erreur_lu_dans_le_catalogue(dossier_fixture):
    """La clé correcteur ne recopie pas les libellés : elle les lit."""
    c = BI.contexte(dossier_fixture, "standard")
    c["codes"]["FIX-ERR-DEF"]["libelle"] = "LIBELLÉ TÉMOIN"
    assert "LIBELLÉ TÉMOIN" in BI.cle_correcteur(c)


def test_colonnes_du_csv_lues_dans_le_catalogue(dossier_fixture):
    c = BI.contexte(dossier_fixture, "standard")
    c["refs"]["catalogue"]["conventions"]["format_saisie"] = [
        {"colonne": "alpha"}, {"colonne": "instrument"},
        {"colonne": "item_id"}, {"colonne": "criterion"}]
    lignes = BI.saisie_vierge(c).splitlines()
    assert lignes[0] == "alpha,instrument,item_id,criterion"
    # Depuis R1, la saisie s'ouvre sur les domaines du bloc 0, puis les items.
    assert lignes[1].startswith(",_FIXTURE/standard v1.0,_FIXTURE-0-")
    assert any(l.startswith(",_FIXTURE/standard v1.0,FIX-2-CALC-01,") for l in lignes)


def test_duree_de_l_epreuve_lue_dans_le_catalogue(dossier_fixture):
    """La durée annoncée au candidat est la durée cible du catalogue, jamais une somme locale."""
    c = BI.contexte(dossier_fixture, "standard")
    assert "**65 min**" in BI.sujet_candidat(c)
    c["cat"]["duree_cible_min"] = 123
    assert "**123 min**" in BI.sujet_candidat(c)


def test_duree_par_bloc_calculee_depuis_les_items(construit):
    """La durée indicative de chaque bloc, elle, est la somme des duree_min réels."""
    import json
    p = construit / "banque.json"
    d = json.loads(p.read_text(encoding="utf-8"))
    for i in d["items"]:
        if i["bloc"] == "A":
            i["duree_min"] += 1
    p.write_text(json.dumps(d, ensure_ascii=False, indent=2), encoding="utf-8")
    shutil.rmtree(construit / "build")
    BI.construire(construit, "standard")
    txt = (construit / "build/_FIXTURE_standard_sujet_candidat.md").read_text(
        encoding="utf-8").replace(BI.INSECABLE, " ")
    assert "*Durée indicative : 12 min*" in txt   # bloc A : 6 items, 1 min chacun, + 1


def test_aucune_duree_recopiee_dans_une_consigne(dossier_fixture, refs_fixture):
    """Contrôle symétrique côté validateur : une durée en clair dans une consigne bloque."""
    import copy
    import validate_instrument as VI
    a = VI.VR.charger(dossier_fixture / "assemblages/standard.json")
    b = VI.VR.charger(dossier_fixture / "banque.json")
    a2 = copy.deepcopy(a)
    a2["consignes_passation"].append("L'épreuve dure 65 min.")
    err = VI.controler(b, a2, refs_fixture)
    assert any("code une durée en clair" in e for e in err), err


# ─────────── grilles coach et déterminisme outillé

@pytest.mark.skipif(not PDF_OUTILS, reason="outils PDF absents")
def test_patch_id_absent_fait_echouer_le_rendu(tmp_path):
    """Le patch /ID échouait en silence : un PDF au /ID aléatoire n'est pas reproductible."""
    src = tmp_path / "essai.md"
    src.write_text("# Essai\n\nUn paragraphe.\n", encoding="utf-8")
    pdf = BI.vers_pdf(src)
    assert pdf.exists()
    import re
    ids = re.findall(rb"/ID\s*\[\s*<([0-9A-Fa-f]{32})>", pdf.read_bytes())
    attendu = hashlib.sha256(src.read_bytes()).hexdigest()[:32].encode()
    assert ids and ids[0] == attendu, "identifiant non dérivé de la source"
    # Un PDF déjà patché ne comporte plus de motif aléatoire : le repatcher est idempotent
    avant = pdf.read_bytes()
    BI.vers_pdf(src)
    assert pdf.read_bytes() == avant


def test_grille_coach_produit_ses_deux_rendus(tmp_path):
    import shutil as sh
    d = tmp_path / "GO"
    sh.copytree(RACINE / "instruments" / "GO", d, ignore=sh.ignore_patterns("build"))
    BI.construire_grille_coach(d)
    noms = {p.name for p in (d / "build").iterdir()}
    assert noms == {"GO_standard_grille_coach.md", "GO_standard_saisie_vierge.csv"}


def test_grille_coach_porte_les_consignes_prononcees(tmp_path):
    import shutil as sh
    d = tmp_path / "FR-EAF-ORAL"
    sh.copytree(RACINE / "instruments" / "FR-EAF-ORAL", d,
            ignore=sh.ignore_patterns("build"))
    BI.construire_grille_coach(d)
    # Le rendu rend insécable l'espace de la ponctuation double française ; la comparaison
    # porte sur le texte, pas sur la classe d'espace employée pour le composer.
    txt = (d / "build/FR-EAF-ORAL_standard_grille_coach.md").read_text(
        encoding="utf-8").replace(BI.INSECABLE, " ")
    definition = BI.VR.charger(d / "definition.json")
    for phase in definition["deroule"]:
        assert phase["consigne_prononcee"] in txt, phase["phase"]
    for cr in definition["criteres"]:
        for niveau in ("0", "1", "2", "3"):
            assert cr["descripteurs"][niveau] in txt, f"{cr['code']}/{niveau}"


def test_csv_grille_coach_une_ligne_par_critere(tmp_path):
    import csv
    import shutil as sh
    d = tmp_path / "GO"
    sh.copytree(RACINE / "instruments" / "GO", d, ignore=sh.ignore_patterns("build"))
    BI.construire_grille_coach(d)
    with open(d / "build/GO_standard_saisie_vierge.csv", encoding="utf-8") as f:
        lignes = list(csv.DictReader(f))
    definition = BI.VR.charger(d / "definition.json")
    assert [l["criterion"] for l in lignes] == [c["code"] for c in definition["criteres"]]
    assert all(l["score"] == "" and l["candidate_ref"] == "" for l in lignes)


def test_le_bloc_0_porte_un_identifiant_imprime_et_sans_score(dossier_fixture):
    """R1 — sans identifiant imprimé, le bloc 0 est rempli par le candidat et lu par personne."""
    c = BI.contexte(dossier_fixture, "standard")
    conv = c["conv"]
    domaines = c["asm"]["bloc_0"]["domaines"]
    feuille = BI.feuille_reponses(c)
    sujet = BI.sujet_candidat(c)
    colonnes = [x["colonne"] for x in c["refs"]["catalogue"]["conventions"]["format_saisie"]]
    lignes = BI.saisie_vierge(c).splitlines()
    for d in domaines:
        ident = BI.identifiant_bloc_0(c["asm"]["instrument"], d["competence"], conv)
        assert f"`{ident}`" in feuille, f"{ident} absent de la feuille de réponses"
        assert f"`{ident}`" in sujet, f"{ident} absent du sujet"
        ligne = next(l for l in lignes if f",{ident}," in l)
        champs = dict(zip(colonnes, ligne.split(",")))
        assert champs["score"] == "", "la colonne score d'un domaine de bloc 0 doit rester vide"


# ─────────────────────────────── les figures, réellement composées

def test_une_figure_nest_pas_un_flottant_latex(dossier_fixture, tmp_path):
    """Un flottant se déplace : la figure quittait sa question d'une page entière.

    pandoc transforme en `\\begin{figure}` toute image seule dans un paragraphe qui porte
    un texte alternatif. Sans texte alternatif, l'image est composée sur place — et le
    titre, déjà imprimé en gras au-dessus, tient le rôle de légende.
    """
    f = {"type": "figure", "code": "T", "titre": "Titre", "construite": True,
         "type_graphe": "courbe", "axe_x": {"label": "x", "valeurs": [0, 1, 2]},
         "axe_y": {"label": "y"}, "series": [{"label": "", "valeurs": [0, 1, 4]}]}
    lignes = BI.rendre_figure(f, tmp_path / "T.pdf")
    image = next(l for l in lignes if l.startswith("!["))
    assert image.startswith("![]("), "la figure porte un texte alternatif : pandoc en fera " \
                                     "un flottant, que le compositeur déplacera"
    assert (tmp_path / "T.pdf").exists()


def test_un_item_a_figure_est_encadre_pour_ne_pas_etre_coupe():
    """L'énoncé, la figure et les propositions tiennent d'un bloc."""
    c = BI.contexte(RACINE / "instruments" / "MATH-EA", "SPECIFIQUES")
    texte = BI.sujet_candidat(c)
    avant, apres = texte.split("**MEA-1-AUTOG-01**", 1)
    assert avant.rstrip().endswith("\\filbreak"), \
        "l'item à figure n'est pas précédé d'un filbreak"
    assert apres.index("\\filbreak") < apres.index("**MEA-1-AUTOG-02**"), \
        "le filbreak de fermeture manque : l'item peut être coupé"
    sans_figure = texte.split("**MEA-1-AUTO-01**", 1)[0]
    assert not sans_figure.rstrip().endswith("\\filbreak"), \
        "un item sans figure est encadré sans raison : la mise en page s'aère à tort"


def test_le_genre_de_graphique_est_lu_dans_type_graphe(tmp_path):
    """Régression : « type » vaut « figure », le genre est dans « type_graphe ».

    Les lire comme un seul champ faisait tracer en courbe continue tout diagramme en
    barres — un taux de chômage par diplôme relié d'un trait sur un axe catégoriel.
    """
    barres = {"type": "figure", "code": "B", "titre": "T", "simulee": True,
              "type_graphe": "barres", "axe_x": {"label": "x", "valeurs": ["a", "b"]},
              "axe_y": {"label": "y"}, "series": [{"label": "s", "valeurs": [1, 2]}]}
    BI.rendre_figure(barres, tmp_path / "B.pdf")
    octets = (tmp_path / "B.pdf").read_bytes()
    ligne = dict(barres, type_graphe="courbe")
    BI.rendre_figure(ligne, tmp_path / "C.pdf")
    assert octets != (tmp_path / "C.pdf").read_bytes(), \
        "le genre de graphique ne change rien au tracé : type_graphe est ignoré"
