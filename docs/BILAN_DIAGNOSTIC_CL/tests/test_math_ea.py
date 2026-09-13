"""MATH-EA — l'instrument diagnostique de l'épreuve anticipée de mathématiques.

Créé après le passage du gate réglementaire : l'épreuve existe à compter de la session
2027, aucun instrument ne la mesurait, et le Cahier l'ignorait. Ces tests vérifient qu'il
mesure ce que l'épreuve mesure — automatismes, format, absence de calculatrice, rédaction —
sans dupliquer EDS-MATH, et qu'il est construit sur le programme de l'année de passation.
"""
import copy
import json
import sys
from pathlib import Path

import pytest

RACINE = Path(__file__).resolve().parent.parent
sys.path.insert(0, str(RACINE / "scripts"))

import bilan as B  # noqa: E402
import contexte as C  # noqa: E402
import diffusabilite as DIF  # noqa: E402
import maquette_bilan as M  # noqa: E402
import maquette_donnees as D  # noqa: E402
import passation as P  # noqa: E402
import validate_instrument as VI  # noqa: E402


def charger(p):
    return json.loads(Path(p).read_text(encoding="utf-8"))


@pytest.fixture(scope="module")
def banque():
    return charger(RACINE / "instruments" / "MATH-EA" / "banque.json")


@pytest.fixture(scope="module")
def perimetre():
    ref = charger(RACINE / "referentiels" / "competences.json")
    return next(p for p in ref["perimetres"] if p["code"] == "MATH-EA")


@pytest.fixture(scope="module")
def catalogue():
    return charger(RACINE / "referentiels" / "catalogue_instruments.json")


@pytest.fixture(scope="module")
def bilan_p3():
    return M.Bilan().calculer()


# ─────────────────────────────── l'instrument existe et il est valide

def test_les_deux_assemblages_valident_sans_erreur():
    err, resume = VI.valider(RACINE / "instruments" / "MATH-EA")
    assert err == [], err
    lignes = " ".join(resume)
    assert "MATH-EA/SPE :" in lignes and "MATH-EA/SPECIFIQUES :" in lignes


def test_le_format_de_lepreuve_est_celui_du_texte(catalogue, banque):
    """2 h et coefficient 2 à l'épreuve ; le diagnostic condense, sans inventer son format."""
    fiches = [i for i in catalogue["instruments"] if i["code"] == "MATH-EA"]
    assert {f["version"] for f in fiches} == {"SPE", "SPECIFIQUES"}
    for f in fiches:
        assert f["duree_cible_min"] == 75, \
            "la durée est passée de 60 à 75 min le 2026-09-11 (EC-33)"
        assert f["blocs_attendus"] == ["A", "B", "C", "D"]
        assert f["annee_scolaire_passation_ea"] == "2026-2027"
    ref = C.referentiel()["epreuves_anticipees"]["session_2027"]["mathematiques"]
    assert ref["duree_min"] == 120 and ref["coefficient"] == 2
    assert ref["calculatrice"] is False


def test_aucune_calculatrice_nulle_part(banque):
    for a in ("SPE", "SPECIFIQUES"):
        asm = charger(RACINE / "instruments" / "MATH-EA" / "assemblages" / f"{a}.json")
        consignes = " ".join(asm["consignes_passation"])
        assert "calculatrice n'est autorisée à aucun moment" in consignes
    texte = json.dumps(banque, ensure_ascii=False)
    assert "calculatrice est autorisée" not in texte, \
        "un item autorise la calculatrice, que l'épreuve interdit"


def test_les_deux_parties_de_lepreuve_sont_representees(banque):
    """Partie 1 : automatismes. Partie 2 : exercices mobilisant raisonnement et rédaction.

    La seconde partie de l'épreuve compte deux ou trois exercices : depuis EC-33, le
    diagnostic en porte deux, sur deux domaines distincts. Le critère d'exactitude du
    calcul est commun aux deux grilles — c'est ce qui donne à l'indicateur « sans
    calculatrice » deux sources au palier de raisonnement.
    """
    blocs = {i["item_id"]: i["bloc"] for i in banque["items"]}
    autom = [i for i in banque["items"] if i["competence"] in ("AUTO", "AUTOG")]
    assert autom
    # Les automatismes du programme de première forment la première partie de l'épreuve :
    # ils sont au bloc B. Seuls les acquis du programme de seconde restent au bloc A.
    assert all(blocs[i["item_id"]] == ("A" if i["est_prerequis"] else "B") for i in autom)
    assert {i["item_id"] for i in autom if i["est_prerequis"]} == {"MEA-1-AUTO-07",
                                                                  "MEA-1-AUTOG-07"}
    c = [i for i in banque["items"] if i["type"] == "C"]
    assert len(c) == 2 and all(x["competence"] == "RAIS" and x["grille"] for x in c)
    grilles = [{cr["code"] for cr in x["grille"]} for x in c]
    assert grilles == [{"DEMARCHE", "EXACT", "REDAC"}, {"DEMPROB", "EXACT", "REDPROB"}]
    domaines = {x["item_id"]: x["capacites_officielles"]["SPE"] for x in c}
    assert not set(domaines["MEA-1-RAIS-01"]) & set(domaines["MEA-1-RAIS-04"]), \
        "les deux tâches de production portent sur le même domaine"


def test_le_programme_source_est_celui_de_lannee_de_passation(banque):
    assert "MENE2602917A" in banque["source"] and "MENE2602916A" in banque["source"]
    assert "MENE2516240N" not in banque["source"], \
        "la liste transitoire d'automatismes ne fonde pas un instrument de 2026-2027"
    prog = C.referentiel()["programmes_mathematiques"]["par_annee_scolaire"]["2026-2027"]
    assert {p["nor"] for p in prog["programmes"]} == {"MENE2602917A", "MENE2602916A"}


def test_chaque_competence_cite_le_programme_officiel(perimetre):
    for c in perimetre["competences"]:
        assert c["chapitres"], c["code"]
        for ch in c["chapitres"]:
            assert "26 février 2026" in ch["programme"]
            assert ch["confiance"] == "haute"


# ─────────────────────────────── il ne duplique pas EDS-MATH

def test_math_ea_et_eds_math_sont_deux_perimetres_distincts(bilan_p3):
    assert "MATH-EA" in bilan_p3.perimetres_passes
    assert "EDS-MATH" in bilan_p3.perimetres_passes
    codes_ea = {k[1] for k in bilan_p3.res if k[0] == "MATH-EA"}
    codes_eds = {k[1] for k in bilan_p3.res if k[0] == "EDS-MATH"}
    assert codes_ea & codes_eds <= {"RAIS"}, \
        "les deux périmètres partagent trop de codes : le risque de confusion est réel"
    assert bilan_p3.agr["MATH-EA"]["global"] != bilan_p3.agr["EDS-MATH"]["global"]


def test_les_deux_perimetres_partagent_une_seule_enveloppe(bilan_p3):
    g = bilan_p3.groupe_de["MATH-EA"]
    assert g == "MATHEMATIQUES" == bilan_p3.groupe_de["EDS-MATH"]
    h, _, _ = bilan_p3.rythme_groupe(g)
    separes = [bilan_p3.rythme(pc)[0] for pc in bilan_p3.groupes[g]]
    assert h == max(separes) and h < sum(separes)


def test_le_bilan_nomme_les_deux_mesures_du_groupe(bilan_p3):
    texte, _ = B.rendre(bilan_p3)
    plan = texte.split("\n## 5. ", 1)[1].split("\n## 6. ", 1)[0]
    assert "Mathématiques — épreuve anticipée de première" in plan
    assert "Spécialité mathématiques" in plan
    assert "Second objectif de la même enveloppe" in plan


def test_un_candidat_sans_specialite_maths_ouvre_le_groupe_par_math_ea(catalogue):
    """Le parcours SPECIFIQUES : le groupe MATHEMATIQUES existe sans EDS-MATH."""
    qp = charger(RACINE / "instruments" / "_MAQUETTE_P2" / "qp.json")
    qp["reponses"]["specialites"] = ["SES", "HGGSP"]
    qp["reponses"]["statut_par_specialite"] = {"SES": "deja_suivie_en_classe",
                                               "HGGSP": "deja_suivie_en_classe"}
    choisis = {f"{c}/{v}" for c, v in D.instruments_passes(qp, catalogue)}
    assert "MATH-EA/SPECIFIQUES" in choisis
    assert not any(x.startswith("EDS-MATH") for x in choisis)


# ─────────────────────────────── sélection, année de passation, diffusabilité

def test_la_selection_suit_lannee_de_passation(catalogue):
    qp = charger(RACINE / "instruments" / "_MAQUETTE" / "qp.json")
    assert any(c == "MATH-EA" for c, _ in D.instruments_passes(qp, catalogue))
    qp["reponses"]["annee_scolaire_passation_ea"] = "2025-2026"
    qp["reponses"]["session_baccalaureat_finale"] = 2027
    assert not any(c == "MATH-EA" for c, _ in D.instruments_passes(qp, catalogue)), \
        "un candidat de 2025-2026 composerait sur le programme de 2026-2027"


def test_une_dispense_retire_linstrument(catalogue):
    qp = charger(RACINE / "instruments" / "_MAQUETTE" / "qp.json")
    qp["reponses"]["dispense_transitoire"] = "DISP-ECHEC-2026"
    assert not any(c == "MATH-EA" for c, _ in D.instruments_passes(qp, catalogue))


def test_math_ea_nattend_aucun_support_externe():
    """Aucun texte à insérer, aucune validation en défaut : rien ne bloque par construction."""
    s = DIF.statut("MATH-EA")
    assert s["supports"] == 0, "l'instrument n'attend aucun support externe"
    autres = [m for m in s["motifs"] if m["motif"] != "correction_en_cours"]
    assert not autres, autres


def test_le_statut_de_math_ea_suit_sa_mise_en_correction():
    """Le statut est calculé, jamais déclaré — y compris pendant une correction.

    Tant que la banque porte le champ de mise en correction, l'instrument n'est pas
    diffusable et V-Instruments l'oppose au bilan. Retirer le champ le rend à la
    diffusion, et rien d'autre ne le peut.
    """
    banque = DIF.charger(RACINE / "instruments" / "MATH-EA" / "banque.json")
    en_correction = bool(banque.get(DIF.CHAMP_CORRECTION))
    assert DIF.statut("MATH-EA")["diffusable"] is not en_correction


def test_math_ea_est_diffusable_et_le_gate_de_correction_est_franchi():
    """La mise en correction du 2026-09-11 est levée, et le dépôt dit à quel prix."""
    banque = DIF.charger(RACINE / "instruments" / "MATH-EA" / "banque.json")
    assert DIF.CHAMP_CORRECTION not in banque
    assert DIF.statut("MATH-EA")["diffusable"], DIF.statut("MATH-EA")["motifs"]
    gate = banque["gate_de_correction"]
    assert len(gate["etapes_franchies"]) == 8
    assert gate["statut"].startswith("diffusable")


def test_les_rendus_sont_generables():
    build = RACINE / "instruments" / "MATH-EA" / "build"
    for version in ("SPE", "SPECIFIQUES"):
        for suffixe in ("sujet_candidat.md", "cle_et_grilles_correcteur.md",
                        "feuille_reponses.md", "saisie_vierge.csv"):
            assert (build / f"MATH-EA_{version}_{suffixe}").exists(), suffixe


def test_le_plan_de_passation_tient_le_plafond_avec_math_ea(catalogue):
    qp = charger(RACINE / "instruments" / "_MAQUETTE" / "qp.json")
    p = P.plan(qp, catalogue)
    places = {x["code"] for dj in p["demi_journees"] for x in dj}
    assert "MATH-EA" in places
    assert all(d <= p["plafond"] for d in p["durees"])
    assert p["nombre_demi_journees"] == 3


# ─────────────────────────────── deux périmètres, deux niveaux, une seule enveloppe

def deux_niveaux(bilan_p3, fort, faible):
    """Le même jeu, avec un périmètre du groupe remonté au-dessus de l'autre.

    Le jeu P3 met les deux périmètres mathématiques en remise à niveau : leurs rythmes
    coïncident, et l'on ne voit pas laquelle des deux règles — le maximum, ou la gravité —
    commande quoi. Ce montage écarte les deux niveaux pour que la question se pose.
    """
    b = copy.deepcopy(bilan_p3)
    seuil = b.regles["agregats"]["prerequis"]["seuil_remise_a_niveau"]
    b.agr[fort]["prerequis"] = seuil + 0.2
    b.agr[faible]["prerequis"] = seuil - 0.2
    consolide = b.regles["niveaux_competence"]["paliers"][0]["libelle"]
    for k in b.res:
        if k[0] == fort and b.res[k]["niveau"] != b.regles[
                "niveaux_competence"]["non_evalue"]["libelle"]:
            b.res[k]["niveau"] = consolide
    return b


@pytest.mark.parametrize("fort,faible", [("MATH-EA", "EDS-MATH"),
                                         ("EDS-MATH", "MATH-EA")])
def test_deux_niveaux_differents_donnent_une_enveloppe_unique(bilan_p3, fort, faible):
    """L'enveloppe est le maximum des deux rythmes — jamais leur somme, jamais leur moyenne."""
    b = deux_niveaux(bilan_p3, fort, faible)
    separes = {pc: b.rythme(pc)[0] for pc in b.groupes["MATHEMATIQUES"]}
    assert separes[fort] < separes[faible], "le montage n'a pas écarté les deux niveaux"
    h, niveau, pc = b.rythme_groupe("MATHEMATIQUES")
    assert h == max(separes.values())
    assert h < sum(separes.values())
    assert pc == faible, "l'enveloppe n'est pas commandée par le périmètre le plus faible"
    assert niveau == b.rythme(faible)[1]


@pytest.mark.parametrize("fort,faible", [("MATH-EA", "EDS-MATH"),
                                         ("EDS-MATH", "MATH-EA")])
def test_le_module_prioritaire_vient_des_regles_de_priorite_du_groupe(bilan_p3, fort, faible):
    """Le module prioritaire est celui du périmètre le plus grave ; l'autre reste second."""
    b = deux_niveaux(bilan_p3, fort, faible)
    prioritaire, seconds = b.module_entree_groupe("MATHEMATIQUES")
    assert prioritaire == faible
    assert seconds == [fort]
    assert b.gravite(faible) < b.gravite(fort)


@pytest.mark.parametrize("fort,faible", [("MATH-EA", "EDS-MATH"),
                                         ("EDS-MATH", "MATH-EA")])
def test_le_second_perimetre_devient_un_objectif_explicite(bilan_p3, fort, faible):
    """Il n'est ni fusionné ni moyenné : le plan le nomme comme second objectif."""
    b = deux_niveaux(bilan_p3, fort, faible)
    texte, _ = B.rendre(b)
    plan = texte.split("\n## 5. ", 1)[1].split("\n## 6. ", 1)[0]
    assert "Second objectif de la même enveloppe" in plan
    assert B.nom_matiere(b, fort) in plan and B.nom_matiere(b, faible) in plan
    assert b.agr[fort]["global"] != b.agr[faible]["global"], \
        "les deux mesures se sont confondues"


def test_les_deux_resultats_restent_separes_meme_a_niveaux_differents(bilan_p3):
    b = deux_niveaux(bilan_p3, "MATH-EA", "EDS-MATH")
    ea = {k[1] for k in b.res if k[0] == "MATH-EA"}
    eds = {k[1] for k in b.res if k[0] == "EDS-MATH"}
    assert ea and eds
    assert b.niveau_entree("MATH-EA") != b.niveau_entree("EDS-MATH"), \
        "les deux périmètres rendent le même niveau d'entrée : ils ont été fusionnés"
