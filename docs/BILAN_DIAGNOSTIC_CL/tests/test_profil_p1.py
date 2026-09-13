"""Le profil P1 : la règle du § 8.2 qui n'était pas couverte (Q-23).

« P1 : français d'abord si FR-EAF < 55 %, sinon spécialité la plus fragile. » La règle
figurait au Cahier, le référentiel la déclarait, aucun jeu ne l'exerçait : Q-23 était une
question de couverture, pas un arbitrage à rendre. Ces tests couvrent les deux côtés du
seuil, la valeur frontière, l'égalité entre spécialités et la remise à niveau, et
vérifient que les placements de P2 et P3 n'ont pas bougé.
"""
import copy
import json
import sys
from pathlib import Path

import pytest

RACINE = Path(__file__).resolve().parent.parent
MAQ = RACINE / "instruments" / "_MAQUETTE"
MAQ_P1 = RACINE / "instruments" / "_MAQUETTE_P1"
MAQ_P2 = RACINE / "instruments" / "_MAQUETTE_P2"
sys.path.insert(0, str(RACINE / "scripts"))

import bilan as B  # noqa: E402
import maquette_bilan as M  # noqa: E402


@pytest.fixture(scope="module")
def p1():
    return M.Bilan(dossier=MAQ_P1).calculer()


@pytest.fixture(scope="module")
def p3():
    return M.Bilan().calculer()


@pytest.fixture(scope="module")
def p2():
    return M.Bilan(dossier=MAQ_P2).calculer()


def place_francais(b, valeur):
    """Rejoue la priorité avec un score global de français imposé."""
    c = copy.deepcopy(b)
    for pc in c.groupes["FRANCAIS"]:
        c.agr[pc]["global"] = valeur
    ordre, _ = c.priorite()
    return ordre


def specialites(b, ordre):
    """Les groupes qui portent une spécialité, MATHEMATIQUES compris depuis MATH-EA."""
    return [g for g in ordre if any(pc.startswith("EDS-") for pc in b.groupes[g])]


# ─────────────────────────────── le jeu P1 lui-même

def test_le_jeu_p1_couvre_le_profil(p1):
    assert p1.qp["reponses"]["profil"] == "P1"
    codes = {c for c, _ in p1.instruments}
    assert {"FR-EAF", "FR-EAF-ORAL", "TC-ES", "QP", "MET"} <= codes
    assert "PHI" not in codes and "GO" not in codes, \
        "la matrice du § 3.2 n'ouvre ni la philosophie ni le Grand oral à un P1"
    assert p1.version_passee("EDS-MATH") == "N1"


def test_tous_les_attendus_du_jeu_p1_sont_tenus(p1):
    resultats = M.verifier_specification(p1)
    ecarts = [(v["id"], [(d, o) for d, o, ok in v["lignes"] if not ok])
              for v in resultats if not v["conforme"]]
    assert not ecarts, ecarts


# ─────────────────────────────── les deux côtés du seuil, et la frontière

def test_sous_le_seuil_le_francais_passe_avant_les_specialites(p1):
    seuil = p1.seuil_du_niveau("En consolidation")
    ordre = place_francais(p1, seuil - 0.01)
    assert ordre[0] == "FRANCAIS", ordre
    assert ordre.index("FRANCAIS") < min(ordre.index(g) for g in specialites(p1, ordre))


def test_au_dessus_du_seuil_les_specialites_passent_avant(p1):
    seuil = p1.seuil_du_niveau("En consolidation")
    ordre = place_francais(p1, seuil + 0.01)
    assert ordre[0] != "FRANCAIS"
    assert ordre.index("FRANCAIS") > max(ordre.index(g) for g in specialites(p1, ordre))


def test_a_la_valeur_frontiere_le_francais_ne_passe_pas_devant(p1):
    """Le § 8.2 écrit « < 55 % » : à 55 % exactement, la condition n'est pas remplie."""
    seuil = p1.seuil_du_niveau("En consolidation")
    ordre = place_francais(p1, seuil)
    assert ordre[0] != "FRANCAIS", "la frontière est traitée comme un dépassement"


def test_le_placement_vient_du_referentiel_et_non_du_script(p1):
    b = copy.deepcopy(p1)
    placement = b.regles["priorite_matieres"][
        "epreuves_anticipees_si_fragiles"]["placement"]
    assert placement["P1"] == "avant_les_specialites"
    placement["P1"] = "apres_les_specialites"
    ordre, _ = b.priorite()
    assert ordre[0] != "FRANCAIS", "le placement est écrit en dur dans le moteur"


# ─────────────────────────────── égalité entre spécialités, remise à niveau

def test_deux_specialites_a_egalite_suivent_lordre_de_declaration(p1):
    b = copy.deepcopy(p1)
    a, c = b.groupe_de["EDS-MATH"], b.groupe_de["EDS-PC"]
    valeur = min(b.agr[pc]["global"] for pc in b.groupes[a])
    for pc in b.groupes[c]:
        b.agr[pc]["global"] = valeur                      # égalité parfaite
    assert b.gravite_groupe(a)[0] == b.gravite_groupe(c)[0]
    ordre, _ = b.priorite()
    declaration = b.qp["reponses"]["specialites"]
    assert declaration.index("MATH") < declaration.index("PC")
    assert ordre.index(a) < ordre.index(c), \
        "à égalité, l'ordre n'est pas celui du questionnaire"


def test_le_departage_par_declaration_est_reproductible(p1):
    ordres = {tuple(copy.deepcopy(p1).priorite()[0]) for _ in range(5)}
    assert len(ordres) == 1, "l'ordre de priorité n'est pas reproductible"


def test_une_specialite_entre_par_remise_a_niveau(p1):
    module, code, _ = p1.module_entree("EDS-SVT")
    assert module == p1.regles["module_entree"]["libelle_remise_a_niveau"]
    assert code is None
    seuil = p1.regles["agregats"]["prerequis"]["seuil_remise_a_niveau"]
    assert p1.agr["EDS-SVT"]["prerequis"] < seuil
    assert p1.rythme("EDS-SVT")[0] == p1.regles["rythmes_hebdomadaires"]["par_niveau"][module]


def test_la_specialite_en_remise_a_niveau_ouvre_les_specialites(p1):
    ordre, _ = p1.priorite()
    assert specialites(p1, ordre)[0] == "EDS-SVT", \
        "la gravité du module ne commande plus l'ordre des spécialités"


# ─────────────────────────────── les autres profils n'ont pas bougé

@pytest.mark.parametrize("jeu", ["p2", "p3"])
def test_pour_p2_et_p3_le_francais_reste_apres_les_specialites(jeu, request):
    b = request.getfixturevalue(jeu)
    ordre, _ = b.priorite()
    assert ordre[0] != "FRANCAIS"
    abandonnee = b.groupe_de.get(f"EDS-{b.qp['reponses']['specialite_abandonnee']}")
    poursuivies = [g for g in specialites(b, ordre) if g != abandonnee]
    assert ordre.index("FRANCAIS") > max(ordre.index(g) for g in poursuivies)


# ─────────────────────────────── le rendu du jeu P1

def test_le_bilan_p1_se_rend_et_porte_le_bandeau(p1):
    texte, verifs = B.rendre(p1)
    assert B.diffusable(verifs)
    assert B.BANDEAU_MAQUETTE in texte
    positions = [texte.index(f"\n## {n}. ") for n in range(1, 8)]
    assert positions == sorted(positions)


def test_le_plan_p1_commence_par_le_francais(p1):
    texte, _ = B.rendre(p1)
    plan = texte.split("\n## 5. ", 1)[1].split("\n## 6. ", 1)[0]
    premier = plan.split("**", 2)[1]
    assert B.nom_matiere(p1, "FR-EAF") in premier, premier


def test_les_priorites_p1_suivent_le_plan(p1):
    _, priorites = B.appuis_et_priorites(p1)
    ordre, _ = p1.priorite()
    assert [x["groupe"] for x in priorites] == ordre[:len(priorites)]
