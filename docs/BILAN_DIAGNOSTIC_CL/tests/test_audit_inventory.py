"""Les inventaires d'audit versionnés disent ce que le dépôt calcule, pas ce qu'on croit.

`scripts/audit_inventory.py` dérive du catalogue, des banques, du plan de release et du
moteur de packs : l'inventaire des fichiers, la couverture des instruments, la couverture
des situations candidates et les golden packs synthétiques. Ces tests refusent une dérive
entre les fichiers versionnés sous `audit/` et ce calcul, et vérifient que le périmètre
métier y figure entièrement, sans identité réelle.
"""
import json
import re
import sys
from pathlib import Path

import pytest

ROOT = Path(__file__).resolve().parent.parent
sys.path.insert(0, str(ROOT / "scripts"))
import audit_inventory as AI  # noqa: E402
import pack_candidat as PC  # noqa: E402

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


def test_couverture_candidats_synchronisee(produits):
    assert charger("AUDIT_CANDIDATE_COVERAGE.json") == produits["audit/AUDIT_CANDIDATE_COVERAGE.json"]


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
    if MANIFESTE.exists():
        manifeste = json.loads(MANIFESTE.read_text(encoding="utf-8"))
        empreintes = {}
        for a in manifeste.get("artefacts", manifeste.get("fichiers", [])):
            chemin = a.get("chemin") or a.get("fichier") or a.get("path")
            if chemin and a.get("sha256"):
                empreintes[chemin] = a["sha256"]
        for chemin, e in calcule.items():
            if chemin.startswith("release/") and not chemin.endswith(("MANIFESTE_V2.json", "MANIFESTE_V2.md")):
                cle = chemin[len("release/diagnostics-v2/"):]
                if cle in empreintes:
                    assert empreintes[cle] == e["sha256"], chemin


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
        for v in i["versions"]:
            assert v["candidate_pdf_paths"] or i["instrument_id"] in ("FR-EAF-ORAL", "FR-POS-ORAL", "GO", "MET", "QP") \
                or v["candidate_pdf_paths"] == [], v


def test_chaque_situation_candidate_a_ses_livrets_et_ses_preuves():
    cov = charger("AUDIT_CANDIDATE_COVERAGE.json")
    ids = [s["scenario_id"] for s in cov["scenarios"]]
    assert len(ids) == len(set(ids))
    profils = {s["facts"]["profil"] for s in cov["scenarios"]}
    assert profils == {"P1", "P2", "P3"}
    for s in cov["scenarios"]:
        assert s["expected_official_obligations"], s["scenario_id"]
        assert s["expected_candidate_booklets"], s["scenario_id"]
        assert s["total_diagnostic_duration_min"] == sum(l["minutes"] for l in s["family_manifest_lines"])
        assert s["tests_proving"], s["scenario_id"]
        for b in s["expected_candidate_booklets"]:
            assert b["chemin_canonique"].startswith("release/diagnostics-v2/01_LIVRETS_CANDIDAT/")
            assert b["fichier"] not in s["expected_excluded_booklets"]
    # Chaque paire de spécialités terminales est servie en P2, dans les deux modes.
    paires = {(s["facts"]["mode_ep"], tuple(sorted(s["facts"]["spes_terminales"])))
              for s in cov["scenarios"] if s["facts"]["profil"] == "P2" and len(s["facts"]["spes_terminales"]) == 2}
    import itertools
    attendues = {(m, p) for m in ("annuelle", "fin_cycle") for p in itertools.combinations(sorted(PC.SPECIALITES_VALIDES), 2)}
    assert attendues <= paires
    assert any(s["facts"].get("eaf_due") == e for e in ("ecrit", "oral", "les_deux") for s in cov["scenarios"] if s["facts"]["profil"] == "P2")
    assert any(s["facts"].get("math_ea_due") and "MATH" in s["facts"]["spes_terminales"] for s in cov["scenarios"] if s["facts"]["profil"] == "P2")
    assert any(s["facts"].get("math_ea_due") and "MATH" not in s["facts"]["spes_terminales"] for s in cov["scenarios"] if s["facts"]["profil"] == "P2")


def test_les_golden_packs_sont_fictifs():
    for p in sorted((AUDIT / "golden_packs").glob("*.json")):
        pack = json.loads(p.read_text(encoding="utf-8"))
        assert pack["identity"] == {"candidat": "Camille TEST", "candidat_id": pack["identity"]["candidat_id"],
                                    "session": 2027, "fictional": True}
        assert re.fullmatch(r"CL-TEST-\d{4}", pack["identity"]["candidat_id"])
        assert pack["booklets_selected"] and pack["total_diagnostic_duration_min"] > 0
        assert pack["export_directory"].startswith("Camille_TEST__CL-TEST-")


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
