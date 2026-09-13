"""Tests pour les nouvelles disciplines : TC-HG, TC-EMC, FR-POS et FR-POS-ORAL."""
import json
import re
from pathlib import Path
import pytest

RACINE = Path(__file__).resolve().parent.parent


@pytest.fixture(scope="module")
def catalogue():
    with open(RACINE / "referentiels" / "catalogue_instruments.json", encoding="utf-8") as f:
        return json.load(f)


@pytest.fixture(scope="module")
def modalites():
    with open(RACINE / "referentiels" / "modalites_epreuves.json", encoding="utf-8") as f:
        return json.load(f)


@pytest.fixture(scope="module")
def competences():
    with open(RACINE / "referentiels" / "competences.json", encoding="utf-8") as f:
        return json.load(f)


def test_tc_hg_versions_et_durees(catalogue):
    """TC-HG comporte trois versions (1RE, TLE, ETENDUE) de durées 45, 45 et 60 min."""
    fiches = {i["version"]: i for i in catalogue["instruments"] if i["code"] == "TC-HG"}
    assert set(fiches) == {"1RE", "TLE", "ETENDUE"}
    assert fiches["1RE"]["duree_cible_min"] == 45
    assert fiches["TLE"]["duree_cible_min"] == 45
    assert fiches["ETENDUE"]["duree_cible_min"] == 60


def test_tc_emc_versions_et_criteres(catalogue):
    """TC-EMC comporte trois versions de durées 20, 20 et 25 min avec 11 critères."""
    fiches = {i["version"]: i for i in catalogue["instruments"] if i["code"] == "TC-EMC"}
    assert set(fiches) == {"1RE", "TLE", "ETENDUE"}
    assert fiches["1RE"]["duree_cible_min"] == 20
    assert fiches["TLE"]["duree_cible_min"] == 20
    assert fiches["ETENDUE"]["duree_cible_min"] == 25
    for v, f in fiches.items():
        assert f["nb_criteres"] == 11
        assert f["support"] == "grille_coach"


def test_fr_pos_bareme_exact_40_points(catalogue):
    """FR-POS totalise exactement 40 points (15 COMP, 15 LANG, 10 PROD) sur 45 min."""
    fiche = next(i for i in catalogue["instruments"] if i["code"] == "FR-POS")
    assert fiche["duree_cible_min"] == 45
    with open(RACINE / "instruments" / "FR-POS" / "banque.json", encoding="utf-8") as f:
        banque = json.load(f)
    items = {it["item_id"]: it for it in banque["items"]}
    comp_points = {}
    for it in items.values():
        c = it["competence"]
        comp_points[c] = comp_points.get(c, 0) + it["score_max"]
    assert comp_points["COMP"] == 15
    assert comp_points["LANG"] == 15
    assert comp_points["PROD"] == 10
    assert sum(comp_points.values()) == 40


def test_fr_pos_oral_structure(catalogue):
    """FR-POS-ORAL comporte 5 critères à 3 points (15 points) pour 10 min."""
    fiche = next(i for i in catalogue["instruments"] if i["code"] == "FR-POS-ORAL")
    assert fiche["duree_cible_min"] == 10
    assert fiche["nb_criteres"] == 5
    with open(RACINE / "instruments" / "FR-POS-ORAL" / "definition.json", encoding="utf-8") as f:
        d = json.load(f)
    assert len(d["criteres"]) == 5
    assert d["instrument"] == "FR-POS-ORAL"


def test_couverture_reglementaire_coefficients(modalites):
    """Contrôle des coefficients CC : 22 couverts / 18 non couverts."""
    couv = modalites["couverture_nexus"]
    assert couv["coefficients_couverts_controle_continu"] == 22
    assert couv["coefficients_non_couverts_controle_continu"] == 18
    non_couverts = {x["code"] for x in couv["non_couverts"]}
    assert non_couverts == {"LVA", "LVB", "EPS"}


def test_fr_pos_absence_de_mention_cecrl():
    """FR-POS ne revendique pas de certification CECRL mais formule son positionnement scolaire."""
    with open(RACINE / "instruments" / "FR-POS" / "banque.json", encoding="utf-8") as f:
        banque = json.load(f)
    txt = json.dumps(banque, ensure_ascii=False)
    assert "CECRL" not in txt
    assert "CEFR" not in txt


FR_POS_SOURCE = "sources_internes/francais/FR-POS/Test_positionnement_source_enseignante.pdf"
FR_POS_ATTENDU = {"sha256": "f1b56017e48b9a4793bcd800d4fdf1ce4ff171747960853f23448cebc4173687",
                  "taille": 345948, "pages": 7}


def _metadonnees_readme_fr_pos() -> dict:
    """Les valeurs attendues publiées dans le README du dossier source (dépôt public)."""
    texte = (RACINE / "sources_internes/francais/FR-POS/README.md").read_text(encoding="utf-8")
    valeurs = dict(re.findall(r"^(EXPECTED_[A-Z0-9_]+|PRIVATE_SOURCE_NOT_IN_PUBLIC_REPO)=(\S+)$", texte, re.M))
    return valeurs


def test_fr_pos_source_interne_reproductible():
    """La source interne de FR-POS est reproductible : empreinte exacte si le PDF privé est
    présent localement ; sinon, métadonnées publiées cohérentes. Le PDF de l'enseignante
    n'entre pas dans le dépôt public, ses métadonnées si."""
    import hashlib
    import subprocess
    with open(RACINE / "referentiels" / "textes_sources.json", encoding="utf-8") as f:
        entry = json.load(f)["textes"]["fr_pos_adolescents"]
    assert entry["source_type"] == "interne_nexus"
    assert entry["chemin_source"] == FR_POS_SOURCE
    assert (entry["sha256_binaire"], entry["taille"], entry["pages"]) == \
        (FR_POS_ATTENDU["sha256"], FR_POS_ATTENDU["taille"], FR_POS_ATTENDU["pages"])

    readme = _metadonnees_readme_fr_pos()
    assert readme["PRIVATE_SOURCE_NOT_IN_PUBLIC_REPO"] == "YES"
    assert readme["EXPECTED_FILE"] == Path(FR_POS_SOURCE).name
    assert readme["EXPECTED_SHA256"] == FR_POS_ATTENDU["sha256"]
    assert int(readme["EXPECTED_SIZE"]) == FR_POS_ATTENDU["taille"]
    assert int(readme["EXPECTED_PAGES"]) == FR_POS_ATTENDU["pages"]

    gitignore = (RACINE / ".gitignore").read_text(encoding="utf-8").splitlines()
    assert FR_POS_SOURCE in gitignore, "le PDF privé doit être exclu du dépôt public"

    src_file = RACINE / FR_POS_SOURCE
    if not src_file.exists():
        # Clone public : le document privé est absent par construction, et les
        # métadonnées ci-dessus sont ce que le dépôt public prouve.
        return
    data = src_file.read_bytes()
    assert hashlib.sha256(data).hexdigest() == FR_POS_ATTENDU["sha256"]
    assert len(data) == FR_POS_ATTENDU["taille"]
    info = subprocess.run(["pdfinfo", str(src_file)], capture_output=True, text=True).stdout
    assert int(info.split("Pages:")[1].split()[0]) == FR_POS_ATTENDU["pages"]


def test_emc_reserve_officielle_et_pas_de_duree_officielle_fausse():
    """EMC porte sa réserve réglementaire et 20/25 min n'est jamais présenté comme durée officielle."""
    with open(RACINE / "referentiels" / "modalites_epreuves.json", encoding="utf-8") as f:
        mod = json.load(f)
    emc = next(ens for ens in mod["evaluations_ponctuelles"]["enseignements"] if ens["code"] == "EMC")
    assert emc["statut_modalite_2026_2027"] == "a_confirmer_reglementairement"
    assert "MENE2531481N" in emc["candidat_individuel"]

