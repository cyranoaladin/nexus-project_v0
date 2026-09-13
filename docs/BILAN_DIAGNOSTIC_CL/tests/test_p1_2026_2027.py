"""Le P1 opérationnel : cohorte 2026-2027, session 2028, sans spécialité mathématiques.

Le dépôt savait décrire un P1 — mais celui de la cohorte 2025-2026, dont l'épreuve anticipée
de mathématiques n'existe pas encore et dont le programme d'œuvres est celui de 2027. La
cohorte opérationnelle est celle entrée en première en septembre 2026 : ses épreuves
anticipées se passent en juin 2027, au titre de la session finale 2028, et si elle n'a pas
choisi la spécialité mathématiques elle compose le sujet « mathématiques spécifiques de
l'enseignement scientifique ».

Trois choses n'avaient jamais été traversées ensemble : MATH-EA/SPECIFIQUES, un groupe
MATHEMATIQUES ouvert par ce seul instrument, et un assemblage de français de la session 2028.
"""
import json
import sys
from pathlib import Path

import pytest

RACINE = Path(__file__).resolve().parent.parent
JEU = RACINE / "instruments" / "_MAQUETTE_P1_2026_2027_SPECIFIQUES"
sys.path.insert(0, str(RACINE / "scripts"))

import bilan as B  # noqa: E402
import contexte as C  # noqa: E402
import maquette_bilan as M  # noqa: E402
import maquette_donnees as D  # noqa: E402
import passation as P  # noqa: E402


def charger(p):
    with open(p, encoding="utf-8") as f:
        return json.load(f)


@pytest.fixture(scope="module")
def catalogue():
    return charger(RACINE / "referentiels" / "catalogue_instruments.json")


@pytest.fixture(scope="module")
def qp():
    return charger(JEU / "qp.json")


@pytest.fixture(scope="module")
def b():
    return M.Bilan(dossier=JEU).calculer()


@pytest.fixture(scope="module")
def instruments(qp, catalogue):
    return dict(D.liste_effective_des_instruments_a_passer(qp, catalogue))


# ─────────────────────────────── le contexte : trois axes, et leur cohérence

def test_les_trois_axes_du_jeu_sont_ceux_de_la_cohorte_operationnelle(qp):
    r = qp["reponses"]
    assert r["profil"] == "P1"
    assert r["session_baccalaureat_finale"] == 2028
    assert r["annee_scolaire_passation_ea"] == "2026-2027"
    assert r["mode_passation_ea"] == "anticipation"
    ctx = C.contexte(r)
    assert ctx["coherent"] and ctx["annee_civile_passation_ea"] == 2027


def test_le_champ_deprecie_a_disparu_du_jeu(qp):
    assert "session_visee" not in qp["reponses"], \
        "le jeu opérationnel reconduit le champ que le modèle à trois axes remplace"


def test_le_programme_de_mathematiques_est_celui_de_lannee_de_passation(qp):
    prog = C.programme_math_applicable(qp["reponses"])
    assert {p["nor"] for p in prog["programmes"]} == {"MENE2602917A", "MENE2602916A"}
    assert "MENE2516240N" in prog["interdit"]


# ─────────────────────────────── ce que le jeu prouve, point par point

def test_aucune_specialite_mathematiques(qp, instruments, b):
    assert "MATH" not in qp["reponses"]["specialites"]
    assert "EDS-MATH" not in instruments
    assert "EDS-MATH" not in b.perimetres_passes


def test_lepreuve_anticipee_de_mathematiques_est_le_sujet_specifiques(qp, instruments):
    assert instruments["MATH-EA"] == "SPECIFIQUES"
    r = {**qp["reponses"], "parcours_mathematiques": "specifiques"}
    st = C.statut_math_ea(r)
    assert st["statut"] == "a_presenter_specifiques"


def test_le_parcours_nest_pas_declare_mais_derive(qp):
    assert "parcours_mathematiques" not in qp["reponses"], \
        "le candidat déclarerait lui-même le sujet qu'il doit composer"


def test_le_groupe_mathematiques_est_ouvert_par_math_ea_seul(b):
    assert b.groupes["MATHEMATIQUES"] == ["MATH-EA"]
    assert b.groupe_de["MATH-EA"] == "MATHEMATIQUES"
    h, niveau, pc = b.rythme_groupe("MATHEMATIQUES")
    assert pc == "MATH-EA" and h == b.rythme("MATH-EA")[0]


def test_le_francais_est_celui_de_la_session_2028(instruments):
    assert instruments["FR-EAF"] == "standard_2028"
    asm = charger(RACINE / "instruments" / "FR-EAF" / "assemblages" / "standard_2028.json")
    assert asm["session_baccalaureat_finale"] == 2028


def test_aucun_item_de_2027_nentre_dans_lassemblage_de_2028(b):
    """Le contre-test demandé : pas d'œuvre de 2027 injectée dans un item sessionné 2028."""
    banque = b.banques["FR-EAF"]
    asm = charger(RACINE / "instruments" / "FR-EAF" / "assemblages" / "standard_2028.json")
    passes = [banque[i] for bl in asm["blocs"] for i in bl["items"]]
    for it in passes:
        sessions = it.get("sessions_applicables")
        assert sessions is None or 2028 in sessions, it["item_id"]
    lu = " ".join(it.get("enonce", "") + " ".join((it.get("propositions") or {}).values())
                  for it in passes)
    for oeuvre in ("Manon Lescaut", "La Peau de chagrin",
                   "Sido suivi de Les Vrilles de la vigne"):
        assert oeuvre not in lu, f"{oeuvre} relève de la session 2027"


def test_la_boetie_reste_le_support_du_bloc_b(b):
    asm = charger(RACINE / "instruments" / "FR-EAF" / "assemblages" / "standard_2028.json")
    sup, = [s for bl in asm["blocs"] if bl["bloc"] == "B" for s in bl["supports"]]
    assert sup["oeuvre_au_programme"]["oeuvre"] == "Discours de la servitude volontaire"
    assert sup["oeuvre_au_programme"]["session"] == 2028


# ─────────────────────────────── la traversée complète

def test_tous_les_attendus_de_la_commande_sont_tenus(b):
    ecarts = [(v["id"], [(d, o) for d, o, ok in v["lignes"] if not ok])
              for v in M.verifier_specification(b) if not v["conforme"]]
    assert not ecarts, ecarts


def test_le_plan_de_passation_se_calcule_et_tient_le_plafond(qp, catalogue):
    p = P.plan(qp, catalogue)
    assert p["statut_profil"] == "sans_objet", \
        "l'article 3 ne s'applique pas à une passation par anticipation"
    assert p["nombre_demi_journees"] == 3
    assert all(d <= p["plafond"] for d in p["durees"])
    attendus = set(D.liste_effective_des_instruments_a_passer(qp, catalogue))
    places = {(x["code"], x["version"]) for dj in p["demi_journees"] for x in dj}
    places |= {(x["code"], x["version"]) for x in p["a_distance"]}
    assert places == attendus


def test_le_bilan_se_rend_avec_le_bandeau_et_les_controles_verts(b):
    texte, verifs = B.rendre(b)
    assert B.diffusable(verifs)
    assert B.BANDEAU_MAQUETTE in texte
    lignes = [l for l in texte.splitlines() if l.strip()]
    assert lignes[1] == B.BANDEAU_MAQUETTE
    positions = [texte.index(f"\n## {n}. ") for n in range(1, 8)]
    assert positions == sorted(positions)


def test_len_tete_dit_la_session_et_le_mode_et_non_le_champ_deprecie(b):
    texte, _ = B.rendre(b)
    assert "Session du baccalauréat : **2028**" in texte
    assert "par anticipation, l'année scolaire **2026-2027**" in texte
    assert "Session visée" not in texte


def test_lepreuve_anticipee_fragile_passe_avant_les_specialites(b):
    """EC-31, tranché le 2026-09-11 : la règle du français devient générique.

    Les mathématiques anticipées étaient la matière la plus fragile du jeu — 43 % contre
    59 % en français — et figuraient au dernier rang, derrière le tronc commun, parce que
    le § 8.2 n'ordonnait qu'une seule épreuve anticipée.
    """
    ordre, motifs = b.priorite()
    assert ordre[0] == "MATHEMATIQUES", ordre
    assert ordre.index("MATHEMATIQUES") < min(
        ordre.index(g) for g in ordre if g.startswith("EDS-"))
    assert "épreuve anticipée due pendant l'année" in motifs["MATHEMATIQUES"]
    assert "tronc commun" not in motifs["MATHEMATIQUES"]
    assert motifs["TC-ES"] == b.regles["priorite_matieres"][
        "placement_non_ordonne"]["motifs"]["_defaut"]


def test_lepreuve_anticipee_non_fragile_reprend_sa_place_apres_les_specialites(b):
    """Le français, au-dessus du seuil, n'est pas promu : il accompagne."""
    ordre, motifs = b.priorite()
    assert ordre.index("FRANCAIS") > max(
        ordre.index(g) for g in ordre if g.startswith("EDS-"))
    assert motifs["FRANCAIS"] == b.regles["priorite_matieres"][
        "epreuves_anticipees_si_fragiles"]["motif_rendu_non_fragile"]


def test_le_departage_de_deux_epreuves_anticipees_fragiles(b):
    """Deux épreuves promues : gravité, puis score, puis coefficient officiel."""
    import copy
    c = copy.deepcopy(b)
    seuil = c.seuil_du_niveau("En consolidation")
    for pc in c.groupes["FRANCAIS"]:
        c.agr[pc]["global"] = seuil - 0.01          # français fragile, mais moins
    ordre, _ = c.priorite()
    assert ordre[:2] == ["MATHEMATIQUES", "FRANCAIS"], ordre
    assert ordre.index("FRANCAIS") < min(
        ordre.index(g) for g in ordre if g.startswith("EDS-"))


def test_le_motif_et_le_placement_viennent_du_referentiel(b):
    import copy
    c = copy.deepcopy(b)
    ea = c.regles["priorite_matieres"]["epreuves_anticipees_si_fragiles"]
    ea["motif_rendu_fragile"] = "MOTIF TÉMOIN"
    _, motifs = c.priorite()
    assert motifs["MATHEMATIQUES"].endswith("MOTIF TÉMOIN"), \
        "le motif est écrit en dur dans le moteur"
    ea["placement"]["P1"] = "apres_les_specialites"
    ordre, _ = c.priorite()
    assert ordre[0] != "MATHEMATIQUES", "le placement est écrit en dur dans le moteur"


def test_une_matiere_sans_epreuve_anticipee_nest_jamais_promue(b):
    """Le tronc commun peut être fragile : il n'est pas une épreuve anticipée."""
    import copy
    c = copy.deepcopy(b)
    for pc in c.groupes["TC-ES"]:
        c.agr[pc]["global"] = 0.05
    ordre, motifs = c.priorite()
    assert ordre[-1] == "TC-ES", ordre
    assert not c.porte_epreuve_anticipee("TC-ES")


# ─────────────────────────────── non-régression : la cohorte historique n'a pas bougé

def test_le_jeu_p1_historique_reste_sur_son_contexte():
    r = charger(RACINE / "instruments" / "_MAQUETTE_P1" / "qp.json")["reponses"]
    assert r["session_baccalaureat_finale"] == 2027
    assert r["annee_scolaire_passation_ea"] == "2025-2026"
    hist = M.Bilan(dossier=RACINE / "instruments" / "_MAQUETTE_P1").calculer()
    assert "MATH-EA" not in hist.perimetres_passes, \
        "l'épreuve anticipée de mathématiques n'existe pas pour une passation 2025-2026"
    assert dict(hist.instruments)["FR-EAF"] == "standard"
