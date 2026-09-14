"""Les packs de diffusion : ce qui part, et ce qui ne doit pas partir.

Deux règles valent plus que toutes les autres ici. Un dossier remis à un élève ne contient
aucun corrigé — ni fichier de correction, ni clé glissée dans un sujet. Et un pack contient
tout ce que son profil exige : un pack incomplet fait passer une épreuve pour un
diagnostic complet.

Les contrôles ne sont pas éprouvés sur les seuls documents réels — qui passent — mais sur
des documents volontairement fautifs : un contrôle qu'on n'a jamais vu refuser ne prouve
rien.
"""
import subprocess
import sys
import tempfile
from pathlib import Path

import pytest

RACINE = Path(__file__).resolve().parent.parent
sys.path.insert(0, str(RACINE / "scripts"))

import distribution as D  # noqa: E402


@pytest.fixture(scope="module")
def etat():
    return D.construire(verifier=True)


@pytest.fixture(scope="module")
def inv(etat):
    return etat["inventaire"]


# ─────────────────────────────── § 3 · les seize instruments, tous nommés

def test_les_seize_instruments_sont_inventories(inv):
    codes = {i["code"] for i in inv}
    assert len(codes) == len(D.NOM_MATIERE), sorted(codes)
    assert codes == set(D.NOM_MATIERE), "un instrument sans nom de diffusion"


def test_chaque_version_porte_un_niveau_une_matiere_et_une_duree(inv):
    for i in inv:
        assert i["niveau"] in ("Premiere", "Terminale", "Premiere-et-Terminale", "Tous")
        assert i["matiere"] and i["nom_diffusion"]
        assert i["duree_min"] > 0
        assert i["diffusable"], i["code"]


def test_chaque_version_a_un_document_a_envoyer(inv):
    """Aucun instrument ne peut être « prêt » sans rien à remettre à personne."""
    for i in inv:
        assert i["pdf_candidat"] or i["pdf_coach"], f"{i['code']}/{i['version']}"


def test_les_deux_questionnaires_sont_des_documents_candidats(inv):
    """QP et MET sont remplis par le candidat : les omettre viderait le bilan de sens."""
    for code in ("QP", "MET"):
        i = next(x for x in inv if x["code"] == code)
        assert i["pdf_candidat"] is not None, code


# ─────────────────────────────── § 8 · aucune fuite de correction

def test_aucun_document_candidat_ne_porte_de_correction(etat):
    fuites = [e for e in etat["erreurs"] if "FUITE" in e]
    assert not fuites, fuites


def test_le_scan_de_fuite_refuse_un_document_correcteur(inv):
    """Contre-épreuve : le scan doit voir ce qu'il est censé voir."""
    correcteur = next(i["pdf_coach"] for i in inv
                      if i["code"] == "PHI" and i["pdf_coach"])
    fuites = D.controler_candidat_fuites(correcteur)
    assert len(fuites) >= 3, fuites


def test_le_scan_porte_aussi_sur_les_fichiers_texte():
    """Le matériel NSI sur machine est du texte : il passe le même contrôle."""
    err = D.fuites_texte(Path("essai.py"),
                         "Réponse exacte : B\nDistracteurs :\n- A — faux")
    assert len(err) >= 2, err


def test_aucun_corrige_ne_peut_entrer_dans_un_pack_etudiant(etat):
    """Deux fois : sur ce que le script poserait, et sur ce qu'il a posé.

    Le premier contrôle vaut même quand les packs n'ont pas été construits dans ce
    répertoire de travail — il porte sur les noms que la construction produit, donc sur
    la règle elle-même.
    """
    for k in etat["packs"]:
        noms = [D.nom_fichier(i, r) for i in k["candidats"]
                for r in ("candidat",) + (("reponses",) if i["feuille_reponses"] else ())]
        assert not [n for n in noms if "CORRECTION" in n.upper()], noms
    packs = D.SORTIE / "packs-profils"
    if packs.exists():
        intrus = [str(p) for p in packs.rglob("*")
                  if p.is_file() and "CORRECTION" in p.name.upper()]
        assert not intrus, intrus


# ─────────────────────────────── § 9 · le preflight, éprouvé sur un PDF fautif

def test_le_preflight_passe_sur_tous_les_rendus(etat):
    autres = [e for e in etat["erreurs"] if "FUITE" not in e]
    assert not autres, autres


def _pdf_fautif(dossier: Path) -> Path:
    """Un PDF avec une page blanche et un texte hors justification."""
    tex = dossier / "f.tex"
    tex.write_text(r"""\documentclass{article}
\usepackage[margin=2cm,papersize={210mm,297mm}]{geometry}
\begin{document}
\noindent Debut de ligne suivi d'un mot insecable tres long :
\texttt{%s}
\newpage
\mbox{}
\newpage
Fin.
\end{document}
""" % ("A" * 80), encoding="utf-8")
    subprocess.run(["xelatex", "-interaction=nonstopmode", "f.tex"],
                   cwd=dossier, capture_output=True)
    return dossier / "f.pdf"


def test_le_preflight_refuse_une_page_vide_et_un_debordement():
    with tempfile.TemporaryDirectory() as t:
        pdf = _pdf_fautif(Path(t))
        if not pdf.exists():
            pytest.skip("outils PDF absents")
        err = D.controler_rendu(pdf)
        assert any("vide" in e for e in err), err
        assert any("débordant" in e for e in err), err


def test_une_page_qui_ne_porte_que_son_folio_est_vide():
    """Le numéro de page ne fait pas le contenu d'une page."""
    with tempfile.TemporaryDirectory() as t:
        pdf = _pdf_fautif(Path(t))
        if not pdf.exists():
            pytest.skip("outils PDF absents")
        brut = subprocess.run(["pdftotext", "-layout", "-f", "2", "-l", "2",
                               str(pdf), "-"], capture_output=True, text=True).stdout
        assert brut.strip(), "la page porte bien son folio"
        assert any("page 2 vide" in e for e in D.controler_rendu(pdf))


def test_les_polices_sont_toutes_embarquees(inv):
    """Une police non embarquée se recompose chez le destinataire."""
    pdf = next(i["pdf_candidat"] for i in inv
               if i["code"] == "EDS-MATH" and i["pdf_candidat"])
    sortie = subprocess.run(["pdffonts", str(pdf)], capture_output=True,
                            text=True).stdout.splitlines()[2:]
    assert sortie, "aucune police déclarée"
    for ligne in sortie:
        champs = ligne.split()
        if len(champs) >= 6:
            assert champs[-5] == "yes", ligne


# ─────────────────────────────── § 4 et § 7 · les packs

def test_chaque_pack_est_complet(etat):
    incomplets = [D.nom_pack(k) for k in etat["packs"] if k["manquants"]]
    assert not incomplets, incomplets


def test_les_packs_couvrent_les_trois_profils(etat):
    profils = {k["profil"] for k in etat["packs"]}
    assert profils == {"P1", "P2", "P3"}


def test_toutes_les_specialites_sont_couvertes(etat):
    couvertes = {s for k in etat["packs"] for s in k["spes"]}
    assert couvertes == set(D.SPECIALITES)
    for spe in D.SPECIALITES:
        assert any(i["code"] == f"EDS-{spe}" and i["pdf_candidat"]
                   for k in etat["packs"] for i in k["instruments"]), spe


def test_un_pack_de_premiere_porte_les_epreuves_anticipees(etat):
    k = next(x for x in etat["packs"] if x["profil"] == "P1")
    codes = {i["code"] for i in k["instruments"]}
    assert "FR-EAF" in codes, "un élève de première prépare l'épreuve anticipée"
    assert "MATH-EA" in codes, "l'épreuve anticipée de mathématiques est due"
    assert "PHI" not in codes, "la philosophie n'est pas au programme de première"


def test_un_pack_de_terminale_porte_la_philosophie(etat):
    for k in (x for x in etat["packs"] if x["profil"] == "P2"):
        codes = {i["code"] for i in k["instruments"]}
        assert {"PHI", "GO"} <= codes, D.nom_pack(k)
        # FR-MAI n'est plus un défaut : il suit le fait fr_mai_requis, et lui seul.
        assert ("FR-MAI" in codes) == bool(k.get("fr_mai_requis")), D.nom_pack(k)
    assert any(k.get("fr_mai_requis") for k in etat["packs"] if k["profil"] == "P2"), \
        "le banc doit éprouver au moins un pack P2 avec le diagnostic de maîtrise du français"


def test_la_configuration_francaise_change_le_pack(etat):
    """Q-19 : un candidat sans français à repasser ne reçoit pas le diagnostic FR-EAF."""
    sans = next(x for x in etat["packs"]
                if x["profil"] == "P2" and x["config"] == "aucune")
    avec = next(x for x in etat["packs"]
                if x["profil"] == "P2" and x["config"] == "les_deux"
                and x["spes"] == sans["spes"])
    assert "FR-EAF" not in {i["code"] for i in sans["instruments"]}
    assert "FR-EAF" in {i["code"] for i in avec["instruments"]}


def test_la_duree_totale_est_la_somme_des_instruments(etat):
    for k in etat["packs"]:
        assert k["duree_totale_min"] == sum(i["duree_min"] for i in k["instruments"])


# ─────────────────────────────── § 5 · les profils du projet

def test_chaque_profil_du_projet_a_tous_ses_documents():
    for x in D.profils_du_projet():
        assert not x["manquants"], (x["etiquette"], x["manquants"])
        assert x["prets"], x["etiquette"]


def test_aucun_nom_de_candidat_ne_sort_dans_les_tableaux():
    """Les étiquettes sont des codes, jamais des noms : le dépôt reste anonyme."""
    import re
    for x in D.profils_du_projet():
        assert re.fullmatch(r"CL-\d{4}-\d{4}", x["etiquette"]), x["etiquette"]


# ─────────────────────────────── la façade opérationnelle

def test_le_banc_de_controle_a_ses_dossiers():
    """Le banc produit la matière des contrôles, rangée où les contrôles la cherchent."""
    for d in (D.INDEX, D.ENVOI, D.IMPRESSION, D.COACH, D.CATALOGUE, D.NSI_MACHINE,
              D.COMBINAISONS):
        assert d.is_dir(), d


def test_aucun_chemin_du_banc_ne_se_confond_avec_un_envoi():
    """Rien sous build/ ne doit pouvoir passer pour une source d'envoi.

    Le banc s'appelait `release/diagnostics-v1`, puis `build/controle-diffusion` — mais
    il contenait encore `01_A_ENVOYER_AUX_CANDIDATS/…/PACK_DIAGNOSTIC_CANDIDAT.pdf` en
    ancienne charte. Le renommage de la racine ne suffisait pas.
    """
    interdits = ("A_ENVOYER", "A_IMPRIMER", "PACK_DIAGNOSTIC_CANDIDAT", "PACK_CANDIDAT",
                 "PROFILS_POSSIBLES", "CATALOGUE_CANONIQUE", "_FINAL", "_PROD")
    fautifs = [str(f.relative_to(D.SORTIE)) for f in D.SORTIE.rglob("*")
               if any(x in f.name.upper() or x in str(f.parent).upper() for x in interdits)]
    assert not fautifs, f"chemins confondables avec un envoi : {sorted(set(fautifs))[:5]}"


def test_lindex_designe_la_seule_source_d_envoi():
    texte = (D.INDEX / "COMMENCER_ICI.txt").read_text(encoding="utf-8")
    assert "SOURCE OFFICIELLE D'ENVOI" in texte
    assert "release/diagnostics-v2" in texte
    assert "N'EST PAS UNE RELEASE" in texte
    for jargon in ("P1", "P2", "P3"):
        assert jargon not in texte.split("preflight/")[0], \
            f"{jargon} employé comme interface principale"
    assert (D.INDEX / "COMMENCER_ICI.pdf").exists()
    assert (D.INDEX / "INDEX_PACKS.html").exists()


def test_lindex_html_est_autonome():
    """Pas de serveur, pas de dépendance distante : la page s'ouvre depuis le disque."""
    html = (D.INDEX / "INDEX_PACKS.html").read_text(encoding="utf-8")
    assert "http://" not in html and "https://" not in html
    assert "const L = [" in html, "les données ne sont pas embarquées"
    for champ in ("f_niveau", "f_profil", "f_eds", "f_eaf"):
        assert f'id={champ}' in html, champ


def test_les_archives_de_profil_sont_lisibles_et_completes():
    import zipfile
    archives = sorted(D.COMBINAISONS.rglob("*.zip"))
    # Une archive par combinaison servie par le moteur : la constante 154 ne comptait
    # ni les cas MATH-EA due sans spécialité maths ni FR-MAI en P3.
    assert len(archives) == len(D.combinaisons()), len(archives)
    for z in archives[:12] + archives[-12:]:
        with zipfile.ZipFile(z) as a:
            assert a.testzip() is None, z.name
            noms = a.namelist()
            assert "ASSEMBLAGE_AUDIT.pdf" in noms, z.name
            assert "00_LISEZ_MOI.txt" in noms, z.name
            assert not [n for n in noms if "CORRECTION" in n.upper()], z.name


def test_aucun_corrige_hors_de_la_facade_du_correcteur():
    """§ 12 · fail-closed, sur le contenu comme sur le nom."""
    assert D._controler_facade() == []
    for d in (D.ENVOI, D.IMPRESSION, D.COMBINAISONS, D.CATALOGUE, D.NSI_MACHINE):
        intrus = [str(p) for p in d.rglob("*")
                  if p.is_file() and "CORRECTION" in p.name.upper()]
        assert not intrus, intrus
    assert list(D.COACH.rglob("*CORRECTION*")), "les corrigés ont disparu de leur façade"


def test_un_corrige_glisse_dans_un_pack_arrete_la_construction(tmp_path):
    """Contre-épreuve du fail-closed : la fusion elle-même est scannée."""
    inv = D.inventaire()
    corrige = next(i for i in inv if i["code"] == "PHI")
    faux = dict(next(i for i in inv if i["code"] == "QP"))
    faux["pdf_candidat"] = corrige["pdf_coach"]
    k = {"profil": "P2", "niveau": "Terminale", "spes": ("MATH",), "config": "aucune",
         "instruments": [faux], "candidats": [faux], "duree_totale_min": 20}
    with pytest.raises(SystemExit) as e:
        D._batir_pack(k, tmp_path / "pack", None)
    assert "FUITE" in str(e.value)


def test_le_pack_est_un_seul_pdf_dans_lordre_pedagogique():
    import pypdf
    pack = next(D.ENVOI.rglob("ASSEMBLAGE_AUDIT.pdf"))
    r = pypdf.PdfReader(str(pack))
    assert len(r.pages) > 20
    titres = [o.title for o in r.outline]
    assert titres, "aucun signet : l'opérateur ne sait pas où il est"
    codes = [t for t in titres if "QUESTIONNAIRE-PARCOURS" in t]
    assert codes and titres.index(codes[0]) == 0, "le questionnaire n'ouvre pas le pack"


def test_le_pack_dimpression_est_le_meme_fichier_que_le_pack_denvoi():
    """§ 5 et § 6 · un dérivé n'est pas une copie : c'est le même fichier."""
    for f in D.IMPRESSION.rglob("ASSEMBLAGE_PAPIER_AUDIT.pdf"):
        jumeau = (D.ENVOI / "PROFILS_DE_REFERENCE" / f.parent.name
                  / "ASSEMBLAGE_AUDIT.pdf")
        assert jumeau.exists(), f
        assert f.stat().st_ino == jumeau.stat().st_ino, f


def test_aucun_derive_ne_diverge_du_catalogue():
    assert D.guard_derives() == []


def test_aucun_doublon_inattendu_ni_collision():
    d = D.doublons()
    assert d["UNEXPECTED_DUPLICATE"] == 0, d["detail"]
    assert d["VERSION_COLLISION"] == 0, d["detail"]
    assert d["DISTRIBUTION_UNIQUE_CONTENT_HASHES"] > 0


def test_le_catalogue_separe_les_deux_programmes_de_francais():
    """§ 13 · six versions côte à côte sans indication seraient un piège."""
    d = D.CATALOGUE / "Premiere" / "FRANCAIS-EAF"
    annees = sorted(x.name for x in d.iterdir() if x.is_dir())
    assert annees == ["Premiere-2025-2026", "Premiere-2026-2027_COURANT"], annees


def test_la_version_courante_est_celle_de_lannee_en_cours():
    """§ 1 · un élève de première en 2026-2027 relève de la session finale 2028."""
    for i in D.inventaire():
        if i["code"] != "FR-EAF":
            continue
        assert i["courant_pour_2026_2027"] == (i["session"] == 2028), i["version"]
    q = D.profil_reel("P1", ("MATH", "PC", "NSI"))
    import maquette_donnees as MD
    versions = [v for c, v in MD.instruments_passes(q, D.catalogue()) if c == "FR-EAF"]
    assert versions == ["standard_2028"], versions


def test_le_nom_de_fichier_dit_lannee_de_premiere_pas_la_session():
    """« STANDARD-2028 » se lisait « pour 2028 » : c'était l'inverse."""
    noms = [f.name for f in (D.CATALOGUE / "Premiere" / "FRANCAIS-EAF").rglob("*.pdf")]
    assert noms and all("PROGRAMME-20" in n for n in noms), noms
    assert not [n for n in noms if "STANDARD-2028" in n]


def test_le_libelle_de_la_configuration_francaise_nest_plus_ambigu():
    """§ 2 · « sans-francais » était faux : FR-MAI reste au programme."""
    assert "sans-francais" not in D.NOM_CONFIG.values()
    assert D.NOM_CONFIG["aucune"] == "EAF-non-requise"
    packs = [p.name for p in D.COMBINAISONS.rglob("*.zip")]
    assert not [p for p in packs if "sans-francais" in p]
    sans = [p for p in packs if "EAF-non-requise" in p]
    assert sans, "aucun pack sans épreuve anticipée de français"


def test_un_pack_sans_eaf_garde_la_maitrise_du_francais_sur_demande():
    """Sans épreuve anticipée de français, aucun FR-EAF ; la maîtrise du français suit le
    fait fr_mai_requis, et lui seul — le banc éprouve les deux cas."""
    etat = D.construire(verifier=True)
    sans_eaf = [x for x in etat["packs"] if x["config"] == "aucune"]
    assert sans_eaf
    for k in sans_eaf:
        codes = {i["code"] for i in k["instruments"]}
        assert "FR-EAF" not in codes and "FR-EAF-ORAL" not in codes, D.nom_pack(k)
        assert ("FR-MAI" in codes) == bool(k.get("fr_mai_requis")), D.nom_pack(k)
    assert any(k.get("fr_mai_requis") for k in sans_eaf), "le diagnostic de maîtrise du français a disparu"


def test_les_entretiens_sont_declares_comme_tels():
    """§ 3 · on ne fabrique pas un sujet pour un entretien."""
    par = {i["code"]: i for i in D.inventaire()}
    for code in ("FR-EAF-ORAL", "GO"):
        assert par[code]["delivery_mode"] == "COACH_INTERVIEW"
        assert par[code]["pdf_candidat"] is None, code
    assert par["FR-EAF"]["delivery_mode"] == "SELF_ADMINISTERED"
    assert par["FR-EAF"]["pdf_candidat"] is not None


def test_le_materiel_nsi_est_canonique_et_zippe():
    import zipfile
    for niv in ("Premiere", "Terminale"):
        d = D.NSI_MACHINE / niv
        assert (d / "rendu_modele.py").exists() and (d / "conftest.py").exists()
        z = D.NSI_MACHINE / f"COMPLEMENT_NSI_PRATIQUE_{niv.upper()}.zip"
        with zipfile.ZipFile(z) as a:
            assert a.testzip() is None
            assert "rendu_modele.py" in a.namelist()
    # Le candidat a le droit de savoir que les tests qu'il exécute sont ceux de la
    # correction : c'est la règle de l'épreuve. Ce qu'il ne doit pas lire, c'est
    # comment ils sont convertis en note.
    texte = (D.NSI_MACHINE / "LISEZ-MOI.txt").read_text(encoding="utf-8").lower()
    for interdit in ("barème", "bareme", "critère tests", "proportion de tests",
                     "note", "points", "solution de référence"):
        assert interdit not in texte, interdit
    assert D.fuites_texte(D.NSI_MACHINE / "LISEZ-MOI.txt", texte) == []


def test_la_matrice_dimpression_couvre_les_profils_prepares():
    import csv as c
    p = RACINE / "PRINT_MATRIX.csv"
    assert p.exists()
    lignes = list(c.DictReader(p.read_text(encoding="utf-8").splitlines()))
    assert lignes
    for l in lignes:
        assert l["ready_to_send"] == "true", l
        assert l["ready_to_print"] == "true", l
        assert (RACINE / l["paper_pack_pdf"]).exists(), l["paper_pack_pdf"]


def test_matrice_3_profils_x_2_modes():
    """Vérifie la dérivation formelle pour les 3 profils x 2 modes (annuelle vs fin_cycle)."""
    import maquette_donnees as MD
    cat = D.catalogue()
    for prof in ("P1", "P2", "P3"):
        for mode in ("annuelle", "fin_cycle"):
            if prof == "P3" and mode == "annuelle":
                with pytest.raises(ValueError, match="fin_cycle"):
                    D.profil_reel(prof, ("MATH", "PC", "NSI"), abandonnee="NSI", mode_ep=mode)
                continue
            qp = D.profil_reel(prof, ("MATH", "PC", "NSI") if prof in ("P1", "P3") else ("PC", "NSI"),
                               abandonnee="MATH" if prof == "P2" else "NSI", mode_ep=mode)
            res = MD.epreuves_reglementaires_dues_vs_diagnostics(qp, cat)
            assert "epreuves_reglementaires_dues" in res
            assert "diagnostics_nexus_utiles" in res
            dues = {c for c, _ in res["epreuves_reglementaires_dues"]}
            if prof == "P1" and mode == "fin_cycle":
                assert not ({"TC-HG", "TC-EMC", "TC-ES"} & dues)
            elif prof == "P1" and mode == "annuelle":
                assert {"TC-HG", "TC-EMC", "TC-ES"} <= dues
            elif prof == "P2" and mode == "annuelle":
                assert ("TC-HG", "TLE") in res["epreuves_reglementaires_dues"]
            elif prof == "P2" and mode == "fin_cycle":
                assert ("TC-HG", "ETENDUE") in res["epreuves_reglementaires_dues"]
            elif prof == "P3":
                assert ("TC-HG", "ETENDUE") in res["epreuves_reglementaires_dues"]
