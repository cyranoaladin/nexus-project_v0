"""Les inventaires d'audit versionnés disent ce que le dépôt calcule, pas ce qu'on croit.

`scripts/audit_inventory.py` dérive du catalogue, des banques, du plan de release, de
l'espace d'états candidats et du moteur de packs : l'inventaire des fichiers, la couverture
des instruments, l'espace d'états et son agrégation, les familles invalides et les golden
packs synthétiques. Ces tests refusent une dérive entre les fichiers versionnés sous
`audit/` et ce calcul. Ils ne prouvent rien du métier : la preuve d'un état valide est
`tests/test_espace_candidats.py`, celle d'un état invalide `tests/test_faits_candidat.py`.
"""
import itertools
import json
import re
import sys
from pathlib import Path

import pytest

ROOT = Path(__file__).resolve().parent.parent
sys.path.insert(0, str(ROOT / "scripts"))
import audit_inventory as AI  # noqa: E402
import faits_candidat as FC  # noqa: E402

AUDIT = ROOT / "audit"
RELEASE = ROOT / "release" / "diagnostics-v2"
MANIFESTE = RELEASE / "04_INTERNE" / "MANIFESTE_V2.json"
IDENTITE_FIXTURE = "Camille TEST"
ID_FIXTURE = re.compile(r"CL-TEST-\d{4}|CL-TEST-0000|CL-2026-000\d")  # fixtures et maquettes seulement


def charger(nom):
    return json.loads((AUDIT / nom).read_text(encoding="utf-8"))


@pytest.fixture(scope="module")
def produits():
    return {p.relative_to(ROOT).as_posix(): json.loads(c) for p, c in AI.produits().items()}


def test_couverture_instruments_synchronisee(produits):
    assert charger("AUDIT_INSTRUMENT_COVERAGE.json") == produits["audit/AUDIT_INSTRUMENT_COVERAGE.json"]


def test_espace_etats_synchronise(produits):
    assert charger("AUDIT_CANDIDATE_STATE_SPACE.json") == produits["audit/AUDIT_CANDIDATE_STATE_SPACE.json"]


def test_couverture_candidats_synchronisee(produits):
    assert charger("AUDIT_CANDIDATE_COVERAGE.json") == produits["audit/AUDIT_CANDIDATE_COVERAGE.json"]


def test_couverture_invalides_synchronisee(produits):
    assert charger("AUDIT_INVALID_STATE_COVERAGE.json") == produits["audit/AUDIT_INVALID_STATE_COVERAGE.json"]


def test_golden_packs_synchronises(produits):
    attendus = {k: v for k, v in produits.items() if k.startswith("audit/golden_packs/")}
    assert len(attendus) == len(AI.GOLDEN_SCENARIOS) >= 11
    for chemin, contenu in attendus.items():
        assert json.loads((ROOT / chemin).read_text(encoding="utf-8")) == contenu, chemin
    presents = sorted(p.name for p in (AUDIT / "golden_packs").glob("*.json"))
    assert presents == sorted(Path(k).name for k in attendus), "golden pack orphelin"


def test_inventaire_fichiers_synchronise_hors_release(produits):
    """Les entrées hors release sont exactes ; celles de la release sont prouvées par
    MANIFESTE_V2 (elles changent au commit de release, qui ne touche que release/)."""
    versionne = {e["path"]: e for e in charger("AUDIT_FILE_INVENTORY.json")["fichiers"]}
    calcule = {e["path"]: e for e in produits["audit/AUDIT_FILE_INVENTORY.json"]["fichiers"]}
    hors = lambda d: {k: v for k, v in d.items() if not k.startswith("release/")}  # noqa: E731
    assert hors(versionne) == hors(calcule)


def test_toutes_les_categories_attendues_sont_presentes():
    inv = charger("AUDIT_FILE_INVENTORY.json")
    attendues = {"SOURCE", "REFERENTIAL", "INSTRUMENT_BANK", "ASSEMBLY", "TEST", "TEMPLATE",
                 "CANONICAL_CANDIDATE_PDF", "CANONICAL_COACH_PDF", "PRINT_COLLECTION", "GUIDE",
                 "MANIFEST", "AUDIT_FIXTURE", "DOCUMENTATION"}
    assert attendues <= set(inv["par_categorie"])
    assert all(re.fullmatch(r"[0-9a-f]{64}", e["sha256"]) for e in inv["fichiers"])


def test_le_catalogue_entier_est_couvert():
    cov = charger("AUDIT_INSTRUMENT_COVERAGE.json")
    catalogue = json.loads((ROOT / "referentiels/catalogue_instruments.json").read_text(encoding="utf-8"))
    codes = sorted({i["code"] for i in catalogue["instruments"]})
    assert sorted(i["instrument_id"] for i in cov["instruments"]) == codes
    assert cov["variant_count"] == len(catalogue["instruments"])
    for i in cov["instruments"]:
        assert i["source_bank"], i["instrument_id"]
        assert i["tests_covering"], f"{i['instrument_id']} : aucun test ne le cite"
        assert i["profile_applicability"], i["instrument_id"]


# ─────────────────────────────────────────────── l'espace d'états n'est pas auto-référentiel

def test_l_espace_d_etats_est_celui_du_moteur_et_chaque_etat_est_execute():
    espace = charger("AUDIT_CANDIDATE_STATE_SPACE.json")
    ids = [e["scenario_id"] for e in espace["etats"]]
    assert ids == [e["scenario_id"] for e in FC.candidate_state_space()], "l'espace versionné n'est pas celui du moteur"
    assert len(ids) == len(set(ids)) == espace["total"]
    assert espace["exhaustive_test"] == "tests/test_espace_candidats.py::test_etat_valide"
    assert "test_audit_inventory" not in espace["exhaustive_test"]
    for e in espace["etats"]:
        assert e["independently_tested"] is True
        assert "test_audit_inventory" not in " ".join(e["other_independent_tests"]), e["scenario_id"]
        assert e["duration"] > 0 and e["selection_signature"] and e["booklet_signature"]


def test_l_agregation_dit_le_domaine_entier():
    agreg = charger("AUDIT_CANDIDATE_COVERAGE.json")
    espace = charger("AUDIT_CANDIDATE_STATE_SPACE.json")
    faits = [e["normalized_facts"] for e in espace["etats"]]
    assert agreg["valid_states_total"] == len(faits)
    assert agreg["untested_valid_states"] == 0 and agreg["duplicate_scenario_ids"] == 0
    assert agreg["speciality_triples_total"] == len(list(itertools.combinations(FC.SPECIALITES_VALIDES, 3)))
    assert agreg["p2_orientation_structures_total"] == agreg["speciality_triples_total"] * 3
    assert agreg["p3_orientation_structures_total"] == agreg["speciality_triples_total"] * 3
    assert agreg["p1_orientation_structures_total"] == agreg["speciality_triples_total"] * 4
    assert agreg["all_speciality_triples_covered_per_profile"] is True
    assert agreg["distinct_selection_signatures"] == len({(f["profil"], e["selection_signature"])
                                                          for f, e in zip(faits, espace["etats"])})
    assert all(e["selection_signature"] in espace["signatures"] and e["booklet_signature"] in espace["signatures"]
               for e in espace["etats"])
    assert sum(agreg["par_profil"].values()) == sum(agreg["par_mode"].values()) == len(faits)
    # Chaque valeur de chaque dimension discrète est vérifiée séparément, jamais par un « any » global.
    for e in ("none", "ecrit", "oral", "les_deux"):
        assert agreg["par_eaf"][e] > 0, e
        assert any(f["profil"] == "P2" and f["eaf_due"] == e for f in faits), e
    for m in FC.MODES_EP:
        assert agreg["par_mode"][m] > 0, m
        assert any(f["profil"] == "P1" and f["mode_ep"] == m for f in faits), m
        assert any(f["profil"] == "P2" and f["mode_ep"] == m for f in faits), m
    for parcours in ("SPE", "SPECIFIQUES", "non_due"):
        assert agreg["par_parcours_math_ea"][parcours] > 0, parcours
    assert any(f["profil"] == "P2" and f["math_ea_due"] and "MATH" in f["spes_terminales"] for f in faits)
    assert any(f["profil"] == "P2" and f["math_ea_due"] and "MATH" not in f["spes_terminales"] for f in faits)
    for etat in ("off", "on"):
        assert agreg["par_fr_pos"][etat] > 0 and agreg["par_fr_mai"][etat] > 0, etat
    for profil in FC.PROFILS:
        assert any(f["profil"] == profil and f["fr_pos_requis"] for f in faits), profil
    for profil in FC.FR_MAI_PROFILS:
        assert any(f["profil"] == profil and f["fr_mai_requis"] for f in faits), profil
    assert not any(f["profil"] == "P1" and f["fr_mai_requis"] for f in faits)
    assert not any(f["profil"] == "P3" and f["mode_ep"] != "fin_cycle" for f in faits)


def test_les_familles_invalides_sont_toutes_refusees():
    inv = charger("AUDIT_INVALID_STATE_COVERAGE.json")
    assert inv["families_total"] == inv["families_rejected"] >= 20
    for f in inv["families"]:
        assert f["rejected"] is True, f["family_id"]
        assert re.search(f["expected_error_pattern"], f["error_message"]), f["family_id"]
        assert f["test_proving"].startswith("tests/test_faits_candidat.py::")


def test_les_golden_packs_sont_fictifs_et_prouves_hors_synchronisation():
    for p in sorted((AUDIT / "golden_packs").glob("*.json")):
        pack = json.loads(p.read_text(encoding="utf-8"))
        assert pack["identity"] == {"candidat": IDENTITE_FIXTURE, "candidat_id": pack["identity"]["candidat_id"],
                                    "session": 2027, "fictional": True}
        assert re.fullmatch(r"CL-TEST-\d{4}", pack["identity"]["candidat_id"])
        assert pack["booklets_selected"] and pack["total_diagnostic_duration_min"] > 0
        assert pack["export_directory"].startswith("Camille_TEST__CL-TEST-")
        assert pack["tests_proving_independent"], p.name
        assert all("test_audit_inventory" not in t for t in pack["tests_proving_independent"]), p.name
        assert any(t.startswith("tests/test_espace_candidats.py::test_etat_valide[") for t in pack["tests_proving_independent"])


def test_aucune_identite_reelle_dans_les_inventaires():
    """Les inventaires ne nomment que la fixture : tout champ d'identité vaut « Camille
    TEST », tout identifiant candidat est un identifiant de fixture ou de maquette."""
    def parcourir(x, chemin):
        if isinstance(x, dict):
            for k, v in x.items():
                if k in ("candidat", "candidat_nom", "nom"):
                    assert v == IDENTITE_FIXTURE, (chemin, k, v)
                if k in ("candidat_id", "candidate_safe_label"):
                    assert ID_FIXTURE.fullmatch(str(v)), (chemin, k, v)
                parcourir(v, chemin)
        elif isinstance(x, list):
            for v in x:
                parcourir(v, chemin)
    for p in AUDIT.rglob("*.json"):
        parcourir(json.loads(p.read_text(encoding="utf-8")), p)
        assert not re.search(r"CL-20\d\d-\d{4}", p.read_text(encoding="utf-8").replace("CL-2026-000", "")), p
